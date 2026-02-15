/**
 * AuditLogManager - Visor de historial de actividad para el panel de administracion
 * Permite visualizar, filtrar y exportar el registro de auditoria del sistema
 */

import { dashboardService } from '../../services/DashboardService.js';
import { showToast } from '../../app.js';

const ACTION_LABELS = {
  CREATE: 'Crear',
  UPDATE: 'Actualizar',
  DELETE: 'Eliminar',
  STATUS_CHANGE: 'Cambio Estado',
  LOGIN: 'Inicio Sesion',
  LOGOUT: 'Cierre Sesion',
  ASSIGN: 'Asignar',
  APPROVE: 'Aprobar',
  REJECT: 'Rechazar',
  UPLOAD: 'Subir',
  DOWNLOAD: 'Descargar',
  EXPORT: 'Exportar'
};

const RESOURCE_LABELS = {
  ORGANIZATION: 'Organizacion',
  USER: 'Usuario',
  MINISTRO: 'Ministro',
  ASSIGNMENT: 'Asignacion',
  NEWS: 'Noticia',
  DOCUMENT: 'Documento',
  ESTATUTO: 'Estatuto',
  UNIDAD_VECINAL: 'Unidad Vecinal',
  NOTIFICATION: 'Notificacion',
  GUIA: 'Guia',
  LIBRARY_DOCUMENT: 'Doc. Biblioteca',
  SYSTEM: 'Sistema'
};

const PAGE_SIZE = 20;

export class AuditLogManager {
  constructor(container) {
    this.container = container;
    this.filters = {
      action: '',
      resource: '',
      startDate: '',
      endDate: '',
      search: ''
    };
    this.currentPage = 1;
    this.totalPages = 1;
    this.totalRecords = 0;
    this.logs = [];
  }

