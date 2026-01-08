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
  // Para usuarios MIEMBRO: ID de la organización a la que pertenecen
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
  // Campos específicos para Municipalidad - Timbre Virtual
  timbreVirtual: {
    imagen: {
      type: String,  // Base64 de la imagen del timbre
      default: null
    },
    fechaSubida: {
      type: Date,
      default: null
    },
    activo: {
      type: Boolean,
      default: false
    }
  },
  // Firma digital del funcionario municipal
  firmaDigital: {
    imagen: {
      type: String,  // Base64 de la imagen de la firma
      default: null
    },
    fechaSubida: {
      type: Date,
      default: null
    },
    activo: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// Indexes para queries eficientes
userSchema.index({ role: 1 });
userSchema.index({ role: 1, active: 1 });
userSchema.index({ organizationId: 1 }); // Para buscar miembros de una org
userSchema.index({ createdAt: -1 });

export default mongoose.model('User', userSchema);
