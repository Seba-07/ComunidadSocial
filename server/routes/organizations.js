import express from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Organization from '../models/Organization.js';
import Assignment from '../models/Assignment.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { authenticate, requireRole, requireVerifiedEmail } from '../middleware/auth.js';
import { allowFields, ALLOWED_FIELDS, validateObjectId, qrCheckinLimiter } from '../middleware/security.js';
import { validate, createOrganizationSchema, statusChangeSchema, rejectWithCorrectionsSchema } from '../middleware/validation.js';
import MinistroBlock from '../models/MinistroBlock.js';
import Document from '../models/Document.js';
import Member from '../models/Member.js';
import logger from '../utils/logger.js';
import { emailService } from '../services/emailService.js';
import * as assemblyService from '../services/assemblyService.js';
import Consent from '../models/Consent.js';
import { maskOrganizationPii, maskPiiFields } from '../middleware/dataMasking.js';
import AuditLog from '../models/AuditLog.js';

const router = express.Router();

// Fields to exclude from list queries (heavy base64 data, legacy embedded arrays)
const LIST_EXCLUDE = '-members -electoralCommission -comisionElectoral -certificatesStep5 -assemblies -estatutos -estatutosSnapshot -validationData -ministroSignature -memberIds -documentIds';

/**
 * Normaliza un RUT para comparaciones (sin puntos, guiones, en mayúsculas)
 */
function normalizeRut(rut) {
  return (rut || '').replace(/\./g, '').replace(/-/g, '').toUpperCase();
}

/**
 * Verifica si un usuario MIEMBRO tiene cargo directivo en una organización.
 * Revisa tanto member.role como provisionalDirectorio (fuente de verdad).
 */
function isDirectivoMember(org, user) {
  if (!user || user.role !== 'MIEMBRO' || !user.rut) return false;
  const cleanRut = normalizeRut(user.rut);

  // 1) Revisar member.role directo
  const dirRoles = ['president', 'secretary', 'treasurer', 'director'];
  const hasMemberRole = (org.members || []).some(m => {
    return normalizeRut(m.rut) === cleanRut && dirRoles.includes(m.role);
  });
  if (hasMemberRole) return true;

  // 2) Revisar provisionalDirectorio (fuente de verdad para directorio vigente)
  const prov = org.provisionalDirectorio;
  if (prov) {
    if (prov.president && normalizeRut(prov.president.rut) === cleanRut) return true;
    if (prov.secretary && normalizeRut(prov.secretary.rut) === cleanRut) return true;
    if (prov.treasurer && normalizeRut(prov.treasurer.rut) === cleanRut) return true;
    if (prov.additionalMembers && prov.additionalMembers.some(m => m && normalizeRut(m.rut) === cleanRut)) return true;
  }

  return false;
}

/**
 * Verifica si el quórum de una asamblea se cumple.
 * @returns {{ met: boolean, required: number, actual: number, message: string }}
 */
function checkQuorum(assembly, org) {
  const attendeeCount = assembly.attendees?.length || 0;
  const quorumValue = assembly.quorumValue ?? 50;
  const quorumType = assembly.quorumType || 'percentage';

  if (quorumType === 'percentage') {
    const totalMembers = org.members?.length || 0;
    if (totalMembers === 0) return { met: false, required: 0, actual: 0, message: 'No hay miembros registrados en la organización' };
    if (quorumValue <= 0) return { met: false, required: 1, actual: attendeeCount, totalMembers, message: 'Valor de quórum no configurado (0%). Debe ser mayor a 0%' };
    const required = Math.ceil(totalMembers * (quorumValue / 100));
    return {
      met: attendeeCount >= required, required, actual: attendeeCount, totalMembers,
      message: `Se requieren ${required} asistentes (${quorumValue}% de ${totalMembers}). Presentes: ${attendeeCount}`
    };
  }
  if (quorumValue <= 0) return { met: false, required: 1, actual: attendeeCount, message: 'Valor de quórum no configurado (0). Debe ser mayor a 0' };
  return {
    met: attendeeCount >= quorumValue, required: quorumValue, actual: attendeeCount,
    message: `Se requieren ${quorumValue} asistentes. Presentes: ${attendeeCount}`
  };
}

/**
 * Sincroniza los roles de member[] con el provisionalDirectorio de la org.
 * Establece 'president', 'secretary', 'treasurer', 'director' según corresponda.
 */
function syncMemberRolesFromDirectorio(org) {
  const prov = org.provisionalDirectorio;
  if (!prov || !org.members) return;

  // Primero, resetear roles de directorio previos a 'member'
  const dirRoles = ['president', 'secretary', 'treasurer', 'director'];
  org.members.forEach(m => {
    if (dirRoles.includes(m.role)) m.role = 'member';
  });

  const assignRole = (rut, role) => {
    if (!rut) return;
    const clean = normalizeRut(rut);
    const member = org.members.find(m => normalizeRut(m.rut) === clean);
    if (member) member.role = role;
  };

  if (prov.president) assignRole(prov.president.rut, 'president');
  if (prov.secretary) assignRole(prov.secretary.rut, 'secretary');
  if (prov.treasurer) assignRole(prov.treasurer.rut, 'treasurer');
  if (prov.additionalMembers) {
    prov.additionalMembers.forEach(m => {
      if (m) assignRole(m.rut, 'director');
    });
  }
}

/**
 * Genera una contraseña temporal segura usando crypto
 */
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const randomBytes = crypto.randomBytes(12);
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(randomBytes[i] % chars.length);
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

  // Batch lookup: find all existing users by RUT or email in one query (avoids N+1)
  const ruts = organization.members.map(m => m.rut).filter(Boolean);
  const emails = organization.members.map(m => m.email).filter(Boolean);
  const existingUsers = await User.find({
    $or: [
      { rut: { $in: ruts } },
      { email: { $in: emails } }
    ]
  });
  const userByRut = new Map(existingUsers.map(u => [u.rut, u]));
  const userByEmail = new Map(existingUsers.filter(u => u.email).map(u => [u.email, u]));

  for (const member of organization.members) {
    try {
      const existingUser = userByRut.get(member.rut) || (member.email && userByEmail.get(member.email));

      if (existingUser) {
        // Si ya existe, asociar a la organización si es MIEMBRO (soporta múltiples orgs)
        if (existingUser.role === 'MIEMBRO') {
          if (!existingUser.organizationIds) existingUser.organizationIds = [];
          const orgIdStr = organization._id.toString();
          if (!existingUser.organizationIds.some(id => id.toString() === orgIdStr)) {
            existingUser.organizationIds.push(organization._id);
          }
          if (!existingUser.organizationId) existingUser.organizationId = organization._id;
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

      // Crear nuevo usuario MIEMBRO — password = RUT limpio (sin puntos ni guión)
      const tempPassword = member.rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
      const newUser = new User({
        rut: member.rut,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email || `${member.rut.replace(/\./g, '').replace(/-/g, '')}@miembro.comunidadsocial.cl`,
        password: tempPassword,
        phone: member.phone,
        address: member.address,
        role: 'MIEMBRO',
        organizationIds: [organization._id],
        organizationId: organization._id,
        mustChangePassword: true,
        active: true
      });

      await newUser.save();

      // Create essential consent for new member (Ley 21.719)
      // Note: created on behalf by organizer per Ley 19.418; full consent on first login
      await Consent.create({
        userId: newUser._id,
        purpose: 'essential',
        granted: true,
        grantedAt: new Date(),
        version: '1.0',
        ipAddress: 'system:member-creation'
      }).catch(err => console.error('Consent creation error for member:', err.message));

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

// Get booked time slots (for calendar availability)
// Returns only date/time pairs without sensitive organization data
router.get('/availability/booked-slots', authenticate, async (req, res) => {
  try {
    // Get organizations with scheduled dates (not cancelled/rejected)
    const organizations = await Organization.find({
      status: { $nin: ['REJECTED', 'CANCELLED'] },
      $or: [
        { electionDate: { $exists: true, $ne: null } },
        { 'ministroData.scheduledDate': { $exists: true, $ne: null } }
      ]
    })
      .select('organizationName organizationType status electionDate electionTime ministroData.scheduledDate ministroData.scheduledTime')
      .populate('userId', 'firstName lastName email')
      .lean();

    // Extract date/time pairs with org info
    const bookedSlots = organizations
      .map(org => {
        const date = org.electionDate || org.ministroData?.scheduledDate;
        const time = org.electionTime || org.ministroData?.scheduledTime;
        if (!date || !time) return null;

        const d = new Date(date);
        const dateKey = d.toISOString().split('T')[0];

        // Estado de la reserva según status de la organización
        let bookingStatus = 'pending';
        if (['APPROVED', 'REGISTERED'].includes(org.status)) {
          bookingStatus = 'confirmed';
        }

        const user = org.userId || {};
        return {
          date: dateKey,
          time,
          organizationName: org.organizationName || 'Sin nombre',
          organizationType: org.organizationType || '',
          status: bookingStatus,
          userName: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Sin asignar',
          userEmail: user.email || '',
          orgId: org._id.toString()
        };
      })
      .filter(Boolean);

    // Obtener bloques de ministros activos y expandirlos por hora
    const ministroBlockSlots = [];
    try {
      const blocks = await MinistroBlock.find({ active: true }).lean();
      const hours = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

      for (const block of blocks) {
        if (!block.time) {
          // Día completo: expandir a todas las horas
          for (const h of hours) {
            ministroBlockSlots.push({
              date: block.date,
              time: h,
              ministroId: block.ministroId.toString()
            });
          }
        } else if (block.blockType === 'duration' && block.endTime) {
          // Bloque con duración: expandir rango
          for (const h of hours) {
            if (h >= block.time && h <= block.endTime) {
              ministroBlockSlots.push({
                date: block.date,
                time: h,
                ministroId: block.ministroId.toString()
              });
            }
          }
        } else {
          // Bloque de hora específica
          ministroBlockSlots.push({
            date: block.date,
            time: block.time,
            ministroId: block.ministroId.toString()
          });
        }
      }
    } catch (blockError) {
      logger.warn('Error loading ministro blocks for booked-slots:', blockError.message);
    }

    logger.debug('Booked slots:', bookedSlots.length, 'Block slots:', ministroBlockSlots.length);
    res.json({
      bookedSlots,
      ministroBlockSlots
    });
  } catch (error) {
    console.error('Get booked slots error:', error);
    res.status(500).json({ error: 'Error al obtener horarios ocupados' });
  }
});

// Get all organizations (Admin only)
router.get('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status ? { status: req.query.status } : {};

    const [organizations, total] = await Promise.all([
      Organization.find(statusFilter)
        .select(LIST_EXCLUDE)
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Organization.countDocuments(statusFilter)
    ]);

    // Add memberCount from a lightweight aggregation
    const orgIds = organizations.map(o => o._id);
    const memberCounts = await Organization.aggregate([
      { $match: { _id: { $in: orgIds } } },
      { $project: { memberCount: { $size: { $ifNull: ['$members', []] } } } }
    ]);
    const countMap = Object.fromEntries(memberCounts.map(c => [c._id.toString(), c.memberCount]));
    const orgsWithCount = organizations.map(o => ({ ...o, memberCount: countMap[o._id.toString()] || 0 }));

    res.json({ organizations: orgsWithCount, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: 'Error al obtener organizaciones' });
  }
});

// Get user's organizations
router.get('/my', authenticate, async (req, res) => {
  try {
    const organizations = await Organization.find({ userId: req.userId })
      .select(LIST_EXCLUDE)
      .sort({ createdAt: -1 })
      .lean();
    res.json(organizations);
  } catch (error) {
    console.error('Get my organizations error:', error);
    res.status(500).json({ error: 'Error al obtener organizaciones' });
  }
});

// Obtener la organización a la que pertenece un miembro (DEBE ir antes de /:id)
router.get('/my-organization', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'MIEMBRO') {
      return res.status(403).json({ error: 'Esta ruta es solo para miembros' });
    }

    // Obtener todos los IDs de organizaciones (nuevo array + legacy)
    const orgIds = req.user.getAllOrgIds();

    if (orgIds.length === 0) {
      return res.status(404).json({ error: 'No estás asociado a ninguna organización' });
    }

    const organizations = await Organization.find({ _id: { $in: orgIds } })
      .select('-corrections -validationData -ministroSignature')
      .lean();

    if (organizations.length === 0) {
      return res.status(404).json({ error: 'No se encontraron organizaciones' });
    }

    // Anotar cada org con flags de directivo para el frontend
    const cleanUserRut = normalizeRut(req.user.rut);
    const dirRoles = ['president', 'secretary', 'treasurer', 'director'];
    const enriched = organizations.map(org => {
      const myMember = (org.members || []).find(m => normalizeRut(m.rut) === cleanUserRut);
      const myRole = myMember ? myMember.role : null;

      // Verificar directivo por member.role O por provisionalDirectorio
      let isDirectivo = myMember ? dirRoles.includes(myMember.role) : false;
      if (!isDirectivo) {
        const prov = org.provisionalDirectorio;
        if (prov) {
          if (prov.president && normalizeRut(prov.president.rut) === cleanUserRut) isDirectivo = true;
          else if (prov.secretary && normalizeRut(prov.secretary.rut) === cleanUserRut) isDirectivo = true;
          else if (prov.treasurer && normalizeRut(prov.treasurer.rut) === cleanUserRut) isDirectivo = true;
          else if (prov.additionalMembers && prov.additionalMembers.some(m => m && normalizeRut(m.rut) === cleanUserRut)) isDirectivo = true;
        }
      }

      return {
        ...org,
        _isDirectivo: isDirectivo,
        _myMemberRole: myRole
      };
    });

    // Mask PII for MIEMBRO users (they see their own data unmasked via frontend)
    const masked = enriched.map(org => {
      const m = maskOrganizationPii(org);
      // Voto secreto: no enviar anonymousVotes a MIEMBRO
      if (m.assemblies) {
        for (const asm of m.assemblies) {
          for (const item of (asm.agendaItems || [])) {
            item.anonymousVotesCount = (item.anonymousVotes || []).length;
            delete item.anonymousVotes;
          }
        }
      }
      return m;
    });
    res.json({ organizations: masked });
  } catch (error) {
    console.error('Get my organization error:', error);
    res.status(500).json({ error: 'Error al obtener organización' });
  }
});

