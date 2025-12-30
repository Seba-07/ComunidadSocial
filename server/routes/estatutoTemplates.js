import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import EstatutoTemplate from '../models/EstatutoTemplate.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Crear directorio para uploads si no existe
const uploadDir = './uploads/estatutos';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurar multer para imágenes de header/footer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Use JPEG, PNG, GIF o WebP.'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ============ RUTAS PÚBLICAS (para wizard) ============

// GET /api/estatuto-templates/tipos - Lista tipos disponibles con plantilla publicada
router.get('/tipos', async (req, res) => {
  try {
    const templates = await EstatutoTemplate.find({ activo: true, publicado: true })
      .select('tipoOrganizacion nombreTipo descripcion categoria');
    res.json(templates);
  } catch (error) {
    console.error('Error al obtener tipos:', error);
    res.status(500).json({ error: 'Error al obtener tipos de estatutos' });
  }
});

// GET /api/estatuto-templates/tipos-nombres - Lista todos los tipos con nombres legibles
router.get('/tipos-nombres', async (req, res) => {
  try {
    const tipos = EstatutoTemplate.getTiposConNombres();
    res.json(tipos);
  } catch (error) {
    console.error('Error al obtener tipos:', error);
    res.status(500).json({ error: 'Error al obtener tipos' });
  }
});

// GET /api/estatuto-templates/:tipo/config - Obtener configuración para wizard
router.get('/:tipo/config', async (req, res) => {
  try {
    const template = await EstatutoTemplate.findOne({
      tipoOrganizacion: req.params.tipo,
      activo: true,
      publicado: true
    }).select('tipoOrganizacion nombreTipo directorio miembrosMinimos comisionElectoral placeholders');

    if (!template) {
      // Devolver configuración DEFAULT si no existe plantilla
      const defaultConfig = EstatutoTemplate.getDefaultConfig(req.params.tipo);
      return res.json(defaultConfig);
    }

    res.json(template);
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// GET /api/estatuto-templates/:tipo/snapshot - Obtener snapshot completo para guardar en org
router.get('/:tipo/snapshot', authenticate, async (req, res) => {
  try {
    const template = await EstatutoTemplate.findOne({
      tipoOrganizacion: req.params.tipo,
      activo: true,
      publicado: true
    });

    if (!template) {
      // Devolver configuración default como snapshot
      const defaultConfig = EstatutoTemplate.getDefaultConfig(req.params.tipo);
      return res.json({
        ...defaultConfig,
        templateId: null,
        version: 0,
        fechaSnapshot: new Date()
      });
    }

    // Devolver snapshot completo
    res.json(template.obtenerSnapshot());
  } catch (error) {
    console.error('Error al obtener snapshot:', error);
    res.status(500).json({ error: 'Error al obtener snapshot' });
  }
});

// ============ RUTAS ADMIN (MUNICIPALIDAD) ============

// GET /api/estatuto-templates - Listar todas las plantillas (admin)
router.get('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const templates = await EstatutoTemplate.find()
      .populate('creadoPor', 'firstName lastName email')
      .populate('modificadoPor', 'firstName lastName email')
      .sort({ categoria: 1, tipoOrganizacion: 1 });

    // También obtener todos los tipos para saber cuáles faltan
    const tiposConNombres = EstatutoTemplate.getTiposConNombres();

    res.json({
      templates,
      tiposDisponibles: tiposConNombres
    });
  } catch (error) {
    console.error('Error al obtener plantillas:', error);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

// GET /api/estatuto-templates/id/:id - Obtener plantilla completa por ID
router.get('/id/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const template = await EstatutoTemplate.findById(req.params.id)
      .populate('creadoPor', 'firstName lastName email')
      .populate('modificadoPor', 'firstName lastName email')
      .populate('historialVersiones.modificadoPor', 'firstName lastName');

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }
    res.json(template);
  } catch (error) {
    console.error('Error al obtener plantilla:', error);
    res.status(500).json({ error: 'Error al obtener plantilla' });
  }
});

// POST /api/estatuto-templates - Crear nueva plantilla
router.post('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const {
      tipoOrganizacion,
      nombreTipo,
      descripcion,
      categoria,
      articulos,
      directorio,
      miembrosMinimos,
      comisionElectoral,
      placeholders
    } = req.body;

    // Verificar que no existe
    const existing = await EstatutoTemplate.findOne({ tipoOrganizacion });
    if (existing) {
      return res.status(400).json({ error: 'Ya existe una plantilla para este tipo de organización' });
    }

    // Obtener nombre del tipo si no se proporciona
    const tiposConNombres = EstatutoTemplate.getTiposConNombres();
    const tipoInfo = tiposConNombres[tipoOrganizacion];

    const template = new EstatutoTemplate({
      tipoOrganizacion,
      nombreTipo: nombreTipo || tipoInfo?.nombre || tipoOrganizacion,
      descripcion: descripcion || '',
      categoria: categoria || tipoInfo?.categoria || 'FUNCIONAL',
      articulos: articulos || [],
      directorio: directorio || EstatutoTemplate.getDefaultConfig(tipoOrganizacion).directorio,
      miembrosMinimos: miembrosMinimos || 15,
      comisionElectoral: comisionElectoral || { cantidad: 3 },
      placeholders: placeholders || [],
      creadoPor: req.user._id,
      modificadoPor: req.user._id
    });

    // Generar documento completo si hay artículos
    if (template.articulos.length > 0) {
      template.documentoCompleto = template.generarDocumentoCompleto();
    }

    await template.save();
    res.status(201).json(template);
  } catch (error) {
    console.error('Error al crear plantilla:', error);
    res.status(500).json({ error: 'Error al crear plantilla: ' + error.message });
  }
});

