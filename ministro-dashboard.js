/**
 * Ministro Dashboard
 * Panel de control para Ministros de Fe
 */

import { ministroService } from './src/services/MinistroService.js';
import { ministroAssignmentService } from './src/services/MinistroAssignmentService.js';
import { ministroAvailabilityService } from './src/services/MinistroAvailabilityService.js';

console.log('⚖️ Ministro dashboard loaded');

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

try {
  const storedMinistro = localStorage.getItem('currentMinistro');
  if (!storedMinistro) {
    window.location.href = '/ministro-login.html';
    throw new Error('No authenticated');
  }

  currentMinistro = JSON.parse(storedMinistro);

  if (currentMinistro.role !== 'MINISTRO') {
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
function loadStats() {
  const stats = ministroAssignmentService.getStatsByMinistro(currentMinistro.id);

  document.getElementById('stat-pending').textContent = stats.pending;
  document.getElementById('stat-completed').textContent = stats.completed;
  document.getElementById('stat-validated').textContent = stats.signaturesValidated;
}

// Render assignments list
function renderAssignments() {
  const assignments = ministroAssignmentService.getByMinistroId(currentMinistro.id);
  const container = document.getElementById('assignments-list');

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
    const date = new Date(assignment.scheduledDate);
    const formattedDate = date.toLocaleDateString('es-CL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const statusColors = {
      pending: { bg: '#dbeafe', color: '#1e40af', label: 'Pendiente' },
      completed: { bg: '#d1fae5', color: '#065f46', label: 'Completada' },
      cancelled: { bg: '#fee2e2', color: '#991b1b', label: 'Cancelada' }
    };

    const status = statusColors[assignment.status] || statusColors.pending;

    return `
      <div class="assignment-card" style="
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 16px;
        transition: all 0.2s;
        cursor: pointer;
      " onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='#e5e7eb'">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
          <div>
            <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #1f2937;">
              ${assignment.organizationName}
            </h3>
            <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 14px; color: #6b7280;">
              <span><strong>📅 Fecha:</strong> ${formattedDate}</span>
              <span><strong>🕐 Hora:</strong> ${assignment.scheduledTime}</span>
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
            <strong>📍 Lugar:</strong> ${assignment.location}
          </div>
        </div>

        ${assignment.status === 'pending' && !assignment.signaturesValidated ? `
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-primary" onclick="validateSignatures('${assignment.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                <path d="M2 2l7.586 7.586"></path>
                <circle cx="11" cy="11" r="2"></circle>
              </svg>
              Validar Firmas
            </button>
            <button class="btn btn-secondary" onclick="viewDetails('${assignment.id}')">Ver Detalles</button>
          </div>
        ` : assignment.signaturesValidated ? `
          <div style="padding: 12px; background: #d1fae5; border-radius: 8px; color: #065f46; font-size: 14px; font-weight: 600;">
            ✅ Firmas validadas el ${new Date(assignment.validatedAt).toLocaleDateString('es-CL')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// Render availability blocks
function renderAvailability() {
  const blocks = ministroAvailabilityService.getByMinistroId(currentMinistro.id);
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

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;

    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
  });
});

// Change password button
document.getElementById('btn-change-password').addEventListener('click', showChangePasswordModal);

// Logout button
document.getElementById('btn-logout').addEventListener('click', () => {
  if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
    localStorage.removeItem('currentMinistro');
    localStorage.removeItem('isMinistroAuthenticated');
    window.location.href = '/ministro-login.html';
  }
});

// Add block button
document.getElementById('btn-add-block').addEventListener('click', showAddBlockModal);

// Global functions for inline event handlers
window.validateSignatures = validateSignatures;
window.viewDetails = viewDetails;
window.deleteBlock = deleteBlock;

function validateSignatures(assignmentId) {
  const assignment = ministroAssignmentService.getAll().find(a => a.id === assignmentId);
  if (!assignment) {
    showToast('Asignación no encontrada', 'error');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header" style="padding: 24px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; border-bottom: none;">
        <h3 style="margin: 0; display: flex; align-items: center; gap: 12px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
            <path d="M2 2l7.586 7.586"></path>
            <circle cx="11" cy="11" r="2"></circle>
          </svg>
          Validación de Firmas
        </h3>
        <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${assignment.organizationName}</p>
      </div>
      <form id="validate-signatures-form" style="padding: 24px;">
        <div style="background: #eff6ff; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; font-size: 14px; color: #1e40af; font-weight: 500;">
            ℹ️ Verifica y valida la identidad de cada firmante y la autenticidad de sus firmas en los documentos presentados.
          </p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 20px;">
          <!-- Presidente -->
          <div style="border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; transition: all 0.2s;">
            <div style="display: flex; align-items: start; gap: 12px;">
              <input type="checkbox" id="validate-president" name="president" required style="
                width: 20px;
                height: 20px;
                margin-top: 4px;
                cursor: pointer;
                accent-color: #3b82f6;
              ">
              <div style="flex: 1;">
                <label for="validate-president" style="cursor: pointer; display: block; font-weight: 600; font-size: 15px; color: #1f2937; margin-bottom: 4px;">
                  👤 Presidente/a
                </label>
                <p style="margin: 0; font-size: 13px; color: #6b7280;">Verificar identidad, firma y documentación del presidente de la organización</p>
                <input type="text" id="president-name" placeholder="Nombre completo" required style="
                  width: 100%;
                  padding: 10px;
                  border: 1px solid #e5e7eb;
                  border-radius: 6px;
                  font-size: 14px;
                  box-sizing: border-box;
                  margin-top: 12px;
                ">
                <input type="text" id="president-rut" placeholder="RUT (ej: 12.345.678-9)" required style="
                  width: 100%;
                  padding: 10px;
                  border: 1px solid #e5e7eb;
                  border-radius: 6px;
                  font-size: 14px;
                  box-sizing: border-box;
                  margin-top: 8px;
                ">
              </div>
            </div>
          </div>

          <!-- Secretario -->
          <div style="border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px;">
            <div style="display: flex; align-items: start; gap: 12px;">
              <input type="checkbox" id="validate-secretary" name="secretary" required style="
                width: 20px;
                height: 20px;
                margin-top: 4px;
                cursor: pointer;
                accent-color: #3b82f6;
              ">
              <div style="flex: 1;">
                <label for="validate-secretary" style="cursor: pointer; display: block; font-weight: 600; font-size: 15px; color: #1f2937; margin-bottom: 4px;">
                  📝 Secretario/a
                </label>
                <p style="margin: 0; font-size: 13px; color: #6b7280;">Verificar identidad, firma y documentación del secretario de la organización</p>
                <input type="text" id="secretary-name" placeholder="Nombre completo" required style="
                  width: 100%;
                  padding: 10px;
                  border: 1px solid #e5e7eb;
                  border-radius: 6px;
                  font-size: 14px;
                  box-sizing: border-box;
                  margin-top: 12px;
                ">
                <input type="text" id="secretary-rut" placeholder="RUT (ej: 12.345.678-9)" required style="
                  width: 100%;
                  padding: 10px;
                  border: 1px solid #e5e7eb;
                  border-radius: 6px;
                  font-size: 14px;
                  box-sizing: border-box;
                  margin-top: 8px;
                ">
              </div>
            </div>
          </div>

          <!-- Tesorero -->
          <div style="border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px;">
            <div style="display: flex; align-items: start; gap: 12px;">
              <input type="checkbox" id="validate-treasurer" name="treasurer" required style="
                width: 20px;
                height: 20px;
                margin-top: 4px;
                cursor: pointer;
                accent-color: #3b82f6;
              ">
              <div style="flex: 1;">
                <label for="validate-treasurer" style="cursor: pointer; display: block; font-weight: 600; font-size: 15px; color: #1f2937; margin-bottom: 4px;">
                  💰 Tesorero/a
                </label>
                <p style="margin: 0; font-size: 13px; color: #6b7280;">Verificar identidad, firma y documentación del tesorero de la organización</p>
                <input type="text" id="treasurer-name" placeholder="Nombre completo" required style="
                  width: 100%;
                  padding: 10px;
                  border: 1px solid #e5e7eb;
                  border-radius: 6px;
                  font-size: 14px;
                  box-sizing: border-box;
                  margin-top: 12px;
                ">
                <input type="text" id="treasurer-rut" placeholder="RUT (ej: 12.345.678-9)" required style="
                  width: 100%;
                  padding: 10px;
                  border: 1px solid #e5e7eb;
                  border-radius: 6px;
                  font-size: 14px;
                  box-sizing: border-box;
                  margin-top: 8px;
                ">
              </div>
            </div>
          </div>
        </div>

        <div style="margin-top: 24px;">
          <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">
            Observaciones (opcional)
          </label>
          <textarea id="validation-notes" rows="3" style="
            width: 100%;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            box-sizing: border-box;
            resize: vertical;
          " placeholder="Notas adicionales sobre la validación..."></textarea>
        </div>

        <div style="background: #fef3c7; padding: 12px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; font-size: 13px; color: #92400e;">
            ⚠️ Al confirmar, certificas que has verificado la identidad de los firmantes y la autenticidad de sus firmas.
          </p>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary" style="background: #10b981;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Confirmar Validación
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector('#validate-signatures-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const validationData = {
      validatedBy: 'MINISTRO',
      validatorId: currentMinistro.id,
      validatorName: `${currentMinistro.firstName} ${currentMinistro.lastName}`,
      signatures: {
        president: {
          name: document.getElementById('president-name').value.trim(),
          rut: document.getElementById('president-rut').value.trim(),
          validated: document.getElementById('validate-president').checked
        },
        secretary: {
          name: document.getElementById('secretary-name').value.trim(),
          rut: document.getElementById('secretary-rut').value.trim(),
          validated: document.getElementById('validate-secretary').checked
        },
        treasurer: {
          name: document.getElementById('treasurer-name').value.trim(),
          rut: document.getElementById('treasurer-rut').value.trim(),
          validated: document.getElementById('validate-treasurer').checked
        },
        notes: document.getElementById('validation-notes').value.trim()
      }
    };

    try {
      ministroAssignmentService.markSignaturesValidated(assignmentId, validationData);
      showToast('✅ Firmas validadas exitosamente', 'success');
      modal.remove();
      loadStats();
      renderAssignments();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

function viewDetails(assignmentId) {
  const assignment = ministroAssignmentService.getAll().find(a => a.id === assignmentId);
  if (!assignment) return;

  showToast('Vista de detalles en desarrollo', 'info');
  // TODO: Implement details modal
}

function deleteBlock(blockId) {
  if (!confirm('¿Eliminar este bloqueo de disponibilidad?')) return;

  try {
    ministroAvailabilityService.delete(blockId);
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
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const date = document.getElementById('block-date').value;
    const reason = document.getElementById('block-reason').value.trim();

    try {
      // Si es día completo, crear un solo bloqueo sin hora
      if (fullDayCheckbox.checked) {
        ministroAvailabilityService.create({
          ministroId: currentMinistro.id,
          date,
          time: null,
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

        selectedTimes.forEach(time => {
          try {
            ministroAvailabilityService.create({
              ministroId: currentMinistro.id,
              date,
              time,
              reason
            });
            created++;
          } catch (error) {
            console.error(`Error bloqueando hora ${time}:`, error);
            errors++;
          }
        });

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
renderAvailability();

console.log('✅ Dashboard initialized');
