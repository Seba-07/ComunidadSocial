/**
 * Servicio de Disponibilidad de Ministros de Fe
 * Gestiona los bloqueos de horarios de los ministros
 */

class MinistroAvailabilityService {
  constructor() {
    this.storageKey = 'ministro_availability';
    // Horas disponibles para agendar (formato 24h)
    this.availableHours = [
      '09:00', '10:00', '11:00', '12:00',
      '14:00', '15:00', '16:00', '17:00', '18:00'
    ];
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
   * Crea un nuevo bloqueo
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
      date: blockData.date, // YYYY-MM-DD
      time: normalizedTime, // HH:MM o null para todo el día
      type: blockData.type || 'manual', // manual, holiday, vacation
      reason: blockData.reason || '',
      active: true,
      createdAt: new Date().toISOString()
    };

    blocks.push(newBlock);
    this.saveAll(blocks);

    return newBlock;
  }

  /**
   * Elimina un bloqueo
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
   */
  isAvailable(ministroId, date, time) {
    const blocks = this.getByMinistroId(ministroId).filter(b => b.active);

    // Verificar bloqueos de día completo
    const fullDayBlock = blocks.find(b => b.date === date && !b.time);
    if (fullDayBlock) {
      console.log(`❌ Ministro ${ministroId} bloqueado - día completo: ${date}`);
      return false;
    }

    // Normalizar la hora antes de comparar
    const normalizedTime = time ? this.normalizeTime(time) : null;

    // Verificar bloqueos de hora específica
    const timeBlock = blocks.find(b => b.date === date && b.time === normalizedTime);
    if (timeBlock) {
      console.log(`❌ Ministro ${ministroId} bloqueado - hora específica: ${date} ${normalizedTime}`);
      return false;
    }

    console.log(`✅ Ministro ${ministroId} disponible: ${date} ${normalizedTime}`);
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

    // Retornar horas específicas bloqueadas
    return {
      fullDay: false,
      times: blocks.filter(b => b.time).map(b => b.time)
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
