import mongoose from 'mongoose';

const newsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true
  },
  summary: {
    type: String,
    default: ''
  },
  contentHTML: {
    type: String,
    default: ''
  },
  featuredImage: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['NOTICIAS', 'COMUNICADOS', 'EVENTOS', 'CONVOCATORIAS'],
    default: 'NOTICIAS'
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date
  },
  viewCount: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Generar slug automáticamente antes de guardar
newsSchema.pre('save', function(next) {
  if (this.isModified('title') || !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^a-z0-9\s-]/g, '')    // Solo letras, números, espacios y guiones
      .replace(/\s+/g, '-')            // Espacios a guiones
      .replace(/-+/g, '-')             // Múltiples guiones a uno
      .substring(0, 100)               // Limitar longitud
      + '-' + Date.now().toString(36); // Agregar timestamp para unicidad
  }
  next();
});

// Índices
newsSchema.index({ slug: 1 });
newsSchema.index({ category: 1 });
newsSchema.index({ isPublished: 1 });
newsSchema.index({ publishedAt: -1 });
newsSchema.index({ title: 'text', summary: 'text' });

// Método para publicar
newsSchema.methods.publish = async function() {
  this.isPublished = true;
  this.publishedAt = new Date();
  await this.save();
};

// Método para despublicar
newsSchema.methods.unpublish = async function() {
  this.isPublished = false;
  await this.save();
};

// Método para incrementar vistas
newsSchema.methods.incrementView = async function() {
  this.viewCount += 1;
  await this.save();
};

// Categorías con nombres legibles
newsSchema.statics.getCategoryLabels = function() {
  return {
    'NOTICIAS': 'Noticias',
    'COMUNICADOS': 'Comunicados',
    'EVENTOS': 'Eventos',
    'CONVOCATORIAS': 'Convocatorias'
  };
};

export default mongoose.model('News', newsSchema);
