import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  rut: { type: String, required: true },
  firstName: { type: String, required: true },
  segundoNombre: { type: String, default: '' }, // Segundo nombre (opcional)
  lastName: { type: String, required: true },   // Apellido paterno
  apellidoMaterno: { type: String, default: '' }, // Apellido materno (opcional)
  address: String,
  phone: String,
  email: String,
  birthDate: String,
  occupation: String,
  genero: {
    type: String,
    enum: ['masculino', 'femenino', 'otro', 'no_especifica', ''],
    default: ''
  },
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

// ============ SCHEMAS DE ASAMBLEAS ============

const candidateSchema = new mongoose.Schema({
  rut: String,
  firstName: String,
  lastName: String,
  cargo: String, // para modo per_cargo
  lista: String  // para modo per_lista (nombre de la lista)
}, { _id: false });

const voteSchema = new mongoose.Schema({
  voterRut: String,
  cargo: String,          // para modo per_cargo
  candidateRut: String,   // para modo per_cargo
  lista: String,          // para modo per_lista
  votedAt: { type: Date, default: Date.now }
}, { _id: false });

const agendaItemSchema = new mongoose.Schema({
  id: String,
  title: { type: String, required: true },
  type: {
    type: String,
    enum: ['eleccion_directorio', 'aprobacion_presupuesto', 'reforma_estatutos', 'memoria_anual', 'disolucion', 'custom'],
    default: 'custom'
  },
  description: String,
  votingMode: {
    type: String,
    enum: ['per_cargo', 'per_lista', null],
    default: null
  },
  candidates: [candidateSchema],
  votes: [voteSchema],
  votingOpen: { type: Boolean, default: false },
  votingClosedAt: Date,
  result: mongoose.Schema.Types.Mixed
}, { _id: false });

const assemblyAttendeeSchema = new mongoose.Schema({
  rut: String,
  firstName: String,
  lastName: String,
  checkedInAt: { type: Date, default: Date.now }
}, { _id: false });

