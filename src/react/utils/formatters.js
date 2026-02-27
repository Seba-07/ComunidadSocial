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
  draft: 'Borrador',
  waiting_ministro: 'Esperando Ministro de Fe',
  ministro_scheduled: 'Ministro Agendado',
  ministro_approved: 'Aprobada por Ministro',
  pending_review: 'Pendiente de Revisión',
  in_review: 'En Revisión',
  rejected: 'Rechazada',
  sent_registry: 'Enviada al Registro',
  registry_observations: 'Observaciones del Registro',
  approved: 'Aprobada',
  dissolved: 'Disuelta',
  deletion_requested: 'Eliminación Solicitada'
};

/**
 * Organization status colors
 */
export const ORG_STATUS_COLORS = {
  draft: '#6b7280',
  waiting_ministro: '#f59e0b',
  ministro_scheduled: '#3b82f6',
  ministro_approved: '#06b6d4',
  pending_review: '#f59e0b',
  in_review: '#8b5cf6',
  rejected: '#ef4444',
  sent_registry: '#6366f1',
  registry_observations: '#f97316',
  approved: '#10b981',
  dissolved: '#6b7280',
  deletion_requested: '#ef4444'
};
