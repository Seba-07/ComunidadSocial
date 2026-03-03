import mongoose from 'mongoose';

const unidadVecinalSchema = new mongoose.Schema({
  numero: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  idOficial: {
    type: String,
    required: true,
    unique: true
  },
  nombre: {
    type: String,
    default: ''
  },
  macrozona: {
    type: Number,
    min: 1,
    max: 7
  },
  poblaciones: [{
    type: String,
    trim: true
  }],
  calles: [{
    type: String,
    trim: true
  }],
  limites: {
    norte: { type: String, default: '' },
    sur: { type: String, default: '' },
    oriente: { type: String, default: '' },
    poniente: { type: String, default: '' }
  },
  palabrasClave: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  // GeoJSON polygon for geographic boundary
  geometry: {
    type: {
      type: String,
      enum: ['Polygon'],
      default: undefined
    },
    coordinates: {
      type: [[[Number]]],
      default: undefined
    }
  },
  activa: {
    type: Boolean,
    default: true
  },
  notas: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Text search index
unidadVecinalSchema.index({
  poblaciones: 'text',
  calles: 'text',
  palabrasClave: 'text',
  nombre: 'text'
});

// Geospatial index for polygon queries
unidadVecinalSchema.index({ geometry: '2dsphere' }, { sparse: true });

// Find UV by geographic point (lat/lng)
unidadVecinalSchema.statics.findByPoint = async function(lng, lat) {
  return this.findOne({
    activa: true,
    geometry: {
      $geoIntersects: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      }
    }
  });
};

// Search UV by address: geocoding first, then text fallback
unidadVecinalSchema.statics.buscarPorDireccion = async function(direccion, coords) {
  if (!direccion && !coords) return null;

  // If we have coordinates, try geospatial query first
  if (coords?.lat && coords?.lng) {
    const geoResult = await this.findByPoint(coords.lng, coords.lat);
    if (geoResult) return geoResult;
  }

  if (!direccion) return null;

  const direccionLower = direccion.toLowerCase();

  // Text-based matching: poblaciones, calles, keywords
  const uvs = await this.find({ activa: true });

  for (const uv of uvs) {
    for (const poblacion of uv.poblaciones) {
      if (direccionLower.includes(poblacion.toLowerCase())) return uv;
    }
    for (const calle of uv.calles) {
      if (direccionLower.includes(calle.toLowerCase())) return uv;
    }
    for (const keyword of uv.palabrasClave) {
      if (direccionLower.includes(keyword)) return uv;
    }
  }

  // Full-text search fallback
  const resultado = await this.findOne({
    $text: { $search: direccion },
    activa: true
  });

  return resultado;
};

export default mongoose.model('UnidadVecinal', unidadVecinalSchema);