const assemblySchema = new mongoose.Schema({
  id: String,
  type: { type: String, enum: ['ordinaria', 'extraordinaria'], default: 'ordinaria' },
  date: String,
  time: String,
  title: String,
  description: String,
  status: {
    type: String,
    enum: ['draft', 'convocada', 'en_curso', 'finalizada', 'cancelada'],
    default: 'draft'
  },
  quorumType: { type: String, enum: ['percentage', 'number'], default: 'percentage' },
  quorumValue: { type: Number, default: 50 },
  agendaItems: [agendaItemSchema],
  attendance: Number,
  attendees: [assemblyAttendeeSchema],
  convokedAt: Date,
  startedAt: Date,
  finishedAt: Date,
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

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
  street: {
    type: String,
    trim: true
  },
  streetNumber: {
    type: String,
    trim: true
  },
  postalCode: {
    type: String,
    trim: true
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
  description: { type: String, trim: true },
  objectives: { type: String, trim: true },

  // Números de certificación y depósito (se generan al aprobar)
  certNumber: String,
  depositNumber: String,

  // Datos de contacto del solicitante
  contactEmail: {
    type: String,
    trim: true
  },
  contactPhone: {
    type: String,
    trim: true
  },
  contactPreference: {
    type: String,
    enum: ['phone', 'email'],
    default: 'phone'
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
      'registry_observations', // Estado cuando Registro Civil tiene observaciones
      'approved',
      'dissolved',
      'deletion_requested'
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
  // DEPRECADO: Usar validationData.ministroSignature en su lugar
  // Este campo se mantiene por compatibilidad con datos existentes
  // Nueva lógica debe leer/escribir en validationData.ministroSignature
  ministroSignature: {
    type: String,
    // Getter que advierte sobre deprecación en desarrollo
    get: function(v) {
      if (process.env.NODE_ENV === 'development' && v) {
        console.warn('DEPRECATION: ministroSignature está deprecado, usar validationData.ministroSignature');
      }
      return v;
    }
  },

  // Comision Electoral (from validation wizard - flexible schema)
  comisionElectoral: [mongoose.Schema.Types.Mixed],

  // Estatutos de la organización
  estatutos: {
    type: String,
    default: ''
  },

  // Certificados del Paso 5 del Wizard (certificados de socios)
  certificatesStep5: [{
    memberId: String,        // ID o RUT del miembro
    memberName: String,      // Nombre completo para referencia
    certificate: String,     // Base64 del certificado
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Snapshot del estatuto al momento de crear la organización
  // Esto permite que cambios futuros en las plantillas NO afecten a organizaciones ya creadas
  estatutosSnapshot: {
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'EstatutoTemplate' },
    version: Number,
    tipoOrganizacion: String,
    nombreTipo: String,
    articulos: [mongoose.Schema.Types.Mixed],
    directorio: {
      cargos: [mongoose.Schema.Types.Mixed],
      totalRequerido: Number,
      duracionMandato: Number,
      puedeReelegirse: Boolean,
      maxReelecciones: Number
    },
    miembrosMinimos: Number,
    comisionElectoral: {
      cantidad: Number,
      descripcion: String
    },
    placeholders: [mongoose.Schema.Types.Mixed],
    imagenesDocumento: [mongoose.Schema.Types.Mixed],
    documentoGenerado: String,
    fechaSnapshot: Date
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
    version: Number,
    items: [mongoose.Schema.Types.Mixed],
    fromStatus: String,
    createdAt: Date,
    // v1 legacy
    fields: mongoose.Schema.Types.Mixed,
    documents: mongoose.Schema.Types.Mixed,
    certificates: mongoose.Schema.Types.Mixed,
    // common
    generalComment: String,
    resolved: { type: Boolean, default: false },
    resolvedAt: Date,
    userResponse: String,
    userFieldResponses: mongoose.Schema.Types.Mixed
  },

  // User corrected fields - tracks which corrections the user has made
  userCorrectedFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Appointment tracking
  originalAppointment: mongoose.Schema.Types.Mixed,
  appointmentChanges: [mongoose.Schema.Types.Mixed],
  appointmentWasModified: { type: Boolean, default: false },
  lastModificationDate: Date,

  // Dissolution
  dissolvedAt: Date,
  dissolutionReason: String,
  dissolvedBy: String,

  // Deletion request (requires admin approval)
  deletionRequest: {
    reason: String,
    requestedAt: Date,
    previousStatus: String
  },

  // Asambleas (sistema mejorado con votación)
  assemblies: [assemblySchema],
  lastDirectorioElection: {
    assemblyId: String,
    date: Date,
    updatedAt: Date
  },

  // Members account creation
  memberAccountsCreated: { type: Boolean, default: false },
  memberAccountsCreatedAt: Date,

  // ============ CAMPOS NORMALIZADOS (v2) ============
  // Estos campos se usan para la nueva estructura normalizada
  // Coexisten con los campos embebidos durante la transición

  // Referencias a miembros normalizados
  memberIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member'
  }],

  // Referencias a documentos normalizados (firmas, certificados)
  documentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],

  // Flag para indicar si la organización fue migrada al nuevo formato
  isNormalized: {
    type: Boolean,
    default: false
  },
  normalizedAt: Date,

  // Versión del esquema de datos
  schemaVersion: {
    type: Number,
    default: 1 // 1 = formato embebido, 2 = formato normalizado
  }
}, {
  timestamps: true
});

// Index for efficient queries
organizationSchema.index({ userId: 1 });
organizationSchema.index({ status: 1 });
organizationSchema.index({ status: 1, createdAt: -1 }); // Para filtrar por status y ordenar
organizationSchema.index({ 'ministroData.ministroId': 1 });
organizationSchema.index({ electionDate: 1 }); // Para buscar por fecha de elección
organizationSchema.index({ createdAt: -1 });
organizationSchema.index({ organizationType: 1 }); // Para filtrar por tipo
organizationSchema.index({ comuna: 1, status: 1 }); // Para filtrar por comuna
// Índices compuestos adicionales para queries frecuentes
organizationSchema.index({ organizationType: 1, status: 1, createdAt: -1 }); // Filtrar por tipo + status
organizationSchema.index({ isNormalized: 1, schemaVersion: 1 }); // Para migración

