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

// requiredFor: array de tipos de documento donde este placeholder es OBLIGATORIO
// Si está vacío o ausente, el placeholder es opcional para todos los tipos
const AVAILABLE_PLACEHOLDERS = [
  // --- Datos de la organización (obligatorios en acta + carta) ---
  { key: 'NOMBRE_ORG', label: 'Nombre organización', description: 'Nombre completo de la organización', requiredFor: ['acta_constitutiva', 'lista_socios', 'nomina_directorio', 'carta_solicitud'] },
  { key: 'TIPO_ORG', label: 'Tipo organización', description: 'Tipo legible (ej: Club Deportivo)', requiredFor: ['acta_constitutiva', 'carta_solicitud'] },
  { key: 'DIRECCION', label: 'Dirección', description: 'Dirección completa', requiredFor: ['acta_constitutiva'] },
  { key: 'COMUNA', label: 'Comuna', description: 'Comuna de la municipalidad (valor fijo)', requiredFor: ['acta_constitutiva', 'carta_solicitud'] },
  { key: 'REGION', label: 'Región', description: 'Región', requiredFor: [] },
  { key: 'UNIDAD_VECINAL', label: 'Unidad Vecinal', description: 'Unidad vecinal', requiredFor: [] },
  { key: 'EMAIL', label: 'Email contacto', description: 'Email de contacto', requiredFor: [] },
  { key: 'TELEFONO', label: 'Teléfono', description: 'Teléfono de contacto', requiredFor: [] },
  { key: 'OBJETIVOS', label: 'Objetivos', description: 'Objetivos de la organización', requiredFor: ['acta_constitutiva'] },
  // --- Miembros ---
  { key: 'TOTAL_SOCIOS', label: 'Total socios', description: 'Cantidad total de miembros', requiredFor: ['acta_constitutiva', 'lista_socios'] },
  { key: 'LISTA_SOCIOS', label: 'Lista de socios', description: 'Tabla con nombres y RUTs de socios', requiredFor: ['lista_socios'] },
  // --- Directorio ---
  { key: 'PRESIDENTE', label: 'Presidente', description: 'Nombre del presidente', requiredFor: ['acta_constitutiva', 'nomina_directorio'] },
  { key: 'RUT_PRESIDENTE', label: 'RUT Presidente', description: 'RUT del presidente', requiredFor: ['acta_constitutiva', 'nomina_directorio'] },
  { key: 'SECRETARIO', label: 'Secretario', description: 'Nombre del secretario', requiredFor: ['acta_constitutiva', 'nomina_directorio'] },
  { key: 'RUT_SECRETARIO', label: 'RUT Secretario', description: 'RUT del secretario', requiredFor: ['nomina_directorio'] },
  { key: 'TESORERO', label: 'Tesorero', description: 'Nombre del tesorero', requiredFor: ['acta_constitutiva', 'nomina_directorio'] },
  { key: 'RUT_TESORERO', label: 'RUT Tesorero', description: 'RUT del tesorero', requiredFor: ['nomina_directorio'] },
  { key: 'DIRECTORES', label: 'Directores', description: 'Lista de directores adicionales', requiredFor: ['nomina_directorio'] },
  { key: 'COMISION_ELECTORAL', label: 'Comisión Electoral', description: 'Lista comisión electoral', requiredFor: [] },
  // --- Asamblea ---
  { key: 'FECHA_ASAMBLEA', label: 'Fecha asamblea', description: 'Fecha programada de asamblea', requiredFor: ['acta_constitutiva'] },
  { key: 'HORA_ASAMBLEA', label: 'Hora asamblea', description: 'Hora programada de asamblea', requiredFor: [] },
  { key: 'HORA_INICIO_ASAMBLEA', label: 'Hora inicio', description: 'Hora de inicio de la asamblea', requiredFor: ['acta_constitutiva'] },
  { key: 'HORA_TERMINO_ASAMBLEA', label: 'Hora término', description: 'Hora de término de la asamblea', requiredFor: [] },
  { key: 'UBICACION_ASAMBLEA', label: 'Ubicación asamblea', description: 'Dirección donde se realiza la asamblea', requiredFor: ['acta_constitutiva'] },
  // --- Votación ---
  { key: 'VOTOS_FAVOR', label: 'Votos a favor', description: 'Cantidad de votos a favor', requiredFor: [] },
  { key: 'VOTOS_CONTRA', label: 'Votos en contra', description: 'Cantidad de votos en contra', requiredFor: [] },
  { key: 'ABSTENCIONES', label: 'Abstenciones', description: 'Cantidad de abstenciones', requiredFor: [] },
  // --- Configuración de la organización ---
  { key: 'DURACION_MANDATO', label: 'Duración mandato', description: 'Años de duración del mandato', requiredFor: ['acta_constitutiva'] },
  { key: 'CUOTA_INCORPORACION', label: 'Cuota incorporación', description: 'Cuota de incorporación (en la moneda configurada)', requiredFor: ['acta_constitutiva'] },
  { key: 'CUOTA_MENSUAL', label: 'Cuota mensual', description: 'Rango de cuota mensual (ej: mínima de 0.1 UTM y máxima de 0.5 UTM)', requiredFor: ['acta_constitutiva'] },
  { key: 'METODO_CITACION', label: 'Método de citación', description: 'Método de citación a asambleas (ej: carta certificada al domicilio registrado)', requiredFor: ['acta_constitutiva'] },
  { key: 'DIAS_ANTICIPACION', label: 'Días de anticipación', description: 'Días de anticipación para citación a asambleas', requiredFor: ['acta_constitutiva'] },
  { key: 'MESES_ASAMBLEA', label: 'Meses de asamblea', description: 'Meses en que se realizan asambleas ordinarias', requiredFor: ['acta_constitutiva'] },
  { key: 'MES_INFORME', label: 'Mes informe Comisión Revisora', description: 'Mes en que la Comisión Revisora presenta el balance anual', requiredFor: ['acta_constitutiva'] },
  { key: 'ENTIDAD_DISOLUCION', label: 'Entidad disolución', description: 'Entidad beneficiaria en caso de disolución', requiredFor: ['acta_constitutiva'] },
  { key: 'RUT_DISOLUCION', label: 'RUT disolución', description: 'RUT de la entidad beneficiaria de disolución', requiredFor: [] },
  // --- Fechas y firmas ---
  { key: 'FECHA_HOY', label: 'Fecha actual', description: 'Fecha del día de generación', requiredFor: ['carta_solicitud'] },
  { key: 'MINISTRO_FE', label: 'Ministro de Fe', description: 'Nombre del ministro de fe', requiredFor: ['acta_constitutiva'] },
  { key: 'RUT_MINISTRO_FE', label: 'RUT Ministro de Fe', description: 'RUT del ministro de fe', requiredFor: ['acta_constitutiva'] },
  { key: 'FIRMA_PRESIDENTE', label: 'Firma Presidente', description: 'Bloque de firma: línea + nombre + cargo + RUT del presidente', requiredFor: ['acta_constitutiva', 'carta_solicitud'] },
  { key: 'FIRMA_SECRETARIO', label: 'Firma Secretario', description: 'Bloque de firma: línea + nombre + cargo + RUT del secretario', requiredFor: ['acta_constitutiva'] },
  { key: 'FIRMA_TESORERO', label: 'Firma Tesorero', description: 'Bloque de firma: línea + nombre + cargo + RUT del tesorero', requiredFor: [] },
  { key: 'FIRMA_MINISTRO_FE', label: 'Firma Ministro de Fe', description: 'Bloque de firma: línea + nombre + cargo + RUT del ministro de fe', requiredFor: ['acta_constitutiva'] },
];

const headerFooterSchema = new mongoose.Schema({
  imageS3Key: { type: String, default: null },
  imageMimeType: { type: String, default: null },
  text: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  height: { type: Number, default: 40 },
  showColorBar: { type: Boolean, default: true },
  backgroundColor: { type: String, default: null },
}, { _id: false });

const placeholderSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  description: { type: String, default: '' },
  requiredFor: { type: [String], default: [] }
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
  },
  pageSize: {
    type: String,
    enum: ['letter', 'legal'],
    default: 'letter'
  },
  headerConfig: { type: headerFooterSchema, default: () => ({}) },
  footerConfig: { type: headerFooterSchema, default: () => ({}) }
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
