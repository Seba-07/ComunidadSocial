/**
 * Schedule Manager - Panel de Gestión de Horarios para Ministro de Fe
 * Permite al administrador gestionar disponibilidad de días y horas
 */

import { scheduleService } from '../../services/ScheduleService.js';
import { showToast } from '../../app.js';

export class ScheduleManager {
  constructor(container) {
    this.container = container;
    this.currentDate = new Date();
    this.selectedDate = null;
  }

  /**
   * Parsea un dateKey (YYYY-MM-DD) a objeto Date sin problemas de zona horaria
   */
  parseDateKey(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  render() {
    this.container.innerHTML = `
      <div class="schedule-manager">
        <div class="schedule-manager-header">
          <h2>Gestión de Horarios - Ministro de Fe</h2>
          <p class="schedule-subtitle">Administra la disponibilidad de días y horas para solicitudes</p>
        </div>

        <div class="schedule-manager-body">
          <!-- Calendario de Gestión -->
          <div class="schedule-admin-calendar">
            <div class="calendar-controls">
              <button type="button" id="admin-prev-month" class="calendar-nav-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <h3 id="admin-current-month"></h3>
              <button type="button" id="admin-next-month" class="calendar-nav-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>

            <div class="calendar-weekdays">
              <div>Dom</div>
              <div>Lun</div>
              <div>Mar</div>
              <div>Mié</div>
              <div>Jue</div>
              <div>Vie</div>
              <div>Sáb</div>
            </div>

            <div id="admin-calendar-days" class="admin-calendar-days"></div>
          </div>

          <!-- Panel de Edición de Día -->
          <div class="schedule-day-editor" id="day-editor" style="display: none;">
            <div class="day-editor-header">
              <h3 id="editor-date-title">Fecha</h3>
              <button type="button" id="close-editor" class="btn-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div class="day-editor-body">
              <!-- Toggle Día Habilitado -->
              <div class="editor-section">
                <label class="toggle-label">
                  <input type="checkbox" id="day-enabled-toggle">
                  <span class="toggle-slider"></span>
                  <span class="toggle-text">Día Habilitado</span>
                </label>
              </div>

              <!-- Horarios del Día -->
              <div class="editor-section">
                <h4>Horarios Disponibles</h4>
                <div id="time-slots-list" class="time-slots-list"></div>

                <div class="add-time-slot-form">
                  <input type="time" id="new-time-slot" class="input-styled" value="09:00">
                  <button type="button" id="add-time-slot-btn" class="btn btn-sm btn-primary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Agregar Horario
                  </button>
                </div>
              </div>

              <!-- Reservas del Día -->
              <div class="editor-section">
                <h4>Reservas del Día</h4>
                <div id="day-bookings-list" class="day-bookings-list"></div>
              </div>

              <!-- Acciones Rápidas -->
              <div class="editor-actions">
                <button type="button" id="set-default-hours-btn" class="btn btn-secondary btn-block">
                  Aplicar Horario Laboral (9:00 - 17:00)
                </button>
                <div class="block-period-buttons">
                  <button type="button" id="block-morning-btn" class="btn btn-warning btn-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="5"></circle>
                      <line x1="12" y1="1" x2="12" y2="3"></line>
                      <line x1="12" y1="21" x2="12" y2="23"></line>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                      <line x1="1" y1="12" x2="3" y2="12"></line>
                      <line x1="21" y1="12" x2="23" y2="12"></line>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                    </svg>
                    Bloquear Mañana
                  </button>
                  <button type="button" id="block-afternoon-btn" class="btn btn-warning btn-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>
                    Bloquear Tarde
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Estadísticas y Reservas -->
        <div class="schedule-stats">
          <div class="stats-card">
            <h4>📊 Estadísticas</h4>
            <div id="schedule-stats-content"></div>
          </div>

          <div class="stats-card">
            <h4>📅 Próximas Reservas</h4>
            <div id="upcoming-bookings-list"></div>
          </div>
        </div>

        <!-- Acciones Globales -->
        <div class="schedule-global-actions">
          <button type="button" id="reset-schedule-btn" class="btn btn-danger-outline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Reiniciar Calendario (Borrar todas las reservas)
          </button>
        </div>
      </div>
    `;

    this.attachEventListeners();
    this.renderCalendar();
    this.renderStats();
    this.renderUpcomingBookings();
  }

  renderCalendar() {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    document.getElementById('admin-current-month').textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const calendarDays = document.getElementById('admin-calendar-days');
    calendarDays.innerHTML = '';

    // Días vacíos
    for (let i = 0; i < firstDay; i++) {
      const emptyDay = document.createElement('div');
      emptyDay.className = 'admin-calendar-day admin-day-empty';
      calendarDays.appendChild(emptyDay);
    }

    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = scheduleService.getDateKey(date);
      const daySchedule = scheduleService.getDaySchedule(date);
      const bookings = scheduleService.getBookingsByDate(date);

      const dayElement = document.createElement('button');
      dayElement.type = 'button';
      dayElement.className = 'admin-calendar-day';

      dayElement.innerHTML = `
        <span class="day-number">${day}</span>
        ${daySchedule && daySchedule.enabled ?
          `<span class="day-slots-count">${daySchedule.slots.length} slots</span>` :
          '<span class="day-disabled-label">Sin horarios</span>'}
        ${bookings.length > 0 ? `<span class="day-bookings-badge">${bookings.length}</span>` : ''}
      `;

      if (date < today) {
        dayElement.classList.add('admin-day-past');
      } else if (daySchedule && daySchedule.enabled && daySchedule.slots.length > 0) {
        dayElement.classList.add('admin-day-enabled');
      } else {
        dayElement.classList.add('admin-day-disabled');
      }

      dayElement.addEventListener('click', () => this.selectDay(dateKey));
      calendarDays.appendChild(dayElement);
    }
  }

