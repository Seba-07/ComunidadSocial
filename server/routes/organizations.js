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
    // DEBUG: Log incoming data
    console.log('📥 CREATE ORG - provisionalDirectorio recibido:', JSON.stringify(req.body.provisionalDirectorio, null, 2));
    console.log('📥 CREATE ORG - electoralCommission recibido:', JSON.stringify(req.body.electoralCommission, null, 2));
    console.log('📥 CREATE ORG - members count:', req.body.members?.length);

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

    // Asegurar que provisionalDirectorio se guarde explícitamente
    if (req.body.provisionalDirectorio) {
      orgData.provisionalDirectorio = {
        president: req.body.provisionalDirectorio.president || null,
        secretary: req.body.provisionalDirectorio.secretary || null,
        treasurer: req.body.provisionalDirectorio.treasurer || null,
        designatedAt: new Date(),
        type: 'PROVISIONAL'
      };
      console.log('📤 CREATE ORG - provisionalDirectorio a guardar:', JSON.stringify(orgData.provisionalDirectorio, null, 2));
    }

    // Asegurar que electoralCommission se guarde explícitamente
    if (req.body.electoralCommission && req.body.electoralCommission.length > 0) {
      orgData.electoralCommission = req.body.electoralCommission.map(m => ({
        rut: m.rut,
        firstName: m.firstName || '',
        lastName: m.lastName || '',
        role: 'electoral_commission'
      }));
      console.log('📤 CREATE ORG - electoralCommission a guardar:', JSON.stringify(orgData.electoralCommission, null, 2));
    }

    // Asegurar que estatutos se guarde explícitamente
    if (req.body.estatutos) {
      orgData.estatutos = req.body.estatutos;
      console.log('📤 CREATE ORG - estatutos a guardar (primeros 100 chars):', orgData.estatutos.substring(0, 100));
    }

    const organization = new Organization(orgData);
    await organization.save();

    // DEBUG: Verificar que se guardó
    console.log('✅ CREATE ORG - provisionalDirectorio guardado:', JSON.stringify(organization.provisionalDirectorio, null, 2));
    console.log('✅ CREATE ORG - electoralCommission guardado:', JSON.stringify(organization.electoralCommission, null, 2));

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

// Migrar electoralCommission desde members (Admin)
router.post('/:id/migrate-comision', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Buscar miembros con rol electoral_commission
    const commissionMembers = org.members?.filter(m => m.role === 'electoral_commission') || [];

    if (commissionMembers.length === 0) {
      return res.status(400).json({
        error: 'No se encontraron miembros con rol electoral_commission',
        members: org.members?.map(m => ({ name: `${m.firstName} ${m.lastName}`, role: m.role }))
      });
    }

    // Construir electoralCommission desde members
    org.electoralCommission = commissionMembers.map(m => ({
      rut: m.rut,
      firstName: m.firstName,
      lastName: m.lastName,
      role: 'electoral_commission'
    }));

    await org.save();

    res.json({
      message: 'Comisión Electoral migrada exitosamente',
      electoralCommission: org.electoralCommission
    });
  } catch (error) {
    console.error('Migrate comision error:', error);
    res.status(500).json({ error: 'Error al migrar comisión' });
  }
});

