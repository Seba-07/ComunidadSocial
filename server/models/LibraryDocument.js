import mongoose from 'mongoose';

const libraryDocumentSchema = new mongoose.Schema({
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
    enum: ['FORMULARIOS', 'LEYES', 'GUIAS', 'PLANTILLAS', 'OTROS'],
    default: 'OTROS'
  },
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  downloadCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Índice para búsqueda
libraryDocumentSchema.index({ name: 'text', description: 'text' });
libraryDocumentSchema.index({ category: 1 });
libraryDocumentSchema.index({ isPublished: 1 });

// Método para incrementar contador de descargas
libraryDocumentSchema.methods.incrementDownload = async function() {
  this.downloadCount += 1;
  await this.save();
};

// Categorías con nombres legibles
libraryDocumentSchema.statics.getCategoryLabels = function() {
  return {
    'FORMULARIOS': 'Formularios',
    'LEYES': 'Leyes y Normativas',
    'GUIAS': 'Guías y Manuales',
    'PLANTILLAS': 'Plantillas',
    'OTROS': 'Otros Documentos'
  };
};

export default mongoose.model('LibraryDocument', libraryDocumentSchema);