// Get organization by ID
router.get('/:id', authenticate, validateObjectId(), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id)
      .populate('userId', 'firstName lastName email')
      .lean();

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Check permission: owner, admin, or member of the org
    const isOwner = organization.userId._id.toString() === req.userId.toString();
    const isAdmin = req.user.role === 'MUNICIPALIDAD';
    const isMember = req.user.role === 'MIEMBRO' && req.user.getAllOrgIds().includes(organization._id.toString());
    if (!isOwner && !isAdmin && !isMember) {
      return res.status(403).json({ error: 'No tienes permisos para ver esta organización' });
    }

    // Mask PII for members (non-admin, non-owner)
    if (!isAdmin && !isOwner) {
      const masked = maskOrganizationPii(organization);
      // Voto secreto: no enviar anonymousVotes a MIEMBRO, solo voterRegistry y conteo
      if (masked.assemblies) {
        for (const asm of masked.assemblies) {
          for (const item of (asm.agendaItems || [])) {
            item.anonymousVotesCount = (item.anonymousVotes || []).length;
            delete item.anonymousVotes;
            // Keep voterRegistry for duplicate vote check
          }
        }
      }
      res.json(masked);
    } else {
      res.json(organization);
    }
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ error: 'Error al obtener organización' });
  }
});

// Create organization (request ministro) - Con validación Zod
router.post('/', authenticate, requireVerifiedEmail, validate(createOrganizationSchema), async (req, res) => {
  try {
    // DEBUG: Log incoming data (solo en desarrollo)
    logger.debug('CREATE ORG - provisionalDirectorio recibido:', JSON.stringify(req.body.provisionalDirectorio, null, 2));
    logger.debug('CREATE ORG - electoralCommission recibido:', JSON.stringify(req.body.electoralCommission, null, 2));
    logger.debug('CREATE ORG - members count:', req.body.members?.length);

    // Extraer campos válidos del modelo
    const {
      organizationName,
      organizationType,
      address,
      street,
      streetNumber,
      postalCode,
      comuna,
      region,
      unidadVecinal,
      territory,
      description,
      objectives,
      contactEmail,
      contactPhone,
      contactPreference,
      members,
      electoralCommission,
      provisionalDirectorio,
      electionDate,
      electionTime,
      assemblyAddress,
      comments,
      estatutos,
      certificatesStep5
    } = req.body;

    const orgData = {
      organizationName,
      organizationType,
      address,
      street,
      streetNumber,
      postalCode,
      comuna,
      region,
      unidadVecinal,
      territory,
      description,
      objectives,
      contactEmail,
      contactPhone,
      contactPreference: contactPreference || 'phone',
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
        comment: electionDate
          ? `Solicitud de Ministro de Fe para fecha: ${electionDate}`
          : 'Solicitud de constitución enviada, pendiente asignación de Ministro de Fe'
      }]
    };

    // Asegurar que provisionalDirectorio se guarde explícitamente
    if (req.body.provisionalDirectorio) {
      const cleanMember = (member) => {
        if (!member) return null;
        const { certificado, certificate, ...cleanData } = member;
        return cleanData;
      };

      const pDir = req.body.provisionalDirectorio;

      // Map from wizard cargo IDs (español) to Organization model fields (English)
      const CARGO_TO_FIELD = {
        'presidente': 'president',
        'secretario': 'secretary',
        'tesorero': 'treasurer',
        'vicepresidente': 'vicePresident'
      };

      // If data comes in new format (keyed by cargo IDs like 'presidente', 'secretario')
      // map to the Organization model fields
      let president = pDir.president || null;
      let secretary = pDir.secretary || null;
      let treasurer = pDir.treasurer || null;
      let vicePresident = pDir.vicePresident || null;
      let additionalMembers = pDir.additionalMembers || [];

      // Check if wizard sent data keyed by Spanish cargo IDs
      if (pDir.presidente && !pDir.president) {
        president = pDir.presidente;
      }
      if (pDir.secretario && !pDir.secretary) {
        secretary = pDir.secretario;
      }
      if (pDir.tesorero && !pDir.treasurer) {
        treasurer = pDir.tesorero;
      }
      if (pDir.vicepresidente && !pDir.vicePresident) {
        vicePresident = pDir.vicepresidente;
      }

      // Collect all other cargo entries as additionalMembers (directors, custom cargos)
      const knownKeys = new Set(['president', 'secretary', 'treasurer', 'vicePresident',
        'presidente', 'secretario', 'tesorero', 'vicepresidente',
        'additionalMembers', 'designatedAt', 'type', 'expiresAt']);
      Object.entries(pDir).forEach(([key, val]) => {
        if (!knownKeys.has(key) && val && typeof val === 'object' && val.rut) {
          additionalMembers.push({ ...val, cargo: key, cargoNombre: val.cargoNombre || key });
        }
      });

      orgData.provisionalDirectorio = {
        president: cleanMember(president),
        secretary: cleanMember(secretary),
        treasurer: cleanMember(treasurer),
        vicePresident: cleanMember(vicePresident),
        additionalMembers: additionalMembers.map(cleanMember),
        designatedAt: new Date(),
        type: 'PROVISIONAL'
      };
      logger.debug('CREATE ORG - provisionalDirectorio a guardar:', JSON.stringify(orgData.provisionalDirectorio, null, 2));
    }

    // Asegurar que electoralCommission se guarde explícitamente
    if (req.body.electoralCommission && req.body.electoralCommission.length > 0) {
      orgData.electoralCommission = req.body.electoralCommission.map(m => ({
        rut: m.rut,
        firstName: m.firstName || '',
        lastName: m.lastName || '',
        role: 'electoral_commission'
      }));
      logger.debug('CREATE ORG - electoralCommission a guardar:', JSON.stringify(orgData.electoralCommission, null, 2));
    }

    // Asegurar que estatutos se guarde explícitamente
    if (req.body.estatutos) {
      orgData.estatutos = req.body.estatutos;
      logger.debug('CREATE ORG - estatutos a guardar (primeros 100 chars):', orgData.estatutos.substring(0, 100));
    }

    // Guardar certificados del Paso 5 (SOLO metadata, sin base64 para evitar límite BSON 16MB)
    // Los archivos base64 se guardan en colección separada CertificateFiles
    if (certificatesStep5) {
      const parseCerts = (certs) => {
        if (Array.isArray(certs) && certs.length > 0) {
          return certs.map(cert => ({
            memberId: cert.memberId || cert.rut || '',
            memberName: cert.memberName || cert.name || '',
            uploadedAt: new Date()
          }));
        } else if (typeof certs === 'object' && Object.keys(certs).length > 0) {
          return Object.entries(certs).map(([key, cert]) => ({
            memberId: key,
            memberName: cert.memberName || cert.name || key,
            uploadedAt: new Date()
          }));
        }
        return [];
      };
      const certsMeta = parseCerts(certificatesStep5);
      if (certsMeta.length > 0) {
        orgData.certificatesStep5 = certsMeta;
        logger.debug('CREATE ORG - certificatesStep5 metadata:', certsMeta.length, 'certificados');
      }
    }

    const organization = new Organization(orgData);

    // Sincronizar roles de miembros con el directorio provisorio
    syncMemberRolesFromDirectorio(organization);

    await organization.save();

    // DEBUG: Verificar que se guardó (solo en desarrollo)
    logger.debug('CREATE ORG - ID:', organization._id);
    logger.debug('CREATE ORG - Status:', organization.status);

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
    logger.error('Create organization error:', error.message);
    logger.debug('Error details:', { name: error.name, stack: error.stack });

    // Devolver mensaje de error más descriptivo
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      logger.debug('Validation errors:', messages);
      return res.status(400).json({ error: 'Validación fallida: ' + messages.join(', ') });
    }

    // Para otros errores, devolver más detalles
    res.status(500).json({
      error: error.message || 'Error al crear organización',
      errorType: error.name
    });
  }
});

