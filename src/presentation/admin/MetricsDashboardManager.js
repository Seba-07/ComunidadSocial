/**
 * MetricsDashboardManager - Panel de Metricas y KPIs del Administrador
 * Visualiza estadisticas de organizaciones, ministros, usuarios y actividad reciente
 */

import { dashboardService } from '../../services/DashboardService.js';
import { showToast } from '../../app.js';

const STATUS_LABELS = {
  'draft': 'Borrador',
  'waiting_ministro': 'Esperando Ministro',
  'ministro_scheduled': 'Ministro Agendado',
  'ministro_approved': 'Aprobado por Ministro',
  'pending_review': 'Pendiente',
  'in_review': 'En Revision',
  'rejected': 'Rechazada',
  'sent_registry': 'Registro Civil',
  'registry_observations': 'Obs. Registro',
  'approved': 'Aprobada',
  'dissolved': 'Disuelta'
};

const STATUS_COLORS = {
  'draft': '#94a3b8',
  'waiting_ministro': '#f59e0b',
  'ministro_scheduled': '#3b82f6',
  'ministro_approved': '#10b981',
  'pending_review': '#8b5cf6',
  'in_review': '#06b6d4',
  'approved': '#22c55e',
  'rejected': '#ef4444',
  'dissolved': '#6b7280',
  'sent_registry': '#f97316',
  'registry_observations': '#eab308'
};

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export class MetricsDashboardManager {
  constructor(container) {
    this.container = container;
  }

  /**
   * Carga datos y renderiza el dashboard completo
   */
  async render() {
    this.renderLoading();

    try {
      const [stats, activity] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getRecentActivity()
      ]);

      this.renderDashboard(stats, activity);
      this.setupEventListeners();
    } catch (error) {
      console.error('Error cargando metricas:', error);
      this.renderError(error);
    }
  }

  /**
   * Muestra spinner de carga
   */
  renderLoading() {
    this.container.innerHTML = `
      <style>${this.getStyles()}</style>
      <div class="mdm-loading">
        <div class="mdm-spinner"></div>
        <p>Cargando metricas...</p>
      </div>
    `;
  }

  /**
   * Muestra estado de error con boton de reintento
   */
  renderError(error) {
    this.container.innerHTML = `
      <style>${this.getStyles()}</style>
      <div class="mdm-error">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3>Error al cargar metricas</h3>
        <p>${error.message || 'No se pudieron obtener los datos del servidor.'}</p>
        <button type="button" id="mdm-retry-btn" class="mdm-btn mdm-btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          Reintentar
        </button>
      </div>
    `;

    const retryBtn = this.container.querySelector('#mdm-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.render());
    }
  }

  /**
   * Renderiza el dashboard completo con todas las secciones
   */
  renderDashboard(stats, activity) {
    const orgs = stats.organizations || {};
    const ministros = stats.ministros || {};
    const users = stats.users || {};
    const timeline = stats.timeline || [];
    const byStatus = orgs.byStatus || {};
    const recentActivity = Array.isArray(activity) ? activity : (activity?.items || []);

    // Calcular tendencia
    const thisMonth = orgs.approvedThisMonth || 0;
    const lastMonth = orgs.approvedLastMonth || 0;
    const trend = thisMonth - lastMonth;
    const trendIcon = trend > 0 ? '&#9650;' : trend < 0 ? '&#9660;' : '&#8212;';
    const trendClass = trend > 0 ? 'mdm-trend-up' : trend < 0 ? 'mdm-trend-down' : 'mdm-trend-neutral';

    // Calcular max para barras de estado
    const statusValues = Object.values(byStatus);
    const maxStatusValue = Math.max(...statusValues, 1);

    // Calcular max para timeline
    let maxTimelineValue = 1;
    timeline.forEach(m => {
      const vals = [m.created || 0, m.approved || 0, m.rejected || 0];
      const localMax = Math.max(...vals);
      if (localMax > maxTimelineValue) maxTimelineValue = localMax;
    });

    // Calcular max para carga de ministros
    const loadByMinistro = ministros.loadByMinistro || [];
    let maxMinistroLoad = 1;
    loadByMinistro.forEach(m => {
      const total = (m.pending || 0) + (m.completed || 0);
      if (total > maxMinistroLoad) maxMinistroLoad = total;
    });

    this.container.innerHTML = `
      <style>${this.getStyles()}</style>
      <div class="mdm-dashboard">

        <!-- Header -->
        <div class="mdm-header">
          <div class="mdm-header-left">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
              <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
            </svg>
            <h2>Panel de Metricas</h2>
          </div>
          <button type="button" id="mdm-refresh-btn" class="mdm-btn mdm-btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            Actualizar
          </button>
        </div>

        <!-- KPI Cards -->
        <div class="mdm-kpi-grid">
          <div class="mdm-kpi-card">
            <div class="mdm-kpi-icon mdm-kpi-icon-blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div class="mdm-kpi-content">
              <span class="mdm-kpi-value">${orgs.total || 0}</span>
              <span class="mdm-kpi-label">Total Organizaciones</span>
            </div>
            <div class="mdm-kpi-trend ${trendClass}">
              <span>${trendIcon}</span>
              <span>${Math.abs(trend)} vs mes anterior</span>
            </div>
          </div>

          <div class="mdm-kpi-card">
            <div class="mdm-kpi-icon mdm-kpi-icon-green">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <div class="mdm-kpi-content">
              <span class="mdm-kpi-value">${thisMonth}</span>
              <span class="mdm-kpi-label">Aprobadas Este Mes</span>
            </div>
          </div>

          <div class="mdm-kpi-card">
            <div class="mdm-kpi-icon mdm-kpi-icon-amber">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div class="mdm-kpi-content">
              <span class="mdm-kpi-value">${orgs.avgProcessingDays || 0} dias</span>
              <span class="mdm-kpi-label">Tiempo Promedio de Tramite</span>
            </div>
          </div>

          <div class="mdm-kpi-card">
            <div class="mdm-kpi-icon mdm-kpi-icon-purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div class="mdm-kpi-content">
              <span class="mdm-kpi-value">${ministros.active || 0}/${ministros.total || 0}</span>
              <span class="mdm-kpi-label">Ministros Activos</span>
            </div>
          </div>
        </div>

        <!-- Charts Row -->
        <div class="mdm-charts-row">

          <!-- Organizaciones por Estado -->
          <div class="mdm-card">
            <h3 class="mdm-card-title">Organizaciones por Estado</h3>
            <div class="mdm-status-chart">
              ${Object.entries(byStatus).length > 0
                ? Object.entries(byStatus).map(([status, count]) => `
                  <div class="mdm-status-row">
                    <span class="mdm-status-label">${STATUS_LABELS[status] || status}</span>
                    <div class="mdm-status-bar-track">
                      <div class="mdm-status-bar-fill" style="width: ${(count / maxStatusValue) * 100}%; background-color: ${STATUS_COLORS[status] || '#94a3b8'};"></div>
                    </div>
                    <span class="mdm-status-count">${count}</span>
                  </div>
                `).join('')
                : '<p class="mdm-empty-text">Sin datos de estado disponibles</p>'
              }
            </div>
          </div>

          <!-- Timeline Chart -->
          <div class="mdm-card">
            <h3 class="mdm-card-title">Actividad Mensual (Ultimos 12 Meses)</h3>
            <div class="mdm-timeline-chart">
              ${timeline.length > 0
                ? `
                  <div class="mdm-timeline-legend">
                    <span class="mdm-legend-item"><span class="mdm-legend-dot" style="background:#3b82f6;"></span> Creadas</span>
                    <span class="mdm-legend-item"><span class="mdm-legend-dot" style="background:#22c55e;"></span> Aprobadas</span>
                    <span class="mdm-legend-item"><span class="mdm-legend-dot" style="background:#ef4444;"></span> Rechazadas</span>
                  </div>
                  <div class="mdm-timeline-bars">
                    ${timeline.map(m => {
                      const created = m.created || 0;
                      const approved = m.approved || 0;
                      const rejected = m.rejected || 0;
                      const monthIdx = m.month != null ? m.month : 0;
                      const label = MONTH_LABELS[monthIdx] || monthIdx;
                      return `
                        <div class="mdm-timeline-col">
                          <div class="mdm-timeline-col-bars">
                            <div class="mdm-tbar mdm-tbar-created" style="height: ${(created / maxTimelineValue) * 100}%;" title="Creadas: ${created}"></div>
                            <div class="mdm-tbar mdm-tbar-approved" style="height: ${(approved / maxTimelineValue) * 100}%;" title="Aprobadas: ${approved}"></div>
                            <div class="mdm-tbar mdm-tbar-rejected" style="height: ${(rejected / maxTimelineValue) * 100}%;" title="Rechazadas: ${rejected}"></div>
                          </div>
                          <span class="mdm-timeline-label">${label}</span>
                        </div>
                      `;
                    }).join('')}
                  </div>
                `
                : '<p class="mdm-empty-text">Sin datos de timeline disponibles</p>'
              }
            </div>
          </div>
        </div>

        <!-- Bottom Row -->
        <div class="mdm-bottom-row">

          <!-- Carga de Ministros -->
          <div class="mdm-card">
            <h3 class="mdm-card-title">Carga de Ministros</h3>
            ${loadByMinistro.length > 0
              ? `
                <div class="mdm-table-wrapper">
                  <table class="mdm-table">
                    <thead>
                      <tr>
                        <th>Ministro</th>
                        <th>Pendientes</th>
                        <th>Completadas</th>
                        <th>Carga</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${loadByMinistro.map(m => {
                        const pending = m.pending || 0;
                        const completed = m.completed || 0;
                        const total = pending + completed;
                        const loadPct = (total / maxMinistroLoad) * 100;
                        const pendingPct = total > 0 ? (pending / total) * 100 : 0;
                        return `
                          <tr>
                            <td class="mdm-ministro-name">${m.name || 'Sin nombre'}</td>
                            <td><span class="mdm-badge mdm-badge-amber">${pending}</span></td>
                            <td><span class="mdm-badge mdm-badge-green">${completed}</span></td>
                            <td class="mdm-load-cell">
                              <div class="mdm-load-bar-track">
                                <div class="mdm-load-bar-completed" style="width: ${loadPct * (1 - pendingPct / 100)}%;"></div>
                                <div class="mdm-load-bar-pending" style="width: ${loadPct * (pendingPct / 100)}%;"></div>
                              </div>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              `
              : '<p class="mdm-empty-text">Sin datos de ministros disponibles</p>'
            }
          </div>

          <!-- Usuarios -->
          <div class="mdm-card">
            <h3 class="mdm-card-title">Usuarios</h3>
            <div class="mdm-users-grid">
              <div class="mdm-user-stat">
                <span class="mdm-user-stat-value">${users.total || 0}</span>
                <span class="mdm-user-stat-label">Total</span>
              </div>
              <div class="mdm-user-stat">
                <span class="mdm-user-stat-value">${users.organizers || 0}</span>
                <span class="mdm-user-stat-label">Organizadores</span>
              </div>
              <div class="mdm-user-stat">
                <span class="mdm-user-stat-value">${users.members || 0}</span>
                <span class="mdm-user-stat-label">Miembros</span>
              </div>
              <div class="mdm-user-stat">
                <span class="mdm-user-stat-value">${users.registeredThisMonth || 0}</span>
                <span class="mdm-user-stat-label">Registrados Este Mes</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Actividad Reciente -->
        <div class="mdm-card mdm-card-full">
          <h3 class="mdm-card-title">Actividad Reciente</h3>
          ${recentActivity.length > 0
            ? `
              <div class="mdm-activity-list">
                ${recentActivity.slice(0, 20).map(item => {
                  const status = item.newStatus || item.status || '';
                  const color = STATUS_COLORS[status] || '#94a3b8';
                  const label = STATUS_LABELS[status] || status;
                  const comment = item.comment || '';
                  const truncatedComment = comment.length > 80 ? comment.substring(0, 80) + '...' : comment;
                  const date = item.date || item.createdAt || '';
                  let formattedDate = '';
                  if (date) {
                    try {
                      formattedDate = new Date(date).toLocaleDateString('es-CL', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                    } catch (e) {
                      formattedDate = date;
                    }
                  }
                  return `
                    <div class="mdm-activity-item">
                      <div class="mdm-activity-dot" style="background-color: ${color};"></div>
                      <div class="mdm-activity-content">
                        <div class="mdm-activity-top">
                          <span class="mdm-activity-org">${item.organizationName || item.orgName || 'Organizacion'}</span>
                          <span class="mdm-activity-badge" style="background-color: ${color}1a; color: ${color}; border: 1px solid ${color}33;">${label}</span>
                        </div>
                        ${truncatedComment ? `<p class="mdm-activity-comment">${truncatedComment}</p>` : ''}
                        <span class="mdm-activity-date">${formattedDate}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `
            : '<p class="mdm-empty-text">Sin actividad reciente</p>'
          }
        </div>

      </div>
    `;
  }

  /**
   * Configura event listeners del dashboard
   */
  setupEventListeners() {
    const refreshBtn = this.container.querySelector('#mdm-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = `
          <div class="mdm-spinner-small"></div>
          Actualizando...
        `;
        try {
          await this.render();
          showToast('Metricas actualizadas', 'success');
        } catch (error) {
          showToast('Error al actualizar metricas', 'error');
          refreshBtn.disabled = false;
          refreshBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            Actualizar
          `;
        }
      });
    }
  }

  /**
   * Retorna todos los estilos CSS del componente
   */
  getStyles() {
    return `
      /* Layout Principal */
      .mdm-dashboard {
        max-width: 1400px;
        margin: 0 auto;
        padding: 24px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      /* Loading */
      .mdm-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        gap: 16px;
        color: #6b7280;
      }

      .mdm-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #e5e7eb;
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: mdm-spin 0.8s linear infinite;
      }

      .mdm-spinner-small {
        width: 16px;
        height: 16px;
        border: 2px solid #e5e7eb;
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: mdm-spin 0.8s linear infinite;
        display: inline-block;
      }

      @keyframes mdm-spin {
        to { transform: rotate(360deg); }
      }

      /* Error */
      .mdm-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        gap: 12px;
        text-align: center;
        color: #6b7280;
      }

      .mdm-error h3 {
        margin: 0;
        color: #1f2937;
        font-size: 18px;
      }

      .mdm-error p {
        margin: 0;
        max-width: 400px;
      }

      /* Header */
      .mdm-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
      }

      .mdm-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .mdm-header-left svg {
        color: #3b82f6;
      }

      .mdm-header-left h2 {
        margin: 0;
        font-size: 22px;
        color: #1f2937;
        font-weight: 700;
      }

      /* Buttons */
      .mdm-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .mdm-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .mdm-btn-primary {
        background: #3b82f6;
        color: white;
      }

      .mdm-btn-primary:hover:not(:disabled) {
        background: #2563eb;
      }

      .mdm-btn-secondary {
        background: #f3f4f6;
        color: #374151;
        border: 1px solid #d1d5db;
      }

      .mdm-btn-secondary:hover:not(:disabled) {
        background: #e5e7eb;
      }

      /* KPI Cards */
      .mdm-kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
        margin-bottom: 24px;
      }

      .mdm-kpi-card {
        background: white;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
        border: 1px solid #f0f0f0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .mdm-kpi-icon {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .mdm-kpi-icon-blue {
        background: #dbeafe;
        color: #3b82f6;
      }

      .mdm-kpi-icon-green {
        background: #dcfce7;
        color: #16a34a;
      }

      .mdm-kpi-icon-amber {
        background: #fef3c7;
        color: #d97706;
      }

      .mdm-kpi-icon-purple {
        background: #ede9fe;
        color: #7c3aed;
      }

      .mdm-kpi-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .mdm-kpi-value {
        font-size: 28px;
        font-weight: 700;
        color: #1f2937;
        line-height: 1.2;
      }

      .mdm-kpi-label {
        font-size: 13px;
        color: #6b7280;
        font-weight: 500;
      }

      .mdm-kpi-trend {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 500;
        padding-top: 4px;
        border-top: 1px solid #f3f4f6;
      }

      .mdm-trend-up {
        color: #16a34a;
      }

      .mdm-trend-down {
        color: #dc2626;
      }

      .mdm-trend-neutral {
        color: #6b7280;
      }

      /* Cards */
      .mdm-card {
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
        border: 1px solid #f0f0f0;
      }

      .mdm-card-full {
        margin-top: 24px;
      }

      .mdm-card-title {
        margin: 0 0 20px 0;
        font-size: 16px;
        font-weight: 600;
        color: #1f2937;
      }

      /* Charts Row */
      .mdm-charts-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
      }

      /* Status Bar Chart */
      .mdm-status-chart {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .mdm-status-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .mdm-status-label {
        flex: 0 0 150px;
        font-size: 13px;
        color: #374151;
        text-align: right;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .mdm-status-bar-track {
        flex: 1;
        height: 24px;
        background: #f3f4f6;
        border-radius: 6px;
        overflow: hidden;
      }

      .mdm-status-bar-fill {
        height: 100%;
        border-radius: 6px;
        transition: width 0.6s ease;
        min-width: 2px;
      }

      .mdm-status-count {
        flex: 0 0 36px;
        font-size: 14px;
        font-weight: 600;
        color: #1f2937;
        text-align: right;
      }

      /* Timeline Chart */
      .mdm-timeline-chart {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .mdm-timeline-legend {
        display: flex;
        gap: 16px;
        justify-content: center;
        margin-bottom: 8px;
      }

      .mdm-legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #6b7280;
      }

      .mdm-legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        display: inline-block;
      }

      .mdm-timeline-bars {
        display: flex;
        align-items: flex-end;
        gap: 4px;
        height: 180px;
        padding-bottom: 28px;
        position: relative;
      }

      .mdm-timeline-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
        position: relative;
      }

      .mdm-timeline-col-bars {
        display: flex;
        align-items: flex-end;
        gap: 2px;
        flex: 1;
        width: 100%;
        justify-content: center;
      }

      .mdm-tbar {
        flex: 1;
        max-width: 14px;
        border-radius: 3px 3px 0 0;
        transition: height 0.6s ease;
        min-height: 2px;
        cursor: default;
      }

      .mdm-tbar-created {
        background: #3b82f6;
      }

      .mdm-tbar-approved {
        background: #22c55e;
      }

      .mdm-tbar-rejected {
        background: #ef4444;
      }

      .mdm-timeline-label {
        position: absolute;
        bottom: 0;
        font-size: 11px;
        color: #6b7280;
        font-weight: 500;
      }

      /* Bottom Row */
      .mdm-bottom-row {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 24px;
        margin-top: 24px;
      }

      /* Table */
      .mdm-table-wrapper {
        overflow-x: auto;
      }

      .mdm-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }

      .mdm-table thead th {
        text-align: left;
        padding: 10px 12px;
        font-weight: 600;
        color: #6b7280;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 2px solid #f3f4f6;
      }

      .mdm-table tbody td {
        padding: 12px;
        border-bottom: 1px solid #f3f4f6;
        color: #374151;
      }

      .mdm-ministro-name {
        font-weight: 500;
      }

      .mdm-badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 600;
      }

      .mdm-badge-amber {
        background: #fef3c7;
        color: #92400e;
      }

      .mdm-badge-green {
        background: #dcfce7;
        color: #166534;
      }

      .mdm-load-cell {
        min-width: 120px;
      }

      .mdm-load-bar-track {
        display: flex;
        height: 10px;
        background: #f3f4f6;
        border-radius: 5px;
        overflow: hidden;
      }

      .mdm-load-bar-completed {
        height: 100%;
        background: #22c55e;
        transition: width 0.4s ease;
      }

      .mdm-load-bar-pending {
        height: 100%;
        background: #f59e0b;
        transition: width 0.4s ease;
      }

      /* Users Stats */
      .mdm-users-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .mdm-user-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 16px;
        background: #f9fafb;
        border-radius: 10px;
        border: 1px solid #f3f4f6;
      }

      .mdm-user-stat-value {
        font-size: 28px;
        font-weight: 700;
        color: #1f2937;
        line-height: 1.2;
      }

      .mdm-user-stat-label {
        font-size: 12px;
        color: #6b7280;
        font-weight: 500;
        margin-top: 4px;
        text-align: center;
      }

      /* Activity List */
      .mdm-activity-list {
        display: flex;
        flex-direction: column;
        gap: 0;
        max-height: 500px;
        overflow-y: auto;
      }

      .mdm-activity-item {
        display: flex;
        gap: 12px;
        padding: 14px 0;
        border-bottom: 1px solid #f3f4f6;
        align-items: flex-start;
      }

      .mdm-activity-item:last-child {
        border-bottom: none;
      }

      .mdm-activity-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
        margin-top: 5px;
      }

      .mdm-activity-content {
        flex: 1;
        min-width: 0;
      }

      .mdm-activity-top {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .mdm-activity-org {
        font-weight: 600;
        font-size: 14px;
        color: #1f2937;
      }

      .mdm-activity-badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
      }

      .mdm-activity-comment {
        margin: 4px 0 0;
        font-size: 13px;
        color: #6b7280;
        font-style: italic;
      }

      .mdm-activity-date {
        font-size: 12px;
        color: #9ca3af;
        margin-top: 4px;
        display: block;
      }

      /* Empty State */
      .mdm-empty-text {
        text-align: center;
        color: #9ca3af;
        font-size: 14px;
        padding: 24px 0;
        margin: 0;
      }

      /* Responsive */
      @media (max-width: 1200px) {
        .mdm-kpi-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 900px) {
        .mdm-charts-row {
          grid-template-columns: 1fr;
        }

        .mdm-bottom-row {
          grid-template-columns: 1fr;
        }

        .mdm-dashboard {
          padding: 16px;
        }
      }

      @media (max-width: 600px) {
        .mdm-kpi-grid {
          grid-template-columns: 1fr;
        }

        .mdm-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
        }

        .mdm-header-left h2 {
          font-size: 18px;
        }

        .mdm-kpi-value {
          font-size: 24px;
        }

        .mdm-status-label {
          flex: 0 0 100px;
          font-size: 11px;
        }

        .mdm-users-grid {
          grid-template-columns: 1fr 1fr;
        }

        .mdm-timeline-bars {
          height: 140px;
        }
      }
    `;
  }
}

/**
 * Crea e inicializa una instancia del MetricsDashboardManager
 * @param {HTMLElement} container - Elemento contenedor donde se renderiza el dashboard
 * @returns {MetricsDashboardManager}
 */
export function initMetricsDashboardManager(container) {
  const manager = new MetricsDashboardManager(container);
  manager.render();
  return manager;
}
