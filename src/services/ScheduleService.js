/**
 * Servicio de Gestión de Horarios para Ministro de Fe
 * Maneja disponibilidad de días y horas, y reservas de citas
 */

class ScheduleService {
  constructor() {
    this.storageKey = 'ministro_schedule';
    this.bookingsKey = 'ministro_bookings';
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

      // Contar slots disponibles vs reservados
      const totalSlots = daySchedule.slots.length;
      const bookedSlots = bookings.filter(b => b.date === dateKey && b.status !== 'cancelled').length;
      const availableSlots = totalSlots - bookedSlots;

      if (availableSlots === 0) {
        availability.unavailable.push(dateKey);
      } else if (availableSlots < totalSlots) {
        availability.partial.push(dateKey);
      } else {
        availability.available.push(dateKey);
      }
    }

    return availability;
  }

  /**
   * Obtiene slots disponibles de un día específico (excluyendo reservados)
   */
  getAvailableSlots(date) {
    const daySchedule = this.getDaySchedule(date);
    if (!daySchedule || !daySchedule.enabled) {
      return [];
    }

    const dateKey = this.getDateKey(date);
    const bookings = this.getAllBookings();
    const bookedTimes = bookings
      .filter(b => b.date === dateKey && b.status !== 'cancelled')
      .map(b => b.time);

    return daySchedule.slots
      .filter(slot => slot.available && !bookedTimes.includes(slot.time))
      .map(slot => slot.time);
  }

  // ============ GESTIÓN DE RESERVAS ============

  /**
   * Obtiene todas las reservas
   */
  getAllBookings() {
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
}

// Instancia singleton
export const scheduleService = new ScheduleService();
