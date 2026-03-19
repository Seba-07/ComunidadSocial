import express from 'express';
import Assignment from '../models/Assignment.js';
import Organization from '../models/Organization.js';
import Counter from '../models/Counter.js';
import MinistroBlock from '../models/MinistroBlock.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { withTransactionFallback } from '../utils/withTransaction.js';
import { storeDocument, isS3Configured } from '../services/storageService.js';

const router = express.Router();

// ============ CONSTANTES DE PROYECCIÓN OPTIMIZADA ============
// Campos básicos de organización (sin datos pesados)
const ORG_BASIC_FIELDS = 'organizationName organizationType address comuna region contactEmail contactPhone';

// Campos para listados (excluye Base64)
const ORG_LIST_FIELDS = `${ORG_BASIC_FIELDS} status electionDate electionTime`;

// Campos para vista detallada del ministro (sin signatures/certificates Base64)
// NOTA: Los members se cargan pero se procesan en el cliente para no incluir Base64
const ORG_DETAIL_FIELDS = `${ORG_BASIC_FIELDS} members.rut members.firstName members.segundoNombre members.lastName members.apellidoMaterno members.role members.email members.phone electoralCommission.rut electoralCommission.firstName electoralCommission.lastName electoralCommission.role provisionalDirectorio.president.rut provisionalDirectorio.president.firstName provisionalDirectorio.president.lastName provisionalDirectorio.secretary.rut provisionalDirectorio.secretary.firstName provisionalDirectorio.secretary.lastName provisionalDirectorio.treasurer.rut provisionalDirectorio.treasurer.firstName provisionalDirectorio.treasurer.lastName`;

// Función auxiliar para limpiar miembros de datos Base64 antes de enviar
function cleanMembersData(org) {
  if (!org) return org;

  const cleanMember = (m) => {
    if (!m) return m;
    // Retornar solo campos necesarios, excluyendo signature y certificate (Base64 pesados)
    return {
      _id: m._id,
      rut: m.rut,
      firstName: m.firstName,
      segundoNombre: m.segundoNombre,
      lastName: m.lastName,
      apellidoMaterno: m.apellidoMaterno,
      name: m.name,               // nombre concatenado (usado por provisionalDirectorio)
      cargo: m.cargo,             // cargo en directorio (vicepresidente, director, etc.)
      role: m.role,
      email: m.email,
      phone: m.phone,
      address: m.address,
      birthDate: m.birthDate,
      occupation: m.occupation,
      genero: m.genero
      // EXCLUIDO: signature, certificate, certificado
    };
  };

  const orgObj = org.toObject ? org.toObject() : { ...org };

  if (orgObj.members) {
    orgObj.members = orgObj.members.map(cleanMember);
  }
  if (orgObj.electoralCommission) {
    orgObj.electoralCommission = orgObj.electoralCommission.map(cleanMember);
  }
  if (orgObj.provisionalDirectorio) {
    if (orgObj.provisionalDirectorio.president) {
      orgObj.provisionalDirectorio.president = cleanMember(orgObj.provisionalDirectorio.president);
    }
    if (orgObj.provisionalDirectorio.secretary) {
      orgObj.provisionalDirectorio.secretary = cleanMember(orgObj.provisionalDirectorio.secretary);
    }
    if (orgObj.provisionalDirectorio.treasurer) {
      orgObj.provisionalDirectorio.treasurer = cleanMember(orgObj.provisionalDirectorio.treasurer);
    }
    if (orgObj.provisionalDirectorio.additionalMembers) {
      orgObj.provisionalDirectorio.additionalMembers = orgObj.provisionalDirectorio.additionalMembers.map(cleanMember);
    }
  }

  // Excluir campos pesados
  delete orgObj.ministroSignature;
  delete orgObj.estatutos;
  delete orgObj.certificatesStep5;
  delete orgObj.validatedAttendees;

  return orgObj;
}

// Get all assignments (Admin only)
router.get('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const assignments = await Assignment.find()
      .populate('organizationId', 'organizationName')
      .sort({ scheduledDate: -1 })
      .lean();
    res.json(assignments);
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ error: 'Error al obtener asignaciones' });
  }
});

