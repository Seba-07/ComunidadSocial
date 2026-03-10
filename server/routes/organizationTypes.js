import express from 'express';
import EstatutoTemplate, { TIPOS_ORGANIZACION_LIST } from '../models/EstatutoTemplate.js';

const router = express.Router();

/**
 * Obtiene todos los tipos: hardcoded + custom de templates publicados en BD
 */
async function getAllTypes() {
  const hardcoded = EstatutoTemplate.getTiposConNombres();

  // Obtener templates custom (tipos que no están en la lista hardcoded)
  const customTemplates = await EstatutoTemplate.find(
    { publicado: true, tipoOrganizacion: { $nin: Object.keys(hardcoded) } },
    'tipoOrganizacion nombreTipo categoria'
  ).lean();

  // Merge: hardcoded + custom
  const all = { ...hardcoded };
  for (const t of customTemplates) {
    all[t.tipoOrganizacion] = {
      nombre: t.nombreTipo,
      categoria: t.categoria || 'OTRO'
    };
  }

  return all;
}

/**
 * GET /api/organization-types
 * Obtener todos los tipos de organización (público)
 */
router.get('/', async (req, res) => {
  try {
    const tipos = await getAllTypes();

    const formattedTypes = Object.entries(tipos).map(([key, value]) => ({
      value: key,
      label: value.nombre,
      categoria: value.categoria
    }));

    res.json(formattedTypes);
  } catch (error) {
    console.error('Get organization types error:', error);
    res.status(500).json({ error: 'Error al obtener tipos de organización' });
  }
});

/**
 * GET /api/organization-types/grouped
 * Obtener tipos agrupados por categoría (público)
 */
router.get('/grouped', async (req, res) => {
  try {
    const tipos = await getAllTypes();
    const grouped = {};

    Object.entries(tipos).forEach(([key, value]) => {
      const cat = value.categoria;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ value: key, label: value.nombre });
    });

    res.json(grouped);
  } catch (error) {
    console.error('Get grouped types error:', error);
    res.status(500).json({ error: 'Error al obtener tipos agrupados' });
  }
});

/**
 * GET /api/organization-types/categories
 * Obtener lista de categorías disponibles (público)
 */
router.get('/categories', async (req, res) => {
  try {
    const tipos = await getAllTypes();
    const categories = [...new Set(Object.values(tipos).map(t => t.categoria))];

    const categoryLabels = {
      'TERRITORIAL': 'Organizaciones Territoriales',
      'FUNCIONAL': 'Organizaciones Funcionales',
      'SOCIAL': 'Social',
      'CULTURAL': 'Arte y Cultura',
      'EDUCACIONAL': 'Educacionales',
      'OTRO': 'Otros'
    };

    res.json(categories.map(cat => ({
      value: cat,
      label: categoryLabels[cat] || cat
    })));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

/**
 * GET /api/organization-types/:tipo
 * Obtener información de un tipo específico (público)
 */
router.get('/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    const tipos = await getAllTypes();

    if (!tipos[tipo]) {
      return res.status(404).json({ error: 'Tipo de organización no encontrado' });
    }

    // Intentar obtener plantilla si existe
    const template = await EstatutoTemplate.findOne({ tipoOrganizacion: tipo });

    // Get directorio cargos from template or defaults
    const defaultConfig = EstatutoTemplate.getDefaultConfig(tipo);
    const cargos = template?.directorio?.cargos?.length
      ? template.directorio.cargos
      : defaultConfig.directorio.cargos;

    res.json({
      value: tipo,
      label: tipos[tipo].nombre,
      categoria: tipos[tipo].categoria,
      hasTemplate: !!template,
      templatePublished: template?.publicado || false,
      cargos,
      directorio: template?.directorio || defaultConfig.directorio,
      miembrosMinimos: template?.miembrosMinimos || defaultConfig.miembrosMinimos,
      comisionElectoral: template?.comisionElectoral || defaultConfig.comisionElectoral
    });
  } catch (error) {
    console.error('Get type info error:', error);
    res.status(500).json({ error: 'Error al obtener información del tipo' });
  }
});

export default router;
