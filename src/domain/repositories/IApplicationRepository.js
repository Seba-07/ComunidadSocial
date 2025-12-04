/**
 * IApplicationRepository Interface
 * Define el contrato para operaciones de persistencia de solicitudes/postulaciones
 */
export class IApplicationRepository {
  /**
   * Crea una nueva solicitud
   * @param {Application} application - Entidad de solicitud
   * @returns {Promise<Application>} Solicitud creada con ID
   */
  async create(application) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca una solicitud por ID
   * @param {string} id - ID de la solicitud
   * @returns {Promise<Application|null>} Solicitud encontrada o null
   */
  async findById(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Actualiza una solicitud existente
   * @param {string} id - ID de la solicitud
   * @param {Object} updates - Campos a actualizar
   * @returns {Promise<Application>} Solicitud actualizada
   */
  async update(id, updates) {
    throw new Error('Method not implemented');
  }

  /**
   * Elimina una solicitud
   * @param {string} id - ID de la solicitud
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  async delete(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Obtiene todas las solicitudes con filtros y paginación
   * @param {Object} options - Opciones de paginación y filtros
   * @returns {Promise<{applications: Application[], total: number}>}
   */
  async findAll(options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca solicitudes por usuario
   * @param {string} userId - ID del usuario
   * @returns {Promise<Application[]>}
   */
  async findByUser(userId) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca solicitudes por organización
   * @param {string} organizationId - ID de la organización
   * @returns {Promise<Application[]>}
   */
  async findByOrganization(organizationId) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca solicitudes por estado
   * @param {string} status - Estado de la solicitud
   * @returns {Promise<Application[]>}
   */
  async findByStatus(status) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca solicitudes pendientes de revisión
   * @returns {Promise<Application[]>}
   */
  async findPendingReview() {
    throw new Error('Method not implemented');
  }

  /**
   * Cambia el estado de una solicitud
   * @param {string} applicationId - ID de la solicitud
   * @param {string} newStatus - Nuevo estado
   * @param {string} reviewedBy - ID del revisor (opcional)
   * @param {string} reason - Razón del cambio (opcional)
   * @returns {Promise<Application>}
   */
  async changeStatus(applicationId, newStatus, reviewedBy = null, reason = null) {
    throw new Error('Method not implemented');
  }

  /**
   * Agrega un documento a una solicitud
   * @param {string} applicationId - ID de la solicitud
   * @param {Document} document - Documento a agregar
   * @returns {Promise<Application>}
   */
  async addDocument(applicationId, document) {
    throw new Error('Method not implemented');
  }

  /**
   * Remueve un documento de una solicitud
   * @param {string} applicationId - ID de la solicitud
   * @param {string} documentId - ID del documento
   * @returns {Promise<Application>}
   */
  async removeDocument(applicationId, documentId) {
    throw new Error('Method not implemented');
  }

  /**
   * Agrega un comentario de revisión
   * @param {string} applicationId - ID de la solicitud
   * @param {string} comment - Comentario
   * @param {string} author - ID del autor
   * @returns {Promise<Application>}
   */
  async addReviewComment(applicationId, comment, author) {
    throw new Error('Method not implemented');
  }

  /**
   * Actualiza el paso actual del wizard
   * @param {string} applicationId - ID de la solicitud
   * @param {number} step - Número del paso
   * @returns {Promise<Application>}
   */
  async updateCurrentStep(applicationId, step) {
    throw new Error('Method not implemented');
  }

  /**
   * Establece los estatutos de la organización
   * @param {string} applicationId - ID de la solicitud
   * @param {Object} statutes - Estatutos
   * @returns {Promise<Application>}
   */
  async setStatutes(applicationId, statutes) {
    throw new Error('Method not implemented');
  }

  /**
   * Establece la comisión electoral
   * @param {string} applicationId - ID de la solicitud
   * @param {ElectoralCommission} commission - Comisión electoral
   * @returns {Promise<Application>}
   */
  async setElectoralCommission(applicationId, commission) {
    throw new Error('Method not implemented');
  }
}
