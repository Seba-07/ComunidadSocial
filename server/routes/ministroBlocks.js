import express from 'express';
import MinistroBlock from '../models/MinistroBlock.js';
import User from '../models/User.js';
import Assignment from '../models/Assignment.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * Helper: calcula endTime sumando horas a startTime
 * Si startTime='10:00' y durationHours=4, endTime='13:00' (bloquea 10,11,12,13)
 */
function calculateEndTime(startTime, durationHours) {
  const [h, m] = startTime.split(':').map(Number);
  const endH = h + durationHours - 1;
  return `${String(Math.min(endH, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Helper: verifica si una hora está dentro de un rango de bloqueo
 */
function isTimeInBlock(time, block) {
  if (!block.time) return true; // full_day bloquea todas las horas

  if (block.blockType === 'duration' && block.endTime) {
    return time >= block.time && time <= block.endTime;
  }

  return time === block.time;
}

// ==================== CRUD (Admin) ====================

// GET /api/ministro-blocks - Listar bloques activos
router.get('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const blocks = await MinistroBlock.find({ active: true })
      .sort({ date: -1, time: 1 })
      .lean();
    res.json(blocks);
  } catch (error) {
    console.error('Get ministro blocks error:', error);
    res.status(500).json({ error: 'Error al obtener bloqueos' });
  }
});

// GET /api/ministro-blocks/ministro/:ministroId - Bloques de un ministro
router.get('/ministro/:ministroId', authenticate, async (req, res) => {
  try {
    const blocks = await MinistroBlock.find({
      ministroId: req.params.ministroId,
      active: true
    })
      .sort({ date: -1, time: 1 })
      .lean();
    res.json(blocks);
  } catch (error) {
    console.error('Get ministro blocks error:', error);
    res.status(500).json({ error: 'Error al obtener bloqueos del ministro' });
  }
});

// POST /api/ministro-blocks - Crear bloque manual
router.post('/', authenticate, requireRole('MUNICIPALIDAD', 'MINISTRO_FE'), async (req, res) => {
  try {
    const { ministroId, ministroName, date, time, blockType, reason } = req.body;

    if (!ministroId || !ministroName || !date) {
      return res.status(400).json({ error: 'ministroId, ministroName y date son requeridos' });
    }

    // MINISTRO_FE solo puede crear bloques para sí mismo
    if (req.user.role === 'MINISTRO_FE' && ministroId !== req.userId) {
      return res.status(403).json({ error: 'Solo puedes crear bloques para tu propia disponibilidad' });
    }

    const type = blockType || (time ? 'manual' : 'full_day');

    const block = new MinistroBlock({
      ministroId,
      ministroName,
      date,
      time: time || null,
      endTime: null,
      blockType: type,
      reason: reason || '',
      createdBy: req.userId
    });

    await block.save();
    res.status(201).json(block);
  } catch (error) {
    console.error('Create ministro block error:', error);
    res.status(500).json({ error: 'Error al crear bloqueo' });
  }
});

// DELETE /api/ministro-blocks/:id - Desactivar bloque
router.delete('/:id', authenticate, requireRole('MUNICIPALIDAD', 'MINISTRO_FE'), async (req, res) => {
  try {
    const block = await MinistroBlock.findById(req.params.id);

    if (!block) {
      return res.status(404).json({ error: 'Bloqueo no encontrado' });
    }

    // MINISTRO_FE solo puede eliminar sus propios bloques
    if (req.user.role === 'MINISTRO_FE' && block.ministroId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Solo puedes eliminar tus propios bloques' });
    }

    block.active = false;
    await block.save();

    res.json({ message: 'Bloqueo desactivado', block });
  } catch (error) {
    console.error('Delete ministro block error:', error);
    res.status(500).json({ error: 'Error al desactivar bloqueo' });
  }
});

// ==================== Disponibilidad (PUBLIC) ====================

// GET /api/ministro-blocks/availability/date/:date - Disponibilidad por hora para una fecha
router.get('/availability/date/:date', async (req, res) => {
  try {
    const { date } = req.params;

    // 1. Obtener todos los ministros activos
    const ministros = await User.find({ role: 'MINISTRO_FE', active: true })
      .select('_id firstName lastName')
      .lean();
    const totalMinistros = ministros.length;

    // 2. Obtener bloques activos para la fecha
    const blocks = await MinistroBlock.find({ date, active: true }).lean();

    // 3. Obtener assignments activos para la fecha
    const dateStart = new Date(date + 'T00:00:00.000Z');
    const dateEnd = new Date(date + 'T23:59:59.999Z');
    const assignments = await Assignment.find({
      scheduledDate: { $gte: dateStart, $lte: dateEnd },
      status: { $ne: 'cancelled' }
    })
      .select('ministroId scheduledTime')
      .lean();

    // 4. Para cada hora, calcular disponibilidad
    const hours = [
      '09:00', '10:00', '11:00', '12:00',
      '14:00', '15:00', '16:00', '17:00', '18:00'
    ];

    const availability = {};

    for (const hour of hours) {
      const blockedMinistroIds = new Set();

      // Revisar bloques
      for (const block of blocks) {
        if (isTimeInBlock(hour, block)) {
          blockedMinistroIds.add(block.ministroId.toString());
        }
      }

      // Revisar assignments (cada assignment ocupa a un ministro)
      for (const assignment of assignments) {
        if (assignment.scheduledTime === hour) {
          blockedMinistroIds.add(assignment.ministroId.toString());
        }
      }

      const blocked = blockedMinistroIds.size;
      availability[hour] = {
        available: Math.max(0, totalMinistros - blocked),
        blocked
      };
    }

    res.json({
      date,
      totalMinistros,
      availability
    });
  } catch (error) {
    console.error('Get availability for date error:', error);
    res.status(500).json({ error: 'Error al obtener disponibilidad' });
  }
});

// GET /api/ministro-blocks/availability/month/:year/:month - Resumen mensual
router.get('/availability/month/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const paddedMonth = String(month).padStart(2, '0');
    const prefix = `${year}-${paddedMonth}`;

    // Total ministros activos
    const totalMinistros = await User.countDocuments({ role: 'MINISTRO_FE', active: true });

    // Bloques activos del mes
    const blocks = await MinistroBlock.find({
      date: { $regex: `^${prefix}` },
      active: true
    }).lean();

    // Assignments del mes
    const monthStart = new Date(`${year}-${paddedMonth}-01T00:00:00.000Z`);
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const monthEnd = new Date(`${year}-${paddedMonth}-${String(daysInMonth).padStart(2, '0')}T23:59:59.999Z`);

    const assignments = await Assignment.find({
      scheduledDate: { $gte: monthStart, $lte: monthEnd },
      status: { $ne: 'cancelled' }
    })
      .select('ministroId scheduledDate scheduledTime')
      .lean();

    // Agrupar bloques por día
    const blocksByDay = {};
    blocks.forEach(b => {
      if (!blocksByDay[b.date]) blocksByDay[b.date] = [];
      blocksByDay[b.date].push(b);
    });

    // Agrupar assignments por día
    const assignmentsByDay = {};
    assignments.forEach(a => {
      const d = new Date(a.scheduledDate);
      const dayKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      if (!assignmentsByDay[dayKey]) assignmentsByDay[dayKey] = [];
      assignmentsByDay[dayKey].push(a);
    });

    const hours = [
      '09:00', '10:00', '11:00', '12:00',
      '14:00', '15:00', '16:00', '17:00', '18:00'
    ];

    const days = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${paddedMonth}-${String(day).padStart(2, '0')}`;
      const dayBlocks = blocksByDay[dateKey] || [];
      const dayAssignments = assignmentsByDay[dateKey] || [];

      let availableHoursCount = 0;
      let partialHours = 0;
      const hourly = {};

      for (const hour of hours) {
        const blockedMinistroIds = new Set();

        for (const block of dayBlocks) {
          if (isTimeInBlock(hour, block)) {
            blockedMinistroIds.add(block.ministroId.toString());
          }
        }

        for (const assignment of dayAssignments) {
          if (assignment.scheduledTime === hour) {
            blockedMinistroIds.add(assignment.ministroId.toString());
          }
        }

        const available = Math.max(0, totalMinistros - blockedMinistroIds.size);
        hourly[hour] = available;

        if (available > 0) {
          availableHoursCount++;
          if (blockedMinistroIds.size > 0) {
            partialHours++;
          }
        }
      }

      days[dateKey] = {
        hasAvailability: availableHoursCount > 0,
        isPartial: partialHours > 0 && availableHoursCount < hours.length,
        hourly
      };
    }

    res.json({ days, totalMinistros });
  } catch (error) {
    console.error('Get monthly availability error:', error);
    res.status(500).json({ error: 'Error al obtener disponibilidad mensual' });
  }
});

