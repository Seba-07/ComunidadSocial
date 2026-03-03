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
 * Buscar UV por dirección: geocoding Nominatim → punto-en-polígono → fallback texto
 */
router.get('/buscar', async (req, res) => {
  try {
    const { direccion } = req.query;

    if (!direccion) {
      return res.status(400).json({ error: 'Se requiere una dirección para buscar' });
    }

    // Step 1: Try geocoding with Nominatim
    // Clean address: remove "bodega X", "depto X", "oficina X", postal codes, region text
    let coords = null;
    try {
      let cleanAddr = direccion
        .replace(/,?\s*(bodega|depto|dpto|oficina|of\.|local|piso|block|torre)\s*\d*\w*/gi, '')
        .replace(/\b\d{7}\b/g, '')  // Remove 7-digit postal codes
        .replace(/,?\s*Región\s+Metropolitana\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Try full address first
      let results = [];
      const tryGeocode = async (q) => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=cl`;
        const resp = await fetch(url, { headers: { 'User-Agent': 'ComunidadSocialRenca/1.0' } });
        return resp.json();
      };

      results = await tryGeocode(`${cleanAddr}, Renca, Santiago, Chile`);

      // If no result, try without "Avenida/Calle/Pasaje" prefix
      if (results.length === 0) {
        const simplified = cleanAddr.replace(/^(avenida|av\.|calle|pasaje|psje\.|pje\.)\s+/i, '');
        results = await tryGeocode(`${simplified}, Renca, Chile`);
      }

      if (results.length > 0) {
        coords = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
      }
    } catch (err) {
      console.warn('Nominatim geocoding failed:', err.message);
    }

    // Step 2: Search (geo first, then text fallback)
    const unidadVecinal = await UnidadVecinal.buscarPorDireccion(direccion, coords);

    if (!unidadVecinal) {
      return res.json({
        encontrada: false,
        coords,
        mensaje: 'No se encontró una unidad vecinal para esta dirección',
        sugerencia: 'El administrador debe asignar la unidad vecinal manualmente'
      });
    }

    res.json({ encontrada: true, unidadVecinal, coords });
  } catch (error) {
    console.error('Error al buscar unidad vecinal:', error);
    res.status(500).json({ error: 'Error al buscar unidad vecinal' });
  }
});

/**
 * GET /api/unidades-vecinales/geojson
 * All UVs as GeoJSON FeatureCollection (for map display)
 */
router.get('/geojson', async (req, res) => {
  try {
    const uvs = await UnidadVecinal.find({ activa: true }).lean();
    const features = uvs.filter(uv => uv.geometry?.coordinates).map(uv => ({
      type: 'Feature',
      properties: {
        _id: uv._id,
        numero: uv.numero,
        nombre: uv.nombre,
        macrozona: uv.macrozona,
        poblaciones: uv.poblaciones
      },
      geometry: uv.geometry
    }));
    res.json({ type: 'FeatureCollection', features });
  } catch (error) {
    console.error('Error generating GeoJSON:', error);
    res.status(500).json({ error: 'Error al generar GeoJSON' });
  }
});

/**
 * GET /api/unidades-vecinales/geocode?address=
 * Proxy to Nominatim geocoding (avoids CORS issues from frontend)
 */
router.get('/geocode', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'Address required' });

    const cleanAddr = address
      .replace(/,?\s*(bodega|depto|dpto|oficina|of\.|local|piso|block|torre)\s*\d*\w*/gi, '')
      .replace(/\b\d{7}\b/g, '')
      .replace(/,?\s*Región\s+Metropolitana\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const tryGeocode = async (q) => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=cl`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'ComunidadSocialRenca/1.0' } });
      return resp.json();
    };

    let results = await tryGeocode(`${cleanAddr}, Renca, Santiago, Chile`);
    if (results.length === 0) {
      const simplified = cleanAddr.replace(/^(avenida|av\.|calle|pasaje|psje\.|pje\.)\s+/i, '');
      results = await tryGeocode(`${simplified}, Renca, Chile`);
    }

    if (results.length === 0) {
      return res.json({ found: false });
    }

    res.json({
      found: true,
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
      displayName: results[0].display_name
    });
  } catch (error) {
    console.error('Geocode error:', error);
    res.status(500).json({ error: 'Error al geocodificar' });
  }
});

