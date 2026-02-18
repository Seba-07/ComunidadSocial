import mongoose from 'mongoose';

const generatedDocumentsSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true
  },
  documents: [{
    docType: { type: String, required: true },
    content: { type: String, required: true },
    generatedAt: { type: Date },
    editedAt: { type: Date, default: null },
    cargoId: { type: String, default: null },
    cargoNombre: { type: String, default: null }
  }]
}, { timestamps: true });

generatedDocumentsSchema.index({ organizationId: 1 });

export default mongoose.model('GeneratedDocuments', generatedDocumentsSchema);
