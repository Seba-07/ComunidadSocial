import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import LibraryDocument from '../models/LibraryDocument.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Crear directorio de uploads si no existe
const uploadDir = './uploads/library';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurar multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se permiten PDF, Word, Excel e imágenes.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
});

/**
 * GET /api/library-documents
 * Obtener todos los documentos (público para publicados)
 */
router.get('/', async (req, res) => {
  try {
    const { category, search, includeUnpublished } = req.query;
    const filter = {};

    // Solo mostrar publicados a usuarios no autenticados
    if (!includeUnpublished || includeUnpublished !== 'true') {
      filter.isPublished = true;
    }

    if (category && category !== 'TODOS') {
      filter.category = category;
    }

    let query = LibraryDocument.find(filter)
      .populate('uploadedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    if (search) {
      filter.$text = { $search: search };
    }

    const documents = await query;

    res.json(documents);
  } catch (error) {
    console.error('Error al obtener documentos:', error);
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
});

/**
 * GET /api/library-documents/categories
 * Obtener categorías disponibles
 */
router.get('/categories', (req, res) => {
  res.json(LibraryDocument.getCategoryLabels());
});

/**
 * GET /api/library-documents/:id
 * Obtener un documento por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const document = await LibraryDocument.findById(req.params.id)
      .populate('uploadedBy', 'firstName lastName email');

    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    res.json(document);
  } catch (error) {
    console.error('Error al obtener documento:', error);
    res.status(500).json({ error: 'Error al obtener documento' });
  }
});

/**
 * GET /api/library-documents/:id/download
 * Descargar un documento
 */
router.get('/:id/download', async (req, res) => {
  try {
    const document = await LibraryDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Incrementar contador de descargas
    await document.incrementDownload();

    // Enviar archivo
    const filePath = path.resolve(document.filePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
    }

    res.download(filePath, document.originalName);
  } catch (error) {
    console.error('Error al descargar documento:', error);
    res.status(500).json({ error: 'Error al descargar documento' });
  }
});

/**
 * POST /api/library-documents
 * Subir un nuevo documento (solo MUNICIPALIDAD)
 */
router.post('/', authenticate, requireRole('MUNICIPALIDAD'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const { name, description, category, isPublished } = req.body;

    if (!name) {
      // Eliminar archivo si falta el nombre
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'El nombre del documento es requerido' });
    }

    const document = new LibraryDocument({
      name,
      description: description || '',
      category: category || 'OTROS',
      fileName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: req.file.path,
      uploadedBy: req.user._id,
      isPublished: isPublished === 'true' || isPublished === true
    });

    await document.save();

    res.status(201).json(document);
  } catch (error) {
    // Eliminar archivo en caso de error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Error al eliminar archivo:', e);
      }
    }
    console.error('Error al subir documento:', error);
    res.status(500).json({ error: 'Error al subir documento' });
  }
});

/**
 * PUT /api/library-documents/:id
 * Actualizar un documento (solo MUNICIPALIDAD)
 */
router.put('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { name, description, category, isPublished } = req.body;

    const document = await LibraryDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    if (name !== undefined) document.name = name;
    if (description !== undefined) document.description = description;
    if (category !== undefined) document.category = category;
    if (isPublished !== undefined) document.isPublished = isPublished;

    await document.save();

    res.json(document);
  } catch (error) {
    console.error('Error al actualizar documento:', error);
    res.status(500).json({ error: 'Error al actualizar documento' });
  }
});

/**
 * DELETE /api/library-documents/:id
 * Eliminar un documento (solo MUNICIPALIDAD)
 */
router.delete('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const document = await LibraryDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Eliminar archivo físico
    try {
      if (fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath);
      }
    } catch (e) {
      console.error('Error al eliminar archivo físico:', e);
    }

    await LibraryDocument.findByIdAndDelete(req.params.id);

    res.json({ message: 'Documento eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar documento:', error);
    res.status(500).json({ error: 'Error al eliminar documento' });
  }
});

export default router;
