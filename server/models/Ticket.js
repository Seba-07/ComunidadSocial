import mongoose from 'mongoose';

const TICKET_CATEGORIES = ['SUBVENCION', 'CIERRE_CALLE', 'CERTIFICADO', 'OTRO'];
const TICKET_STATUSES = ['PENDIENTE', 'EN_REVISION', 'RESUELTO', 'RECHAZADO'];

const ticketSchema = new mongoose.Schema({
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
  category: {
    type: String,
    enum: TICKET_CATEGORIES,
    required: true
  },
  status: {
    type: String,
    enum: TICKET_STATUSES,
    default: 'PENDIENTE'
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resolutionNote: {
    type: String,
    maxlength: 5000,
    default: ''
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

ticketSchema.index({ organizationId: 1, createdAt: -1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ createdAt: -1 });

export { TICKET_CATEGORIES, TICKET_STATUSES };
export default mongoose.model('Ticket', ticketSchema);
