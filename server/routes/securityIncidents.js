import express from 'express';
import SecurityIncident from '../models/SecurityIncident.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// List all incidents (Admin only)
router.get('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const incidents = await SecurityIncident.find()
      .sort({ createdAt: -1 })
      .lean();
    res.json(incidents);
  } catch (error) {
    console.error('List incidents error:', error);
    res.status(500).json({ error: 'Error al obtener incidentes' });
  }
});

// Report a new security incident (Admin only)
router.post('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const {
      type, severity, title, description,
      dataAffected, usersAffectedCount, measuresTaken
    } = req.body;

    if (!type || !severity || !title || !description) {
      return res.status(400).json({ error: 'Campos obligatorios: type, severity, title, description' });
    }

    const incident = await SecurityIncident.create({
      reportedBy: req.userId,
      reportedByName: `${req.user.firstName} ${req.user.lastName}`,
      type,
      severity,
      title: title.trim(),
      description: description.trim(),
      dataAffected: dataAffected || [],
      usersAffectedCount: usersAffectedCount || 0,
      measuresTaken: measuresTaken || '',
      ipAddress: req.ip
    });

    // Audit log
    await AuditLog.logAction({
      userId: req.userId,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userRole: req.user.role,
      action: 'CREATE',
      resource: 'SYSTEM',
      resourceId: incident._id,
      resourceName: title,
      details: { type: 'security_incident_report', severity, incidentType: type },
      ipAddress: req.ip
    });

    res.status(201).json({ message: 'Incidente reportado', incident });
  } catch (error) {
    console.error('Report incident error:', error);
    res.status(500).json({ error: 'Error al reportar incidente' });
  }
});

// Update incident status (Admin only)
router.put('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const incident = await SecurityIncident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incidente no encontrado' });
    }

    const allowedFields = [
      'status', 'measuresTaken', 'notifiedAgency',
      'notifiedAgencyAt', 'notifiedUsers', 'notifiedUsersAt', 'resolvedAt'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        incident[field] = req.body[field];
      }
    }

    if (req.body.status === 'resolved' && !incident.resolvedAt) {
      incident.resolvedAt = new Date();
    }

    await incident.save();

    await AuditLog.logAction({
      userId: req.userId,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userRole: req.user.role,
      action: 'UPDATE',
      resource: 'SYSTEM',
      resourceId: incident._id,
      resourceName: incident.title,
      details: { type: 'security_incident_update', status: incident.status },
      ipAddress: req.ip
    });

    res.json({ message: 'Incidente actualizado', incident });
  } catch (error) {
    console.error('Update incident error:', error);
    res.status(500).json({ error: 'Error al actualizar incidente' });
  }
});

export default router;
