/**
 * Ministro Manager - Panel de Gestión de Ministros de Fe
 * Permite al administrador gestionar el registro de Ministros de Fe
 */

import { ministroService } from '../../services/MinistroService.js';
import { ministroAvailabilityService } from '../../services/MinistroAvailabilityService.js';
import { showToast } from '../../app.js';

export class MinistroManager {
  constructor(container) {
    this.container = container;
    this.currentMinistro = null;
  }

  render() {
    this.container.innerHTML = `
      <div class="ministro-manager">
        <div class="ministro-manager-header">
          <div>
            <h2>Gestión de Ministros de Fe</h2>
            <p class="ministro-subtitle">Administra el registro de Ministros de Fe disponibles</p>
          </div>
          <button type="button" id="add-ministro-btn" class="btn btn-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Agregar Ministro
          </button>
        </div>

        <div class="ministro-list-container">
          <div class="ministro-list-header">
            <h3>Lista de Ministros de Fe</h3>
            <div class="ministro-filter">
              <select id="filter-status" class="filter-select">
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>
          </div>
          <div id="ministro-list" class="ministro-list"></div>
        </div>
      </div>

      <!-- Modal Agregar/Editar Ministro -->
      <div id="ministro-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <h3 id="modal-title">Agregar Ministro de Fe</h3>
            <button type="button" id="close-modal-btn" class="btn-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <form id="ministro-form" class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label for="ministro-rut">RUT *</label>
                <input type="text" id="ministro-rut" class="input-styled" placeholder="12.345.678-9" required>
              </div>
              <div class="form-group">
                <label for="ministro-specialty">Especialidad</label>
                <select id="ministro-specialty" class="input-styled">
                  <option value="General">General</option>
                  <option value="Juntas de Vecinos">Juntas de Vecinos</option>
                  <option value="Organizaciones Funcionales">Organizaciones Funcionales</option>
                  <option value="Deportivas">Deportivas</option>
                  <option value="Culturales">Culturales</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="ministro-firstName">Nombre *</label>
                <input type="text" id="ministro-firstName" class="input-styled" placeholder="Juan" required>
              </div>
              <div class="form-group">
                <label for="ministro-lastName">Apellido *</label>
                <input type="text" id="ministro-lastName" class="input-styled" placeholder="Pérez González" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="ministro-email">Email *</label>
                <input type="email" id="ministro-email" class="input-styled" placeholder="correo@ejemplo.cl" required>
                <small style="color: #6b7280; font-size: 12px; display: block; margin-top: 4px;">
                  Se usará como usuario para iniciar sesión
                </small>
              </div>
              <div class="form-group">
                <label for="ministro-phone">Teléfono</label>
                <input type="tel" id="ministro-phone" class="input-styled" placeholder="+56 9 1234 5678">
              </div>
            </div>

            <div class="form-group">
              <label for="ministro-address">Dirección</label>
              <input type="text" id="ministro-address" class="input-styled" placeholder="Calle Ejemplo 123, Renca">
            </div>

            <div class="form-group" id="password-group">
              <label for="ministro-password">Contraseña Temporal *</label>
              <div style="position: relative;">
                <input type="password" id="ministro-password" class="input-styled" placeholder="Ingrese contraseña" minlength="6" required>
                <button type="button" id="toggle-password-btn" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #6b7280;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
              <small style="color: #6b7280; font-size: 12px; display: block; margin-top: 4px;">
                El ministro deberá cambiar esta contraseña en su primer inicio de sesión
              </small>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="ministro-active" checked>
                <span>Ministro Activo</span>
              </label>
            </div>

            <div class="modal-footer">
              <button type="button" id="cancel-btn" class="btn btn-secondary">Cancelar</button>
              <button type="submit" id="save-btn" class="btn btn-primary">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.attachEventListeners();
    this.renderList();
  }

  renderList(filter = 'all') {
    let ministros = ministroService.getAll();

    if (filter === 'active') {
      ministros = ministros.filter(m => m.active);
    } else if (filter === 'inactive') {
      ministros = ministros.filter(m => !m.active);
    }

    const container = document.getElementById('ministro-list');

    if (ministros.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <p>No hay ministros registrados</p>
          <button type="button" onclick="window.ministroManagerInstance.openModal()" class="btn btn-primary">
            Agregar Primer Ministro
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = ministros.map(ministro => {
      // Usar _id o id para MongoDB
      const ministroId = ministro._id || ministro.id;
      // Obtener bloqueos del ministro
      const blocks = ministroAvailabilityService.getByMinistroId(ministroId);
      const activeBlocks = blocks.filter(b => b.active);
      const hasBlocks = activeBlocks.length > 0;

      return `
      <div class="ministro-card ${ministro.active ? '' : 'ministro-inactive'}">
        <div class="ministro-avatar">
          ${ministro.firstName?.charAt(0) || ''}${ministro.lastName?.charAt(0) || ''}
        </div>
        <div class="ministro-info">
          <h4>${ministro.firstName} ${ministro.lastName}</h4>
          <div class="ministro-details">
            <span><strong>RUT:</strong> ${ministro.rut}</span>
            <span><strong>Especialidad:</strong> ${ministro.specialty || 'General'}</span>
            ${ministro.email ? `<span><strong>Email:</strong> ${ministro.email}</span>` : ''}
            ${ministro.phone ? `<span><strong>Teléfono:</strong> ${ministro.phone}</span>` : ''}
            ${ministro.address ? `<span><strong>Dirección:</strong> ${ministro.address}</span>` : ''}
          </div>
          ${hasBlocks ? `
            <div style="margin-top: 12px; padding: 12px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <strong style="color: #92400e; font-size: 13px;">⚠️ ${activeBlocks.length} Bloqueo${activeBlocks.length !== 1 ? 's' : ''} de Disponibilidad</strong>
              </div>
              <button type="button" class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px;" onclick="window.ministroManagerInstance.viewBlocks('${ministroId}')">
                Ver Detalles
              </button>
            </div>
          ` : ''}
        </div>
        <div class="ministro-status">
          <span class="status-badge ${ministro.active ? 'status-active' : 'status-inactive'}">
            ${ministro.active ? '✓ Activo' : '⏸ Inactivo'}
          </span>
        </div>
        <div class="ministro-actions">
          <button type="button" class="btn-icon" title="Editar" onclick="window.ministroManagerInstance.editMinistro('${ministroId}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button type="button" class="btn-icon" title="${ministro.active ? 'Desactivar' : 'Activar'}" onclick="window.ministroManagerInstance.toggleActive('${ministroId}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${ministro.active ?
                '<path d="M10 9v6m4-6v6m7-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"></path>' :
                '<path d="M5 3l14 9-14 9V3z"></path>'}
            </svg>
          </button>
          <button type="button" class="btn-delete-ministro" title="Eliminar" onclick="window.ministroManagerInstance.deleteMinistro('${ministroId}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    }).join('');
  }

