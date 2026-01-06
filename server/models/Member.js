import mongoose from 'mongoose';

/**
 * Modelo Member (Normalizado)
 * Almacena miembros de organizaciones de forma independiente
 * Las firmas y certificados se almacenan en el modelo Document
 */
const memberSchema = new mongoose.Schema({
  // Referencia a la organización
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },

  // Datos personales
  rut: {
    type: String,
    required: true,
    index: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },

  // Datos adicionales (opcionales)
  primerNombre: String,
  segundoNombre: String,
  apellidoPaterno: String,
  apellidoMaterno: String,
  address: String,
  phone: String,
  email: String,
  birthDate: String,
  occupation: String,

  // Rol en la organización
  role: {
    type: String,
    enum: [
      'president',
      'vice_president',
      'secretary',
      'treasurer',
      'director',
      'member',
      'electoral_commission',
      'additional'
    ],
    default: 'member'
  },

  // Referencias a documentos (firmas, certificados)
  signatureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },
  certificateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },

  // Estado del miembro
  isActive: {
    type: Boolean,
    default: true
  },

  // Flag para indicar si es miembro fundador (de la asamblea constitutiva)
  isFoundingMember: {
    type: Boolean,
    default: true
  },

  // Flag para comisión electoral
  isElectoralCommission: {
    type: Boolean,
    default: false
  },

  // Flag para directorio provisorio
  isProvisionalBoard: {
    type: Boolean,
    default: false
  },
  provisionalRole: String, // 'president', 'secretary', 'treasurer', etc.

  // Metadata de migración
  migratedFrom: {
    type: String,
    enum: ['members', 'electoralCommission', 'provisionalDirectorio', 'validatedAttendees', null],
    default: null
  },
  originalIndex: Number // Índice original en el array embebido

}, {
  timestamps: true
});

// Índices compuestos para búsquedas eficientes
memberSchema.index({ organizationId: 1, rut: 1 }, { unique: true });
memberSchema.index({ organizationId: 1, role: 1 });
memberSchema.index({ organizationId: 1, isElectoralCommission: 1 });
memberSchema.index({ organizationId: 1, isProvisionalBoard: 1 });

// Método virtual para nombre completo
memberSchema.virtual('fullName').get(function() {
  if (this.primerNombre) {
    const nombres = [this.primerNombre, this.segundoNombre].filter(Boolean).join(' ');
    const apellidos = [this.apellidoPaterno, this.apellidoMaterno].filter(Boolean).join(' ');
    return `${nombres} ${apellidos}`.trim();
  }
  return `${this.firstName} ${this.lastName}`.trim();
});

// Asegurar que los virtuals se incluyan en JSON
memberSchema.set('toJSON', { virtuals: true });
memberSchema.set('toObject', { virtuals: true });

export default mongoose.model('Member', memberSchema);
