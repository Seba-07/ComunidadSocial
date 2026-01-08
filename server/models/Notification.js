import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false  // No longer required - can be ministroId instead
  },
  ministroId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // Ministros son Users con role: 'MINISTRO_FE'
    required: false
  },
  type: {
    type: String,
    enum: [
      // Notificaciones de organizaciones
      'ministro_assigned',
      'ministro_changed',
      'schedule_change',
      'location_change',
      'schedule_location_change',
      'status_change',
      'correction_required',
      'organization_approved',
      'organization_rejected',
      'general',
      // Tipos para notificaciones de ministros
      'new_assignment',
      'assignment_removed',
      'assignment_schedule_change',
      'assignment_location_change',
      // Nuevos tipos para gestión de organizaciones activas
      'member_accounts_created',
      'new_assembly',
      'assembly_reminder',
      'election_announced',
      'election_reminder',
      'directorio_updated',
      'new_communication',
      'new_member_joined',
      'member_removed',
      // Tipos para miembros
      'welcome_member',
      'assembly_invitation',
      'election_notification',
      'organization_update'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: mongoose.Schema.Types.Mixed,
  read: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ ministroId: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
