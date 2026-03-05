/**
 * Rutas CRUD para DocumentTemplate (Plantillas de Documentos PDF)
 */

import express from 'express';
import DocumentTemplate, { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, AVAILABLE_PLACEHOLDERS } from '../models/DocumentTemplate.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

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
    res.json({ template });
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
    res.json({ template });
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
    const { name, documentType, content, isDefault } = req.body;

    if (!name || !documentType) {
      return res.status(400).json({ error: 'Nombre y tipo de documento son requeridos' });
    }
    if (!DOCUMENT_TYPES.includes(documentType)) {
      return res.status(400).json({ error: 'Tipo de documento inválido' });
    }

    const template = new DocumentTemplate({
      name,
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
    const { name, documentType, content, isDefault, activo } = req.body;

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

    const duplicate = new DocumentTemplate({
      name: `${original.name} (copia)`,
      documentType: original.documentType,
      content: original.content,
      placeholders: original.placeholders,
      isDefault: false,
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

export default router;
