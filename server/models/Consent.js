import mongoose from 'mongoose';

const consentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  purpose: {
    type: String,
    enum: ['essential', 'notifications_email', 'data_sharing_municipality'],
    required: true
  },
  granted: {
    type: Boolean,
    required: true,
    default: false
  },
  grantedAt: {
    type: Date,
    default: null
  },
  withdrawnAt: {
    type: Date,
    default: null
  },
  version: {
    type: String,
    default: '1.0'
  },
  ipAddress: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Compound unique index: one consent record per user per purpose
consentSchema.index({ userId: 1, purpose: 1 }, { unique: true });

export default mongoose.model('Consent', consentSchema);
