import mongoose from 'mongoose';

// Sub-esquema para artículos individuales del estatuto
const articuloSchema = new mongoose.Schema({
  numero: {
    type: Number,
    required: true
  },
  titulo: {
    type: String,
    required: true,
    trim: true
  },
  contenido: {
    type: String,
    required: true
  },
  esEditable: {
    type: Boolean,
    default: true
  },
  orden: {
    type: Number,
    required: true
  }
}, { _id: true });

// Sub-esquema para cargos del directorio
const cargoSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  nombre: {
    type: String,
    required: true
  },
  descripcion: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: '#3b82f6'
  },
  required: {
    type: Boolean,
    default: true
  },
  orden: {
    type: Number,
    required: true
  }
}, { _id: false });

// Sub-esquema para placeholders personalizables
const placeholderSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  tipo: {
    type: String,
    enum: ['text', 'date', 'number', 'select', 'month'],
    default: 'text'
  },
  required: {
    type: Boolean,
    default: false
  },
  defaultValue: {
    type: String
  },
  opciones: [{
    value: String,
    label: String
  }]
}, { _id: false });

// Sub-esquema para imágenes de header/footer
const imagenDocumentoSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['header', 'footer'],
    required: true
  },
  url: {
    type: String,
    required: true
  },
  fileName: {
    type: String
  },
  width: {
    type: Number,
    default: null
  },
  height: {
    type: Number,
    default: null
  },
  alignment: {
    type: String,
    enum: ['left', 'center', 'right'],
    default: 'center'
  }
}, { _id: false });

// Sub-esquema para historial de versiones
const versionHistorialSchema = new mongoose.Schema({
  version: {
    type: Number,
    required: true
  },
  fecha: {
    type: Date,
    default: Date.now
  },
  modificadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  descripcionCambio: {
    type: String
  },
  snapshot: {
    type: mongoose.Schema.Types.Mixed
  }
}, { _id: true });

// Lista completa de tipos de organización
const TIPOS_ORGANIZACION = [
  // Territoriales
  'JUNTA_VECINOS', 'COMITE_VECINOS',
  // Clubes
  'CLUB_DEPORTIVO', 'CLUB_ADULTO_MAYOR', 'CLUB_JUVENIL', 'CLUB_CULTURAL',
  // Centros
  'CENTRO_MADRES', 'CENTRO_PADRES', 'CENTRO_CULTURAL',
  // Agrupaciones
  'AGRUPACION_FOLCLORICA', 'AGRUPACION_CULTURAL', 'AGRUPACION_JUVENIL',
  'AGRUPACION_AMBIENTAL', 'AGRUPACION_EMPRENDEDORES',
  // Comités
  'COMITE_VIVIENDA', 'COMITE_ALLEGADOS', 'COMITE_APR',
  'COMITE_ADELANTO', 'COMITE_MEJORAMIENTO', 'COMITE_CONVIVENCIA',
  // Organizaciones específicas
  'ORG_SCOUT', 'ORG_MUJERES', 'ORG_INDIGENA', 'ORG_SALUD', 'ORG_SOCIAL', 'ORG_CULTURAL',
  // Arte y cultura
  'GRUPO_TEATRO', 'CORO', 'TALLER_ARTESANIA',
  // Genéricos
  'ORG_COMUNITARIA', 'ORG_FUNCIONAL', 'OTRA_FUNCIONAL',
  // Consejos escolares y centros de estudiantes
  'CONSEJO_ESCOLAR', 'CENTRO_ESTUDIANTES'
];

