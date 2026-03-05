/**
 * Rutas CRUD para DocumentTemplate (Plantillas de Documentos PDF)
 */

import express from 'express';
import multer from 'multer';
import DocumentTemplate, { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, AVAILABLE_PLACEHOLDERS } from '../models/DocumentTemplate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as storageService from '../services/storageService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
  limits: { fileSize: 2 * 1024 * 1024 }
});

const router = express.Router();

/** Resolve presigned S3 URLs for header/footer images */
async function resolveImageUrls(templateObj) {
  const obj = typeof templateObj.toObject === 'function' ? templateObj.toObject() : { ...templateObj };
  if (obj.headerConfig?.imageS3Key) {
    obj.headerConfig.imageUrl = await storageService.getDocumentUrl({ s3Key: obj.headerConfig.imageS3Key });
  }
  if (obj.footerConfig?.imageS3Key) {
    obj.footerConfig.imageUrl = await storageService.getDocumentUrl({ s3Key: obj.footerConfig.imageS3Key });
  }
  return obj;
}

// ============================================
// RUTAS PÚBLICAS (para wizard)
// ============================================

/**
 * GET /by-type/:type - Obtener plantillas activas por tipo de documento
 * Público - usado por el wizard para cargar plantillas asignadas
 */
router.get('/by-type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    if (!DOCUMENT_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Tipo de documento inválido' });
    }
    const templates = await DocumentTemplate.find({ documentType: type, activo: true })
      .select('name documentType isDefault')
      .sort({ isDefault: -1, name: 1 });
    res.json({ templates });
  } catch (error) {
    console.error('Error fetching templates by type:', error);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

/**
 * GET /placeholders - Listar todos los placeholders disponibles
 */
router.get('/placeholders', (req, res) => {
  res.json({
    placeholders: AVAILABLE_PLACEHOLDERS,
    types: DOCUMENT_TYPE_LABELS
  });
});

/**
 * GET /public/:id - Obtener contenido de una plantilla (para wizard)
 */
router.get('/public/:id', async (req, res) => {
  try {
    const template = await DocumentTemplate.findOne({ _id: req.params.id, activo: true });
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }
    const resolved = await resolveImageUrls(template);
    res.json({ template: resolved });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Error al obtener plantilla' });
  }
});

// ============================================
// RUTAS ADMIN (requiere MUNICIPALIDAD)
// ============================================

/**
 * GET / - Listar todas las plantillas (admin)
 */
router.get('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const templates = await DocumentTemplate.find()
      .sort({ documentType: 1, isDefault: -1, name: 1 });
    res.json({ templates });
  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({ error: 'Error al listar plantillas' });
  }
});

/**
 * GET /:id - Obtener una plantilla por ID (admin)
 */
router.get('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const template = await DocumentTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }
    const resolved = await resolveImageUrls(template);
    res.json({ template: resolved });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Error al obtener plantilla' });
  }
});

/**
 * POST / - Crear nueva plantilla (admin)
 */
router.post('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { name, documentType, content, isDefault, pageSize } = req.body;

    if (!name || !documentType) {
      return res.status(400).json({ error: 'Nombre y tipo de documento son requeridos' });
    }
    if (!DOCUMENT_TYPES.includes(documentType)) {
      return res.status(400).json({ error: 'Tipo de documento inválido' });
    }

    const template = new DocumentTemplate({
      name,
      pageSize: pageSize || 'letter',
      documentType,
      content: content || '',
      isDefault: isDefault || false,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await template.save();
    res.status(201).json({ template, message: 'Plantilla creada exitosamente' });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Error al crear plantilla' });
  }
});

/**
 * PUT /:id - Actualizar plantilla (admin)
 */
