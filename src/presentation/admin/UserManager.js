/**
 * User Manager - Panel de Gestion de Usuarios
 * Permite al administrador gestionar usuarios del sistema
 */

import { apiService } from '../../services/ApiService.js';
import { showToast } from '../../app.js';

// Colores por rol
const ROLE_COLORS = {
  ORGANIZADOR: '#3b82f6',
  MUNICIPALIDAD: '#8b5cf6',
  MINISTRO_FE: '#f59e0b',
  MIEMBRO: '#22c55e'
};

const ROLE_LABELS = {
  ORGANIZADOR: 'Organizador',
  MUNICIPALIDAD: 'Municipalidad',
  MINISTRO_FE: 'Ministro de Fe',
  MIEMBRO: 'Miembro'
};

let userManagerInstance = null;

export class UserManager {
  constructor(container) {
    this.container = container;
    this.users = [];
    this.ministros = [];
    this.allUsers = [];
    this.currentFilter = 'all';
    this.currentEditUser = null;
    this.stats = { total: 0, active: 0, inactive: 0, byRole: {} };
  }

  render() {
    this.container.innerHTML = `
      <div style="padding: 24px; max-width: 1200px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2 style="margin: 0; font-size: 24px; font-weight: 700; color: #1e293b;">Gestion de Usuarios</h2>
            <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">Administra los usuarios registrados en el sistema</p>
          </div>
          <button type="button" id="um-new-user-btn" style="
            display: inline-flex; align-items: center; gap: 8px;
            padding: 10px 20px; background: #3b82f6; color: white;
            border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
            cursor: pointer; transition: background 0.2s;
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nuevo Usuario Admin
          </button>
        </div>

        <!-- Stats Bar -->
        <div id="um-stats-bar" style="
          display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px; margin-bottom: 24px;
        "></div>

        <!-- Filter Tabs -->
        <div style="
          display: flex; gap: 4px; margin-bottom: 20px; background: #f1f5f9;
          border-radius: 10px; padding: 4px; flex-wrap: wrap;
        ">
          <button type="button" class="um-filter-tab" data-filter="all" style="
            padding: 8px 16px; border: none; border-radius: 8px;
            font-size: 13px; font-weight: 500; cursor: pointer;
            background: white; color: #1e293b; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            transition: all 0.2s;
          ">Todos</button>
          <button type="button" class="um-filter-tab" data-filter="ORGANIZADOR" style="
            padding: 8px 16px; border: none; border-radius: 8px;
            font-size: 13px; font-weight: 500; cursor: pointer;
            background: transparent; color: #64748b;
            transition: all 0.2s;
          ">Organizadores</button>
          <button type="button" class="um-filter-tab" data-filter="MUNICIPALIDAD" style="
            padding: 8px 16px; border: none; border-radius: 8px;
            font-size: 13px; font-weight: 500; cursor: pointer;
            background: transparent; color: #64748b;
            transition: all 0.2s;
          ">Municipalidad</button>
          <button type="button" class="um-filter-tab" data-filter="MINISTRO_FE" style="
            padding: 8px 16px; border: none; border-radius: 8px;
            font-size: 13px; font-weight: 500; cursor: pointer;
            background: transparent; color: #64748b;
            transition: all 0.2s;
          ">Ministros</button>
          <button type="button" class="um-filter-tab" data-filter="MIEMBRO" style="
            padding: 8px 16px; border: none; border-radius: 8px;
            font-size: 13px; font-weight: 500; cursor: pointer;
            background: transparent; color: #64748b;
            transition: all 0.2s;
          ">Miembros</button>
        </div>

        <!-- Table Container -->
        <div style="
          background: white; border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
          overflow: hidden;
        ">
          <div id="um-table-container" style="overflow-x: auto;">
            <div style="padding: 40px; text-align: center; color: #94a3b8;">
              Cargando usuarios...
            </div>
          </div>
        </div>
      </div>

      <!-- Create/Edit Modal -->
      <div id="um-modal" style="
        display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); z-index: 1000;
        justify-content: center; align-items: center; padding: 20px;
      ">
        <div style="
          background: white; border-radius: 16px; width: 100%; max-width: 560px;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 25px 50px rgba(0,0,0,0.25);
        ">
          <div style="
            display: flex; justify-content: space-between; align-items: center;
            padding: 20px 24px; border-bottom: 1px solid #e2e8f0;
          ">
            <h3 id="um-modal-title" style="margin: 0; font-size: 18px; font-weight: 600; color: #1e293b;">Nuevo Usuario</h3>
            <button type="button" id="um-modal-close" style="
              background: none; border: none; cursor: pointer; color: #94a3b8;
              padding: 4px; border-radius: 6px; transition: color 0.2s;
            ">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <form id="um-user-form" style="padding: 24px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Nombre *</label>
                <input type="text" id="um-firstName" required style="
                  width: 100%; padding: 10px 12px; border: 1px solid #d1d5db;
                  border-radius: 8px; font-size: 14px; box-sizing: border-box;
                  transition: border-color 0.2s; outline: none;
                " placeholder="Juan">
              </div>
              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Apellido *</label>
                <input type="text" id="um-lastName" required style="
                  width: 100%; padding: 10px 12px; border: 1px solid #d1d5db;
                  border-radius: 8px; font-size: 14px; box-sizing: border-box;
                  transition: border-color 0.2s; outline: none;
                " placeholder="Perez">
              </div>
            </div>

            <div style="margin-top: 16px;">
              <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Email *</label>
              <input type="email" id="um-email" required style="
                width: 100%; padding: 10px 12px; border: 1px solid #d1d5db;
                border-radius: 8px; font-size: 14px; box-sizing: border-box;
                transition: border-color 0.2s; outline: none;
              " placeholder="correo@ejemplo.cl">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">RUT</label>
                <input type="text" id="um-rut" style="
                  width: 100%; padding: 10px 12px; border: 1px solid #d1d5db;
                  border-radius: 8px; font-size: 14px; box-sizing: border-box;
                  transition: border-color 0.2s; outline: none;
                " placeholder="12.345.678-9">
              </div>
              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Telefono</label>
                <input type="tel" id="um-phone" style="
                  width: 100%; padding: 10px 12px; border: 1px solid #d1d5db;
                  border-radius: 8px; font-size: 14px; box-sizing: border-box;
                  transition: border-color 0.2s; outline: none;
                " placeholder="+56 9 1234 5678">
              </div>
            </div>

            <div style="margin-top: 16px;">
              <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Rol *</label>
              <select id="um-role" required style="
                width: 100%; padding: 10px 12px; border: 1px solid #d1d5db;
                border-radius: 8px; font-size: 14px; box-sizing: border-box;
                background: white; transition: border-color 0.2s; outline: none;
              ">
                <option value="">Seleccionar rol...</option>
                <option value="ORGANIZADOR">Organizador</option>
                <option value="MUNICIPALIDAD">Municipalidad</option>
                <option value="MINISTRO_FE">Ministro de Fe</option>
                <option value="MIEMBRO">Miembro</option>
              </select>
            </div>

            <div id="um-password-group" style="margin-top: 16px;">
              <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Contrasena *</label>
              <input type="password" id="um-password" style="
                width: 100%; padding: 10px 12px; border: 1px solid #d1d5db;
                border-radius: 8px; font-size: 14px; box-sizing: border-box;
                transition: border-color 0.2s; outline: none;
              " placeholder="Minimo 6 caracteres" minlength="6">
              <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">El usuario debera cambiar esta contrasena en su primer inicio de sesion</p>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <button type="button" id="um-cancel-btn" style="
                padding: 10px 20px; background: #f1f5f9; color: #475569;
                border: none; border-radius: 8px; font-size: 14px; font-weight: 500;
                cursor: pointer; transition: background 0.2s;
              ">Cancelar</button>
              <button type="submit" id="um-save-btn" style="
                padding: 10px 20px; background: #3b82f6; color: white;
                border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
                cursor: pointer; transition: background 0.2s;
              ">Guardar</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div id="um-delete-modal" style="
        display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); z-index: 1001;
        justify-content: center; align-items: center; padding: 20px;
      ">
        <div style="
          background: white; border-radius: 16px; width: 100%; max-width: 420px;
          box-shadow: 0 25px 50px rgba(0,0,0,0.25); padding: 24px;
        ">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="
              width: 48px; height: 48px; border-radius: 50%;
              background: #fef2f2; display: inline-flex;
              align-items: center; justify-content: center; margin-bottom: 12px;
            ">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                <path d="M3 6h18"></path>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>
            <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #1e293b;">Eliminar Usuario</h3>
            <p id="um-delete-msg" style="margin: 0; color: #64748b; font-size: 14px;">Esta seguro de eliminar este usuario? Esta accion no se puede deshacer.</p>
          </div>
          <div style="display: flex; gap: 12px;">
            <button type="button" id="um-delete-cancel" style="
              flex: 1; padding: 10px; background: #f1f5f9; color: #475569;
              border: none; border-radius: 8px; font-size: 14px; font-weight: 500;
              cursor: pointer;
            ">Cancelar</button>
            <button type="button" id="um-delete-confirm" style="
              flex: 1; padding: 10px; background: #ef4444; color: white;
              border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
              cursor: pointer;
            ">Eliminar</button>
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
    this.loadUsers();
  }

  async loadUsers() {
    try {
      // Load both regular users and ministros in parallel
      const [usersResponse, ministrosResponse] = await Promise.all([
        apiService.get('/users').catch(() => []),
        apiService.get('/ministros').catch(() => [])
      ]);

      this.users = Array.isArray(usersResponse) ? usersResponse : [];
      this.ministros = Array.isArray(ministrosResponse) ? ministrosResponse : [];

      // Normalize ministros to have the same shape as users
      const normalizedMinistros = this.ministros.map(m => ({
        _id: m._id || m.id,
        firstName: m.firstName || '',
        lastName: m.lastName || '',
        email: m.email || '',
        rut: m.rut || '',
        phone: m.phone || '',
        role: 'MINISTRO_FE',
        active: m.active !== false,
        createdAt: m.createdAt || null,
        _isMinistro: true
      }));

      // Combine all users
      this.allUsers = [...this.users, ...normalizedMinistros];

      this.updateStats();
      this.renderTable(this.allUsers, this.currentFilter);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      showToast('Error al cargar usuarios', 'error');
      this.renderTable([], 'all');
    }
  }

  updateStats() {
    const total = this.allUsers.length;
    const active = this.allUsers.filter(u => u.active !== false).length;
    const inactive = total - active;
    const byRole = {};

    Object.keys(ROLE_LABELS).forEach(role => {
      byRole[role] = this.allUsers.filter(u => u.role === role).length;
    });

    this.stats = { total, active, inactive, byRole };
    this.renderStatsBar();
  }

  renderStatsBar() {
    const statsBar = this.container.querySelector('#um-stats-bar');
    if (!statsBar) return;

    const statCards = [
      { label: 'Total Usuarios', value: this.stats.total, color: '#1e293b', bg: '#f8fafc' },
      { label: 'Activos', value: this.stats.active, color: '#16a34a', bg: '#f0fdf4' },
      { label: 'Inactivos', value: this.stats.inactive, color: '#dc2626', bg: '#fef2f2' },
      ...Object.entries(this.stats.byRole).map(([role, count]) => ({
        label: ROLE_LABELS[role] || role,
        value: count,
        color: ROLE_COLORS[role] || '#6b7280',
        bg: `${ROLE_COLORS[role] || '#6b7280'}10`
      }))
    ];

    statsBar.innerHTML = statCards.map(card => `
      <div style="
        background: ${card.bg}; border-radius: 10px; padding: 16px;
        border: 1px solid ${card.color}15;
      ">
        <div style="font-size: 12px; font-weight: 500; color: ${card.color}; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px;">${card.label}</div>
        <div style="font-size: 28px; font-weight: 700; color: ${card.color}; margin-top: 4px;">${card.value}</div>
      </div>
    `).join('');
  }

  renderTable(users, filter) {
    const tableContainer = this.container.querySelector('#um-table-container');
    if (!tableContainer) return;

    let filteredUsers = users;
    if (filter && filter !== 'all') {
      filteredUsers = users.filter(u => u.role === filter);
    }

    if (filteredUsers.length === 0) {
      tableContainer.innerHTML = `
        <div style="padding: 60px 20px; text-align: center;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin: 0 auto 16px;">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <p style="color: #94a3b8; font-size: 15px; margin: 0;">No se encontraron usuarios${filter !== 'all' ? ' con este filtro' : ''}</p>
        </div>
      `;
      return;
    }

    tableContainer.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Nombre</th>
            <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Email</th>
            <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Rol</th>
            <th style="padding: 12px 16px; text-align: center; font-weight: 600; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Estado</th>
            <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Fecha Registro</th>
            <th style="padding: 12px 16px; text-align: center; font-weight: 600; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${filteredUsers.map(user => this._renderUserRow(user)).join('')}
        </tbody>
      </table>
    `;

    // Attach row action listeners
    this._attachRowListeners();
  }

