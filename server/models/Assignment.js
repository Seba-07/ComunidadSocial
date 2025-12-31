import mongoose from 'mongoose';

const signatureSchema = new mongoose.Schema({
  memberId: String,
  memberName: String,
  memberRut: String,
  role: String,
  signature: String, // Base64
  signedAt: { type: Date, default: Date.now }
});

const validationHistorySchema = new mongoose.Schema({
  validatedAt: Date,
  validatedBy: String,
  signatures: [signatureSchema],
  resetAt: Date
});

const assignmentSchema = new mongoose.Schema({
  ministroId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ministroName: {
    type: String,
    required: true
  },
  ministroRut: String,
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  organizationName: {
    type: String,
    required: true
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledTime: {
    type: String,
    required: true
  },
  location: String,
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending'
  },

  // Validation data
  signaturesValidated: {
    type: Boolean,
    default: false
  },
  validatedAt: Date,
  validatedBy: String,
  signatures: [signatureSchema],
  validationHistory: [validationHistorySchema],

  // Wizard data
  wizardData: {
    directorio: {
      president: mongoose.Schema.Types.Mixed,
      secretary: mongoose.Schema.Types.Mixed,
      treasurer: mongoose.Schema.Types.Mixed
    },
    additionalMembers: [mongoose.Schema.Types.Mixed],
    comisionElectoral: [mongoose.Schema.Types.Mixed],
    attendees: [mongoose.Schema.Types.Mixed],
    ministroSignature: String,
    groupPhoto: String, // Foto grupal de la asamblea en Base64
    notes: String
  },

  // Completion data
  completedAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  lastEditedAt: Date
}, {
  timestamps: true
});

// Indexes
assignmentSchema.index({ ministroId: 1 });
assignmentSchema.index({ organizationId: 1 });
assignmentSchema.index({ status: 1 });
assignmentSchema.index({ scheduledDate: 1 });

export default mongoose.model('Assignment', assignmentSchema);
