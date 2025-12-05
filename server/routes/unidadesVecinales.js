import express from 'express';
import UnidadVecinal from '../models/UnidadVecinal.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/unidades-vecinales
 * Obtener todas las unidades vecinales
 */
router.get('/', async (req, res) => {
  try {
    const { macrozona, activa } = req.query;

    const filter = {};
    if (macrozona) filter.macrozona = parseInt(macrozona);
    if (activa !== undefined) filter.activa = activa === 'true';

    const unidades = await UnidadVecinal.find(filter).sort({ numero: 1 });
    res.json(unidades);
  } catch (error) {
    console.error('Error al obtener unidades vecinales:', error);
    res.status(500).json({ error: 'Error al obtener unidades vecinales' });
  }
});

/**
 * GET /api/unidades-vecinales/buscar
 * Buscar unidad vecinal por dirección
 */
router.get('/buscar', async (req, res) => {
  try {
    const { direccion } = req.query;

    if (!direccion) {
      return res.status(400).json({ error: 'Se requiere una dirección para buscar' });
    }

    const unidadVecinal = await UnidadVecinal.buscarPorDireccion(direccion);

    if (!unidadVecinal) {
      return res.json({
        encontrada: false,
        mensaje: 'No se encontró una unidad vecinal para esta dirección',
        sugerencia: 'El administrador debe asignar la unidad vecinal manualmente'
      });
    }

    res.json({
      encontrada: true,
      unidadVecinal
    });
  } catch (error) {
    console.error('Error al buscar unidad vecinal:', error);
    res.status(500).json({ error: 'Error al buscar unidad vecinal' });
  }
});

/**
 * GET /api/unidades-vecinales/macrozonas
 * Obtener resumen de macrozonas
 */
router.get('/macrozonas', async (req, res) => {
  try {
    const macrozonas = await UnidadVecinal.aggregate([
      { $match: { activa: true } },
      {
        $group: {
          _id: '$macrozona',
          cantidad: { $sum: 1 },
          unidades: { $push: '$numero' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const resultado = macrozonas.map(m => ({
      macrozona: m._id,
      cantidad: m.cantidad,
      unidades: m.unidades.sort()
    }));

    res.json(resultado);
  } catch (error) {
    console.error('Error al obtener macrozonas:', error);
    res.status(500).json({ error: 'Error al obtener macrozonas' });
  }
});

/**
 * GET /api/unidades-vecinales/:id
 * Obtener una unidad vecinal por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const unidad = await UnidadVecinal.findById(req.params.id);
    if (!unidad) {
      return res.status(404).json({ error: 'Unidad vecinal no encontrada' });
    }
    res.json(unidad);
  } catch (error) {
    console.error('Error al obtener unidad vecinal:', error);
    res.status(500).json({ error: 'Error al obtener unidad vecinal' });
  }
});

/**
 * PUT /api/unidades-vecinales/:id
 * Actualizar una unidad vecinal (solo admin)
 */
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { poblaciones, calles, palabrasClave, limites, notas, macrozona, activa, nombre } = req.body;

    const updateData = {};
    if (poblaciones !== undefined) updateData.poblaciones = poblaciones;
    if (calles !== undefined) updateData.calles = calles;
    if (palabrasClave !== undefined) updateData.palabrasClave = palabrasClave;
    if (limites !== undefined) updateData.limites = limites;
    if (notas !== undefined) updateData.notas = notas;
    if (macrozona !== undefined) updateData.macrozona = macrozona;
    if (activa !== undefined) updateData.activa = activa;
    if (nombre !== undefined) updateData.nombre = nombre;

    const unidad = await UnidadVecinal.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!unidad) {
      return res.status(404).json({ error: 'Unidad vecinal no encontrada' });
    }

    res.json(unidad);
  } catch (error) {
    console.error('Error al actualizar unidad vecinal:', error);
    res.status(500).json({ error: 'Error al actualizar unidad vecinal' });
  }
});

/**
 * POST /api/unidades-vecinales/:id/poblaciones
 * Agregar poblaciones a una unidad vecinal (solo admin)
 */
router.post('/:id/poblaciones', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { poblaciones } = req.body;

    if (!Array.isArray(poblaciones)) {
      return res.status(400).json({ error: 'Las poblaciones deben ser un array' });
    }

    const unidad = await UnidadVecinal.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { poblaciones: { $each: poblaciones } } },
      { new: true }
    );

    if (!unidad) {
      return res.status(404).json({ error: 'Unidad vecinal no encontrada' });
    }

    res.json(unidad);
  } catch (error) {
    console.error('Error al agregar poblaciones:', error);
    res.status(500).json({ error: 'Error al agregar poblaciones' });
  }
});

/**
 * POST /api/unidades-vecinales/:id/calles
 * Agregar calles a una unidad vecinal (solo admin)
 */
router.post('/:id/calles', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { calles } = req.body;

    if (!Array.isArray(calles)) {
      return res.status(400).json({ error: 'Las calles deben ser un array' });
    }

    const unidad = await UnidadVecinal.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { calles: { $each: calles } } },
      { new: true }
    );

    if (!unidad) {
      return res.status(404).json({ error: 'Unidad vecinal no encontrada' });
    }

    res.json(unidad);
  } catch (error) {
    console.error('Error al agregar calles:', error);
    res.status(500).json({ error: 'Error al agregar calles' });
  }
});

/**
 * DELETE /api/unidades-vecinales/:id/poblaciones/:poblacion
 * Eliminar una población de una unidad vecinal (solo admin)
 */
router.delete('/:id/poblaciones/:poblacion', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const poblacion = decodeURIComponent(req.params.poblacion);

    const unidad = await UnidadVecinal.findByIdAndUpdate(
      req.params.id,
      { $pull: { poblaciones: poblacion } },
      { new: true }
    );

    if (!unidad) {
      return res.status(404).json({ error: 'Unidad vecinal no encontrada' });
    }

    res.json(unidad);
  } catch (error) {
    console.error('Error al eliminar población:', error);
    res.status(500).json({ error: 'Error al eliminar población' });
  }
});

/**
 * POST /api/unidades-vecinales/seed
 * Ejecutar seed de unidades vecinales (solo admin)
 */
router.post('/seed', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { seedUnidadesVecinales } = await import('../scripts/seedUnidadesVecinales.js');
    await seedUnidadesVecinales();
    res.json({ mensaje: 'Seed ejecutado correctamente' });
  } catch (error) {
    console.error('Error al ejecutar seed:', error);
    res.status(500).json({ error: 'Error al ejecutar seed' });
  }
});

export default router;
