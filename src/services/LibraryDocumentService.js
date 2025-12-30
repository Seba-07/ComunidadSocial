/**
 * LibraryDocumentService - Servicio para manejar la biblioteca de documentos
 */

import { apiService } from './ApiService.js';

class LibraryDocumentService {
  constructor() {
    this.categories = {
      'FORMULARIOS': 'Formularios',
      'LEYES': 'Leyes y Normativas',
      'GUIAS': 'Guías y Manuales',
      'PLANTILLAS': 'Plantillas',
      'OTROS': 'Otros Documentos'
    };
  }

  /**
   * Obtener todos los documentos
   */
  async getAll(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.category && options.category !== 'TODOS') {
        params.append('category', options.category);
      }
      if (options.search) {
        params.append('search', options.search);
      }
      if (options.includeUnpublished) {
        params.append('includeUnpublished', 'true');
      }

      const url = `/library-documents${params.toString() ? '?' + params.toString() : ''}`;
      return await apiService.get(url);
    } catch (error) {
      console.error('Error al obtener documentos:', error);
      throw error;
    }
  }

  /**
   * Obtener un documento por ID
   */
  async getById(id) {
    try {
      return await apiService.get(`/library-documents/${id}`);
    } catch (error) {
      console.error('Error al obtener documento:', error);
      throw error;
    }
  }

  /**
   * Subir un nuevo documento (solo MUNICIPALIDAD)
   */
  async upload(file, data) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', data.name);
      if (data.description) formData.append('description', data.description);
      if (data.category) formData.append('category', data.category);
      formData.append('isPublished', data.isPublished !== false ? 'true' : 'false');

      // Usar fetch directamente para FormData
      const token = localStorage.getItem('authToken');
      const baseUrl = apiService.baseUrl || 'https://comunidadsocial-production.up.railway.app/api';

      const response = await fetch(`${baseUrl}/library-documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al subir documento');
      }

      return await response.json();
    } catch (error) {
      console.error('Error al subir documento:', error);
      throw error;
    }
  }

  /**
   * Actualizar un documento (solo MUNICIPALIDAD)
   */
  async update(id, data) {
    try {
      return await apiService.put(`/library-documents/${id}`, data);
    } catch (error) {
      console.error('Error al actualizar documento:', error);
      throw error;
    }
  }

  /**
   * Eliminar un documento (solo MUNICIPALIDAD)
   */
  async delete(id) {
    try {
      return await apiService.delete(`/library-documents/${id}`);
    } catch (error) {
      console.error('Error al eliminar documento:', error);
      throw error;
    }
  }

  /**
   * Obtener URL de descarga
   */
  getDownloadUrl(id) {
    const baseUrl = apiService.baseUrl || 'https://comunidadsocial-production.up.railway.app/api';
    return `${baseUrl}/library-documents/${id}/download`;
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
   * Formatear tamaño de archivo
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Obtener ícono según tipo de archivo
   */
  getFileIcon(mimeType) {
    if (mimeType.includes('pdf')) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3498db" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>';
    } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><rect x="8" y="12" width="8" height="6"></rect></svg>';
    } else if (mimeType.includes('image')) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9b59b6" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
    }
    return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#95a5a6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
  }
}

export default new LibraryDocumentService();