// ============ MIDDLEWARE PARA LIMITAR ARRAYS Y VALIDAR DATOS ============
const MAX_STATUS_HISTORY = 100;
const MAX_VALIDATED_ATTENDEES = 500; // Máximo razonable de asistentes
const MAX_APPOINTMENT_CHANGES = 50;

organizationSchema.pre('save', function(next) {
  // 1. Limitar statusHistory
  if (this.statusHistory && this.statusHistory.length > MAX_STATUS_HISTORY) {
    this.statusHistory = this.statusHistory.slice(-MAX_STATUS_HISTORY);
  }

  // 2. Limitar validatedAttendees
  if (this.validatedAttendees && this.validatedAttendees.length > MAX_VALIDATED_ATTENDEES) {
    console.warn(`Organization ${this._id}: validatedAttendees excede ${MAX_VALIDATED_ATTENDEES}, truncando`);
    this.validatedAttendees = this.validatedAttendees.slice(0, MAX_VALIDATED_ATTENDEES);
  }

  // 3. Limitar appointmentChanges
  if (this.appointmentChanges && this.appointmentChanges.length > MAX_APPOINTMENT_CHANGES) {
    this.appointmentChanges = this.appointmentChanges.slice(-MAX_APPOINTMENT_CHANGES);
  }

  // 4. Sincronizar ministroSignature deprecado con validationData.ministroSignature
  if (this.isModified('ministroSignature') && this.ministroSignature) {
    if (!this.validationData) {
      this.validationData = {};
    }
    this.validationData.ministroSignature = this.ministroSignature;
  }

  // 5. Validar que validationData.signatures tenga estructura esperada (si existe)
  if (this.validationData?.signatures) {
    // Asegurar que signatures sea un objeto o array, no un string malformado
    if (typeof this.validationData.signatures === 'string') {
      try {
        this.validationData.signatures = JSON.parse(this.validationData.signatures);
      } catch (e) {
        console.warn(`Organization ${this._id}: validationData.signatures es string inválido, limpiando`);
        this.validationData.signatures = {};
      }
    }
  }

  // 6. Validar estructura de corrections
  if (this.corrections) {
    if (this.corrections.version === 2) {
      // v2: array de ítems específicos
      if (this.corrections.items && !Array.isArray(this.corrections.items)) {
        this.corrections.items = [];
      }
    } else {
      // Legacy v1: campos como objetos
      if (this.corrections.fields && typeof this.corrections.fields !== 'object') {
        this.corrections.fields = {};
      }
      if (this.corrections.documents && typeof this.corrections.documents !== 'object') {
        this.corrections.documents = {};
      }
      if (this.corrections.certificates && typeof this.corrections.certificates !== 'object') {
        this.corrections.certificates = {};
      }
    }
  }

  next();
});

// Método estático para obtener la firma del ministro (usa el campo correcto)
organizationSchema.methods.getMinistroSignature = function() {
  return this.validationData?.ministroSignature || this.ministroSignature || null;
};

// Método para limpiar datos duplicados de certificados
organizationSchema.methods.cleanDuplicateCertificates = function() {
  if (!this.certificatesStep5 || this.certificatesStep5.length === 0) return;

  // Si un miembro tiene certificado en members[] Y en certificatesStep5[],
  // marcar el de certificatesStep5 como la fuente principal y limpiar de members[]
  const certifiedMemberIds = new Set(
    this.certificatesStep5.map(c => c.memberId || c.memberName)
  );

  if (this.members) {
    this.members.forEach(member => {
      const memberId = member.rut || `${member.firstName} ${member.lastName}`;
      if (certifiedMemberIds.has(memberId) && member.certificate) {
        // El certificado ya existe en certificatesStep5, limpiar de member
        member.certificate = undefined;
      }
    });
  }

  return this;
};

export default mongoose.model('Organization', organizationSchema);