// Get assignments by ministro
router.get('/ministro/:ministroId', authenticate, async (req, res) => {
  try {
    // Verify permission: self or admin
    if (req.params.ministroId !== req.userId.toString() && req.user.role !== 'MUNICIPALIDAD') {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const assignments = await Assignment.find({ ministroId: req.params.ministroId })
      .populate('organizationId', `${ORG_BASIC_FIELDS} members electoralCommission provisionalDirectorio estatutos certificatesStep5`)
      .sort({ scheduledDate: -1 })
      .lean();

    // Limpiar datos Base64 de miembros antes de enviar (ya son objetos planos por .lean())
    // NOTA: estatutos y certificatesStep5 se mantienen porque son necesarios para revisión de documentos
    const cleanedAssignments = assignments.map(assignment => {
      if (assignment.organizationId) {
        // Preservar campos de documentación antes de limpiar
        const estatutos = assignment.organizationId.estatutos;
        const certificatesStep5 = assignment.organizationId.certificatesStep5;
        assignment.organizationId = cleanMembersData(assignment.organizationId);
        assignment.organizationId.estatutos = estatutos;
        assignment.organizationId.certificatesStep5 = certificatesStep5;
      }
      return assignment;
    });

    res.json(cleanedAssignments);
  } catch (error) {
    console.error('Get ministro assignments error:', error);
    res.status(500).json({ error: 'Error al obtener asignaciones' });
  }
});

// Get pending assignments for current ministro
router.get('/my/pending', authenticate, requireRole('MINISTRO_FE'), async (req, res) => {
  try {
    const assignments = await Assignment.find({
      ministroId: req.userId,
      status: 'pending'
    })
      .populate('organizationId', `${ORG_BASIC_FIELDS} members electoralCommission provisionalDirectorio estatutos certificatesStep5`)
      .sort({ scheduledDate: 1 })
      .lean();

    // Limpiar datos Base64 de miembros antes de enviar (ya son objetos planos por .lean())
    // NOTA: estatutos y certificatesStep5 se mantienen porque son necesarios para revisión de documentos
    const cleanedAssignments = assignments.map(assignment => {
      if (assignment.organizationId) {
        // Preservar campos de documentación antes de limpiar
        const estatutos = assignment.organizationId.estatutos;
        const certificatesStep5 = assignment.organizationId.certificatesStep5;
        assignment.organizationId = cleanMembersData(assignment.organizationId);
        assignment.organizationId.estatutos = estatutos;
        assignment.organizationId.certificatesStep5 = certificatesStep5;
      }
      return assignment;
    });

    res.json(cleanedAssignments);
  } catch (error) {
    console.error('Get pending assignments error:', error);
    res.status(500).json({ error: 'Error al obtener asignaciones pendientes' });
  }
});

// Get assignment by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('organizationId', `${ORG_BASIC_FIELDS} members electoralCommission provisionalDirectorio estatutos`)
      .lean();

    if (!assignment) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    // Limpiar datos Base64 de miembros antes de enviar (ya es objeto plano por .lean())
    if (assignment.organizationId) {
      const estatutos = assignment.organizationId.estatutos;
      assignment.organizationId = cleanMembersData(assignment.organizationId);
      assignment.organizationId.estatutos = estatutos;
    }

    res.json(assignment);
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({ error: 'Error al obtener asignación' });
  }
});

