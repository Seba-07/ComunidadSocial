import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  rut: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  address: String,
  phone: String,
  email: String,
  birthDate: String,
  occupation: String,
  role: {
    type: String,
    enum: ['president', 'secretary', 'treasurer', 'director', 'member', 'electoral_commission'],
    default: 'member'
  },
  signature: String, // Base64
  certificate: String // Base64 or URL
});

const statusHistorySchema = new mongoose.Schema({
  status: String,
  date: { type: Date, default: Date.now },
  comment: String,
  corrections: mongoose.Schema.Types.Mixed
});

const organizationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organizationName: {
    type: String,
    required: true,
    trim: true
  },
  organizationType: {
    type: String,
    enum: [
      // Territoriales
      'JUNTA_VECINOS', 'COMITE_VECINOS',
      // Clubes
      'CLUB_DEPORTIVO', 'CLUB_ADULTO_MAYOR', 'CLUB_JUVENIL', 'CLUB_CULTURAL',
      // Centros
      'CENTRO_MADRES', 'CENTRO_PADRES', 'CENTRO_CULTURAL',
      // Agrupaciones
      'AGRUPACION_FOLCLORICA', 'AGRUPACION_CULTURAL', 'AGRUPACION_JUVENIL',
      'AGRUPACION_AMBIENTAL', 'AGRUPACION_EMPRENDEDORES',
      // Comités
      'COMITE_VIVIENDA', 'COMITE_ALLEGADOS', 'COMITE_APR',
      'COMITE_ADELANTO', 'COMITE_MEJORAMIENTO', 'COMITE_CONVIVENCIA',
      // Organizaciones específicas
      'ORG_SCOUT', 'ORG_MUJERES', 'ORG_INDIGENA', 'ORG_SALUD', 'ORG_SOCIAL', 'ORG_CULTURAL',
      // Arte y cultura
      'GRUPO_TEATRO', 'CORO', 'TALLER_ARTESANIA',
      // Genéricos (mantener para compatibilidad)
      'ORG_COMUNITARIA', 'ORG_FUNCIONAL', 'OTRA_FUNCIONAL'
    ],
    required: true
  },
  address: {
    type: String,
    required: true
  },
  comuna: {
    type: String,
    default: 'Renca'
  },
  region: {
    type: String,
    default: 'Metropolitana'
  },
  unidadVecinal: String,
  territory: String,

  // Datos de contacto del solicitante
  contactEmail: {
    type: String,
    trim: true
  },
  contactPhone: {
    type: String,
    trim: true
  },

  // Members
  members: [memberSchema],
  minMembers: { type: Number, default: 15 },

  // Electoral Commission
  electoralCommission: [memberSchema],

  // Directorio Provisorio (flexible schema para datos del wizard)
  provisionalDirectorio: {
    president: mongoose.Schema.Types.Mixed,
    secretary: mongoose.Schema.Types.Mixed,
    treasurer: mongoose.Schema.Types.Mixed,
    additionalMembers: [mongoose.Schema.Types.Mixed],
    designatedAt: Date,
    type: { type: String, default: 'PROVISIONAL' },
    expiresAt: Date
  },

  // Status
  status: {
    type: String,
    enum: [
      'draft',
      'waiting_ministro',
      'ministro_scheduled',
      'ministro_approved',
      'pending_review',
      'in_review',
      'rejected',
      'sent_registry',
      'approved',
      'dissolved'
    ],
    default: 'draft'
  },
  statusHistory: [statusHistorySchema],

  // Ministro de Fe data
  electionDate: Date,
  electionTime: String,
  assemblyAddress: String,
  comments: String,
  ministroData: {
    ministroId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    rut: String,
    scheduledDate: Date,
    scheduledTime: String,
    location: String,
    assignedAt: Date
  },
  ministroSignature: String, // Base64

  // Comision Electoral (from validation wizard - flexible schema)
  comisionElectoral: [mongoose.Schema.Types.Mixed],

  // Estatutos de la organización
  estatutos: {
    type: String,
    default: ''
  },

  // Validated attendees from assembly (flexible schema para soportar externos con name)
  validatedAttendees: [mongoose.Schema.Types.Mixed],

  // Validation data from Ministro de Fe
  validationData: {
    validatedAt: Date,
    validatorId: String,
    validatorName: String,
    ministroSignature: String,
    signatures: mongoose.Schema.Types.Mixed
  },

  // Corrections
  corrections: {
    fields: mongoose.Schema.Types.Mixed,
    documents: mongoose.Schema.Types.Mixed,
    certificates: mongoose.Schema.Types.Mixed,
    generalComment: String,
    resolved: { type: Boolean, default: false },
    resolvedAt: Date,
    userResponse: String,
    userFieldResponses: mongoose.Schema.Types.Mixed
  },

  // Appointment tracking
  originalAppointment: mongoose.Schema.Types.Mixed,
  appointmentChanges: [mongoose.Schema.Types.Mixed],
  appointmentWasModified: { type: Boolean, default: false },
  lastModificationDate: Date,

  // Dissolution
  dissolvedAt: Date,
  dissolutionReason: String,
  dissolvedBy: String
}, {
  timestamps: true
});

// Index for efficient queries
organizationSchema.index({ userId: 1 });
organizationSchema.index({ status: 1 });
organizationSchema.index({ 'ministroData.ministroId': 1 });

export default mongoose.model('Organization', organizationSchema);