  attachEventListeners() {
    // Botón agregar ministro
    document.getElementById('add-ministro-btn').addEventListener('click', () => {
      this.openModal();
    });

    // Filtro de estado
    document.getElementById('filter-status').addEventListener('change', (e) => {
      this.renderList(e.target.value);
    });

    // Modal
    document.getElementById('close-modal-btn').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
      this.closeModal();
    });

    // Cerrar modal al hacer click fuera
    document.getElementById('ministro-modal').addEventListener('click', (e) => {
      if (e.target.id === 'ministro-modal') {
        this.closeModal();
      }
    });

    // Formulario
    document.getElementById('ministro-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveMinistro();
    });

    // Formatear RUT mientras se escribe
    document.getElementById('ministro-rut').addEventListener('input', (e) => {
      e.target.value = this.formatRut(e.target.value);
    });

    // Toggle mostrar/ocultar contraseña
    document.getElementById('toggle-password-btn').addEventListener('click', () => {
      const passwordInput = document.getElementById('ministro-password');
      const icon = document.getElementById('toggle-password-btn');
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>`;
      } else {
        passwordInput.type = 'password';
        icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>`;
      }
    });
  }

  openModal(ministroId = null) {
    this.currentMinistro = ministroId;
    const modal = document.getElementById('ministro-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('ministro-form');
    const passwordGroup = document.getElementById('password-group');
    const passwordInput = document.getElementById('ministro-password');

    if (ministroId) {
      const ministro = ministroService.getById(ministroId);
      if (!ministro) return;

      title.textContent = 'Editar Ministro de Fe';
      document.getElementById('ministro-rut').value = ministro.rut;
      document.getElementById('ministro-firstName').value = ministro.firstName;
      document.getElementById('ministro-lastName').value = ministro.lastName;
      document.getElementById('ministro-email').value = ministro.email || '';
      document.getElementById('ministro-phone').value = ministro.phone || '';
      document.getElementById('ministro-address').value = ministro.address || '';
      document.getElementById('ministro-specialty').value = ministro.specialty || 'General';
      document.getElementById('ministro-active').checked = ministro.active;

      // Ocultar campo de contraseña al editar
      passwordGroup.style.display = 'none';
      passwordInput.removeAttribute('required');
    } else {
      title.textContent = 'Agregar Ministro de Fe';
      form.reset();
      document.getElementById('ministro-active').checked = true;

      // Mostrar campo de contraseña al crear
      passwordGroup.style.display = 'block';
      passwordInput.setAttribute('required', 'required');
      passwordInput.value = '';
    }

    modal.style.display = 'flex';
  }

  closeModal() {
    document.getElementById('ministro-modal').style.display = 'none';
    document.getElementById('ministro-form').reset();
    this.currentMinistro = null;
  }

  async saveMinistro() {
    const email = document.getElementById('ministro-email').value.trim();
    const password = document.getElementById('ministro-password').value;

    const data = {
      rut: document.getElementById('ministro-rut').value.trim(),
      firstName: document.getElementById('ministro-firstName').value.trim(),
      lastName: document.getElementById('ministro-lastName').value.trim(),
      email: email,
      phone: document.getElementById('ministro-phone').value.trim(),
      address: document.getElementById('ministro-address').value.trim(),
      specialty: document.getElementById('ministro-specialty').value,
      active: document.getElementById('ministro-active').checked
    };

    // Solo incluir contraseña al crear (no al editar)
    if (!this.currentMinistro && password) {
      data.password = password;
    }

    try {
      if (this.currentMinistro) {
        await ministroService.update(this.currentMinistro, data);
        showToast('Ministro actualizado correctamente', 'success');
        this.closeModal();
      } else {
        const result = await ministroService.create(data);
        this.closeModal();

        // Mostrar credenciales con el email y contraseña ingresados
        this.showCredentialsModal({
          email: email,
          password: password,
          firstName: data.firstName,
          lastName: data.lastName
        });
      }

      this.renderList(document.getElementById('filter-status').value);
    } catch (error) {
      showToast(error.message || 'Error al guardar ministro', 'error');
    }
  }

  showCredentialsModal(ministro) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header" style="background: #10b981; color: white; padding: 24px; border-radius: 12px 12px 0 0;">
          <h3 style="margin: 0; color: white;">✅ Ministro Creado Exitosamente</h3>
          <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
            ${ministro.firstName} ${ministro.lastName}
          </p>
        </div>
        <div class="modal-body" style="padding: 32px;">
          <div style="background: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 16px 0; font-size: 14px; color: #15803d; font-weight: 600;">
              📋 Credenciales de acceso:
            </p>
            <div style="background: white; padding: 16px; border-radius: 8px; font-family: monospace;">
              <div style="margin-bottom: 12px;">
                <strong style="color: #374151;">Email:</strong><br>
                <span style="color: #1f2937; font-size: 15px;">${ministro.email}</span>
              </div>
              <div>
                <strong style="color: #374151;">Contraseña:</strong><br>
                <span style="color: #dc2626; font-size: 18px; font-weight: 700;">${ministro.password}</span>
              </div>
            </div>
          </div>

          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
              <strong>⚠️ Importante:</strong><br>
              El Ministro de Fe deberá cambiar su contraseña en el primer inicio de sesión.
            </p>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
              Cerrar
            </button>
            <button type="button" class="btn btn-primary" id="copy-credentials-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copiar Credenciales
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listener para copiar (guardar valores en closure)
    const emailToCopy = ministro.email;
    const passwordToCopy = ministro.password;

    modal.querySelector('#copy-credentials-btn').addEventListener('click', function() {
      const text = `Email: ${emailToCopy}\nContraseña: ${passwordToCopy}`;
      navigator.clipboard.writeText(text);
      this.textContent = '✓ Copiado';
      setTimeout(() => {
        this.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copiar Credenciales';
      }, 2000);
    });
  }

  editMinistro(id) {
    this.openModal(id);
  }

  async toggleActive(id) {
    try {
      await ministroService.toggleActive(id);
      showToast('Estado actualizado', 'success');
      this.renderList(document.getElementById('filter-status').value);
    } catch (error) {
      showToast(error.message || 'Error al cambiar estado', 'error');
    }
  }

  async deleteMinistro(id) {
    const ministro = ministroService.getById(id);
    if (!ministro) return;

    const confirmed = confirm(`¿Estás seguro de que deseas eliminar a ${ministro.firstName} ${ministro.lastName}?\n\nEsta acción no se puede deshacer.`);
    if (!confirmed) return;

    try {
      await ministroService.delete(id);
      showToast('Ministro eliminado correctamente', 'success');
      this.renderList(document.getElementById('filter-status').value);
    } catch (error) {
      showToast(error.message || 'Error al eliminar ministro', 'error');
    }
  }

  viewBlocks(ministroId) {
    const ministro = ministroService.getById(ministroId);
    if (!ministro) return;

    const blocks = ministroAvailabilityService.getByMinistroId(ministroId).filter(b => b.active);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 700px;">
        <div class="modal-header" style="background: #fef3c7; border-bottom: 2px solid #f59e0b;">
          <h3 style="margin: 0; color: #78350f;">⚠️ Bloqueos de Disponibilidad</h3>
          <p style="margin: 4px 0 0; color: #92400e; font-size: 14px;">${ministro.firstName} ${ministro.lastName}</p>
          <button type="button" class="btn-icon" onclick="this.closest('.modal-overlay').remove()" style="position: absolute; right: 24px; top: 24px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
          ${blocks.length === 0 ? `
            <div style="text-align: center; padding: 40px 20px; color: #6b7280;">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 16px;">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
              </svg>
              <p>Este ministro no tiene bloqueos de disponibilidad</p>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 16px;">
              ${blocks.sort((a, b) => new Date(a.date) - new Date(b.date)).map(block => {
                const date = new Date(block.date + 'T12:00:00');
                const formattedDate = date.toLocaleDateString('es-CL', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });

                return `
                  <div style="border: 2px solid #e5e7eb; border-radius: 12px; padding: 16px; background: white;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                      <div style="flex: 1;">
                        <h4 style="margin: 0 0 8px 0; color: #1f2937; font-size: 15px;">
                          📅 ${formattedDate}
                        </h4>
                        ${!block.time ? `
                          <span style="
                            display: inline-block;
                            padding: 4px 12px;
                            background: #fee2e2;
                            color: #991b1b;
                            border-radius: 6px;
                            font-size: 13px;
                            font-weight: 600;
                          ">
                            ⛔ Día Completo
                          </span>
                        ` : `
                          <span style="
                            display: inline-block;
                            padding: 4px 12px;
                            background: #fef3c7;
                            color: #92400e;
                            border-radius: 6px;
                            font-size: 13px;
                            font-weight: 600;
                          ">
                            🕐 ${block.time}
                          </span>
                        `}
                        ${block.reason ? `
                          <p style="margin: 12px 0 0 0; color: #6b7280; font-size: 14px; font-style: italic;">
                            "${block.reason}"
                          </p>
                        ` : ''}
                      </div>
                    </div>
                    <div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">
                      Creado: ${new Date(block.createdAt).toLocaleDateString('es-CL')} ${new Date(block.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
        <div style="padding: 20px; background: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
            Cerrar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  formatRut(rut) {
    // Eliminar formato previo
    rut = rut.replace(/\./g, '').replace(/-/g, '');

    if (rut.length < 2) return rut;

    const body = rut.slice(0, -1);
    const digit = rut.slice(-1);

    // Agregar puntos cada 3 dígitos
    const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `${formattedBody}-${digit}`;
  }
}

// Instancia global para acceder desde event listeners inline
export let ministroManager;

export function initMinistroManager(container) {
  ministroManager = new MinistroManager(container);
  ministroManager.render();
  window.ministroManagerInstance = ministroManager; // Para acceso global
  return ministroManager;
}