// Create assignment (Admin only)
router.post('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const {
      ministroId,
      ministroName,
      ministroRut,
      organizationId,
      organizationName,
      scheduledDate,
      scheduledTime,
      location
    } = req.body;

    // Check for schedule conflict with existing assignments
    const conflict = await Assignment.findOne({
      ministroId,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      status: { $ne: 'cancelled' }
    }).lean();

    if (conflict) {
      return res.status(400).json({
        error: 'El ministro ya tiene una asignación en ese horario'
      });
    }

    // Check for MF blocks on this date/time
    const dateStr = new Date(scheduledDate).toISOString().split('T')[0];
    const activeBlocks = await MinistroBlock.find({
      ministroId,
      date: dateStr,
      active: true,
      status: { $ne: 'pending' }
    }).lean();

    const isBlockedSlot = activeBlocks.some(b => {
      if (b.blockType === 'full_day') return true;
      if (b.time === scheduledTime) return true;
      if (b.blockType === 'duration' && b.time && b.endTime) {
        return scheduledTime >= b.time && scheduledTime < b.endTime;
      }
      return false;
    });

    if (isBlockedSlot) {
      const blockReason = activeBlocks.find(b => b.reason)?.reason;
      return res.status(409).json({
        error: `El ministro tiene bloqueado ese horario${blockReason ? ': ' + blockReason : ''}`
      });
    }

    const assignment = new Assignment({
      ministroId,
      ministroName,
      ministroRut,
      organizationId,
      organizationName,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      location,
      status: 'pending'
    });

    await assignment.save();
    res.status(201).json(assignment);
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ error: 'Error al crear asignación' });
  }
});

// Update assignment
router.put('/:id', authenticate, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    // Solo permitir actualización de campos seguros (prevenir mass assignment)
    const allowedFields = ['scheduledDate', 'scheduledTime', 'location', 'notes', 'wizardData'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        assignment[field] = req.body[field];
      }
    }
    assignment.lastEditedAt = new Date();
    await assignment.save();

    res.json(assignment);
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ error: 'Error al actualizar asignación' });
  }
});

// ============ CONSTANTES DE VALIDACIÓN ============
const MAX_GROUP_PHOTO_SIZE = 2 * 1024 * 1024; // 2MB en bytes (aumentado para fotos de celular)
const MAX_SIGNATURE_SIZE = 100 * 1024; // 100KB por firma
const BASE64_OVERHEAD = 1.37; // Base64 aumenta tamaño ~37%

/**
 * Calcula el tamaño aproximado de un string Base64 en bytes
 * @param {string} base64String - String en formato Base64 (data:image/...)
 * @returns {number} Tamaño en bytes
 */
function getBase64Size(base64String) {
  if (!base64String) return 0;
  // Remover el prefijo data:image/...;base64,
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  // Calcular tamaño: cada 4 caracteres Base64 = 3 bytes
  return Math.ceil((base64Data.length * 3) / 4);
}