router.put('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { name, documentType, content, isDefault, activo, pageSize, headerConfig, footerConfig } = req.body;

    const template = await DocumentTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    if (name !== undefined) template.name = name;
    if (documentType !== undefined) {
      if (!DOCUMENT_TYPES.includes(documentType)) {
        return res.status(400).json({ error: 'Tipo de documento inválido' });
      }
      template.documentType = documentType;
    }
    if (content !== undefined) template.content = content;
    if (isDefault !== undefined) template.isDefault = isDefault;
    if (activo !== undefined) template.activo = activo;
    if (pageSize !== undefined && ['letter', 'legal'].includes(pageSize)) template.pageSize = pageSize;
    // Update header/footer config (text fields only, images via upload endpoint)
    if (headerConfig) {
      const { imageS3Key, imageMimeType, imageUrl, ...textFields } = headerConfig;
      Object.assign(template.headerConfig, textFields);
    }
    if (footerConfig) {
      const { imageS3Key, imageMimeType, imageUrl, ...textFields } = footerConfig;
      Object.assign(template.footerConfig, textFields);
    }
    template.updatedBy = req.user._id;

    await template.save();
    res.json({ template, message: 'Plantilla actualizada exitosamente' });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Error al actualizar plantilla' });
  }
});

/**
 * DELETE /:id - Eliminar plantilla (soft delete)
 */
router.delete('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const template = await DocumentTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    template.activo = false;
    template.updatedBy = req.user._id;
    await template.save();

    res.json({ message: 'Plantilla eliminada exitosamente' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Error al eliminar plantilla' });
  }
});

/**
 * POST /:id/duplicate - Duplicar plantilla
 */
router.post('/:id/duplicate', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const original = await DocumentTemplate.findById(req.params.id);
    if (!original) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const dupHeader = original.headerConfig?.toObject?.() || {};
    const dupFooter = original.footerConfig?.toObject?.() || {};
    delete dupHeader.imageS3Key; delete dupHeader.imageMimeType;
    delete dupFooter.imageS3Key; delete dupFooter.imageMimeType;

    const duplicate = new DocumentTemplate({
      name: `${original.name} (copia)`,
      documentType: original.documentType,
      content: original.content,
      placeholders: original.placeholders,
      isDefault: false,
      pageSize: original.pageSize || 'letter',
      headerConfig: dupHeader,
      footerConfig: dupFooter,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await duplicate.save();
    res.status(201).json({ template: duplicate, message: 'Plantilla duplicada exitosamente' });
  } catch (error) {
    console.error('Error duplicating template:', error);
    res.status(500).json({ error: 'Error al duplicar plantilla' });
  }
});

/**
 * POST /:id/upload-image - Subir imagen header o footer
 */
router.post('/:id/upload-image', authenticate, requireRole('MUNICIPALIDAD'), upload.single('image'), async (req, res) => {
  try {
    const { tipo } = req.body;
    if (!['header', 'footer'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo debe ser "header" o "footer"' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió imagen' });
    }

    const template = await DocumentTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const configKey = tipo === 'header' ? 'headerConfig' : 'footerConfig';

    // Delete previous image if exists
    if (template[configKey]?.imageS3Key) {
      await storageService.deleteDocument({ s3Key: template[configKey].imageS3Key });
    }

    // Upload new image to S3
    const result = await storageService.storeFile(req.file.buffer, req.file.mimetype, {
      organizationId: 'templates',
      type: `doc-template-${tipo}`,
      fileName: req.file.originalname
    });

    template[configKey].imageS3Key = result.s3Key || null;
    template[configKey].imageMimeType = req.file.mimetype;
    template.updatedBy = req.user._id;
    await template.save();

    const resolved = await resolveImageUrls(template);
    res.json({ template: resolved, message: `Imagen de ${tipo} subida exitosamente` });
  } catch (error) {
    console.error('Error uploading template image:', error);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});

/**
 * DELETE /:id/image/:tipo - Eliminar imagen header o footer
 */
router.delete('/:id/image/:tipo', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { tipo } = req.params;
    if (!['header', 'footer'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo debe ser "header" o "footer"' });
    }

    const template = await DocumentTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const configKey = tipo === 'header' ? 'headerConfig' : 'footerConfig';

    if (template[configKey]?.imageS3Key) {
      await storageService.deleteDocument({ s3Key: template[configKey].imageS3Key });
    }

    template[configKey].imageS3Key = null;
    template[configKey].imageMimeType = null;
    template.updatedBy = req.user._id;
    await template.save();

    res.json({ template, message: `Imagen de ${tipo} eliminada` });
  } catch (error) {
    console.error('Error deleting template image:', error);
    res.status(500).json({ error: 'Error al eliminar imagen' });
  }
});

export default router;
