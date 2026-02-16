/**
 * Schedule Manager - Panel de Gestión de Horarios para Ministro de Fe
 * Permite al administrador gestionar disponibilidad de días y horas
 */

import { scheduleService } from '../../services/ScheduleService.js';
import { apiService } from '../../services/ApiService.js';
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
      <div class="schedule-manager-v2">
        <!-- Header -->
        <div class="sm-header">
          <div class="sm-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div class="sm-header-text">
            <h2>Gestión de Horarios</h2>
            <p>Administra la disponibilidad para citas con Ministro de Fe</p>
          </div>
        </div>

        <!-- Layout Principal -->
        <div class="sm-layout">
          <!-- Columna Izquierda: Calendario -->
          <div class="sm-calendar-section">
            <div class="sm-card">
              <div class="sm-card-header">
                <button type="button" id="admin-prev-month" class="sm-nav-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                <h3 id="admin-current-month"></h3>
                <button type="button" id="admin-next-month" class="sm-nav-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
              <div class="sm-calendar-weekdays">
                <div>D</div>
                <div>L</div>
                <div>M</div>
                <div>M</div>
                <div>J</div>
                <div>V</div>
                <div>S</div>
              </div>
              <div id="admin-calendar-days" class="sm-calendar-days"></div>
              <div class="sm-calendar-legend">
                <span class="legend-item"><span class="legend-dot enabled"></span> Disponible</span>
                <span class="legend-item"><span class="legend-dot disabled"></span> Sin horarios</span>
                <span class="legend-item"><span class="legend-dot past"></span> Pasado</span>
              </div>
            </div>
          </div>

          <!-- Columna Derecha: Editor y Stats -->
          <div class="sm-sidebar">
            <!-- Panel de Edición de Día -->
            <div class="sm-card sm-editor" id="day-editor" style="display: none;">
              <div class="sm-card-header sm-editor-header">
                <h4 id="editor-date-title">Selecciona un día</h4>
                <button type="button" id="close-editor" class="sm-close-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div class="sm-editor-body">
                <label class="sm-toggle">
                  <input type="checkbox" id="day-enabled-toggle">
                  <span class="sm-toggle-slider"></span>
                  <span class="sm-toggle-text">Día Habilitado</span>
                </label>

                <div class="sm-section">
                  <h5>Horarios Disponibles</h5>
                  <div id="time-slots-list" class="sm-slots-list"></div>
                  <div class="sm-add-slot">
                    <input type="time" id="new-time-slot" value="09:00">
                    <button type="button" id="add-time-slot-btn" class="sm-btn sm-btn-primary">+ Agregar</button>
                  </div>
                </div>

                <div class="sm-section">
                  <h5>Reservas del Día</h5>
                  <div id="day-bookings-list" class="sm-bookings-list"></div>
                </div>

                <div class="sm-quick-actions">
                  <button type="button" id="set-default-hours-btn" class="sm-btn sm-btn-secondary sm-btn-block">
                    Horario Laboral (9:00 - 17:00)
                  </button>
                  <div class="sm-btn-row">
                    <button type="button" id="block-morning-btn" class="sm-btn sm-btn-warning">Bloquear Mañana</button>
                    <button type="button" id="block-afternoon-btn" class="sm-btn sm-btn-warning">Bloquear Tarde</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Placeholder cuando no hay día seleccionado -->
            <div class="sm-card sm-placeholder" id="editor-placeholder">
              <div class="sm-placeholder-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                  <circle cx="12" cy="15" r="2"></circle>
                </svg>
              </div>
              <p>Selecciona un día del calendario para editar sus horarios</p>
            </div>

            <!-- Estadísticas -->
            <div class="sm-card sm-stats">
              <h4>Resumen</h4>
              <div id="schedule-stats-content" class="sm-stats-grid"></div>
            </div>

            <!-- Próximas Reservas -->
            <div class="sm-card sm-upcoming">
              <h4>Próximas Reservas</h4>
              <div id="upcoming-bookings-list" class="sm-upcoming-list"></div>
            </div>
          </div>
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

    // Mostrar editor y ocultar placeholder
    document.getElementById('day-editor').style.display = 'block';
    const placeholder = document.getElementById('editor-placeholder');
    if (placeholder) placeholder.style.display = 'none';

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

    // Obtener reservas para esta fecha para marcar slots ocupados
    const bookings = this.selectedDate ? scheduleService.getAllBookings().filter(
      b => b.date === this.selectedDate && b.status !== 'cancelled'
    ) : [];

    // Contar reservas por hora
    const bookingsCountByTime = {};
    bookings.forEach(b => {
      bookingsCountByTime[b.time] = (bookingsCountByTime[b.time] || 0) + 1;
    });

    // Obtener total de ministros activos (disponibles todo el día)
    const totalMinistros = scheduleService.getActiveMinistrosCount();

    container.innerHTML = slots.map(slot => {
      const bookingsAtTime = bookingsCountByTime[slot.time] || 0;
      const isOccupied = bookingsAtTime >= totalMinistros || totalMinistros === 0;
      const statusClass = isOccupied ? 'slot-occupied' : 'slot-available';
      const statusText = isOccupied
        ? `Ocupado (${bookingsAtTime}/${totalMinistros} MF)`
        : `Disponible (${bookingsAtTime}/${totalMinistros} MF)`;

      return `
        <div class="time-slot-item ${statusClass}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>${slot.time}</span>
          <span class="slot-status">${statusText}</span>
          <button type="button" class="btn-remove-slot" data-time="${slot.time}" title="Eliminar horario">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;
    }).join('');

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
      const placeholder = document.getElementById('editor-placeholder');
      if (placeholder) placeholder.style.display = 'block';
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

  async confirmBooking(bookingId) {
    const booking = scheduleService.getBookingById(bookingId);

    // Mostrar modal de duración de bloqueo
    const blockConfig = await this.showBlockDurationModal(booking);

    // Si el usuario canceló el modal, no confirmar
    if (!blockConfig) return;

    scheduleService.confirmBooking(bookingId);

    // Crear bloque en backend si se configuró duración
    if (blockConfig.durationHours || blockConfig.fullDay) {
      try {
        await apiService.createBlockFromConfirmation({
          ministroId: blockConfig.ministroId,
          ministroName: blockConfig.ministroName,
          date: booking.date,
          startTime: booking.time,
          durationHours: blockConfig.durationHours,
          fullDay: blockConfig.fullDay,
          reason: `Reserva: ${booking.organizationName || 'Organización'}`
        });
        scheduleService.invalidateBlocksCache();
        showToast('Reserva confirmada y bloqueo creado', 'success');
      } catch (error) {
        console.error('Error creando bloqueo:', error);
        showToast('Reserva confirmada (error al crear bloqueo)', 'warning');
      }
    } else {
      showToast('Reserva confirmada', 'success');
    }

    if (this.selectedDate) {
      const date = this.parseDateKey(this.selectedDate);
      this.renderDayBookings(date);
    }

    this.renderStats();
    this.renderUpcomingBookings();
  }

  /**
   * Muestra modal para seleccionar duración de bloqueo y ministro
   */
  showBlockDurationModal(booking) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'admin-review-modal-overlay';

      // Cargar ministros activos
      const ministros = scheduleService.activeMinistrosList || [];

      const ministroOptions = ministros.map(m => {
        const mId = m._id || m.id;
        return `<option value="${mId}">${m.firstName} ${m.lastName}</option>`;
      }).join('');

      const bookingDate = booking ? booking.date : '';
      const bookingTime = booking ? booking.time : '';
      const bookingOrg = booking ? (booking.organizationName || 'Organización') : '';

      // Calcular preview de horas para la duración por defecto (4h)
      const previewEnd = this._calculateEndTime(bookingTime, 4);

      modal.innerHTML = `
        <div class="admin-review-modal" style="max-width: 480px;">
          <div class="review-modal-header" style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);">
            <div class="review-header-left">
              <h2 style="margin:0;color:white;font-size:18px;">Bloqueo de Disponibilidad</h2>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${bookingOrg} - ${bookingDate} ${bookingTime}</p>
            </div>
            <button class="review-close-btn block-modal-close" style="color:white;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="review-modal-body" style="padding:24px;">
            <div style="margin-bottom:20px;">
              <label style="display:block;font-weight:600;margin-bottom:8px;font-size:14px;color:#374151;">Seleccionar Ministro</label>
              <select id="block-ministro-select" style="width:100%;padding:10px 12px;border:2px solid #e5e7eb;border-radius:10px;font-size:14px;">
                ${ministroOptions || '<option value="">No hay ministros activos</option>'}
              </select>
            </div>
            <div style="margin-bottom:20px;">
              <label style="display:block;font-weight:600;margin-bottom:8px;font-size:14px;color:#374151;">Duración del bloqueo</label>
              <div id="block-duration-options" style="display:flex;flex-direction:column;gap:8px;">
                <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:all 0.2s;">
                  <input type="radio" name="blockDuration" value="2" style="accent-color:#7c3aed;"> <span>2 horas</span>
                </label>
                <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:all 0.2s;">
                  <input type="radio" name="blockDuration" value="3" style="accent-color:#7c3aed;"> <span>3 horas</span>
                </label>
                <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:2px solid #7c3aed;border-radius:10px;cursor:pointer;background:#f5f3ff;transition:all 0.2s;">
                  <input type="radio" name="blockDuration" value="4" checked style="accent-color:#7c3aed;"> <span>4 horas <span style="color:#7c3aed;font-size:12px;">(recomendado)</span></span>
                </label>
                <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:all 0.2s;">
                  <input type="radio" name="blockDuration" value="6" style="accent-color:#7c3aed;"> <span>6 horas</span>
                </label>
                <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:all 0.2s;">
                  <input type="radio" name="blockDuration" value="fullday" style="accent-color:#7c3aed;"> <span>Día completo</span>
                </label>
              </div>
            </div>
            <div id="block-preview" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:14px;color:#5b21b6;">
              Preview: ${bookingTime} - ${previewEnd} (4 horas)
            </div>
            <div style="display:flex;gap:12px;justify-content:flex-end;">
              <button id="block-modal-cancel" style="padding:10px 20px;border:2px solid #e5e7eb;border-radius:10px;background:white;cursor:pointer;font-size:14px;font-weight:500;">Cancelar</button>
              <button id="block-modal-confirm" style="padding:10px 20px;border:none;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white;cursor:pointer;font-size:14px;font-weight:600;">Confirmar y Bloquear</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Actualizar preview cuando cambia la duración
      const updatePreview = () => {
        const selected = modal.querySelector('input[name="blockDuration"]:checked');
        const preview = modal.querySelector('#block-preview');
        if (!selected || !preview) return;

        if (selected.value === 'fullday') {
          preview.textContent = 'Preview: Día completo bloqueado';
        } else {
          const hours = parseInt(selected.value);
          const end = this._calculateEndTime(bookingTime, hours);
          preview.textContent = `Preview: ${bookingTime} - ${end} (${hours} horas)`;
        }

        // Actualizar estilos de las opciones
        modal.querySelectorAll('#block-duration-options label').forEach(label => {
          const radio = label.querySelector('input[type="radio"]');
          if (radio.checked) {
            label.style.borderColor = '#7c3aed';
            label.style.background = '#f5f3ff';
          } else {
            label.style.borderColor = '#e5e7eb';
            label.style.background = 'white';
          }
        });
      };

      modal.querySelectorAll('input[name="blockDuration"]').forEach(radio => {
        radio.addEventListener('change', updatePreview);
      });

      // Cerrar
      const close = () => { modal.remove(); resolve(null); };
      modal.querySelector('.block-modal-close').addEventListener('click', close);
      modal.querySelector('#block-modal-cancel').addEventListener('click', close);
      modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

      // Confirmar
      modal.querySelector('#block-modal-confirm').addEventListener('click', () => {
        const ministroSelect = modal.querySelector('#block-ministro-select');
        const selected = modal.querySelector('input[name="blockDuration"]:checked');

        if (!ministroSelect.value) {
          showToast('Selecciona un ministro', 'error');
          return;
        }

        const ministroOption = ministroSelect.options[ministroSelect.selectedIndex];
        const result = {
          ministroId: ministroSelect.value,
          ministroName: ministroOption.text,
          fullDay: selected.value === 'fullday',
          durationHours: selected.value === 'fullday' ? null : parseInt(selected.value)
        };

        modal.remove();
        resolve(result);
      });
    });
  }

  _calculateEndTime(startTime, durationHours) {
    if (!startTime || !durationHours) return '';
    const [h, m] = startTime.split(':').map(Number);
    const endH = Math.min(h + durationHours - 1, 23);
    return `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

export async function initScheduleManager(container) {
  // Cargar ministros activos y reservas desde la API antes de renderizar
  console.log('📆 [ScheduleManager] Inicializando y cargando datos...');
  await scheduleService.loadActiveMinistros();
  await scheduleService.syncBackendBookings();

  scheduleManager = new ScheduleManager(container);
  window.scheduleManager = scheduleManager; // Exponer globalmente para onclick inline
  scheduleManager.render();
  return scheduleManager;
}
