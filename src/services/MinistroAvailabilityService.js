/**
 * Servicio de Disponibilidad de Ministros de Fe
 * Gestiona los bloqueos de horarios de los ministros
 * Persiste en backend (MongoDB) con localStorage como caché
 */

import { apiService } from './ApiService.js';

class MinistroAvailabilityService {
  constructor() {
    this.storageKey = 'ministro_availability';
    // Horas disponibles para agendar (formato 24h)
    this.availableHours = [
      '09:00', '10:00', '11:00', '12:00',
      '14:00', '15:00', '16:00', '17:00', '18:00'
    ];
    this.backendLoaded = {};  // { ministroId: true } track loaded
  }

  /**
   * Normaliza una hora al formato HH:MM (24h)
   */
  normalizeTime(time) {
    if (!time) return null;

    // Si ya está en formato HH:MM, retornar
    if (/^\d{2}:\d{2}$/.test(time)) {
      return time;
    }

    // Si tiene segundos (HH:MM:SS), quitar segundos
    if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
      return time.substring(0, 5);
    }

    // Intentar parsear otros formatos
    try {
      const [hours, minutes] = time.split(':');
      const h = String(hours).padStart(2, '0');
      const m = String(minutes || '00').padStart(2, '0');
      return `${h}:${m}`;
    } catch (error) {
      console.error('Error normalizando hora:', time, error);
      return time;
    }
  }

  /**
   * Obtiene la lista de horas disponibles para agendar
   */
  getAvailableHours() {
    return [...this.availableHours];
  }

  /**
   * Carga bloques desde el backend para un ministro
   */
  async loadFromBackend(ministroId) {
    try {
      const blocks = await apiService.getMinistroBlocks(ministroId);
      const allBlocks = this.getAll();
      // Bloques de otros ministros (no tocar)
      const otherBlocks = allBlocks.filter(b => b.ministroId !== ministroId);
      // Bloques locales de este ministro que NO están en el backend (ID local: block-*)
      const backendIds = new Set((blocks || []).map(b => b._id));
      const localOnlyBlocks = allBlocks.filter(b =>
        b.ministroId === ministroId &&
        typeof b.id === 'string' && b.id.startsWith('block-') &&
        !backendIds.has(b.id)
      );
      // Bloques del backend
      const backendBlocks = (blocks || []).map(b => ({
        id: b._id,
        ministroId: b.ministroId,
        ministroName: b.ministroName,
        date: b.date,
        time: b.time,
        endTime: b.endTime,
        blockType: b.blockType,
        type: b.blockType,
        reason: b.reason,
        assignmentId: b.assignmentId,
        active: b.active,
        createdAt: b.createdAt
      }));
      // Merge: backend blocks + local-only blocks + other ministros
      this.saveAll([...otherBlocks, ...backendBlocks, ...localOnlyBlocks]);
      this.backendLoaded[ministroId] = true;
      return [...backendBlocks, ...localOnlyBlocks];
    } catch (error) {
      console.warn('Error cargando bloques del backend:', error.message);
      return this.getByMinistroId(ministroId);
    }
  }

  /**
   * Obtiene todos los bloqueos
   */
  getAll() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error al obtener disponibilidad:', error);
      return [];
    }
  }

  /**
   * Obtiene bloqueos de un ministro específico
   */
  getByMinistroId(ministroId) {
    return this.getAll().filter(b => b.ministroId === ministroId);
  }

  /**
   * Crea un nuevo bloqueo (persiste en backend + localStorage)
   */
  async createBlock(blockData) {
    try {
      // Persistir en backend
      const result = await apiService.createMinistroBlock(blockData);

      // Agregar al localStorage como caché
      const blocks = this.getAll();
      blocks.push({
        id: result._id,
        ministroId: result.ministroId,
        ministroName: result.ministroName,
        date: result.date,
        time: result.time,
        endTime: result.endTime,
        blockType: result.blockType,
        type: result.blockType,
        reason: result.reason,
        assignmentId: result.assignmentId,
        active: result.active,
        createdAt: result.createdAt
      });
      this.saveAll(blocks);

      return result;
    } catch (error) {
      console.error('Error creando bloqueo en backend:', error);
      // Fallback: crear solo localmente
      return this.create(blockData);
    }
  }

  /**
   * Elimina un bloqueo (desactiva en backend + localStorage)
   */
  async deleteBlock(blockId) {
    try {
      await apiService.deleteMinistroBlock(blockId);
      // Eliminar del localStorage
      const blocks = this.getAll();
      const filtered = blocks.filter(b => b.id !== blockId);
      this.saveAll(filtered);
      return true;
    } catch (error) {
      console.error('Error eliminando bloqueo del backend:', error);
      // Fallback: eliminar solo localmente
      return this.delete(blockId);
    }
  }

  /**
   * Crea un nuevo bloqueo (solo localStorage - legacy)
   */
  create(blockData) {
    const blocks = this.getAll();

    // Normalizar la hora antes de guardar
    const normalizedTime = blockData.time ? this.normalizeTime(blockData.time) : null;

    // Verificar si ya existe un bloqueo para esa fecha/hora
    const existing = blocks.find(b =>
      b.ministroId === blockData.ministroId &&
      b.date === blockData.date &&
      b.time === normalizedTime &&
      b.active
    );

    if (existing) {
      throw new Error('Ya existe un bloqueo para esta fecha y hora');
    }

    const newBlock = {
      id: `block-${Date.now()}`,
      ministroId: blockData.ministroId,
      ministroName: blockData.ministroName || '',
      date: blockData.date, // YYYY-MM-DD
      time: normalizedTime, // HH:MM o null para todo el día
      endTime: blockData.endTime || null,
      blockType: blockData.blockType || blockData.type || 'manual',
      type: blockData.blockType || blockData.type || 'manual',
      reason: blockData.reason || '',
      active: true,
      createdAt: new Date().toISOString()
    };

    blocks.push(newBlock);
    this.saveAll(blocks);

    return newBlock;
  }

  /**
   * Elimina un bloqueo (solo localStorage - legacy)
   */
  delete(id) {
    const blocks = this.getAll();
    const filtered = blocks.filter(b => b.id !== id);

    if (filtered.length === blocks.length) {
      throw new Error('Bloqueo no encontrado');
    }

    this.saveAll(filtered);
    return true;
  }

  /**
   * Verifica si un ministro está disponible en una fecha/hora específica
   * Soporta bloques de duración (endTime)
   */
  isAvailable(ministroId, date, time) {
    const blocks = this.getByMinistroId(ministroId).filter(b => b.active);

    // Verificar bloqueos de día completo
    const fullDayBlock = blocks.find(b => b.date === date && !b.time);
    if (fullDayBlock) {
      return false;
    }

    // Normalizar la hora antes de comparar
    const normalizedTime = time ? this.normalizeTime(time) : null;

    // Verificar bloques con duración
    for (const block of blocks) {
      if (block.date !== date) continue;
      if (!block.time) continue; // ya chequeado como full_day

      if (block.blockType === 'duration' && block.endTime) {
        if (normalizedTime >= block.time && normalizedTime <= block.endTime) {
          return false;
        }
      } else if (block.time === normalizedTime) {
        return false;
      }
    }

    return true;
  }

  /**
   * Obtiene días bloqueados de un ministro en un mes
   */
  getBlockedDaysInMonth(ministroId, year, month) {
    const blocks = this.getByMinistroId(ministroId).filter(b => b.active);
    const monthStr = String(month).padStart(2, '0');
    const prefix = `${year}-${monthStr}`;

    const blockedDays = new Set();

    blocks.forEach(block => {
      if (block.date.startsWith(prefix)) {
        blockedDays.add(block.date);
      }
    });

    return Array.from(blockedDays);
  }

  /**
   * Obtiene horas bloqueadas de un ministro en un día específico
   * Soporta bloques de duración
   */
  getBlockedTimesInDay(ministroId, date) {
    const blocks = this.getByMinistroId(ministroId).filter(b =>
      b.active && b.date === date
    );

    // Si hay un bloqueo de día completo, retornar indicador
    const fullDayBlock = blocks.find(b => !b.time);
    if (fullDayBlock) {
      return { fullDay: true, times: [] };
    }

    // Retornar horas específicas bloqueadas (expandir rangos de duración)
    const blockedTimes = new Set();

    for (const block of blocks) {
      if (!block.time) continue;

      if (block.blockType === 'duration' && block.endTime) {
        // Expandir rango a todas las horas disponibles dentro del rango
        for (const hour of this.availableHours) {
          if (hour >= block.time && hour <= block.endTime) {
            blockedTimes.add(hour);
          }
        }
      } else {
        blockedTimes.add(block.time);
      }
    }

    return {
      fullDay: false,
      times: Array.from(blockedTimes)
    };
  }

  /**
   * Obtiene las horas disponibles para un ministro en una fecha específica
   * (excluye las horas bloqueadas)
   */
  getAvailableTimesForMinistro(ministroId, date) {
    const blocked = this.getBlockedTimesInDay(ministroId, date);

    // Si el día está bloqueado completamente, retornar array vacío
    if (blocked.fullDay) {
      return [];
    }

    // Filtrar las horas bloqueadas
    return this.availableHours.filter(hour => !blocked.times.includes(hour));
  }

  /**
   * Bloquea un día completo
   */
  blockFullDay(ministroId, date, reason = '') {
    return this.create({
      ministroId,
      date,
      time: null,
      type: 'manual',
      blockType: 'full_day',
      reason
    });
  }

  /**
   * Bloquea una hora específica
   */
  blockTime(ministroId, date, time, reason = '') {
    return this.create({
      ministroId,
      date,
      time,
      type: 'manual',
      blockType: 'manual',
      reason
    });
  }

  /**
   * Guarda todos los bloqueos
   */
  saveAll(blocks) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(blocks));
    } catch (error) {
      console.error('Error al guardar disponibilidad:', error);
      throw new Error('No se pudo guardar la información');
    }
  }

  /**
   * Limpia todos los bloqueos de un ministro específico
   */
  clearByMinistroId(ministroId) {
    const blocks = this.getAll();
    const filtered = blocks.filter(b => b.ministroId !== ministroId);
    this.saveAll(filtered);
    return true;
  }

  /**
   * Limpia todos los datos de disponibilidad (para reseteo)
   */
  clearAll() {
    localStorage.removeItem(this.storageKey);
  }
}

// Exportar instancia singleton
export const ministroAvailabilityService = new MinistroAvailabilityService();