// Update organization - Protegido contra mass assignment
router.put('/:id', authenticate, requireVerifiedEmail, validateObjectId(), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Check permission
    const isOwner = organization.userId.toString() === req.userId.toString();
    const isAdmin = req.user.role === 'MUNICIPALIDAD';
    const isDirectivo = isDirectivoMember(organization, req.user);

    if (!isOwner && !isAdmin && !isDirectivo) {
      return res.status(403).json({ error: 'No tienes permisos para editar esta organización' });
    }

    // Filtrar campos según rol - protección contra mass assignment
    const allowedForOrganizer = ALLOWED_FIELDS.organization;
    const allowedForAdmin = [...ALLOWED_FIELDS.organization, ...ALLOWED_FIELDS.organizationAdmin];
    const allowedFields = isAdmin ? allowedForAdmin : allowedForOrganizer;

    // Solo copiar campos permitidos
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        organization[field] = req.body[field];
      }
    }

    // ============ ACTION HANDLERS ============
    // Handle specific actions from req.body

    // Add a new member
    if (req.body.addMember) {
      const newMember = req.body.addMember;
      // Check for duplicate RUT
      if (!organization.members) organization.members = [];
      const exists = organization.members.some(m => m.rut === newMember.rut);
      if (exists) {
        return res.status(400).json({ error: 'Ya existe un miembro con ese RUT' });
      }
      newMember.id = new mongoose.Types.ObjectId().toString();
      organization.members.push(newMember);
    }

    // Update an existing member by RUT
    if (req.body.updateMember) {
      const { rut, ...updates } = req.body.updateMember;
      if (rut && organization.members) {
        const member = organization.members.find(m => m.rut === rut);
        if (member) {
          const allowedUpdates = ['firstName', 'lastName', 'birthDate', 'phone', 'email', 'address', 'role'];
          for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
              member[key] = updates[key];
            }
          }
        }
      }
    }

    // Remove a member by RUT
    if (req.body.removeMemberRut) {
      if (organization.members) {
        organization.members = organization.members.filter(m => m.rut !== req.body.removeMemberRut);
      }
    }

    // Add a finance record
    if (req.body.addFinance) {
      const newFinance = {
        ...req.body.addFinance,
        id: new mongoose.Types.ObjectId().toString()
      };
      if (!organization.finances) organization.finances = [];
      organization.finances.push(newFinance);
    }

    // Remove a finance record by id
    if (req.body.removeFinance) {
      if (organization.finances) {
        organization.finances = organization.finances.filter(f => f.id !== req.body.removeFinance);
      }
    }

    // Add a communication record
    if (req.body.addCommunication) {
      const newComm = {
        ...req.body.addCommunication,
        id: new mongoose.Types.ObjectId().toString()
      };
      if (!organization.communications) organization.communications = [];
      organization.communications.push(newComm);
    }

    // Remove a communication record by id
    if (req.body.removeCommunication) {
      if (organization.communications) {
        organization.communications = organization.communications.filter(c => c.id !== req.body.removeCommunication);
      }
    }

    await organization.save();

    res.json(organization);
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ error: 'Error al actualizar organización' });
  }
});

// Delete organization (Owner only, not approved/dissolved)
// draft: immediate delete
// Others (except approved/dissolved): request deletion (requires admin approval)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Only the owner can delete
    if (organization.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Solo el creador puede eliminar esta solicitud' });
    }

    // Cannot delete approved or dissolved organizations
    if (['approved', 'dissolved'].includes(organization.status)) {
      return res.status(400).json({ error: 'No se puede eliminar una organización aprobada o disuelta' });
    }

    // Cannot request deletion if already requested
    if (organization.status === 'deletion_requested') {
      return res.status(400).json({ error: 'Ya existe una solicitud de eliminación pendiente' });
    }

    // Immediate delete only for draft (no solicitud enviada yet)
    const immediateDeleteStatuses = ['draft'];
    if (immediateDeleteStatuses.includes(organization.status)) {
      const orgId = organization._id;
      await Promise.all([
        GeneratedDocuments.deleteMany({ organizationId: orgId }),
        CertificateFiles.deleteMany({ organizationId: orgId }),
        Notification.deleteMany({ organizationId: orgId }),
        Document.deleteMany({ organizationId: orgId }),
        Member.deleteMany({ organizationId: orgId }),
        Assembly.deleteMany({ organizationId: orgId }),
        Assignment.deleteMany({ organizationId: orgId }),
        MinistroBlock.deleteMany({ organizationId: orgId })
      ]);
      await Organization.findByIdAndDelete(orgId);

      logger.info(`Organization deleted (immediate): ${organization.organizationName} (${orgId}) by user ${req.userId}`);
      return res.json({ message: 'Organización eliminada exitosamente' });
    }

    // For all other statuses: request deletion (requires admin approval)
    const reason = req.body?.reason?.trim();
    if (!reason) {
      return res.status(400).json({ error: 'Debe proporcionar un motivo para solicitar la eliminación' });
    }

    const previousStatus = organization.status;
    organization.deletionRequest = {
      reason,
      requestedAt: new Date(),
      previousStatus
    };
    organization.status = 'deletion_requested';
    organization.statusHistory.push({
      status: 'deletion_requested',
      date: new Date(),
      comment: `Eliminación solicitada por el organizador. Motivo: ${reason}`
    });

    await organization.save();

    // Notify all admins
    const admins = await User.find({ role: 'MUNICIPALIDAD', active: true });
    for (const admin of admins) {
      await Notification.create({
        userId: admin._id,
        type: 'deletion_requested',
        title: 'Solicitud de eliminación',
        message: `"${organization.organizationName}" solicita ser eliminada. Motivo: ${reason}`,
        data: { organizationId: organization._id, organizationName: organization.organizationName, reason, previousStatus },
        organizationId: organization._id
      });
    }

    // Notify ministro if there was one assigned
    if (organization.ministroData?.ministroId) {
      await Notification.create({
        ministroId: organization.ministroData.ministroId,
        type: 'assignment_removed',
        title: 'Solicitud de eliminación',
        message: `La organización "${organization.organizationName}" ha solicitado ser eliminada. Motivo: ${reason}`,
        data: { organizationId: organization._id, reason },
        organizationId: organization._id
      });
    }

    logger.info(`Deletion requested: ${organization.organizationName} (${organization._id}) by user ${req.userId}`);
    res.json({ message: 'Solicitud de eliminación enviada al administrador', deletionRequested: true });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ error: 'Error al eliminar organización' });
  }
});

// Approve deletion (Admin only) - Full cascade delete, no trace left
router.post('/:id/approve-deletion', authenticate, requireRole('MUNICIPALIDAD'), validateObjectId(), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);
    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    if (organization.status !== 'deletion_requested') {
      return res.status(400).json({ error: 'La organización no tiene una solicitud de eliminación pendiente' });
    }

    const orgId = organization._id;
    const orgName = organization.organizationName;
    const orgUserId = organization.userId;

    // 1. Delete ALL assignments (not just cancel - full removal)
    await Assignment.deleteMany({ organizationId: orgId });

    // 2. Deactivate and delete linked MinistroBlocks (free time slots)
    await MinistroBlock.deleteMany({ organizationId: orgId });

    // 3. Remove org reference from member accounts (Users MIEMBRO)
    await User.updateMany(
      { organizationIds: orgId },
      { $pull: { organizationIds: orgId } }
    );
    await User.updateMany(
      { organizationId: orgId },
      { $unset: { organizationId: '' } }
    );

    // 4. Cascade delete all related documents and records
    await Promise.all([
      GeneratedDocuments.deleteMany({ organizationId: orgId }),
      CertificateFiles.deleteMany({ organizationId: orgId }),
      Notification.deleteMany({ organizationId: orgId }),
      Document.deleteMany({ organizationId: orgId }),
      Member.deleteMany({ organizationId: orgId }),
      Assembly.deleteMany({ organizationId: orgId })
    ]);

    // 5. Delete the organization itself
    await Organization.findByIdAndDelete(orgId);

    // 6. Notify the organizer (this notification has no organizationId since org is gone)
    await Notification.create({
      userId: orgUserId,
      type: 'organization_deleted',
      title: 'Organización eliminada',
      message: `Tu solicitud de eliminación de "${orgName}" ha sido aprobada por el administrador. La organización y todos sus datos asociados han sido eliminados.`,
      data: { organizationName: orgName, deletedAt: new Date().toISOString() }
    });

    logger.info(`Deletion approved (full cascade): ${orgName} (${orgId}) by admin ${req.userId}`);
    res.json({ message: 'Organización eliminada exitosamente' });
  } catch (error) {
    console.error('Approve deletion error:', error);
    res.status(500).json({ error: 'Error al aprobar eliminación' });
  }
});

