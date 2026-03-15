import mongoose from 'mongoose';

const ministroBlockSchema = new mongoose.Schema({
  ministroId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ministroName: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true  // YYYY-MM-DD
  },
  time: {
    type: String,
    default: null  // HH:MM o null (día completo)
  },
  endTime: {
    type: String,
    default: null  // HH:MM para bloques de duración
  },
  blockType: {
    type: String,
    enum: ['manual', 'duration', 'full_day'],
    default: 'manual'
  },
  reason: {
    type: String,
    default: ''
  },
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    default: null
  },
  status: {
    type: String,
    enum: ['approved', 'pending'],
    default: 'approved'
  },
  active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

// Índices
ministroBlockSchema.index({ ministroId: 1, date: 1, active: 1 });
ministroBlockSchema.index({ date: 1, active: 1 });
ministroBlockSchema.index({ assignmentId: 1 });

export default mongoose.model('MinistroBlock', ministroBlockSchema);