/**
 * GET /api/unidades-vecinales/find-by-point?lat=&lng=
 * Find UV containing a geographic point
 */
router.get('/find-by-point', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const uv = await UnidadVecinal.findByPoint(parseFloat(lng), parseFloat(lat));
    if (!uv) return res.json({ encontrada: false });

    res.json({ encontrada: true, unidadVecinal: uv });
  } catch (error) {
    console.error('Find by point error:', error);
    res.status(500).json({ error: 'Error al buscar por punto' });
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
router.post('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { numero, idOficial, nombre, macrozona, poblaciones, calles, limites, palabrasClave, notas, geometry } = req.body;

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

    // Clean geometry coordinates if present
    let cleanGeometry = null;
    if (geometry && geometry.type === 'Polygon' && geometry.coordinates) {
      const cleanCoords = geometry.coordinates.map(ring =>
        (Array.isArray(ring) ? ring : Object.values(ring)).map(point =>
          Array.isArray(point) ? point.map(Number) : Object.values(point).map(Number)
        )
      );
      cleanGeometry = { type: 'Polygon', coordinates: cleanCoords };
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
      activa: true,
      geometry: cleanGeometry
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
router.delete('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
router.put('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { poblaciones, calles, palabrasClave, limites, notas, macrozona, activa, nombre, geometry } = req.body;

    const updateData = {};
    if (poblaciones !== undefined) updateData.poblaciones = poblaciones;
    if (calles !== undefined) updateData.calles = calles;
    if (palabrasClave !== undefined) updateData.palabrasClave = palabrasClave;
    if (limites !== undefined) updateData.limites = limites;
    if (notas !== undefined) updateData.notas = notas;
    if (macrozona !== undefined) updateData.macrozona = macrozona;
    if (activa !== undefined) updateData.activa = activa;
    if (nombre !== undefined) updateData.nombre = nombre;
    if (geometry !== undefined) {
      if (geometry && geometry.type === 'Polygon' && geometry.coordinates) {
        // Ensure coordinates are clean arrays (Mongoose Mixed can convert to objects)
        const cleanCoords = geometry.coordinates.map(ring =>
          (Array.isArray(ring) ? ring : Object.values(ring)).map(point =>
            Array.isArray(point) ? point.map(Number) : Object.values(point).map(Number)
          )
        );
        updateData.geometry = { type: 'Polygon', coordinates: cleanCoords };
      } else {
        updateData.geometry = null;
      }
    }

    const unidad = await UnidadVecinal.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!unidad) {
      return res.status(404).json({ error: 'Unidad vecinal no encontrada' });
    }

    res.json(unidad);
  } catch (error) {
    console.error('Error al actualizar unidad vecinal:', error.message, error.code);
    // If 2dsphere index error, try dropping and retrying
    if (error.code === 16755 || error.message?.includes('2dsphere')) {
      try {
        await UnidadVecinal.collection.dropIndex('geometry_2dsphere');
        const unidad = await UnidadVecinal.findByIdAndUpdate(req.params.id, updateData, { new: true });
        return res.json(unidad);
      } catch (retryErr) {
        console.error('Retry failed:', retryErr.message);
      }
    }
    res.status(500).json({ error: 'Error al actualizar unidad vecinal: ' + error.message });
  }
});

/**
 * POST /api/unidades-vecinales/:id/poblaciones
 * Agregar poblaciones a una unidad vecinal (solo admin)
 */
router.post('/:id/poblaciones', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
router.post('/:id/calles', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
router.delete('/:id/poblaciones/:poblacion', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
router.post('/seed', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
