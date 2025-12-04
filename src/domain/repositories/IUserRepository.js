/**
 * IUserRepository Interface
 * Define el contrato para operaciones de persistencia de usuarios
 * Esta es una interfaz (contrato) que debe ser implementada por la capa de infraestructura
 */
export class IUserRepository {
  /**
   * Crea un nuevo usuario
   * @param {User} user - Entidad de usuario
   * @returns {Promise<User>} Usuario creado con ID
   */
  async create(user) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca un usuario por ID
   * @param {string} id - ID del usuario
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findById(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca un usuario por email
   * @param {string} email - Email del usuario
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findByEmail(email) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca un usuario por RUT
   * @param {string} rut - RUT del usuario
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findByRut(rut) {
    throw new Error('Method not implemented');
  }

  /**
   * Actualiza un usuario existente
   * @param {string} id - ID del usuario
   * @param {Object} updates - Campos a actualizar
   * @returns {Promise<User>} Usuario actualizado
   */
  async update(id, updates) {
    throw new Error('Method not implemented');
  }

  /**
   * Elimina un usuario
   * @param {string} id - ID del usuario
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  async delete(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Obtiene todos los usuarios con paginación
   * @param {Object} options - Opciones de paginación y filtros
   * @returns {Promise<{users: User[], total: number}>}
   */
  async findAll(options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Obtiene usuarios por rol
   * @param {string} role - Rol del usuario (USER/ADMIN)
   * @returns {Promise<User[]>}
   */
  async findByRole(role) {
    throw new Error('Method not implemented');
  }

  /**
   * Verifica si existe un usuario con el email dado
   * @param {string} email - Email a verificar
   * @returns {Promise<boolean>}
   */
  async existsByEmail(email) {
    throw new Error('Method not implemented');
  }

  /**
   * Verifica si existe un usuario con el RUT dado
   * @param {string} rut - RUT a verificar
   * @returns {Promise<boolean>}
   */
  async existsByRut(rut) {
    throw new Error('Method not implemented');
  }
}
