/**
 * IOrganizationRepository Interface
 * Define el contrato para operaciones de persistencia de organizaciones
 */
export class IOrganizationRepository {
  /**
   * Crea una nueva organización
   * @param {Organization} organization - Entidad de organización
   * @returns {Promise<Organization>} Organización creada con ID
   */
  async create(organization) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca una organización por ID
   * @param {string} id - ID de la organización
   * @returns {Promise<Organization|null>} Organización encontrada o null
   */
  async findById(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Actualiza una organización existente
   * @param {string} id - ID de la organización
   * @param {Object} updates - Campos a actualizar
   * @returns {Promise<Organization>} Organización actualizada
   */
  async update(id, updates) {
    throw new Error('Method not implemented');
  }

  /**
   * Elimina una organización
   * @param {string} id - ID de la organización
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  async delete(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Obtiene todas las organizaciones con filtros y paginación
   * @param {Object} options - Opciones de paginación y filtros
   * @returns {Promise<{organizations: Organization[], total: number}>}
   */
  async findAll(options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca organizaciones por usuario creador
   * @param {string} userId - ID del usuario
   * @returns {Promise<Organization[]>}
   */
  async findByCreator(userId) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca organizaciones por estado
   * @param {string} status - Estado de la organización
   * @returns {Promise<Organization[]>}
   */
  async findByStatus(status) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca organizaciones por comuna
   * @param {string} commune - Nombre de la comuna
   * @returns {Promise<Organization[]>}
   */
  async findByCommune(commune) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca organizaciones por tipo
   * @param {string} type - Tipo de organización
   * @returns {Promise<Organization[]>}
   */
  async findByType(type) {
    throw new Error('Method not implemented');
  }

  /**
   * Agrega un miembro a una organización
   * @param {string} organizationId - ID de la organización
   * @param {OrganizationMember} member - Miembro a agregar
   * @returns {Promise<Organization>}
   */
  async addMember(organizationId, member) {
    throw new Error('Method not implemented');
  }

  /**
   * Remueve un miembro de una organización
   * @param {string} organizationId - ID de la organización
   * @param {string} memberId - ID del miembro
   * @returns {Promise<Organization>}
   */
  async removeMember(organizationId, memberId) {
    throw new Error('Method not implemented');
  }

  /**
   * Cambia el estado de una organización
   * @param {string} organizationId - ID de la organización
   * @param {string} newStatus - Nuevo estado
   * @param {string} reason - Razón del cambio (opcional)
   * @returns {Promise<Organization>}
   */
  async changeStatus(organizationId, newStatus, reason = null) {
    throw new Error('Method not implemented');
  }

  /**
   * Verifica si existe una organización con el nombre dado en la comuna
   * @param {string} name - Nombre de la organización
   * @param {string} commune - Comuna
   * @returns {Promise<boolean>}
   */
  async existsByNameAndCommune(name, commune) {
    throw new Error('Method not implemented');
  }
}
