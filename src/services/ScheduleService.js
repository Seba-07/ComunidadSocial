import { apiService } from './ApiService.js';

/**
 * Servicio de Gestión de Horarios para Ministro de Fe
 * Maneja disponibilidad de días y horas, y reservas de citas
 * IMPORTANTE: Sincroniza reservas con el backend para que todos los usuarios vean los mismos horarios ocupados
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

  /**
   * Obtiene los días disponibles de un mes específico
   * @param {number} year - Año
   * @param {number} month - Mes (1-12)
   * @returns {Object} Objeto con días disponibles y ocupados
   */
  getMonthAvailability(year, month) {
    const schedule = this.getSchedule();
    const bookings = this.getAllBookings();
    const availability = {
      available: [],
      partial: [],
      unavailable: []
    };

    console.log('📆 [ScheduleService] getMonthAvailability para:', year, month);
    console.log('📆 [ScheduleService] Total reservas:', bookings.length);

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

      // Contar reservas por horario para este día
      const dayBookings = bookings.filter(b => b.date === dateKey && b.status !== 'cancelled');
      const bookingsCountByTime = {};
      dayBookings.forEach(b => {
        bookingsCountByTime[b.time] = (bookingsCountByTime[b.time] || 0) + 1;
      });

      // Contar slots con disponibilidad (usando ministros por hora específica)
      let slotsWithAvailability = 0;
      let slotsPartial = 0;
      let totalAvailableSlots = 0;

      daySchedule.slots.forEach(slot => {
        if (slot.available) {
          // Obtener ministros disponibles para ESTA HORA específica
          const ministrosForTime = this.getActiveMinistrosCountForTime(slot.time);
          const bookingsAtTime = bookingsCountByTime[slot.time] || 0;

          // Solo contar si hay al menos un ministro disponible para esta hora
          if (ministrosForTime > 0) {
            totalAvailableSlots++;
            if (bookingsAtTime < ministrosForTime) {
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

    console.log('📆 [ScheduleService] Días parcialmente ocupados:', availability.partial);

    return availability;
  }

  /**
   * Obtiene slots disponibles de un día específico (excluyendo reservados)
   * Considera el número de ministros disponibles POR HORA ESPECÍFICA
   */
  getAvailableSlots(date) {
    const daySchedule = this.getDaySchedule(date);
    if (!daySchedule || !daySchedule.enabled) {
      console.log('📅 [ScheduleService] getAvailableSlots: día no habilitado o sin horario', date);
      return [];
    }

    const dateKey = this.getDateKey(date);
    const bookings = this.getAllBookings();

    console.log('📅 [ScheduleService] getAvailableSlots para fecha:', dateKey);
    console.log('📅 [ScheduleService] Total reservas en sistema:', bookings.length);

    // Contar reservas por horario para esta fecha
    const bookingsForDate = bookings.filter(b => b.date === dateKey && b.status !== 'cancelled');
    const bookingsCountByTime = {};
    bookingsForDate.forEach(b => {
      bookingsCountByTime[b.time] = (bookingsCountByTime[b.time] || 0) + 1;
    });

    console.log('📅 [ScheduleService] Reservas por horario:', bookingsCountByTime);

    // Filtrar slots donde aún hay ministros disponibles EN ESA HORA ESPECÍFICA
    const availableSlots = daySchedule.slots
      .filter(slot => {
        if (!slot.available) return false;

        // Obtener ministros disponibles para ESTA HORA específica
        const ministrosForTime = this.getActiveMinistrosCountForTime(slot.time);
        const bookingsAtTime = bookingsCountByTime[slot.time] || 0;

        console.log(`📅 [ScheduleService] Hora ${slot.time}: ${ministrosForTime} ministros disponibles, ${bookingsAtTime} reservas`);

        // Solo disponible si hay ministros para esa hora Y hay menos reservas que ministros
        return ministrosForTime > 0 && bookingsAtTime < ministrosForTime;
      })
      .map(slot => slot.time);

    console.log('📅 [ScheduleService] Horarios disponibles (después de filtrar):', availableSlots);

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
   * Se usa para inicializar el servicio y mantener el dato actualizado
   */
  async loadActiveMinistros() {
    const now = Date.now();
    // Usar caché si no ha expirado
    if (now - this.lastMinistrosSync < this.CACHE_TTL && this.activeMinistrosCount >= 0) {
      return this.activeMinistrosCount;
    }

    try {
      const ministros = await apiService.getActiveMinistros();
      this.activeMinistrosList = Array.isArray(ministros) ? ministros : [];
      this.activeMinistrosCount = this.activeMinistrosList.length;
      this.lastMinistrosSync = now;
      console.log('👥 [ScheduleService] Ministros activos cargados:', this.activeMinistrosCount);
      console.log('👥 [ScheduleService] Ministros con availableHours:',
        this.activeMinistrosList.filter(m => m.availableHours?.length > 0).length);
      return this.activeMinistrosCount;
    } catch (e) {
      console.warn('⚠️ [ScheduleService] Error cargando ministros:', e.message);
      return this.activeMinistrosCount;
    }
  }

  /**
   * Obtiene el número de ministros disponibles para una hora específica
   * @param {string} time - Hora en formato "HH:MM" (ej: "09:00")
   * @returns {number} Cantidad de ministros disponibles en esa hora
   */
  getActiveMinistrosCountForTime(time) {
    // Si no hay lista de ministros, devolver 0
    if (!this.activeMinistrosList || this.activeMinistrosList.length === 0) {
      return 0;
    }

    // Contar ministros que tienen esta hora en sus availableHours
    const count = this.activeMinistrosList.filter(ministro => {
      // Si el ministro no tiene availableHours definido, considerarlo NO disponible
      // (esto obliga a configurar horarios para cada ministro)
      if (!ministro.availableHours || !Array.isArray(ministro.availableHours) || ministro.availableHours.length === 0) {
        return false;
      }
      return ministro.availableHours.includes(time);
    }).length;

    return count;
  }

  // ============ GESTIÓN DE RESERVAS ============

  /**
   * Sincroniza las reservas con el backend (desde organizaciones con electionDate/electionTime)
   * Esto permite que todos los usuarios vean los mismos horarios ocupados
   */
  async syncBackendBookings() {
    try {
      const now = Date.now();
      // Usar caché si no ha expirado
      if (now - this.lastBackendSync < this.CACHE_TTL && this.backendBookingsCache.length > 0) {
        console.log('📆 [ScheduleService] Usando caché de reservas backend');
        return this.backendBookingsCache;
      }

      console.log('📆 [ScheduleService] Sincronizando reservas desde backend...');

      // Cargar ministros activos desde la API (con lista completa para availableHours)
      try {
        const ministros = await apiService.getActiveMinistros();
        this.activeMinistrosList = Array.isArray(ministros) ? ministros : [];
        this.activeMinistrosCount = this.activeMinistrosList.length;
        this.lastMinistrosSync = now;
        console.log('👥 [ScheduleService] Ministros activos desde API:', this.activeMinistrosCount);
        console.log('👥 [ScheduleService] Ministros con availableHours:',
          this.activeMinistrosList.filter(m => m.availableHours?.length > 0).length);
      } catch (e) {
        console.warn('⚠️ [ScheduleService] No se pudieron cargar ministros:', e.message);
        // En caso de error, mantener el valor anterior (no cambiar a 1)
      }

      // Obtener todas las organizaciones del backend
      const organizations = await apiService.getOrganizations();

      // Filtrar organizaciones que tienen fecha de asamblea agendada
      // y convertirlas al formato de booking
      const backendBookings = organizations
        .filter(org => org.electionDate && org.electionTime)
        .filter(org => !['REJECTED', 'CANCELLED'].includes(org.status))
        .map(org => ({
          id: `backend-${org.id}`,
          date: org.electionDate,
          time: org.electionTime,
          organizationId: org.id,
          organizationName: org.organizationName || org.name,
          organizationType: org.organizationType,
          status: org.status === 'COMPLETED' ? 'completed' : 'confirmed',
          source: 'backend'
        }));

      console.log('📆 [ScheduleService] Reservas del backend:', backendBookings.length);
      console.log('📆 [ScheduleService] Detalle:', backendBookings.map(b => `${b.date} ${b.time} - ${b.organizationName}`));

      this.backendBookingsCache = backendBookings;
      this.lastBackendSync = now;

      return backendBookings;
    } catch (error) {
      console.error('❌ [ScheduleService] Error sincronizando backend:', error);
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

    console.log('🔖 [ScheduleService] createBooking - Reservas actuales:', bookings.length);
    console.log('🔖 [ScheduleService] createBooking - Datos recibidos:', bookingData.date, bookingData.time);

    // Verificar si el slot está disponible
    const dateKey = this.getDateKey(bookingData.date);
    const existingBooking = bookings.find(
      b => b.date === dateKey &&
           b.time === bookingData.time &&
           b.status !== 'cancelled'
    );

    if (existingBooking) {
      console.log('⚠️ [ScheduleService] createBooking - Horario ya reservado:', existingBooking);
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

    console.log('✅ [ScheduleService] createBooking - Nueva reserva creada:', newBooking.id, dateKey, bookingData.time);

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
    console.log('🗑️ Todas las reservas han sido eliminadas');
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
      console.log(`🧹 Se eliminaron ${removedCount} reservas huérfanas (organizaciones eliminadas)`);
    }

    return removedCount;
  }
}

// Instancia singleton
export const scheduleService = new ScheduleService();
