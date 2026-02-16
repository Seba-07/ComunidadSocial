/**
 * Ministro Dashboard
 * Panel de control para Ministros de Fe
 */

import { ministroService } from './src/services/MinistroService.js';
import { ministroAssignmentService } from './src/services/MinistroAssignmentService.js';
import { ministroAvailabilityService } from './src/services/MinistroAvailabilityService.js';
import { openValidationWizard } from './src/presentation/ministro/ValidationWizard.js';
import { apiService } from './src/services/ApiService.js';

// Componente de estado de conexión (se auto-inicializa)
import './src/shared/components/ConnectionStatus.js';

console.log('⚖️ Ministro dashboard loaded');

// ============ MANEJO DE SINCRONIZACIÓN OFFLINE ============
// Escuchar cuando la cola offline se sincronice
window.addEventListener('offline-queue-synced', async () => {
  console.log('🔄 Cola offline sincronizada, recargando asignaciones...');
  showToast('Datos sincronizados exitosamente', 'success');
  // Recargar asignaciones
  if (typeof loadAssignments === 'function') {
    await loadAssignments();
  }
});

// Escuchar sincronización individual completada
window.addEventListener('offline-sync-completed', (e) => {
  const { requestId, success } = e.detail;
  if (success) {
    console.log('✅ Petición sincronizada:', requestId);
  }
});

// Escuchar errores de sincronización
window.addEventListener('offline-sync-failed', (e) => {
  const { error } = e.detail;
  console.error('❌ Error de sincronización:', error);
  showToast('Error al sincronizar: ' + error, 'error');
});

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    animation: slideInRight 0.3s ease;
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Check authentication
let currentMinistro = null;
let loadedAssignments = []; // Store loaded assignments for later use

try {
  const storedMinistro = localStorage.getItem('currentMinistro');
  if (!storedMinistro) {
    window.location.href = '/ministro-login.html';
    throw new Error('No authenticated');
  }

  currentMinistro = JSON.parse(storedMinistro);

  if (currentMinistro.role !== 'MINISTRO_FE') {
    window.location.href = '/ministro-login.html';
    throw new Error('Invalid role');
  }

} catch (error) {
  console.error('Authentication error:', error);
  if (error.message !== 'No authenticated' && error.message !== 'Invalid role') {
    window.location.href = '/ministro-login.html';
  }
}

// Initialize dashboard
document.getElementById('welcome-message').textContent =
  `Bienvenido/a, ${currentMinistro.firstName} ${currentMinistro.lastName}`;

