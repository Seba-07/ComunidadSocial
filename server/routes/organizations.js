import express from 'express';
import Organization from '../models/Organization.js';
import Notification from '../models/Notification.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all organizations (Admin only)
router.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const organizations = await Organization.find()
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 });
    res.json(organizations);
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: 'Error al obtener organizaciones' });
  }
});

// Get user's organizations
router.get('/my', authenticate, async (req, res) => {
  try {
    const organizations = await Organization.find({ userId: req.userId })
      .sort({ createdAt: -1 });
    res.json(organizations);
  } catch (error) {
    console.error('Get my organizations error:', error);
    res.status(500).json({ error: 'Error al obtener organizaciones' });
  }
});

// Get organization by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id)
      .populate('userId', 'firstName lastName email');

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Check permission: owner or admin
    if (organization.userId._id.toString() !== req.userId.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No tienes permisos para ver esta organización' });
    }

    res.json(organization);
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ error: 'Error al obtener organización' });
  }
});

// Create organization (request ministro)
router.post('/', authenticate, async (req, res) => {
  try {
    const orgData = {
      ...req.body,
      userId: req.userId,
      status: 'waiting_ministro',
      statusHistory: [{
        status: 'waiting_ministro',
        date: new Date(),
        comment: `Solicitud de Ministro de Fe para fecha: ${req.body.electionDate}`
      }]
    };

    const organization = new Organization(orgData);
    await organization.save();

    res.status(201).json(organization);
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ error: 'Error al crear organización' });
  }
});

// Update organization
router.put('/:id', authenticate, async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Check permission
    if (organization.userId.toString() !== req.userId.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No tienes permisos para editar esta organización' });
    }

    Object.assign(organization, req.body);
    await organization.save();

    res.json(organization);
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ error: 'Error al actualizar organización' });
  }
});

// Schedule ministro (Admin only)
router.post('/:id/schedule-ministro', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    const { ministroId, ministroName, ministroRut, scheduledDate, scheduledTime, location } = req.body;

    // Check if had previous data for notification
    const hadPreviousSchedule = organization.ministroData && organization.ministroData.scheduledDate;
    const oldData = hadPreviousSchedule ? { ...organization.ministroData } : null;

    // Update ministro data
    organization.ministroData = {
      ministroId,
      name: ministroName,
      rut: ministroRut,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      location,
      assignedAt: organization.ministroData?.assignedAt || new Date()
    };

    organization.status = 'ministro_scheduled';
    organization.statusHistory.push({
      status: 'ministro_scheduled',
      date: new Date(),
      comment: `Ministro de Fe agendado: ${ministroName} para ${scheduledDate} a las ${scheduledTime}`
    });

    // Track changes
    if (hadPreviousSchedule) {
      if (!organization.appointmentChanges) organization.appointmentChanges = [];
      organization.appointmentChanges.push({
        changedAt: new Date(),
        previousData: oldData,
        newData: organization.ministroData
      });
      organization.appointmentWasModified = true;
      organization.lastModificationDate = new Date();
    } else {
      organization.originalAppointment = { ...organization.ministroData };
    }

    await organization.save();

    // Create notification
    const notificationType = hadPreviousSchedule ? 'schedule_change' : 'ministro_assigned';
    await Notification.create({
      userId: organization.userId,
      type: notificationType,
      title: hadPreviousSchedule ? 'Cita reagendada' : 'Ministro de Fe asignado',
      message: hadPreviousSchedule
        ? `Tu cita ha sido reagendada para el ${scheduledDate} a las ${scheduledTime}`
        : `Se ha asignado un Ministro de Fe: ${ministroName} para el ${scheduledDate} a las ${scheduledTime}`,
      organizationId: organization._id,
      data: { ministroData: organization.ministroData }
    });

    res.json(organization);
  } catch (error) {
    console.error('Schedule ministro error:', error);
    res.status(500).json({ error: 'Error al agendar Ministro de Fe' });
  }
});