// PUT /api/estatuto-templates/:id - Actualizar plantilla
router.put('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const template = await EstatutoTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const {
      nombreTipo,
      descripcion,
      categoria,
      articulos,
      directorio,
      miembrosMinimos,
      comisionElectoral,
      placeholders,
      publicado,
      descripcionCambio
    } = req.body;

    // Crear versión antes de modificar (si hay cambios significativos)
    const hasSignificantChanges = articulos || directorio || miembrosMinimos || comisionElectoral;
    if (hasSignificantChanges) {
      template.crearVersion(req.user._id, descripcionCambio || 'Actualización de plantilla');
    }

    // Actualizar campos
    if (nombreTipo !== undefined) template.nombreTipo = nombreTipo;
    if (descripcion !== undefined) template.descripcion = descripcion;
    if (categoria !== undefined) template.categoria = categoria;
    if (articulos !== undefined) template.articulos = articulos;
    if (directorio !== undefined) template.directorio = directorio;
    if (miembrosMinimos !== undefined) template.miembrosMinimos = miembrosMinimos;
    if (comisionElectoral !== undefined) template.comisionElectoral = comisionElectoral;
    if (placeholders !== undefined) template.placeholders = placeholders;
    if (publicado !== undefined) template.publicado = publicado;

    template.modificadoPor = req.user._id;

    // Regenerar documento completo
    if (template.articulos.length > 0) {
      template.documentoCompleto = template.generarDocumentoCompleto();
    }

    await template.save();

    // Populate para la respuesta
    await template.populate('creadoPor', 'firstName lastName email');
    await template.populate('modificadoPor', 'firstName lastName email');

    res.json(template);
  } catch (error) {
    console.error('Error al actualizar plantilla:', error);
    res.status(500).json({ error: 'Error al actualizar plantilla: ' + error.message });
  }
});

// DELETE /api/estatuto-templates/:id - Eliminar plantilla (soft delete)
router.delete('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const template = await EstatutoTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    // Soft delete
    template.activo = false;
    template.publicado = false;
    template.modificadoPor = req.user._id;
    await template.save();

    res.json({ message: 'Plantilla eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar plantilla:', error);
    res.status(500).json({ error: 'Error al eliminar plantilla' });
  }
});

// POST /api/estatuto-templates/:id/imagen - Subir imagen header/footer
router.post('/:id/imagen', authenticate, requireRole('MUNICIPALIDAD'), upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó imagen' });
    }

    const template = await EstatutoTemplate.findById(req.params.id);
    if (!template) {
      // Eliminar archivo subido
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const { tipo, width, height, alignment } = req.body;

    if (!tipo || !['header', 'footer'].includes(tipo)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Tipo de imagen inválido. Use "header" o "footer"' });
    }

    // Eliminar imagen anterior del mismo tipo si existe
    const existingIndex = template.imagenesDocumento.findIndex(img => img.tipo === tipo);
    if (existingIndex !== -1) {
      const oldImg = template.imagenesDocumento[existingIndex];
      try {
        const oldPath = `.${oldImg.url}`;
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      } catch (e) {
        console.warn('No se pudo eliminar imagen anterior:', e.message);
      }
      template.imagenesDocumento.splice(existingIndex, 1);
    }

    // Agregar nueva imagen
    template.imagenesDocumento.push({
      tipo,
      url: `/uploads/estatutos/${req.file.filename}`,
      fileName: req.file.originalname,
      width: width ? parseInt(width) : null,
      height: height ? parseInt(height) : null,
      alignment: alignment || 'center'
    });

    template.modificadoPor = req.user._id;
    await template.save();

    res.json(template);
  } catch (error) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    console.error('Error al subir imagen:', error);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});

// DELETE /api/estatuto-templates/:id/imagen/:tipo - Eliminar imagen
router.delete('/:id/imagen/:tipo', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const template = await EstatutoTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const imgIndex = template.imagenesDocumento.findIndex(img => img.tipo === req.params.tipo);
    if (imgIndex !== -1) {
      const img = template.imagenesDocumento[imgIndex];
      try {
        const imgPath = `.${img.url}`;
        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      } catch (e) {
        console.warn('No se pudo eliminar archivo de imagen:', e.message);
      }
      template.imagenesDocumento.splice(imgIndex, 1);
      template.modificadoPor = req.user._id;
      await template.save();
    }

    res.json(template);
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    res.status(500).json({ error: 'Error al eliminar imagen' });
  }
});