  _renderUserRow(user) {
    const id = user._id || user.id;
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Sin nombre';
    const email = user.email || '-';
    const role = user.role || 'ORGANIZADOR';
    const roleColor = ROLE_COLORS[role] || '#6b7280';
    const roleLabel = ROLE_LABELS[role] || role;
    const isActive = user.active !== false;
    const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

    return `
      <tr data-user-id="${id}" style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
        <td style="padding: 12px 16px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="
              width: 36px; height: 36px; border-radius: 50%;
              background: ${roleColor}15; color: ${roleColor};
              display: flex; align-items: center; justify-content: center;
              font-weight: 600; font-size: 14px; flex-shrink: 0;
            ">${(user.firstName || '?')[0].toUpperCase()}</div>
            <div>
              <div style="font-weight: 500; color: #1e293b;">${name}</div>
              ${user.rut ? `<div style="font-size: 12px; color: #94a3b8;">${user.rut}</div>` : ''}
            </div>
          </div>
        </td>
        <td style="padding: 12px 16px; color: #475569;">${email}</td>
        <td style="padding: 12px 16px;">
          <span style="
            display: inline-block; padding: 4px 10px; border-radius: 20px;
            font-size: 12px; font-weight: 600;
            background: ${roleColor}15; color: ${roleColor};
          ">${roleLabel}</span>
        </td>
        <td style="padding: 12px 16px; text-align: center;">
          <span style="
            display: inline-flex; align-items: center; gap: 6px;
            padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500;
            background: ${isActive ? '#f0fdf4' : '#fef2f2'};
            color: ${isActive ? '#16a34a' : '#dc2626'};
          ">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${isActive ? '#16a34a' : '#dc2626'};"></span>
            ${isActive ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td style="padding: 12px 16px; color: #64748b; font-size: 13px;">${createdAt}</td>
        <td style="padding: 12px 16px; text-align: center;">
          <div style="display: flex; gap: 4px; justify-content: center;">
            <button type="button" class="um-toggle-btn" data-id="${id}" data-active="${isActive}" title="${isActive ? 'Desactivar' : 'Activar'}" style="
              padding: 6px; background: ${isActive ? '#fef2f2' : '#f0fdf4'};
              border: none; border-radius: 6px; cursor: pointer;
              color: ${isActive ? '#dc2626' : '#16a34a'}; transition: opacity 0.2s;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${isActive
                  ? '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line>'
                  : '<path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>'}
              </svg>
            </button>
            <button type="button" class="um-edit-btn" data-id="${id}" title="Editar" style="
              padding: 6px; background: #eff6ff; border: none; border-radius: 6px;
              cursor: pointer; color: #3b82f6; transition: opacity 0.2s;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button type="button" class="um-delete-btn" data-id="${id}" data-name="${name}" title="Eliminar" style="
              padding: 6px; background: #fef2f2; border: none; border-radius: 6px;
              cursor: pointer; color: #ef4444; transition: opacity 0.2s;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18"></path>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  _attachRowListeners() {
    // Toggle active buttons
    this.container.querySelectorAll('.um-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.toggleActive(id);
      });
    });

    // Edit buttons
    this.container.querySelectorAll('.um-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const user = this.allUsers.find(u => (u._id || u.id) === id);
        if (user) this.openModal(user);
      });
    });

    // Delete buttons
    this.container.querySelectorAll('.um-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        this._showDeleteConfirmation(id, name);
      });
    });
  }

  openModal(user = null) {
    this.currentEditUser = user;
    const modal = this.container.querySelector('#um-modal');
    const title = this.container.querySelector('#um-modal-title');
    const passwordGroup = this.container.querySelector('#um-password-group');
    const passwordInput = this.container.querySelector('#um-password');

    if (!modal) return;

    if (user) {
      title.textContent = 'Editar Usuario';
      this.container.querySelector('#um-firstName').value = user.firstName || '';
      this.container.querySelector('#um-lastName').value = user.lastName || '';
      this.container.querySelector('#um-email').value = user.email || '';
      this.container.querySelector('#um-rut').value = user.rut || '';
      this.container.querySelector('#um-phone').value = user.phone || '';
      this.container.querySelector('#um-role').value = user.role || 'ORGANIZADOR';
      passwordGroup.style.display = 'none';
      passwordInput.removeAttribute('required');
    } else {
      title.textContent = 'Nuevo Usuario Admin';
      this.container.querySelector('#um-user-form').reset();
      passwordGroup.style.display = 'block';
      passwordInput.setAttribute('required', 'required');
    }

    modal.style.display = 'flex';
  }

  _closeModal() {
    const modal = this.container.querySelector('#um-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    this.currentEditUser = null;
  }

  async saveUser() {
    const firstName = this.container.querySelector('#um-firstName').value.trim();
    const lastName = this.container.querySelector('#um-lastName').value.trim();
    const email = this.container.querySelector('#um-email').value.trim();
    const rut = this.container.querySelector('#um-rut').value.trim();
    const phone = this.container.querySelector('#um-phone').value.trim();
    const role = this.container.querySelector('#um-role').value;
    const password = this.container.querySelector('#um-password').value;

    if (!firstName || !lastName || !email || !role) {
      showToast('Complete todos los campos obligatorios', 'error');
      return;
    }

    const saveBtn = this.container.querySelector('#um-save-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando...';
    }

    try {
      if (this.currentEditUser) {
        // Update existing user
        const id = this.currentEditUser._id || this.currentEditUser.id;
        const updates = { firstName, lastName, email, rut, phone, role };

        if (this.currentEditUser._isMinistro) {
          await apiService.put(`/ministros/${id}`, updates);
        } else {
          await apiService.put(`/users/${id}`, updates);
        }

        showToast('Usuario actualizado correctamente', 'success');
      } else {
        // Create new user
        if (!password || password.length < 6) {
          showToast('La contrasena debe tener al menos 6 caracteres', 'error');
          return;
        }

        const userData = { firstName, lastName, email, rut, phone, role, password };
        await apiService.post('/auth/register', userData);
        showToast('Usuario creado correctamente', 'success');
      }

      this._closeModal();
      await this.loadUsers();
    } catch (error) {
      console.error('Error guardando usuario:', error);
      showToast(error.message || 'Error al guardar usuario', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';
      }
    }
  }

  async toggleActive(id) {
    const user = this.allUsers.find(u => (u._id || u.id) === id);
    if (!user) return;

    try {
      if (user._isMinistro) {
        await apiService.post(`/ministros/${id}/toggle-active`);
      } else {
        await apiService.post(`/users/${id}/toggle-active`);
      }

      showToast(`Usuario ${user.active !== false ? 'desactivado' : 'activado'} correctamente`, 'success');
      await this.loadUsers();
    } catch (error) {
      console.error('Error cambiando estado:', error);
      showToast(error.message || 'Error al cambiar estado del usuario', 'error');
    }
  }

  _showDeleteConfirmation(id, name) {
    this._pendingDeleteId = id;
    const deleteModal = this.container.querySelector('#um-delete-modal');
    const deleteMsg = this.container.querySelector('#um-delete-msg');

    if (deleteModal) {
      deleteMsg.textContent = `Esta seguro de eliminar a "${name}"? Esta accion no se puede deshacer.`;
      deleteModal.style.display = 'flex';
    }
  }

  _closeDeleteModal() {
    const deleteModal = this.container.querySelector('#um-delete-modal');
    if (deleteModal) {
      deleteModal.style.display = 'none';
    }
    this._pendingDeleteId = null;
  }

  async deleteUser(id) {
    const user = this.allUsers.find(u => (u._id || u.id) === id);
    if (!user) return;

    try {
      if (user._isMinistro) {
        await apiService.delete(`/ministros/${id}`);
      } else {
        await apiService.delete(`/users/${id}`);
      }

      showToast('Usuario eliminado correctamente', 'success');
      this._closeDeleteModal();
      await this.loadUsers();
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      showToast(error.message || 'Error al eliminar usuario', 'error');
    }
  }

  setupEventListeners() {
    // New user button
    const newBtn = this.container.querySelector('#um-new-user-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => this.openModal(null));
    }

    // Filter tabs
    this.container.querySelectorAll('.um-filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.currentFilter = tab.dataset.filter;

        // Update tab styles
        this.container.querySelectorAll('.um-filter-tab').forEach(t => {
          if (t.dataset.filter === this.currentFilter) {
            t.style.background = 'white';
            t.style.color = '#1e293b';
            t.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
          } else {
            t.style.background = 'transparent';
            t.style.color = '#64748b';
            t.style.boxShadow = 'none';
          }
        });

        this.renderTable(this.allUsers, this.currentFilter);
      });
    });

    // Modal close button
    const closeBtn = this.container.querySelector('#um-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this._closeModal());
    }

    // Modal cancel button
    const cancelBtn = this.container.querySelector('#um-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this._closeModal());
    }

    // Modal overlay click to close
    const modal = this.container.querySelector('#um-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this._closeModal();
      });
    }

    // Form submit
    const form = this.container.querySelector('#um-user-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveUser();
      });
    }

    // Delete confirmation
    const deleteConfirm = this.container.querySelector('#um-delete-confirm');
    if (deleteConfirm) {
      deleteConfirm.addEventListener('click', () => {
        if (this._pendingDeleteId) {
          this.deleteUser(this._pendingDeleteId);
        }
      });
    }

    // Delete cancel
    const deleteCancel = this.container.querySelector('#um-delete-cancel');
    if (deleteCancel) {
      deleteCancel.addEventListener('click', () => this._closeDeleteModal());
    }

    // Delete modal overlay click
    const deleteModal = this.container.querySelector('#um-delete-modal');
    if (deleteModal) {
      deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) this._closeDeleteModal();
      });
    }

    // Hover effect on new user button
    if (newBtn) {
      newBtn.addEventListener('mouseover', () => { newBtn.style.background = '#2563eb'; });
      newBtn.addEventListener('mouseout', () => { newBtn.style.background = '#3b82f6'; });
    }
  }
}

export function initUserManager(container) {
  userManagerInstance = new UserManager(container);
  userManagerInstance.render();
  window.userManagerInstance = userManagerInstance;
  return userManagerInstance;
}