// Reject deletion (Admin only)
router.post('/:id/reject-deletion', authenticate, requireRole('MUNICIPALIDAD'), validateObjectId(), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);
    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    if (organization.status !== 'deletion_requested') {
      return res.status(400).json({ error: 'La organización no tiene una solicitud de eliminación pendiente' });
    }

    // Revert to previous status
    const previousStatus = organization.deletionRequest?.previousStatus || 'pending_review';
    organization.status = previousStatus;
    organization.statusHistory.push({
      status: previousStatus,
      date: new Date(),
      comment: `Solicitud de eliminación rechazada por el administrador. ${req.body?.reason ? 'Motivo: ' + req.body.reason : ''}`
    });
    organization.deletionRequest = undefined;

    await organization.save();

    // Notify the organizer
    await Notification.create({
      userId: organization.userId,
      type: 'status_change',
      title: 'Solicitud de eliminación rechazada',
      message: `Tu solicitud de eliminación de "${organization.organizationName}" fue rechazada por el administrador.${req.body?.reason ? ' Motivo: ' + req.body.reason : ''}`,
      organizationId: organization._id
    });

    logger.info(`Deletion rejected: ${organization.organizationName} (${organization._id}) by admin ${req.userId}`);
    res.json(organization);
  } catch (error) {
    console.error('Reject deletion error:', error);
    res.status(500).json({ error: 'Error al rechazar eliminación' });
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

    // Create or update Assignment document for the ministro
    const existingAssignment = await Assignment.findOne({
      organizationId: organization._id,
      status: 'pending'
    });

    if (existingAssignment) {
      // Update existing pending assignment
      existingAssignment.ministroId = ministroId;
      existingAssignment.ministroName = ministroName;
      existingAssignment.ministroRut = ministroRut || existingAssignment.ministroRut;
      existingAssignment.scheduledDate = new Date(scheduledDate);
      existingAssignment.scheduledTime = scheduledTime;
      existingAssignment.location = location || '';
      await existingAssignment.save();
    } else {
      // Create new assignment
      await Assignment.create({
        ministroId,
        ministroName,
        ministroRut: ministroRut || '',
        organizationId: organization._id,
        organizationName: organization.organizationName,
        scheduledDate: new Date(scheduledDate),
        scheduledTime,
        location: location || organization.assemblyAddress || '',
        status: 'pending'
      });
    }

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

    // Send email notification
    if (organization.userId) {
      try {
        const user = await User.findById(organization.userId);
        if (user?.email) {
          await emailService.sendMinistroAssignmentNotification({
            email: user.email,
            userName: `${user.firstName} ${user.lastName}`,
            orgName: organization.organizationName,
            ministroName: req.body.ministroName || '',
            scheduledDate: req.body.scheduledDate || '',
            scheduledTime: req.body.scheduledTime || '',
            location: req.body.location || ''
          });
        }
      } catch (emailErr) {
        console.error('Error sending ministro assignment email:', emailErr);
      }
    }
  } catch (error) {
    console.error('Schedule ministro error:', error);
    res.status(500).json({ error: 'Error al agendar Ministro de Fe' });
  }
});

// Retract organization request (owner only)
router.post('/:id/retract', authenticate, async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);
    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Only the owner can retract
    if (organization.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Solo el creador puede retractar la solicitud' });
    }

    // Validate retractable status
    const RETRACTABLE = new Set(['waiting_ministro', 'ministro_scheduled', 'pending_review', 'in_review']);
    if (!RETRACTABLE.has(organization.status)) {
      return res.status(400).json({
        error: `No se puede retractar una organización en estado "${organization.status}". Solo se permite en estados: ${[...RETRACTABLE].join(', ')}`
      });
    }

    const previousStatus = organization.status;
    const orgName = organization.organizationName;
    const ministroId = organization.ministroData?.ministroId || null;

    // Change to draft and clear scheduling data
    organization.status = 'draft';
    organization.electionDate = null;
    organization.electionTime = null;
    organization.assemblyAddress = null;
    organization.ministroData = null;

    // Add to status history
    if (!organization.statusHistory) organization.statusHistory = [];
    organization.statusHistory.push({
      status: 'draft',
      date: new Date(),
      comment: `El organizador ha retractado la solicitud de constitución (estado anterior: ${previousStatus})`
    });

    await organization.save();

    // Notify all admins (MUNICIPALIDAD)
    const admins = await User.find({ role: 'MUNICIPALIDAD', active: true });
    for (const admin of admins) {
      await Notification.create({
        userId: admin._id,
        type: 'status_change',
        title: 'Solicitud retractada',
        message: `El organizador ha cancelado la solicitud de constitución de "${orgName}"`,
        data: { organizationId: organization._id, organizationName: orgName, previousStatus, action: 'retract' },
        organizationId: organization._id
      });
    }

    // Notify ministro de fe if one was assigned
    if (ministroId) {
      await Notification.create({
        ministroId: ministroId,
        type: 'status_change',
        title: 'Asamblea cancelada',
        message: `La asamblea constitutiva de "${orgName}" ha sido cancelada por el organizador`,
        data: { organizationId: organization._id, organizationName: orgName, action: 'retract' },
        organizationId: organization._id
      });
    }

    res.json({ message: 'Solicitud retractada exitosamente', status: organization.status });
  } catch (error) {
    console.error('Retract organization error:', error);
    res.status(500).json({ error: 'Error al retractar la solicitud' });
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

    // Send email notification
    if (organization.userId) {
      try {
        const user = await User.findById(organization.userId);
        if (user?.email) {
          await emailService.sendApprovalNotification({
            email: user.email,
            userName: `${user.firstName} ${user.lastName}`,
            orgName: organization.organizationName,
            certNumber: organization.certNumber || ''
          });
        }
      } catch (emailErr) {
        console.error('Error sending approval email:', emailErr);
      }
    }
  } catch (error) {
    console.error('Approve ministro error:', error);
    res.status(500).json({ error: 'Error al aprobar' });
  }
});

// ============ VALIDACIÓN DE TRANSICIONES DE ESTADO ============
const VALID_STATUS_TRANSITIONS = {
  'draft': ['waiting_ministro', 'rejected'],
  'waiting_ministro': ['ministro_scheduled', 'rejected', 'draft'],
  'ministro_scheduled': ['ministro_approved', 'waiting_ministro', 'rejected'],
  'ministro_approved': ['pending_review', 'in_review', 'sent_registry', 'rejected'],
  'pending_review': ['in_review', 'rejected', 'approved'],
  'in_review': ['approved', 'rejected', 'sent_registry'],
  'rejected': ['pending_review', 'draft', 'waiting_ministro'], // Puede volver al status previo al rechazo
  'sent_registry': ['approved', 'registry_observations', 'rejected'],
  'registry_observations': ['sent_registry', 'approved', 'rejected'],
  'approved': ['dissolved'], // Estado final, solo puede disolverse
  'dissolved': [], // Estado terminal
  'deletion_requested': [] // Managed by approve/reject-deletion routes
};

/**
 * Valida si una transición de estado es permitida
 * @param {string} fromStatus - Estado actual
 * @param {string} toStatus - Estado destino
 * @returns {boolean}
 */
function isValidStatusTransition(fromStatus, toStatus) {
  // MUNICIPALIDAD puede forzar cualquier transición en casos excepcionales
  // pero la validación normal aplica
  const allowedTransitions = VALID_STATUS_TRANSITIONS[fromStatus];
  if (!allowedTransitions) {
    console.warn(`Estado desconocido: ${fromStatus}`);
    return false;
  }
  return allowedTransitions.includes(toStatus);
}

