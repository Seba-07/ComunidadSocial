import mongoose from 'mongoose';

// ============ SUB-SCHEMAS (mirrored from Organization.js for backward compat) ============

const candidateSchema = new mongoose.Schema({
  rut: String,
  firstName: String,
  lastName: String,
  cargo: String,
  lista: String
}, { _id: false });

// DEPRECATED: mantener para datos históricos, no usar para nuevos votos
const voteSchema = new mongoose.Schema({
  voterRut: String,
  cargo: String,
  candidateRut: String,
  lista: String,
  votedAt: { type: Date, default: Date.now }
}, { _id: false });

// Registro de quién votó (solo identidad, sin elección) — Ley 19.418 Art. 24
const voterRegistrySchema = new mongoose.Schema({
  voterRut: String,
  votedAt: { type: Date, default: Date.now }
}, { _id: false });

// Voto anónimo (solo elección, sin identidad) — Voto secreto
const anonymousVoteSchema = new mongoose.Schema({
  cargo: String,
  candidateRut: String,
  lista: String,
  votedAt: { type: Date, default: Date.now }
}, { _id: false });

const agendaResultSchema = new mongoose.Schema({
  mode: { type: String, enum: ['per_cargo', 'per_lista', 'mano_alzada', null], default: null },
  winners: mongoose.Schema.Types.Mixed,
  winningLista: String,
  listaResults: [{ lista: String, votes: Number }],
  totalVotes: Number,
  closedAt: Date,
  appliedToDirectorio: { type: Boolean, default: false },
  // Mano alzada fields
  resolucion: { type: String, enum: ['aprobado', 'rechazado', null], default: null },
  votosAFavor: Number,
  votosEnContra: Number,
  abstenciones: Number,
  observaciones: String
}, { _id: false, strict: false });

const agendaItemSchema = new mongoose.Schema({
  id: String,
  title: { type: String, required: true },
  type: {
    type: String,
    enum: ['eleccion_directorio', 'aprobacion_presupuesto', 'reforma_estatutos', 'memoria_anual', 'disolucion', 'custom'],
    default: 'custom'
  },
  description: String,
  votingMode: {
    type: String,
    enum: ['per_cargo', 'per_lista', 'mano_alzada', null],
    default: null
  },
  candidates: [candidateSchema],
  votes: [voteSchema],                       // DEPRECATED: datos históricos
  voterRegistry: [voterRegistrySchema],      // Quién votó (sin elección)
  anonymousVotes: [anonymousVoteSchema],     // Qué se votó (sin identidad)
  votingOpen: { type: Boolean, default: false },
  votingClosedAt: Date,
  result: agendaResultSchema,
  customCargos: [{ id: String, nombre: String, color: String }]
}, { _id: false });

const assemblyAttendeeSchema = new mongoose.Schema({
  rut: String,
  firstName: String,
  lastName: String,
  checkedInAt: { type: Date, default: Date.now },
  method: { type: String, enum: ['manual', 'qr', 'self'], default: 'manual' }
}, { _id: false });

// ============ MAIN ASSEMBLY SCHEMA ============

const assemblySchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  // Legacy id field for backward compat with frontend (e.g. "assembly_1234567890")
  legacyId: { type: String, index: true },

  type: { type: String, enum: ['ordinaria', 'extraordinaria'], default: 'ordinaria' },
  date: String,
  time: String,
  title: String,
  description: String,
  status: {
    type: String,
    enum: ['draft', 'convocada', 'en_curso', 'finalizada', 'cancelada'],
    default: 'draft'
  },
  quorumType: { type: String, enum: ['percentage', 'number'], default: 'percentage' },
  quorumValue: { type: Number, default: 50 },
  agendaItems: [agendaItemSchema],
  attendance: Number,
  attendees: [assemblyAttendeeSchema],
  requiresMinister: { type: Boolean, default: false },
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', default: null },
  convokedAt: Date,
  startedAt: Date,
  finishedAt: Date
}, {
  timestamps: true
});

// Indexes
assemblySchema.index({ organizationId: 1, status: 1 });
assemblySchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.model('Assembly', assemblySchema);
