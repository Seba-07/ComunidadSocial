import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

const documentRegistrySchema = new mongoose.Schema({
  folio: {
    type: String,
    unique: true,
    required: true,
    default: () => nanoid(12), // 12-char unique ID (e.g., "V1StGXR8_Z5j")
    index: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  documentType: {
    type: String,
    required: true,
    enum: [
      'acta_constitutiva',
      'lista_socios',
      'acta_escrutinio',
      'lista_asistencia',
      'certificado_borrador',
      'nomina_directorio',
      'carta_solicitud'
    ]
  },
  documentTitle: {
    type: String,
    default: ''
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Optional: assembly reference for assembly-related docs
  assemblyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assembly',
    default: null
  },
  // SHA-256 hash of the PDF content for integrity verification
  fileHash: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['VALID', 'REVOKED'],
    default: 'VALID'
  },
  revokedAt: {
    type: Date,
    default: null
  },
  revokedReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for quick lookups
documentRegistrySchema.index({ organizationId: 1, documentType: 1 });
documentRegistrySchema.index({ status: 1 });

const DOCUMENT_TYPE_LABELS = {
  'acta_constitutiva': 'Acta Constitutiva',
  'lista_socios': 'Lista de Socios Fundadores',
  'acta_escrutinio': 'Acta de Escrutinio',
  'lista_asistencia': 'Lista de Asistencia',
  'certificado_borrador': 'Certificado de Personalidad Jurídica (Borrador)',
  'nomina_directorio': 'Nómina del Directorio',
  'carta_solicitud': 'Carta de Solicitud'
};

documentRegistrySchema.statics.getTypeLabel = function(type) {
  return DOCUMENT_TYPE_LABELS[type] || type;
};

export { DOCUMENT_TYPE_LABELS };
export default mongoose.model('DocumentRegistry', documentRegistrySchema);
