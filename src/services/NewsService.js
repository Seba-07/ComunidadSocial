/**
 * NewsService - Servicio para manejar las noticias
 */

import { apiService } from './ApiService.js';

class NewsService {
  constructor() {
    this.categories = {
      'NOTICIAS': 'Noticias',
      'COMUNICADOS': 'Comunicados',
      'EVENTOS': 'Eventos',
      'CONVOCATORIAS': 'Convocatorias'
    };
  }

  /**
   * Obtener todas las noticias
   */
  async getAll(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.category && options.category !== 'TODAS') {
        params.append('category', options.category);
      }
      if (options.search) {
        params.append('search', options.search);
      }
      if (options.includeUnpublished) {
        params.append('includeUnpublished', 'true');
      }
      if (options.limit) {
        params.append('limit', options.limit);
      }
      if (options.page) {
        params.append('page', options.page);
      }

      const url = `/news${params.toString() ? '?' + params.toString() : ''}`;
      return await apiService.get(url);
    } catch (error) {
      console.error('Error al obtener noticias:', error);
      throw error;
    }
  }

  /**
   * Obtener una noticia por ID o slug
   */
  async getById(idOrSlug) {
    try {
      return await apiService.get(`/news/${idOrSlug}`);
    } catch (error) {
      console.error('Error al obtener noticia:', error);
      throw error;
    }
  }

  /**
   * Crear una nueva noticia (solo MUNICIPALIDAD)
   */
  async create(data) {
    try {
      return await apiService.post('/news', data);
    } catch (error) {
      console.error('Error al crear noticia:', error);
      throw error;
    }
  }

  /**
   * Actualizar una noticia (solo MUNICIPALIDAD)
   */
  async update(id, data) {
    try {
      return await apiService.put(`/news/${id}`, data);
    } catch (error) {
      console.error('Error al actualizar noticia:', error);
      throw error;
    }
  }

  /**
   * Publicar una noticia (solo MUNICIPALIDAD)
   */
  async publish(id) {
    try {
      return await apiService.post(`/news/${id}/publish`);
    } catch (error) {
      console.error('Error al publicar noticia:', error);
      throw error;
    }
  }

  /**
   * Despublicar una noticia (solo MUNICIPALIDAD)
   */
  async unpublish(id) {
    try {
      return await apiService.post(`/news/${id}/unpublish`);
    } catch (error) {
      console.error('Error al despublicar noticia:', error);
      throw error;
    }
  }

  /**
   * Eliminar una noticia (solo MUNICIPALIDAD)
   */
  async delete(id) {
    try {
      return await apiService.delete(`/news/${id}`);
    } catch (error) {
      console.error('Error al eliminar noticia:', error);
      throw error;
    }
  }

  /**
   * Subir imagen para el editor (solo MUNICIPALIDAD)
   */
  async uploadImage(file) {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const token = localStorage.getItem('authToken');
      const baseUrl = apiService.baseUrl || 'https://comunidadsocial-production.up.railway.app/api';

      const response = await fetch(`${baseUrl}/news/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al subir imagen');
      }

      return await response.json();
    } catch (error) {
      console.error('Error al subir imagen:', error);
      throw error;
    }
  }

  /**
   * Obtener categorías
   */
  getCategories() {
    return this.categories;
  }

  /**
   * Obtener nombre de categoría
   */
  getCategoryLabel(category) {
    return this.categories[category] || category;
  }

  /**
   * Formatear fecha
   */
  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Formatear fecha corta
   */
  formatShortDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Obtener tiempo relativo
   */
  getRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    return this.formatShortDate(dateString);
  }
}

export default new NewsService();