// Esquema principal de EstatutoTemplate
const estatutoTemplateSchema = new mongoose.Schema({
  // Identificador del tipo de organización
  tipoOrganizacion: {
    type: String,
    required: true,
    unique: true,
    enum: TIPOS_ORGANIZACION
  },

  // Nombre legible del tipo
  nombreTipo: {
    type: String,
    required: true
  },

  // Descripción del estatuto
  descripcion: {
    type: String,
    default: ''
  },

  // Categoría (para agrupar en el UI)
  categoria: {
    type: String,
    enum: ['TERRITORIAL', 'FUNCIONAL', 'EDUCACIONAL', 'CULTURAL', 'SOCIAL', 'OTRO'],
    default: 'FUNCIONAL'
  },

  // Artículos del estatuto (ordenados)
  articulos: [articuloSchema],

  // Configuración del directorio
  directorio: {
    cargos: [cargoSchema],
    totalRequerido: {
      type: Number,
      required: true,
      default: 5
    },
    duracionMandato: {
      type: Number,
      default: 2 // años
    },
    puedeReelegirse: {
      type: Boolean,
      default: true
    },
    maxReelecciones: {
      type: Number,
      default: 2
    }
  },

  // Configuración de miembros mínimos
  miembrosMinimos: {
    type: Number,
    default: 15
  },

  // Configuración de comisión electoral
  comisionElectoral: {
    cantidad: {
      type: Number,
      default: 3
    },
    descripcion: {
      type: String,
      default: 'Miembros que organizan las elecciones'
    }
  },

  // Placeholders para campos dinámicos
  placeholders: [placeholderSchema],

  // Imágenes para el documento PDF
  imagenesDocumento: [imagenDocumentoSchema],

  // Texto completo del estatuto (generado desde artículos)
  documentoCompleto: {
    type: String,
    default: ''
  },

  // Versionado
  version: {
    type: Number,
    default: 1
  },
  historialVersiones: [versionHistorialSchema],

  // Estado
  activo: {
    type: Boolean,
    default: true
  },
  publicado: {
    type: Boolean,
    default: false
  },

  // Auditoría
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  modificadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Índices
estatutoTemplateSchema.index({ tipoOrganizacion: 1 });
estatutoTemplateSchema.index({ activo: 1, publicado: 1 });
estatutoTemplateSchema.index({ categoria: 1 });

// Método para generar el documento completo desde los artículos
estatutoTemplateSchema.methods.generarDocumentoCompleto = function() {
  let documento = `ESTATUTOS\n${this.nombreTipo.toUpperCase()}\n\n`;

  const articulosOrdenados = [...this.articulos].sort((a, b) => a.orden - b.orden);

  articulosOrdenados.forEach(articulo => {
    documento += `Artículo ${articulo.numero}: ${articulo.titulo}\n\n`;
    documento += `${articulo.contenido}\n\n`;
  });

  return documento;
};

// Método para crear snapshot al guardar cambios
estatutoTemplateSchema.methods.crearVersion = function(userId, descripcion) {
  this.historialVersiones.push({
    version: this.version,
    modificadoPor: userId,
    descripcionCambio: descripcion,
    snapshot: {
      articulos: this.articulos.toObject ? this.articulos.toObject() : this.articulos,
      directorio: this.directorio.toObject ? this.directorio.toObject() : this.directorio,
      placeholders: this.placeholders.toObject ? this.placeholders.toObject() : this.placeholders,
      imagenesDocumento: this.imagenesDocumento.toObject ? this.imagenesDocumento.toObject() : this.imagenesDocumento,
      documentoCompleto: this.documentoCompleto,
      miembrosMinimos: this.miembrosMinimos,
      comisionElectoral: this.comisionElectoral.toObject ? this.comisionElectoral.toObject() : this.comisionElectoral
    }
  });
  this.version += 1;
  this.modificadoPor = userId;
};

// Método para obtener snapshot para guardar en organización
estatutoTemplateSchema.methods.obtenerSnapshot = function() {
  return {
    templateId: this._id,
    version: this.version,
    tipoOrganizacion: this.tipoOrganizacion,
    nombreTipo: this.nombreTipo,
    articulos: this.articulos,
    directorio: this.directorio,
    miembrosMinimos: this.miembrosMinimos,
    comisionElectoral: this.comisionElectoral,
    placeholders: this.placeholders,
    imagenesDocumento: this.imagenesDocumento,
    documentoCompleto: this.documentoCompleto,
    fechaSnapshot: new Date()
  };
};

// Método estático para obtener configuración default
estatutoTemplateSchema.statics.getDefaultConfig = function(tipoOrganizacion) {
  return {
    tipoOrganizacion,
    directorio: {
      cargos: [
        { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
        { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
        { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
        { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
        { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true, orden: 5 }
      ],
      totalRequerido: 5
    },
    miembrosMinimos: 15,
    comisionElectoral: {
      cantidad: 3
    },
    placeholders: []
  };
};

// Método estático para obtener nombres legibles de tipos
estatutoTemplateSchema.statics.getTiposConNombres = function() {
  return {
    // Territoriales
    'JUNTA_VECINOS': { nombre: 'Junta de Vecinos', categoria: 'TERRITORIAL' },
    'COMITE_VECINOS': { nombre: 'Comité de Vecinos', categoria: 'TERRITORIAL' },
    // Clubes
    'CLUB_DEPORTIVO': { nombre: 'Club Deportivo', categoria: 'FUNCIONAL' },
    'CLUB_ADULTO_MAYOR': { nombre: 'Club de Adulto Mayor', categoria: 'SOCIAL' },
    'CLUB_JUVENIL': { nombre: 'Club Juvenil', categoria: 'SOCIAL' },
    'CLUB_CULTURAL': { nombre: 'Club Cultural', categoria: 'CULTURAL' },
    // Centros
    'CENTRO_MADRES': { nombre: 'Centro de Madres', categoria: 'SOCIAL' },
    'CENTRO_PADRES': { nombre: 'Centro de Padres y Apoderados', categoria: 'EDUCACIONAL' },
    'CENTRO_CULTURAL': { nombre: 'Centro Cultural', categoria: 'CULTURAL' },
    // Agrupaciones
    'AGRUPACION_FOLCLORICA': { nombre: 'Agrupación Folclórica', categoria: 'CULTURAL' },
    'AGRUPACION_CULTURAL': { nombre: 'Agrupación Cultural', categoria: 'CULTURAL' },
    'AGRUPACION_JUVENIL': { nombre: 'Agrupación Juvenil', categoria: 'SOCIAL' },
    'AGRUPACION_AMBIENTAL': { nombre: 'Agrupación Ambiental', categoria: 'FUNCIONAL' },
    'AGRUPACION_EMPRENDEDORES': { nombre: 'Agrupación de Emprendedores', categoria: 'FUNCIONAL' },
    // Comités
    'COMITE_VIVIENDA': { nombre: 'Comité de Vivienda', categoria: 'FUNCIONAL' },
    'COMITE_ALLEGADOS': { nombre: 'Comité de Allegados', categoria: 'FUNCIONAL' },
    'COMITE_APR': { nombre: 'Comité de Agua Potable Rural', categoria: 'FUNCIONAL' },
    'COMITE_ADELANTO': { nombre: 'Comité de Adelanto', categoria: 'TERRITORIAL' },
    'COMITE_MEJORAMIENTO': { nombre: 'Comité de Mejoramiento', categoria: 'TERRITORIAL' },
    'COMITE_CONVIVENCIA': { nombre: 'Comité de Convivencia Vecinal', categoria: 'TERRITORIAL' },
    // Organizaciones específicas
    'ORG_SCOUT': { nombre: 'Organización Scout', categoria: 'SOCIAL' },
    'ORG_MUJERES': { nombre: 'Organización de Mujeres', categoria: 'SOCIAL' },
    'ORG_INDIGENA': { nombre: 'Organización Indígena', categoria: 'CULTURAL' },
    'ORG_SALUD': { nombre: 'Organización de Salud', categoria: 'SOCIAL' },
    'ORG_SOCIAL': { nombre: 'Organización Social', categoria: 'SOCIAL' },
    'ORG_CULTURAL': { nombre: 'Organización Cultural', categoria: 'CULTURAL' },
    // Arte y cultura
    'GRUPO_TEATRO': { nombre: 'Grupo de Teatro', categoria: 'CULTURAL' },
    'CORO': { nombre: 'Coro', categoria: 'CULTURAL' },
    'TALLER_ARTESANIA': { nombre: 'Taller de Artesanía', categoria: 'CULTURAL' },
    // Genéricos
    'ORG_COMUNITARIA': { nombre: 'Organización Comunitaria', categoria: 'FUNCIONAL' },
    'ORG_FUNCIONAL': { nombre: 'Organización Funcional', categoria: 'FUNCIONAL' },
    'OTRA_FUNCIONAL': { nombre: 'Otra Organización Funcional', categoria: 'FUNCIONAL' },
    // Educacionales
    'CONSEJO_ESCOLAR': { nombre: 'Consejo Escolar', categoria: 'EDUCACIONAL' },
    'CENTRO_ESTUDIANTES': { nombre: 'Centro de Estudiantes', categoria: 'EDUCACIONAL' }
  };
};

// Virtual para obtener el nombre legible
estatutoTemplateSchema.virtual('tipoNombreLegible').get(function() {
  const tipos = this.constructor.getTiposConNombres();
  return tipos[this.tipoOrganizacion]?.nombre || this.tipoOrganizacion;
});

// Exportar lista de tipos
export const TIPOS_ORGANIZACION_LIST = TIPOS_ORGANIZACION;

export default mongoose.model('EstatutoTemplate', estatutoTemplateSchema);
