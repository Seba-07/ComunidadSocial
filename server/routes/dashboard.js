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
 * GET /admin-overview
 * KPIs and aggregations for the admin command center.
 * Requires MUNICIPALIDAD role.
 */
router.get(
  '/admin-overview',
  authenticate,
  requireRole('MUNICIPALIDAD'),
  async (req, res) => {
    try {
      const [
        totalApproved,
        totalMembersAgg,
        byTypeAgg,
        byBoardStatusAgg,
        attentionOrgs
      ] = await Promise.all([
        Organization.countDocuments({ status: 'approved' }),

        // Sum all active members across approved orgs
        Organization.aggregate([
          { $match: { status: 'approved' } },
          { $project: { activeCount: { $size: { $filter: { input: { $ifNull: ['$members', []] }, as: 'm', cond: { $ne: ['$$m.status', 'inactive'] } } } } } },
          { $group: { _id: null, total: { $sum: '$activeCount' } } }
        ]),

        // Distribution by organization type (approved only)
        Organization.aggregate([
          { $match: { status: 'approved' } },
          { $group: { _id: '$organizationType', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),

        // Distribution by boardStatus (approved orgs only)
        Organization.aggregate([
          { $match: { status: 'approved' } },
          { $group: { _id: { $ifNull: ['$boardStatus', 'VIGENTE'] }, count: { $sum: 1 } } }
        ]),

        // Orgs needing attention: VENCIDA or PENDIENTE_VALIDACION
        Organization.find(
          { status: 'approved', boardStatus: { $in: ['VENCIDA', 'PENDIENTE_VALIDACION', 'EN_PROCESO_ELECTORAL'] } },
          { organizationName: 1, organizationType: 1, boardStatus: 1, boardExpirationDate: 1 }
        ).sort({ boardExpirationDate: 1 }).limit(20).lean()
      ]);

      const totalMembers = totalMembersAgg[0]?.total || 0;

      const organizationsByType = byTypeAgg
        .filter(t => t._id)
        .map(t => ({ type: t._id, count: t.count }));

      const boardStatusMap = { VIGENTE: 0, VENCIDA: 0, EN_PROCESO_ELECTORAL: 0, PENDIENTE_VALIDACION: 0 };
      for (const entry of byBoardStatusAgg) {
        if (entry._id in boardStatusMap) boardStatusMap[entry._id] = entry.count;
        else if (entry._id === null) boardStatusMap.VIGENTE += entry.count;
      }

      res.json({
        totalOrganizations: totalApproved,
        totalMembers,
        organizationsByType,
        organizationsByBoardStatus: boardStatusMap,
        attentionOrgs: attentionOrgs.map(o => ({
          _id: o._id,
          name: o.organizationName,
          type: o.organizationType,
          boardStatus: o.boardStatus,
          boardExpirationDate: o.boardExpirationDate
        }))
      });
    } catch (error) {
      console.error('Error fetching admin overview:', error);
      res.status(500).json({ error: 'Error al obtener resumen administrativo' });
    }
  }
);

/**
 * GET /advanced-metrics
 * Advanced metrics for the "Centro de Comando" dashboard.
 * Calculates legal alerts, board expirations, upcoming assemblies,
 * org type distribution, recent applications, and minister workload.
 * Requires MUNICIPALIDAD role.
 */
router.get(
  '/advanced-metrics',
  authenticate,
  requireRole('MUNICIPALIDAD'),
  async (req, res) => {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // ── 1. Legal Alerts: Trámites por Vencer ──────────────────────
      // TODO: Implement proper legal deadline calculation based on Ley 19.418
      // Art. 7: El Secretario Municipal tiene 30 días para pronunciarse
      // For now: orgs in pending_review/in_review for more than 20 days
      const legalAlertOrgs = await Organization.find({
        status: { $in: ['pending_review', 'in_review'] }
      }, { organizationName: 1, status: 1, organizationType: 1, createdAt: 1, statusHistory: 1 }).lean();

      const legalAlerts = [];
      for (const org of legalAlertOrgs) {
        // Find when it entered pending_review
        const reviewEntry = org.statusHistory?.slice().reverse()
          .find(h => h.status === 'pending_review' || h.status === 'in_review');
        const enteredReview = reviewEntry?.date ? new Date(reviewEntry.date) : org.createdAt;
        const daysInReview = Math.floor((now - enteredReview) / (1000 * 60 * 60 * 24));
        // Legal deadline is 30 days per Ley 19.418 Art. 7
        const daysRemaining = 30 - daysInReview;
        if (daysRemaining <= 10) { // Alert when 10 or fewer days remaining
          legalAlerts.push({
            _id: org._id,
            name: org.organizationName,
            type: org.organizationType,
            status: org.status,
            daysInReview,
            daysRemaining: Math.max(0, daysRemaining),
            isOverdue: daysRemaining < 0
          });
        }
      }
      legalAlerts.sort((a, b) => a.daysRemaining - b.daysRemaining);

      // ── 2. Directivas Vencidas ────────────────────────────────────
      // TODO: Implement proper board expiration check
      // Ley 19.418 Art. 24: Directorio dura 2 años, elecciones obligatorias
      // For now: approved orgs where approval date > 2 years ago
      const twoYearsAgo = new Date(now);
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const expiredBoardOrgs = await Organization.find({
        status: 'approved',
        'statusHistory': {
          $elemMatch: {
            status: 'approved'
          }
        }
      }, { organizationName: 1, organizationType: 1, statusHistory: 1 }).lean();

      const boardExpirations = [];
      for (const org of expiredBoardOrgs) {
        const approvalEntry = org.statusHistory?.slice().reverse()
          .find(h => h.status === 'approved');
        if (approvalEntry?.date) {
          const approvalDate = new Date(approvalEntry.date);
          const expirationDate = new Date(approvalDate);
          expirationDate.setFullYear(expirationDate.getFullYear() + 2);
          if (expirationDate <= now) {
            const daysExpired = Math.floor((now - expirationDate) / (1000 * 60 * 60 * 24));
            boardExpirations.push({
              _id: org._id,
              name: org.organizationName,
              type: org.organizationType,
              approvalDate: approvalDate.toISOString().split('T')[0],
              expirationDate: expirationDate.toISOString().split('T')[0],
              daysExpired
            });
          }
        }
      }
      boardExpirations.sort((a, b) => b.daysExpired - a.daysExpired);

      // ── 3. Asambleas Próximos 7 días ──────────────────────────────
      const upcomingAssignments = await Assignment.find({
        status: 'pending',
        scheduledDate: { $gte: now, $lte: sevenDaysFromNow }
      }, {
        organizationName: 1, ministroName: 1,
        scheduledDate: 1, scheduledTime: 1, location: 1
      }).sort({ scheduledDate: 1 }).lean();

      const upcomingAssemblies = upcomingAssignments.map(a => ({
        _id: a._id,
        orgName: a.organizationName,
        ministro: a.ministroName,
        date: a.scheduledDate,
        time: a.scheduledTime,
        location: a.location
      }));

      // ── 4. Total Aprobadas Histórico ──────────────────────────────
      const totalApproved = await Organization.countDocuments({ status: 'approved' });
      const approvedThisMonth = await Organization.countDocuments({
        status: 'approved',
        'statusHistory': {
          $elemMatch: {
            status: 'approved',
            date: { $gte: startOfThisMonth }
          }
        }
      });

      // ── 5. Tipos de Organización (distribución) ───────────────────
      const orgTypeAgg = await Organization.aggregate([
        { $group: { _id: '$organizationType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      const orgTypes = orgTypeAgg.map(t => ({
        type: t._id || 'Sin tipo',
        count: t.count
      }));

      // ── 6. Últimas Solicitudes Ingresadas ─────────────────────────
      const recentApplications = await Organization.find(
        {},
        {
          organizationName: 1, organizationType: 1, status: 1, createdAt: 1,
          userId: 1
        }
      ).sort({ createdAt: -1 }).limit(10).lean();

      const recentApps = recentApplications.map(org => {
        const daysInSystem = Math.floor((now - new Date(org.createdAt)) / (1000 * 60 * 60 * 24));
        return {
          _id: org._id,
          name: org.organizationName,
          type: org.organizationType,
          status: org.status,
          createdAt: org.createdAt,
          daysInSystem
        };
      });

      // ── 7. Carga de Ministros este mes ────────────────────────────
      const ministroLoadAgg = await Assignment.aggregate([
        {
          $match: {
            scheduledDate: { $gte: startOfThisMonth, $lte: endOfThisMonth }
          }
        },
        {
          $group: {
            _id: '$ministroId',
            name: { $first: '$ministroName' },
            total: { $sum: 1 },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        },
        { $sort: { total: -1 } }
      ]);

      const ministroLoad = ministroLoadAgg.map(m => ({
        name: m.name,
        total: m.total,
        pending: m.pending,
        completed: m.completed
      }));

      // ── 8. Resolution Time (avg days to approval) ─────────────
      const approvedOrgsForRes = await Organization.find(
        { status: 'approved' },
        { createdAt: 1, statusHistory: 1 }
      ).lean();

      let resolutionTime = { avgDays: 0, count: 0, min: null, max: null };
      if (approvedOrgsForRes.length > 0) {
        let totalDays = 0;
        let count = 0;
        let minDays = Infinity;
        let maxDays = 0;
        for (const org of approvedOrgsForRes) {
          const approvalEntry = org.statusHistory?.slice().reverse()
            .find(h => h.status === 'approved');
          if (approvalEntry?.date && org.createdAt) {
            const diffDays = Math.round((new Date(approvalEntry.date) - new Date(org.createdAt)) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0) {
              totalDays += diffDays;
              count++;
              if (diffDays < minDays) minDays = diffDays;
              if (diffDays > maxDays) maxDays = diffDays;
            }
          }
        }
        if (count > 0) {
          resolutionTime = {
            avgDays: Math.round((totalDays / count) * 10) / 10,
            count,
            min: minDays === Infinity ? null : minDays,
            max: maxDays || null
          };
        }
      }

      // ── 9. Observation Rate (with observations vs direct approval) ──
      const allProcessedOrgs = await Organization.find(
        { status: { $in: ['approved', 'rejected'] } },
        { statusHistory: 1 }
      ).lean();

      let observationRate = { withObservations: 0, directApproval: 0, total: 0, rate: 0 };
      if (allProcessedOrgs.length > 0) {
        let withObs = 0;
        for (const org of allProcessedOrgs) {
          const hadObservations = org.statusHistory?.some(
            h => h.status === 'rejected' || (h.comment && h.comment.length > 0)
          );
          if (hadObservations) withObs++;
        }
        observationRate = {
          withObservations: withObs,
          directApproval: allProcessedOrgs.length - withObs,
          total: allProcessedOrgs.length,
          rate: Math.round((withObs / allProcessedOrgs.length) * 1000) / 10
        };
      }

      // ── 10. Upcoming Elections/Assemblies (next 15 business days, Art. 10) ──
      let businessDaysCount = 0;
      const fifteenBizDaysFromNow = new Date(now);
      while (businessDaysCount < 15) {
        fifteenBizDaysFromNow.setDate(fifteenBizDaysFromNow.getDate() + 1);
        const dayOfWeek = fifteenBizDaysFromNow.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) businessDaysCount++;
      }

      const upcomingElectionAssignments = await Assignment.find({
        status: 'pending',
        scheduledDate: { $gte: now, $lte: fifteenBizDaysFromNow }
      }, {
        organizationName: 1, ministroName: 1,
        scheduledDate: 1, scheduledTime: 1, location: 1, type: 1
      }).sort({ scheduledDate: 1 }).lean();

      const upcomingElections = upcomingElectionAssignments.map(a => ({
        _id: a._id,
        orgName: a.organizationName,
        ministro: a.ministroName,
        date: a.scheduledDate,
        time: a.scheduledTime,
        location: a.location,
        type: a.type || 'asamblea'
      }));

      // ── 11. Summary KPIs ───────────────────────────────────────────
      const [totalOrgs, totalPending, totalMinistros, activeMinistros] = await Promise.all([
        Organization.countDocuments(),
        Organization.countDocuments({ status: { $in: ['pending_review', 'in_review', 'waiting_ministro'] } }),
        User.countDocuments({ role: 'MINISTRO_FE' }),
        User.countDocuments({ role: 'MINISTRO_FE', active: true })
      ]);

      // ── 12. Status distribution for donut ─────────────────────────
      const byStatusAgg = await Organization.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      const byStatus = {};
      for (const entry of byStatusAgg) {
        if (entry._id) byStatus[entry._id] = entry.count;
      }

      res.json({
        kpis: {
          legalAlertsCount: legalAlerts.length,
          boardExpirationsCount: boardExpirations.length,
          upcomingAssembliesCount: upcomingAssemblies.length,
          totalApproved,
          approvedThisMonth,
          totalOrgs,
          totalPending,
          activeMinistros,
          totalMinistros
        },
        legalAlerts,
        boardExpirations,
        upcomingAssemblies,
        orgTypes,
        byStatus,
        recentApplications: recentApps,
        ministroLoad,
        resolutionTime,
        observationRate,
        upcomingElections
      });
    } catch (error) {
      console.error('Error fetching advanced metrics:', error);
      res.status(500).json({ error: 'Error al obtener métricas avanzadas' });
    }
  }
);

/**
 * GET /export
 * Export organization data as CSV file.
 * Requires MUNICIPALIDAD role.
 */
router.get(
  '/export',
  authenticate,
  requireRole('MUNICIPALIDAD'),
  async (req, res) => {
    try {
      const { Parser } = await import('json2csv');

      const orgs = await Organization.find(
        {},
        {
          organizationName: 1, organizationType: 1, status: 1,
          comuna: 1, address: 1, createdAt: 1,
          statusHistory: 1, provisionalDirectorio: 1,
          members: 1, rut: 1
        }
      ).lean();

      const rows = orgs.map(org => {
        // Find approval date from statusHistory
        const approvalEntry = org.statusHistory?.slice().reverse()
          .find(h => h.status === 'approved');
        const approvalDate = approvalEntry?.date
          ? new Date(approvalEntry.date).toISOString().split('T')[0]
          : '';

        // Count members
        const memberCount = org.members?.length || 0;

        // Get presidente from provisionalDirectorio
        const presidente = org.provisionalDirectorio?.president;

        // Days in system
        const daysInSystem = Math.floor(
          (new Date() - new Date(org.createdAt)) / (1000 * 60 * 60 * 24)
        );

        return {
          'Nombre': org.organizationName || '',
          'Tipo': org.organizationType || '',
          'Estado': org.status || '',
          'RUT': org.rut || '',
          'Comuna': org.comuna || '',
          'Dirección': org.address || '',
          'Fecha Ingreso': org.createdAt
            ? new Date(org.createdAt).toISOString().split('T')[0]
            : '',
          'Fecha Aprobación': approvalDate,
          'Días en Sistema': daysInSystem,
          'N° Socios': memberCount,
          'Presidente': presidente
            ? `${presidente.firstName || ''} ${presidente.lastName || ''}`.trim()
            : ''
        };
      });

      const parser = new Parser({
        fields: [
          'Nombre', 'Tipo', 'Estado', 'RUT', 'Comuna', 'Dirección',
          'Fecha Ingreso', 'Fecha Aprobación', 'Días en Sistema',
          'N° Socios', 'Presidente'
        ],
        withBOM: true // UTF-8 BOM for Excel compatibility
      });

      const csv = parser.parse(rows);

      const date = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=reporte_organizaciones_${date}.csv`);
      res.send(csv);
    } catch (error) {
      console.error('Error exporting dashboard data:', error);
      res.status(500).json({ error: 'Error al exportar datos' });
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
