import express from 'express';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import Assignment from '../models/Assignment.js';
import Notification from '../models/Notification.js';
import News from '../models/News.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /stats
 * Aggregate comprehensive admin dashboard metrics/KPIs.
 * Requires MUNICIPALIDAD role.
 */
router.get(
  '/stats',
  authenticate,
  requireRole('MUNICIPALIDAD'),
  async (req, res) => {
    try {
      const now = new Date();
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      // ── Organization stats ──────────────────────────────────────────

      const [
        totalOrgs,
        byStatusAgg,
        byTypeAgg,
        createdThisMonth,
        createdLastMonth,
        approvedThisMonthCount,
        approvedOrgs
      ] = await Promise.all([
        Organization.countDocuments(),

        Organization.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),

        Organization.aggregate([
          { $group: { _id: '$organizationType', count: { $sum: 1 } } }
        ]),

        Organization.countDocuments({ createdAt: { $gte: startOfThisMonth } }),

        Organization.countDocuments({
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        }),

        // Organizations that transitioned to 'approved' this month
        Organization.countDocuments({
          status: 'approved',
          'statusHistory': {
            $elemMatch: {
              status: 'approved',
              date: { $gte: startOfThisMonth }
            }
          }
        }),

        // All approved organizations (for avgProcessingDays calculation)
        Organization.find(
          { status: 'approved' },
          { createdAt: 1, statusHistory: 1 }
        ).lean()
      ]);

      // Build byStatus map with all known statuses
      const byStatus = {
        draft: 0,
        waiting_ministro: 0,
        ministro_scheduled: 0,
        pending_review: 0,
        in_review: 0,
        approved: 0,
        rejected: 0,
        dissolved: 0,
        sent_registry: 0
      };
      for (const entry of byStatusAgg) {
        if (entry._id in byStatus) {
          byStatus[entry._id] = entry.count;
        }
      }

      // Build byType map
      const byType = {};
      for (const entry of byTypeAgg) {
        if (entry._id) {
          byType[entry._id] = entry.count;
        }
      }

      // Calculate avgProcessingDays
      let avgProcessingDays = 0;
      if (approvedOrgs.length > 0) {
        let totalDays = 0;
        let countWithApprovalDate = 0;

        for (const org of approvedOrgs) {
          // Find the date when status became 'approved' from statusHistory
          const approvalEntry = org.statusHistory
            ?.slice()
            .reverse()
            .find((h) => h.status === 'approved');

          if (approvalEntry && approvalEntry.date && org.createdAt) {
            const created = new Date(org.createdAt);
            const approved = new Date(approvalEntry.date);
            const diffMs = approved.getTime() - created.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays >= 0) {
              totalDays += diffDays;
              countWithApprovalDate++;
            }
          }
        }

        if (countWithApprovalDate > 0) {
          avgProcessingDays = Math.round((totalDays / countWithApprovalDate) * 10) / 10;
        }
      }

      // ── Ministro stats ──────────────────────────────────────────────

      const [
        totalMinistros,
        activeMinistros,
        assignmentsPending,
        assignmentsCompleted,
        loadByMinistroAgg
      ] = await Promise.all([
        User.countDocuments({ role: 'MINISTRO_FE' }),
        User.countDocuments({ role: 'MINISTRO_FE', active: true }),
        Assignment.countDocuments({ status: 'pending' }),
        Assignment.countDocuments({ status: 'completed' }),

        Assignment.aggregate([
          {
            $group: {
              _id: '$ministroId',
              name: { $first: '$ministroName' },
              pending: {
                $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
              },
              completed: {
                $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
              }
            }
          },
          { $sort: { pending: -1 } }
        ])
      ]);

      const loadByMinistro = loadByMinistroAgg.map((entry) => ({
        name: entry.name,
        pending: entry.pending,
        completed: entry.completed
      }));

      // ── User stats ──────────────────────────────────────────────────

      const [totalUsers, organizadores, miembros, registeredThisMonth] =
        await Promise.all([
          User.countDocuments(),
          User.countDocuments({ role: 'ORGANIZADOR' }),
          User.countDocuments({ role: 'MIEMBRO' }),
          User.countDocuments({ createdAt: { $gte: startOfThisMonth } })
        ]);

      // ── Timeline (last 12 months) ──────────────────────────────────

      const twelveMonthsAgo = new Date(
        now.getFullYear(),
        now.getMonth() - 11,
        1
      );

      const [timelineCreated, timelineApproved, timelineRejected] =
        await Promise.all([
          Organization.aggregate([
            { $match: { createdAt: { $gte: twelveMonthsAgo } } },
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            }
          ]),

          Organization.aggregate([
            { $unwind: '$statusHistory' },
            {
              $match: {
                'statusHistory.status': 'approved',
                'statusHistory.date': { $gte: twelveMonthsAgo }
              }
            },
            {
              $group: {
                _id: {
                  year: { $year: '$statusHistory.date' },
                  month: { $month: '$statusHistory.date' }
                },
                count: { $sum: 1 }
              }
            }
          ]),

          Organization.aggregate([
            { $unwind: '$statusHistory' },
            {
              $match: {
                'statusHistory.status': 'rejected',
                'statusHistory.date': { $gte: twelveMonthsAgo }
              }
            },
            {
              $group: {
                _id: {
                  year: { $year: '$statusHistory.date' },
                  month: { $month: '$statusHistory.date' }
                },
                count: { $sum: 1 }
              }
            }
          ])
        ]);

      // Build a map keyed by "YYYY-MM" for quick lookups
      const createdMap = {};
      for (const e of timelineCreated) {
        const key = `${e._id.year}-${String(e._id.month).padStart(2, '0')}`;
        createdMap[key] = e.count;
      }
      const approvedMap = {};
      for (const e of timelineApproved) {
        const key = `${e._id.year}-${String(e._id.month).padStart(2, '0')}`;
        approvedMap[key] = e.count;
      }
      const rejectedMap = {};
      for (const e of timelineRejected) {
        const key = `${e._id.year}-${String(e._id.month).padStart(2, '0')}`;
        rejectedMap[key] = e.count;
      }

      // Generate the last 12 months in order
      const timeline = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        timeline.push({
          month: key,
          created: createdMap[key] || 0,
          approved: approvedMap[key] || 0,
          rejected: rejectedMap[key] || 0
        });
      }

      // ── Response ────────────────────────────────────────────────────

      res.json({
        organizations: {
          total: totalOrgs,
          byStatus,
          byType,
          createdThisMonth,
          createdLastMonth,
          approvedThisMonth: approvedThisMonthCount,
          avgProcessingDays
        },
        ministros: {
          total: totalMinistros,
          active: activeMinistros,
          assignmentsPending,
          assignmentsCompleted,
          loadByMinistro
        },
        users: {
          total: totalUsers,
          organizadores,
          miembros,
          registeredThisMonth
        },
        timeline
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Error al obtener estadísticas del dashboard' });
    }
  }
);

/**
 * GET /recent-activity
 * Return the last 20 status changes across all organizations,
 * extracted from each organization's statusHistory array.
 * Requires MUNICIPALIDAD role.
 */
router.get(
  '/recent-activity',
  authenticate,
  requireRole('MUNICIPALIDAD'),
  async (req, res) => {
    try {
      const recentActivity = await Organization.aggregate([
        // Only consider organizations that have statusHistory entries
        { $match: { 'statusHistory.0': { $exists: true } } },

        // Unwind the statusHistory array into individual documents
        { $unwind: '$statusHistory' },

        // Sort by status change date descending
        { $sort: { 'statusHistory.date': -1 } },

        // Take only the 20 most recent
        { $limit: 20 },

        // Project the desired shape
        {
          $project: {
            _id: 0,
            orgId: '$_id',
            orgName: '$organizationName',
            status: '$statusHistory.status',
            comment: '$statusHistory.comment',
            changedBy: '$statusHistory.changedBy',
            date: '$statusHistory.date'
          }
        }
      ]);

      res.json(recentActivity);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      res.status(500).json({ error: 'Error al obtener actividad reciente' });
    }
  }
);

export default router;
