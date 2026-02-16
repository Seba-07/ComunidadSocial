import { apiService } from './ApiService.js';

/**
 * Servicio de Gestión de Horarios para Ministro de Fe
 * Maneja disponibilidad de días y horas, y reservas de citas
 * IMPORTANTE: Sincroniza reservas con el backend para que todos los usuarios vean los mismos horarios ocupados
 * Integra bloqueos de ministros (MinistroBlock) para disponibilidad real por hora
 */

class ScheduleService {
  constructor() {
    this.storageKey = 'ministro_schedule';
    this.bookingsKey = 'ministro_bookings';
    this.backendBookingsCache = [];
    this.lastBackendSync = 0;
    this.lastMinistrosSync = 0;
    this.CACHE_TTL = 30000; // 30 segundos de caché
    this.activeMinistrosCount = 0; // Se actualizará desde la API (0 = no hay ministros disponibles)
    this.activeMinistrosList = []; // Lista completa de ministros activos con sus availableHours
    this.ministroBlocksCache = {}; // { dateKey: { availability: {...}, totalMinistros } }
    this.lastBlocksSync = 0;
    this.init();
  }

  /**
   * Inicializa el servicio con horarios por defecto
   */
  init() {
    const schedule = this.getSchedule();
    if (!schedule || Object.keys(schedule).length === 0) {
      // Configuración por defecto: Lunes a Viernes, 9:00 a 17:00
      const defaultSchedule = this.generateDefaultSchedule();
      this.saveSchedule(defaultSchedule);
    }
  }

  /**
   * Genera horarios por defecto (próximos 3 meses, Lunes a Viernes, 9-17h)
   */
  generateDefaultSchedule() {
    const schedule = {};
    const today = new Date();
    const threeMonthsLater = new Date(today);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    const currentDate = new Date(today);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= threeMonthsLater) {
      const dayOfWeek = currentDate.getDay();

      // Solo días laborales (Lunes=1 a Viernes=5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const dateKey = this.getDateKey(currentDate);
        schedule[dateKey] = {
          date: dateKey,
          enabled: true,
          slots: this.generateTimeSlots('09:00', '17:00', 60) // Slots de 60 minutos
        };
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return schedule;
  }

  /**
   * Genera slots de tiempo entre startTime y endTime
   * @param {string} startTime - Hora inicio (ej: "09:00")
   * @param {string} endTime - Hora fin (ej: "17:00")
   * @param {number} intervalMinutes - Intervalo en minutos
   */
  generateTimeSlots(startTime, endTime, intervalMinutes = 60) {
    const slots = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    let currentMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    while (currentMinutes < endMinutes) {
      const hours = Math.floor(currentMinutes / 60);
      const minutes = currentMinutes % 60;
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      slots.push({
        time: timeStr,
        available: true
      });

      currentMinutes += intervalMinutes;
    }

    return slots;
  }

  /**
   * Obtiene la clave de fecha en formato YYYY-MM-DD
   */
  getDateKey(date) {
    // Si ya es un string en formato correcto, devolverlo directamente
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }

    // Si es un string en formato YYYY-MM-DD, parsearlo correctamente
    if (typeof date === 'string') {
      const [year, month, day] = date.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      const resultYear = d.getFullYear();
      const resultMonth = String(d.getMonth() + 1).padStart(2, '0');
      const resultDay = String(d.getDate()).padStart(2, '0');
      return `${resultYear}-${resultMonth}-${resultDay}`;
    }

    // Si es un objeto Date
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Obtiene todo el horario configurado
   */
  getSchedule() {
    const stored = localStorage.getItem(this.storageKey);
    return stored ? JSON.parse(stored) : {};
  }

  /**
   * Guarda el horario completo
   */
  saveSchedule(schedule) {
    localStorage.setItem(this.storageKey, JSON.stringify(schedule));
  }

  /**
   * Obtiene la disponibilidad de un día específico
   */
  getDaySchedule(date) {
    const schedule = this.getSchedule();
    const dateKey = this.getDateKey(date);
    return schedule[dateKey] || null;
  }

  /**
   * Actualiza o crea el horario de un día específico
   */
  setDaySchedule(date, dayData) {
    const schedule = this.getSchedule();
    const dateKey = this.getDateKey(date);
    schedule[dateKey] = {
      date: dateKey,
      enabled: dayData.enabled !== undefined ? dayData.enabled : true,
      slots: dayData.slots || []
    };
    this.saveSchedule(schedule);
  }

