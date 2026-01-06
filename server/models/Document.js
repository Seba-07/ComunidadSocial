import mongoose from 'mongoose';

/**
 * Modelo Document (Normalizado)
 * Almacena documentos Base64 (firmas, certificados, fotos) de forma independiente
 * Esto reduce significativamente el tamaño de los documentos de Organization
 */
const documentSchema = new mongoose.Schema({
  // Referencias
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    index: true
  },

  // Tipo de documento
  type: {
    type: String,
    enum: [
      'signature',           // Firma de miembro
      'certificate',         // Certificado de residencia
      'ministro_signature',  // Firma del ministro de fe
      'group_photo',         // Foto grupal de asamblea
      'acta',                // Acta generada
      'estatutos',           // Estatutos generados
      'attendee_list',       // Lista de asistentes
      'other'                // Otros documentos
    ],
    required: true,
    index: true
  },

  // Contenido Base64
  content: {
    type: String,
    required: true
  },

  // Metadata del archivo
  mimeType: {
    type: String,
    default: 'image/png'
  },
  size: {
    type: Number, // Tamaño en bytes (del string Base64)
    default: 0
  },
  originalName: String,

  // Descripción para identificación
  description: String,

  // Contexto del documento (de dónde viene)
  context: {
    type: String,
    enum: [
      'constitution_assembly',  // Asamblea constitutiva
      'validation_wizard',      // Wizard de validación
      'member_registration',    // Registro de miembros
      'manual_upload',          // Subida manual
      'migration'               // Migración desde formato anterior
    ],
    default: 'constitution_assembly'
  },

  // Para firmas: identificador del firmante
  signerRole: String, // 'president', 'secretary', 'treasurer', 'ministro', etc.
  signerRut: String,
  signerName: String,

  // Metadata de migración
  migratedFrom: {
    type: String,
    enum: [
      'members.signature',
      'members.certificate',
      'electoralCommission.signature',
      'provisionalDirectorio.signature',
      'validationData.signatures',
      'ministroSignature',
      null
    ],
    default: null
  },
  originalPath: String, // Ruta original en el documento embebido

  // Estado
  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});

// Índices para búsquedas eficientes
documentSchema.index({ organizationId: 1, type: 1 });
documentSchema.index({ memberId: 1, type: 1 });
documentSchema.index({ organizationId: 1, context: 1 });

// Método estático para calcular tamaño
documentSchema.statics.calculateSize = function(base64String) {
  if (!base64String) return 0;
  // Calcular tamaño aproximado del contenido Base64
  return Math.round((base64String.length * 3) / 4);
};

// Pre-save hook para calcular tamaño
documentSchema.pre('save', function(next) {
  if (this.content && this.isModified('content')) {
    this.size = Math.round((this.content.length * 3) / 4);
  }
  next();
});

// Método para obtener tamaño legible
documentSchema.methods.getReadableSize = function() {
  const bytes = this.size;
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

export default mongoose.model('Document', documentSchema);
