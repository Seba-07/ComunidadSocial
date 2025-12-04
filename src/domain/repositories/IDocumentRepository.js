/**
 * IDocumentRepository Interface
 * Define el contrato para operaciones de persistencia de documentos
 */
export class IDocumentRepository {
  /**
   * Crea un nuevo documento
   * @param {Document} document - Entidad de documento
   * @returns {Promise<Document>} Documento creado con ID
   */
  async create(document) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca un documento por ID
   * @param {string} id - ID del documento
   * @returns {Promise<Document|null>} Documento encontrado o null
   */
  async findById(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Actualiza un documento existente
   * @param {string} id - ID del documento
   * @param {Object} updates - Campos a actualizar
   * @returns {Promise<Document>} Documento actualizado
   */
  async update(id, updates) {
    throw new Error('Method not implemented');
  }

  /**
   * Elimina un documento
   * @param {string} id - ID del documento
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  async delete(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca documentos por solicitud
   * @param {string} applicationId - ID de la solicitud
   * @returns {Promise<Document[]>}
   */
  async findByApplication(applicationId) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca documentos por tipo
   * @param {string} applicationId - ID de la solicitud
   * @param {string} type - Tipo de documento
   * @returns {Promise<Document[]>}
   */
  async findByType(applicationId, type) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca documentos por estado
   * @param {string} applicationId - ID de la solicitud
   * @param {string} status - Estado del documento
   * @returns {Promise<Document[]>}
   */
  async findByStatus(applicationId, status) {
    throw new Error('Method not implemented');
  }

  /**
   * Cambia el estado de un documento
   * @param {string} documentId - ID del documento
   * @param {string} newStatus - Nuevo estado
   * @param {string} reviewedBy - ID del revisor (opcional)
   * @param {string} comments - Comentarios de revisión (opcional)
   * @returns {Promise<Document>}
   */
  async changeStatus(documentId, newStatus, reviewedBy = null, comments = null) {
    throw new Error('Method not implemented');
  }

  /**
   * Obtiene la URL de descarga de un documento
   * @param {string} documentId - ID del documento
   * @returns {Promise<string>} URL de descarga
   */
  async getDownloadURL(documentId) {
    throw new Error('Method not implemented');
  }

  /**
   * Sube un archivo al almacenamiento
   * @param {File} file - Archivo a subir
   * @param {string} path - Ruta donde se guardará
   * @returns {Promise<{url: string, fileName: string}>}
   */
  async uploadFile(file, path) {
    throw new Error('Method not implemented');
  }

  /**
   * Elimina un archivo del almacenamiento
   * @param {string} fileURL - URL del archivo a eliminar
   * @returns {Promise<boolean>}
   */
  async deleteFile(fileURL) {
    throw new Error('Method not implemented');
  }

  /**
   * Verifica si un documento existe
   * @param {string} applicationId - ID de la solicitud
   * @param {string} type - Tipo de documento
   * @returns {Promise<boolean>}
   */
  async existsByType(applicationId, type) {
    throw new Error('Method not implemented');
  }

  /**
   * Obtiene todos los documentos requeridos para una solicitud
   * @param {string} applicationId - ID de la solicitud
   * @returns {Promise<Document[]>}
   */
  async getRequiredDocuments(applicationId) {
    throw new Error('Method not implemented');
  }

  /**
   * Verifica si todos los documentos requeridos están aprobados
   * @param {string} applicationId - ID de la solicitud
   * @returns {Promise<boolean>}
   */
  async allRequiredDocumentsApproved(applicationId) {
    throw new Error('Method not implemented');
  }
}