  /**
   * Habilita o deshabilita un día completo
   */
  toggleDayEnabled(date, enabled) {
    const schedule = this.getSchedule();
    const dateKey = this.getDateKey(date);

    if (schedule[dateKey]) {
      schedule[dateKey].enabled = enabled;
      this.saveSchedule(schedule);
    }
  }

  /**
   * Agrega un slot de tiempo a un día
   */
  addTimeSlot(date, time) {
    const schedule = this.getSchedule();
    const dateKey = this.getDateKey(date);

    if (!schedule[dateKey]) {
      schedule[dateKey] = {
        date: dateKey,
        enabled: true,
        slots: []
      };
    }

    // Verificar si el slot ya existe
    const existingSlot = schedule[dateKey].slots.find(s => s.time === time);
    if (!existingSlot) {
      schedule[dateKey].slots.push({
        time: time,
        available: true
      });

      // Ordenar slots por hora
      schedule[dateKey].slots.sort((a, b) => a.time.localeCompare(b.time));

      this.saveSchedule(schedule);
    }
  }

  /**
   * Elimina un slot de tiempo de un día
   */
  removeTimeSlot(date, time) {
    const schedule = this.getSchedule();
    const dateKey = this.getDateKey(date);

    if (schedule[dateKey]) {
      schedule[dateKey].slots = schedule[dateKey].slots.filter(s => s.time !== time);
      this.saveSchedule(schedule);
    }
  }

  // ============ BLOQUEOS DE MINISTROS ============

  /**
   * Sincroniza bloques de ministros desde el backend para una fecha
   * @param {string} date - Fecha en formato YYYY-MM-DD o Date object
   * @param {boolean} forceRefresh - Si es true, ignora el caché
   */
  async syncMinistroBlocks(date, forceRefresh = false) {
    const dateKey = this.getDateKey(date);
    const now = Date.now();

    // Usar caché si no ha expirado
    if (!forceRefresh && this.ministroBlocksCache[dateKey] &&
        now - this.lastBlocksSync < this.CACHE_TTL) {
      return this.ministroBlocksCache[dateKey];
    }

    try {
      const data = await apiService.getMinistroAvailabilityForDate(dateKey);
      this.ministroBlocksCache[dateKey] = data;
      this.lastBlocksSync = now;
      return data;
    } catch (error) {
      console.warn('[ScheduleService] Error sincronizando bloques:', error.message);
      // Retornar caché si existe, sino datos por defecto
      return this.ministroBlocksCache[dateKey] || {
        date: dateKey,
        totalMinistros: this.activeMinistrosCount,
        availability: {}
      };
    }
  }

  /**
   * Obtiene el número de ministros disponibles para una fecha y hora específica
   * Consulta el caché de bloques del backend
   */
  getActiveMinistrosCountForTime(date, time) {
    const dateKey = this.getDateKey(date);
    const blockData = this.ministroBlocksCache[dateKey];

    if (blockData && blockData.availability && blockData.availability[time]) {
      return blockData.availability[time].available;
    }

    // Fallback: todos los ministros disponibles
    return this.activeMinistrosCount;
  }