// Approve by ministro
router.post('/:id/approve-ministro', authenticate, requireRole('MINISTRO', 'ADMIN'), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    const { provisionalDirectorio, ministroSignature } = req.body;

    organization.status = 'ministro_approved';
    organization.provisionalDirectorio = {
      ...provisionalDirectorio,
      designatedAt: new Date(),
      type: 'PROVISIONAL',
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days
    };
    organization.ministroSignature = ministroSignature;

    organization.statusHistory.push({
      status: 'ministro_approved',
      date: new Date(),
      comment: 'Aprobado por Ministro de Fe. Directorio Provisorio designado.'
    });

    await organization.save();

    // Notify user
    await Notification.create({
      userId: organization.userId,
      type: 'organization_approved',
      title: 'Asamblea aprobada por Ministro de Fe',
      message: 'Tu asamblea constitutiva ha sido aprobada. Ya puedes continuar con el proceso.',
      organizationId: organization._id
    });

    res.json(organization);
  } catch (error) {
    console.error('Approve ministro error:', error);
    res.status(500).json({ error: 'Error al aprobar' });
  }
});

// Update status (Admin only)
router.post('/:id/status', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    const { status, comment } = req.body;

    organization.status = status;
    organization.statusHistory.push({
      status,
      date: new Date(),
      comment: comment || `Estado actualizado a: ${status}`
    });

    await organization.save();

    // Notify user
    await Notification.create({
      userId: organization.userId,
      type: 'status_change',
      title: 'Estado actualizado',
      message: `El estado de tu organización ha cambiado a: ${status}`,
      organizationId: organization._id
    });

    res.json(organization);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// Reject with corrections (Admin only)
router.post('/:id/reject', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    const { corrections, generalComment } = req.body;

    organization.status = 'rejected';
    organization.corrections = {
      fields: corrections.fields || {},
      documents: corrections.documents || {},
      certificates: corrections.certificates || {},
      generalComment,
      createdAt: new Date(),
      resolved: false
    };

    organization.statusHistory.push({
      status: 'rejected',
      date: new Date(),
      comment: generalComment || 'Solicitud requiere correcciones',
      corrections: organization.corrections
    });

    await organization.save();

    // Notify user
    await Notification.create({
      userId: organization.userId,
      type: 'correction_required',
      title: 'Correcciones requeridas',
      message: 'Tu solicitud requiere correcciones. Revisa los detalles.',
      organizationId: organization._id,
      data: { corrections: organization.corrections }
    });

    res.json(organization);
  } catch (error) {
    console.error('Reject organization error:', error);
    res.status(500).json({ error: 'Error al rechazar' });
  }
});

// Resubmit after corrections
router.post('/:id/resubmit', authenticate, async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    if (organization.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    if (organization.status !== 'rejected') {
      return res.status(400).json({ error: 'Solo se pueden reenviar solicitudes rechazadas' });
    }

    const { userComment, fieldResponses } = req.body;

    organization.status = 'pending_review';
    if (organization.corrections) {
      organization.corrections.resolved = true;
      organization.corrections.resolvedAt = new Date();
      organization.corrections.userResponse = userComment;
      organization.corrections.userFieldResponses = fieldResponses;
    }

    organization.statusHistory.push({
      status: 'pending_review',
      date: new Date(),
      comment: 'Solicitud reenviada con correcciones',
      userComment
    });

    await organization.save();

    res.json(organization);
  } catch (error) {
    console.error('Resubmit organization error:', error);
    res.status(500).json({ error: 'Error al reenviar' });
  }
});

// Get by status (Admin)
router.get('/status/:status', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const organizations = await Organization.find({ status: req.params.status })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 });
    res.json(organizations);
  } catch (error) {
    console.error('Get by status error:', error);
    res.status(500).json({ error: 'Error al obtener organizaciones' });
  }
});

