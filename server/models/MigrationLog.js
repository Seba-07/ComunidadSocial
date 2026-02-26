import mongoose from 'mongoose';

const migrationLogSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  executedAt: { type: Date, default: Date.now },
  docsAffected: { type: Number, default: 0 },
  status: { type: String, enum: ['success', 'failed', 'skipped'], default: 'success' },
  error: String
});

export default mongoose.model('MigrationLog', migrationLogSchema);