  render() {
    this.container.innerHTML = `
      <style>
        .audit-log-manager {
          padding: 0;
          max-width: 100%;
        }

        .audit-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .audit-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .audit-header-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }

        .audit-header-text h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          color: #1f2937;
        }

        .audit-header-text p {
          margin: 4px 0 0;
          font-size: 14px;
          color: #6b7280;
        }

        .btn-export-csv {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-export-csv:hover {
          background: #2563eb;
        }

        .btn-export-csv:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        /* Filters */
        .audit-filters {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          border: 1px solid #e5e7eb;
        }

        .audit-filters-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: flex-end;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 160px;
        }

        .filter-group label {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .filter-group select,
        .filter-group input {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          color: #374151;
          background: white;
          transition: border-color 0.2s;
          height: 38px;
        }

        .filter-group select:focus,
        .filter-group input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .filter-actions {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          flex-shrink: 0;
        }

        .btn-filter {
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          height: 38px;
          white-space: nowrap;
        }

        .btn-filter-apply {
          background: #2563eb;
          color: white;
        }

        .btn-filter-apply:hover {
          background: #2563eb;
        }

        .btn-filter-clear {
          background: #f3f4f6;
          color: #6b7280;
          border: 1px solid #d1d5db;
        }

        .btn-filter-clear:hover {
          background: #e5e7eb;
          color: #374151;
        }

        /* Table */
        .audit-table-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          border: 1px solid #e5e7eb;
          overflow: hidden;
        }

        .audit-table-wrapper {
          overflow-x: auto;
        }

        .audit-table {
          width: 100%;
          border-collapse: collapse;
        }

        .audit-table thead th {
          background: #f9fafb;
          padding: 12px 16px;
          text-align: left;
          font-size: 12px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid #e5e7eb;
          white-space: nowrap;
        }

        .audit-table tbody tr {
          border-bottom: 1px solid #f3f4f6;
          transition: background 0.15s;
        }

        .audit-table tbody tr:hover {
          background: #f9fafb;
        }

        .audit-table tbody tr:last-child {
          border-bottom: none;
        }

        .audit-table tbody td {
          padding: 12px 16px;
          font-size: 14px;
          color: #374151;
          vertical-align: top;
        }

        .audit-date {
          font-size: 13px;
          color: #6b7280;
          white-space: nowrap;
        }

        .audit-user {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .audit-user-name {
          font-weight: 600;
          color: #1f2937;
        }

        .audit-role-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .role-admin {
          background: #dbeafe;
          color: #1e40af;
        }

        .role-ministro {
          background: #fef3c7;
          color: #92400e;
        }

        .role-user {
          background: #f3f4f6;
          color: #6b7280;
        }

        .audit-action-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .audit-resource {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .audit-resource-type {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #9ca3af;
          letter-spacing: 0.3px;
        }

        .audit-resource-name {
          font-size: 14px;
          color: #374151;
        }

        .audit-detail {
          max-width: 250px;
          font-size: 13px;
          color: #6b7280;
        }

        .audit-detail-text {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s;
        }

        .audit-detail-text.expanded {
          -webkit-line-clamp: unset;
          display: block;
        }

        .audit-detail-text:hover {
          color: #2563eb;
        }

        /* Pagination */
        .audit-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .audit-pagination-info {
          font-size: 14px;
          color: #6b7280;
        }

        .audit-pagination-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-page {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: white;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-page:hover:not(:disabled) {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }

        .btn-page:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .page-numbers {
          display: flex;
          gap: 4px;
        }

        .btn-page-num {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          height: 36px;
          padding: 0 8px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: white;
          color: #374151;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-page-num:hover {
          background: #eff6ff;
          border-color: #2563eb;
        }

        .btn-page-num.active {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }

        /* Loading & Empty */
        .audit-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: #6b7280;
          gap: 16px;
        }

        .audit-loading .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: audit-spin 0.8s linear infinite;
        }

        @keyframes audit-spin {
          to { transform: rotate(360deg); }
        }

        .audit-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: #9ca3af;
          gap: 12px;
        }

        .audit-empty svg {
          opacity: 0.5;
        }

        .audit-empty p {
          font-size: 15px;
          margin: 0;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .audit-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .audit-filters-row {
            flex-direction: column;
          }

          .filter-group {
            min-width: 100%;
          }

          .filter-actions {
            width: 100%;
          }

          .filter-actions .btn-filter {
            flex: 1;
          }

          .audit-pagination {
            flex-direction: column;
            gap: 12px;
            text-align: center;
          }

          .audit-table thead th:nth-child(5),
          .audit-table tbody td:nth-child(5) {
            display: none;
          }
        }
      </style>

      <div class="audit-log-manager">
        <!-- Header -->
        <div class="audit-header">
          <div class="audit-header-left">
            <div class="audit-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div class="audit-header-text">
              <h2>Historial de Actividad</h2>
              <p>Registro de todas las acciones realizadas en el sistema</p>
            </div>
          </div>
          <button type="button" class="btn-export-csv" id="audit-export-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Exportar CSV
          </button>
        </div>

        <!-- Filters -->
        <div class="audit-filters">
          <div class="audit-filters-row">
            <div class="filter-group">
              <label>Accion</label>
              <select id="audit-filter-action">
                <option value="">Todas</option>
                ${Object.entries(ACTION_LABELS).map(([key, label]) =>
                  `<option value="${key}">${label}</option>`
                ).join('')}
              </select>
            </div>
            <div class="filter-group">
              <label>Recurso</label>
              <select id="audit-filter-resource">
                <option value="">Todos</option>
                ${Object.entries(RESOURCE_LABELS).map(([key, label]) =>
                  `<option value="${key}">${label}</option>`
                ).join('')}
              </select>
            </div>
            <div class="filter-group">
              <label>Desde</label>
              <input type="date" id="audit-filter-start">
            </div>
            <div class="filter-group">
              <label>Hasta</label>
              <input type="date" id="audit-filter-end">
            </div>
            <div class="filter-group">
              <label>Buscar</label>
              <input type="text" id="audit-filter-search" placeholder="Usuario o recurso...">
            </div>
            <div class="filter-actions">
              <button type="button" class="btn-filter btn-filter-apply" id="audit-btn-filter">
                Filtrar
              </button>
              <button type="button" class="btn-filter btn-filter-clear" id="audit-btn-clear">
                Limpiar
              </button>
            </div>
          </div>
        </div>

        <!-- Table -->
        <div class="audit-table-card">
          <div id="audit-table-container">
            <div class="audit-loading">
              <div class="spinner"></div>
              <p>Cargando historial...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
    this.loadLogs(1);
  }

  async loadLogs(page = 1) {
    const tableContainer = document.getElementById('audit-table-container');
    if (!tableContainer) return;

    tableContainer.innerHTML = `
      <div class="audit-loading">
        <div class="spinner"></div>
        <p>Cargando historial...</p>
      </div>
    `;

    try {
      const params = {
        page,
        limit: PAGE_SIZE,
        action: this.filters.action || undefined,
        resource: this.filters.resource || undefined,
        startDate: this.filters.startDate || undefined,
        endDate: this.filters.endDate || undefined,
        search: this.filters.search || undefined
      };

      const result = await dashboardService.getAuditLog(params);

      this.logs = result.logs || result.data || [];
      this.currentPage = result.page || page;
      this.totalPages = result.totalPages || 1;
      this.totalRecords = result.total || this.logs.length;

      if (this.logs.length === 0) {
        tableContainer.innerHTML = `
          <div class="audit-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <p>No se encontraron registros con los filtros aplicados</p>
          </div>
        `;
        return;
      }

      this.renderTable(this.logs);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      tableContainer.innerHTML = `
        <div class="audit-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>Error al cargar el historial de actividad</p>
        </div>
      `;
      showToast('Error al cargar el historial de actividad', 'error');
    }
  }

  renderTable(logs) {
    const tableContainer = document.getElementById('audit-table-container');
    if (!tableContainer) return;

    tableContainer.innerHTML = `
      <div class="audit-table-wrapper">
        <table class="audit-table">
          <thead>
            <tr>
              <th>Fecha/Hora</th>
              <th>Usuario</th>
              <th>Accion</th>
              <th>Recurso</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(log => `
              <tr>
                <td>
                  <span class="audit-date">${this.formatDate(log.createdAt || log.timestamp || log.date)}</span>
                </td>
                <td>
                  <div class="audit-user">
                    <span class="audit-user-name">${this.escapeHtml(log.userName || log.user?.name || 'Sistema')}</span>
                    ${log.userRole || log.user?.role ? `
                      <span class="audit-role-badge ${this.getRoleClass(log.userRole || log.user?.role)}">
                        ${this.escapeHtml(log.userRole || log.user?.role || '')}
                      </span>
                    ` : ''}
                  </div>
                </td>
                <td>
                  <span class="audit-action-badge" style="background: ${this.getActionColor(log.action)}20; color: ${this.getActionColor(log.action)};">
                    ${ACTION_LABELS[log.action] || log.action || '-'}
                  </span>
                </td>
                <td>
                  <div class="audit-resource">
                    <span class="audit-resource-type">${RESOURCE_LABELS[log.resource] || log.resource || '-'}</span>
                    ${log.resourceName ? `<span class="audit-resource-name">${this.escapeHtml(log.resourceName)}</span>` : ''}
                  </div>
                </td>
                <td>
                  <div class="audit-detail">
                    ${log.details || log.description ? `
                      <span class="audit-detail-text" title="Haz clic para expandir">
                        ${this.escapeHtml(log.details || log.description || '')}
                      </span>
                    ` : '<span style="color: #d1d5db;">-</span>'}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${this.renderPagination(this.currentPage, this.totalPages, this.totalRecords)}
    `;

    // Wire up detail expansion
    tableContainer.querySelectorAll('.audit-detail-text').forEach(el => {
      el.addEventListener('click', () => {
        el.classList.toggle('expanded');
      });
    });

    // Wire up pagination
    tableContainer.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page);
        if (page >= 1 && page <= this.totalPages) {
          this.loadLogs(page);
        }
      });
    });
  }

  renderPagination(page, totalPages, total) {
    if (totalPages <= 1) {
      return `
        <div class="audit-pagination">
          <span class="audit-pagination-info">Pagina 1 de 1 (${total} registro${total !== 1 ? 's' : ''})</span>
          <div></div>
        </div>
      `;
    }

    // Build page numbers to display
    const pageNumbers = [];
    const maxVisible = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return `
      <div class="audit-pagination">
        <span class="audit-pagination-info">
          Pagina ${page} de ${totalPages} (${total} registro${total !== 1 ? 's' : ''})
        </span>
        <div class="audit-pagination-controls">
          <button type="button" class="btn-page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} title="Anterior">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <div class="page-numbers">
            ${startPage > 1 ? `
              <button type="button" class="btn-page-num" data-page="1">1</button>
              ${startPage > 2 ? '<span style="padding: 0 4px; color: #9ca3af;">...</span>' : ''}
            ` : ''}
            ${pageNumbers.map(p => `
              <button type="button" class="btn-page-num ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>
            `).join('')}
            ${endPage < totalPages ? `
              ${endPage < totalPages - 1 ? '<span style="padding: 0 4px; color: #9ca3af;">...</span>' : ''}
              <button type="button" class="btn-page-num" data-page="${totalPages}">${totalPages}</button>
            ` : ''}
          </div>
          <button type="button" class="btn-page" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} title="Siguiente">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  applyFilters() {
    const actionEl = document.getElementById('audit-filter-action');
    const resourceEl = document.getElementById('audit-filter-resource');
    const startEl = document.getElementById('audit-filter-start');
    const endEl = document.getElementById('audit-filter-end');
    const searchEl = document.getElementById('audit-filter-search');

    this.filters.action = actionEl ? actionEl.value : '';
    this.filters.resource = resourceEl ? resourceEl.value : '';
    this.filters.startDate = startEl ? startEl.value : '';
    this.filters.endDate = endEl ? endEl.value : '';
    this.filters.search = searchEl ? searchEl.value.trim() : '';

    this.currentPage = 1;
    this.loadLogs(1);
  }

  clearFilters() {
    this.filters = {
      action: '',
      resource: '',
      startDate: '',
      endDate: '',
      search: ''
    };

    const actionEl = document.getElementById('audit-filter-action');
    const resourceEl = document.getElementById('audit-filter-resource');
    const startEl = document.getElementById('audit-filter-start');
    const endEl = document.getElementById('audit-filter-end');
    const searchEl = document.getElementById('audit-filter-search');

    if (actionEl) actionEl.value = '';
    if (resourceEl) resourceEl.value = '';
    if (startEl) startEl.value = '';
    if (endEl) endEl.value = '';
    if (searchEl) searchEl.value = '';

    this.currentPage = 1;
    this.loadLogs(1);
  }

  async exportCSV() {
    const exportBtn = document.getElementById('audit-export-btn');
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.innerHTML = `
        <div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
        Exportando...
      `;
    }

    try {
      const result = await dashboardService.exportAuditLog({
        action: this.filters.action || undefined,
        resource: this.filters.resource || undefined,
        startDate: this.filters.startDate || undefined,
        endDate: this.filters.endDate || undefined,
        search: this.filters.search || undefined
      });

      const logs = result.logs || result.data || result || [];

      if (!Array.isArray(logs) || logs.length === 0) {
        showToast('No hay registros para exportar', 'warning');
        return;
      }

      // Build CSV
      const headers = ['Fecha/Hora', 'Usuario', 'Rol', 'Accion', 'Recurso', 'Nombre Recurso', 'Detalle'];
      const rows = logs.map(log => [
        this.formatDate(log.createdAt || log.timestamp || log.date),
        log.userName || log.user?.name || 'Sistema',
        log.userRole || log.user?.role || '',
        ACTION_LABELS[log.action] || log.action || '',
        RESOURCE_LABELS[log.resource] || log.resource || '',
        log.resourceName || '',
        (log.details || log.description || '').replace(/"/g, '""')
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Add BOM for Excel compatibility with Spanish characters
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const filename = `audit_log_${dateStr}.csv`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Historial exportado correctamente', 'success');
    } catch (error) {
      console.error('Error exporting audit log:', error);
      showToast('Error al exportar el historial', 'error');
    } finally {
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Exportar CSV
        `;
      }
    }
  }

  formatDate(dateStr) {
    if (!dateStr) return '-';

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return '-';
    }
  }

  getActionColor(action) {
    const colors = {
      CREATE: '#10b981',
      UPDATE: '#2563eb',
      DELETE: '#ef4444',
      STATUS_CHANGE: '#8b5cf6',
      LOGIN: '#6b7280',
      LOGOUT: '#6b7280',
      ASSIGN: '#f59e0b',
      APPROVE: '#10b981',
      REJECT: '#ef4444',
      UPLOAD: '#06b6d4',
      DOWNLOAD: '#06b6d4',
      EXPORT: '#8b5cf6'
    };
    return colors[action] || '#6b7280';
  }

  getRoleClass(role) {
    if (!role) return '';
    const r = role.toLowerCase();
    if (r === 'admin' || r === 'municipalidad') return 'role-admin';
    if (r === 'ministro' || r === 'ministro_fe') return 'role-ministro';
    return 'role-user';
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  setupEventListeners() {
    // Filter button
    const btnFilter = document.getElementById('audit-btn-filter');
    if (btnFilter) {
      btnFilter.addEventListener('click', () => this.applyFilters());
    }

    // Clear button
    const btnClear = document.getElementById('audit-btn-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => this.clearFilters());
    }

    // Export button
    const exportBtn = document.getElementById('audit-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportCSV());
    }

    // Enter key on search input triggers filter
    const searchInput = document.getElementById('audit-filter-search');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.applyFilters();
        }
      });
    }
  }
}

// Module-level reference
export let auditLogManager;

export function initAuditLogManager(container) {
  auditLogManager = new AuditLogManager(container);
  auditLogManager.render();
  return auditLogManager;
}
