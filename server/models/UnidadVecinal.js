import mongoose from 'mongoose';

const unidadVecinalSchema = new mongoose.Schema({
  // Número de la unidad vecinal (ej: "001", "19A", "23B")
  numero: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  // ID oficial del Ministerio de Desarrollo Social
  idOficial: {
    type: String,
    required: true,
    unique: true
  },

  // Nombre descriptivo (puede ser igual al número o un nombre personalizado)
  nombre: {
    type: String,
    default: ''
  },

  // Macrozona a la que pertenece (1-7)
  macrozona: {
    type: Number,
    min: 1,
    max: 7
  },

  // Poblaciones, villas y barrios que pertenecen a esta UV
  poblaciones: [{
    type: String,
    trim: true
  }],

  // Calles principales que delimitan o pertenecen a esta UV
  calles: [{
    type: String,
    trim: true
  }],

  // Límites geográficos (descripción textual)
  limites: {
    norte: { type: String, default: '' },
    sur: { type: String, default: '' },
    oriente: { type: String, default: '' },
    poniente: { type: String, default: '' }
  },

  // Palabras clave para matching de direcciones
  palabrasClave: [{
    type: String,
    lowercase: true,
    trim: true
  }],

  // Si está activa o no
  activa: {
    type: Boolean,
    default: true
  },

  // Notas del administrador
  notas: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Índice para búsqueda de texto
unidadVecinalSchema.index({
  poblaciones: 'text',
  calles: 'text',
  palabrasClave: 'text',
  nombre: 'text'
});

// Método para buscar UV por dirección
unidadVecinalSchema.statics.buscarPorDireccion = async function(direccion) {
  if (!direccion) return null;

  const direccionLower = direccion.toLowerCase();

  // Primero buscar coincidencia exacta en poblaciones o calles
  const uvs = await this.find({ activa: true });

  for (const uv of uvs) {
    // Buscar en poblaciones
    for (const poblacion of uv.poblaciones) {
      if (direccionLower.includes(poblacion.toLowerCase())) {
        return uv;
      }
    }

    // Buscar en calles
    for (const calle of uv.calles) {
      if (direccionLower.includes(calle.toLowerCase())) {
        return uv;
      }
    }

    // Buscar en palabras clave
    for (const keyword of uv.palabrasClave) {
      if (direccionLower.includes(keyword)) {
        return uv;
      }
    }
  }

  // Si no se encontró, intentar búsqueda de texto
  const resultado = await this.findOne({
    $text: { $search: direccion },
    activa: true
  });

  return resultado;
};

export default mongoose.model('UnidadVecinal', unidadVecinalSchema);