// Validate signatures (Ministro)
router.post('/:id/validate', authenticate, requireRole('MINISTRO_FE', 'MUNICIPALIDAD'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    const { signatures, wizardData } = req.body;

    // ============ VALIDACIONES DE TAMAÑO ============
    // Validar tamaño de foto grupal
    if (wizardData?.groupPhoto) {
      const photoSize = getBase64Size(wizardData.groupPhoto);
      if (photoSize > MAX_GROUP_PHOTO_SIZE) {
        return res.status(400).json({
          error: 'Foto grupal demasiado grande',
          maxSize: `${MAX_GROUP_PHOTO_SIZE / 1024}KB`,
          actualSize: `${Math.round(photoSize / 1024)}KB`,
          hint: 'Reduzca la resolución o comprima la imagen antes de subir'
        });
      }
    }

    // Validar tamaño de firmas individuales
    if (signatures && Array.isArray(signatures)) {
      for (const sig of signatures) {
        if (sig.signature) {
          const sigSize = getBase64Size(sig.signature);
          if (sigSize > MAX_SIGNATURE_SIZE) {
            return res.status(400).json({
              error: `Firma de ${sig.memberName || 'miembro'} demasiado grande`,
              maxSize: `${MAX_SIGNATURE_SIZE / 1024}KB`,
              actualSize: `${Math.round(sigSize / 1024)}KB`
            });
          }
        }
      }
    }

    // DEBUG: Log what data arrives from frontend
    console.log('🔍 VALIDATE - wizardData received:', JSON.stringify(wizardData?.provisionalDirectorio, null, 2));
    console.log('🔍 VALIDATE - President name:', wizardData?.provisionalDirectorio?.president?.name);

    // Store group photo in S3 if available (largest blob, up to 2MB)
    if (wizardData?.groupPhoto && isS3Configured()) {
      try {
        const photoResult = await storeDocument(wizardData.groupPhoto, {
          organizationId: assignment.organizationId?.toString(),
          type: 'group_photo'
        });
        if (photoResult?.stored === 's3') {
          wizardData.groupPhoto = `s3:${photoResult.s3Key}`;
        }
      } catch (err) {
        console.warn('[validate] S3 group photo upload failed, keeping base64:', err.message);
      }
    }

    assignment.signaturesValidated = true;
    assignment.validatedAt = new Date();
    assignment.validatedBy = 'MINISTRO';
    assignment.signatures = signatures;
    assignment.wizardData = wizardData;
    assignment.status = 'completed'; // Cambiar estado a completado

    // Use transaction to atomically update Assignment + Organization
    await withTransactionFallback(async (session) => {
      const opts = session ? { session } : {};

      await assignment.save(opts);

      // Update organization status and save validation data
      if (assignment.organizationId) {
        // Generar números únicos de certificación y depósito
        const certNumber = await Counter.generateNumber('certificacion');
        const depositNumber = await Counter.generateNumber('deposito');

        const updateData = {
          status: 'ministro_approved',
          certNumber,
          depositNumber,
          $push: {
            statusHistory: {
              status: 'ministro_approved',
              date: new Date(),
              comment: 'Firmas validadas por Ministro de Fe'
            }
          }
        };

        // Copy wizard data to organization for PDF generation
        if (wizardData) {
          if (wizardData.provisionalDirectorio) {
            updateData.provisionalDirectorio = wizardData.provisionalDirectorio;
          }
          if (wizardData.comisionElectoral) {
            updateData.comisionElectoral = wizardData.comisionElectoral;
          }
          if (wizardData.attendees) {
            updateData.validatedAttendees = wizardData.attendees;
          }
          // Store validation metadata
          updateData.validationData = {
            validatedAt: new Date(),
            validatorId: wizardData.validatorId,
            validatorName: wizardData.validatorName,
            ministroSignature: wizardData.ministroSignature,
            signatures: signatures
          };
        }

        await Organization.findByIdAndUpdate(assignment.organizationId, updateData, opts);
      }
    });

    res.json(assignment);
  } catch (error) {
    console.error('Validate signatures error:', error);
    res.status(500).json({ error: 'Error al validar firmas' });
  }
});

// Reset validation (for editing)
// IMPORTANTE: También revierte el estado de la Organization a ministro_scheduled
router.post('/:id/reset-validation', authenticate, requireRole('MINISTRO_FE', 'MUNICIPALIDAD'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    // Save to history
    if (assignment.signaturesValidated) {
      if (!assignment.validationHistory) assignment.validationHistory = [];
      assignment.validationHistory.push({
        validatedAt: assignment.validatedAt,
        validatedBy: assignment.validatedBy,
        signatures: assignment.signatures,
        resetAt: new Date()
      });
    }

    assignment.signaturesValidated = false;
    assignment.validatedAt = null;
    assignment.validatedBy = null;
    assignment.signatures = [];
    assignment.status = 'pending'; // Volver a pending
    assignment.lastEditedAt = new Date();

    // Use transaction to atomically revert Assignment + Organization
    await withTransactionFallback(async (session) => {
      const opts = session ? { session } : {};

      await assignment.save(opts);

      // CRÍTICO: Revertir también el estado de la Organization
      if (assignment.organizationId) {
        const org = await Organization.findById(assignment.organizationId).session(session || null);
        if (org && org.status === 'ministro_approved') {
          org.status = 'ministro_scheduled';
          org.statusHistory.push({
            status: 'ministro_scheduled',
            date: new Date(),
            comment: 'Validación reseteada - requiere nueva validación de firmas'
          });
          // Limpiar datos de validación pero mantener directorio provisorio
          if (org.validationData) {
            org.validationData.validatedAt = null;
            org.validationData.signatures = null;
          }
          // Limpiar números de certificación (se regenerarán)
          org.certNumber = null;
          org.depositNumber = null;
          await org.save(opts);
        }
      }
    });

    res.json({
      assignment,
      message: 'Validación reseteada. La organización ha vuelto al estado ministro_scheduled.'
    });
  } catch (error) {
    console.error('Reset validation error:', error);
    res.status(500).json({ error: 'Error al resetear validación' });
  }
});

