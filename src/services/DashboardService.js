/**
 * DashboardService - Servicio para el dashboard administrativo y audit log
 */

import { apiService } from './ApiService.js';

class DashboardService {
  /**
   * Obtiene estadisticas generales del dashboard
   */
  async getStats() {
    return apiService.get('/dashboard/stats');
  }

  /**
   * Obtiene la actividad reciente del sistema
   */
  async getRecentActivity() {
    return apiService.get('/dashboard/recent-activity');
  }

  /**
   * Obtiene el registro de auditoria con filtros y paginacion
   * @param {Object} options - Filtros de busqueda
   * @param {number} options.page - Numero de pagina
   * @param {number} options.limit - Cantidad por pagina
   * @param {string} options.action - Tipo de accion (create, update, delete, etc.)
   * @param {string} options.resource - Tipo de recurso (organization, user, etc.)
   * @param {string} options.userId - ID del usuario
   * @param {string} options.startDate - Fecha de inicio (ISO string)
   * @param {string} options.endDate - Fecha de fin (ISO string)
   * @param {string} options.search - Texto de busqueda libre
   */
  async getAuditLog({ page, limit, action, resource, userId, startDate, endDate, search } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    if (action) params.append('action', action);
    if (resource) params.append('resource', resource);
    if (userId) params.append('userId', userId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (search) params.append('search', search);

    const query = params.toString();
    return apiService.get(`/audit-log${query ? '?' + query : ''}`);
  }

  /**
   * Obtiene estadisticas del registro de auditoria
   */
  async getAuditStats() {
    return apiService.get('/audit-log/stats');
  }

  /**
   * Exporta el registro de auditoria con los filtros aplicados
   * @param {Object} filters - Mismos filtros que getAuditLog
   */
  async exportAuditLog(filters = {}) {
    const params = new URLSearchParams();
    if (filters.action) params.append('action', filters.action);
    if (filters.resource) params.append('resource', filters.resource);
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.search) params.append('search', filters.search);

    const query = params.toString();
    return apiService.get(`/audit-log/export${query ? '?' + query : ''}`);
  }
}

// Export singleton instance
export const dashboardService = new DashboardService();
