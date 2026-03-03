import mongoose from 'mongoose';

const securityIncidentSchema = new mongoose.Schema({
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedByName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: [
      'unauthorized_access',
      'data_leak',
      'system_compromise',
      'phishing',
      'malware',
      'denial_of_service',
      'other'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 5000
  },
  dataAffected: {
    type: [String],
    default: []
  },
  usersAffectedCount: {
    type: Number,
    default: 0
  },
  measuresTaken: {
    type: String,
    maxlength: 3000,
    default: ''
  },
  status: {
    type: String,
    enum: ['reported', 'investigating', 'contained', 'resolved', 'closed'],
    default: 'reported'
  },
  notifiedAgency: {
    type: Boolean,
    default: false
  },
  notifiedAgencyAt: {
    type: Date,
    default: null
  },
  notifiedUsers: {
    type: Boolean,
    default: false
  },
  notifiedUsersAt: {
    type: Date,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  ipAddress: {
    type: String
  }
}, {
  timestamps: true
});

securityIncidentSchema.index({ status: 1 });
securityIncidentSchema.index({ createdAt: -1 });
securityIncidentSchema.index({ severity: 1 });

export default mongoose.model('SecurityIncident', securityIncidentSchema);
