import express from 'express';
import Assignment from '../models/Assignment.js';
import Organization from '../models/Organization.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all assignments (Admin only)
router.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const assignments = await Assignment.find()
      .populate('organizationId', 'organizationName')
      .sort({ scheduledDate: -1 });
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
    if (req.params.ministroId !== req.userId.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const assignments = await Assignment.find({ ministroId: req.params.ministroId })
      .populate('organizationId', 'organizationName organizationType address comuna region contactEmail contactPhone members electoralCommission provisionalDirectorio')
      .sort({ scheduledDate: -1 });
    res.json(assignments);
  } catch (error) {
    console.error('Get ministro assignments error:', error);
    res.status(500).json({ error: 'Error al obtener asignaciones' });
  }
});

// Get pending assignments for current ministro
router.get('/my/pending', authenticate, requireRole('MINISTRO'), async (req, res) => {
  try {
    const assignments = await Assignment.find({
      ministroId: req.userId,
      status: 'pending'
    })
      .populate('organizationId', 'organizationName organizationType address comuna region contactEmail contactPhone members electoralCommission provisionalDirectorio estatutos')
      .sort({ scheduledDate: 1 });
    res.json(assignments);
  } catch (error) {
    console.error('Get pending assignments error:', error);
    res.status(500).json({ error: 'Error al obtener asignaciones pendientes' });
  }
});

// Get assignment by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('organizationId', 'organizationName organizationType address comuna region contactEmail contactPhone members electoralCommission provisionalDirectorio estatutos');

    if (!assignment) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    res.json(assignment);
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({ error: 'Error al obtener asignación' });
  }
});

// Create assignment (Admin only)
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
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

    // Check for schedule conflict
    const conflict = await Assignment.findOne({
      ministroId,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      status: { $ne: 'cancelled' }
    });

    if (conflict) {
      return res.status(400).json({
        error: 'El ministro ya tiene una asignación en ese horario'
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

    Object.assign(assignment, req.body);
    await assignment.save();

    res.json(assignment);
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ error: 'Error al actualizar asignación' });
  }
});

// Validate signatures (Ministro)
router.post('/:id/validate', authenticate, requireRole('MINISTRO', 'ADMIN'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    const { signatures, wizardData } = req.body;

    // DEBUG: Log what data arrives from frontend
    console.log('🔍 VALIDATE - wizardData received:', JSON.stringify(wizardData?.provisionalDirectorio, null, 2));
    console.log('🔍 VALIDATE - President name:', wizardData?.provisionalDirectorio?.president?.name);

    assignment.signaturesValidated = true;
    assignment.validatedAt = new Date();
    assignment.validatedBy = 'MINISTRO';
    assignment.signatures = signatures;
    assignment.wizardData = wizardData;

    await assignment.save();

    // Update organization status and save validation data
    if (assignment.organizationId) {
      const updateData = {
        status: 'ministro_approved',
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

      await Organization.findByIdAndUpdate(assignment.organizationId, updateData);
    }

    res.json(assignment);
  } catch (error) {
    console.error('Validate signatures error:', error);
    res.status(500).json({ error: 'Error al validar firmas' });
  }
});

// Reset validation (for editing)
router.post('/:id/reset-validation', authenticate, requireRole('MINISTRO', 'ADMIN'), async (req, res) => {
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
    assignment.lastEditedAt = new Date();

    await assignment.save();
    res.json(assignment);
  } catch (error) {
    console.error('Reset validation error:', error);
    res.status(500).json({ error: 'Error al resetear validación' });
  }
});

// Complete assignment
router.post('/:id/complete', authenticate, requireRole('MINISTRO', 'ADMIN'), async (req, res) => {
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
router.post('/:id/cancel', authenticate, requireRole('ADMIN'), async (req, res) => {
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
    });

    res.json({ hasConflict: !!conflict });
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

export default router;
