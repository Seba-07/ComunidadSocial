/**
 * UnidadesVecinalesService - Servicio para manejar las unidades vecinales
 */

import { apiService } from './ApiService.js';

class UnidadesVecinalesService {
  constructor() {
    this.cache = null;
    this.cacheTime = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Obtener todas las unidades vecinales
   */
  async getAll(options = {}) {
    try {
      // Usar caché si está disponible y es reciente
      if (this.cache && this.cacheTime && (Date.now() - this.cacheTime < this.CACHE_DURATION)) {
        let result = [...this.cache];
        if (options.macrozona) {
          result = result.filter(uv => uv.macrozona === parseInt(options.macrozona));
        }
        if (options.activa !== undefined) {
          result = result.filter(uv => uv.activa === options.activa);
        }
        return result;
      }

      const params = new URLSearchParams();
      if (options.macrozona) params.append('macrozona', options.macrozona);
      if (options.activa !== undefined) params.append('activa', options.activa);

      const url = `/unidades-vecinales${params.toString() ? '?' + params.toString() : ''}`;
      const unidades = await apiService.get(url);

      // Guardar en caché si no hay filtros
      if (!options.macrozona && options.activa === undefined) {
        this.cache = unidades;
        this.cacheTime = Date.now();
      }

      return unidades;
    } catch (error) {
      console.error('Error al obtener unidades vecinales:', error);
      throw error;
    }
  }

  /**
   * Buscar unidad vecinal por dirección
   */
  async buscarPorDireccion(direccion) {
    try {
      if (!direccion || direccion.trim().length < 3) {
        return { encontrada: false, mensaje: 'Dirección muy corta' };
      }

      const result = await apiService.get(`/unidades-vecinales/buscar?direccion=${encodeURIComponent(direccion)}`);
      return result;
    } catch (error) {
      console.error('Error al buscar unidad vecinal:', error);
      return { encontrada: false, error: error.message };
    }
  }

  /**
   * Obtener resumen de macrozonas
   */
  async getMacrozonas() {
    try {
      return await apiService.get('/unidades-vecinales/macrozonas');
    } catch (error) {
      console.error('Error al obtener macrozonas:', error);
      throw error;
    }
  }

  /**
   * Obtener una unidad vecinal por ID
   */
  async getById(id) {
    try {
      return await apiService.get(`/unidades-vecinales/${id}`);
    } catch (error) {
      console.error('Error al obtener unidad vecinal:', error);
      throw error;
    }
  }

  /**
   * Crear una nueva unidad vecinal (solo admin)
   */
  async create(data) {
    try {
      this.invalidateCache();
      return await apiService.post('/unidades-vecinales', data);
    } catch (error) {
      console.error('Error al crear unidad vecinal:', error);
      throw error;
    }
  }

  /**
   * Actualizar una unidad vecinal (solo admin)
   */
  async update(id, data) {
    try {
      this.invalidateCache();
      return await apiService.put(`/unidades-vecinales/${id}`, data);
    } catch (error) {
      console.error('Error al actualizar unidad vecinal:', error);
      throw error;
    }
  }

  /**
   * Eliminar una unidad vecinal (solo admin)
   */
  async delete(id) {
    try {
      this.invalidateCache();
      return await apiService.delete(`/unidades-vecinales/${id}`);
    } catch (error) {
      console.error('Error al eliminar unidad vecinal:', error);
      throw error;
    }
  }

  /**
   * Agregar poblaciones a una unidad vecinal (solo admin)
   */
  async agregarPoblaciones(id, poblaciones) {
    try {
      this.invalidateCache();
      return await apiService.post(`/unidades-vecinales/${id}/poblaciones`, { poblaciones });
    } catch (error) {
      console.error('Error al agregar poblaciones:', error);
      throw error;
    }
  }

  /**
   * Agregar calles a una unidad vecinal (solo admin)
   */
  async agregarCalles(id, calles) {
    try {
      this.invalidateCache();
      return await apiService.post(`/unidades-vecinales/${id}/calles`, { calles });
    } catch (error) {
      console.error('Error al agregar calles:', error);
      throw error;
    }
  }

  /**
   * Eliminar una población de una unidad vecinal (solo admin)
   */
  async eliminarPoblacion(id, poblacion) {
    try {
      this.invalidateCache();
      return await apiService.delete(`/unidades-vecinales/${id}/poblaciones/${encodeURIComponent(poblacion)}`);
    } catch (error) {
      console.error('Error al eliminar población:', error);
      throw error;
    }
  }

  /**
   * Ejecutar seed (solo admin)
   */
  async ejecutarSeed() {
    try {
      this.invalidateCache();
      return await apiService.post('/unidades-vecinales/seed');
    } catch (error) {
      console.error('Error al ejecutar seed:', error);
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

  /**
   * Obtener lista de unidades vecinales formateada para select
   */
  async getForSelect() {
    try {
      const unidades = await this.getAll({ activa: true });
      return unidades.map(uv => ({
        value: uv.numero,
        label: `UV ${uv.numero}${uv.nombre && uv.nombre !== `Unidad Vecinal ${uv.numero}` ? ` - ${uv.nombre}` : ''}`,
        macrozona: uv.macrozona,
        poblaciones: uv.poblaciones
      }));
    } catch (error) {
      console.error('Error al obtener unidades para select:', error);
      return [];
    }
  }

  /**
   * Obtener nombre de macrozona
   */
  getNombreMacrozona(numero) {
    const nombres = {
      1: 'Macrozona 1',
      2: 'Macrozona 2',
      3: 'Macrozona 3',
      4: 'Macrozona 4',
      5: 'Macrozona 5',
      6: 'Macrozona 6',
      7: 'Macrozona 7'
    };
    return nombres[numero] || `Macrozona ${numero}`;
  }
}

export default new UnidadesVecinalesService();
