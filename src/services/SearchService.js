/**
 * SearchService - Servicio de busqueda global del sistema
 */

import { apiService } from './ApiService.js';

class SearchService {
  /**
   * Busqueda general con query y tipo opcional
   * @param {string} query - Texto de busqueda
   * @param {string} type - Tipo de recurso (organizations, users, news, documents)
   * @returns {Object} Resultados de la busqueda
   */
  async search(query, type) {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (type) params.append('type', type);

    const queryString = params.toString();
    const data = await apiService.get(`/search${queryString ? '?' + queryString : ''}`);
    return data.results || data;
  }

  /**
   * Busca organizaciones
   * @param {string} query - Texto de busqueda
   */
  async searchOrganizations(query) {
    return this.search(query, 'organizations');
  }

  /**
   * Busca usuarios
   * @param {string} query - Texto de busqueda
   */
  async searchUsers(query) {
    return this.search(query, 'users');
  }

  /**
   * Busca noticias
   * @param {string} query - Texto de busqueda
   */
  async searchNews(query) {
    return this.search(query, 'news');
  }

  /**
   * Busca documentos
   * @param {string} query - Texto de busqueda
   */
  async searchDocuments(query) {
    return this.search(query, 'documents');
  }
}

// Export singleton instance
export const searchService = new SearchService();