// Update status (Admin only) - Con validación Zod
router.post('/:id/status', authenticate, requireRole('MUNICIPALIDAD'), validateObjectId(), validate(statusChangeSchema), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    const { status, comment } = req.body;
    const currentStatus = organization.status;

    // Validar transición de estado
    if (!isValidStatusTransition(currentStatus, status)) {
      return res.status(400).json({
        error: `Transición de estado no permitida: ${currentStatus} → ${status}`,
        allowedTransitions: VALID_STATUS_TRANSITIONS[currentStatus] || []
      });
    }

    organization.status = status;
    organization.statusHistory.push({
      status,
      date: new Date(),
      comment: comment || `Estado actualizado a: ${status}`
    });

    await organization.save();

    // Si se aprueba la organización, crear automáticamente las cuentas de socios
    let memberAccountsResult = null;
    if (status === 'approved' && !organization.memberAccountsCreated) {
      try {
        memberAccountsResult = await createMemberAccounts(organization);
        organization.memberAccountsCreated = true;
        organization.memberAccountsCreatedAt = new Date();
        await organization.save();

        const createdCount = memberAccountsResult.createdAccounts.filter(a => a.status === 'created').length;
        if (createdCount > 0) {
          await Notification.create({
            userId: organization.userId,
            type: 'member_accounts_created',
            title: 'Cuentas de miembros creadas',
            message: `Se han creado ${createdCount} cuentas para los miembros de tu organización. Cada socio puede iniciar sesión con su apellido y RUT.`,
            organizationId: organization._id,
            data: { summary: memberAccountsResult }
          });
        }
        console.log(`Auto-created ${createdCount} member accounts for org ${organization.organizationName}`);
      } catch (memberErr) {
        console.error('Error auto-creating member accounts:', memberErr);
      }
    }

    // Notify user con labels legibles en español
    const STATUS_LABELS = {
      'draft': 'Borrador',
      'waiting_ministro': 'Esperando Ministro de Fe',
      'ministro_scheduled': 'Ministro Agendado',
      'ministro_approved': 'Aprobado por Ministro',
      'pending_review': 'Pendiente de Revisión',
      'in_review': 'En Revisión',
      'rejected': 'Requiere Correcciones',
      'sent_registry': 'Enviado al Registro Civil',
      'registry_observations': 'Observaciones del Registro',
      'approved': 'Aprobada',
      'dissolved': 'Disuelta',
      'deletion_requested': 'Eliminación Solicitada'
    };

    const statusLabel = STATUS_LABELS[status] || status;
    await Notification.create({
      userId: organization.userId,
      type: 'status_change',
      title: 'Estado actualizado',
      message: `El estado de tu organización ha cambiado a: ${statusLabel}`,
      organizationId: organization._id
    });

    const responseData = organization.toObject();
    if (memberAccountsResult) {
      responseData.memberAccountsResult = memberAccountsResult;
    }
    res.json(responseData);

    // Send email notification
    if (organization.userId) {
      try {
        const user = await User.findById(organization.userId);
        if (user?.email) {
          await emailService.sendStatusChangeNotification({
            email: user.email,
            userName: `${user.firstName} ${user.lastName}`,
            orgName: organization.organizationName,
            newStatus: status,
            comment: comment || ''
          });
        }
      } catch (emailErr) {
        console.error('Error sending email notification:', emailErr);
      }
    }
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// Reject with corrections (Admin only) - Con validación Zod
router.post('/:id/reject', authenticate, requireRole('MUNICIPALIDAD'), validate(rejectWithCorrectionsSchema), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    const { corrections, generalComment } = req.body;

    const previousStatus = organization.status;
    organization.status = 'rejected';
    organization.corrections = {
      version: 2,
      items: corrections,
      generalComment,
      fromStatus: previousStatus,
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

    // Send email notification
    if (organization.userId) {
      try {
        const user = await User.findById(organization.userId);
        if (user?.email) {
          // Normalize v2 corrections array to readable strings for email
          const correctionStrings = corrections.map(c => `${c.label}: ${c.message}`);
          await emailService.sendRejectionNotification({
            email: user.email,
            userName: `${user.firstName} ${user.lastName}`,
            orgName: organization.organizationName,
            corrections: correctionStrings,
            comment: generalComment || ''
          });
        }
      } catch (emailErr) {
        console.error('Error sending rejection email:', emailErr);
      }
    }
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

    const targetStatus = organization.corrections?.fromStatus || 'pending_review';
    organization.status = targetStatus;
    if (organization.corrections) {
      organization.corrections.resolved = true;
      organization.corrections.resolvedAt = new Date();
      organization.corrections.userResponse = userComment;
      organization.corrections.userFieldResponses = fieldResponses;
    }

    organization.statusHistory.push({
      status: targetStatus,
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
      .select(LIST_EXCLUDE)
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();
    res.json(organizations);
  } catch (error) {
    console.error('Get by status error:', error);
    res.status(500).json({ error: 'Error al obtener organizaciones' });
  }
});

// Sync certificates and estatutos data for existing organizations (from IndexedDB)
router.post('/:id/sync-certificates', authenticate, async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);
    if (!organization) return res.status(404).json({ error: 'No encontrada' });

    // Solo el dueño puede sincronizar
    if (organization.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const { certificates, estatutos } = req.body;
    let certsSynced = 0;
    let estatutosSynced = false;

    // Sync certificados
    if (certificates && typeof certificates === 'object') {
      for (const [key, certData] of Object.entries(certificates)) {
        const existing = organization.certificatesStep5.find(c => c.memberId === key);
        if (existing && !existing.certificate && certData.certificate) {
          // Limpiar prefijo data:...;base64, si existe
          let base64 = certData.certificate;
          if (base64.includes(',')) base64 = base64.split(',')[1];
          existing.certificate = base64;
          certsSynced++;
        }
      }
    }

    // Sync estatutos (solo si el server no tiene y el cliente envía contenido)
    if (estatutos && typeof estatutos === 'string' && estatutos.length > 50 && !organization.estatutos) {
      organization.estatutos = estatutos;
      estatutosSynced = true;
    }

    if (certsSynced > 0 || estatutosSynced) {
      await organization.save();
    }

    res.json({ synced: certsSynced, estatutosSynced });
  } catch (error) {
    console.error('Sync certificates error:', error);
    res.status(500).json({ error: 'Error al sincronizar certificados' });
  }
});

// Diagnóstico de organización (Admin) - ver todos los datos incluyendo provisionalDirectorio
router.get('/:id/debug', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id).lean();
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

    // Sincronizar roles de miembros con el directorio
    syncMemberRolesFromDirectorio(org);

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
    const organization = await Organization.findById(req.params.id).lean();

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Obtener usuarios MIEMBRO asociados a esta organización (buscar en ambos campos)
    const memberUsers = await User.find({
      role: 'MIEMBRO',
      $or: [
        { organizationIds: organization._id },
        { organizationId: organization._id }
      ]
    }).select('-password').lean();

    // Combinar con datos de members (ya son objetos planos por .lean())
    const membersWithAccounts = organization.members.map(member => {
      const userAccount = memberUsers.find(u => u.rut === member.rut);
      return {
        ...member,
        hasAccount: !!userAccount,
        accountEmail: userAccount?.email,
        accountActive: userAccount?.active,
        accountId: userAccount?._id
      };
    });

    // Log PII access
    AuditLog.logAction({
      userId: req.userId,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userRole: req.user.role,
      action: 'ACCESS_PII',
      resource: 'ORGANIZATION',
      resourceId: organization._id,
      resourceName: organization.organizationName,
      details: { type: 'view_members_with_accounts', memberCount: organization.members.length },
      ipAddress: req.ip
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

// ==================== GESTIÓN DE ASAMBLEAS ====================

// Crear asamblea
router.post('/:id/assemblies', authenticate, validateObjectId(), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const isOwner = org.userId.toString() === req.userId.toString();
    const isAdmin = req.user.role === 'MUNICIPALIDAD';
    const isDirectivo = isDirectivoMember(org, req.user);
    if (!isOwner && !isAdmin && !isDirectivo) return res.status(403).json({ error: 'No tienes permisos' });

    const newAssembly = await assemblyService.createAssembly(org, req.body);
    res.status(201).json(newAssembly);
  } catch (error) {
    console.error('Create assembly error:', error);
    res.status(500).json({ error: 'Error al crear asamblea' });
  }
});

// Actualizar asamblea
router.put('/:id/assemblies/:assemblyId', authenticate, validateObjectId(), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const isOwner = org.userId.toString() === req.userId.toString();
    const isAdmin = req.user.role === 'MUNICIPALIDAD';
    const isDirectivo = isDirectivoMember(org, req.user);
    if (!isOwner && !isAdmin && !isDirectivo) return res.status(403).json({ error: 'No tienes permisos' });

    const { type, date, time, title, description, quorumType, quorumValue, agendaItems } = req.body;
    const updates = {};
    if (type) updates.type = type;
    if (date) updates.date = date;
    if (time !== undefined) updates.time = time;
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (quorumType) updates.quorumType = quorumType;
    if (quorumValue !== undefined) updates.quorumValue = quorumValue;
    if (agendaItems) {
      updates.agendaItems = agendaItems.map((item, i) => ({
        id: item.id || `agenda_${Date.now()}_${i}`,
        title: item.title,
        type: item.type || 'custom',
        description: item.description || '',
        votingMode: item.votingMode || null,
        candidates: item.candidates || [],
        votes: item.votes || [],
        voterRegistry: item.voterRegistry || [],
        anonymousVotes: item.anonymousVotes || [],
        votingOpen: item.votingOpen || false,
        votingClosedAt: item.votingClosedAt || null,
        result: item.result || null
      }));
    }

    const assembly = await assemblyService.updateAssembly(org, req.params.assemblyId, updates);
    if (!assembly) return res.status(404).json({ error: 'Asamblea no encontrada' });
    res.json(assembly);
  } catch (error) {
    if (error.message.includes('No se puede editar')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Update assembly error:', error);
    res.status(500).json({ error: 'Error al actualizar asamblea' });
  }
});

// Eliminar asamblea
router.delete('/:id/assemblies/:assemblyId', authenticate, validateObjectId(), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const isOwner = org.userId.toString() === req.userId.toString();
    const isAdmin = req.user.role === 'MUNICIPALIDAD';
    const isDirectivo = isDirectivoMember(org, req.user);
    if (!isOwner && !isAdmin && !isDirectivo) return res.status(403).json({ error: 'No tienes permisos' });

    const result = await assemblyService.deleteAssembly(org, req.params.assemblyId);
    if (!result) return res.status(404).json({ error: 'Asamblea no encontrada' });
    res.json({ message: 'Asamblea eliminada correctamente' });
  } catch (error) {
    if (error.message.includes('Solo se pueden eliminar')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Delete assembly error:', error);
    res.status(500).json({ error: 'Error al eliminar asamblea' });
  }
});