// Diagnóstico de organización (Admin) - ver todos los datos incluyendo provisionalDirectorio
router.get('/:id/debug', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Devolver datos relevantes para diagnóstico
    res.json({
      _id: org._id,
      organizationName: org.organizationName,
      status: org.status,
      provisionalDirectorio: org.provisionalDirectorio,
      members: org.members?.map(m => ({
        _id: m._id,
        firstName: m.firstName,
        lastName: m.lastName,
        rut: m.rut,
        role: m.role
      })),
      electoralCommission: org.electoralCommission
    });
  } catch (error) {
    console.error('Debug org error:', error);
    res.status(500).json({ error: 'Error al obtener diagnóstico' });
  }
});

// Migrar provisionalDirectorio desde members (Admin)
router.post('/:id/migrate-directorio', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Buscar miembros por rol
    const president = org.members?.find(m => m.role === 'president');
    const secretary = org.members?.find(m => m.role === 'secretary');
    const treasurer = org.members?.find(m => m.role === 'treasurer');

    if (!president && !secretary && !treasurer) {
      return res.status(400).json({
        error: 'No se encontraron miembros con roles de directorio',
        members: org.members?.map(m => ({ name: `${m.firstName} ${m.lastName}`, role: m.role }))
      });
    }

    // Construir provisionalDirectorio desde members
    org.provisionalDirectorio = {
      president: president ? {
        rut: president.rut,
        firstName: president.firstName,
        lastName: president.lastName
      } : null,
      secretary: secretary ? {
        rut: secretary.rut,
        firstName: secretary.firstName,
        lastName: secretary.lastName
      } : null,
      treasurer: treasurer ? {
        rut: treasurer.rut,
        firstName: treasurer.firstName,
        lastName: treasurer.lastName
      } : null,
      designatedAt: new Date(),
      type: 'PROVISIONAL'
    };

    await org.save();

    res.json({
      message: 'Directorio migrado exitosamente',
      provisionalDirectorio: org.provisionalDirectorio
    });
  } catch (error) {
    console.error('Migrate directorio error:', error);
    res.status(500).json({ error: 'Error al migrar directorio' });
  }
});

// Actualizar provisionalDirectorio manualmente (Admin) - por si los roles están mal
router.post('/:id/set-directorio', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    const { presidentRut, secretaryRut, treasurerRut } = req.body;

    // Buscar miembros por RUT
    const findByRut = (rut) => {
      if (!rut) return null;
      const normalized = rut.replace(/\./g, '').replace(/-/g, '').toLowerCase();
      return org.members?.find(m => {
        const memberRut = m.rut?.replace(/\./g, '').replace(/-/g, '').toLowerCase();
        return memberRut === normalized;
      });
    };

    const president = findByRut(presidentRut);
    const secretary = findByRut(secretaryRut);
    const treasurer = findByRut(treasurerRut);

    // Construir provisionalDirectorio
    org.provisionalDirectorio = {
      president: president ? {
        rut: president.rut,
        firstName: president.firstName,
        lastName: president.lastName
      } : null,
      secretary: secretary ? {
        rut: secretary.rut,
        firstName: secretary.firstName,
        lastName: secretary.lastName
      } : null,
      treasurer: treasurer ? {
        rut: treasurer.rut,
        firstName: treasurer.firstName,
        lastName: treasurer.lastName
      } : null,
      designatedAt: new Date(),
      type: 'PROVISIONAL'
    };

    // También actualizar los roles de los miembros
    if (president) president.role = 'president';
    if (secretary) secretary.role = 'secretary';
    if (treasurer) treasurer.role = 'treasurer';

    await org.save();

    res.json({
      message: 'Directorio actualizado exitosamente',
      provisionalDirectorio: org.provisionalDirectorio
    });
  } catch (error) {
    console.error('Set directorio error:', error);
    res.status(500).json({ error: 'Error al actualizar directorio' });
  }
});

// Get statistics (Admin)
router.get('/stats/counts', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const stats = await Organization.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const counts = {};
    stats.forEach(s => { counts[s._id] = s.count; });

    res.json(counts);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

export default router;
