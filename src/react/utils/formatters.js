/**
 * Format a date string to locale format
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format a date string to short format (dd/mm/yyyy)
 */
export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-CL');
}

/**
 * Organization status labels in Spanish
 */
export const ORG_STATUS_LABELS = {
  borrador: 'Borrador',
  directorio_completo: 'Directorio Completo',
  en_revision: 'En Revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  constituida: 'Constituida',
  acta_aprobada: 'Acta Aprobada',
  personalidad_juridica: 'Personalidad Jurídica'
};

/**
 * Organization status colors
 */
export const ORG_STATUS_COLORS = {
  borrador: '#6b7280',
  directorio_completo: '#f59e0b',
  en_revision: '#3b82f6',
  aprobada: '#10b981',
  rechazada: '#ef4444',
  constituida: '#8b5cf6',
  acta_aprobada: '#06b6d4',
  personalidad_juridica: '#059669'
};