// Establecer electoralCommission manualmente por RUTs (Admin)
router.post('/:id/set-comision', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    const { member1Rut, member2Rut, member3Rut } = req.body;
    const ruts = [member1Rut, member2Rut, member3Rut].filter(Boolean);

    // Buscar miembros por RUT
    const findByRut = (rut) => {
      if (!rut) return null;
      const normalized = rut.replace(/\./g, '').replace(/-/g, '').toLowerCase();
      return org.members?.find(m => {
        const memberRut = m.rut?.replace(/\./g, '').replace(/-/g, '').toLowerCase();
        return memberRut === normalized;
      });
    };

    const commissionMembers = ruts.map(rut => findByRut(rut)).filter(Boolean);

    if (commissionMembers.length === 0) {
      return res.status(400).json({
        error: 'No se encontraron miembros con los RUTs proporcionados',
        members: org.members?.map(m => ({ name: `${m.firstName} ${m.lastName}`, rut: m.rut }))
      });
    }

    // Construir electoralCommission
    org.electoralCommission = commissionMembers.map(m => ({
      rut: m.rut,
      firstName: m.firstName,
      lastName: m.lastName,
      role: 'electoral_commission'
    }));

    // Actualizar roles de los miembros
    commissionMembers.forEach(m => {
      m.role = 'electoral_commission';
    });

    await org.save();

    res.json({
      message: 'Comisión Electoral actualizada exitosamente',
      electoralCommission: org.electoralCommission
    });
  } catch (error) {
    console.error('Set comision error:', error);
    res.status(500).json({ error: 'Error al actualizar comisión' });
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

// Migrar TODAS las organizaciones - construir provisionalDirectorio y electoralCommission desde members
router.post('/migrate-all', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const organizations = await Organization.find({});
    const results = [];

    for (const org of organizations) {
      let updated = false;
      const changes = {};

      // Migrar provisionalDirectorio si está vacío
      if (!org.provisionalDirectorio?.president && !org.provisionalDirectorio?.secretary && !org.provisionalDirectorio?.treasurer) {
        const president = org.members?.find(m => m.role === 'president');
        const secretary = org.members?.find(m => m.role === 'secretary');
        const treasurer = org.members?.find(m => m.role === 'treasurer');

        if (president || secretary || treasurer) {
          org.provisionalDirectorio = {
            president: president ? { rut: president.rut, firstName: president.firstName, lastName: president.lastName } : null,
            secretary: secretary ? { rut: secretary.rut, firstName: secretary.firstName, lastName: secretary.lastName } : null,
            treasurer: treasurer ? { rut: treasurer.rut, firstName: treasurer.firstName, lastName: treasurer.lastName } : null,
            designatedAt: new Date(),
            type: 'PROVISIONAL'
          };
          updated = true;
          changes.provisionalDirectorio = 'migrado';
        }
      }

      // Migrar electoralCommission si está vacío
      if (!org.electoralCommission || org.electoralCommission.length === 0) {
        // Buscar miembros con rol electoral_commission
        let commissionMembers = org.members?.filter(m => m.role === 'electoral_commission') || [];

        // Si no hay, usar los miembros que no son directorio (director o member) como candidatos
        if (commissionMembers.length === 0) {
          const usedRuts = new Set();
          if (org.provisionalDirectorio?.president?.rut) usedRuts.add(org.provisionalDirectorio.president.rut);
          if (org.provisionalDirectorio?.secretary?.rut) usedRuts.add(org.provisionalDirectorio.secretary.rut);
          if (org.provisionalDirectorio?.treasurer?.rut) usedRuts.add(org.provisionalDirectorio.treasurer.rut);

          // Buscar en members por rol o excluir directorio
          commissionMembers = org.members?.filter(m =>
            !usedRuts.has(m.rut) &&
            ['director', 'member', 'electoral_commission'].includes(m.role)
          ).slice(0, 3) || [];
        }

        if (commissionMembers.length > 0) {
          org.electoralCommission = commissionMembers.map(m => ({
            rut: m.rut,
            firstName: m.firstName,
            lastName: m.lastName,
            role: 'electoral_commission'
          }));

          // Actualizar roles de los miembros
          commissionMembers.forEach(cm => {
            const member = org.members.find(m => m.rut === cm.rut);
            if (member) member.role = 'electoral_commission';
          });

          updated = true;
          changes.electoralCommission = `migrado (${commissionMembers.length} miembros)`;
        }
      }

      if (updated) {
        await org.save();
        results.push({
          id: org._id,
          name: org.organizationName,
          changes
        });
      }
    }

    res.json({
      message: `Migración completada. ${results.length} organizaciones actualizadas.`,
      updated: results
    });
  } catch (error) {
    console.error('Migrate all error:', error);
    res.status(500).json({ error: 'Error en migración masiva' });
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