// GET /api/estatuto-templates/:id/historial - Obtener historial de versiones
router.get('/:id/historial', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const template = await EstatutoTemplate.findById(req.params.id)
      .select('historialVersiones version tipoOrganizacion nombreTipo')
      .populate('historialVersiones.modificadoPor', 'firstName lastName');

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    res.json({
      tipoOrganizacion: template.tipoOrganizacion,
      nombreTipo: template.nombreTipo,
      versionActual: template.version,
      historial: template.historialVersiones.sort((a, b) => b.version - a.version)
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// POST /api/estatuto-templates/:id/restaurar/:version - Restaurar versión anterior
router.post('/:id/restaurar/:version', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const template = await EstatutoTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const versionToRestore = template.historialVersiones.find(
      h => h.version === parseInt(req.params.version)
    );

    if (!versionToRestore || !versionToRestore.snapshot) {
      return res.status(404).json({ error: 'Versión no encontrada o sin snapshot' });
    }

    // Crear versión del estado actual antes de restaurar
    template.crearVersion(req.user._id, `Restauración a versión ${req.params.version}`);

    // Restaurar desde snapshot
    const snapshot = versionToRestore.snapshot;
    if (snapshot.articulos) template.articulos = snapshot.articulos;
    if (snapshot.directorio) template.directorio = snapshot.directorio;
    if (snapshot.miembrosMinimos) template.miembrosMinimos = snapshot.miembrosMinimos;
    if (snapshot.comisionElectoral) template.comisionElectoral = snapshot.comisionElectoral;
    if (snapshot.placeholders) template.placeholders = snapshot.placeholders;
    if (snapshot.imagenesDocumento) template.imagenesDocumento = snapshot.imagenesDocumento;
    if (snapshot.documentoCompleto) template.documentoCompleto = snapshot.documentoCompleto;

    template.modificadoPor = req.user._id;
    await template.save();

    res.json(template);
  } catch (error) {
    console.error('Error al restaurar versión:', error);
    res.status(500).json({ error: 'Error al restaurar versión' });
  }
});

// POST /api/estatuto-templates/:id/publicar - Publicar/Despublicar plantilla
router.post('/:id/publicar', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const template = await EstatutoTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    template.publicado = !template.publicado;
    template.modificadoPor = req.user._id;
    await template.save();

    res.json({
      publicado: template.publicado,
      message: template.publicado ? 'Plantilla publicada' : 'Plantilla despublicada'
    });
  } catch (error) {
    console.error('Error al cambiar estado de publicación:', error);
    res.status(500).json({ error: 'Error al cambiar estado de publicación' });
  }
});

// POST /api/estatuto-templates/:id/duplicar - Duplicar plantilla para otro tipo
router.post('/:id/duplicar', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { nuevoTipo } = req.body;
    if (!nuevoTipo) {
      return res.status(400).json({ error: 'Debe especificar el nuevo tipo de organización' });
    }

    // Verificar que no existe plantilla para el nuevo tipo
    const existing = await EstatutoTemplate.findOne({ tipoOrganizacion: nuevoTipo, activo: true });
    if (existing) {
      return res.status(400).json({ error: 'Ya existe una plantilla para este tipo' });
    }

    const template = await EstatutoTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla origen no encontrada' });
    }

    // Obtener nombre del nuevo tipo
    const tiposConNombres = EstatutoTemplate.getTiposConNombres();
    const nuevoTipoInfo = tiposConNombres[nuevoTipo];

    // Crear nueva plantilla
    const nuevaPlantilla = new EstatutoTemplate({
      tipoOrganizacion: nuevoTipo,
      nombreTipo: nuevoTipoInfo?.nombre || nuevoTipo,
      descripcion: `Basado en ${template.nombreTipo}`,
      categoria: nuevoTipoInfo?.categoria || template.categoria,
      articulos: template.articulos,
      directorio: template.directorio,
      miembrosMinimos: template.miembrosMinimos,
      comisionElectoral: template.comisionElectoral,
      placeholders: template.placeholders,
      // No copiar imágenes (deberán subirse nuevas)
      imagenesDocumento: [],
      publicado: false,
      creadoPor: req.user._id,
      modificadoPor: req.user._id
    });

    if (nuevaPlantilla.articulos.length > 0) {
      nuevaPlantilla.documentoCompleto = nuevaPlantilla.generarDocumentoCompleto();
    }

    await nuevaPlantilla.save();
    res.status(201).json(nuevaPlantilla);
  } catch (error) {
    console.error('Error al duplicar plantilla:', error);
    res.status(500).json({ error: 'Error al duplicar plantilla' });
  }
});

export default router;
