import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String
  },
  userRole: {
    type: String
  },
  action: {
    type: String,
    enum: [
      'CREATE',
      'UPDATE',
      'DELETE',
      'STATUS_CHANGE',
      'LOGIN',
      'LOGOUT',
      'ASSIGN',
      'APPROVE',
      'REJECT',
      'UPLOAD',
      'DOWNLOAD',
      'EXPORT'
    ],
    required: true
  },
  resource: {
    type: String,
    enum: [
      'ORGANIZATION',
      'USER',
      'MINISTRO',
      'ASSIGNMENT',
      'NEWS',
      'DOCUMENT',
      'ESTATUTO',
      'UNIDAD_VECINAL',
      'NOTIFICATION',
      'GUIA',
      'LIBRARY_DOCUMENT',
      'SYSTEM'
    ],
    required: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  resourceName: {
    type: String
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ resource: 1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });

// TTL index: auto-delete logs after 365 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

/**
 * Static method to create an audit log entry.
 * @param {Object} data - Log entry data
 * @param {string} data.userId - ID of the user performing the action
 * @param {string} [data.userName] - Name of the user
 * @param {string} [data.userRole] - Role of the user
 * @param {string} data.action - Action performed (CREATE, UPDATE, etc.)
 * @param {string} data.resource - Resource type (ORGANIZATION, USER, etc.)
 * @param {string} [data.resourceId] - ID of the affected resource
 * @param {string} [data.resourceName] - Name of the affected resource
 * @param {Object} [data.details] - Additional details about the action
 * @param {string} [data.ipAddress] - Client IP address
 * @param {string} [data.userAgent] - Client user agent string
 * @returns {Promise<Document>} The created audit log entry
 */
auditLogSchema.statics.logAction = async function(data) {
  try {
    const entry = new this(data);
    return await entry.save();
  } catch (error) {
    // Log the error but don't throw - audit logging should never break the main flow
    console.error('AuditLog.logAction error:', error.message);
    return null;
  }
};

export default mongoose.model('AuditLog', auditLogSchema);
