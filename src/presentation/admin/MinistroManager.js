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
                Min. 6 caracteres, al menos una mayuscula. Se debera cambiar en el primer inicio de sesion.
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
      let msg = error.message || 'Error al guardar ministro';
      if (error.details && error.details.length > 0) {
        msg = error.details.map(d => `${d.field}: ${d.message}`).join(', ');
      }
      showToast(msg, 'error');
    }
  }

  showCredentialsModal(ministro) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 480px; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.15);">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); padding: 28px 24px; position: relative;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div>
              <h3 style="margin: 0; color: white; font-size: 18px; font-weight: 700;">Ministro Creado</h3>
              <p style="margin: 4px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
                ${ministro.firstName} ${ministro.lastName}
              </p>
            </div>
          </div>
        </div>
        <div style="padding: 24px;">
          <p style="margin: 0 0 16px; font-size: 13px; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em;">Credenciales de acceso</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <div style="margin-bottom: 16px;">
              <span style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;">Email</span>
              <p style="margin: 4px 0 0; font-size: 15px; color: #1e293b; font-family: 'SF Mono', 'Fira Code', monospace; word-break: break-all;">${ministro.email}</p>
            </div>
            <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
              <span style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;">Contrasena temporal</span>
              <p style="margin: 4px 0 0; font-size: 18px; color: #1e40af; font-weight: 700; font-family: 'SF Mono', 'Fira Code', monospace; letter-spacing: 0.02em;">${ministro.password}</p>
            </div>
          </div>

          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 16px; margin-bottom: 24px; display: flex; gap: 10px; align-items: flex-start;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" style="flex-shrink: 0; margin-top: 1px;">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
              El Ministro de Fe debera cambiar su contrasena en el primer inicio de sesion.
            </p>
          </div>

          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button type="button" style="padding: 10px 20px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;" onclick="this.closest('.modal-overlay').remove()">
              Cerrar
            </button>
            <button type="button" id="copy-credentials-btn" style="padding: 10px 20px; background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
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

    const emailToCopy = ministro.email;
    const passwordToCopy = ministro.password;

    modal.querySelector('#copy-credentials-btn').addEventListener('click', function() {
      const text = `Email: ${emailToCopy}\nContrasena: ${passwordToCopy}`;
      navigator.clipboard.writeText(text);
      this.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copiado';
      this.style.background = '#10b981';
      setTimeout(() => {
        this.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copiar Credenciales';
        this.style.background = 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)';
      }, 2000);
    });

    // Cerrar al click en overlay
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
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

  async viewBlocks(ministroId) {
    const ministro = ministroService.getById(ministroId);
    if (!ministro) return;

    // Cargar bloques desde backend antes de mostrar
    try {
      await ministroAvailabilityService.loadFromBackend(ministroId);
    } catch (error) {
      console.warn('Error cargando bloques del backend:', error.message);
    }

    const blocks = ministroAvailabilityService.getByMinistroId(ministroId).filter(b => b.active);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.15);">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); padding: 24px; position: relative;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <div>
              <h3 style="margin: 0; color: white; font-size: 17px; font-weight: 700;">Bloqueos de Disponibilidad</h3>
              <p style="margin: 4px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">${ministro.firstName} ${ministro.lastName}</p>
            </div>
          </div>
          <button type="button" onclick="this.closest('.modal-overlay').remove()" style="position: absolute; right: 16px; top: 16px; background: rgba(255,255,255,0.15); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div style="max-height: 60vh; overflow-y: auto; padding: 20px;">
          ${blocks.length === 0 ? `
            <div style="text-align: center; padding: 40px 20px; color: #94a3b8;">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin: 0 auto 16px; display: block;">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
              </svg>
              <p style="margin: 0; font-size: 15px; color: #64748b;">Este ministro no tiene bloqueos de disponibilidad</p>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${blocks.sort((a, b) => new Date(a.date) - new Date(b.date)).map(block => {
                const date = new Date(block.date + 'T12:00:00');
                const formattedDate = date.toLocaleDateString('es-CL', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });

                return `
                  <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background: #f8fafc;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                      <div style="flex: 1;">
                        <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">
                          ${formattedDate}
                        </h4>
                        ${!block.time ? `
                          <span style="display: inline-block; padding: 4px 10px; background: #fee2e2; color: #991b1b; border-radius: 6px; font-size: 12px; font-weight: 600;">
                            Dia Completo
                          </span>
                        ` : `
                          <span style="display: inline-block; padding: 4px 10px; background: #dbeafe; color: #1e40af; border-radius: 6px; font-size: 12px; font-weight: 600;">
                            ${block.time}
                          </span>
                        `}
                        ${block.reason ? `
                          <p style="margin: 10px 0 0 0; color: #64748b; font-size: 13px; font-style: italic;">
                            "${block.reason}"
                          </p>
                        ` : ''}
                      </div>
                    </div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                      Creado: ${new Date(block.createdAt).toLocaleDateString('es-CL')} ${new Date(block.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
        <div style="padding: 16px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end;">
          <button type="button" style="padding: 10px 20px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;" onclick="this.closest('.modal-overlay').remove()">
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
