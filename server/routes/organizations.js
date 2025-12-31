import express from 'express';
import Organization from '../models/Organization.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * Genera una contraseña temporal segura
 */
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Crea cuentas de usuario para los miembros de una organización
 */
async function createMemberAccounts(organization) {
  const createdAccounts = [];
  const errors = [];

  if (!organization.members || organization.members.length === 0) {
    return { createdAccounts, errors, message: 'No hay miembros para crear cuentas' };
  }

  for (const member of organization.members) {
    try {
      // Verificar si ya existe un usuario con este RUT o email
      const existingUser = await User.findOne({
        $or: [
          { rut: member.rut },
          { email: member.email }
        ].filter(condition => Object.values(condition).every(v => v)) // Solo buscar si tiene valor
      });

      if (existingUser) {
        // Si ya existe, simplemente lo asociamos a la organización si es MIEMBRO
        if (existingUser.role === 'MIEMBRO') {
          existingUser.organizationId = organization._id;
          await existingUser.save();
          createdAccounts.push({
            rut: member.rut,
            email: existingUser.email,
            status: 'already_exists',
            message: 'Usuario ya existente, asociado a la organización'
          });
        } else {
          createdAccounts.push({
            rut: member.rut,
            email: existingUser.email,
            status: 'skipped',
            message: `Usuario ya existe con rol ${existingUser.role}`
          });
        }
        continue;
      }

      // Crear nuevo usuario MIEMBRO
      const tempPassword = generateTempPassword();
      const newUser = new User({
        rut: member.rut,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email || `${member.rut.replace(/\./g, '').replace(/-/g, '')}@miembro.comunidadsocial.cl`,
        password: tempPassword,
        phone: member.phone,
        address: member.address,
        role: 'MIEMBRO',
        organizationId: organization._id,
        mustChangePassword: true,
        active: true
      });

      await newUser.save();

      createdAccounts.push({
        rut: member.rut,
        firstName: member.firstName,
        lastName: member.lastName,
        email: newUser.email,
        tempPassword: tempPassword,
        status: 'created'
      });

    } catch (error) {
      errors.push({
        rut: member.rut,
        error: error.message
      });
    }
  }

  return { createdAccounts, errors };
}

// PUBLIC: Get booked time slots (for calendar availability)
// Returns only date/time pairs without sensitive organization data
router.get('/availability/booked-slots', async (req, res) => {
  try {
    // Get organizations with scheduled dates (not cancelled/rejected)
    const organizations = await Organization.find({
      status: { $nin: ['REJECTED', 'CANCELLED'] },
      $or: [
        { electionDate: { $exists: true, $ne: null } },
        { 'ministroData.scheduledDate': { $exists: true, $ne: null } }
      ]
    }).select('electionDate electionTime ministroData.scheduledDate ministroData.scheduledTime');

    // Extract only date/time pairs
    const bookedSlots = organizations
      .map(org => {
        const date = org.electionDate || org.ministroData?.scheduledDate;
        const time = org.electionTime || org.ministroData?.scheduledTime;
        if (!date || !time) return null;

        // Format date to YYYY-MM-DD
        const d = new Date(date);
        const dateKey = d.toISOString().split('T')[0];

        return { date: dateKey, time };
      })
      .filter(Boolean);

    console.log('📅 [API] Booked slots:', bookedSlots.length);
    res.json(bookedSlots);
  } catch (error) {
    console.error('Get booked slots error:', error);
    res.status(500).json({ error: 'Error al obtener horarios ocupados' });
  }
});

