import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  rut: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  region: {
    type: String,
    trim: true
  },
  commune: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['ORGANIZADOR', 'MUNICIPALIDAD', 'MINISTRO_FE', 'MIEMBRO'],
    default: 'ORGANIZADOR'
  },
  // Para usuarios MIEMBRO: IDs de las organizaciones a las que pertenecen
  organizationIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  }],
  // Legacy: campo anterior (single org) — mantener para migración
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  },
  active: {
    type: Boolean,
    default: true
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  // Campos específicos para Ministros de Fe
  specialty: {
    type: String,
    trim: true,
    default: 'General'
  },
  availableHours: {
    type: [String],
    default: []
  },
  // Campos de privacidad (Ley 21.719)
  privacyAcceptedAt: {
    type: Date,
    default: null
  },
  privacyPolicyVersion: {
    type: String,
    default: null
  },
  // Verificación de email
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },
  // QR Token para credencial y check-in
  qrToken: {
    type: String,
    default: undefined
  },
  qrTokenGeneratedAt: {
    type: Date,
    default: null
  },
  // Recuperación de contraseña
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  // Seguridad: versión de token para invalidación de sesiones
  tokenVersion: {
    type: Number,
    default: 0
  },
  // Seguridad: bloqueo por intentos fallidos de login
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Helper: devuelve todos los IDs de organización (migra legacy organizationId)
userSchema.methods.getAllOrgIds = function() {
  const ids = (this.organizationIds || []).map(id => id.toString());
  if (this.organizationId && !ids.includes(this.organizationId.toString())) {
    ids.push(this.organizationId.toString());
  }
  return ids;
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// Indexes para queries eficientes
userSchema.index({ role: 1, active: 1 }); // Cubre queries solo por role (prefijo)
userSchema.index({ organizationIds: 1 }); // Para buscar miembros de una org
userSchema.index({ qrToken: 1 }, { sparse: true }); // Para check-in por QR
userSchema.index({ createdAt: -1 });

export default mongoose.model('User', userSchema);
