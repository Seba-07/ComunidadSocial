import mongoose from 'mongoose';

const bulletinSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  targetAudience: {
    type: String,
    enum: [
      'TODAS',
      // Territoriales
      'JUNTA_VECINOS',
      'COMITE_VECINOS',
      // Clubes
      'CLUB_DEPORTIVO',
      'CLUB_ADULTO_MAYOR',
      'CLUB_JUVENIL',
      'CLUB_CULTURAL',
      // Centros
      'CENTRO_MADRES',
      'CENTRO_PADRES',
      'CENTRO_CULTURAL',
      // Agrupaciones
      'AGRUPACION_FOLCLORICA',
      'AGRUPACION_CULTURAL',
      'AGRUPACION_JUVENIL',
      'AGRUPACION_AMBIENTAL',
      'AGRUPACION_EMPRENDEDORES',
      // Comités
      'COMITE_VIVIENDA',
      'COMITE_ALLEGADOS',
      'COMITE_APR',
      'COMITE_ADELANTO',
      'COMITE_MEJORAMIENTO',
      'COMITE_CONVIVENCIA',
      // Organizaciones
      'ORG_SCOUT',
      'ORG_MUJERES',
      'ORG_INDIGENA',
      'ORG_SALUD',
      'ORG_SOCIAL',
      'ORG_CULTURAL',
      // Arte
      'GRUPO_TEATRO',
      'CORO',
      'TALLER_ARTESANIA',
      // Genéricos
      'ORG_COMUNITARIA',
      'ORG_FUNCIONAL',
      'OTRA_FUNCIONAL',
      // Registro extralegal
      'CONDOMINIO',
      'FUNDACION',
      'CORPORACION',
      // Estados especiales
      'DIRECTIVAS_VENCIDAS'
    ],
    default: 'TODAS'
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

bulletinSchema.index({ targetAudience: 1 });
bulletinSchema.index({ createdAt: -1 });

export default mongoose.model('Bulletin', bulletinSchema);