// ==================== Crear bloque desde confirmación ====================

// POST /api/ministro-blocks/create-from-confirmation
router.post('/create-from-confirmation', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { assignmentId, ministroId, ministroName, date, startTime, durationHours, fullDay, reason } = req.body;

    if (!ministroId || !date) {
      return res.status(400).json({ error: 'ministroId y date son requeridos' });
    }

    // Si es fullDay, crear bloque de día completo
    if (fullDay) {
      // Desactivar bloques anteriores del mismo assignment si existe
      if (assignmentId) {
        await MinistroBlock.updateMany(
          { assignmentId, active: true },
          { active: false }
        );
      }

      const block = new MinistroBlock({
        ministroId,
        ministroName: ministroName || 'Ministro',
        date,
        time: null,
        endTime: null,
        blockType: 'full_day',
        reason: reason || '',
        assignmentId: assignmentId || null,
        createdBy: req.userId
      });

      await block.save();
      return res.status(201).json(block);
    }

    // Bloque con duración
    if (!startTime || !durationHours) {
      return res.status(400).json({ error: 'startTime y durationHours son requeridos para bloques con duración' });
    }

    // Desactivar bloques anteriores del mismo assignment si existe
    if (assignmentId) {
      await MinistroBlock.updateMany(
        { assignmentId, active: true },
        { active: false }
      );
    }

    const endTime = calculateEndTime(startTime, durationHours);

    const block = new MinistroBlock({
      ministroId,
      ministroName: ministroName || 'Ministro',
      date,
      time: startTime,
      endTime,
      blockType: 'duration',
      reason: reason || '',
      assignmentId: assignmentId || null,
      createdBy: req.userId
    });

    await block.save();
    res.status(201).json(block);
  } catch (error) {
    console.error('Create block from confirmation error:', error);
    res.status(500).json({ error: 'Error al crear bloqueo desde confirmación' });
  }
});

export default router;
