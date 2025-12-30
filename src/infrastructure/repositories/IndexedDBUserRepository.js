import { IUserRepository } from '../../domain/repositories/IUserRepository.js';
import { indexedDBService } from '../database/IndexedDBService.js';

/**
 * IndexedDBUserRepository
 * Implementación del repositorio de usuarios usando IndexedDB
 */
export class IndexedDBUserRepository extends IUserRepository {
  constructor() {
    super();
    this.storeName = 'users';
    this.currentId = 1;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    await indexedDBService.init();

    // Crear usuarios de prueba si no existen
    const users = await indexedDBService.getAll(this.storeName);

    if (users.length === 0) {
      await this.createDefaultUsers();
    }

    this.initialized = true;
  }

  async createDefaultUsers() {
    // Solo crear usuario administrador (el único pre-creado en el sistema)
    await indexedDBService.add(this.storeName, {
      id: 'admin-1',
      email: 'admin@renca.cl',
      password: 'admin123',
      role: 'MUNICIPALIDAD',
      profile: {
        rut: '12.345.678-9',
        firstName: 'Administrador',
        lastName: 'Municipal',
        phone: '+56912345678',
        address: 'Municipalidad de Renca',
        commune: 'Renca',
        birthDate: '1980-01-01'
      },
      createdAt: new Date().toISOString()
    });

    console.log('✅ Administrador creado en el sistema');
  }

  async create(user) {
    await this.init();

    const id = `user-${Date.now()}`;

    // Handle both User entity and plain object
    const userDataRaw = typeof user.toJSON === 'function' ? user.toJSON() : user;

    const userData = {
      ...userDataRaw,
      id,
      createdAt: new Date().toISOString()
    };

    await indexedDBService.add(this.storeName, userData);
    return userData;
  }

  async findById(id) {
    await this.init();
    return await indexedDBService.get(this.storeName, id);
  }

  async findByEmail(email) {
    await this.init();
    const users = await indexedDBService.getByIndex(this.storeName, 'email', email);
    return users.length > 0 ? users[0] : null;
  }

  async findByRut(rut) {
    await this.init();
    const users = await indexedDBService.getAll(this.storeName);
    return users.find(user => user.profile?.rut === rut) || null;
  }

  async update(id, updates) {
    await this.init();
    const user = await this.findById(id);

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await indexedDBService.update(this.storeName, updatedUser);
    return updatedUser;
  }

  async delete(id) {
    await this.init();
    return await indexedDBService.delete(this.storeName, id);
  }

  async findAll(options = {}) {
    await this.init();
    const { limit = 10, offset = 0 } = options;
    const allUsers = await indexedDBService.getAll(this.storeName);
    const users = allUsers.slice(offset, offset + limit);

    return {
      users,
      total: allUsers.length
    };
  }

  async findByRole(role) {
    await this.init();
    const users = await indexedDBService.getAll(this.storeName);
    return users.filter(user => user.role === role);
  }

  async existsByEmail(email) {
    const user = await this.findByEmail(email);
    return user !== null;
  }

  async existsByRut(rut) {
    const user = await this.findByRut(rut);
    return user !== null;
  }

  async authenticate(email, password) {
    const user = await this.findByEmail(email);

    if (!user || user.password !== password) {
      return null;
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
