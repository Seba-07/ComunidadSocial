/**
 * Calendar Manager - Vista de Calendario Integrado
 * Muestra asignaciones de ministros, plazos legales y asambleas en un calendario mensual
 */

import { ministroAssignmentService } from '../../services/MinistroAssignmentService.js';
import { organizationsService } from '../../services/OrganizationsService.js';
import { alertsService } from '../../services/AlertsService.js';
import { showToast } from '../../app.js';

// Event type configuration
const EVENT_TYPES = {
  ASSIGNMENT: { color: '#3b82f6', label: 'Asignacion Ministro', dotClass: 'assignment' },
  DEADLINE: { color: '#ef4444', label: 'Plazo Legal', dotClass: 'deadline' },
  DEADLINE_WARNING: { color: '#f97316', label: 'Plazo Legal (Proximo)', dotClass: 'deadline-warning' },
  ASSEMBLY: { color: '#22c55e', label: 'Asamblea/Eleccion', dotClass: 'assembly' }
};

const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

let calendarManagerInstance = null;

export class CalendarManager {
  constructor(container) {
    this.container = container;
    this.currentYear = new Date().getFullYear();
    this.currentMonth = new Date().getMonth();
    this.events = {};       // key: 'YYYY-MM-DD', value: array of events
    this.selectedDate = null;
    this.assignments = [];
    this.organizations = [];
  }

