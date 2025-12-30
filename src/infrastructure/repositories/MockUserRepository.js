import { IUserRepository } from '../../domain/repositories/IUserRepository.js';

/**
 * MockUserRepository
 * Implementación en memoria del repositorio de usuarios (sin Firebase)
 * Para desarrollo y pruebas locales
 */
export class MockUserRepository extends IUserRepository {
  constructor() {
    super();
    this.users = new Map();
    this.currentId = 1;

    // Usuario admin de prueba
    this.users.set('admin-1', {
      id: 'admin-1',
      email: 'admin@renca.cl',
      password: 'admin123', // En producción esto debe estar hasheado
      role: 'MUNICIPALIDAD',
      profile: {
        rut: '12345678-9',
        firstName: 'Admin',
        lastName: 'Municipal',
        phone: '912345678',
        address: 'Municipalidad de Renca',
        commune: 'Renca',
        birthDate: '1980-01-01'
      },
      createdAt: new Date()
    });

    // Usuario normal de prueba
    this.users.set('user-1', {
      id: 'user-1',
      email: 'usuario@example.cl',
      password: 'user123',
      role: 'ORGANIZADOR',
      profile: {
        rut: '98765432-1',
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '987654321',
        address: 'Calle Falsa 123',
        commune: 'Renca',
        birthDate: '1990-05-15'
      },
      createdAt: new Date()
    });
  }

  async create(user) {
    const id = `user-${this.currentId++}`;
    const userData = {
      ...user.toJSON(),
      id,
      createdAt: new Date()
    };
    this.users.set(id, userData);
    return userData;
  }

  async findById(id) {
    return this.users.get(id) || null;
  }

  async findByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async findByRut(rut) {
    for (const user of this.users.values()) {
      if (user.profile?.rut === rut) {
        return user;
      }
    }
    return null;
  }

  async update(id, updates) {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date()
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async delete(id) {
    return this.users.delete(id);
  }

  async findAll(options = {}) {
    const { limit = 10, offset = 0 } = options;
    const allUsers = Array.from(this.users.values());
    const users = allUsers.slice(offset, offset + limit);

    return {
      users,
      total: allUsers.length
    };
  }

  async findByRole(role) {
    const users = Array.from(this.users.values()).filter(
      user => user.role === role
    );
    return users;
  }

  async existsByEmail(email) {
    const user = await this.findByEmail(email);
    return user !== null;
  }

  async existsByRut(rut) {
    const user = await this.findByRut(rut);
    return user !== null;
  }

  // Método adicional para autenticación (solo para desarrollo)
  async authenticate(email, password) {
    const user = await this.findByEmail(email);
    if (!user || user.password !== password) {
      return null;
    }
    // No devolver la contraseña
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
