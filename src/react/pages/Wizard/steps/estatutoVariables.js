// Variable definitions for estatuto template editor
// Used by EstatutoEditor for real-time validation and click-to-insert

export const ESTATUTO_VARIABLES = [
  { key: '{{NOMBRE_ORGANIZACION}}', label: 'Nombre de la Organización', required: true },
  { key: '{{TIPO_ORGANIZACION}}', label: 'Tipo de Organización', required: true },
  { key: '{{COMUNA}}', label: 'Comuna', required: true },
  { key: '{{REGION}}', label: 'Región', required: true },
  { key: '{{DIRECCION}}', label: 'Dirección', required: true },
  { key: '{{OBJETIVOS}}', label: 'Objetivos', required: false },
  { key: '{{DESCRIPCION}}', label: 'Descripción', required: false },
  { key: '{{MIEMBROS_MINIMOS}}', label: 'Miembros Mínimos', required: true },
  { key: '{{EDAD_MINIMA}}', label: 'Edad Mínima', required: true },
  { key: '{{N_MIEMBROS}}', label: 'N° Miembros Directorio', required: true },
  { key: '{{MIEMBROS_COMISION_ELECTORAL}}', label: 'N° Comisión Electoral', required: true },
  { key: '{{CUOTA_MENSUAL}}', label: 'Cuota Mensual', required: true },
  { key: '{{CUOTA_INCORPORACION}}', label: 'Cuota de Incorporación', required: false },
  { key: '{{DURACION_MANDATO}}', label: 'Duración Mandato', required: true },
  { key: '{{MESES_ASAMBLEA}}', label: 'Meses de Asamblea', required: true },
  { key: '{{METODO_CITACION}}', label: 'Método de Citación', required: true },
  { key: '{{DIAS_ANTICIPACION}}', label: 'Días de Anticipación', required: true },
  { key: '{{ENTIDAD_DISOLUCION}}', label: 'Entidad de Disolución', required: true },
  { key: '{{MES_INFORME}}', label: 'Mes de Informe de Balance', required: true },
];

const UNFILLED = '_______________';

/**
 * Resolve a variable key to its current value given formData and templateConfig
 */
export function resolveVariable(key, formData, templateConfig, citacionLabels) {
  const config = formData.config || {};
  const org = formData.organization || {};

  switch (key) {
    case '{{NOMBRE_ORGANIZACION}}': return org.name || UNFILLED;
    case '{{TIPO_ORGANIZACION}}': return templateConfig?.nombreTipo || org.type || UNFILLED;
    case '{{DESCRIPCION}}': return org.description || UNFILLED;
    case '{{OBJETIVOS}}': return org.objectives || 'promover la integración, participación y desarrollo de la comunidad';
    case '{{COMUNA}}': return org.commune || UNFILLED;
    case '{{REGION}}': return org.region || 'Región Metropolitana';
    case '{{DIRECCION}}': {
      const parts = [[org.street, org.streetNumber].filter(Boolean).join(' N° ') || org.address || UNFILLED];
      if (org.neighborhood) parts.push(`Unidad Vecinal ${org.neighborhood}`);
      return parts.filter(Boolean).join(', ');
    }
    case '{{MIEMBROS_MINIMOS}}': return String(templateConfig?.miembrosMinimos || 15);
    case '{{EDAD_MINIMA}}': return String(templateConfig?.edadConfig?.edadMinima || 14);
    case '{{N_MIEMBROS}}': return String(templateConfig?.directorio?.cargos?.length || templateConfig?.directorio?.totalRequerido || 5);
    case '{{MIEMBROS_COMISION_ELECTORAL}}': return String(templateConfig?.comisionElectoral?.cantidad || 3);
    case '{{CUOTA_MENSUAL}}': {
      if (config.cuotaMin != null && config.cuotaMax != null) {
        const moneda = config.monedaCuota || 'UTM';
        const prefix = moneda === 'CLP' ? '$' : '';
        const suffix = moneda !== 'CLP' ? ` ${moneda}` : '';
        return `entre ${prefix}${config.cuotaMin}${suffix} y ${prefix}${config.cuotaMax}${suffix}`;
      }
      return UNFILLED;
    }
    case '{{CUOTA_INCORPORACION}}':
    case '{{CUOTA_INC}}':
      return config.cuotaIncorporacion ? `${config.cuotaIncorporacion} ${config.monedaCuota || 'UTM'}` : UNFILLED;
    case '{{DURACION_MANDATO}}': {
      const d = config.duracionMandato || 3;
      return `${d} ${d === 1 ? 'año' : 'años'}`;
    }
    case '{{MESES_ASAMBLEA}}': return (config.asambleas || []).join(' y ') || UNFILLED;
    case '{{METODO_CITACION}}': return citacionLabels?.[config.metodoCitacion] || 'carta certificada al domicilio registrado';
    case '{{DIAS_ANTICIPACION}}': return String(config.diasAnticipacion || 10);
    case '{{ENTIDAD_DISOLUCION}}': return config.beneficiarioDisolucion || UNFILLED;
    case '{{MES_INFORME}}': return config.accountReviewMonth || 'Marzo';
    default: return UNFILLED;
  }
}

/**
 * Check which required variables are missing from the edited text
 * A variable is "present" if its resolved value appears in the combined text
 * A variable with UNFILLED value is always considered missing
 */
export function getMissingVariables(editedArticles, formData, templateConfig, citacionLabels) {
  if (!editedArticles?.length) return [];

  const fullText = editedArticles.map(a => a.contenido || '').join('\n');
  const missing = [];

  for (const v of ESTATUTO_VARIABLES) {
    if (!v.required) continue;
    const resolved = resolveVariable(v.key, formData, templateConfig, citacionLabels);
    if (resolved === UNFILLED) continue; // Can't validate if value itself is unfilled
    if (!fullText.includes(resolved)) {
      missing.push(v);
    }
  }

  return missing;
}