// Complete assignment
router.post('/:id/complete', authenticate, requireRole('MINISTRO_FE', 'MUNICIPALIDAD'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    assignment.status = 'completed';
    assignment.completedAt = new Date();

    await assignment.save();
    res.json(assignment);
  } catch (error) {
    console.error('Complete assignment error:', error);
    res.status(500).json({ error: 'Error al completar asignación' });
  }
});

// Cancel assignment
router.post('/:id/cancel', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    assignment.status = 'cancelled';
    assignment.cancelledAt = new Date();
    assignment.cancellationReason = req.body.reason;

    await assignment.save();
    res.json(assignment);
  } catch (error) {
    console.error('Cancel assignment error:', error);
    res.status(500).json({ error: 'Error al cancelar asignación' });
  }
});

// Check schedule conflict
router.get('/check-conflict/:ministroId/:date/:time', authenticate, async (req, res) => {
  try {
    const { ministroId, date, time } = req.params;

    const conflict = await Assignment.findOne({
      ministroId,
      scheduledDate: new Date(date),
      scheduledTime: time,
      status: { $ne: 'cancelled' }
    }).lean();

    // Also check MF blocks
    const dateStr = new Date(date).toISOString().split('T')[0];
    const activeBlocks = await MinistroBlock.find({
      ministroId,
      date: dateStr,
      active: true
    }).lean();

    const isBlocked = activeBlocks.some(b => {
      if (b.blockType === 'full_day') return true;
      if (b.time === time) return true;
      if (b.blockType === 'duration' && b.time && b.endTime) {
        return time >= b.time && time < b.endTime;
      }
      return false;
    });

    const blockReason = isBlocked ? (activeBlocks.find(b => b.reason)?.reason || '') : '';

    res.json({
      hasConflict: !!conflict || isBlocked,
      conflictType: conflict ? 'assignment' : isBlocked ? 'block' : null,
      blockReason
    });
  } catch (error) {
    console.error('Check conflict error:', error);
    res.status(500).json({ error: 'Error al verificar conflicto' });
  }
});

// Get statistics for ministro
router.get('/stats/:ministroId', authenticate, async (req, res) => {
  try {
    const ministroId = req.params.ministroId;

    const stats = await Assignment.aggregate([
      { $match: { ministroId: ministroId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      total: 0,
      pending: 0,
      completed: 0,
      cancelled: 0,
      signaturesValidated: 0
    };

    stats.forEach(s => {
      result[s._id] = s.count;
      result.total += s.count;
    });

    // Count validated
    result.signaturesValidated = await Assignment.countDocuments({
      ministroId,
      signaturesValidated: true
    });

    res.json(result);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Reject assembly (Ministro) — quorum not met or problems in terrain
router.post('/:id/reject-assembly', authenticate, requireRole('MINISTRO_FE', 'MUNICIPALIDAD'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Asignación no encontrada' });

    const { reason, attendanceCount, quorumRequired } = req.body;
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Debe indicar un motivo de rechazo (mínimo 10 caracteres)' });
    }

    assignment.status = 'completed';
    assignment.assemblyRejected = true;
    assignment.rejectionReason = reason.trim();
    assignment.attendanceCount = attendanceCount || 0;
    assignment.quorumRequired = quorumRequired || 15;
    assignment.quorumAchieved = false;
    assignment.completedAt = new Date();

    await assignment.save();

    // Update organization status to assembly_failed
    const organization = await Organization.findById(assignment.organizationId);
    if (organization) {
      organization.status = 'assembly_failed';
      organization.statusHistory.push({
        status: 'assembly_failed',
        date: new Date(),
        comment: `Asamblea rechazada por Ministro de Fe: ${reason.trim()}`
      });
      await organization.save();
    }

    res.json({ message: 'Asamblea rechazada', assignment });
  } catch (error) {
    console.error('Reject assembly error:', error);
    res.status(500).json({ error: 'Error al rechazar asamblea' });
  }
});

export default router;