  /**
   * Obtiene los días disponibles de un mes específico (ASYNC)
   * Usa datos del backend para considerar bloques de ministros
   * @param {number} year - Año
   * @param {number} month - Mes (1-12)
   * @returns {Object} Objeto con días disponibles y ocupados
   */
  async getMonthAvailability(year, month) {
    const schedule = this.getSchedule();
    const bookings = this.getAllBookings();
    const availability = {
      available: [],
      partial: [],
      unavailable: []
    };

    console.log('[ScheduleService] getMonthAvailability para:', year, month);

    // Intentar obtener datos de bloques del backend para el mes
    let monthBlockData = null;
    try {
      monthBlockData = await apiService.getMinistroAvailabilityForMonth(year, month);
    } catch (error) {
      console.warn('[ScheduleService] Error obteniendo bloques mensuales, usando fallback:', error.message);
    }

    // Iterar todos los días del mes
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateKey = this.getDateKey(date);
      const daySchedule = schedule[dateKey];

      if (!daySchedule || !daySchedule.enabled || daySchedule.slots.length === 0) {
        availability.unavailable.push(dateKey);
        continue;
      }

      // Si tenemos datos del backend para este día
      if (monthBlockData && monthBlockData.days && monthBlockData.days[dateKey]) {
        const dayInfo = monthBlockData.days[dateKey];
        if (!dayInfo.hasAvailability) {
          availability.unavailable.push(dateKey);
        } else if (dayInfo.isPartial) {
          availability.partial.push(dateKey);
        } else {
          availability.available.push(dateKey);
        }
        continue;
      }

      // Fallback: calcular localmente sin bloques
      const dayBookings = bookings.filter(b => b.date === dateKey && b.status !== 'cancelled');
      const bookingsCountByTime = {};
      dayBookings.forEach(b => {
        bookingsCountByTime[b.time] = (bookingsCountByTime[b.time] || 0) + 1;
      });

      let slotsWithAvailability = 0;
      let slotsPartial = 0;
      let totalAvailableSlots = 0;

      const totalMinistros = this.getActiveMinistrosCount();

      daySchedule.slots.forEach(slot => {
        if (slot.available) {
          const bookingsAtTime = bookingsCountByTime[slot.time] || 0;

          if (totalMinistros > 0) {
            totalAvailableSlots++;
            if (bookingsAtTime < totalMinistros) {
              slotsWithAvailability++;
              if (bookingsAtTime > 0) {
                slotsPartial++;
              }
            }
          }
        }
      });

      if (slotsWithAvailability === 0) {
        availability.unavailable.push(dateKey);
      } else if (slotsPartial > 0 || slotsWithAvailability < totalAvailableSlots) {
        availability.partial.push(dateKey);
      } else {
        availability.available.push(dateKey);
      }
    }

