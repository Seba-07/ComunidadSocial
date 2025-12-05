/**
 * Servicio de Gestión de Ministros de Fe
 * Conecta con el backend API
 */

import { apiService } from './ApiService.js';

class MinistroService {
  constructor() {
    this.ministros = [];
    this.loaded = false;
  }

  /**
   * Carga los ministros desde el servidor
   */
  async loadFromServer() {
    try {
      this.ministros = await apiService.getMinistros();
      this.loaded = true;
      localStorage.setItem('ministros_fe', JSON.stringify(this.ministros));
    } catch (e) {
      console.error('Error loading ministros from server:', e);
      this.loadFromStorage();
    }
  }

  /**
   * Carga desde localStorage (fallback)
   */
  loadFromStorage() {
    try {
      const data = localStorage.getItem('ministros_fe');
      this.ministros = data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error al obtener ministros:', error);
      this.ministros = [];
    }
  }

  /**
   * Sincroniza con el servidor
   */
  async sync() {
    await this.loadFromServer();
  }

  /**
   * Obtiene todos los ministros
   */
  getAll() {
    return this.ministros;
  }

  /**
   * Obtiene todos los ministros desde el servidor
   */
  async getAllAsync() {
    try {
      const ministros = await apiService.getMinistros();
      this.ministros = ministros;
      localStorage.setItem('ministros_fe', JSON.stringify(ministros));
      return ministros;
    } catch (e) {
      console.error('Error fetching ministros:', e);
      return this.ministros;
    }
  }

  /**
   * Obtiene solo ministros activos
   */
  getActive() {
    return this.ministros.filter(m => m.active);
  }

  /**
   * Obtiene ministros activos desde el servidor
   */
  async getActiveAsync() {
    try {
      const ministros = await apiService.getActiveMinistros();
      return ministros;
    } catch (e) {
      console.error('Error fetching active ministros:', e);
      return this.getActive();
    }
  }

  /**
   * Obtiene un ministro por ID
   */
  getById(id) {
    return this.ministros.find(m => m.id === id || m._id === id) || null;
  }

  /**
   * Obtiene un ministro por ID desde el servidor
   */
  async getByIdAsync(id) {
    try {
      return await apiService.getMinistro(id);
    } catch (e) {
      console.error('Error fetching ministro:', e);
      return this.getById(id);
    }
  }

  /**
   * Obtiene un ministro por RUT
   */
  getByRut(rut) {
    const cleanRut = rut.replace(/\./g, '').replace(/-/g, '');
    return this.ministros.find(m => {
      const ministroRut = m.rut.replace(/\./g, '').replace(/-/g, '');
      return ministroRut === cleanRut;
    }) || null;
  }

  /**
   * Obtiene un ministro por email
   */
  getByEmail(email) {
    return this.ministros.find(m => m.email?.toLowerCase() === email.toLowerCase()) || null;
  }

  /**
   * Crea un nuevo ministro
   */
  async create(ministroData) {
    try {
      const result = await apiService.createMinistro(ministroData);
      this.ministros.push(result.ministro || result);
      localStorage.setItem('ministros_fe', JSON.stringify(this.ministros));
      return result;
    } catch (e) {
      console.error('Error creating ministro:', e);
      throw e;
    }
  }

  /**
   * Actualiza un ministro existente
   */
  async update(id, updates) {
    try {
      const updated = await apiService.updateMinistro(id, updates);
      const index = this.ministros.findIndex(m => m.id === id || m._id === id);
      if (index !== -1) {
        this.ministros[index] = updated;
        localStorage.setItem('ministros_fe', JSON.stringify(this.ministros));
      }
      return updated;
    } catch (e) {
      console.error('Error updating ministro:', e);
      throw e;
    }
  }

  /**
   * Elimina un ministro
   */
  async delete(id) {
    try {
      await apiService.deleteMinistro(id);
      this.ministros = this.ministros.filter(m => m.id !== id && m._id !== id);
      localStorage.setItem('ministros_fe', JSON.stringify(this.ministros));
      return true;
    } catch (e) {
      console.error('Error deleting ministro:', e);
      throw e;
    }
  }

  /**
   * Activa o desactiva un ministro
   */
  async toggleActive(id) {
    try {
      const updated = await apiService.toggleMinistroActive(id);
      const index = this.ministros.findIndex(m => m.id === id || m._id === id);
      if (index !== -1) {
        this.ministros[index] = updated;
        localStorage.setItem('ministros_fe', JSON.stringify(this.ministros));
      }
      return updated;
    } catch (e) {
      console.error('Error toggling ministro active:', e);
      throw e;
    }
  }

  /**
   * Obtiene estadísticas
   */
  async getStats() {
    try {
      return await apiService.getMinistroStats();
    } catch (e) {
      console.error('Error getting stats:', e);
      return {
        total: this.ministros.length,
        active: this.ministros.filter(m => m.active).length,
        inactive: this.ministros.filter(m => !m.active).length
      };
    }
  }

  /**
   * Autentica un ministro con email y contraseña
   */
  async authenticate(email, password) {
    try {
      const result = await apiService.loginMinistro(email, password);
      return result.ministro;
    } catch (e) {
      console.error('Error authenticating ministro:', e);
      throw e;
    }
  }

  /**
   * Cambia la contraseña de un ministro
   */
  async changePassword(ministroId, currentPassword, newPassword) {
    try {
      return await apiService.changePassword(currentPassword, newPassword);
    } catch (e) {
      console.error('Error changing password:', e);
      throw e;
    }
  }

  /**
   * Reinicia la contraseña de un ministro (solo admin)
   */
  async resetPassword(ministroId) {
    try {
      return await apiService.resetMinistroPassword(ministroId);
    } catch (e) {
      console.error('Error resetting password:', e);
      throw e;
    }
  }
}

// Exportar instancia singleton
export const ministroService = new MinistroService();