  selectDay(dateKey) {
    this.selectedDate = dateKey;
    const date = this.parseDateKey(dateKey);
    const daySchedule = scheduleService.getDaySchedule(date) || { enabled: false, slots: [] };

    // Mostrar editor
    document.getElementById('day-editor').style.display = 'block';

    // Actualizar título
    document.getElementById('editor-date-title').textContent =
      date.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Toggle habilitado
    document.getElementById('day-enabled-toggle').checked = daySchedule.enabled;

    // Renderizar horarios
    this.renderTimeSlots(daySchedule.slots);

    // Renderizar reservas
    this.renderDayBookings(date);
  }

  renderTimeSlots(slots) {
    const container = document.getElementById('time-slots-list');

    if (!slots || slots.length === 0) {
      container.innerHTML = '<p class="empty-message">No hay horarios configurados</p>';
      return;
    }

    container.innerHTML = slots.map(slot => `
      <div class="time-slot-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>${slot.time}</span>
        <button type="button" class="btn-remove-slot" data-time="${slot.time}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `).join('');

    // Event listeners para eliminar slots
    container.querySelectorAll('.btn-remove-slot').forEach(btn => {
      btn.addEventListener('click', () => this.removeTimeSlot(btn.dataset.time));
    });
  }

  renderDayBookings(date) {
    const bookings = scheduleService.getBookingsByDate(date);
    const container = document.getElementById('day-bookings-list');

    if (bookings.length === 0) {
      container.innerHTML = '<p class="empty-message">No hay reservas para este día</p>';
      return;
    }

    container.innerHTML = bookings.map(booking => `
      <div class="booking-item booking-status-${booking.status}">
        <div class="booking-time">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          ${booking.time}
        </div>
        <div class="booking-info">
          <strong>${booking.organizationName}</strong>
          <span>${booking.userName} - ${booking.userEmail}</span>
        </div>
        <div class="booking-actions">
          ${booking.status === 'pending' ? `
            <button type="button" class="btn-sm btn-success" onclick="scheduleManager.confirmBooking('${booking.id}')">Confirmar</button>
            <button type="button" class="btn-sm btn-danger" onclick="scheduleManager.cancelBooking('${booking.id}')">Cancelar</button>
          ` : `
            <span class="booking-status-badge">${booking.status === 'confirmed' ? 'Confirmada' : booking.status === 'cancelled' ? 'Cancelada' : 'Completada'}</span>
          `}
        </div>
      </div>
    `).join('');
  }