// Cambiar estado de asamblea
router.post('/:id/assemblies/:assemblyId/status', authenticate, validateObjectId(), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const isOwner = org.userId.toString() === req.userId.toString();
    const isAdmin = req.user.role === 'MUNICIPALIDAD';
    const isDirectivo = isDirectivoMember(org, req.user);
    if (!isOwner && !isAdmin && !isDirectivo) return res.status(403).json({ error: 'No tienes permisos' });

    const assembly = await assemblyService.findAssembly(org, req.params.assemblyId);
    if (!assembly) return res.status(404).json({ error: 'Asamblea no encontrada' });

    const { action } = req.body; // convocar, iniciar, finalizar, cancelar

    const transitions = {
      convocar: { from: ['draft'], to: 'convocada' },
      iniciar: { from: ['convocada'], to: 'en_curso' },
      finalizar: { from: ['en_curso'], to: 'finalizada' },
      cancelar: { from: ['draft', 'convocada'], to: 'cancelada' }
    };

    const transition = transitions[action];
    if (!transition) return res.status(400).json({ error: 'Acción no válida' });
    if (!transition.from.includes(assembly.status)) {
      return res.status(400).json({ error: `No se puede ${action} una asamblea en estado ${assembly.status}` });
    }

    assembly.status = transition.to;
    if (action === 'convocar') assembly.convokedAt = new Date();
    if (action === 'iniciar') assembly.startedAt = new Date();
    if (action === 'finalizar') {
      // Verificar quórum antes de finalizar
      const quorum = checkQuorum(assembly, org);
      if (!quorum.met) {
        return res.status(422).json({
          error: 'No se puede finalizar sin quórum',
          detail: quorum.message,
          quorumRequired: quorum.required,
          quorumActual: quorum.actual
        });
      }
      assembly.finishedAt = new Date();
      // Cerrar todas las votaciones abiertas
      assembly.agendaItems.forEach(item => {
        if (item.votingOpen) {
          item.votingOpen = false;
          item.votingClosedAt = new Date();
        }
      });

      // Procesar resultados de elección de directorio
      const electionItem = assembly.agendaItems.find(item => item.type === 'eleccion_directorio');
      // Usar anonymousVotes (nuevo) con fallback a votes (legacy)
      const electionVotes = electionItem ? (electionItem.anonymousVotes?.length > 0 ? electionItem.anonymousVotes : electionItem.votes) : [];
      if (electionItem && electionVotes.length > 0) {
        if (electionItem.votingMode === 'per_cargo') {
          // Contar votos por cargo y determinar ganadores
          const votesByCargo = {};
          electionVotes.forEach(v => {
            if (!votesByCargo[v.cargo]) votesByCargo[v.cargo] = {};
            votesByCargo[v.cargo][v.candidateRut] = (votesByCargo[v.cargo][v.candidateRut] || 0) + 1;
          });

          const winners = {};
          for (const [cargo, candidates] of Object.entries(votesByCargo)) {
            const sorted = Object.entries(candidates).sort((a, b) => b[1] - a[1]);
            if (sorted.length > 0) {
              const winnerRut = sorted[0][0];
              const candidate = electionItem.candidates.find(c => c.rut === winnerRut);
              winners[cargo] = { rut: winnerRut, firstName: candidate?.firstName, lastName: candidate?.lastName, votes: sorted[0][1] };
            }
          }

          electionItem.result = { mode: 'per_cargo', winners, votesByCargo };

          // Actualizar directorio de la organización
          const roleMap = { presidente: 'president', secretario: 'secretary', tesorero: 'treasurer' };
          if (org.provisionalDirectorio) {
            for (const [cargo, winner] of Object.entries(winners)) {
              const schemaRole = roleMap[cargo] || cargo;
              if (org.provisionalDirectorio[schemaRole] !== undefined) {
                org.provisionalDirectorio[schemaRole] = { rut: winner.rut, firstName: winner.firstName, lastName: winner.lastName };
              }
            }
            org.provisionalDirectorio.designatedAt = new Date();
            org.provisionalDirectorio.type = 'ELECTO';
          }
        } else if (electionItem.votingMode === 'per_lista') {
          // Contar votos por lista
          const votesByLista = {};
          electionVotes.forEach(v => {
            votesByLista[v.lista] = (votesByLista[v.lista] || 0) + 1;
          });
          const sorted = Object.entries(votesByLista).sort((a, b) => b[1] - a[1]);
          const winningLista = sorted.length > 0 ? sorted[0][0] : null;
          const winningCandidates = winningLista ? electionItem.candidates.filter(c => c.lista === winningLista) : [];

          electionItem.result = { mode: 'per_lista', winningLista, votesByLista, winningCandidates };

          // Actualizar directorio con la lista ganadora
          if (winningCandidates.length > 0 && org.provisionalDirectorio) {
            const roleMap = { presidente: 'president', secretario: 'secretary', tesorero: 'treasurer' };
            winningCandidates.forEach(c => {
              if (c.cargo) {
                const schemaRole = roleMap[c.cargo] || c.cargo;
                if (org.provisionalDirectorio[schemaRole] !== undefined) {
                  org.provisionalDirectorio[schemaRole] = { rut: c.rut, firstName: c.firstName, lastName: c.lastName };
                }
              }
            });
            org.provisionalDirectorio.designatedAt = new Date();
            org.provisionalDirectorio.type = 'ELECTO';
          }
        }

        org.lastDirectorioElection = {
          assemblyId: assembly.id,
          date: new Date(),
          updatedAt: new Date()
        };

        // Sincronizar roles de miembros con el nuevo directorio electo
        syncMemberRolesFromDirectorio(org);
      }
    }

    await assemblyService.saveAssembly(org, assembly);
    res.json(assembly.toObject ? assembly.toObject() : assembly);
  } catch (error) {
    console.error('Update assembly status error:', error);
    res.status(500).json({ error: 'Error al cambiar estado de asamblea' });
  }
});

// Agregar candidatos a un punto de agenda de elección
router.post('/:id/assemblies/:assemblyId/candidates', authenticate, validateObjectId(), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const isOwner = org.userId.toString() === req.userId.toString();
    const isAdmin = req.user.role === 'MUNICIPALIDAD';
    const isDirectivo = isDirectivoMember(org, req.user);
    if (!isOwner && !isAdmin && !isDirectivo) return res.status(403).json({ error: 'No tienes permisos' });

    const assembly = await assemblyService.findAssembly(org, req.params.assemblyId);
    if (!assembly) return res.status(404).json({ error: 'Asamblea no encontrada' });

    const { agendaItemId, candidates, customCargos } = req.body;
    const agendaItem = assembly.agendaItems.find(item => item.id === agendaItemId);
    if (!agendaItem) return res.status(404).json({ error: 'Punto de agenda no encontrado' });
    if (agendaItem.type !== 'eleccion_directorio') {
      return res.status(400).json({ error: 'Solo se pueden agregar candidatos a puntos de elección' });
    }

    agendaItem.candidates = candidates.map(c => ({
      rut: c.rut,
      firstName: c.firstName,
      lastName: c.lastName,
      cargo: c.cargo || null,
      lista: c.lista || null
    }));

    if (customCargos && customCargos.length > 0) {
      agendaItem.customCargos = customCargos.map(c => ({ id: c.id, nombre: c.nombre, color: c.color }));
    }

    await assemblyService.saveAssembly(org, assembly);
    res.json(agendaItem);
  } catch (error) {
    console.error('Add candidates error:', error);
    res.status(500).json({ error: 'Error al agregar candidatos' });
  }
});

// Registrar voto
router.post('/:id/assemblies/:assemblyId/vote', authenticate, validateObjectId(), async (req, res) => {
  try {
    if (req.user.role !== 'MIEMBRO') {
      return res.status(403).json({ error: 'Solo los miembros pueden votar' });
    }

    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const memberOrgIds = req.user.getAllOrgIds();
    if (!memberOrgIds.includes(org._id.toString())) {
      return res.status(403).json({ error: 'No perteneces a esta organización' });
    }

    const assembly = await assemblyService.findAssembly(org, req.params.assemblyId);
    if (!assembly) return res.status(404).json({ error: 'Asamblea no encontrada' });
    if (assembly.status !== 'en_curso') return res.status(400).json({ error: 'La asamblea no está en curso' });

    const { agendaItemId, votes } = req.body;
    const agendaItem = assembly.agendaItems.find(item => item.id === agendaItemId);
    if (!agendaItem) return res.status(404).json({ error: 'Punto de agenda no encontrado' });
    if (!agendaItem.votingOpen) return res.status(400).json({ error: 'La votación no está abierta' });

    const voterRut = req.user.rut;
    const normalizedVoterRut = normalizeRut(voterRut);
    // Verificar duplicado en voterRegistry (nuevo) o votes (legacy)
    const alreadyVoted = (agendaItem.voterRegistry || []).some(v => normalizeRut(v.voterRut) === normalizedVoterRut)
      || (agendaItem.votes || []).some(v => normalizeRut(v.voterRut) === normalizedVoterRut);
    if (alreadyVoted) return res.status(400).json({ error: 'Ya has votado en este punto' });

    // Validar que cada voto referencia un candidato/lista válido
    for (const vote of votes) {
      if (vote.candidateRut && !agendaItem.candidates.some(c => c.rut === vote.candidateRut)) {
        return res.status(400).json({ error: `Candidato no válido: ${vote.candidateRut}` });
      }
      if (vote.lista && !agendaItem.candidates.some(c => c.lista === vote.lista)) {
        return res.status(400).json({ error: `Lista no válida: ${vote.lista}` });
      }
    }

    // Registrar quién votó (sin elección) — Voto secreto Ley 19.418
    if (!agendaItem.voterRegistry) agendaItem.voterRegistry = [];
    agendaItem.voterRegistry.push({ voterRut, votedAt: new Date() });

    // Registrar votos anónimos (sin identidad) — inserción en posición aleatoria
    // para evitar correlación por índice con voterRegistry (Art. 24 Ley 19.418)
    if (!agendaItem.anonymousVotes) agendaItem.anonymousVotes = [];
    for (const vote of votes) {
      const randomIndex = Math.floor(Math.random() * (agendaItem.anonymousVotes.length + 1));
      agendaItem.anonymousVotes.splice(randomIndex, 0, {
        cargo: vote.cargo || null,
        candidateRut: vote.candidateRut || null,
        lista: vote.lista || null,
        votedAt: new Date()
      });
    }

    const isCheckedIn = assembly.attendees.some(a => a.rut === voterRut);
    if (!isCheckedIn) {
      assembly.attendees.push({
        rut: voterRut,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        checkedInAt: new Date()
      });
      assembly.attendance = assembly.attendees.length;
    }

    await assemblyService.saveAssembly(org, assembly);
    res.json({ message: 'Voto registrado exitosamente' });
  } catch (error) {
    console.error('Cast vote error:', error);
    res.status(500).json({ error: 'Error al registrar voto' });
  }
});

// Registrar asistencia (checkin)
router.post('/:id/assemblies/:assemblyId/checkin', authenticate, validateObjectId(), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const assembly = await assemblyService.findAssembly(org, req.params.assemblyId);
    if (!assembly) return res.status(404).json({ error: 'Asamblea no encontrada' });

    const { rut, firstName, lastName } = req.body;
    const attendeeRut = rut || req.user.rut;

    const normalizedRut = normalizeRut(attendeeRut);
    const already = assembly.attendees.some(a => normalizeRut(a.rut) === normalizedRut);
    if (already) return res.status(400).json({ error: 'Ya registrado' });

    assembly.attendees.push({
      rut: attendeeRut,
      firstName: firstName || req.user.firstName,
      lastName: lastName || req.user.lastName,
      checkedInAt: new Date()
    });
    assembly.attendance = assembly.attendees.length;

    await assemblyService.saveAssembly(org, assembly);
    res.json({ message: 'Asistencia registrada', attendance: assembly.attendance });
  } catch (error) {
    console.error('Checkin error:', error);
    res.status(500).json({ error: 'Error al registrar asistencia' });
  }
});

