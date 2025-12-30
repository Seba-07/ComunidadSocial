import express from 'express';
import UnidadVecinal from '../models/UnidadVecinal.js';
import { authenticate, requireRole } from '../middleware/auth.js';

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
 * POST /api/unidades-vecinales
 * Crear una nueva unidad vecinal (solo admin)
 */
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { numero, idOficial, nombre, macrozona, poblaciones, calles, limites, palabrasClave, notas } = req.body;

    // Validar campos requeridos
    if (!numero || !idOficial) {
      return res.status(400).json({ error: 'El número e ID oficial son requeridos' });
    }

    // Verificar que no exista otra UV con el mismo número o idOficial
    const existente = await UnidadVecinal.findOne({
      $or: [{ numero }, { idOficial }]
    });

    if (existente) {
      return res.status(400).json({
        error: 'Ya existe una unidad vecinal con ese número o ID oficial'
      });
    }

    const nuevaUnidad = new UnidadVecinal({
      numero,
      idOficial,
      nombre: nombre || `Unidad Vecinal ${numero}`,
      macrozona: macrozona || 1,
      poblaciones: poblaciones || [],
      calles: calles || [],
      limites: limites || { norte: '', sur: '', oriente: '', poniente: '' },
      palabrasClave: palabrasClave || [],
      notas: notas || '',
      activa: true
    });

    await nuevaUnidad.save();
    res.status(201).json(nuevaUnidad);
  } catch (error) {
    console.error('Error al crear unidad vecinal:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Ya existe una unidad vecinal con ese número o ID' });
    }
    res.status(500).json({ error: 'Error al crear unidad vecinal' });
  }
});

/**
 * DELETE /api/unidades-vecinales/:id
 * Eliminar una unidad vecinal (solo admin)
 */
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const unidad = await UnidadVecinal.findById(req.params.id);

    if (!unidad) {
      return res.status(404).json({ error: 'Unidad vecinal no encontrada' });
    }

    // Verificar si hay organizaciones usando esta unidad vecinal
    const Organization = (await import('../models/Organization.js')).default;
    const orgCount = await Organization.countDocuments({ unidadVecinal: unidad.numero });

    if (orgCount > 0) {
      return res.status(400).json({
        error: `No se puede eliminar: hay ${orgCount} organización(es) asignada(s) a esta unidad vecinal`,
        organizacionesAsociadas: orgCount
      });
    }

    await UnidadVecinal.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Unidad vecinal eliminada correctamente', id: req.params.id });
  } catch (error) {
    console.error('Error al eliminar unidad vecinal:', error);
    res.status(500).json({ error: 'Error al eliminar unidad vecinal' });
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
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
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
router.post('/:id/poblaciones', authenticate, requireRole('admin'), async (req, res) => {
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
router.post('/:id/calles', authenticate, requireRole('admin'), async (req, res) => {
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
router.delete('/:id/poblaciones/:poblacion', authenticate, requireRole('admin'), async (req, res) => {
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
router.post('/seed', authenticate, requireRole('admin'), async (req, res) => {
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
