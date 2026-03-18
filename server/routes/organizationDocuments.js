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

// ============ S3 INTEGRATION ============
let s3Service = null;
try {
  const mod = await import('../services/s3Service.js');
  if (mod.isS3Configured()) {
    s3Service = mod;
    console.log('[org-documents] S3 storage enabled');
  } else {
    console.log('[org-documents] S3 not configured, using local disk');
  }
} catch {
  console.log('[org-documents] S3 module not available, using local disk');
}

const useS3 = !!s3Service;

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
  s3Key: {
    type: String,
    default: null
  },
  storageType: {
    type: String,
    enum: ['local', 's3'],
    default: 'local'
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  uploadedByRole: {
    type: String,
    enum: ['ORGANIZADOR', 'MUNICIPALIDAD', 'MIEMBRO', ''],
    default: ''
  },
  isOfficial: {
    type: Boolean,
    default: false
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
// S3 mode: memory storage (buffer in req.file.buffer)
// Local mode: disk storage (file on disk in req.file.path)
const uploadDir = './uploads/org-documents/';
if (!useS3 && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const memoryStorage = multer.memoryStorage();

const ALLOWED_FILE_TYPES = /pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif/;

const upload = multer({
  storage: useS3 ? memoryStorage : diskStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
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

/**
 * Sends a file to the response (handles both S3 and local).
 * For S3: returns JSON with presigned URL (frontend handles display/download).
 * For local: streams the file with correct headers.
 * @param {Object} document - OrgDocument record
 * @param {Object} res - Express response
 * @param {boolean} inline - If true, display inline (preview); if false, force download
 */
async function sendFile(document, res, inline = false) {
  const fileName = document.originalName || document.name;
  const disposition = inline
    ? 'inline'
    : `attachment; filename="${encodeURIComponent(fileName)}"`;

  // S3 storage → return presigned URL with Content-Disposition baked in
  if (document.storageType === 's3' && document.s3Key && s3Service) {
    try {
      const url = await s3Service.getPresignedUrl(document.s3Key, 3600, {
        contentDisposition: disposition,
        contentType: document.mimeType || undefined
      });
      return res.json({ url, mimeType: document.mimeType, fileName });
    } catch (err) {
      console.error('S3 presigned URL error:', err.message);
      return res.status(500).json({ error: 'Error al acceder al archivo en S3' });
    }
  }

  // Local storage → stream directly
  if (!document.filePath) {
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }
  const filePath = path.resolve(document.filePath);
  if (!isPathWithinDir(filePath, './uploads/org-documents/')) {
    return res.status(403).json({ error: 'Acceso denegado al archivo' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
  }

  res.setHeader('Content-Disposition', disposition);
  if (document.mimeType) res.setHeader('Content-Type', document.mimeType);
  fs.createReadStream(filePath).pipe(res);
}

// ============ ENDPOINTS ============

/**
 * GET /api/org-documents/:orgId
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
 * POST /api/org-documents/:orgId/upload
 */
router.post('/:orgId/upload', authenticate, uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    const organization = await checkOrgPermission(req, res);
    if (!organization) {
      if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch { /* ignore */ } }
      return;
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const { name, description, category, isPublished, isOfficial } = req.body;
    if (!name) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'El nombre del documento es requerido' });
    }

    const officialFlag = (isOfficial === 'true' || isOfficial === true) && req.user.role === 'MUNICIPALIDAD';

    let storageType = 'local';
    let filePath = req.file.path || null;
    let s3Key = null;

    // Upload to S3 if available
    if (useS3 && req.file.buffer) {
      try {
        const result = await s3Service.uploadBuffer(req.file.buffer, req.file.mimetype, {
          organizationId: req.params.orgId,
          type: 'org-document',
          fileName: req.file.originalname
        });
        s3Key = result.s3Key;
        storageType = 's3';
        filePath = null;
      } catch (err) {
        console.error('[org-documents] S3 upload failed, saving locally:', err.message);
        // Fallback: save buffer to disk
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const localName = `${Date.now()}-${req.file.originalname}`;
        filePath = path.join(uploadDir, localName);
        fs.writeFileSync(filePath, req.file.buffer);
        storageType = 'local';
      }
    }

    const document = new OrgDocument({
      organizationId: req.params.orgId,
      name,
      description: description || '',
      category: category || 'OTRO',
      fileName: req.file.filename || req.file.originalname,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      filePath,
      s3Key,
      storageType,
      uploadedBy: req.user._id,
      uploadedByRole: req.user.role || '',
      isOfficial: officialFlag,
      isPublished: isPublished === 'true' || isPublished === true
    });

    await document.save();
    res.status(201).json(document);
  } catch (error) {
    if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch { /* ignore */ } }
    console.error('Upload org document error:', error);
    res.status(500).json({ error: 'Error al subir documento' });
  }
});

/**
 * GET /api/org-documents/:orgId/:docId/download
 */
router.get('/:orgId/:docId/download', authenticate, async (req, res) => {
  try {
    const organization = await checkOrgPermission(req, res);
    if (!organization) return;
    const { docId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(docId)) {
      return res.status(400).json({ error: 'ID de documento no válido' });
    }
    const document = await OrgDocument.findOne({ _id: docId, organizationId: req.params.orgId });
    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    await sendFile(document, res, false);
  } catch (error) {
    console.error('Download org document error:', error);
    res.status(500).json({ error: 'Error al descargar documento' });
  }
});

/**
 * GET /api/org-documents/:orgId/:docId/preview
 * Sirve el archivo inline para previsualización en el navegador (PDF, imágenes).
 */
router.get('/:orgId/:docId/preview', authenticate, async (req, res) => {
  try {
    const organization = await checkOrgPermission(req, res);
    if (!organization) return;
    const { docId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(docId)) {
      return res.status(400).json({ error: 'ID de documento no válido' });
    }
    const document = await OrgDocument.findOne({ _id: docId, organizationId: req.params.orgId });
    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    await sendFile(document, res, true);
  } catch (error) {
    console.error('Preview org document error:', error);
    res.status(500).json({ error: 'Error al previsualizar documento' });
  }
});

/**
 * DELETE /api/org-documents/:orgId/:docId
 */
router.delete('/:orgId/:docId', authenticate, async (req, res) => {
  try {
    const organization = await checkOrgPermission(req, res);
    if (!organization) return;
    const { docId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(docId)) {
      return res.status(400).json({ error: 'ID de documento no válido' });
    }
    const document = await OrgDocument.findOne({ _id: docId, organizationId: req.params.orgId });
    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Delete from S3
    if (document.storageType === 's3' && document.s3Key && s3Service) {
      try { await s3Service.deleteObject(document.s3Key); } catch (e) {
        console.error('Error al eliminar de S3:', e.message);
      }
    }

    // Delete local file
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