// Registrar asistencia por QR (escaneo inverso — organizador escanea QR del socio)
router.post('/:id/assemblies/:assemblyId/checkin-qr', qrCheckinLimiter, authenticate, validateObjectId(), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    // Solo owner, admin o directivo pueden escanear
    const isOwner = org.userId.toString() === req.userId.toString();
    const isAdmin = req.user.role === 'MUNICIPALIDAD';
    const isDirectivo = isDirectivoMember(org, req.user);
    if (!isOwner && !isAdmin && !isDirectivo) return res.status(403).json({ error: 'No tienes permisos para escanear' });

    const assembly = await assemblyService.findAssembly(org, req.params.assemblyId);
    if (!assembly) return res.status(404).json({ error: 'Asamblea no encontrada' });
    if (assembly.status !== 'en_curso') return res.status(400).json({ error: 'La asamblea no está en curso' });

    const { qrToken } = req.body;
    if (!qrToken) return res.status(400).json({ error: 'Token QR requerido' });

    // Buscar usuario por qrToken
    const memberUser = await User.findOne({ qrToken });
    if (!memberUser) return res.status(404).json({ error: 'Credencial QR no reconocida' });

    // Verificar expiración del token QR (365 días)
    if (memberUser.qrTokenGeneratedAt) {
      const QR_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 año
      if (Date.now() - new Date(memberUser.qrTokenGeneratedAt).getTime() > QR_TOKEN_TTL_MS) {
        return res.status(410).json({ error: 'Credencial QR expirada. El socio debe regenerarla desde su perfil.' });
      }
    }

    // Verificar que pertenezca a la organización
    const memberOrgIds = memberUser.getAllOrgIds();
    const isMemberOfOrg = memberOrgIds.includes(org._id.toString())
      || (org.members || []).some(m => normalizeRut(m.rut) === normalizeRut(memberUser.rut));
    if (!isMemberOfOrg) return res.status(403).json({ error: 'El socio no pertenece a esta organización' });

    // Verificar duplicado
    const attendeeRut = memberUser.rut;
    const already = assembly.attendees.some(a => normalizeRut(a.rut) === normalizeRut(attendeeRut));
    if (already) return res.status(400).json({ error: 'Ya registrado', memberName: `${memberUser.firstName} ${memberUser.lastName}` });

    assembly.attendees.push({
      rut: attendeeRut,
      firstName: memberUser.firstName,
      lastName: memberUser.lastName,
      checkedInAt: new Date(),
      method: 'qr'
    });
    assembly.attendance = assembly.attendees.length;

    await assemblyService.saveAssembly(org, assembly);
    res.json({
      message: 'Asistencia registrada por QR',
      memberName: `${memberUser.firstName} ${memberUser.lastName}`,
      attendance: assembly.attendance
    });
  } catch (error) {
    console.error('QR checkin error:', error);
    res.status(500).json({ error: 'Error al registrar asistencia por QR' });
  }
});

// Registrar resultado de votación a mano alzada
router.post('/:id/assemblies/:assemblyId/mano-alzada', authenticate, validateObjectId(), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const isOwner = org.userId.toString() === req.userId.toString();
    const isAdmin = req.user.role === 'MUNICIPALIDAD';
    const isDirectivo = isDirectivoMember(org, req.user);
    if (!isOwner && !isAdmin && !isDirectivo) return res.status(403).json({ error: 'No tienes permisos' });

    const assembly = await assemblyService.findAssembly(org, req.params.assemblyId);
    if (!assembly) return res.status(404).json({ error: 'Asamblea no encontrada' });
    if (assembly.status !== 'en_curso') return res.status(400).json({ error: 'La asamblea no está en curso' });

    // Verificar quórum
    const quorum = checkQuorum(assembly, org);
    if (!quorum.met) {
      return res.status(422).json({
        error: 'Quórum no alcanzado para votación',
        detail: quorum.message,
        quorumRequired: quorum.required,
        quorumActual: quorum.actual
      });
    }

    const { agendaItemId, resolucion, votosAFavor, votosEnContra, abstenciones, observaciones } = req.body;
    if (!agendaItemId) return res.status(400).json({ error: 'agendaItemId requerido' });
    if (!['aprobado', 'rechazado'].includes(resolucion)) return res.status(400).json({ error: 'Resolución debe ser aprobado o rechazado' });

    const agendaItem = assembly.agendaItems.find(item => item.id === agendaItemId);
    if (!agendaItem) return res.status(404).json({ error: 'Punto de agenda no encontrado' });
    if (agendaItem.result) return res.status(400).json({ error: 'Este punto ya tiene un resultado registrado' });

    agendaItem.result = {
      mode: 'mano_alzada',
      resolucion,
      votosAFavor: votosAFavor != null ? Number(votosAFavor) : undefined,
      votosEnContra: votosEnContra != null ? Number(votosEnContra) : undefined,
      abstenciones: abstenciones != null ? Number(abstenciones) : undefined,
      observaciones: observaciones || '',
      closedAt: new Date()
    };
    agendaItem.votingOpen = false;

    await assemblyService.saveAssembly(org, assembly);
    res.json({ message: 'Resultado de votación a mano alzada registrado', result: agendaItem.result });
  } catch (error) {
    console.error('Mano alzada error:', error);
    res.status(500).json({ error: 'Error al registrar votación a mano alzada' });
  }
});

// Abrir/cerrar votación de un punto de agenda
router.post('/:id/assemblies/:assemblyId/toggle-voting', authenticate, validateObjectId(), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const isOwner = org.userId.toString() === req.userId.toString();
    const isAdmin = req.user.role === 'MUNICIPALIDAD';
    const isDirectivo = isDirectivoMember(org, req.user);
    if (!isOwner && !isAdmin && !isDirectivo) return res.status(403).json({ error: 'No tienes permisos' });

    const assembly = await assemblyService.findAssembly(org, req.params.assemblyId);
    if (!assembly) return res.status(404).json({ error: 'Asamblea no encontrada' });
    if (assembly.status !== 'en_curso') return res.status(400).json({ error: 'La asamblea debe estar en curso' });

    const { agendaItemId } = req.body;
    const agendaItem = assembly.agendaItems.find(item => item.id === agendaItemId);
    if (!agendaItem) return res.status(404).json({ error: 'Punto de agenda no encontrado' });

    // Guard contra race condition: rechazar toggles rápidos (<2s desde último cambio)
    if (agendaItem.votingClosedAt) {
      const elapsed = Date.now() - new Date(agendaItem.votingClosedAt).getTime();
      if (elapsed < 2000) {
        return res.status(429).json({ error: 'Acción demasiado rápida, espere un momento' });
      }
    }

    // Al ABRIR votación, verificar quórum
    if (!agendaItem.votingOpen) {
      const quorum = checkQuorum(assembly, org);
      if (!quorum.met) {
        return res.status(422).json({
          error: 'Quórum no alcanzado',
          detail: quorum.message,
          quorumRequired: quorum.required,
          quorumActual: quorum.actual
        });
      }
    }

    agendaItem.votingOpen = !agendaItem.votingOpen;
    if (!agendaItem.votingOpen) agendaItem.votingClosedAt = new Date();

    await assemblyService.saveAssembly(org, assembly);
    res.json({ votingOpen: agendaItem.votingOpen });
  } catch (error) {
    console.error('Toggle voting error:', error);
    res.status(500).json({ error: 'Error al cambiar estado de votación' });
  }
});

// ==================== DOCUMENTOS GENERADOS (colección separada) ====================

import GeneratedDocuments from '../models/GeneratedDocuments.js';
import CertificateFiles from '../models/CertificateFiles.js';
import Assembly from '../models/Assembly.js';

// Guardar documentos generados del wizard (colección separada para evitar límite BSON 16MB)
router.post('/:id/generated-documents', authenticate, validateObjectId(), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);
    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Solo el dueño puede guardar documentos
    if (organization.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const { documents } = req.body;
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ error: 'No se enviaron documentos' });
    }

    const docsData = documents.map(doc => ({
      docType: doc.docType,
      content: doc.content,
      generatedAt: doc.generatedAt ? new Date(doc.generatedAt) : new Date(),
      editedAt: doc.editedAt ? new Date(doc.editedAt) : null,
      cargoId: doc.cargoId || null,
      cargoNombre: doc.cargoNombre || null
    }));

    // Upsert: crear o actualizar
    await GeneratedDocuments.findOneAndUpdate(
      { organizationId: req.params.id },
      { organizationId: req.params.id, documents: docsData },
      { upsert: true, new: true }
    );

    logger.debug('GENERATED DOCS - Guardados:', docsData.length, 'documentos para org:', req.params.id);
    res.json({ saved: docsData.length });
  } catch (error) {
    logger.error('Save generated documents error:', error.message);
    res.status(500).json({ error: error.message || 'Error al guardar documentos' });
  }
});

// Guardar archivos de certificados base64 (colección separada para evitar BSON 16MB)
// Acepta bulk (certificates array) o individual (certificate object)
router.post('/:id/certificate-files', authenticate, validateObjectId(), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);
    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }
    if (organization.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    // Soportar envío individual (certificate) o bulk (certificates)
    const { certificate, certificates } = req.body;

    if (certificate && certificate.memberId) {
      // Modo individual: agregar/reemplazar un solo certificado usando $push/$pull
      const certData = {
        memberId: certificate.memberId || '',
        memberName: certificate.memberName || '',
        certificate: certificate.certificate || '',
        uploadedAt: new Date()
      };

      // Primero remover si ya existe uno con ese memberId, luego agregar
      await CertificateFiles.findOneAndUpdate(
        { organizationId: req.params.id },
        { $pull: { certificates: { memberId: certData.memberId } } }
      );
      await CertificateFiles.findOneAndUpdate(
        { organizationId: req.params.id },
        {
          $push: { certificates: certData },
          $setOnInsert: { organizationId: req.params.id }
        },
        { upsert: true, new: true }
      );

      logger.debug('CERT FILE - Individual guardado:', certData.memberId, 'para org:', req.params.id, 'size:', (certData.certificate?.length || 0));
      res.json({ saved: 1, memberId: certData.memberId });
    } else if (certificates && Array.isArray(certificates) && certificates.length > 0) {
      // Modo bulk (legacy)
      await CertificateFiles.findOneAndUpdate(
        { organizationId: req.params.id },
        {
          organizationId: req.params.id,
          certificates: certificates.map(c => ({
            memberId: c.memberId || '',
            memberName: c.memberName || '',
            certificate: c.certificate || '',
            uploadedAt: new Date()
          }))
        },
        { upsert: true, new: true }
      );

      logger.debug('CERT FILES - Bulk guardados:', certificates.length, 'para org:', req.params.id);
      res.json({ saved: certificates.length });
    } else {
      return res.status(400).json({ error: 'No se enviaron certificados' });
    }
  } catch (error) {
    logger.error('Save certificate files error:', error.message);
    res.status(500).json({ error: error.message || 'Error al guardar certificados' });
  }
});

// Obtener archivos de certificados de una organización
router.get('/:id/certificate-files', authenticate, validateObjectId(), async (req, res) => {
  try {
    const certFiles = await CertificateFiles.findOne({ organizationId: req.params.id }).lean();
    res.json(certFiles ? certFiles.certificates : []);
  } catch (error) {
    console.error('Get certificate files error:', error);
    res.status(500).json({ error: 'Error al obtener certificados' });
  }
});