// Load stats
async function loadStats() {
  const ministroId = currentMinistro._id || currentMinistro.id;
  try {
    const stats = await ministroAssignmentService.getStatsByMinistro(ministroId);
    const pending = stats.pending || 0;
    const completed = stats.completed || 0;
    const validated = stats.signaturesValidated || 0;
    const total = pending + completed;

    // Update filter chip counts
    const countAll = document.getElementById('count-all');
    const countPending = document.getElementById('count-pending');
    const countCompleted = document.getElementById('count-completed');
    const countValidated = document.getElementById('count-validated');

    if (countAll) countAll.textContent = total;
    if (countPending) countPending.textContent = pending;
    if (countCompleted) countCompleted.textContent = completed;
    if (countValidated) countValidated.textContent = validated;

    // Update toolbar total
    const toolbarTotal = document.getElementById('toolbar-total');
    if (toolbarTotal) toolbarTotal.textContent = total;

    // Update sidebar badges
    const badgeAll = document.getElementById('badge-all');
    const badgePending = document.getElementById('badge-pending');
    const badgeCompleted = document.getElementById('badge-completed');
    const badgeValidated = document.getElementById('badge-validated');

    if (badgeAll) badgeAll.textContent = total;
    if (badgePending) badgePending.textContent = pending;
    if (badgeCompleted) badgeCompleted.textContent = completed;
    if (badgeValidated) badgeValidated.textContent = validated;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Render assignments list
async function renderAssignments() {
  const ministroId = currentMinistro._id || currentMinistro.id;
  const container = document.getElementById('assignments-list');

  // Mostrar loading
  container.innerHTML = '<div style="text-align: center; padding: 40px; color: #6b7280;">Cargando asambleas...</div>';

  let assignments = [];
  try {
    // Cargar desde el servidor
    assignments = await ministroAssignmentService.getByMinistroIdAsync(ministroId);
    loadedAssignments = assignments; // Store globally for later use
  } catch (error) {
    console.error('Error loading assignments:', error);
    // Fallback a datos locales
    assignments = ministroAssignmentService.getByMinistroId(ministroId);
    loadedAssignments = assignments;
  }

  if (assignments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="8.5" cy="7" r="4"></circle>
          <polyline points="17 11 19 13 23 9"></polyline>
        </svg>
        <p>No tienes asambleas asignadas</p>
      </div>
    `;
    return;
  }

  // Sort by date
  assignments.sort((a, b) => {
    const dateA = new Date(a.scheduledDate + ' ' + a.scheduledTime);
    const dateB = new Date(b.scheduledDate + ' ' + b.scheduledTime);
    return dateA - dateB;
  });

  container.innerHTML = assignments.map(assignment => {
    // El ID puede ser _id (MongoDB) o id
    const assignmentId = assignment._id || assignment.id;

    // La organización viene populada desde el servidor
    const org = assignment.organizationId; // Ya es un objeto

    // Obtener nombre de la organización
    let orgName = assignment.organizationName;
    if (!orgName && org) {
      orgName = org.organizationName || org.name || 'Organización sin nombre';
    }

    // Verificar si la cita fue modificada recientemente
    const wasModified = assignment.appointmentWasModified && assignment.appointmentChanges?.length > 0;
    const lastChange = wasModified ? assignment.appointmentChanges[assignment.appointmentChanges.length - 1] : null;

    // Formatear fecha correctamente (manejar ISO string del servidor)
    let formattedDate = 'Fecha no especificada';
    if (assignment.scheduledDate) {
      let date;
      const dateStr = assignment.scheduledDate;

      if (dateStr.includes('T')) {
        // Es un ISO string del servidor - extraer solo la parte de fecha
        // para evitar problemas de timezone (YYYY-MM-DDTHH:MM:SS.sssZ)
        const datePart = dateStr.split('T')[0]; // "2024-12-22"
        const [year, month, day] = datePart.split('-').map(Number);
        date = new Date(year, month - 1, day); // Crear fecha LOCAL sin timezone
      } else {
        // Es un string "yyyy-mm-dd"
        const [year, month, day] = dateStr.split('-').map(Number);
        date = new Date(year, month - 1, day);
      }

      formattedDate = date.toLocaleDateString('es-CL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    const statusColors = {
      pending: { bg: '#dbeafe', color: '#1e40af', label: 'Pendiente' },
      completed: { bg: '#d1fae5', color: '#065f46', label: 'Completada' },
      cancelled: { bg: '#fee2e2', color: '#991b1b', label: 'Cancelada' }
    };

    const status = statusColors[assignment.status] || statusColors.pending;

    // HTML de alerta de modificación
    let modificationAlertHTML = '';
    if (wasModified && lastChange) {
      const modDate = new Date(lastChange.changedAt);
      const modDateFormatted = modDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });

      const changesList = [];
      if (lastChange.changes.ministro) changesList.push('Ministro');
      if (lastChange.changes.date) changesList.push('Fecha');
      if (lastChange.changes.time) changesList.push('Hora');
      if (lastChange.changes.location) changesList.push('Lugar');

      modificationAlertHTML = `
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 10px; padding: 12px; margin-bottom: 12px; animation: pulse-ministro 2s ease-in-out infinite;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 22px;">🔔</span>
            <div style="flex: 1;">
              <p style="margin: 0; font-weight: 700; color: #92400e; font-size: 14px;">Cita Modificada (${modDateFormatted})</p>
              <p style="margin: 2px 0 0; font-size: 12px; color: #a16207;">Cambios: ${changesList.join(', ')}</p>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="assignment-card"
        data-status="${assignment.status || 'pending'}"
        data-validated="${assignment.signaturesValidated ? 'true' : 'false'}"
        style="
        border: 2px solid ${wasModified ? '#f59e0b' : '#e5e7eb'};
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 16px;
        transition: all 0.2s;
        cursor: pointer;
        ${wasModified ? 'box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);' : ''}
      " onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='${wasModified ? '#f59e0b' : '#e5e7eb'}'">

        ${modificationAlertHTML}

        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
          <div>
            <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #1f2937;">
              ${orgName}
            </h3>
            <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 14px; color: #6b7280;">
              <span><strong>📅 Fecha:</strong> ${formattedDate}</span>
              <span><strong>🕐 Hora:</strong> ${assignment.scheduledTime || 'No especificada'}</span>
            </div>
          </div>
          <span style="
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            background: ${status.bg};
            color: ${status.color};
          ">
            ${status.label}
          </span>
        </div>

        <div style="background: #f9fafb; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
          <div style="font-size: 14px; color: #374151;">
            <strong>📍 Lugar:</strong> ${assignment.location || 'No especificado'}
          </div>
        </div>

        ${assignment.status === 'pending' && !assignment.signaturesValidated ? `
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-primary" onclick="validateSignatures('${assignmentId}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                <path d="M2 2l7.586 7.586"></path>
                <circle cx="11" cy="11" r="2"></circle>
              </svg>
              Validar Firmas
            </button>
            <button class="btn btn-secondary" onclick="viewDetails('${assignmentId}')">Ver Detalles</button>
          </div>
        ` : assignment.signaturesValidated ? `
          <div style="background: #d1fae5; border-radius: 12px; padding: 16px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <div style="width: 36px; height: 36px; background: #10b981; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <div style="min-width: 0;">
                <p style="margin: 0; color: #065f46; font-size: 14px; font-weight: 700;">Asamblea Completada</p>
                <p style="margin: 2px 0 0; color: #047857; font-size: 12px;">${new Date(assignment.validatedAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            </div>

            ${assignment.wizardData ? (() => {
              const dir = assignment.wizardData.provisionalDirectorio || assignment.wizardData.directorio || {};
              const pName = dir.president?.name || '-';
              const sName = dir.secretary?.name || '-';
              const tName = dir.treasurer?.name || '-';
              const com = assignment.wizardData.comisionElectoral || [];
              const att = assignment.wizardData.attendees || [];
              return `
              <div style="background: white; border-radius: 8px; padding: 10px; margin-bottom: 12px; font-size: 12px;">
                <div style="margin-bottom: 8px;">
                  <p style="margin: 0 0 2px; color: #065f46; font-weight: 700;">Directorio Provisorio</p>
                  <p style="margin: 0; color: #047857; line-height: 1.4;">${pName} (P), ${sName} (S), ${tName} (T)</p>
                </div>
                <div style="margin-bottom: 8px;">
                  <p style="margin: 0 0 2px; color: #065f46; font-weight: 700;">Comision Electoral</p>
                  <p style="margin: 0; color: #047857; line-height: 1.4;">${com.length > 0 ? com.map(m => m?.name || '-').join(', ') : 'No especificada'}</p>
                </div>
                <div>
                  <p style="margin: 0 0 2px; color: #065f46; font-weight: 700;">Asistentes</p>
                  <p style="margin: 0; color: #047857;">${att.length || 0} personas</p>
                </div>
              </div>
              `;
            })() : ''}

            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px;">
              <button onclick="viewValidationSummary('${assignmentId}')" style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px; padding: 10px 18px; background: white; border: 2px solid #10b981; color: #065f46; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; flex: 1; justify-content: center; min-width: 140px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                Ver Resumen
              </button>
              <button onclick="editValidatedSignatures('${assignmentId}')" style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px; padding: 10px 18px; background: #f3f4f6; border: 2px solid #e5e7eb; color: #374151; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; flex: 1; justify-content: center; min-width: 140px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Editar
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Agregar estilos de animación si hay modificaciones
  if (!document.getElementById('ministro-pulse-styles')) {
    const style = document.createElement('style');
    style.id = 'ministro-pulse-styles';
    style.textContent = `
      @keyframes pulse-ministro {
        0%, 100% { box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3); }
        50% { box-shadow: 0 4px 16px rgba(245, 158, 11, 0.5); }
      }
    `;
    document.head.appendChild(style);
  }
}

// Render availability blocks (reads from localStorage, which is synced with backend on init)
function renderAvailability() {
  const ministroId = currentMinistro._id || currentMinistro.id;
  const blocks = ministroAvailabilityService.getByMinistroId(ministroId);

  const container = document.getElementById('availability-list');

  if (blocks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <p>No tienes bloques de disponibilidad</p>
      </div>
    `;
    return;
  }

  // Group by date
  const groupedBlocks = {};
  blocks.forEach(block => {
    if (!groupedBlocks[block.date]) {
      groupedBlocks[block.date] = [];
    }
    groupedBlocks[block.date].push(block);
  });

  // Sort dates
  const sortedDates = Object.keys(groupedBlocks).sort();

  container.innerHTML = sortedDates.map(date => {
    const dateBlocks = groupedBlocks[date];
    const dateObj = new Date(date + 'T12:00:00');
    const formattedDate = dateObj.toLocaleDateString('es-CL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const fullDayBlock = dateBlocks.find(b => !b.time);

    return `
      <div style="
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 16px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">
            📅 ${formattedDate}
          </h3>
        </div>

        ${fullDayBlock ? `
          <div style="background: #fee2e2; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #991b1b; font-weight: 600;">⛔ Día completo bloqueado</span>
              <button class="btn btn-secondary" onclick="deleteBlock('${fullDayBlock.id}')" style="padding: 6px 12px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                Eliminar
              </button>
            </div>
            ${fullDayBlock.reason ? `<p style="margin: 8px 0 0; font-size: 13px; color: #7f1d1d;">${fullDayBlock.reason}</p>` : ''}
          </div>
        ` : `
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${dateBlocks.map(block => `
              <div style="
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: #fef3c7;
                border-radius: 8px;
                font-size: 14px;
                color: #92400e;
                font-weight: 600;
              ">
                🕐 ${block.time}
                <button onclick="deleteBlock('${block.id}')" style="
                  border: none;
                  background: transparent;
                  color: #dc2626;
                  cursor: pointer;
                  padding: 4px;
                  display: flex;
                  align-items: center;
                ">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }).join('');
}

// Current filter state
let currentFilter = 'all';

// ============ SIDEBAR NAVIGATION ============

// Show a view (assignments or availability)
function showView(viewName) {
  // Hide all views
  document.querySelectorAll('.ministro-view').forEach(v => v.classList.remove('active'));

  // Show the requested view
  const viewEl = document.getElementById(`view-${viewName}`);
  if (viewEl) viewEl.classList.add('active');

  // Update sidebar active state for view links
  document.querySelectorAll('[data-ministro-view]').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.ministroView === viewName) link.classList.add('active');
  });

  // Persistir vista actual para restaurar al recargar
  sessionStorage.setItem('ministro_current_view', viewName);

  // Close sidebar on mobile
  const sidebar = document.getElementById('ministro-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar && window.innerWidth < 1024) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

// Sidebar view switching (data-ministro-view)
document.querySelectorAll('[data-ministro-view]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    showView(link.dataset.ministroView);
  });
});

// Restaurar vista guardada al recargar
const savedView = sessionStorage.getItem('ministro_current_view');
if (savedView) {
  showView(savedView);
}

// Sidebar filter switching (data-ministro-filter)
document.querySelectorAll('[data-ministro-filter]').forEach(link => {
  link.addEventListener('click', () => {
    const filterType = link.dataset.ministroFilter;

    // Switch to assignments view first
    showView('assignments');

    // Update sidebar filter active state
    document.querySelectorAll('[data-ministro-filter]').forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    // Update content filter chips too
    document.querySelectorAll('.ministro-filter-chip-clean').forEach(c => c.classList.remove('active'));
    const matchingChip = document.querySelector(`.ministro-filter-chip-clean[data-filter="${filterType}"]`);
    if (matchingChip) matchingChip.classList.add('active');

    // Apply filter
    currentFilter = filterType;
    applyAssignmentFilter();

    // Close sidebar on mobile
    const sidebar = document.getElementById('ministro-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && window.innerWidth < 1024) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  });
});

// Filter chip switching (in content area)
document.querySelectorAll('.ministro-filter-chip-clean').forEach(chip => {
  chip.addEventListener('click', () => {
    const filterType = chip.dataset.filter;

    // Update active state on filter chips
    document.querySelectorAll('.ministro-filter-chip-clean').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    // Update sidebar filter active state
    document.querySelectorAll('[data-ministro-filter]').forEach(l => l.classList.remove('active'));
    const matchingLink = document.querySelector(`[data-ministro-filter="${filterType}"]`);
    if (matchingLink) matchingLink.classList.add('active');

    // Apply filter
    currentFilter = filterType;
    applyAssignmentFilter();
  });
});

// Collapsible sidebar sections
document.querySelectorAll('.nav-section-collapsible').forEach(title => {
  title.addEventListener('click', () => {
    const sectionName = title.dataset.section;
    const items = document.querySelector(`[data-section-items="${sectionName}"]`);
    if (items) {
      title.classList.toggle('collapsed');
      items.classList.toggle('collapsed');
    }
  });
});

// Menu toggle (mobile)
const menuBtn = document.getElementById('menu-btn');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const ministroSidebar = document.getElementById('ministro-sidebar');
const closeSidebar = document.getElementById('close-sidebar');

if (menuBtn) {
  menuBtn.addEventListener('click', () => {
    ministroSidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
  });
}

if (closeSidebar) {
  closeSidebar.addEventListener('click', () => {
    ministroSidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  });
}

if (sidebarOverlay) {
  sidebarOverlay.addEventListener('click', () => {
    ministroSidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  });
}

// Sidebar account buttons
const sidebarChangePassword = document.getElementById('sidebar-change-password');
if (sidebarChangePassword) {
  sidebarChangePassword.addEventListener('click', () => {
    showChangePasswordModal();
    if (window.innerWidth < 1024) {
      ministroSidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
    }
  });
}

const sidebarNotifications = document.getElementById('sidebar-notifications');
if (sidebarNotifications) {
  sidebarNotifications.addEventListener('click', () => {
    openNotificationsPanel();
    if (window.innerWidth < 1024) {
      ministroSidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
    }
  });
}

const sidebarLogout = document.getElementById('sidebar-logout');
if (sidebarLogout) {
  sidebarLogout.addEventListener('click', async (e) => {
    e.preventDefault();
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      await apiService.logout();
      localStorage.removeItem('isMinistroAuthenticated');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('ministro_assignments');
      window.location.href = '/auth.html';
    }
  });
}

// Apply filter to assignments
function applyAssignmentFilter() {
  const container = document.getElementById('assignments-list');
  const cards = container.querySelectorAll('.assignment-card');

  cards.forEach(card => {
    const status = card.dataset.status || 'pending';
    const isValidated = card.dataset.validated === 'true';

    let show = false;

    switch (currentFilter) {
      case 'all':
        show = true;
        break;
      case 'pending':
        show = status === 'pending';
        break;
      case 'completed':
        show = status === 'completed';
        break;
      case 'validated':
        show = isValidated;
        break;
      default:
        show = true;
    }

    card.style.display = show ? 'block' : 'none';
  });

  // Show empty message if no cards visible
  const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
  let emptyMsg = container.querySelector('.filter-empty-message');

  if (visibleCards.length === 0 && cards.length > 0) {
    if (!emptyMsg) {
      emptyMsg = document.createElement('div');
      emptyMsg.className = 'filter-empty-message';
      emptyMsg.style.cssText = 'text-align: center; padding: 40px 20px; color: #6b7280;';
      emptyMsg.innerHTML = '<p style="margin: 0; font-size: 15px;">No hay asambleas con este filtro</p>';
      container.appendChild(emptyMsg);
    }
    emptyMsg.style.display = 'block';
  } else if (emptyMsg) {
    emptyMsg.style.display = 'none';
  }
}

// Logout button (header)
document.getElementById('btn-logout').addEventListener('click', async () => {
  if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
    await apiService.logout();
    localStorage.removeItem('isMinistroAuthenticated');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('ministro_assignments');
    window.location.href = '/auth.html';
  }
});

// Add block button
document.getElementById('btn-add-block').addEventListener('click', showAddBlockModal);

// Clear blocks button
document.getElementById('btn-clear-blocks').addEventListener('click', async () => {
  if (!confirm('¿Estás seguro de que deseas eliminar TODOS tus bloqueos de disponibilidad? Esta acción no se puede deshacer.')) {
    return;
  }

  const ministroId = currentMinistro._id || currentMinistro.id;
  const blocks = ministroAvailabilityService.getByMinistroId(ministroId).filter(b => b.active);

  // Eliminar cada bloque del backend
  for (const block of blocks) {
    try {
      await ministroAvailabilityService.deleteBlock(block.id);
    } catch (error) {
      console.warn('Error eliminando bloque del backend:', error.message);
    }
  }

  // Limpiar localStorage por si quedaron residuos
  ministroAvailabilityService.clearByMinistroId(ministroId);
  showToast('Todos los bloqueos han sido eliminados', 'success');
  renderAvailability();
});

// Global functions for inline event handlers
window.validateSignatures = validateSignatures;
window.viewDetails = viewDetails;
window.deleteBlock = deleteBlock;
window.editValidatedSignatures = editValidatedSignatures;
window.viewValidationSummary = viewValidationSummary;
window.viewDocumentation = viewDocumentation;
window.closeNotificationsPanel = closeNotificationsPanel;
window.openNotificationsPanel = openNotificationsPanel;

function validateSignatures(assignmentId) {
  // Buscar en las asignaciones cargadas (usando _id de MongoDB)
  const assignment = loadedAssignments.find(a => (a._id === assignmentId || a.id === assignmentId));
  if (!assignment) {
    showToast('Asignación no encontrada', 'error');
    return;
  }

  // La organización viene populada en la asignación desde el servidor
  const org = assignment.organizationId; // Ya viene como objeto populado

  // Abrir el nuevo wizard
  // Guardar el ID antes de abrir el wizard
  const savedAssignmentId = assignment._id || assignment.id;
  console.log('🚀 Abriendo wizard para assignment:', savedAssignmentId);

  openValidationWizard(assignment, org, currentMinistro, {
    onComplete: (wizardData, returnedAssignment, returnedOrg, returnedMinistro) => {
      // Usar el assignment original si el retornado no tiene ID
      const finalAssignment = (returnedAssignment?._id || returnedAssignment?.id)
        ? returnedAssignment
        : assignment;
      console.log('📦 onComplete recibido:', {
        returnedAssignmentId: returnedAssignment?._id || returnedAssignment?.id,
        originalAssignmentId: savedAssignmentId,
        usingOriginal: !(returnedAssignment?._id || returnedAssignment?.id)
      });
      // Procesar la validación
      processValidationComplete(wizardData, finalAssignment, returnedOrg || org, returnedMinistro || currentMinistro);
    }
  });
}

// Procesar la validación completada del wizard
async function processValidationComplete(wizardData, assignment, org, ministro) {
  console.log('🔍 processValidationComplete llamado con:', {
    wizardData: wizardData ? 'presente' : 'undefined',
    assignment: assignment,
    assignmentId: assignment?._id || assignment?.id,
    org: org ? 'presente' : 'undefined',
    ministro: ministro ? 'presente' : 'undefined'
  });

  const president = wizardData.directorio.president;
  const secretary = wizardData.directorio.secretary;
  const treasurer = wizardData.directorio.treasurer;
  const additionalMembers = wizardData.additionalMembers;
  const commissionMembers = wizardData.comisionElectoral;
  const assemblyAttendees = wizardData.attendees;

  // Obtener IDs correctos (MongoDB usa _id)
  const ministroId = ministro._id || ministro.id;
  const assignmentId = assignment._id || assignment.id;

  console.log('🆔 IDs obtenidos:', { ministroId, assignmentId });

  if (!assignmentId) {
    console.error('❌ assignmentId es undefined! assignment:', assignment);
    showToast('Error: No se encontró el ID de la asignación', 'error');
    return;
  }

  const validationData = {
    validatedBy: 'MINISTRO',
    validatorId: ministroId,
    validatorName: `${ministro.firstName} ${ministro.lastName}`,
    ministroSignature: wizardData.ministroSignature,
    groupPhoto: wizardData.groupPhoto,
    provisionalDirectorio: {
      president,
      secretary,
      treasurer,
      additionalMembers
    },
    comisionElectoral: commissionMembers,
    signatures: {
      president,
      secretary,
      treasurer,
      additionalMembers,
      commissionMembers,
      notes: wizardData.notes
    },
    attendees: assemblyAttendees
  };

  try {
    console.log('📝 Enviando validación al servidor...', { assignmentId, validationData });
    await ministroAssignmentService.markSignaturesValidated(assignmentId, validationData);

    // Actualizar la organización
    if (org) {
      const orgsUpdated = JSON.parse(localStorage.getItem('user_organizations') || '[]');
      const orgIndex = orgsUpdated.findIndex(o => o.id === assignment.organizationId);
      if (orgIndex !== -1) {
        orgsUpdated[orgIndex].provisionalDirectorio = {
          president,
          secretary,
          treasurer,
          additionalMembers,
          designatedAt: new Date().toISOString(),
          type: 'PROVISIONAL',
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
        };
        // FIX: comisionElectoral debe ser array, no objeto envuelto
        // Backend Organization.js espera: comisionElectoral: [mongoose.Schema.Types.Mixed]
        orgsUpdated[orgIndex].comisionElectoral = commissionMembers;
        // FIX: Usar validatedAttendees (nombre correcto del backend)
        // Backend Organization.js espera: validatedAttendees: [mongoose.Schema.Types.Mixed]
        orgsUpdated[orgIndex].validatedAttendees = assemblyAttendees;
        orgsUpdated[orgIndex].ministroSignature = wizardData.ministroSignature;
        orgsUpdated[orgIndex].groupPhoto = wizardData.groupPhoto;
        orgsUpdated[orgIndex].validationData = {
          validatedBy: 'MINISTRO',
          validatorId: ministro.id,
          validatorName: `${ministro.firstName} ${ministro.lastName}`,
          validatedAt: new Date().toISOString()
        };
        orgsUpdated[orgIndex].status = 'ministro_approved';
        orgsUpdated[orgIndex].statusHistory = orgsUpdated[orgIndex].statusHistory || [];

        // Generar resumen
        let directorioResumen = `Presidente: ${president.name}, Secretario: ${secretary.name}, Tesorero: ${treasurer.name}`;
        if (additionalMembers.length > 0) {
          directorioResumen += `. Miembros adicionales: ${additionalMembers.map(m => `${m.cargo}: ${m.name}`).join(', ')}`;
        }
        const comisionResumen = `Comisión Electoral: ${commissionMembers.map(m => m.name).join(', ')}`;

        orgsUpdated[orgIndex].statusHistory.push({
          status: 'ministro_approved',
          date: new Date().toISOString(),
          comment: `Aprobado por Ministro de Fe ${ministro.firstName} ${ministro.lastName}. Directorio Provisorio: ${directorioResumen}. ${comisionResumen}. Asistentes: ${assemblyAttendees.length}`
        });
        localStorage.setItem('user_organizations', JSON.stringify(orgsUpdated));
      }
    }

    showToast('✅ Validación completada exitosamente', 'success');
    console.log('✅ Validación guardada, recargando datos...');
    await loadStats();
    await renderAssignments();
  } catch (error) {
    console.error('❌ Error en validación:', error);
    showToast(error.message || 'Error al procesar la validación', 'error');
  }
}

// Función para editar firmas ya validadas
function editValidatedSignatures(assignmentId) {
  const assignment = loadedAssignments.find(a => (a._id === assignmentId || a.id === assignmentId));
  if (!assignment) {
    showToast('Asignación no encontrada', 'error');
    return;
  }

  // Mostrar confirmación antes de editar
  const confirmEdit = document.createElement('div');
  confirmEdit.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 400000;';
  confirmEdit.innerHTML = `
    <div style="background: white; border-radius: 20px; max-width: 480px; width: 90%; padding: 32px; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.3);">
      <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 50%; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </div>
      <h3 style="margin: 0 0 16px; font-size: 22px; color: #1f2937;">Rehacer Validacion</h3>
      <p style="margin: 0 0 24px; color: #6b7280; font-size: 15px; line-height: 1.6;">
        Las firmas ya fueron validadas el <strong>${new Date(assignment.validatedAt).toLocaleDateString('es-CL')}</strong>.<br><br>
        <span style="color: #d97706;">Al continuar, la validacion anterior sera anulada y debera realizar una nueva validacion desde cero.</span><br><br>
        <span style="font-size: 13px;">El historial de validaciones anteriores quedara registrado.</span>
      </p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="cancel-edit" style="padding: 14px 28px; border: 2px solid #e5e7eb; background: white; color: #374151; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 15px;">
          Cancelar
        </button>
        <button id="confirm-edit" style="padding: 14px 28px; border: none; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 15px; display: flex; align-items: center; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          Rehacer Validacion
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmEdit);

  confirmEdit.querySelector('#cancel-edit').addEventListener('click', () => confirmEdit.remove());

  confirmEdit.querySelector('#confirm-edit').addEventListener('click', () => {
    confirmEdit.remove();
    // Resetear el estado de validación y abrir el formulario
    ministroAssignmentService.resetValidation(assignmentId);
    validateSignatures(assignmentId);
  });
}

// Función para ver el resumen de la validación completada
function viewValidationSummary(assignmentId) {
  const assignment = loadedAssignments.find(a => (a._id === assignmentId || a.id === assignmentId));
  if (!assignment) {
    showToast('Asignación no encontrada', 'error');
    return;
  }

  const wizardData = assignment.wizardData;
  if (!wizardData) {
    showToast('No hay datos de validación disponibles', 'error');
    return;
  }

  const org = assignment.organizationId;
  const orgName = org?.organizationName || assignment.organizationName || 'Organización';

  // Buscar directorio en ambos lugares posibles
  const dir = wizardData.provisionalDirectorio || wizardData.directorio || {};
  const additionalMembers = dir.additionalMembers || wizardData.additionalMembers || [];
  const comision = wizardData.comisionElectoral || [];
  const attendees = wizardData.attendees || [];

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 400000; padding: 20px;';
  modal.innerHTML = `
    <div style="background: white; border-radius: 20px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px rgba(0,0,0,0.3);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; border-radius: 20px 20px 0 0;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h2 style="margin: 0; color: white; font-size: 22px; display: flex; align-items: center; gap: 12px;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              Resumen de Validacion
            </h2>
            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">${orgName}</p>
          </div>
          <button onclick="this.closest('.modal-overlay').remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 40px; height: 40px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div style="padding: 24px;">
        <!-- Info de validación -->
        <div style="background: #d1fae5; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 48px; height: 48px; background: #10b981; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div>
              <p style="margin: 0; color: #065f46; font-size: 16px; font-weight: 700;">Validacion Completada</p>
              <p style="margin: 4px 0 0; color: #047857; font-size: 14px;">
                ${new Date(assignment.validatedAt).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>

        <!-- Directorio Provisorio -->
        <div style="background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 16px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #374151; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">🏛️</span> Directorio Provisorio
          </h3>
          <div style="display: grid; gap: 12px;">
            <div style="background: white; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Presidente</p>
              <p style="margin: 4px 0 0; font-size: 15px; color: #1f2937; font-weight: 600;">${dir.president?.name || 'No especificado'}</p>
              ${dir.president?.rut ? `<p style="margin: 2px 0 0; font-size: 13px; color: #6b7280;">RUT: ${dir.president.rut}</p>` : ''}
            </div>
            <div style="background: white; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #10b981;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Secretario</p>
              <p style="margin: 4px 0 0; font-size: 15px; color: #1f2937; font-weight: 600;">${dir.secretary?.name || 'No especificado'}</p>
              ${dir.secretary?.rut ? `<p style="margin: 2px 0 0; font-size: 13px; color: #6b7280;">RUT: ${dir.secretary.rut}</p>` : ''}
            </div>
            <div style="background: white; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Tesorero</p>
              <p style="margin: 4px 0 0; font-size: 15px; color: #1f2937; font-weight: 600;">${dir.treasurer?.name || 'No especificado'}</p>
              ${dir.treasurer?.rut ? `<p style="margin: 2px 0 0; font-size: 13px; color: #6b7280;">RUT: ${dir.treasurer.rut}</p>` : ''}
            </div>
            ${additionalMembers.length > 0 ? additionalMembers.map(m => `
              <div style="background: white; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #8b5cf6;">
                <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">${m.role || m.cargo || 'Director'}</p>
                <p style="margin: 4px 0 0; font-size: 15px; color: #1f2937; font-weight: 600;">${m.name || 'No especificado'}</p>
                ${m.rut ? `<p style="margin: 2px 0 0; font-size: 13px; color: #6b7280;">RUT: ${m.rut}</p>` : ''}
              </div>
            `).join('') : ''}
          </div>
        </div>

        <!-- Comisión Electoral -->
        <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 16px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #92400e; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">🗳️</span> Comision Electoral (${comision.length} miembros)
          </h3>
          ${comision.length > 0 ? `
            <div style="display: grid; gap: 8px;">
              ${comision.map((m, i) => `
                <div style="background: white; padding: 10px 14px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 14px; color: #1f2937; font-weight: 600;">${i + 1}. ${m?.name || '-'}</span>
                  ${m?.rut ? `<span style="font-size: 13px; color: #6b7280;">${m.rut}</span>` : ''}
                </div>
              `).join('')}
            </div>
          ` : `<p style="margin: 0; color: #92400e;">No especificada</p>`}
        </div>

        <!-- Asistentes -->
        <div style="background: #eff6ff; border: 2px solid #3b82f6; border-radius: 16px; padding: 20px;">
          <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #1e40af; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">👥</span> Asistentes a la Asamblea (${attendees.length} personas)
          </h3>
          ${attendees.length > 0 ? `
            <div style="max-height: 300px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px;">
              ${attendees.map((a, i) => `
                <div style="background: white; padding: 8px 12px; border-radius: 6px; font-size: 13px;">
                  <span style="color: #1f2937;">${i + 1}. ${a.name || (a.firstName + ' ' + (a.lastName || '')) || '-'}</span>
                </div>
              `).join('')}
            </div>
          ` : `<p style="margin: 0; color: #1e40af;">Sin asistentes registrados</p>`}
        </div>
      </div>

      <!-- Footer -->
      <div style="padding: 20px 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 12px;">
        <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary" style="padding: 12px 24px;">
          Cerrar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function viewDetails(assignmentId) {
  const assignment = loadedAssignments.find(a => (a._id === assignmentId || a.id === assignmentId));
  if (!assignment) {
    showToast('Asignación no encontrada', 'error');
    return;
  }

  // La organización viene populada en la asignación desde el servidor
  const org = assignment.organizationId; // Ya viene como objeto populado

  // Mapeo de tipos de organización a nombres legibles
  const orgTypeLabels = {
    'JUNTA_VECINOS': 'Junta de Vecinos',
    'COMITE_VECINOS': 'Comité de Vecinos',
    'CLUB_DEPORTIVO': 'Club Deportivo',
    'CLUB_ADULTO_MAYOR': 'Club de Adulto Mayor',
    'CLUB_JUVENIL': 'Club Juvenil',
    'CLUB_CULTURAL': 'Club Cultural',
    'CENTRO_MADRES': 'Centro de Madres',
    'CENTRO_PADRES': 'Centro de Padres y Apoderados',
    'CENTRO_CULTURAL': 'Centro Cultural',
    'AGRUPACION_FOLCLORICA': 'Agrupación Folclórica',
    'AGRUPACION_CULTURAL': 'Agrupación Cultural',
    'AGRUPACION_JUVENIL': 'Agrupación Juvenil',
    'AGRUPACION_AMBIENTAL': 'Agrupación Ambiental',
    'AGRUPACION_EMPRENDEDORES': 'Agrupación de Emprendedores',
    'COMITE_VIVIENDA': 'Comité de Vivienda',
    'COMITE_ALLEGADOS': 'Comité de Allegados',
    'COMITE_APR': 'Comité de Agua Potable Rural',
    'COMITE_ADELANTO': 'Comité de Adelanto',
    'COMITE_MEJORAMIENTO': 'Comité de Mejoramiento',
    'COMITE_CONVIVENCIA': 'Comité de Convivencia',
    'ORG_SCOUT': 'Organización Scout',
    'ORG_MUJERES': 'Organización de Mujeres',
    'ORG_INDIGENA': 'Organización Indígena',
    'ORG_SALUD': 'Organización de Salud',
    'ORG_SOCIAL': 'Organización Social',
    'ORG_CULTURAL': 'Organización Cultural',
    'GRUPO_TEATRO': 'Grupo de Teatro',
    'CORO': 'Coro',
    'TALLER_ARTESANIA': 'Taller de Artesanía',
    'ORG_COMUNITARIA': 'Organización Comunitaria',
    'ORG_FUNCIONAL': 'Organización Funcional',
    'OTRA_FUNCIONAL': 'Otra Organización Funcional'
  };

  // Extraer datos de la organización
  const orgName = org?.organizationName || assignment.organizationName || 'Sin nombre';
  const orgTypeCode = org?.organizationType || '';
  const orgType = orgTypeLabels[orgTypeCode] || orgTypeCode || 'No especificado';
  const orgAddress = org?.address || 'No especificada';
  const orgCommune = org?.comuna || org?.commune || 'No especificada';
  const orgRegion = org?.region || '';
  const orgEmail = org?.contactEmail || '';
  const orgPhone = org?.contactPhone || '';

  // Extraer miembros
  const members = org?.members || [];

  // Formatear fecha - maneja tanto strings como objetos Date (evita desfase de zona horaria)
  const formatDate = (dateValue) => {
    if (!dateValue) return 'No especificada';
    try {
      let date;
      if (typeof dateValue === 'string') {
        // Extraer solo la parte de la fecha (YYYY-MM-DD) para evitar problemas de zona horaria
        const datePart = dateValue.split('T')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        if (year && month && day) {
          // Crear fecha a mediodía para evitar problemas de zona horaria
          date = new Date(year, month - 1, day, 12, 0, 0);
        } else {
          return 'No especificada';
        }
      } else if (dateValue instanceof Date) {
        date = dateValue;
      } else {
        return 'No especificada';
      }

      if (isNaN(date.getTime())) {
        return 'No especificada';
      }

      return date.toLocaleDateString('es-CL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return 'No especificada';
    }
  };

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 900px; width: 95%;">
      <div class="modal-header" style="padding: 24px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; border-bottom: none;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
          <div>
            <h3 style="margin: 0; display: flex; align-items: center; gap: 12px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              Detalles de la Asamblea
            </h3>
            <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${orgName}</p>
          </div>
          <button type="button" onclick="this.closest('.modal-overlay').remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div style="padding: 24px;">
        <!-- Información de la Cita -->
        <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #3b82f6; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
          <h4 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #1e40af;">📅 Información de la Cita</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div>
              <p style="margin: 0; font-size: 12px; color: #3b82f6; font-weight: 600; text-transform: uppercase;">Fecha</p>
              <p style="margin: 4px 0 0; font-size: 15px; color: #1e40af; font-weight: 600;">${formatDate(assignment.scheduledDate)}</p>
            </div>
            <div>
              <p style="margin: 0; font-size: 12px; color: #3b82f6; font-weight: 600; text-transform: uppercase;">Hora</p>
              <p style="margin: 4px 0 0; font-size: 15px; color: #1e40af; font-weight: 600;">${assignment.scheduledTime || 'No especificada'}</p>
            </div>
            <div>
              <p style="margin: 0; font-size: 12px; color: #3b82f6; font-weight: 600; text-transform: uppercase;">Lugar</p>
              <p style="margin: 4px 0 0; font-size: 15px; color: #1e40af; font-weight: 600;">${assignment.location || 'No especificado'}</p>
            </div>
          </div>
        </div>

        <!-- Información de la Organización -->
        ${org ? `
          <div style="background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
            <h4 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #374151;">🏢 Datos de la Organización</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
              <div>
                <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Nombre</p>
                <p style="margin: 4px 0 0; font-size: 15px; color: #1f2937; font-weight: 600;">${orgName}</p>
              </div>
              <div>
                <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Tipo</p>
                <p style="margin: 4px 0 0; font-size: 15px; color: #1f2937; font-weight: 600;">${orgType}</p>
              </div>
              <div>
                <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Dirección</p>
                <p style="margin: 4px 0 0; font-size: 15px; color: #1f2937; font-weight: 600;">${orgAddress}</p>
              </div>
              <div>
                <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Comuna</p>
                <p style="margin: 4px 0 0; font-size: 15px; color: #1f2937; font-weight: 600;">${orgCommune || 'No especificada'}</p>
              </div>
            </div>

            ${orgEmail || orgPhone ? `
              <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                <h5 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #374151;">Contacto</h5>
                <div style="display: flex; gap: 24px; flex-wrap: wrap;">
                  ${orgEmail ? `<p style="margin: 0; font-size: 14px; color: #1f2937;">📧 ${orgEmail}</p>` : ''}
                  ${orgPhone ? `<p style="margin: 0; font-size: 14px; color: #1f2937;">📱 ${orgPhone}</p>` : ''}
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Directorio Provisorio y Comisión Electoral -->
          ${org?.provisionalDirectorio || org?.electoralCommission?.length > 0 ? `
            <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
              <h4 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #92400e;">👥 Quiénes deben asistir (OBLIGATORIO)</h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                <div style="background: white; border-radius: 8px; padding: 12px;">
                  <p style="margin: 0 0 8px 0; font-size: 12px; color: #92400e; font-weight: 700; text-transform: uppercase;">Directorio Provisorio</p>
                  ${(() => {
                    // Helper para extraer nombre de diferentes formatos
                    const extractMemberName = (m) => {
                      if (!m) return '';
                      // Formato WizardController: primerNombre, apellidoPaterno
                      if (m.primerNombre) {
                        const fn = [m.primerNombre, m.segundoNombre].filter(Boolean).join(' ');
                        const ln = [m.apellidoPaterno, m.apellidoMaterno].filter(Boolean).join(' ');
                        return (fn + ' ' + ln).trim();
                      }
                      // Formato estándar: firstName, lastName
                      if (m.firstName) {
                        return ((m.firstName || '') + ' ' + (m.lastName || '')).trim();
                      }
                      // Formato simple: name
                      return m.name || m.nombre || '';
                    };

                    const dir = org?.provisionalDirectorio;
                    if (dir && (dir.president || dir.secretary || dir.treasurer)) {
                      let html = '';
                      if (dir.president) {
                        const name = extractMemberName(dir.president);
                        html += '<p style="margin: 0 0 4px 0; font-size: 13px; color: #44403c;">• <strong>Presidente:</strong> ' + name + '</p>';
                      }
                      if (dir.secretary) {
                        const name = extractMemberName(dir.secretary);
                        html += '<p style="margin: 0 0 4px 0; font-size: 13px; color: #44403c;">• <strong>Secretario:</strong> ' + name + '</p>';
                      }
                      if (dir.treasurer) {
                        const name = extractMemberName(dir.treasurer);
                        html += '<p style="margin: 0 0 4px 0; font-size: 13px; color: #44403c;">• <strong>Tesorero:</strong> ' + name + '</p>';
                      }
                      // Agregar miembros adicionales del directorio
                      const cargoLabels = {
                        'vicepresidente': 'Vicepresidente',
                        'director1': 'Director/a',
                        'director2': 'Director/a',
                        'director3': 'Director/a',
                        'secretario_actas': 'Secretario de Actas',
                        'pro_secretario': 'Pro-Secretario',
                        'pro_tesorero': 'Pro-Tesorero',
                        'director_finanzas': 'Director Finanzas',
                        'vocal1': 'Vocal',
                        'vocal2': 'Vocal',
                        'consejero1': 'Consejero/a',
                        'consejero2': 'Consejero/a'
                      };
                      const additionalMembers = dir.additionalMembers || [];
                      additionalMembers.forEach(m => {
                        const cargo = cargoLabels[m.cargo || m.role] || m.cargo || m.role || 'Miembro';
                        const name = extractMemberName(m);
                        html += '<p style="margin: 0 0 4px 0; font-size: 13px; color: #44403c;">• <strong>' + cargo + ':</strong> ' + name + '</p>';
                      });
                      return html || '<p style="margin: 0; font-size: 13px; color: #78716c;">No especificado</p>';
                    }

                    // FALLBACK: Buscar en members por rol
                    const president = members.find(m => m.role === 'president');
                    const secretary = members.find(m => m.role === 'secretary');
                    const treasurer = members.find(m => m.role === 'treasurer');

                    if (president || secretary || treasurer) {
                      let html = '';
                      if (president) {
                        const name = extractMemberName(president);
                        html += '<p style="margin: 0 0 4px 0; font-size: 13px; color: #44403c;">• <strong>Presidente:</strong> ' + name + '</p>';
                      }
                      if (secretary) {
                        const name = extractMemberName(secretary);
                        html += '<p style="margin: 0 0 4px 0; font-size: 13px; color: #44403c;">• <strong>Secretario:</strong> ' + name + '</p>';
                      }
                      if (treasurer) {
                        const name = extractMemberName(treasurer);
                        html += '<p style="margin: 0 0 4px 0; font-size: 13px; color: #44403c;">• <strong>Tesorero:</strong> ' + name + '</p>';
                      }
                      return html;
                    }

                    return '<p style="margin: 0; font-size: 13px; color: #78716c;">No especificado</p>';
                  })()}
                  ${(() => {
                    // Mostrar miembros adicionales del directorio (vicepresidente, directores, etc.)
                    const additionalMembers = org?.provisionalDirectorio?.additionalMembers || [];
                    if (additionalMembers.length === 0) return '';

                    const cargoLabels = {
                      'vicepresidente': 'Vicepresidente',
                      'director1': 'Director/a',
                      'director2': 'Director/a',
                      'director3': 'Director/a',
                      'secretario_actas': 'Secretario de Actas',
                      'pro_secretario': 'Pro-Secretario',
                      'pro_tesorero': 'Pro-Tesorero',
                      'director_finanzas': 'Director Finanzas',
                      'vocal1': 'Vocal',
                      'vocal2': 'Vocal',
                      'consejero1': 'Consejero/a',
                      'consejero2': 'Consejero/a'
                    };

                    const extractMemberName = (m) => {
                      if (!m) return '';
                      if (m.primerNombre) {
                        const fn = [m.primerNombre, m.segundoNombre].filter(Boolean).join(' ');
                        const ln = [m.apellidoPaterno, m.apellidoMaterno].filter(Boolean).join(' ');
                        return (fn + ' ' + ln).trim();
                      }
                      if (m.firstName) return ((m.firstName || '') + ' ' + (m.lastName || '')).trim();
                      return m.name || m.nombre || '';
                    };

                    return additionalMembers.map(m => {
                      const cargo = cargoLabels[m.cargo || m.role] || m.cargo || m.role || 'Miembro';
                      const name = extractMemberName(m);
                      return '<p style="margin: 0 0 4px 0; font-size: 13px; color: #44403c;">• <strong>' + cargo + ':</strong> ' + name + '</p>';
                    }).join('');
                  })()}
                </div>
                <div style="background: white; border-radius: 8px; padding: 12px;">
                  <p style="margin: 0 0 8px 0; font-size: 12px; color: #92400e; font-weight: 700; text-transform: uppercase;">Comisión Electoral</p>
                  ${(() => {
                    const commission = org?.electoralCommission || [];
                    if (commission.length === 0) {
                      return '<p style="margin: 0; font-size: 13px; color: #78716c;">No especificada</p>';
                    }
                    return commission.map(m => {
                      return '<p style="margin: 0 0 4px 0; font-size: 13px; color: #44403c;">• ' + (m.firstName || m.name || '') + ' ' + (m.lastName || '') + '</p>';
                    }).join('');
                  })()}
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Miembros Registrados -->
          ${members.length > 0 ? `
            <div style="background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 16px; padding: 24px;">
              <h4 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #374151;">👥 Miembros Registrados (${members.length})</h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px;">
                ${members.map((member, index) => `
                  <div style="background: white; padding: 12px 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-weight: 600; color: #1f2937; font-size: 14px;">${index + 1}. ${member.firstName ? `${member.firstName} ${member.lastName || ''}` : member.name || 'Sin nombre'}</p>
                    <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">RUT: ${member.rut || 'No especificado'}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : `
            <div style="background: #fef3c7; padding: 16px; border-radius: 12px; text-align: center;">
              <p style="margin: 0; color: #92400e;">No hay miembros registrados aún.</p>
            </div>
          `}

          <!-- Certificados de Antecedentes -->
          ${(() => {
            // Buscar miembros del directorio que tienen certificado
            const dirMembers = [];
            const dir = org?.provisionalDirectorio;
            if (dir?.president) dirMembers.push({ ...dir.president, cargo: 'Presidente' });
            if (dir?.secretary) dirMembers.push({ ...dir.secretary, cargo: 'Secretario' });
            if (dir?.treasurer) dirMembers.push({ ...dir.treasurer, cargo: 'Tesorero' });
            const additionalMembers = dir?.additionalMembers || [];
            const cargoLabels = {
              'vicepresidente': 'Vicepresidente',
              'director1': 'Director/a',
              'director2': 'Director/a',
              'director3': 'Director/a',
              'secretario_actas': 'Secretario de Actas',
              'pro_secretario': 'Pro-Secretario',
              'pro_tesorero': 'Pro-Tesorero',
              'director_finanzas': 'Director Finanzas',
              'vocal1': 'Vocal',
              'vocal2': 'Vocal',
              'consejero1': 'Consejero/a',
              'consejero2': 'Consejero/a'
            };
            additionalMembers.forEach(m => {
              if (m) dirMembers.push({ ...m, cargo: cargoLabels[m.cargo || m.role] || m.cargo || 'Miembro' });
            });

            // También revisar en members por si tienen certificado
            const membersWithCert = members.filter(m => m.certificate);

            // Combinar: certificados del directorio + miembros con certificado
            const allWithCerts = dirMembers.filter(m => m.certificado || m.certificate);
            membersWithCert.forEach(m => {
              if (!allWithCerts.find(x => x.rut === m.rut)) {
                allWithCerts.push({
                  ...m,
                  cargo: m.role === 'president' ? 'Presidente' : m.role === 'secretary' ? 'Secretario' : m.role === 'treasurer' ? 'Tesorero' : 'Miembro'
                });
              }
            });

            if (allWithCerts.length === 0) {
              return '';
            }

            const extractName = (m) => {
              if (m.primerNombre) {
                const fn = [m.primerNombre, m.segundoNombre].filter(Boolean).join(' ');
                const ln = [m.apellidoPaterno, m.apellidoMaterno].filter(Boolean).join(' ');
                return (fn + ' ' + ln).trim();
              }
              if (m.firstName) return ((m.firstName || '') + ' ' + (m.lastName || '')).trim();
              return m.name || m.nombre || 'Sin nombre';
            };

            let certsHtml = '<div style="background: #ecfdf5; border: 2px solid #10b981; border-radius: 16px; padding: 24px; margin-top: 20px;">';
            certsHtml += '<h4 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #065f46;">📋 Certificados de Antecedentes (' + allWithCerts.length + ')</h4>';
            certsHtml += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">';

            allWithCerts.forEach(m => {
              const certData = m.certificado || m.certificate;
              certsHtml += '<div style="background: white; padding: 12px 16px; border-radius: 8px; border: 1px solid #d1fae5;">';
              certsHtml += '<div style="display: flex; justify-content: space-between; align-items: flex-start;">';
              certsHtml += '<div>';
              certsHtml += '<p style="margin: 0; font-weight: 600; color: #1f2937; font-size: 14px;">' + extractName(m) + '</p>';
              certsHtml += '<p style="margin: 2px 0 0; font-size: 12px; color: #059669; font-weight: 600;">' + m.cargo + '</p>';
              if (m.rut) {
                certsHtml += '<p style="margin: 2px 0 0; font-size: 12px; color: #6b7280;">RUT: ' + m.rut + '</p>';
              }
              certsHtml += '</div>';
              if (certData) {
                certsHtml += '<button onclick="window.open(\'' + certData + '\', \'_blank\')" ';
                certsHtml += 'style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 4px;">';
                certsHtml += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">';
                certsHtml += '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>';
                certsHtml += '<polyline points="14 2 14 8 20 8"></polyline>';
                certsHtml += '<line x1="16" y1="13" x2="8" y2="13"></line>';
                certsHtml += '<line x1="16" y1="17" x2="8" y2="17"></line>';
                certsHtml += '</svg>';
                certsHtml += 'Ver</button>';
              } else {
                certsHtml += '<span style="font-size: 11px; color: #f59e0b; font-weight: 600;">Pendiente</span>';
              }
              certsHtml += '</div></div></div>';
            });

            certsHtml += '</div></div>';
            return certsHtml;
          })()}
        ` : `
          <div style="background: #fef3c7; padding: 20px; border-radius: 12px; text-align: center;">
            <p style="margin: 0; color: #92400e; font-weight: 600;">
              ⚠️ No se encontraron datos adicionales de la organización.
            </p>
          </div>
        `}

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
            Cerrar
          </button>
          <button type="button" class="btn" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; border: none;" onclick="this.closest('.modal-overlay').remove(); viewDocumentation('${assignmentId}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Ver Documentación
          </button>
          ${!assignment.signaturesValidated ? `
            <button type="button" class="btn btn-primary" onclick="this.closest('.modal-overlay').remove(); validateSignatures('${assignmentId}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              </svg>
              Validar Firmas
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// Función para ver documentación completa de la organización
function viewDocumentation(assignmentId) {
  const assignment = loadedAssignments.find(a => (a._id === assignmentId || a.id === assignmentId));
  if (!assignment) {
    showToast('Asignación no encontrada', 'error');
    return;
  }

  const org = assignment.organizationId;
  const orgName = org?.organizationName || assignment.organizationName || 'Sin nombre';

  // Helper para extraer nombre de miembro
  const extractMemberName = (m) => {
    if (!m) return 'Sin nombre';
    if (m.primerNombre) {
      const fn = [m.primerNombre, m.segundoNombre].filter(Boolean).join(' ');
      const ln = [m.apellidoPaterno, m.apellidoMaterno].filter(Boolean).join(' ');
      return (fn + ' ' + ln).trim() || 'Sin nombre';
    }
    if (m.firstName) return ((m.firstName || '') + ' ' + (m.lastName || '')).trim();
    return m.name || m.nombre || 'Sin nombre';
  };

  // Extraer directorio provisorio
  const dir = org?.provisionalDirectorio || {};
  const additionalMembers = dir.additionalMembers || [];

  // Extraer comisión electoral
  const commission = org?.electoralCommission || [];

  // Extraer miembros
  const members = org?.members || [];

  // Extraer estatutos
  const estatutos = org?.estatutos || '';

  // Mapeo de cargos
  const cargoLabels = {
    'vicepresidente': 'Vicepresidente/a',
    'director1': 'Director/a',
    'director2': 'Director/a',
    'director3': 'Director/a',
    'secretario_actas': 'Secretario/a de Actas',
    'pro_secretario': 'Pro-Secretario/a',
    'pro_tesorero': 'Pro-Tesorero/a',
    'director_finanzas': 'Director/a de Finanzas',
    'vocal1': 'Vocal',
    'vocal2': 'Vocal',
    'consejero1': 'Consejero/a',
    'consejero2': 'Consejero/a'
  };

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 20px; backdrop-filter: blur(8px);';

  modal.innerHTML = `
    <div style="background: white; border-radius: 20px; max-width: 1100px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.4); overflow: hidden;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: white; padding: 24px 28px; position: relative;">
        <div style="position: absolute; top: -50%; right: -5%; width: 200px; height: 200px; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); pointer-events: none;"></div>
        <div style="display: flex; justify-content: space-between; align-items: center; position: relative;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="width: 52px; height: 52px; background: rgba(255,255,255,0.2); border-radius: 14px; display: flex; align-items: center; justify-content: center;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 22px; font-weight: 700;">Documentación para Revisar</h2>
              <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">${orgName}</p>
            </div>
          </div>
          <button type="button" onclick="this.closest('.modal-overlay').remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 40px; height: 40px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div style="flex: 1; overflow-y: auto; padding: 24px;">
        <!-- Tabs de navegación -->
        <div style="display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap;" id="doc-tabs">
          <button class="doc-tab active" data-tab="directorio" style="padding: 10px 20px; border: 2px solid #e5e7eb; background: #4f46e5; color: white; border-radius: 8px; font-weight: 600; cursor: pointer;">
            👤 Directorio Provisorio
          </button>
          <button class="doc-tab" data-tab="comision" style="padding: 10px 20px; border: 2px solid #e5e7eb; background: white; color: #374151; border-radius: 8px; font-weight: 600; cursor: pointer;">
            📋 Comisión Electoral
          </button>
          <button class="doc-tab" data-tab="miembros" style="padding: 10px 20px; border: 2px solid #e5e7eb; background: white; color: #374151; border-radius: 8px; font-weight: 600; cursor: pointer;">
            👥 Miembros (${members.length})
          </button>
          <button class="doc-tab" data-tab="estatutos" style="padding: 10px 20px; border: 2px solid #e5e7eb; background: white; color: #374151; border-radius: 8px; font-weight: 600; cursor: pointer;">
            📜 Estatutos
          </button>
        </div>

        <!-- Contenido de tabs -->
        <div id="doc-content">
          <!-- Tab: Directorio Provisorio -->
          <div id="tab-directorio" class="tab-content" style="display: block;">
            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #0ea5e9; border-radius: 16px; padding: 24px; margin-bottom: 20px;">
              <h3 style="margin: 0 0 20px; color: #0369a1; display: flex; align-items: center; gap: 10px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                Directorio Provisorio
              </h3>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                ${dir.president ? `
                  <div style="background: white; padding: 16px; border-radius: 12px; border-left: 4px solid #3b82f6;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">👤</div>
                      <div>
                        <p style="margin: 0; font-weight: 700; color: #1f2937; font-size: 15px;">${extractMemberName(dir.president)}</p>
                        <p style="margin: 2px 0 0; color: #3b82f6; font-size: 13px; font-weight: 600;">Presidente/a</p>
                        ${dir.president.rut ? `<p style="margin: 2px 0 0; color: #6b7280; font-size: 12px;">RUT: ${dir.president.rut}</p>` : ''}
                      </div>
                    </div>
                  </div>
                ` : ''}
                ${dir.secretary ? `
                  <div style="background: white; padding: 16px; border-radius: 12px; border-left: 4px solid #8b5cf6;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #8b5cf6, #6d28d9); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">📝</div>
                      <div>
                        <p style="margin: 0; font-weight: 700; color: #1f2937; font-size: 15px;">${extractMemberName(dir.secretary)}</p>
                        <p style="margin: 2px 0 0; color: #8b5cf6; font-size: 13px; font-weight: 600;">Secretario/a</p>
                        ${dir.secretary.rut ? `<p style="margin: 2px 0 0; color: #6b7280; font-size: 12px;">RUT: ${dir.secretary.rut}</p>` : ''}
                      </div>
                    </div>
                  </div>
                ` : ''}
                ${dir.treasurer ? `
                  <div style="background: white; padding: 16px; border-radius: 12px; border-left: 4px solid #f59e0b;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">💰</div>
                      <div>
                        <p style="margin: 0; font-weight: 700; color: #1f2937; font-size: 15px;">${extractMemberName(dir.treasurer)}</p>
                        <p style="margin: 2px 0 0; color: #f59e0b; font-size: 13px; font-weight: 600;">Tesorero/a</p>
                        ${dir.treasurer.rut ? `<p style="margin: 2px 0 0; color: #6b7280; font-size: 12px;">RUT: ${dir.treasurer.rut}</p>` : ''}
                      </div>
                    </div>
                  </div>
                ` : ''}
                ${additionalMembers.map(m => `
                  <div style="background: white; padding: 16px; border-radius: 12px; border-left: 4px solid #10b981;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">👥</div>
                      <div>
                        <p style="margin: 0; font-weight: 700; color: #1f2937; font-size: 15px;">${extractMemberName(m)}</p>
                        <p style="margin: 2px 0 0; color: #10b981; font-size: 13px; font-weight: 600;">${cargoLabels[m.cargo || m.role] || m.cargo || 'Miembro'}</p>
                        ${m.rut ? `<p style="margin: 2px 0 0; color: #6b7280; font-size: 12px;">RUT: ${m.rut}</p>` : ''}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Tab: Comisión Electoral -->
          <div id="tab-comision" class="tab-content" style="display: none;">
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 16px; padding: 24px;">
              <h3 style="margin: 0 0 20px; color: #92400e; display: flex; align-items: center; gap: 10px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Comisión Electoral (${commission.length} miembros)
              </h3>
              ${commission.length > 0 ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                  ${commission.map((m, i) => `
                    <div style="background: white; padding: 16px; border-radius: 12px; border: 1px solid #fcd34d;">
                      <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; background: #fef3c7; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #92400e; font-weight: 700;">${i + 1}</div>
                        <div>
                          <p style="margin: 0; font-weight: 600; color: #1f2937;">${extractMemberName(m)}</p>
                          ${m.rut ? `<p style="margin: 2px 0 0; color: #6b7280; font-size: 12px;">RUT: ${m.rut}</p>` : ''}
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <p style="margin: 0; color: #92400e; text-align: center; padding: 20px;">No hay miembros de comisión electoral registrados</p>
              `}
            </div>
          </div>

          <!-- Tab: Miembros -->
          <div id="tab-miembros" class="tab-content" style="display: none;">
            <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 16px; padding: 24px;">
              <h3 style="margin: 0 0 20px; color: #1e293b; display: flex; align-items: center; gap: 10px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                Lista de Miembros Fundadores (${members.length})
              </h3>
              ${members.length > 0 ? `
                <div style="max-height: 400px; overflow-y: auto;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                      <tr style="background: #e2e8f0;">
                        <th style="padding: 12px; text-align: left; font-size: 13px; color: #475569;">#</th>
                        <th style="padding: 12px; text-align: left; font-size: 13px; color: #475569;">Nombre</th>
                        <th style="padding: 12px; text-align: left; font-size: 13px; color: #475569;">RUT</th>
                        <th style="padding: 12px; text-align: left; font-size: 13px; color: #475569;">Rol</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${members.map((m, i) => `
                        <tr style="border-bottom: 1px solid #e2e8f0; ${i % 2 === 0 ? 'background: white;' : 'background: #f8fafc;'}">
                          <td style="padding: 12px; font-size: 13px; color: #64748b;">${i + 1}</td>
                          <td style="padding: 12px; font-size: 14px; color: #1e293b; font-weight: 500;">${extractMemberName(m)}</td>
                          <td style="padding: 12px; font-size: 13px; color: #64748b;">${m.rut || '-'}</td>
                          <td style="padding: 12px; font-size: 13px; color: #64748b;">${m.role || 'Miembro'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `
                <p style="margin: 0; color: #64748b; text-align: center; padding: 20px;">No hay miembros registrados</p>
              `}
            </div>
          </div>

          <!-- Tab: Estatutos -->
          <div id="tab-estatutos" class="tab-content" style="display: none;">
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #10b981; border-radius: 16px; padding: 24px;">
              <h3 style="margin: 0 0 20px; color: #065f46; display: flex; align-items: center; gap: 10px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                Estatutos de la Organización
              </h3>
              ${estatutos ? `
                <div style="background: white; border-radius: 12px; padding: 24px; max-height: 500px; overflow-y: auto; border: 1px solid #bbf7d0;">
                  <div style="font-family: 'Georgia', serif; line-height: 1.8; color: #1f2937;">
                    ${estatutos}
                  </div>
                </div>
              ` : `
                <p style="margin: 0; color: #065f46; text-align: center; padding: 40px;">No hay estatutos registrados para esta organización</p>
              `}
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; background: #f9fafb; display: flex; justify-content: flex-end;">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
          Cerrar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners para tabs
  modal.querySelectorAll('.doc-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Desactivar todos los tabs
      modal.querySelectorAll('.doc-tab').forEach(t => {
        t.style.background = 'white';
        t.style.color = '#374151';
      });
      // Activar el tab clickeado
      tab.style.background = '#4f46e5';
      tab.style.color = 'white';

      // Ocultar todo el contenido
      modal.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
      });
      // Mostrar el contenido del tab
      const tabName = tab.getAttribute('data-tab');
      const tabContent = modal.querySelector('#tab-' + tabName);
      if (tabContent) {
        tabContent.style.display = 'block';
      }
    });
  });
}

async function deleteBlock(blockId) {
  if (!confirm('¿Eliminar este bloqueo de disponibilidad?')) return;

  try {
    await ministroAvailabilityService.deleteBlock(blockId);
    showToast('Bloqueo eliminado', 'success');
    renderAvailability();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function showChangePasswordModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header" style="padding: 24px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
        <h3 style="margin: 0; color: #1f2937;">Cambiar Contraseña</h3>
      </div>
      <form id="change-password-form" style="padding: 24px;">
        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">
            Contraseña Actual
          </label>
          <input type="password" id="current-password" required style="
            width: 100%;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            box-sizing: border-box;
          ">
        </div>

        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">
            Nueva Contraseña
          </label>
          <input type="password" id="new-password" required style="
            width: 100%;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            box-sizing: border-box;
          ">
          <small style="color: #6b7280; font-size: 12px;">Mínimo 6 caracteres</small>
        </div>

        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">
            Confirmar Nueva Contraseña
          </label>
          <input type="password" id="confirm-password" required style="
            width: 100%;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            box-sizing: border-box;
          ">
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary">
            Cambiar Contraseña
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector('#change-password-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
      showToast('Las contraseñas no coinciden', 'error');
      return;
    }

    try {
      const updated = ministroService.changePassword(currentMinistro.id, currentPassword, newPassword);

      // Update session
      localStorage.setItem('currentMinistro', JSON.stringify(updated));
      currentMinistro = updated;

      showToast('Contraseña cambiada exitosamente', 'success');
      modal.remove();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

function showAddBlockModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header" style="padding: 24px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
        <h3 style="margin: 0; color: #1f2937;">Bloquear Disponibilidad</h3>
      </div>
      <form id="add-block-form" style="padding: 24px;">
        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">
            Fecha
          </label>
          <input type="date" id="block-date" required style="
            width: 100%;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            box-sizing: border-box;
          " min="${new Date().toISOString().split('T')[0]}">
        </div>

        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 12px;">
            <input type="checkbox" id="full-day-block" style="margin-right: 8px;">
            <strong>Bloquear día completo</strong>
          </label>
        </div>

        <div class="form-group" id="time-group" style="margin-bottom: 20px;">
          <label style="display: block; font-weight: 600; margin-bottom: 12px; color: #374151;">
            Seleccionar Horas a Bloquear (múltiple)
          </label>
          <p style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">
            Haz clic en las horas que deseas bloquear. Puedes seleccionar múltiples horas.
          </p>
          <div id="time-selector" style="
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          ">
            ${ministroAvailabilityService.getAvailableHours().map(hour => `
              <button type="button" class="time-option" data-time="${hour}" style="
                padding: 12px;
                border: 2px solid #e5e7eb;
                background: white;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                color: #374151;
                cursor: pointer;
                transition: all 0.2s;
              " onmouseover="this.style.borderColor='#3b82f6'" onmouseout="if(!this.classList.contains('selected')) this.style.borderColor='#e5e7eb'">
                ${hour}
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="selected-times" value="">
        </div>

        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">
            Motivo (opcional)
          </label>
          <textarea id="block-reason" rows="3" style="
            width: 100%;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            box-sizing: border-box;
            resize: vertical;
          " placeholder="Ej: Vacaciones, compromiso personal..."></textarea>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary">
            Guardar Bloqueo
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Toggle time field
  const fullDayCheckbox = modal.querySelector('#full-day-block');
  const timeGroup = modal.querySelector('#time-group');
  const selectedTimesInput = modal.querySelector('#selected-times');

  fullDayCheckbox.addEventListener('change', () => {
    if (fullDayCheckbox.checked) {
      timeGroup.style.display = 'none';
      selectedTimesInput.value = '';
      // Deseleccionar todas las horas
      modal.querySelectorAll('.time-option').forEach(btn => {
        btn.classList.remove('selected');
        btn.style.background = 'white';
        btn.style.borderColor = '#e5e7eb';
        btn.style.color = '#374151';
      });
    } else {
      timeGroup.style.display = 'block';
    }
  });

  // Manejar selección de horas
  const timeButtons = modal.querySelectorAll('.time-option');
  timeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (fullDayCheckbox.checked) return; // No permitir selección si día completo está marcado

      btn.classList.toggle('selected');

      if (btn.classList.contains('selected')) {
        btn.style.background = '#3b82f6';
        btn.style.borderColor = '#3b82f6';
        btn.style.color = 'white';
      } else {
        btn.style.background = 'white';
        btn.style.borderColor = '#e5e7eb';
        btn.style.color = '#374151';
      }

      // Actualizar input hidden con horas seleccionadas
      const selectedTimes = Array.from(modal.querySelectorAll('.time-option.selected'))
        .map(b => b.dataset.time);
      selectedTimesInput.value = selectedTimes.join(',');
    });
  });

  const form = modal.querySelector('#add-block-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const date = document.getElementById('block-date').value;
    const reason = document.getElementById('block-reason').value.trim();

    try {
      // Obtener el ID correcto del ministro (MongoDB usa _id)
      const ministroId = currentMinistro._id || currentMinistro.id;
      const ministroName = `${currentMinistro.firstName} ${currentMinistro.lastName}`;

      // Si es día completo, crear un solo bloqueo sin hora
      if (fullDayCheckbox.checked) {
        await ministroAvailabilityService.createBlock({
          ministroId: ministroId,
          ministroName,
          date,
          time: null,
          blockType: 'full_day',
          reason
        });
        showToast('Día completo bloqueado exitosamente', 'success');
      } else {
        // Obtener horas seleccionadas
        const selectedTimes = selectedTimesInput.value.split(',').filter(t => t);

        if (selectedTimes.length === 0) {
          showToast('Debes seleccionar al menos una hora o marcar día completo', 'error');
          return;
        }

        // Crear un bloqueo por cada hora seleccionada
        let created = 0;
        let errors = 0;

        for (const time of selectedTimes) {
          try {
            await ministroAvailabilityService.createBlock({
              ministroId: ministroId,
              ministroName,
              date,
              time,
              blockType: 'manual',
              reason
            });
            created++;
          } catch (error) {
            console.error(`Error bloqueando hora ${time}:`, error);
            errors++;
          }
        }

        if (created > 0) {
          showToast(`${created} hora(s) bloqueada(s) exitosamente`, 'success');
        }
        if (errors > 0) {
          showToast(`${errors} hora(s) no pudieron bloquearse (ya bloqueadas)`, 'error');
        }
      }

      modal.remove();
      renderAvailability();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

// Check if must change password
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('changePassword') === 'true' || currentMinistro.mustChangePassword) {
  setTimeout(() => {
    showChangePasswordModal();
    showToast('Por seguridad, debes cambiar tu contraseña', 'info');
  }, 500);
}

// Load initial data
loadStats();
renderAssignments();

// Sincronizar bloques del backend y luego renderizar disponibilidad
(async () => {
  const ministroId = currentMinistro._id || currentMinistro.id;
  try {
    await ministroAvailabilityService.loadFromBackend(ministroId);
  } catch (error) {
    console.warn('Error sincronizando bloques del backend:', error.message);
  }
  renderAvailability();
})();

// ==================== NOTIFICATIONS SYSTEM ====================

let ministroNotifications = [];

// Load notifications for ministro
async function loadMinistroNotifications() {
  const ministroId = currentMinistro._id || currentMinistro.id;
  try {
    const response = await apiService.get(`/notifications/ministro/${ministroId}`);
    ministroNotifications = response || [];
    updateNotificationBadge();
  } catch (error) {
    console.error('Error loading ministro notifications:', error);
    ministroNotifications = [];
  }
}

// Update notification badge
function updateNotificationBadge() {
  const badge = document.getElementById('notification-badge');
  const unreadCount = ministroNotifications.filter(n => !n.read).length;

  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

// Open notifications panel
function openNotificationsPanel() {
  const overlay = document.getElementById('notifications-overlay');
  const panel = document.getElementById('notifications-panel');

  if (!overlay || !panel) {
    console.error('Notifications elements not found');
    return;
  }

  // Render notifications content
  renderNotificationsPanel(panel);

  // Show overlay and panel
  overlay.classList.add('active');
  panel.classList.add('active');
}

// Close notifications panel
function closeNotificationsPanel() {
  const overlay = document.getElementById('notifications-overlay');
  const panel = document.getElementById('notifications-panel');

  if (overlay) overlay.classList.remove('active');
  if (panel) panel.classList.remove('active');
}

// Render notifications panel content
function renderNotificationsPanel(panel) {
  const sortedNotifications = [...ministroNotifications].sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  const unreadCount = sortedNotifications.filter(n => !n.read).length;

  panel.innerHTML = `
    <div class="notifications-header">
      <h2>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        Notificaciones
        ${unreadCount > 0 ? `<span class="notification-count-badge">${unreadCount} nueva${unreadCount !== 1 ? 's' : ''}</span>` : ''}
      </h2>
      <div class="notifications-header-actions">
        ${unreadCount > 0 ? `
          <button class="notifications-mark-all" onclick="markAllNotificationsRead()">
            Marcar todas como leídas
          </button>
        ` : ''}
        <button class="notifications-close" onclick="closeNotificationsPanel()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
    <div class="notifications-list">
      ${sortedNotifications.length === 0 ? `
        <div class="notifications-empty">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <p>No tienes notificaciones</p>
        </div>
      ` : sortedNotifications.map(notif => {
        const date = new Date(notif.createdAt);
        const timeAgo = getTimeAgo(date);
        const notifId = notif._id || notif.id;

        return `
          <div class="notification-item ${notif.read ? '' : 'unread'}">
            <div class="notification-title">${notif.title}</div>
            <div class="notification-message">${notif.message}</div>
            <div class="notification-time">${timeAgo}</div>
            <div class="notification-actions">
              ${!notif.read ? `
                <button class="notification-action-btn mark-read" onclick="event.stopPropagation(); markNotificationRead('${notifId}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Marcar leída
                </button>
              ` : ''}
              <button class="notification-action-btn delete" onclick="event.stopPropagation(); deleteNotification('${notifId}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Eliminar
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Get time ago string
function getTimeAgo(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
  if (hours < 24) return `Hace ${hours} hora${hours !== 1 ? 's' : ''}`;
  if (days < 7) return `Hace ${days} día${days !== 1 ? 's' : ''}`;
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

// Mark notification as read
async function markNotificationRead(notifId) {
  try {
    await apiService.post(`/notifications/ministro/${notifId}/read`);

    // Update local state
    const notif = ministroNotifications.find(n => (n._id || n.id) === notifId);
    if (notif) {
      notif.read = true;
    }

    updateNotificationBadge();

    // Re-render panel
    const panel = document.querySelector('.notifications-panel');
    if (panel) {
      renderNotificationsPanel(panel);
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

// Mark all notifications as read
async function markAllNotificationsRead() {
  const ministroId = currentMinistro._id || currentMinistro.id;
  try {
    await apiService.post(`/notifications/ministro/${ministroId}/read-all`);

    // Update local state
    ministroNotifications.forEach(n => {
      n.read = true;
    });

    updateNotificationBadge();

    // Re-render panel
    const panel = document.querySelector('.notifications-panel');
    if (panel) {
      renderNotificationsPanel(panel);
    }

    showToast('Todas las notificaciones marcadas como leídas', 'success');
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    showToast('Error al marcar notificaciones', 'error');
  }
}

// Delete notification
async function deleteNotification(notifId) {
  try {
    await apiService.delete(`/notifications/ministro/${notifId}`);

    // Remove from local state
    ministroNotifications = ministroNotifications.filter(n => (n._id || n.id) !== notifId);

    updateNotificationBadge();

    // Re-render panel
    const panel = document.querySelector('.notifications-panel');
    if (panel) {
      renderNotificationsPanel(panel);
    }

    showToast('Notificación eliminada', 'success');
  } catch (error) {
    console.error('Error deleting notification:', error);
    showToast('Error al eliminar notificación', 'error');
  }
}

// Notifications button click
document.getElementById('btn-notifications').addEventListener('click', openNotificationsPanel);

// Global functions for notifications
window.closeNotificationsPanel = closeNotificationsPanel;
window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
window.deleteNotification = deleteNotification;

// Load notifications on init
loadMinistroNotifications();

// Refresh notifications every 60 seconds
setInterval(loadMinistroNotifications, 60000);

// ============ SERVICE WORKER SYNC MESSAGES ============
// Escuchar mensajes del Service Worker para sincronización offline
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, requestId, error, success } = event.data || {};

    switch (type) {
      case 'SYNC_COMPLETED':
        console.log('✅ [SW Sync] Petición sincronizada:', requestId);
        showToast('Datos sincronizados correctamente', 'success');
        // Recargar datos si es necesario
        loadAssignments();
        break;

      case 'SYNC_FAILED':
        console.error('❌ [SW Sync] Error al sincronizar:', requestId, error);
        showToast(`Error al sincronizar: ${error}`, 'error');
        break;

      case 'SYNC_COMPLETE':
        console.log('✅ [SW Sync] Sincronización completa');
        break;

      default:
        console.log('[SW Message]', event.data);
    }
  });

  // Registrar para background sync cuando hay conexión
  navigator.serviceWorker.ready.then((registration) => {
    // Intentar sincronizar cuando recuperamos conexión
    window.addEventListener('online', async () => {
      console.log('🌐 Conexión restaurada, iniciando sincronización...');
      showToast('Conexión restaurada. Sincronizando datos...', 'info');

      try {
        if ('sync' in registration) {
          await registration.sync.register('sync-offline-queue');
        }
      } catch (error) {
        console.warn('Background sync no disponible:', error);
      }
    });

    // Notificar cuando perdemos conexión
    window.addEventListener('offline', () => {
      console.log('📴 Sin conexión');
      showToast('Sin conexión. Los cambios se guardarán localmente.', 'error');
    });
  });
}

console.log('✅ Dashboard initialized');
