/**
 * DocumentTemplate - Plantillas de documentos PDF administrables
 * Permite al admin definir contenido HTML con placeholders {{VAR}}
 * que se reemplazan con datos reales al generar PDFs
 */

import mongoose from 'mongoose';

const DOCUMENT_TYPES = [
  'acta_constitutiva',
  'lista_socios',
  'nomina_directorio',
  'carta_solicitud'
];

const DOCUMENT_TYPE_LABELS = {
  acta_constitutiva: 'Acta Constitutiva',
  lista_socios: 'Lista de Socios',
  nomina_directorio: 'Nómina del Directorio',
  carta_solicitud: 'Carta de Solicitud'
};

// Placeholders disponibles por tipo de documento
const AVAILABLE_PLACEHOLDERS = [
  { key: 'NOMBRE_ORG', label: 'Nombre organización', description: 'Nombre completo de la organización' },
  { key: 'TIPO_ORG', label: 'Tipo organización', description: 'Tipo legible (ej: Club Deportivo)' },
  { key: 'DIRECCION', label: 'Dirección', description: 'Dirección completa' },
  { key: 'COMUNA', label: 'Comuna', description: 'Comuna de la organización' },
  { key: 'REGION', label: 'Región', description: 'Región' },
  { key: 'UNIDAD_VECINAL', label: 'Unidad Vecinal', description: 'Unidad vecinal' },
  { key: 'EMAIL', label: 'Email contacto', description: 'Email de contacto' },
  { key: 'TELEFONO', label: 'Teléfono', description: 'Teléfono de contacto' },
  { key: 'OBJETIVOS', label: 'Objetivos', description: 'Objetivos de la organización' },
  { key: 'TOTAL_SOCIOS', label: 'Total socios', description: 'Cantidad total de miembros' },
  { key: 'LISTA_SOCIOS', label: 'Lista de socios', description: 'Tabla con nombres y RUTs de socios' },
  { key: 'PRESIDENTE', label: 'Presidente', description: 'Nombre del presidente' },
  { key: 'RUT_PRESIDENTE', label: 'RUT Presidente', description: 'RUT del presidente' },
  { key: 'SECRETARIO', label: 'Secretario', description: 'Nombre del secretario' },
  { key: 'RUT_SECRETARIO', label: 'RUT Secretario', description: 'RUT del secretario' },
  { key: 'TESORERO', label: 'Tesorero', description: 'Nombre del tesorero' },
  { key: 'RUT_TESORERO', label: 'RUT Tesorero', description: 'RUT del tesorero' },
  { key: 'DIRECTORES', label: 'Directores', description: 'Lista de directores adicionales' },
  { key: 'COMISION_ELECTORAL', label: 'Comisión Electoral', description: 'Lista comisión electoral' },
  { key: 'FECHA_ASAMBLEA', label: 'Fecha asamblea', description: 'Fecha programada de asamblea' },
  { key: 'HORA_ASAMBLEA', label: 'Hora asamblea', description: 'Hora programada de asamblea' },
  { key: 'DURACION_MANDATO', label: 'Duración mandato', description: 'Años de duración del mandato' },
  { key: 'CUOTA_INCORPORACION', label: 'Cuota incorporación', description: 'Cuota de incorporación en UTM' },
  { key: 'FECHA_HOY', label: 'Fecha actual', description: 'Fecha del día de generación' },
  { key: 'MINISTRO_FE', label: 'Ministro de Fe', description: 'Nombre del ministro de fe' },
  { key: 'UBICACION_ASAMBLEA', label: 'Ubicación asamblea', description: 'Dirección donde se realiza la asamblea' },
];

const placeholderSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  description: { type: String, default: '' }
}, { _id: false });

const documentTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nombre de plantilla es requerido'],
    trim: true,
    maxlength: 200
  },
  documentType: {
    type: String,
    required: [true, 'Tipo de documento es requerido'],
    enum: DOCUMENT_TYPES
  },
  content: {
    type: String,
    default: '',
    maxlength: 50000
  },
  placeholders: {
    type: [placeholderSchema],
    default: () => AVAILABLE_PLACEHOLDERS
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  activo: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Ensure only one default per documentType
documentTemplateSchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { documentType: this.documentType, _id: { $ne: this._id }, isDefault: true },
      { isDefault: false }
    );
  }
  next();
});

documentTemplateSchema.index({ documentType: 1, activo: 1 });
documentTemplateSchema.index({ isDefault: 1, documentType: 1 });

export { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, AVAILABLE_PLACEHOLDERS };
export default mongoose.model('DocumentTemplate', documentTemplateSchema);