// Obtener documentos generados de una organización
router.get('/:id/generated-documents', authenticate, validateObjectId(), async (req, res) => {
  try {
    const genDocs = await GeneratedDocuments.findOne({ organizationId: req.params.id }).lean();
    res.json(genDocs ? genDocs.documents : []);
  } catch (error) {
    console.error('Get generated documents error:', error);
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
});

// ==================== EXPORTACIONES MUNICIPALES (Ley 19.418) ====================

// Export member roster as CSV (Art. 15 - Nómina de socios)
router.get('/:id/export/members', authenticate, requireRole('MUNICIPALIDAD'), validateObjectId(), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id)
      .select('organizationName organizationType members')
      .lean();
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const lines = [
      `"Nómina de Socios - ${org.organizationName}"`,
      `"Tipo: ${org.organizationType}"`,
      `"Fecha de exportación: ${new Date().toLocaleDateString('es-CL')}"`,
      '',
      '"N°","RUT","Nombre","Apellido","Cargo","Email","Teléfono","Dirección","Fecha Nacimiento"'
    ];

    (org.members || []).forEach((m, i) => {
      lines.push(
        `${i + 1},"${m.rut || ''}","${m.firstName || ''}","${m.lastName || ''}","${m.role || 'member'}","${m.email || ''}","${m.phone || ''}","${m.address || ''}","${m.birthDate ? new Date(m.birthDate).toLocaleDateString('es-CL') : ''}"`
      );
    });

    // Audit log
    AuditLog.logAction({
      userId: req.userId,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userRole: req.user.role,
      action: 'EXPORT',
      resource: 'ORGANIZATION',
      resourceId: org._id,
      resourceName: org.organizationName,
      details: { type: 'export_member_roster', memberCount: (org.members || []).length },
      ipAddress: req.ip
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=nomina_socios_${org._id}.csv`);
    res.send('\uFEFF' + lines.join('\n'));
  } catch (error) {
    console.error('Export members error:', error);
    res.status(500).json({ error: 'Error al exportar nómina' });
  }
});

// Export semester changes report
router.get('/:id/export/changes', authenticate, requireRole('MUNICIPALIDAD'), validateObjectId(), async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'Parámetros from y to son requeridos (YYYY-MM-DD)' });
    }

    const org = await Organization.findById(req.params.id)
      .select('organizationName organizationType')
      .lean();
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    // Get audit logs for member changes in this org during the period
    const changes = await AuditLog.find({
      resource: 'ORGANIZATION',
      resourceId: new mongoose.Types.ObjectId(req.params.id),
      action: { $in: ['UPDATE', 'CREATE'] },
      timestamp: { $gte: fromDate, $lte: toDate },
      'details.type': { $in: ['add_member', 'remove_member', 'addMember', 'removeMemberRut', 'member_added', 'member_removed'] }
    }).sort({ timestamp: 1 }).lean();

    const lines = [
      `"Reporte de Cambios - ${org.organizationName}"`,
      `"Período: ${from} a ${to}"`,
      `"Fecha de exportación: ${new Date().toLocaleDateString('es-CL')}"`,
      '',
      '"Fecha","Acción","Usuario","Detalle"'
    ];

    changes.forEach(c => {
      const date = new Date(c.timestamp).toLocaleDateString('es-CL');
      const action = c.action;
      const user = c.userName || 'Sistema';
      const detail = JSON.stringify(c.details || {}).replace(/"/g, "'");
      lines.push(`"${date}","${action}","${user}","${detail}"`);
    });

    if (changes.length === 0) {
      lines.push('"Sin cambios en el período"');
    }

    // Audit log
    AuditLog.logAction({
      userId: req.userId,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userRole: req.user.role,
      action: 'EXPORT',
      resource: 'ORGANIZATION',
      resourceId: org._id,
      resourceName: org.organizationName,
      details: { type: 'export_semester_changes', from, to, changesCount: changes.length },
      ipAddress: req.ip
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=cambios_${org._id}_${from}_${to}.csv`);
    res.send('\uFEFF' + lines.join('\n'));
  } catch (error) {
    console.error('Export changes error:', error);
    res.status(500).json({ error: 'Error al exportar cambios' });
  }
});

// Export election results (Art. 21 bis)
router.get('/:id/export/election-results/:assemblyId', authenticate, requireRole('MUNICIPALIDAD'), validateObjectId(), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id)
      .select('organizationName organizationType members provisionalDirectorio')
      .lean();
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const assembly = await assemblyService.findAssembly(org, req.params.assemblyId);
    if (!assembly) return res.status(404).json({ error: 'Asamblea no encontrada' });

    // Quórum info
    const quorumInfo = checkQuorum(assembly, org);
    const lines = [
      `"Resultados de Asamblea - ${org.organizationName}"`,
      `"Tipo Organización: ${org.organizationType}"`,
      `"Asamblea: ${assembly.title || 'Sin título'}"`,
      `"Tipo Asamblea: ${assembly.type || 'ordinaria'}"`,
      `"Fecha: ${assembly.date || 'N/A'}"`,
      `"Estado: ${assembly.status || 'N/A'}"`,
      '',
      '"QUÓRUM"',
      `"Tipo quórum: ${assembly.quorumType === 'percentage' ? 'Porcentaje' : 'Número fijo'}"`,
      `"Valor configurado: ${assembly.quorumValue ?? 50}${assembly.quorumType === 'percentage' ? '%' : ''}"`,
      `"Miembros totales: ${org.members?.length || 0}"`,
      `"Asistentes: ${quorumInfo.actual}"`,
      `"Requeridos: ${quorumInfo.required}"`,
      `"Quórum cumplido: ${quorumInfo.met ? 'SÍ' : 'NO'}"`,
      '',
      `"Fecha de exportación: ${new Date().toLocaleDateString('es-CL')}"`,
      ''
    ];

    // Agenda items con resultados
    const itemsWithResults = (assembly.agendaItems || []).filter(item => item.result);

    if (itemsWithResults.length > 0) {
      for (const item of itemsWithResults) {
        lines.push(`"Punto: ${item.title || 'Sin título'}"`,
          `"Tipo: ${item.type}"`,
          `"Modo votación: ${item.result.mode || 'N/A'}"`);

        if (item.result.mode === 'per_cargo') {
          lines.push('"Candidato","Cargo","Votos","Resultado"');
          // Listar todos los candidatos con sus votos
          const votesByCargo = item.result.votesByCargo || {};
          for (const [cargo, candidates] of Object.entries(votesByCargo)) {
            const winnerRut = item.result.winners?.[cargo]?.rut;
            for (const [candidateRut, voteCount] of Object.entries(candidates)) {
              const candidate = (item.candidates || []).find(c => c.rut === candidateRut);
              const name = candidate ? `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() : candidateRut;
              const isWinner = candidateRut === winnerRut;
              lines.push(`"${name}","${cargo}","${voteCount}","${isWinner ? 'ELECTO' : ''}"`);
            }
          }
        } else if (item.result.mode === 'per_lista') {
          lines.push('"Lista","Votos","Resultado"');
          const votesByLista = item.result.votesByLista || {};
          for (const [lista, voteCount] of Object.entries(votesByLista)) {
            const isWinner = lista === item.result.winningLista;
            lines.push(`"${lista}","${voteCount}","${isWinner ? 'GANADORA' : ''}"`);
          }
          if (item.result.winningCandidates?.length) {
            lines.push('', '"Candidatos de lista ganadora:"', '"Nombre","Cargo","RUT"');
            for (const c of item.result.winningCandidates) {
              lines.push(`"${c.firstName || ''} ${c.lastName || ''}","${c.cargo || ''}","${c.rut || ''}"`);
            }
          }
        } else if (item.result.mode === 'mano_alzada') {
          lines.push('"Resolución","Votos a Favor","Votos en Contra","Abstenciones","Observaciones"');
          lines.push(`"${item.result.resolucion === 'aprobado' ? 'APROBADO' : 'RECHAZADO'}","${item.result.votosAFavor ?? ''}","${item.result.votosEnContra ?? ''}","${item.result.abstenciones ?? ''}","${(item.result.observaciones || '').replace(/"/g, '""')}"`);
        }

        lines.push('');
      }
    } else {
      // Items de elección sin resultado (aún no finalizados)
      const electionItems = (assembly.agendaItems || []).filter(item => item.type === 'eleccion_directorio');
      if (electionItems.length > 0) {
        lines.push('"Puntos de elección sin resultado (asamblea no finalizada):"');
        for (const item of electionItems) {
          const voteCount = (item.anonymousVotes?.length || item.votes?.length || 0);
          lines.push(`"${item.title || 'Elección'}","Votos registrados: ${voteCount}"`);
        }
      } else {
        lines.push('"No se encontraron ítems con resultados en esta asamblea"');
      }
    }

    // Directorio actual
    if (org.provisionalDirectorio) {
      lines.push('', '"DIRECTORIO ACTUAL"', '"Cargo","Nombre","RUT"');
      const dir = org.provisionalDirectorio;
      const p = dir.president || dir.presidente;
      const s = dir.secretary || dir.secretario;
      const t = dir.treasurer || dir.tesorero;
      if (p) lines.push(`"Presidente","${p.firstName || ''} ${p.lastName || ''}","${p.rut || ''}"`);
      if (s) lines.push(`"Secretario","${s.firstName || ''} ${s.lastName || ''}","${s.rut || ''}"`);
      if (t) lines.push(`"Tesorero","${t.firstName || ''} ${t.lastName || ''}","${t.rut || ''}"`);
      (dir.additionalMembers || []).forEach(m => {
        lines.push(`"${m.cargoNombre || m.cargo || 'Director'}","${m.firstName || ''} ${m.lastName || ''}","${m.rut || ''}"`);
      });
    }

    AuditLog.logAction({
      userId: req.userId,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userRole: req.user.role,
      action: 'EXPORT',
      resource: 'ORGANIZATION',
      resourceId: org._id,
      resourceName: org.organizationName,
      details: { type: 'export_election_results', assemblyId: req.params.assemblyId },
      ipAddress: req.ip
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=eleccion_${org._id}_${req.params.assemblyId}.csv`);
    res.send('\uFEFF' + lines.join('\n'));
  } catch (error) {
    console.error('Export election results error:', error);
    res.status(500).json({ error: 'Error al exportar resultados' });
  }
});

export default router;
