/**
 * Servicio de Gestión de Ministros de Fe
 * Maneja el registro y administración de Ministros de Fe en el sistema
 */

class MinistroService {
  constructor() {
    this.storageKey = 'ministros_fe';
    this.init();
  }

  /**
   * Inicializa el servicio
   */
  init() {
    const ministros = this.getAll();
    if (!ministros || ministros.length === 0) {
      // Crear ministros de ejemplo
      const defaultMinistros = [
        {
          id: 'mf-1',
          rut: '12345678-9',
          firstName: 'María',
          lastName: 'González López',
          email: 'maria.gonzalez@renca.cl',
          phone: '+56 9 1234 5678',
          address: 'Av. Principal 123, Renca',
          specialty: 'Juntas de Vecinos',
          active: true,
          // Credenciales de acceso
          password: 'maria123',
          mustChangePassword: true,
          role: 'MINISTRO',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'mf-2',
          rut: '98765432-1',
          firstName: 'Carlos',
          lastName: 'Martínez Silva',
          email: 'carlos.martinez@renca.cl',
          phone: '+56 9 8765 4321',
          address: 'Calle Los Aromos 456, Renca',
          specialty: 'Organizaciones Funcionales',
          active: true,
          // Credenciales de acceso
          password: 'carlos123',
          mustChangePassword: true,
          role: 'MINISTRO',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      this.saveAll(defaultMinistros);
    }
  }

  /**
   * Obtiene todos los ministros
   */
  getAll() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error al obtener ministros:', error);
      return [];
    }
  }

  /**
   * Obtiene solo ministros activos
   */
  getActive() {
    return this.getAll().filter(m => m.active);
  }

  /**
   * Obtiene un ministro por ID
   */
  getById(id) {
    return this.getAll().find(m => m.id === id) || null;
  }

  /**
   * Obtiene un ministro por RUT
   */
  getByRut(rut) {
    const cleanRut = rut.replace(/\./g, '').replace(/-/g, '');
    return this.getAll().find(m => {
      const ministroRut = m.rut.replace(/\./g, '').replace(/-/g, '');
      return ministroRut === cleanRut;
    }) || null;
  }

  /**
   * Obtiene un ministro por email
   */
  getByEmail(email) {
    return this.getAll().find(m => m.email?.toLowerCase() === email.toLowerCase()) || null;
  }

