import mongoose from 'mongoose';

const signatureSchema = new mongoose.Schema({
  memberId: String,
  memberName: String,
  memberRut: String,
  role: String,
  signature: String, // Base64
  signedAt: { type: Date, default: Date.now }
});

const validationHistorySchema = new mongoose.Schema({
  validatedAt: Date,
  validatedBy: String,
  signatures: [signatureSchema],
  resetAt: Date
});

const assignmentSchema = new mongoose.Schema({
  ministroId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ministroName: {
    type: String,
    required: true
  },
  ministroRut: String,
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  organizationName: {
    type: String,
    required: true
  },
  assemblyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assembly',
    default: null
  },
  source: {
    type: String,
    enum: ['manual', 'auto'],
    default: 'manual'
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledTime: {
    type: String,
    required: true
  },
  location: String,
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending'
  },

  // Validation data
  signaturesValidated: {
    type: Boolean,
    default: false
  },
  validatedAt: Date,
  validatedBy: String,
  signatures: [signatureSchema],
  validationHistory: [validationHistorySchema],

  // Wizard data
  // NOTA: provisionalDirectorio es el nombre canónico (consistente con Organization)
  // directorio se mantiene como alias para compatibilidad con datos existentes
  wizardData: {
    // Campo canónico - usar este para nuevos datos
    provisionalDirectorio: {
      president: mongoose.Schema.Types.Mixed,
      secretary: mongoose.Schema.Types.Mixed,
      treasurer: mongoose.Schema.Types.Mixed,
      additionalMembers: [mongoose.Schema.Types.Mixed]
    },
    // DEPRECADO: Alias para compatibilidad con datos antiguos
    // Nuevo código debe usar provisionalDirectorio
    directorio: {
      president: mongoose.Schema.Types.Mixed,
      secretary: mongoose.Schema.Types.Mixed,
      treasurer: mongoose.Schema.Types.Mixed
    },
    comisionElectoral: [mongoose.Schema.Types.Mixed],
    attendees: [mongoose.Schema.Types.Mixed],
    validatorId: String,
    validatorName: String,
    ministroSignature: String,
    groupPhoto: String, // Foto grupal de la asamblea en Base64
    notes: String
  },

  // Assembly execution data
  quorumRequired: { type: Number, default: 15 },
  quorumAchieved: { type: Boolean, default: false },
  attendanceCount: { type: Number, default: 0 },

  // Scanned documents (uploaded by MF after assembly)
  actaScannedUrl: String,      // PDF escaneado del acta firmada
  attendanceScannedUrl: String, // PDF escaneado de la lista de asistencia firmada

  // Assembly rejection
  assemblyRejected: { type: Boolean, default: false },
  rejectionReason: String,

  // Completion data
  completedAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  lastEditedAt: Date
}, {
  timestamps: true
});

// Indexes
assignmentSchema.index({ ministroId: 1 });
assignmentSchema.index({ organizationId: 1 });
assignmentSchema.index({ status: 1 });
assignmentSchema.index({ scheduledDate: 1 });
// Índice compuesto para verificación de conflictos de agenda (CRÍTICO para performance)
assignmentSchema.index({ ministroId: 1, scheduledDate: 1, scheduledTime: 1, status: 1 });
// Índice para búsqueda por organización y estado
assignmentSchema.index({ organizationId: 1, status: 1 });

// ============ MIDDLEWARE PARA LIMITAR ARRAYS HISTÓRICOS ============
const MAX_VALIDATION_HISTORY = 10; // Máximo 10 registros de historial de validación

assignmentSchema.pre('save', function(next) {
  // Limitar validationHistory para evitar crecimiento infinito
  if (this.validationHistory && this.validationHistory.length > MAX_VALIDATION_HISTORY) {
    // Mantener solo los últimos MAX_VALIDATION_HISTORY registros
    this.validationHistory = this.validationHistory.slice(-MAX_VALIDATION_HISTORY);
  }

  // ============ NORMALIZACIÓN directorio ↔ provisionalDirectorio ============
  // Sincronizar ambos campos para compatibilidad
  if (this.wizardData) {
    // Si tiene provisionalDirectorio pero no directorio, copiar
    if (this.wizardData.provisionalDirectorio && !this.wizardData.directorio?.president) {
      this.wizardData.directorio = {
        president: this.wizardData.provisionalDirectorio.president,
        secretary: this.wizardData.provisionalDirectorio.secretary,
        treasurer: this.wizardData.provisionalDirectorio.treasurer
      };
    }
    // Si tiene directorio pero no provisionalDirectorio, copiar (datos legacy)
    else if (this.wizardData.directorio?.president && !this.wizardData.provisionalDirectorio?.president) {
      this.wizardData.provisionalDirectorio = {
        president: this.wizardData.directorio.president,
        secretary: this.wizardData.directorio.secretary,
        treasurer: this.wizardData.directorio.treasurer,
        additionalMembers: []
      };
    }
  }

  next();
});

// Método helper para obtener el directorio (usa el campo correcto)
assignmentSchema.methods.getDirectorio = function() {
  return this.wizardData?.provisionalDirectorio ||
         this.wizardData?.directorio ||
         null;
};

// Método para obtener la última validación del historial
assignmentSchema.methods.getLastValidation = function() {
  if (!this.validationHistory || this.validationHistory.length === 0) {
    return null;
  }
  return this.validationHistory[this.validationHistory.length - 1];
};

// Método para calcular el tamaño estimado del documento
assignmentSchema.methods.estimateSize = function() {
  const signaturesSize = (this.signatures?.length || 0) * 15000; // ~15KB por firma
  const historySize = (this.validationHistory?.length || 0) * 50000; // ~50KB por registro
  const wizardDataSize = this.wizardData?.groupPhoto ? 300000 : 0; // ~300KB si hay foto
  return signaturesSize + historySize + wizardDataSize;
};

export default mongoose.model('Assignment', assignmentSchema);
