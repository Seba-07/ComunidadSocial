import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

// Método estático para obtener el siguiente número
counterSchema.statics.getNextSequence = async function(name) {
  const year = new Date().getFullYear();
  const counterId = `${name}_${year}`;

  const counter = await this.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return counter.seq;
};

// Generar número formateado: XXX/YYYY
counterSchema.statics.generateNumber = async function(type) {
  const seq = await this.getNextSequence(type);
  const year = new Date().getFullYear();
  return `${String(seq).padStart(3, '0')}/${year}`;
};

export default mongoose.model('Counter', counterSchema);