  /**
   * Crea un nuevo ministro
   */
  create(ministroData) {
    // Validar datos requeridos
    if (!ministroData.rut || !ministroData.firstName || !ministroData.lastName) {
      throw new Error('Datos incompletos. RUT, nombre y apellido son requeridos.');
    }

    // Validar email si se proporciona
    if (!ministroData.email || !ministroData.email.includes('@')) {
      throw new Error('Email válido es requerido para crear credenciales de acceso.');
    }

    // Verificar si el RUT ya existe
    const existing = this.getByRut(ministroData.rut);
    if (existing) {
      throw new Error('Ya existe un Ministro de Fe registrado con este RUT.');
    }

    // Verificar si el email ya existe
    const existingEmail = this.getByEmail(ministroData.email);
    if (existingEmail) {
      throw new Error('Ya existe un Ministro de Fe con este email.');
    }

    const ministros = this.getAll();

    // Generar contraseña temporal
    const tempPassword = this.generateTemporaryPassword();

    const newMinistro = {
      id: `mf-${Date.now()}`,
      rut: ministroData.rut,
      firstName: ministroData.firstName,
      lastName: ministroData.lastName,
      email: ministroData.email,
      phone: ministroData.phone || '',
      address: ministroData.address || '',
      specialty: ministroData.specialty || 'General',
      active: ministroData.active !== undefined ? ministroData.active : true,
      // Credenciales de acceso
      password: tempPassword, // En producción esto debería estar hasheado
      mustChangePassword: true,
      role: 'MINISTRO',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    ministros.push(newMinistro);
    this.saveAll(ministros);

    // Retornar con la contraseña temporal visible una sola vez
    return { ...newMinistro, temporaryPassword: tempPassword };
  }

  /**
   * Actualiza un ministro existente
   */
  update(id, updates) {
    const ministros = this.getAll();
    const index = ministros.findIndex(m => m.id === id);

    if (index === -1) {
      throw new Error('Ministro de Fe no encontrado.');
    }

    // Si se está cambiando el RUT, verificar que no exista otro con ese RUT
    if (updates.rut && updates.rut !== ministros[index].rut) {
      const existing = this.getByRut(updates.rut);
      if (existing && existing.id !== id) {
        throw new Error('Ya existe otro Ministro de Fe con este RUT.');
      }
    }

    ministros[index] = {
      ...ministros[index],
      ...updates,
      id: ministros[index].id, // Mantener ID original
      createdAt: ministros[index].createdAt, // Mantener fecha de creación
      updatedAt: new Date().toISOString()
    };

    this.saveAll(ministros);
    return ministros[index];
  }

  /**
   * Elimina un ministro
   */
  delete(id) {
    const ministros = this.getAll();
    const filtered = ministros.filter(m => m.id !== id);

    if (filtered.length === ministros.length) {
      throw new Error('Ministro de Fe no encontrado.');
    }

    this.saveAll(filtered);
    return true;
  }

  /**
   * Activa o desactiva un ministro
   */
  toggleActive(id) {
    const ministros = this.getAll();
    const ministro = ministros.find(m => m.id === id);

    if (!ministro) {
      throw new Error('Ministro de Fe no encontrado.');
    }

    ministro.active = !ministro.active;
    ministro.updatedAt = new Date().toISOString();

    this.saveAll(ministros);
    return ministro;
  }

  /**
   * Guarda todos los ministros
   */
  saveAll(ministros) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(ministros));
    } catch (error) {
      console.error('Error al guardar ministros:', error);
      throw new Error('No se pudo guardar la información.');
    }
  }

  /**
   * Obtiene estadísticas
   */
  getStats() {
    const ministros = this.getAll();
    return {
      total: ministros.length,
      active: ministros.filter(m => m.active).length,
      inactive: ministros.filter(m => !m.active).length
    };
  }

  /**
   * Genera una contraseña temporal aleatoria
   */
  generateTemporaryPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Autentica un ministro con email y contraseña
   */
  authenticate(email, password) {
    const ministro = this.getByEmail(email);

    if (!ministro) {
      throw new Error('Credenciales inválidas');
    }

    if (!ministro.active) {
      throw new Error('Tu cuenta ha sido desactivada. Contacta al administrador.');
    }

    if (ministro.password !== password) {
      throw new Error('Credenciales inválidas');
    }

    // No retornar la contraseña
    const { password: _, ...ministroWithoutPassword } = ministro;
    return ministroWithoutPassword;
  }

  /**
   * Cambia la contraseña de un ministro
   */
  changePassword(ministroId, currentPassword, newPassword) {
    const ministros = this.getAll();
    const index = ministros.findIndex(m => m.id === ministroId);

    if (index === -1) {
      throw new Error('Ministro no encontrado');
    }

    const ministro = ministros[index];

    if (ministro.password !== currentPassword) {
      throw new Error('La contraseña actual es incorrecta');
    }

    if (newPassword.length < 6) {
      throw new Error('La nueva contraseña debe tener al menos 6 caracteres');
    }

    ministro.password = newPassword;
    ministro.mustChangePassword = false;
    ministro.updatedAt = new Date().toISOString();

    this.saveAll(ministros);

    const { password: _, ...ministroWithoutPassword } = ministro;
    return ministroWithoutPassword;
  }

  /**
   * Reinicia la contraseña de un ministro (solo admin)
   */
  resetPassword(ministroId) {
    const ministros = this.getAll();
    const index = ministros.findIndex(m => m.id === ministroId);

    if (index === -1) {
      throw new Error('Ministro no encontrado');
    }

    const tempPassword = this.generateTemporaryPassword();
    ministros[index].password = tempPassword;
    ministros[index].mustChangePassword = true;
    ministros[index].updatedAt = new Date().toISOString();

    this.saveAll(ministros);

    return { success: true, temporaryPassword: tempPassword };
  }
}

// Exportar instancia singleton
export const ministroService = new MinistroService();
