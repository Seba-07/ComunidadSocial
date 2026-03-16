import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema({
  // Reporter info (from JWT if authenticated, or from form if anonymous)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true, maxlength: 200 },
  rut: { type: String, default: '' },
  email: { type: String, required: true, maxlength: 200 },
  role: { type: String, default: '' },

  // Ticket content
  description: { type: String, required: true, maxlength: 5000 },

  // Status tracking
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },

  // Metadata
  ipAddress: { type: String, default: '' },
  userAgent: { type: String, default: '' }
}, {
  timestamps: true
});

supportTicketSchema.index({ status: 1 });
supportTicketSchema.index({ createdAt: -1 });
supportTicketSchema.index({ userId: 1 });

export default mongoose.model('SupportTicket', supportTicketSchema);
