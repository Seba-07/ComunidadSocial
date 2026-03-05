import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import Organization from '../models/Organization.js';
import { authenticate } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/security.js';
import { isPathWithinDir } from '../utils/pathSecurity.js';

const router = express.Router();

// ============ MODELO OrgDocument (inline) ============
const orgDocumentSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['ACTA_ASAMBLEA', 'BALANCE', 'INFORME', 'CERTIFICADO', 'CORRESPONDENCIA', 'OTRO'],
    default: 'OTRO'
  },
  fileName: {
    type: String,
    default: null
  },
  originalName: {
    type: String,
    default: null
  },
  mimeType: {
    type: String,
    default: null
  },
  fileSize: {
    type: Number,
    default: 0
  },
  filePath: {
    type: String,
    default: null
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isPublished: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

orgDocumentSchema.index({ organizationId: 1, createdAt: -1 });
orgDocumentSchema.index({ category: 1 });

const OrgDocument = mongoose.model('OrgDocument', orgDocumentSchema);

// ============ CONFIGURACIÓN DE MULTER ============
const uploadDir = './uploads/org-documents/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const ALLOWED_FILE_TYPES = /pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif/;

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (ALLOWED_FILE_TYPES.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se aceptan: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF'));
    }
  }
});

// ============ HELPERS ============

/**
 * Verifica si el usuario tiene permiso sobre la organización.
 * Retorna la organización si tiene permiso, o null y envía respuesta de error.
 */
async function checkOrgPermission(req, res) {
  const { orgId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orgId)) {
    res.status(400).json({ error: 'ID de organización no válido' });
    return null;
  }

  const organization = await Organization.findById(orgId);

  if (!organization) {
    res.status(404).json({ error: 'Organización no encontrada' });
    return null;
  }

  const isOwner = organization.userId.toString() === req.userId.toString();
  const isMunicipalidad = req.user.role === 'MUNICIPALIDAD';

  // Allow MIEMBRO users who belong to this organization
  let isMember = false;
  if (req.user.role === 'MIEMBRO') {
    const orgIdStr = orgId.toString();
    const allOrgIds = req.user.getAllOrgIds ? req.user.getAllOrgIds() : [];
    isMember = allOrgIds.includes(orgIdStr);
  }

  if (!isOwner && !isMunicipalidad && !isMember) {
    res.status(403).json({ error: 'No tienes permisos para acceder a los documentos de esta organización' });
    return null;
  }

  return organization;
}

// ============ ENDPOINTS ============

/**
 * GET /api/organization-documents/:orgId
 * Listar todos los documentos de una organización.
 */
router.get('/:orgId', authenticate, async (req, res) => {
  try {
    const organization = await checkOrgPermission(req, res);
    if (!organization) return;

    const documents = await OrgDocument.find({ organizationId: req.params.orgId })
      .populate('uploadedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    res.json(documents);
  } catch (error) {
    console.error('Get org documents error:', error);
    res.status(500).json({ error: 'Error al obtener documentos de la organización' });
  }
});

/**
 * POST /api/organization-documents/:orgId/upload
 * Subir un documento para una organización.
 */
router.post('/:orgId/upload', authenticate, uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    const organization = await checkOrgPermission(req, res);
    if (!organization) {
      // Eliminar archivo subido si no tiene permisos
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
      }
      return;
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const { name, description, category, isPublished } = req.body;

    if (!name) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'El nombre del documento es requerido' });
    }

    const document = new OrgDocument({
      organizationId: req.params.orgId,
      name,
      description: description || '',
      category: category || 'OTRO',
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
      try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
    }
    console.error('Upload org document error:', error);
    res.status(500).json({ error: 'Error al subir documento' });
  }
});

/**
 * GET /api/organization-documents/:orgId/:docId/download
 * Descargar un documento de una organización.
 */
router.get('/:orgId/:docId/download', authenticate, async (req, res) => {
  try {
    const organization = await checkOrgPermission(req, res);
    if (!organization) return;

    const { docId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(docId)) {
      return res.status(400).json({ error: 'ID de documento no válido' });
    }

    const document = await OrgDocument.findOne({
      _id: docId,
      organizationId: req.params.orgId
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const filePath = path.resolve(document.filePath);

    // SEGURIDAD: verificar que el path esté dentro del directorio de uploads
    if (!isPathWithinDir(filePath, './uploads/org-documents/')) {
      return res.status(403).json({ error: 'Acceso denegado al archivo' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
    }

    res.download(filePath, document.originalName);
  } catch (error) {
    console.error('Download org document error:', error);
    res.status(500).json({ error: 'Error al descargar documento' });
  }
});

/**
 * DELETE /api/organization-documents/:orgId/:docId
 * Eliminar un documento de una organización.
 */
router.delete('/:orgId/:docId', authenticate, async (req, res) => {
  try {
    const organization = await checkOrgPermission(req, res);
    if (!organization) return;

    const { docId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(docId)) {
      return res.status(400).json({ error: 'ID de documento no válido' });
    }

    const document = await OrgDocument.findOne({
      _id: docId,
      organizationId: req.params.orgId
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Eliminar archivo físico (solo si está dentro del directorio permitido)
    try {
      if (document.filePath && isPathWithinDir(document.filePath, './uploads/org-documents/') && fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath);
      }
    } catch (e) {
      console.error('Error al eliminar archivo físico:', e);
    }

    await OrgDocument.findByIdAndDelete(docId);

    res.json({ message: 'Documento eliminado correctamente' });
  } catch (error) {
    console.error('Delete org document error:', error);
    res.status(500).json({ error: 'Error al eliminar documento' });
  }
});

export default router;
