/**
 * GuiaConstitucionService - Servicio para manejar la guía de constitución
 */

import { apiService } from './ApiService.js';

class GuiaConstitucionService {
  constructor() {
    this.cache = null;
    this.cacheTime = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Obtener la guía de constitución
   */
  async get() {
    try {
      // Usar caché si está disponible y es reciente
      if (this.cache && this.cacheTime && (Date.now() - this.cacheTime < this.CACHE_DURATION)) {
        return this.cache;
      }

      const guia = await apiService.get('/guia-constitucion');

      this.cache = guia;
      this.cacheTime = Date.now();

      return guia;
    } catch (error) {
      console.error('Error al obtener guía de constitución:', error);
      throw error;
    }
  }

  /**
   * Actualizar la guía de constitución (solo MUNICIPALIDAD)
   */
  async update(contentHTML, isPublished = true) {
    try {
      this.invalidateCache();
      return await apiService.put('/guia-constitucion', { contentHTML, isPublished });
    } catch (error) {
      console.error('Error al actualizar guía de constitución:', error);
      throw error;
    }
  }

  /**
   * Invalidar caché
   */
  invalidateCache() {
    this.cache = null;
    this.cacheTime = null;
  }
}

export default new GuiaConstitucionService();
