/**
 * OrgDocumentService - Servicio para gestion de documentos de organizaciones
 */

import { apiService } from './ApiService.js';

class OrgDocumentService {
  constructor() {
    /**
     * Categorias de documentos de organizacion
     */
    this.CATEGORIES = {
      ACTA_ASAMBLEA: 'Acta de Asamblea',
      BALANCE: 'Balance Financiero',
      INFORME: 'Informe',
      CERTIFICADO: 'Certificado',
      CORRESPONDENCIA: 'Correspondencia',
      OTRO: 'Otro'
    };
  }

  /**
   * Obtiene los documentos de una organizacion
   * @param {string} orgId - ID de la organizacion
   */
  async getDocuments(orgId) {
    return apiService.get(`/org-documents/${orgId}`);
  }

  /**
   * Sube un documento para una organizacion
   * Usa fetch directamente para manejar FormData correctamente
   * @param {string} orgId - ID de la organizacion
   * @param {File} file - Archivo a subir
   * @param {string} name - Nombre del documento
   * @param {string} description - Descripcion del documento
   * @param {string} category - Categoria del documento (clave de CATEGORIES)
   */
  async uploadDocument(orgId, file, name, description, category) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (description) formData.append('description', description);
    if (category) formData.append('category', category);

    const baseUrl = apiService.baseUrl || 'https://comunidadsocial-production.up.railway.app/api';

    const response = await fetch(`${baseUrl}/org-documents/${orgId}/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al subir documento');
    }

    return await response.json();
  }

  /**
   * Descarga un documento de una organizacion
   * Navega a la URL de descarga o descarga el blob
   * @param {string} orgId - ID de la organizacion
   * @param {string} docId - ID del documento
   */
  async downloadDocument(orgId, docId) {
    const baseUrl = apiService.baseUrl || 'https://comunidadsocial-production.up.railway.app/api';
    const url = `${baseUrl}/org-documents/${orgId}/${docId}/download`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al descargar documento');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      // Intentar obtener nombre del archivo desde Content-Disposition
      const disposition = response.headers.get('Content-Disposition');
      let filename = `documento_${docId}`;
      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, '');
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error al descargar documento:', error);
      throw error;
    }
  }

  /**
   * Elimina un documento de una organizacion
   * @param {string} orgId - ID de la organizacion
   * @param {string} docId - ID del documento
   */
  async deleteDocument(orgId, docId) {
    return apiService.delete(`/org-documents/${orgId}/${docId}`);
  }
}

// Export singleton instance
export const orgDocumentService = new OrgDocumentService();
