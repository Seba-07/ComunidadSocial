import express from 'express';
import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * Build a MongoDB filter object from query parameters.
 * Shared between GET / and GET /export.
 */
function buildFilter(query) {
  const { action, resource, userId, startDate, endDate, search } = query;
  const filter = {};

  if (action) {
    filter.action = action;
  }

  if (resource) {
    filter.resource = resource;
  }

  if (userId) {
    if (mongoose.Types.ObjectId.isValid(userId)) {
      filter.userId = new mongoose.Types.ObjectId(userId);
    }
  }

  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) {
      filter.timestamp.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.timestamp.$lte = new Date(endDate);
    }
  }

  if (search) {
    const searchRegex = { $regex: search, $options: 'i' };
    filter.$or = [
      { resourceName: searchRegex },
      { userName: searchRegex }
    ];
  }

  return filter;
}

// GET / - List audit logs with pagination and filters
router.get('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const filter = buildFilter(req.query);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      logs,
      total,
      page,
      totalPages
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Error al obtener registros de auditoría' });
  }
});

// GET /stats - Aggregated audit statistics
router.get('/stats', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [actionsPerDay, topUsers, actionsByType, actionsByResource] = await Promise.all([
      // Actions per day (last 30 days)
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', count: 1, _id: 0 } }
      ]),

      // Top users by activity (last 30 days, top 10)
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: '$userId',
            userName: { $first: '$userName' },
            userRole: { $first: '$userRole' },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { userId: '$_id', userName: 1, userRole: 1, count: 1, _id: 0 } }
      ]),

      // Actions by type (last 30 days)
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $project: { action: '$_id', count: 1, _id: 0 } }
      ]),

      // Actions by resource (last 30 days)
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: '$resource',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $project: { resource: '$_id', count: 1, _id: 0 } }
      ])
    ]);

    res.json({
      actionsPerDay,
      topUsers,
      actionsByType,
      actionsByResource
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de auditoría' });
  }
});

// GET /export - Export all matching logs (no pagination) for CSV export
router.get('/export', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const filter = buildFilter(req.query);

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .lean();

    res.json({ logs, total: logs.length });
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({ error: 'Error al exportar registros de auditoría' });
  }
});

export default router;