  renderStats() {
    const stats = scheduleService.getBookingStats();
    const container = document.getElementById('schedule-stats-content');

    container.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">Total Reservas:</span>
        <span class="stat-value">${stats.total}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Pendientes:</span>
        <span class="stat-value stat-pending">${stats.pending}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Confirmadas:</span>
        <span class="stat-value stat-confirmed">${stats.confirmed}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Completadas:</span>
        <span class="stat-value stat-completed">${stats.completed}</span>
      </div>
    `;
  }

  renderUpcomingBookings() {
    const allBookings = scheduleService.getAllBookings();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = allBookings
      .filter(b => b.status !== 'cancelled' && new Date(b.date) >= today)
      .sort((a, b) => {
        if (a.date === b.date) return a.time.localeCompare(b.time);
        return a.date.localeCompare(b.date);
      })
      .slice(0, 10);

    const container = document.getElementById('upcoming-bookings-list');

    if (upcoming.length === 0) {
      container.innerHTML = '<p class="empty-message">No hay reservas próximas</p>';
      return;
    }

    container.innerHTML = upcoming.map(booking => {
      const date = new Date(booking.date);
      return `
        <div class="upcoming-booking-item">
          <div class="booking-date-badge">
            <span class="booking-day">${date.getDate()}</span>
            <span class="booking-month">${date.toLocaleDateString('es-CL', { month: 'short' })}</span>
          </div>
          <div class="booking-details">
            <strong>${booking.organizationName}</strong>
            <span>${booking.time} - ${booking.userName}</span>
          </div>
          <span class="booking-status-badge booking-status-${booking.status}">
            ${booking.status === 'pending' ? 'Pendiente' : booking.status === 'confirmed' ? 'Confirmada' : 'Completada'}
          </span>
        </div>
      `;
    }).join('');
  }

  attachEventListeners() {
    // Navegación de meses
    document.getElementById('admin-prev-month').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.renderCalendar();
    });

    document.getElementById('admin-next-month').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.renderCalendar();
    });

    // Cerrar editor
    document.getElementById('close-editor').addEventListener('click', () => {
      document.getElementById('day-editor').style.display = 'none';
      this.selectedDate = null;
    });

    // Toggle día habilitado
    document.getElementById('day-enabled-toggle').addEventListener('change', (e) => {
      if (this.selectedDate) {
        scheduleService.toggleDayEnabled(this.selectedDate, e.target.checked);
        showToast(e.target.checked ? 'Día habilitado' : 'Día deshabilitado', 'success');
        this.renderCalendar();
      }
    });

    // Agregar horario
    document.getElementById('add-time-slot-btn').addEventListener('click', () => {
      const timeInput = document.getElementById('new-time-slot');
      const time = timeInput.value;

      if (!time || !this.selectedDate) return;

      scheduleService.addTimeSlot(this.selectedDate, time);
      showToast('Horario agregado correctamente', 'success');

      const date = this.parseDateKey(this.selectedDate);
      const daySchedule = scheduleService.getDaySchedule(date);
      this.renderTimeSlots(daySchedule.slots);
      this.renderCalendar();
    });

    // Aplicar horario laboral
    document.getElementById('set-default-hours-btn').addEventListener('click', () => {
      if (!this.selectedDate) return;

      const slots = scheduleService.generateTimeSlots('09:00', '17:00', 60);
      scheduleService.setDaySchedule(this.selectedDate, {
        enabled: true,
        slots: slots
      });

      showToast('Horario laboral aplicado (9:00 - 17:00)', 'success');
      const date = this.parseDateKey(this.selectedDate);
      const daySchedule = scheduleService.getDaySchedule(date);
      this.renderTimeSlots(daySchedule.slots);
      this.renderCalendar();
    });

    // Bloquear mañana
    document.getElementById('block-morning-btn').addEventListener('click', () => {
      if (!this.selectedDate) return;

      scheduleService.blockMorning(this.selectedDate);
      showToast('Mañana bloqueada (horarios antes de 13:00 eliminados)', 'success');

      const date = this.parseDateKey(this.selectedDate);
      const daySchedule = scheduleService.getDaySchedule(date);
      this.renderTimeSlots(daySchedule?.slots || []);
      this.renderCalendar();
    });

    // Bloquear tarde
    document.getElementById('block-afternoon-btn').addEventListener('click', () => {
      if (!this.selectedDate) return;

      scheduleService.blockAfternoon(this.selectedDate);
      showToast('Tarde bloqueada (horarios desde 13:00 eliminados)', 'success');

      const date = this.parseDateKey(this.selectedDate);
      const daySchedule = scheduleService.getDaySchedule(date);
      this.renderTimeSlots(daySchedule?.slots || []);
      this.renderCalendar();
    });

    // Reiniciar calendario completo
    document.getElementById('reset-schedule-btn').addEventListener('click', () => {
      const confirmed = confirm('⚠️ ¿Estás seguro de que deseas reiniciar el calendario?\n\nEsto eliminará TODAS las reservas y configuraciones de horarios.\nEsta acción no se puede deshacer.');

      if (!confirmed) return;

      scheduleService.clearAllData();
      scheduleService.init(); // Regenerar horarios por defecto

      showToast('Calendario reiniciado correctamente', 'success');

      // Cerrar editor si está abierto
      document.getElementById('day-editor').style.display = 'none';
      this.selectedDate = null;

      // Actualizar vistas
      this.renderCalendar();
      this.renderStats();
      this.renderUpcomingBookings();
    });
  }

  removeTimeSlot(time) {
    if (!this.selectedDate) return;

    scheduleService.removeTimeSlot(this.selectedDate, time);
    showToast('Horario eliminado', 'success');

    const date = this.parseDateKey(this.selectedDate);
    const daySchedule = scheduleService.getDaySchedule(date);
    this.renderTimeSlots(daySchedule.slots);
    this.renderCalendar();
  }

  confirmBooking(bookingId) {
    scheduleService.confirmBooking(bookingId);
    showToast('Reserva confirmada', 'success');

    if (this.selectedDate) {
      const date = this.parseDateKey(this.selectedDate);
      this.renderDayBookings(date);
    }

    this.renderStats();
    this.renderUpcomingBookings();
  }

  cancelBooking(bookingId) {
    const confirmed = confirm('¿Estás seguro de que deseas cancelar esta reserva?');
    if (!confirmed) return;

    scheduleService.cancelBooking(bookingId);
    showToast('Reserva cancelada', 'info');

    if (this.selectedDate) {
      const date = this.parseDateKey(this.selectedDate);
      this.renderDayBookings(date);
    }

    this.renderCalendar();
    this.renderStats();
    this.renderUpcomingBookings();
  }
}

// Instancia global para acceder desde los event listeners inline
export let scheduleManager;

export function initScheduleManager(container) {
  scheduleManager = new ScheduleManager(container);
  scheduleManager.render();
  return scheduleManager;
}