// Get all organizations (Admin only)
router.get('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
    if (organization.userId._id.toString() !== req.userId.toString() && req.user.role !== 'MUNICIPALIDAD') {
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

    // Extraer solo los campos válidos del modelo (excluir campos extras como certificatesStep5)
    const {
      organizationName,
      organizationType,
      address,
      comuna,
      region,
      unidadVecinal,
      territory,
      contactEmail,
      contactPhone,
      members,
      electoralCommission,
      provisionalDirectorio,
      electionDate,
      electionTime,
      assemblyAddress,
      comments,
      estatutos
    } = req.body;

    const orgData = {
      organizationName,
      organizationType,
      address,
      comuna,
      region,
      unidadVecinal,
      territory,
      contactEmail,
      contactPhone,
      members,
      electionDate,
      electionTime,
      assemblyAddress,
      comments,
      estatutos,
      userId: req.userId,
      status: 'waiting_ministro',
      statusHistory: [{
        status: 'waiting_ministro',
        date: new Date(),
        comment: `Solicitud de Ministro de Fe para fecha: ${electionDate}`
      }]
    };

    // Asegurar que provisionalDirectorio se guarde explícitamente
    if (req.body.provisionalDirectorio) {
      // Helper para limpiar datos de miembro (remover certificados base64)
      const cleanMember = (member) => {
        if (!member) return null;
        const { certificado, certificate, ...cleanData } = member;
        return cleanData;
      };

      orgData.provisionalDirectorio = {
        president: cleanMember(req.body.provisionalDirectorio.president),
        secretary: cleanMember(req.body.provisionalDirectorio.secretary),
        treasurer: cleanMember(req.body.provisionalDirectorio.treasurer),
        // Incluir miembros adicionales (vicepresidente, directores, etc.)
        additionalMembers: (req.body.provisionalDirectorio.additionalMembers || []).map(cleanMember),
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
    console.log('✅ CREATE ORG - ID:', organization._id);
    console.log('✅ CREATE ORG - Status:', organization.status);

    // Devolver respuesta simplificada para evitar problemas de serialización
    const response = {
      _id: organization._id,
      organizationName: organization.organizationName,
      organizationType: organization.organizationType,
      status: organization.status,
      electionDate: organization.electionDate,
      electionTime: organization.electionTime,
      createdAt: organization.createdAt
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('❌ Create organization error:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);

    // Devolver mensaje de error más descriptivo
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      console.error('❌ Validation errors:', messages);
      return res.status(400).json({ error: 'Validación fallida: ' + messages.join(', ') });
    }

    // Para otros errores, devolver más detalles
    res.status(500).json({
      error: error.message || 'Error al crear organización',
      details: error.name
    });
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
    if (organization.userId.toString() !== req.userId.toString() && req.user.role !== 'MUNICIPALIDAD') {
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
router.post('/:id/schedule-ministro', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
router.post('/:id/approve-ministro', authenticate, requireRole('MINISTRO_FE', 'MUNICIPALIDAD'), async (req, res) => {
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
router.post('/:id/status', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
router.post('/:id/reject', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
router.get('/status/:status', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
router.get('/:id/debug', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
router.post('/:id/migrate-directorio', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
router.post('/:id/migrate-comision', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
router.post('/:id/set-comision', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
router.post('/:id/set-directorio', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
router.post('/migrate-all', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
router.get('/stats/counts', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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

// ==================== GESTIÓN DE MIEMBROS ====================

// Crear cuentas de usuario para los miembros de una organización (Municipalidad)
router.post('/:id/create-member-accounts', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    if (organization.memberAccountsCreated) {
      return res.status(400).json({
        error: 'Las cuentas de miembros ya fueron creadas',
        createdAt: organization.memberAccountsCreatedAt
      });
    }

    // Solo permitir crear cuentas si la organización está aprobada
    const allowedStatuses = ['approved', 'sent_registry'];
    if (!allowedStatuses.includes(organization.status)) {
      return res.status(400).json({
        error: 'Solo se pueden crear cuentas para organizaciones aprobadas',
        currentStatus: organization.status
      });
    }

    const result = await createMemberAccounts(organization);

    // Marcar como creadas
    organization.memberAccountsCreated = true;
    organization.memberAccountsCreatedAt = new Date();
    await organization.save();

    // Notificar al organizador
    await Notification.create({
      userId: organization.userId,
      type: 'member_accounts_created',
      title: 'Cuentas de miembros creadas',
      message: `Se han creado ${result.createdAccounts.filter(a => a.status === 'created').length} cuentas para los miembros de tu organización.`,
      organizationId: organization._id,
      data: { summary: result }
    });

    res.json({
      message: 'Cuentas de miembros creadas exitosamente',
      ...result
    });
  } catch (error) {
    console.error('Create member accounts error:', error);
    res.status(500).json({ error: 'Error al crear cuentas de miembros' });
  }
});

// Obtener miembros con sus cuentas de usuario (Municipalidad)
router.get('/:id/members-with-accounts', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Obtener usuarios MIEMBRO asociados a esta organización
    const memberUsers = await User.find({
      role: 'MIEMBRO',
      organizationId: organization._id
    }).select('-password');

    // Combinar con datos de members
    const membersWithAccounts = organization.members.map(member => {
      const userAccount = memberUsers.find(u => u.rut === member.rut);
      return {
        ...member.toObject(),
        hasAccount: !!userAccount,
        accountEmail: userAccount?.email,
        accountActive: userAccount?.active,
        accountId: userAccount?._id
      };
    });

    res.json({
      organization: {
        _id: organization._id,
        name: organization.organizationName,
        memberAccountsCreated: organization.memberAccountsCreated,
        memberAccountsCreatedAt: organization.memberAccountsCreatedAt
      },
      members: membersWithAccounts,
      totalMembers: organization.members.length,
      totalWithAccounts: memberUsers.length
    });
  } catch (error) {
    console.error('Get members with accounts error:', error);
    res.status(500).json({ error: 'Error al obtener miembros' });
  }
});

// ==================== GESTIÓN DE ORGANIZACIONES ACTIVAS ====================

// Obtener la organización a la que pertenece un miembro
router.get('/my-organization', authenticate, async (req, res) => {
  try {
    // Solo para usuarios MIEMBRO
    if (req.user.role !== 'MIEMBRO') {
      return res.status(403).json({ error: 'Esta ruta es solo para miembros' });
    }

    if (!req.user.organizationId) {
      return res.status(404).json({ error: 'No estás asociado a ninguna organización' });
    }

    const organization = await Organization.findById(req.user.organizationId)
      .select('-corrections -validationData -ministroSignature');

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    res.json(organization);
  } catch (error) {
    console.error('Get my organization error:', error);
    res.status(500).json({ error: 'Error al obtener organización' });
  }
});

export default router;