    return availability;
  }

  /**
   * Obtiene slots disponibles de un día específico (ASYNC)
   * Considera bloques de ministros del backend
   */
  async getAvailableSlots(date) {
    const daySchedule = this.getDaySchedule(date);
    if (!daySchedule || !daySchedule.enabled) {
      return [];
    }

    const dateKey = this.getDateKey(date);
    const bookings = this.getAllBookings();

    // Sincronizar bloques del backend para esta fecha
    await this.syncMinistroBlocks(date);

    // Contar reservas por horario para esta fecha
    const bookingsForDate = bookings.filter(b => b.date === dateKey && b.status !== 'cancelled');
    const bookingsCountByTime = {};
    bookingsForDate.forEach(b => {
      bookingsCountByTime[b.time] = (bookingsCountByTime[b.time] || 0) + 1;
    });

    // Filtrar slots donde aún hay ministros disponibles
    const availableSlots = daySchedule.slots
      .filter(slot => {
        if (!slot.available) return false;

        const bookingsAtTime = bookingsCountByTime[slot.time] || 0;
        // Usar disponibilidad real por hora (considera bloques)
        const availableMinistros = this.getActiveMinistrosCountForTime(dateKey, slot.time);

        return availableMinistros > 0 && bookingsAtTime < availableMinistros;
      })
      .map(slot => slot.time);

    return availableSlots;
  }

  /**
   * Obtiene el número de ministros activos (cargado desde la API)
   */
  getActiveMinistrosCount() {
    // Usar el valor cargado desde la API
    // Si hay 0 ministros activos, devolver 0 (no hay disponibilidad)
    return this.activeMinistrosCount;
  }

  /**
   * Carga el número de ministros activos desde la API
   * @param {boolean} forceRefresh - Si es true, ignora el caché
   */
  async loadActiveMinistros(forceRefresh = false) {
    const now = Date.now();
    // Usar caché si no ha expirado y no se fuerza recarga
    // Solo usar caché si ya tenemos datos cargados (lastMinistrosSync > 0)
    if (!forceRefresh && this.lastMinistrosSync > 0 &&
        now - this.lastMinistrosSync < this.CACHE_TTL) {
      return this.activeMinistrosCount;
    }

    try {
      const ministros = await apiService.getActiveMinistros();
      this.activeMinistrosList = Array.isArray(ministros) ? ministros : [];
      this.activeMinistrosCount = this.activeMinistrosList.length;
      this.lastMinistrosSync = now;
      return this.activeMinistrosCount;
    } catch (e) {
      console.warn('[ScheduleService] Error cargando ministros:', e.message);
      return this.activeMinistrosCount;
    }
  }

  /**
   * Invalida el caché de bloques (llamar después de crear/eliminar bloques)
   */
  invalidateBlocksCache() {
    this.ministroBlocksCache = {};
    this.lastBlocksSync = 0;
  }

  // ============ GESTIÓN DE RESERVAS ============

  /**
   * Sincroniza las reservas con el backend (desde organizaciones con electionDate/electionTime)
   * Esto permite que todos los usuarios vean los mismos horarios ocupados
   * @param {boolean} forceRefresh - Si es true, ignora el caché
   */
  async syncBackendBookings(forceRefresh = false) {
    try {
      const now = Date.now();
      // Usar caché si no ha expirado y no se fuerza recarga
      if (!forceRefresh && this.lastBackendSync > 0 &&
          now - this.lastBackendSync < this.CACHE_TTL && this.backendBookingsCache.length > 0) {
        return this.backendBookingsCache;
      }

      // Usar endpoint público para obtener horarios ocupados (no requiere auth)
      const response = await apiService.getBookedSlots();

      // El endpoint ahora retorna { bookedSlots, ministroBlockSlots }
      // Pero mantener compatibilidad si retorna array plano
      const bookedSlots = Array.isArray(response) ? response : (response.bookedSlots || []);

      // Convertir a formato de booking (solo necesitamos date y time para el cálculo)
      const backendBookings = (bookedSlots || []).map((slot, index) => ({
        id: `backend-${index}`,
        date: slot.date,
        time: slot.time,
        status: 'confirmed',
        source: 'backend'
      })).filter(b => b.date && b.time);

      this.backendBookingsCache = backendBookings;
      this.lastBackendSync = now;

      return backendBookings;
    } catch (error) {
      console.error('[ScheduleService] Error sincronizando backend:', error);
      return this.backendBookingsCache; // Devolver caché anterior en caso de error
    }
  }

  /**
   * Obtiene todas las reservas (locales + backend)
   */
  getAllBookings() {
    const stored = localStorage.getItem(this.bookingsKey);
    const localBookings = stored ? JSON.parse(stored) : [];

    // Combinar reservas locales con las del backend (caché)
    // Eliminar duplicados basándose en fecha y hora
    const combined = [...localBookings];

    for (const backendBooking of this.backendBookingsCache) {
      const exists = combined.some(
        b => b.date === backendBooking.date && b.time === backendBooking.time
      );
      if (!exists) {
        combined.push(backendBooking);
      }
    }

    return combined;
  }

  /**
   * Obtiene solo las reservas locales (sin backend)
   */
  getLocalBookings() {
    const stored = localStorage.getItem(this.bookingsKey);
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * Guarda todas las reservas
   */
  saveBookings(bookings) {
    localStorage.setItem(this.bookingsKey, JSON.stringify(bookings));
  }

  /**
   * Crea una nueva reserva
   */
  createBooking(bookingData) {
    const bookings = this.getAllBookings();

    // Verificar si el slot está disponible
    const dateKey = this.getDateKey(bookingData.date);
    const existingBooking = bookings.find(
      b => b.date === dateKey &&
           b.time === bookingData.time &&
           b.status !== 'cancelled'
    );

    if (existingBooking) {
      throw new Error('Este horario ya está reservado');
    }

    const newBooking = {
      id: `booking-${Date.now()}`,
      date: dateKey,
      time: bookingData.time,
      organizationId: bookingData.organizationId,
      organizationName: bookingData.organizationName,
      organizationType: bookingData.organizationType,
      userId: bookingData.userId,
      userName: bookingData.userName,
      userEmail: bookingData.userEmail,
      userPhone: bookingData.userPhone,
      comments: bookingData.comments || '',
      status: 'pending', // pending, confirmed, cancelled, completed
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    bookings.push(newBooking);
    this.saveBookings(bookings);

    return newBooking;
  }

  /**
   * Obtiene una reserva por ID
   */
  getBookingById(bookingId) {
    const bookings = this.getAllBookings();
    return bookings.find(b => b.id === bookingId);
  }

  /**
   * Obtiene reservas por organización
   */
  getBookingsByOrganization(organizationId) {
    const bookings = this.getAllBookings();
    return bookings.filter(b => b.organizationId === organizationId);
  }

  /**
   * Obtiene reservas por usuario
   */
  getBookingsByUser(userId) {
    const bookings = this.getAllBookings();
    return bookings.filter(b => b.userId === userId);
  }

  /**
   * Actualiza el estado de una reserva
   */
  updateBookingStatus(bookingId, newStatus) {
    const bookings = this.getAllBookings();
    const booking = bookings.find(b => b.id === bookingId);

    if (booking) {
      booking.status = newStatus;
      booking.updatedAt = new Date().toISOString();
      this.saveBookings(bookings);
      return booking;
    }

    return null;
  }

  /**
   * Cancela una reserva
   */
  cancelBooking(bookingId) {
    return this.updateBookingStatus(bookingId, 'cancelled');
  }

  /**
   * Confirma una reserva
   */
  confirmBooking(bookingId) {
    return this.updateBookingStatus(bookingId, 'confirmed');
  }

  /**
   * Completa una reserva
   */
  completeBooking(bookingId) {
    return this.updateBookingStatus(bookingId, 'completed');
  }

  /**
   * Obtiene reservas por fecha
   */
  getBookingsByDate(date) {
    const dateKey = this.getDateKey(date);
    const bookings = this.getAllBookings();
    return bookings.filter(b => b.date === dateKey && b.status !== 'cancelled');
  }

  /**
   * Obtiene estadísticas de reservas
   */
  getBookingStats() {
    const bookings = this.getAllBookings();

    return {
      total: bookings.length,
      pending: bookings.filter(b => b.status === 'pending').length,
      confirmed: bookings.filter(b => b.status === 'confirmed').length,
      completed: bookings.filter(b => b.status === 'completed').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length
    };
  }

  /**
   * Elimina horarios pasados (limpieza)
   */
  cleanOldSchedules() {
    const schedule = this.getSchedule();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = this.getDateKey(today);

    const cleanedSchedule = {};
    Object.keys(schedule).forEach(dateKey => {
      if (dateKey >= todayKey) {
        cleanedSchedule[dateKey] = schedule[dateKey];
      }
    });

    this.saveSchedule(cleanedSchedule);
  }

  /**
   * Resetea todos los datos (usar con precaución)
   */
  resetAll() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.bookingsKey);
    this.init();
  }

  /**
   * Bloquea la mañana de un día (horarios antes de las 13:00)
   */
  blockMorning(date) {
    const schedule = this.getSchedule();
    const dateKey = this.getDateKey(date);

    if (schedule[dateKey] && schedule[dateKey].slots) {
      schedule[dateKey].slots = schedule[dateKey].slots.filter(slot => {
        const hour = parseInt(slot.time.split(':')[0]);
        return hour >= 13; // Mantener solo horarios de 13:00 en adelante
      });
      this.saveSchedule(schedule);
    }
  }

  /**
   * Bloquea la tarde de un día (horarios desde las 13:00)
   */
  blockAfternoon(date) {
    const schedule = this.getSchedule();
    const dateKey = this.getDateKey(date);

    if (schedule[dateKey] && schedule[dateKey].slots) {
      schedule[dateKey].slots = schedule[dateKey].slots.filter(slot => {
        const hour = parseInt(slot.time.split(':')[0]);
        return hour < 13; // Mantener solo horarios antes de las 13:00
      });
      this.saveSchedule(schedule);
    }
  }

  /**
   * Limpia todos los datos del calendario (para reseteo de DB)
   */
  clearAllData() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.bookingsKey);
  }

  /**
   * Limpia solo las reservas (mantiene la configuración del calendario)
   */
  clearAllBookings() {
    localStorage.removeItem(this.bookingsKey);
    console.log('Todas las reservas han sido eliminadas');
  }

  /**
   * Limpia reservas de organizaciones que ya no existen
   * @param {Array} validOrgIds - Lista de IDs de organizaciones válidas
   * @returns {number} Cantidad de reservas eliminadas
   */
  cleanOrphanedBookings(validOrgIds) {
    const bookings = this.getAllBookings();
    const validIds = new Set(validOrgIds.map(id => String(id)));

    const validBookings = bookings.filter(booking => {
      const orgId = String(booking.organizationId);
      return validIds.has(orgId);
    });

    const removedCount = bookings.length - validBookings.length;

    if (removedCount > 0) {
      this.saveBookings(validBookings);
    }

    return removedCount;
  }
}

// Instancia singleton
export const scheduleService = new ScheduleService();
