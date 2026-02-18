import mongoose from 'mongoose';

const certificateFilesSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true
  },
  certificates: [{
    memberId: { type: String, required: true },
    memberName: { type: String, default: '' },
    certificate: { type: String, required: true }, // Base64
    uploadedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

certificateFilesSchema.index({ organizationId: 1 });

export default mongoose.model('CertificateFiles', certificateFilesSchema);