  render() {
    this.container.innerHTML = `
      <div style="padding: 24px; max-width: 1200px; margin: 0 auto;">
        <!-- Header -->
        <div style="margin-bottom: 24px;">
          <h2 style="margin: 0; font-size: 24px; font-weight: 700; color: #1e293b;">Calendario Integrado</h2>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">Visualiza asignaciones, plazos legales y asambleas</p>
        </div>

        <!-- Main Layout: Calendar + Detail Sidebar -->
        <div style="display: grid; grid-template-columns: 1fr 320px; gap: 24px; align-items: start;">

          <!-- Calendar Card -->
          <div style="
            background: white; border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
            overflow: hidden;
          ">
            <!-- Calendar Navigation -->
            <div style="
              display: flex; justify-content: space-between; align-items: center;
              padding: 16px 20px; border-bottom: 1px solid #e2e8f0;
            ">
              <button type="button" id="cm-prev-month" style="
                padding: 8px 12px; background: #f1f5f9; border: none;
                border-radius: 8px; cursor: pointer; color: #475569;
                font-size: 14px; font-weight: 500; transition: background 0.2s;
                display: inline-flex; align-items: center; gap: 4px;
              ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                Anterior
              </button>
              <div style="display: flex; align-items: center; gap: 12px;">
                <h3 id="cm-month-year" style="margin: 0; font-size: 18px; font-weight: 600; color: #1e293b;"></h3>
                <button type="button" id="cm-today-btn" style="
                  padding: 6px 12px; background: #3b82f6; color: white;
                  border: none; border-radius: 6px; font-size: 12px; font-weight: 600;
                  cursor: pointer; transition: background 0.2s;
                ">Hoy</button>
              </div>
              <button type="button" id="cm-next-month" style="
                padding: 8px 12px; background: #f1f5f9; border: none;
                border-radius: 8px; cursor: pointer; color: #475569;
                font-size: 14px; font-weight: 500; transition: background 0.2s;
                display: inline-flex; align-items: center; gap: 4px;
              ">
                Siguiente
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>

            <!-- Calendar Grid -->
            <div id="cm-calendar-grid" style="padding: 12px 20px 20px;"></div>

            <!-- Legend -->
            <div style="
              display: flex; gap: 20px; padding: 12px 20px; border-top: 1px solid #f1f5f9;
              background: #f8fafc; flex-wrap: wrap;
            ">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${EVENT_TYPES.ASSIGNMENT.color};"></span>
                ${EVENT_TYPES.ASSIGNMENT.label}
              </div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${EVENT_TYPES.DEADLINE.color};"></span>
                ${EVENT_TYPES.DEADLINE.label}
              </div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${EVENT_TYPES.DEADLINE_WARNING.color};"></span>
                ${EVENT_TYPES.DEADLINE_WARNING.label}
              </div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${EVENT_TYPES.ASSEMBLY.color};"></span>
                ${EVENT_TYPES.ASSEMBLY.label}
              </div>
            </div>
          </div>

          <!-- Day Detail Sidebar -->
          <div id="cm-day-detail" style="
            background: white; border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
            min-height: 400px; position: sticky; top: 24px;
          ">
            <div style="padding: 20px; text-align: center; color: #94a3b8;">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin: 40px auto 12px;">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <p style="font-size: 14px; margin: 0;">Selecciona un dia para ver los eventos</p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
    this.loadEvents();
  }

  async loadEvents() {
    this.events = {};

    try {
      // Load data sources in parallel
      const [assignments, organizations] = await Promise.all([
        ministroAssignmentService.getAllAsync().catch(() => []),
        organizationsService.getAllAsync().catch(() => [])
      ]);

      this.assignments = Array.isArray(assignments) ? assignments : [];
      this.organizations = Array.isArray(organizations) ? organizations : [];

      // 1. Map Ministro Assignments
      this.assignments.forEach(a => {
        if (!a.scheduledDate) return;
        const dateKey = this._toDateKey(a.scheduledDate);
        if (!dateKey) return;

        const orgName = a.organizationName || a.organizationId || 'Organizacion';
        const time = a.scheduledTime || '';

        this._addEvent(dateKey, {
          type: 'ASSIGNMENT',
          title: orgName,
          subtitle: time ? `Hora: ${time}` : 'Sin hora definida',
          detail: `Ministro: ${a.ministroName || a.ministroId || '-'}`,
          status: a.status || 'pending',
          color: EVENT_TYPES.ASSIGNMENT.color,
          raw: a
        });
      });

      // 2. Map Legal Deadlines from approved organizations
      this.organizations.forEach(org => {
        if (org.status !== 'approved') return;
        const orgName = org.organizationName || org.name || 'Organizacion';
        const orgId = org._id || org.id;

        // Get alerts for this org
        const alerts = alertsService.getOrganizationAlerts(orgId);
        alerts.forEach(alert => {
          if (!alert.dueDate) return;
          const dateKey = this._toDateKey(alert.dueDate);
          if (!dateKey) return;

          const isCritical = alert.priority === 'critical' || alert.priority === 'high';
          this._addEvent(dateKey, {
            type: isCritical ? 'DEADLINE' : 'DEADLINE_WARNING',
            title: alert.title || 'Plazo Legal',
            subtitle: orgName,
            detail: alert.description || '',
            daysRemaining: alert.daysRemaining,
            priority: alert.priority,
            color: isCritical ? EVENT_TYPES.DEADLINE.color : EVENT_TYPES.DEADLINE_WARNING.color,
            raw: alert
          });
        });
      });

      // 3. Map Organization Elections / Assemblies
      this.organizations.forEach(org => {
        if (!org.electionDate) return;
        const dateKey = this._toDateKey(org.electionDate);
        if (!dateKey) return;

        const orgName = org.organizationName || org.name || 'Organizacion';
        const time = org.electionTime || '';

        this._addEvent(dateKey, {
          type: 'ASSEMBLY',
          title: orgName,
          subtitle: time ? `Hora: ${time}` : 'Asamblea Constitutiva',
          detail: org.assemblyAddress || org.address || '',
          color: EVENT_TYPES.ASSEMBLY.color,
          raw: org
        });
      });

    } catch (error) {
      console.error('Error cargando eventos del calendario:', error);
      showToast('Error al cargar eventos del calendario', 'error');
    }

    this.renderCalendar();
  }

  _toDateKey(dateInput) {
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return null;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return null;
    }
  }

  _addEvent(dateKey, event) {
    if (!this.events[dateKey]) {
      this.events[dateKey] = [];
    }
    this.events[dateKey].push(event);
  }

  renderCalendar() {
    this.renderMonth(this.currentYear, this.currentMonth);
  }

  renderMonth(year, month) {
    const grid = this.container.querySelector('#cm-calendar-grid');
    const monthYearLabel = this.container.querySelector('#cm-month-year');
    if (!grid || !monthYearLabel) return;

    monthYearLabel.textContent = `${MONTH_NAMES[month]} ${year}`;

    const today = new Date();
    const todayKey = this._toDateKey(today);

    // First day of month (0=Sunday... adjust for Monday start)
    const firstDay = new Date(year, month, 1);
    let startDow = firstDay.getDay(); // 0=Sun, 1=Mon...
    startDow = startDow === 0 ? 6 : startDow - 1; // Convert to Mon=0, Sun=6

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Build grid HTML
    let html = '';

    // Day headers
    html += '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0; margin-bottom: 4px;">';
    DAY_NAMES.forEach(day => {
      html += `<div style="
        padding: 8px 4px; text-align: center;
        font-size: 12px; font-weight: 600; color: #94a3b8;
        text-transform: uppercase; letter-spacing: 0.5px;
      ">${day}</div>`;
    });
    html += '</div>';

    // Day cells
    html += '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;">';

    // Previous month trailing days
    for (let i = startDow - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      html += `<div style="
        min-height: 80px; padding: 4px 6px; border-radius: 8px;
        background: #f8fafc; opacity: 0.5;
      ">
        <span style="font-size: 12px; color: #cbd5e1; font-weight: 500;">${dayNum}</span>
      </div>`;
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = this.events[dateKey] || [];
      const isToday = dateKey === todayKey;
      const isSelected = dateKey === this.selectedDate;

      html += this.renderDayCell(d, dateKey, dayEvents, isToday, isSelected);
    }

    // Next month leading days to complete grid
    const totalCells = startDow + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remainingCells; i++) {
      html += `<div style="
        min-height: 80px; padding: 4px 6px; border-radius: 8px;
        background: #f8fafc; opacity: 0.5;
      ">
        <span style="font-size: 12px; color: #cbd5e1; font-weight: 500;">${i}</span>
      </div>`;
    }

    html += '</div>';
    grid.innerHTML = html;

    // Attach click listeners to day cells
    grid.querySelectorAll('[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        const date = cell.dataset.date;
        this.showDayDetail(date, this.events[date] || []);

        // Update selection styles
        grid.querySelectorAll('[data-date]').forEach(c => {
          c.style.outline = 'none';
        });
        cell.style.outline = '2px solid #3b82f6';
        cell.style.outlineOffset = '-2px';
        this.selectedDate = date;
      });
    });
  }

  renderDayCell(dayNum, dateKey, events, isToday, isSelected) {
    const hasEvents = events.length > 0;

    // Count events by type
    const assignmentCount = events.filter(e => e.type === 'ASSIGNMENT').length;
    const deadlineCount = events.filter(e => e.type === 'DEADLINE' || e.type === 'DEADLINE_WARNING').length;
    const assemblyCount = events.filter(e => e.type === 'ASSEMBLY').length;

    // Truncate visible events to max 3
    const visibleEvents = events.slice(0, 3);
    const moreCount = events.length - 3;

    let bgColor = 'white';
    let borderStyle = 'none';
    if (isToday) {
      bgColor = '#eff6ff';
      borderStyle = '2px solid #3b82f6';
    } else if (isSelected) {
      borderStyle = '2px solid #3b82f6';
    }

    let dotsHtml = '';
    if (hasEvents) {
      dotsHtml = '<div style="display: flex; gap: 3px; margin-top: 2px;">';
      if (assignmentCount > 0) dotsHtml += `<span style="width: 6px; height: 6px; border-radius: 50%; background: ${EVENT_TYPES.ASSIGNMENT.color};"></span>`;
      if (deadlineCount > 0) dotsHtml += `<span style="width: 6px; height: 6px; border-radius: 50%; background: ${EVENT_TYPES.DEADLINE.color};"></span>`;
      if (assemblyCount > 0) dotsHtml += `<span style="width: 6px; height: 6px; border-radius: 50%; background: ${EVENT_TYPES.ASSEMBLY.color};"></span>`;
      dotsHtml += '</div>';
    }

    let eventsHtml = '';
    if (visibleEvents.length > 0) {
      eventsHtml = visibleEvents.map(ev => `
        <div style="
          font-size: 10px; padding: 2px 4px; border-radius: 3px;
          background: ${ev.color}15; color: ${ev.color};
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          font-weight: 500; line-height: 1.3;
        ">${ev.title}</div>
      `).join('');
      if (moreCount > 0) {
        eventsHtml += `<div style="font-size: 10px; color: #94a3b8; font-weight: 500;">+${moreCount} mas</div>`;
      }
    }

    return `
      <div data-date="${dateKey}" style="
        min-height: 80px; padding: 4px 6px; border-radius: 8px;
        background: ${bgColor}; cursor: pointer;
        border: ${borderStyle};
        transition: background 0.15s;
        display: flex; flex-direction: column;
      " onmouseover="if(!this.style.border.includes('#3b82f6'))this.style.background='#f8fafc'" onmouseout="if(!this.style.border.includes('#3b82f6'))this.style.background='${bgColor}'">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <span style="
            font-size: 13px; font-weight: ${isToday ? '700' : '500'};
            color: ${isToday ? '#3b82f6' : '#374151'};
            ${isToday ? 'background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;' : ''}
          ">${dayNum}</span>
          ${dotsHtml}
        </div>
        <div style="margin-top: 4px; display: flex; flex-direction: column; gap: 2px; flex: 1; overflow: hidden;">
          ${eventsHtml}
        </div>
      </div>
    `;
  }

  showDayDetail(date, events) {
    const detail = this.container.querySelector('#cm-day-detail');
    if (!detail) return;

    const d = new Date(date + 'T12:00:00');
    const dayName = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'][d.getDay()];
    const formattedDate = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

    if (events.length === 0) {
      detail.innerHTML = `
        <div style="padding: 20px; border-bottom: 1px solid #e2e8f0;">
          <h3 style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #1e293b;">${dayName}</h3>
          <p style="margin: 0; font-size: 13px; color: #64748b;">${formattedDate}</p>
        </div>
        <div style="padding: 40px 20px; text-align: center;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin: 0 auto 12px; display: block;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p style="color: #94a3b8; font-size: 14px; margin: 0;">No hay eventos programados para este dia</p>
        </div>
      `;
      return;
    }

    // Group events by type
    const grouped = {};
    events.forEach(ev => {
      const type = ev.type;
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(ev);
    });

    let eventsHtml = '';

    // Render each group
    const typeOrder = ['ASSIGNMENT', 'DEADLINE', 'DEADLINE_WARNING', 'ASSEMBLY'];
    typeOrder.forEach(type => {
      if (!grouped[type]) return;
      const config = EVENT_TYPES[type];

      eventsHtml += `
        <div style="margin-bottom: 16px;">
          <div style="
            display: flex; align-items: center; gap: 8px;
            margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #f1f5f9;
          ">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${config.color};"></span>
            <span style="font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">${config.label}</span>
            <span style="
              font-size: 11px; background: ${config.color}15; color: ${config.color};
              padding: 1px 6px; border-radius: 10px; font-weight: 600;
            ">${grouped[type].length}</span>
          </div>
          ${grouped[type].map(ev => `
            <div style="
              padding: 10px 12px; background: #f8fafc; border-radius: 8px;
              margin-bottom: 6px; border-left: 3px solid ${ev.color};
            ">
              <div style="font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 2px;">${ev.title}</div>
              ${ev.subtitle ? `<div style="font-size: 12px; color: #64748b;">${ev.subtitle}</div>` : ''}
              ${ev.detail ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${ev.detail}</div>` : ''}
              ${ev.status ? `<div style="margin-top: 6px;">
                <span style="
                  font-size: 10px; padding: 2px 8px; border-radius: 10px;
                  background: ${this._getStatusColor(ev.status)}15;
                  color: ${this._getStatusColor(ev.status)};
                  font-weight: 600; text-transform: uppercase;
                ">${this._getStatusLabel(ev.status)}</span>
              </div>` : ''}
              ${ev.daysRemaining !== undefined ? `<div style="margin-top: 4px; font-size: 11px; color: ${ev.daysRemaining < 0 ? '#ef4444' : ev.daysRemaining <= 7 ? '#f97316' : '#64748b'}; font-weight: 500;">
                ${ev.daysRemaining < 0 ? `Vencido hace ${Math.abs(ev.daysRemaining)} dias` : ev.daysRemaining === 0 ? 'Vence hoy' : `Faltan ${ev.daysRemaining} dias`}
              </div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    });

    detail.innerHTML = `
      <div style="padding: 20px; border-bottom: 1px solid #e2e8f0;">
        <h3 style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #1e293b;">${dayName}</h3>
        <p style="margin: 0; font-size: 13px; color: #64748b;">${formattedDate}</p>
        <div style="
          display: inline-flex; align-items: center; gap: 6px;
          margin-top: 8px; padding: 4px 10px; background: #eff6ff;
          border-radius: 20px; font-size: 12px; font-weight: 600; color: #3b82f6;
        ">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          ${events.length} evento${events.length !== 1 ? 's' : ''}
        </div>
      </div>
      <div style="padding: 16px 20px; overflow-y: auto; max-height: calc(90vh - 200px);">
        ${eventsHtml}
      </div>
    `;
  }

  _getStatusColor(status) {
    const colors = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      in_progress: '#8b5cf6',
      completed: '#22c55e',
      cancelled: '#ef4444',
      validated: '#06b6d4'
    };
    return colors[status] || '#6b7280';
  }

  _getStatusLabel(status) {
    const labels = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      in_progress: 'En Progreso',
      completed: 'Completado',
      cancelled: 'Cancelado',
      validated: 'Validado'
    };
    return labels[status] || status;
  }

  prevMonth() {
    this.currentMonth--;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }
    this.selectedDate = null;
    this.renderCalendar();
  }

  nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    this.selectedDate = null;
    this.renderCalendar();
  }

  goToday() {
    const now = new Date();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth();
    this.selectedDate = this._toDateKey(now);
    this.renderCalendar();

    // Also show today's events
    const todayKey = this._toDateKey(now);
    if (todayKey) {
      this.showDayDetail(todayKey, this.events[todayKey] || []);
    }
  }

  setupEventListeners() {
    // Navigation
    const prevBtn = this.container.querySelector('#cm-prev-month');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prevMonth());
      prevBtn.addEventListener('mouseover', () => { prevBtn.style.background = '#e2e8f0'; });
      prevBtn.addEventListener('mouseout', () => { prevBtn.style.background = '#f1f5f9'; });
    }

    const nextBtn = this.container.querySelector('#cm-next-month');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextMonth());
      nextBtn.addEventListener('mouseover', () => { nextBtn.style.background = '#e2e8f0'; });
      nextBtn.addEventListener('mouseout', () => { nextBtn.style.background = '#f1f5f9'; });
    }

    const todayBtn = this.container.querySelector('#cm-today-btn');
    if (todayBtn) {
      todayBtn.addEventListener('click', () => this.goToday());
      todayBtn.addEventListener('mouseover', () => { todayBtn.style.background = '#2563eb'; });
      todayBtn.addEventListener('mouseout', () => { todayBtn.style.background = '#3b82f6'; });
    }
  }
}

export function initCalendarManager(container) {
  calendarManagerInstance = new CalendarManager(container);
  calendarManagerInstance.render();
  window.calendarManagerInstance = calendarManagerInstance;
  return calendarManagerInstance;
}
