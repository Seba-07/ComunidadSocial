/**
 * Dashboard de Administrador
 * Gestión de solicitudes de organizaciones comunitarias
 */

import { organizationsService, ORG_STATUS, ORG_STATUS_LABELS, ORG_STATUS_COLORS } from '../../services/OrganizationsService.js';
import { alertsService } from '../../services/AlertsService.js';
import { showToast } from '../../app.js';
import { initScheduleManager } from './ScheduleManager.js';
import { initMinistroManager } from './MinistroManager.js';
import { ministroService } from '../../services/MinistroService.js';
import { ministroAssignmentService } from '../../services/MinistroAssignmentService.js';
import { ministroAvailabilityService } from '../../services/MinistroAvailabilityService.js';
import { pdfService } from '../../services/PDFService.js';

// Helper: Obtener icono según tipo de organización
function getOrgIcon(type) {
  // Organizaciones territoriales
  if (type === 'JUNTA_VECINOS' || type === 'COMITE_VECINOS') return '🏘️';

  // Organizaciones funcionales por categoría
  if (type?.startsWith('CLUB_')) return '⚽';
  if (type?.startsWith('CENTRO_')) return '🏢';
  if (type?.startsWith('AGRUPACION_')) return '👥';
  if (type?.startsWith('COMITE_')) return '📋';
  if (type?.startsWith('ORG_')) return '🎯';
  if (type === 'GRUPO_TEATRO') return '🎭';
  if (type === 'CORO') return '🎵';
  if (type === 'TALLER_ARTESANIA') return '🎨';

  // Default
  return '👥';
}

// Helper: Obtener nombre legible del tipo
function getOrgTypeName(type) {
  const types = {
    // Territoriales
    'JUNTA_VECINOS': 'Junta de Vecinos',
    'COMITE_VECINOS': 'Comité de Vecinos',
    // Funcionales - Clubes
    'CLUB_DEPORTIVO': 'Club Deportivo',
    'CLUB_ADULTO_MAYOR': 'Club de Adulto Mayor',
    'CLUB_JUVENIL': 'Club Juvenil',
    'CLUB_CULTURAL': 'Club Cultural',
    // Funcionales - Centros
    'CENTRO_MADRES': 'Centro de Madres',
    'CENTRO_PADRES': 'Centro de Padres y Apoderados',
    'CENTRO_CULTURAL': 'Centro Cultural',
    // Funcionales - Agrupaciones
    'AGRUPACION_FOLCLORICA': 'Agrupación Folclórica',
    'AGRUPACION_CULTURAL': 'Agrupación Cultural',
    'AGRUPACION_JUVENIL': 'Agrupación Juvenil',
    'AGRUPACION_AMBIENTAL': 'Agrupación Ambiental',
    // Funcionales - Comités
    'COMITE_VIVIENDA': 'Comité de Vivienda',
    'COMITE_ALLEGADOS': 'Comité de Allegados',
    'COMITE_APR': 'Comité de Agua Potable Rural',
    // Funcionales - Otras
    'ORG_SCOUT': 'Organización Scout',
    'ORG_MUJERES': 'Organización de Mujeres',
    'GRUPO_TEATRO': 'Grupo de Teatro',
    'CORO': 'Coro o Agrupación Musical',
    'TALLER_ARTESANIA': 'Taller de Artesanía',
    'OTRA_FUNCIONAL': 'Otra Organización Funcional'
  };
  return types[type] || 'Organización Comunitaria';
}

class AdminDashboard {
  constructor() {
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.currentView = 'applications'; // 'applications', 'schedule', o 'ministro'
    this.scheduleManager = null;
    this.ministroManager = null;
  }

  /**
   * Inicializa el dashboard de administrador
   */
  init() {
    this.renderApplicationsList();
    this.updateStats();
    this.setupEventListeners();
    this.setupScheduleManagerButton();
    this.setupMinistroManagerButton();
  }

  /**
   * Configura el botón de gestión de horarios
   */
  setupScheduleManagerButton() {
    const btn = document.getElementById('btn-schedule-manager');
    if (btn) {
      btn.addEventListener('click', () => {
        if (this.currentView === 'schedule') {
          this.showApplications();
        } else {
          this.showScheduleManager();
        }
      });
    }
  }

  /**
   * Configura el botón de gestión de ministros
   */
  setupMinistroManagerButton() {
    const btn = document.getElementById('btn-ministro-manager');
    if (btn) {
      btn.addEventListener('click', () => {
        if (this.currentView === 'ministro') {
          this.showApplications();
        } else {
          this.showMinistroManager();
        }
      });
    }
  }

  /**
   * Muestra la vista de gestión de horarios
   */
  showScheduleManager() {
    this.currentView = 'schedule';

    // Ocultar elementos de la vista de solicitudes
    document.querySelector('.admin-stats-row').style.display = 'none';
    document.querySelector('.admin-toolbar').style.display = 'none';
    document.getElementById('admin-applications-list').style.display = 'none';
    document.getElementById('ministro-manager-view').style.display = 'none';

    // Mostrar vista de schedule manager
    const scheduleView = document.getElementById('schedule-manager-view');
    scheduleView.style.display = 'block';

    // Cambiar texto de los botones
    const scheduleBtn = document.getElementById('btn-schedule-manager');
    scheduleBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      Volver a Solicitudes
    `;

    const ministroBtn = document.getElementById('btn-ministro-manager');
    ministroBtn.disabled = true;
    ministroBtn.style.opacity = '0.5';

    // Inicializar schedule manager si no existe
    if (!this.scheduleManager) {
      this.scheduleManager = initScheduleManager(scheduleView);
    }
  }

  /**
   * Muestra la vista de gestión de ministros
   */
  showMinistroManager() {
    this.currentView = 'ministro';

    // Ocultar elementos de la vista de solicitudes
    document.querySelector('.admin-stats-row').style.display = 'none';
    document.querySelector('.admin-toolbar').style.display = 'none';
    document.getElementById('admin-applications-list').style.display = 'none';
    document.getElementById('schedule-manager-view').style.display = 'none';

    // Mostrar vista de ministro manager
    const ministroView = document.getElementById('ministro-manager-view');
    ministroView.style.display = 'block';

    // Cambiar texto de los botones
    const ministroBtn = document.getElementById('btn-ministro-manager');
    ministroBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      Volver a Solicitudes
    `;

    const scheduleBtn = document.getElementById('btn-schedule-manager');
    scheduleBtn.disabled = true;
    scheduleBtn.style.opacity = '0.5';

    // Inicializar ministro manager si no existe
    if (!this.ministroManager) {
      this.ministroManager = initMinistroManager(ministroView);
    }
  }

  /**
   * Muestra la vista de solicitudes
   */
  showApplications() {
    this.currentView = 'applications';

    // Mostrar elementos de la vista de solicitudes
    document.querySelector('.admin-stats-row').style.display = 'grid';
    document.querySelector('.admin-toolbar').style.display = 'flex';
    document.getElementById('admin-applications-list').style.display = 'block';

    // Ocultar vistas de managers
    document.getElementById('schedule-manager-view').style.display = 'none';
    document.getElementById('ministro-manager-view').style.display = 'none';

    // Restaurar botón de horarios
    const scheduleBtn = document.getElementById('btn-schedule-manager');
    scheduleBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      Gestionar Horarios
    `;
    scheduleBtn.disabled = false;
    scheduleBtn.style.opacity = '1';

    // Restaurar botón de ministros
    const ministroBtn = document.getElementById('btn-ministro-manager');
    ministroBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      Gestionar Ministros de Fe
    `;
    ministroBtn.disabled = false;
    ministroBtn.style.opacity = '1';
  }

  /**
   * Configura los event listeners
   */
  setupEventListeners() {
    // Filtros
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilter = e.target.dataset.filter;
        this.renderApplicationsList();
      });
    });

    // Búsqueda
    const searchInput = document.getElementById('admin-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderApplicationsList();
      });
    }
  }

  /**
   * Actualiza las estadísticas
   */
  updateStats() {
    const orgs = organizationsService.getAll();
    console.log('📊 Admin Stats - Total orgs:', orgs.length, orgs);

    const counts = {
      pending: 0,
      ministro: 0,
      review: 0,
      registry: 0,
      approved: 0
    };

    // Contar manualmente para evitar NaN
    orgs.forEach(o => {
      if (o.status === ORG_STATUS.PENDING_REVIEW) counts.pending++;
      else if (o.status === ORG_STATUS.WAITING_MINISTRO_REQUEST || o.status === ORG_STATUS.MINISTRO_SCHEDULED) counts.ministro++;
      else if (o.status === ORG_STATUS.IN_REVIEW) counts.review++;
      else if (o.status === ORG_STATUS.SENT_TO_REGISTRY) counts.registry++;
      else if (o.status === ORG_STATUS.APPROVED) counts.approved++;
    });

    console.log('📊 Counts:', counts);

    const pendingEl = document.getElementById('admin-pending-count');
    const ministroEl = document.getElementById('admin-ministro-count');
    const reviewEl = document.getElementById('admin-review-count');
    const registryEl = document.getElementById('admin-registry-count');
    const approvedEl = document.getElementById('admin-approved-count');

    console.log('📊 Elements found:', { pendingEl, ministroEl, reviewEl, registryEl, approvedEl });

    if (pendingEl) pendingEl.textContent = counts.pending;
    if (ministroEl) ministroEl.textContent = counts.ministro;
    if (reviewEl) reviewEl.textContent = counts.review;
    if (registryEl) registryEl.textContent = counts.registry;
    if (approvedEl) approvedEl.textContent = counts.approved;
  }

  /**
   * Filtra las organizaciones
   */
  getFilteredOrganizations() {
    let orgs = organizationsService.getAll();

    // Filtrar por estado
    if (this.currentFilter !== 'all') {
      orgs = orgs.filter(o => o.status === this.currentFilter);
    }

    // Filtrar por búsqueda
    if (this.searchQuery) {
      orgs = orgs.filter(o =>
        o.organization?.name?.toLowerCase().includes(this.searchQuery) ||
        o.organization?.commune?.toLowerCase().includes(this.searchQuery)
      );
    }

    return orgs;
  }

  /**
   * Renderiza la lista de solicitudes
   */
  renderApplicationsList() {
    const container = document.getElementById('admin-applications-list');
    if (!container) return;

    const orgs = this.getFilteredOrganizations();

    if (orgs.length === 0) {
      container.innerHTML = `
        <div class="admin-empty-state">
          <div class="empty-icon">📭</div>
          <h3>No hay solicitudes</h3>
          <p>${this.currentFilter === 'all'
            ? 'Las solicitudes de nuevas organizaciones aparecerán aquí'
            : 'No hay solicitudes con este estado'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = orgs.map(org => this.renderApplicationCard(org)).join('');

    // Agregar event listeners
    container.querySelectorAll('.admin-app-row').forEach(row => {
      const orgId = row.dataset.orgId;

      // Click en botón de revisar
      row.querySelector('.btn-admin-review')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openReviewModal(orgId);
      });

      // Click en toda la fila también abre el modal
      row.addEventListener('click', () => {
        this.openReviewModal(orgId);
      });
    });
  }

  /**
   * Renderiza una card de solicitud (compacta)
   */
  renderApplicationCard(org) {
    const statusLabel = ORG_STATUS_LABELS[org.status] || org.status;
    const statusColor = ORG_STATUS_COLORS[org.status] || '#6b7280';
    const typeIcon = getOrgIcon(org.organization?.type);

    const createdDate = new Date(org.createdAt).toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'short'
    });

    const membersCount = org.members?.length || 0;

    // FASE 5: Verificar si es organización fantasma
    let ghostBadge = '';
    if (org.status === ORG_STATUS.APPROVED) {
      const ghostStatus = alertsService.isGhostOrganization(org.id);
      if (ghostStatus.isGhost) {
        const severityColors = {
          severe: '#dc2626',
          high: '#ea580c',
          medium: '#f59e0b'
        };
        const severityLabels = {
          severe: 'CRÍTICO',
          high: 'ALTO RIESGO',
          medium: 'EN RIESGO'
        };
        ghostBadge = `
          <div class="ghost-indicator ghost-${ghostStatus.severity}"
               style="background: ${severityColors[ghostStatus.severity]}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 8px;"
               title="${ghostStatus.criticalCount} responsabilidades vencidas, ${ghostStatus.totalOverdueDays} días de atraso total">
            👻 ${severityLabels[ghostStatus.severity]}
          </div>
        `;
      }
    }

    return `
      <div class="admin-app-row ${ghostBadge ? 'has-ghost-indicator' : ''}" data-org-id="${org.id}">
        <div class="app-row-main">
          <div class="app-row-icon">${typeIcon}</div>
          <div class="app-row-info">
            <span class="app-row-name">${org.organization?.name || 'Sin nombre'}</span>
            <span class="app-row-meta">${createdDate} • ${membersCount} miembros</span>
          </div>
          <div class="app-row-status" style="background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30">
            ${statusLabel}
          </div>
          ${ghostBadge}
          <button class="btn-admin-review" title="Revisar solicitud">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Abre el modal de revisión - muestra resumen o vista completa según estado
   */
  openReviewModal(orgId) {
    const org = organizationsService.getById(orgId);
    if (!org) return;

    // FASE 2: Si está esperando Ministro de Fe, mostrar modal especial
    if (org.status === ORG_STATUS.WAITING_MINISTRO_REQUEST || org.status === ORG_STATUS.MINISTRO_SCHEDULED) {
      this.openMinistroModal(org);
    }
    // Si está pendiente de revisión, mostrar vista previa/resumen
    else if (org.status === ORG_STATUS.PENDING_REVIEW) {
      this.openPreviewModal(org);
    } else {
      // Si ya está en revisión o más adelante, mostrar vista completa
      this.openFullReviewModal(org);
    }
  }

  /**
   * Modal de vista previa/resumen (para solicitudes pendientes)
   */
  openPreviewModal(org) {
    const statusLabel = ORG_STATUS_LABELS[org.status] || org.status;
    const statusColor = ORG_STATUS_COLORS[org.status] || '#6b7280';
    // Estilo especial para sent_registry con mejor contraste
    const isSentRegistry = org.status === 'sent_registry';
    const badgeStyle = isSentRegistry
      ? 'background: #1e3a5f; color: #ffffff; border: 1px solid #1e3a5f'
      : `background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30`;
    const typeIcon = getOrgIcon(org.organization?.type);
    const typeName = getOrgTypeName(org.organization?.type);
    const membersCount = org.members?.length || 0;
    const docsCount = org.documents ? Object.keys(org.documents).length : 0;
    const hasCommission = org.commission?.members?.length === 3;
    const createdDate = new Date(org.createdAt).toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const modal = document.createElement('div');
    modal.className = 'admin-review-modal-overlay';
    modal.innerHTML = `
      <div class="admin-review-modal preview-modal">
        <div class="review-modal-header">
          <div class="review-header-left">
            <span class="review-type-badge">${typeIcon} ${typeName}</span>
            <h2>${org.organization?.name || 'Sin nombre'}</h2>
            <div class="review-header-meta">
              <span>📍 ${org.organization?.commune || 'Sin ubicación'}</span>
              <span>📅 ${createdDate}</span>
            </div>
          </div>
          <div class="review-header-right">
            <div class="review-status-badge" style="${badgeStyle}">
              ${statusLabel}
            </div>
            <button class="review-close-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="preview-modal-body">
          <div class="preview-summary">
            <h3>Resumen de la Solicitud</h3>

            <div class="preview-stats">
              <div class="preview-stat">
                <div class="preview-stat-icon">👥</div>
                <div class="preview-stat-info">
                  <span class="preview-stat-value">${membersCount}</span>
                  <span class="preview-stat-label">Miembros Fundadores</span>
                </div>
              </div>
              <div class="preview-stat">
                <div class="preview-stat-icon">📄</div>
                <div class="preview-stat-info">
                  <span class="preview-stat-value">${docsCount}</span>
                  <span class="preview-stat-label">Documentos</span>
                </div>
              </div>
              <div class="preview-stat ${hasCommission ? 'complete' : 'incomplete'}">
                <div class="preview-stat-icon">${hasCommission ? '✅' : '⚠️'}</div>
                <div class="preview-stat-info">
                  <span class="preview-stat-value">${hasCommission ? 'Completa' : 'Incompleta'}</span>
                  <span class="preview-stat-label">Comisión Electoral</span>
                </div>
              </div>
            </div>

            <div class="preview-details">
              <div class="preview-detail-row">
                <span class="detail-label">Dirección</span>
                <span class="detail-value">${org.organization?.address || '-'}</span>
              </div>
              <div class="preview-detail-row">
                <span class="detail-label">Teléfono</span>
                <span class="detail-value">${org.organization?.phone || '-'}</span>
              </div>
              <div class="preview-detail-row">
                <span class="detail-label">Email</span>
                <span class="detail-value">${org.organization?.email || '-'}</span>
              </div>
              <div class="preview-detail-row">
                <span class="detail-label">Forma de Contacto Preferida</span>
                <span class="detail-value">${org.organization?.contactPreference === 'email' ? '📧 Email' : '📞 Teléfono'}</span>
              </div>
              ${org.organization?.preferredSchedule ? `
                <div class="preview-detail-row full">
                  <span class="detail-label">Días y Horarios de Preferencia</span>
                  <span class="detail-value">${org.organization.preferredSchedule}</span>
                </div>
              ` : ''}
              ${org.organization?.description ? `
                <div class="preview-detail-row full">
                  <span class="detail-label">Objetivos</span>
                  <span class="detail-value">${org.organization.description}</span>
                </div>
              ` : ''}
            </div>

            ${hasCommission ? `
              <div class="preview-commission">
                <h4>Comisión Electoral</h4>
                <div class="preview-commission-list">
                  ${org.commission.members.map((m, i) => `
                    <div class="preview-commission-member">
                      <span class="role">${['Presidente', 'Secretario', 'Vocal'][i]}</span>
                      <span class="name">${m.firstName} ${m.lastName}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="preview-modal-footer">
          <p class="preview-note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Al iniciar la revisión podrá ver todos los detalles y documentos de la solicitud
          </p>
          <div class="preview-actions">
            <button class="btn-cancel-preview">Cerrar</button>
            <button class="btn-start-review">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Iniciar Revisión
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.review-close-btn').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel-preview').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('.btn-start-review').addEventListener('click', () => {
      this.updateOrgStatus(org.id, ORG_STATUS.IN_REVIEW, 'Solicitud en revisión');
      modal.remove();
      // Abrir vista completa después de cambiar estado
      setTimeout(() => {
        const updatedOrg = organizationsService.getById(org.id);
        this.openFullReviewModal(updatedOrg);
      }, 100);
    });
  }

  /**
   * Modal de revisión completa (para solicitudes en revisión o posteriores)
   */
  openFullReviewModal(org) {
    const statusLabel = ORG_STATUS_LABELS[org.status] || org.status;
    const statusColor = ORG_STATUS_COLORS[org.status] || '#6b7280';
    // Estilo especial para sent_registry con mejor contraste
    const isSentRegistry = org.status === 'sent_registry';
    const badgeStyle = isSentRegistry
      ? 'background: #1e3a5f; color: #ffffff; border: 1px solid #1e3a5f'
      : `background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30`;
    const typeIcon = getOrgIcon(org.organization?.type);
    const typeName = getOrgTypeName(org.organization?.type);
    const membersCount = org.members?.length || 0;
    const createdDate = new Date(org.createdAt).toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const modal = document.createElement('div');
    modal.className = 'admin-review-modal-overlay';
    modal.innerHTML = `
      <div class="admin-review-modal">
        <div class="review-modal-header">
          <div class="review-header-left">
            <span class="review-type-badge">${typeIcon} ${typeName}</span>
            <h2>${org.organization?.name || 'Sin nombre'}</h2>
            <div class="review-header-meta">
              <span>📍 ${org.organization?.commune || 'Sin ubicación'}</span>
              <span>👥 ${membersCount} miembros</span>
              <span>📅 ${createdDate}</span>
            </div>
          </div>
          <div class="review-header-right">
            <div class="review-status-badge" style="${badgeStyle}">
              ${statusLabel}
            </div>
            <button class="review-close-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="review-modal-tabs">
          <button class="review-tab active" data-tab="info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Información
          </button>
          <button class="review-tab" data-tab="members">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Miembros
          </button>
          <button class="review-tab" data-tab="commission">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <line x1="19" y1="8" x2="19" y2="14"></line>
              <line x1="22" y1="11" x2="16" y2="11"></line>
            </svg>
            Comisión
          </button>
          <button class="review-tab" data-tab="documents">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            Documentos
          </button>
          <button class="review-tab" data-tab="history">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Historial
          </button>
        </div>

        ${this.renderNextStepIndicator(org)}

        <div class="review-modal-body">
          <div class="review-tab-content active" id="tab-info">
            ${this.renderInfoTab(org)}
          </div>
          <div class="review-tab-content" id="tab-members">
            ${this.renderMembersTab(org)}
          </div>
          <div class="review-tab-content" id="tab-commission">
            ${this.renderCommissionTab(org)}
          </div>
          <div class="review-tab-content" id="tab-documents">
            ${this.renderDocumentsTab(org)}
          </div>
          <div class="review-tab-content" id="tab-history">
            ${this.renderHistoryTab(org)}
          </div>
        </div>

        <div class="review-modal-footer">
          ${org.status === ORG_STATUS.IN_REVIEW ? `
            <div class="review-marked-count" style="display: none;">
              <span class="marked-count-badge">0</span>
              <span>campos marcados para corrección</span>
            </div>
          ` : ''}
          <div class="review-actions">
            ${org.status === ORG_STATUS.IN_REVIEW ? `
              <button class="btn-save-review" title="Guardar revisión actual">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                Guardar Revisión
              </button>
            ` : ''}
            ${this.renderActionButtons(org)}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Estado de correcciones marcadas
    const markedCorrections = {
      fields: {},
      documents: {},
      certificates: {},
      members: {},
      commission: {}
    };

    // Función para quitar una corrección
    const removeCorrection = (type, key) => {
      const markBtn = modal.querySelector(`.btn-mark-error[data-type="${type}"][data-key="${key}"]`);
      const fieldEl = markBtn?.closest('.review-field, .document-item-admin, .member-row, .commission-field, .commission-member-card');

      if (markBtn) {
        markBtn.classList.remove('active');
        markBtn.classList.remove('has-comment');
        const iconMark = markBtn.querySelector('.icon-mark');
        const iconComment = markBtn.querySelector('.icon-comment');
        if (iconMark) iconMark.style.display = 'block';
        if (iconComment) iconComment.style.display = 'none';
      }
      if (fieldEl) fieldEl.classList.remove('marked-error');

      if (type === 'field') delete markedCorrections.fields[key];
      else if (type === 'document') delete markedCorrections.documents[key];
      else if (type === 'certificate') delete markedCorrections.certificates[key];
      else if (type === 'member') delete markedCorrections.members[key];
      else if (type === 'commission') delete markedCorrections.commission[key];

      updateButtonStates();
    };

    // Función para actualizar estado de botones
    const updateButtonStates = () => {
      const totalMarked = Object.keys(markedCorrections.fields).length +
                          Object.keys(markedCorrections.documents).length +
                          Object.keys(markedCorrections.certificates).length +
                          Object.keys(markedCorrections.members).length +
                          Object.keys(markedCorrections.commission).length;

      const btnSendRegistry = modal.querySelector('.btn-send-registry');
      const btnReject = modal.querySelector('.btn-reject');
      const markedCountSection = modal.querySelector('.review-marked-count');
      const countBadge = modal.querySelector('.marked-count-badge');

      if (totalMarked > 0) {
        if (btnSendRegistry) {
          btnSendRegistry.disabled = true;
          btnSendRegistry.classList.add('disabled');
        }
        if (btnReject) {
          btnReject.disabled = false;
          btnReject.classList.remove('disabled');
        }
        if (markedCountSection) {
          markedCountSection.style.display = 'flex';
        }
        if (countBadge) {
          countBadge.textContent = totalMarked;
        }
      } else {
        if (btnSendRegistry) {
          btnSendRegistry.disabled = false;
          btnSendRegistry.classList.remove('disabled');
        }
        if (btnReject) {
          btnReject.disabled = true;
          btnReject.classList.add('disabled');
        }
        if (markedCountSection) {
          markedCountSection.style.display = 'none';
        }
      }
    };

    // Event listeners del modal
    modal.querySelector('.review-close-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Tabs - usar closest para manejar clicks en SVG
    modal.querySelectorAll('.review-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const clickedTab = e.target.closest('.review-tab');
        if (!clickedTab) return;

        modal.querySelectorAll('.review-tab').forEach(t => t.classList.remove('active'));
        modal.querySelectorAll('.review-tab-content').forEach(c => c.classList.remove('active'));
        clickedTab.classList.add('active');
        const tabContent = modal.querySelector(`#tab-${clickedTab.dataset.tab}`);
        if (tabContent) tabContent.classList.add('active');
      });
    });

    // Función para abrir modal de observación
    const openObservationModal = (type, key, label, existingComment = '') => {
      const obsModal = document.createElement('div');
      obsModal.className = 'observation-modal-overlay';
      obsModal.innerHTML = `
        <div class="observation-modal">
          <div class="observation-modal-header">
            <h3>Observación para corrección</h3>
            <button class="observation-modal-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="observation-modal-body">
            <div class="observation-field-label">
              <span class="obs-field-icon">📝</span>
              <span>${label}</span>
            </div>
            <textarea id="observation-textarea" placeholder="Escriba la observación que verá el solicitante sobre este campo...">${existingComment}</textarea>
          </div>
          <div class="observation-modal-footer">
            <button class="btn-remove-mark">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Quitar marcación
            </button>
            <button class="btn-save-observation">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Guardar
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(obsModal);

      const textarea = obsModal.querySelector('#observation-textarea');
      textarea.focus();

      // Cerrar modal
      const closeModal = () => obsModal.remove();
      obsModal.querySelector('.observation-modal-close').addEventListener('click', closeModal);
      obsModal.addEventListener('click', (e) => { if (e.target === obsModal) closeModal(); });

      // Guardar observación
      obsModal.querySelector('.btn-save-observation').addEventListener('click', () => {
        const comment = textarea.value.trim();
        const btn = modal.querySelector(`.btn-mark-error[data-type="${type}"][data-key="${key}"]`);
        const fieldEl = btn?.closest('.review-field, .document-item-admin, .member-row, .commission-field, .commission-member-card');

        // Guardar en correcciones
        if (type === 'field') markedCorrections.fields[key] = { comment, label };
        else if (type === 'document') markedCorrections.documents[key] = { comment, label };
        else if (type === 'certificate') markedCorrections.certificates[key] = { comment, label };
        else if (type === 'member') markedCorrections.members[key] = { comment, label };
        else if (type === 'commission') markedCorrections.commission[key] = { comment, label };

        // Actualizar visual del botón
        btn.classList.add('active');
        if (fieldEl) fieldEl.classList.add('marked-error');

        // Mostrar icono de comentario si hay observación
        const iconMark = btn.querySelector('.icon-mark');
        const iconComment = btn.querySelector('.icon-comment');
        if (comment) {
          btn.classList.add('has-comment');
          if (iconMark) iconMark.style.display = 'none';
          if (iconComment) iconComment.style.display = 'block';
        } else {
          btn.classList.remove('has-comment');
          if (iconMark) iconMark.style.display = 'block';
          if (iconComment) iconComment.style.display = 'none';
        }

        updateButtonStates();
        closeModal();
      });

      // Quitar marcación
      obsModal.querySelector('.btn-remove-mark').addEventListener('click', () => {
        removeCorrection(type, key);
        closeModal();
      });
    };

    // Event listeners para marcar errores
    modal.querySelectorAll('.btn-mark-error').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const key = btn.dataset.key;
        const label = btn.dataset.label || key;

        // Si ya está marcado, abrir modal para editar/quitar
        if (btn.classList.contains('active')) {
          let existingComment = '';
          if (type === 'field' && markedCorrections.fields[key]) {
            existingComment = markedCorrections.fields[key].comment || '';
          } else if (type === 'document' && markedCorrections.documents[key]) {
            existingComment = markedCorrections.documents[key].comment || '';
          } else if (type === 'certificate' && markedCorrections.certificates[key]) {
            existingComment = markedCorrections.certificates[key].comment || '';
          } else if (type === 'member' && markedCorrections.members[key]) {
            existingComment = markedCorrections.members[key].comment || '';
          } else if (type === 'commission' && markedCorrections.commission[key]) {
            existingComment = markedCorrections.commission[key].comment || '';
          }
          openObservationModal(type, key, label, existingComment);
          return;
        }

        // Si no está marcado, abrir modal para agregar observación
        openObservationModal(type, key, label, '');
      });
    });

    // Event listeners para PDFs oficiales
    modal.querySelectorAll('.btn-view-official-pdf').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = btn.dataset.docId;
        const orgId = btn.dataset.orgId;
        this.viewOfficialPDF(orgId, docId);
      });
    });

    modal.querySelectorAll('.btn-download-official-pdf').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = btn.dataset.docId;
        const orgId = btn.dataset.orgId;
        this.downloadOfficialPDF(orgId, docId);
      });
    });

    modal.querySelectorAll('.btn-download-all-pdfs').forEach(btn => {
      btn.addEventListener('click', () => {
        const orgId = btn.dataset.orgId;
        this.downloadAllPDFs(orgId);
      });
    });

    // Inicializar estado de botones
    if (org.status === ORG_STATUS.IN_REVIEW) {
      updateButtonStates();
    }

    // Botón guardar revisión
    modal.querySelector('.btn-save-review')?.addEventListener('click', () => {
      // Guardar estado actual en localStorage
      const reviewData = {
        orgId: org.id,
        corrections: markedCorrections,
        generalComment: modal.querySelector('#general-observation')?.value || '',
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(`review_draft_${org.id}`, JSON.stringify(reviewData));
      showToast('Revisión guardada correctamente', 'success');
    });

    // Cargar revisión guardada si existe
    const savedReview = localStorage.getItem(`review_draft_${org.id}`);
    if (savedReview && org.status === ORG_STATUS.IN_REVIEW) {
      try {
        const data = JSON.parse(savedReview);
        Object.assign(markedCorrections.fields, data.corrections?.fields || {});
        Object.assign(markedCorrections.documents, data.corrections?.documents || {});
        Object.assign(markedCorrections.certificates, data.corrections?.certificates || {});
        Object.assign(markedCorrections.members, data.corrections?.members || {});
        Object.assign(markedCorrections.commission, data.corrections?.commission || {});

        // Función para actualizar visual de botón guardado
        const updateSavedBtnVisual = (btn, fieldEl, comment) => {
          if (btn) {
            btn.classList.add('active');
            const iconMark = btn.querySelector('.icon-mark');
            const iconComment = btn.querySelector('.icon-comment');
            if (comment) {
              btn.classList.add('has-comment');
              if (iconMark) iconMark.style.display = 'none';
              if (iconComment) iconComment.style.display = 'block';
            }
          }
          if (fieldEl) fieldEl.classList.add('marked-error');
        };

        // Marcar visualmente los campos guardados
        Object.entries(markedCorrections.fields).forEach(([key, val]) => {
          const btn = modal.querySelector(`.btn-mark-error[data-type="field"][data-key="${key}"]`);
          const fieldEl = btn?.closest('.review-field');
          updateSavedBtnVisual(btn, fieldEl, val.comment);
        });
        Object.entries(markedCorrections.documents).forEach(([key, val]) => {
          const btn = modal.querySelector(`.btn-mark-error[data-type="document"][data-key="${key}"]`);
          const fieldEl = btn?.closest('.document-item-admin');
          updateSavedBtnVisual(btn, fieldEl, val.comment);
        });
        Object.entries(markedCorrections.certificates).forEach(([key, val]) => {
          const btn = modal.querySelector(`.btn-mark-error[data-type="certificate"][data-key="${key}"]`);
          const fieldEl = btn?.closest('.document-item-admin');
          updateSavedBtnVisual(btn, fieldEl, val.comment);
        });
        Object.entries(markedCorrections.members).forEach(([key, val]) => {
          const btn = modal.querySelector(`.btn-mark-error[data-type="member"][data-key="${key}"]`);
          const fieldEl = btn?.closest('.member-row');
          updateSavedBtnVisual(btn, fieldEl, val.comment);
        });
        Object.entries(markedCorrections.commission).forEach(([key, val]) => {
          const btn = modal.querySelector(`.btn-mark-error[data-type="commission"][data-key="${key}"]`);
          const fieldEl = btn?.closest('.commission-field, .commission-member-card');
          updateSavedBtnVisual(btn, fieldEl, val.comment);
        });

        updateButtonStates();
        showToast('Revisión anterior cargada', 'info');
      } catch (e) {
        console.error('Error loading saved review:', e);
      }
    }

    // Botones de acción
    modal.querySelector('.btn-reject')?.addEventListener('click', () => {
      // Generar lista de campos rechazados con observaciones editables
      const allCorrections = [
        ...Object.entries(markedCorrections.fields).map(([key, val]) => ({ type: 'field', key, ...val })),
        ...Object.entries(markedCorrections.documents).map(([key, val]) => ({ type: 'document', key, ...val })),
        ...Object.entries(markedCorrections.certificates).map(([key, val]) => ({ type: 'certificate', key, ...val })),
        ...Object.entries(markedCorrections.members).map(([key, val]) => ({ type: 'member', key, ...val })),
        ...Object.entries(markedCorrections.commission).map(([key, val]) => ({ type: 'commission', key, ...val }))
      ];

      const correctionsListHTML = allCorrections.map(item => `
        <div class="reject-correction-item" data-type="${item.type}" data-key="${item.key}">
          <div class="reject-item-header">
            <span class="reject-item-label">${item.label}</span>
            <button class="btn-remove-from-reject" data-type="${item.type}" data-key="${item.key}" title="Quitar de la lista">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <textarea class="reject-item-observation" data-type="${item.type}" data-key="${item.key}"
                    placeholder="Observación para este campo...">${item.comment || ''}</textarea>
        </div>
      `).join('');

      // Mostrar modal de confirmación con campos editables
      const confirmModal = document.createElement('div');
      confirmModal.className = 'admin-review-modal-overlay';
      confirmModal.innerHTML = `
        <div class="reject-confirm-modal reject-confirm-modal-expanded">
          <div class="reject-confirm-header">
            <h3>Confirmar Rechazo</h3>
            <button class="reject-confirm-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="reject-confirm-body">
            <div class="reject-corrections-list">
              <h4>Campos marcados para corrección (${allCorrections.length})</h4>
              <div class="reject-corrections-container">
                ${correctionsListHTML}
              </div>
            </div>
            <div class="general-observation-section">
              <label for="reject-general-observation">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Observación general para el solicitante (opcional)
              </label>
              <textarea id="reject-general-observation" placeholder="Agregue una observación general sobre el rechazo..."></textarea>
            </div>
          </div>
          <div class="reject-confirm-footer">
            <button class="btn-cancel-reject">Cancelar</button>
            <button class="btn-confirm-reject">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              Confirmar Rechazo
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(confirmModal);

      // Event listeners del modal de confirmación
      confirmModal.querySelector('.reject-confirm-close').addEventListener('click', () => confirmModal.remove());
      confirmModal.querySelector('.btn-cancel-reject').addEventListener('click', () => confirmModal.remove());
      confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) confirmModal.remove(); });

      // Event listeners para quitar campos del rechazo
      confirmModal.querySelectorAll('.btn-remove-from-reject').forEach(btn => {
        btn.addEventListener('click', () => {
          const type = btn.dataset.type;
          const key = btn.dataset.key;

          // Quitar del modal
          btn.closest('.reject-correction-item').remove();

          // Quitar de markedCorrections y actualizar vista principal
          removeCorrection(type, key);

          // Actualizar contador
          const remaining = confirmModal.querySelectorAll('.reject-correction-item').length;
          confirmModal.querySelector('.reject-corrections-list h4').textContent =
            `Campos marcados para corrección (${remaining})`;

          // Si no quedan campos, cerrar modal
          if (remaining === 0) {
            confirmModal.remove();
            showToast('No hay campos marcados para rechazar', 'info');
          }
        });
      });

      // Event listeners para actualizar observaciones en tiempo real
      confirmModal.querySelectorAll('.reject-item-observation').forEach(textarea => {
        textarea.addEventListener('input', () => {
          const type = textarea.dataset.type;
          const key = textarea.dataset.key;
          const comment = textarea.value.trim();

          if (type === 'field' && markedCorrections.fields[key]) {
            markedCorrections.fields[key].comment = comment;
          } else if (type === 'document' && markedCorrections.documents[key]) {
            markedCorrections.documents[key].comment = comment;
          } else if (type === 'certificate' && markedCorrections.certificates[key]) {
            markedCorrections.certificates[key].comment = comment;
          } else if (type === 'member' && markedCorrections.members[key]) {
            markedCorrections.members[key].comment = comment;
          } else if (type === 'commission' && markedCorrections.commission[key]) {
            markedCorrections.commission[key].comment = comment;
          }
        });
      });

      confirmModal.querySelector('.btn-confirm-reject').addEventListener('click', () => {
        const generalComment = confirmModal.querySelector('#reject-general-observation')?.value.trim() || '';

        // Recolectar todas las correcciones con sus comentarios actualizados
        const corrections = {
          fields: { ...markedCorrections.fields },
          documents: { ...markedCorrections.documents },
          certificates: { ...markedCorrections.certificates },
          members: { ...markedCorrections.members },
          commission: { ...markedCorrections.commission }
        };

        const result = organizationsService.rejectWithCorrections(org.id, corrections, generalComment);
        if (result) {
          // Limpiar borrador guardado
          localStorage.removeItem(`review_draft_${org.id}`);
          showToast('Solicitud rechazada con correcciones especificadas', 'success');
          confirmModal.remove();
          modal.remove();
          this.renderApplicationsList();
          this.updateStats();
        } else {
          showToast('Error al procesar el rechazo', 'error');
        }
      });
    });

    modal.querySelector('.btn-send-registry')?.addEventListener('click', () => {
      this.updateOrgStatus(org.id, ORG_STATUS.SENT_TO_REGISTRY, 'Enviada al Registro Civil');
      modal.remove();
    });

    modal.querySelector('.btn-approve')?.addEventListener('click', () => {
      this.updateOrgStatus(org.id, ORG_STATUS.APPROVED, 'Organización aprobada');
      modal.remove();
    });

    // FASE 5: Botón de disolución
    modal.querySelector('.btn-dissolve-org')?.addEventListener('click', () => {
      this.openDissolveModal(org, modal);
    });

    // Event listeners para ver documentos
    modal.querySelectorAll('.btn-view-doc-admin').forEach(btn => {
      btn.addEventListener('click', () => {
        const docType = btn.dataset.docType;
        this.viewDocument(org, docType);
      });
    });

    // Event listeners para imprimir documentos
    modal.querySelectorAll('.btn-print-doc-admin').forEach(btn => {
      btn.addEventListener('click', () => {
        const docType = btn.dataset.docType;
        this.printDocument(org, docType);
      });
    });

    // Event listeners para ver certificados
    modal.querySelectorAll('.btn-view-cert-admin').forEach(btn => {
      btn.addEventListener('click', () => {
        const memberId = btn.dataset.memberId;
        this.viewCertificate(org, memberId);
      });
    });
  }

  /**
   * Muestra un documento en un modal con formato
   */
  viewDocument(org, docType) {
    const doc = org.documents?.[docType];
    if (!doc) {
      showToast('Documento no disponible', 'error');
      return;
    }

    const docNames = {
      'ACTA_CONSTITUTIVA': 'Acta Constitutiva',
      'ESTATUTOS': 'Estatutos',
      'REGISTRO_SOCIOS': 'Registro de Socios',
      'DECLARACION_JURADA_PRESIDENTE': 'Declaración Jurada',
      'ACTA_COMISION_ELECTORAL': 'Acta Comisión Electoral'
    };

    // Configuración de qué firmas requiere cada documento
    const docSignatureConfig = {
      'ACTA_CONSTITUTIVA': [0, 1],           // Presidente y Secretario
      'ESTATUTOS': [0, 1],                    // Presidente y Secretario
      'REGISTRO_SOCIOS': [1],                 // Solo Secretario
      'DECLARACION_JURADA_PRESIDENTE': [0],   // Solo Presidente
      'ACTA_COMISION_ELECTORAL': [0, 1, 2]    // Los 3 miembros
    };

    const requiredSigners = docSignatureConfig[docType] || [];
    const signaturesHTML = this.generateSignaturesHTML(org, requiredSigners);

    // Separar contenido de firmas si existe
    const contentText = doc.content ? doc.content.split('========== FIRMAS ==========')[0] : '';

    const docModal = document.createElement('div');
    docModal.className = 'document-view-modal-overlay';
    docModal.innerHTML = `
      <div class="document-view-modal">
        <div class="document-view-header">
          <h3>${docNames[docType] || docType}</h3>
          <button class="doc-close-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="document-view-body">
          <pre class="document-content-preview">${this.escapeHtml(contentText)}</pre>
          ${signaturesHTML}
        </div>
        <div class="document-view-footer">
          <button class="btn-close-doc">Cerrar</button>
        </div>
      </div>
    `;

    document.body.appendChild(docModal);

    docModal.querySelector('.doc-close-btn').addEventListener('click', () => docModal.remove());
    docModal.querySelector('.btn-close-doc').addEventListener('click', () => docModal.remove());
    docModal.addEventListener('click', (e) => { if (e.target === docModal) docModal.remove(); });
  }

  /**
   * Escapa HTML para evitar inyección
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Genera el HTML visual de las firmas para el preview del documento
   */
  generateSignaturesHTML(org, signerIndices = [0, 1, 2]) {
    const signatures = org.signatures || {};
    const commission = org.commission?.members || [];
    const roles = ['Presidente', 'Secretario', 'Vocal'];

    if (commission.length === 0) return '';

    // Filtrar solo los miembros que deben firmar este documento
    const signers = signerIndices
      .filter(idx => idx < commission.length)
      .map(idx => ({ member: commission[idx], index: idx }));

    if (signers.length === 0) return '';

    // Ajustar grid según cantidad de firmantes
    const gridClass = signers.length === 1 ? 'signatures-grid-single' :
                      signers.length === 2 ? 'signatures-grid-double' : 'signatures-grid';

    let html = `
      <div class="document-signatures-section">
        <h4 class="signatures-title">FIRMA${signers.length > 1 ? 'S' : ''}</h4>
        <div class="${gridClass}">
    `;

    signers.forEach(({ member, index }) => {
      const signature = signatures[member.id];
      const role = roles[index] || 'Miembro';

      html += `
        <div class="signature-block">
          <div class="signature-area">
      `;

      if (signature) {
        if (signature.type === 'drawn' && signature.data) {
          html += `<img src="${signature.data}" alt="Firma de ${member.firstName}" class="signature-image">`;
        } else if (signature.type === 'digital') {
          html += `
            <div class="digital-signature-stamp">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <span>FIRMA ELECTRÓNICA</span>
              <small>Clave Única - ${new Date(signature.timestamp).toLocaleDateString('es-CL')}</small>
            </div>
          `;
        } else if (signature.type === 'manual') {
          html += `
            <div class="manual-signature-stamp">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
              </svg>
              <span>PENDIENTE FIRMA MANUAL</span>
              <small>Se firmará en documento físico</small>
            </div>
          `;
        }
      } else {
        html += `
          <div class="pending-signature">
            <span class="pending-text">Sin firma</span>
          </div>
        `;
      }

      html += `
          </div>
          <div class="signature-line"></div>
          <div class="signature-info">
            <span class="signature-name">${member.firstName} ${member.lastName}</span>
            <span class="signature-rut">${member.rut}</span>
            <span class="signature-role">${role} Comisión Electoral</span>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Ver certificado de antecedentes
   */
  viewCertificate(org, memberId) {
    const cert = org.certificates?.[memberId];
    if (!cert) {
      showToast('Certificado no disponible', 'error');
      return;
    }

    const member = org.commission?.members?.find(m => m.id === memberId);
    const memberName = member ? `${member.firstName} ${member.lastName}` : 'Miembro';

    // Determinar si es PDF o imagen
    const isPDF = cert.data && cert.data.startsWith('data:application/pdf');
    const isImage = cert.data && cert.data.startsWith('data:image/');

    const certModal = document.createElement('div');
    certModal.className = 'document-view-modal-overlay';
    certModal.innerHTML = `
      <div class="document-view-modal certificate-modal ${isPDF ? 'pdf-modal' : ''}">
        <div class="document-view-header">
          <h3>Certificado de Antecedentes - ${memberName}</h3>
          <button class="doc-close-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="document-view-body certificate-body">
          ${isPDF ? `
            <iframe src="${cert.data}" class="certificate-pdf-viewer" title="Certificado de ${memberName}"></iframe>
          ` : isImage ? `
            <img src="${cert.data}" alt="Certificado de ${memberName}" class="certificate-image">
          ` : cert.fileName ? `
            <div class="certificate-file-info">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span class="cert-filename">${cert.fileName}</span>
              <span class="cert-upload-date">Subido: ${new Date(cert.uploadedAt).toLocaleDateString('es-CL')}</span>
              ${cert.data ? `
                <a href="${cert.data}" download="${cert.fileName}" class="btn-download-cert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Descargar
                </a>
              ` : ''}
            </div>
          ` : `
            <p class="no-data">Certificado no disponible para visualización</p>
          `}
        </div>
        <div class="document-view-footer">
          ${cert.data ? `
            <a href="${cert.data}" download="${cert.fileName || 'certificado.pdf'}" class="btn-download-cert-footer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Descargar
            </a>
          ` : ''}
          <button class="btn-close-doc">Cerrar</button>
        </div>
      </div>
    `;

    document.body.appendChild(certModal);

    certModal.querySelector('.doc-close-btn').addEventListener('click', () => certModal.remove());
    certModal.querySelector('.btn-close-doc').addEventListener('click', () => certModal.remove());
    certModal.addEventListener('click', (e) => { if (e.target === certModal) certModal.remove(); });
  }

  /**
   * Imprimir documento
   */
  printDocument(org, docType) {
    const doc = org.documents?.[docType];
    if (!doc) {
      showToast('Documento no disponible', 'error');
      return;
    }

    const docNames = {
      'ACTA_CONSTITUTIVA': 'Acta Constitutiva',
      'ESTATUTOS': 'Estatutos',
      'REGISTRO_SOCIOS': 'Registro de Socios',
      'DECLARACION_JURADA_PRESIDENTE': 'Declaración Jurada',
      'ACTA_COMISION_ELECTORAL': 'Acta Comisión Electoral'
    };

    // Configuración de qué firmas requiere cada documento
    const docSignatureConfig = {
      'ACTA_CONSTITUTIVA': [0, 1],
      'ESTATUTOS': [0, 1],
      'REGISTRO_SOCIOS': [1],
      'DECLARACION_JURADA_PRESIDENTE': [0],
      'ACTA_COMISION_ELECTORAL': [0, 1, 2]
    };

    const requiredSigners = docSignatureConfig[docType] || [];
    const signaturesHTML = this.generateSignaturesHTML(org, requiredSigners);
    const contentText = doc.content ? doc.content.split('========== FIRMAS ==========')[0] : '';

    // Crear ventana de impresión
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${docNames[docType] || docType} - ${org.organization?.name || 'Documento'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12pt;
            line-height: 1.6;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          .document-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #333;
          }
          .document-header h1 {
            font-size: 16pt;
            margin-bottom: 10px;
          }
          .document-header p {
            font-size: 10pt;
            color: #666;
          }
          .document-content {
            white-space: pre-wrap;
            word-wrap: break-word;
            margin-bottom: 40px;
          }
          .signatures-section {
            margin-top: 60px;
            page-break-inside: avoid;
          }
          .signatures-section h4 {
            text-align: center;
            margin-bottom: 40px;
            font-size: 12pt;
            letter-spacing: 2px;
          }
          .signatures-grid {
            display: flex;
            justify-content: space-around;
            flex-wrap: wrap;
            gap: 30px;
          }
          .signature-block {
            text-align: center;
            min-width: 200px;
          }
          .signature-area {
            min-height: 80px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            margin-bottom: 5px;
          }
          .signature-image {
            max-width: 150px;
            max-height: 60px;
          }
          .signature-line {
            width: 100%;
            border-top: 1px solid #333;
            margin: 5px 0;
          }
          .signature-name {
            font-weight: bold;
            font-size: 10pt;
          }
          .signature-rut {
            font-size: 9pt;
            color: #666;
          }
          .signature-role {
            font-size: 9pt;
            font-style: italic;
            color: #666;
          }
          .digital-stamp, .manual-stamp {
            font-size: 8pt;
            padding: 8px;
            border: 1px dashed #666;
            border-radius: 4px;
            margin-bottom: 5px;
          }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="document-header">
          <h1>${docNames[docType] || docType}</h1>
          <p>${org.organization?.name || ''}</p>
        </div>
        <div class="document-content">${this.escapeHtml(contentText)}</div>
        ${this.generatePrintSignaturesHTML(org, requiredSigners)}
      </body>
      </html>
    `);
    printWindow.document.close();

    // Esperar a que carguen las imágenes y luego imprimir
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }

  /**
   * Genera HTML de firmas optimizado para impresión
   */
  generatePrintSignaturesHTML(org, signerIndices) {
    const signatures = org.signatures || {};
    const commission = org.commission?.members || [];
    const roles = ['Presidente', 'Secretario', 'Vocal'];

    if (commission.length === 0) return '';

    const signers = signerIndices
      .filter(idx => idx < commission.length)
      .map(idx => ({ member: commission[idx], index: idx }));

    if (signers.length === 0) return '';

    let html = `
      <div class="signatures-section">
        <h4>FIRMA${signers.length > 1 ? 'S' : ''}</h4>
        <div class="signatures-grid">
    `;

    signers.forEach(({ member, index }) => {
      const signature = signatures[member.id];
      const role = roles[index] || 'Miembro';

      html += `<div class="signature-block">`;
      html += `<div class="signature-area">`;

      if (signature) {
        if (signature.type === 'drawn' && signature.data) {
          html += `<img src="${signature.data}" alt="Firma" class="signature-image">`;
        } else if (signature.type === 'digital') {
          html += `<div class="digital-stamp">FIRMA ELECTRÓNICA<br>Clave Única</div>`;
        } else if (signature.type === 'manual') {
          html += `<div class="manual-stamp">PENDIENTE<br>FIRMA MANUAL</div>`;
        }
      }

      html += `</div>`;
      html += `<div class="signature-line"></div>`;
      html += `<div class="signature-name">${member.firstName} ${member.lastName}</div>`;
      html += `<div class="signature-rut">${member.rut}</div>`;
      html += `<div class="signature-role">${role} Comisión Electoral</div>`;
      html += `</div>`;
    });

    html += `</div></div>`;
    return html;
  }

  /**
   * Renderiza el tab de información con opción de marcar campos para corrección
   */
  renderInfoTab(org, canReview = true) {
    const o = org.organization || {};
    const isReviewable = canReview && org.status === ORG_STATUS.IN_REVIEW;

    const renderField = (key, label, value, fullWidth = false) => {
      if (!value && key !== 'neighborhood') return '';
      return `
        <div class="review-field ${fullWidth ? 'full-width' : ''} ${isReviewable ? 'reviewable' : ''}" data-field-key="${key}">
          <div class="field-content">
            <label>${label}</label>
            ${fullWidth ? `<p>${value || '-'}</p>` : `<span>${value || '-'}</span>`}
          </div>
          ${isReviewable ? `
            <div class="field-review-action">
              <button class="btn-mark-error" data-type="field" data-key="${key}" data-label="${label}" title="Marcar para corrección">
                <svg class="icon-mark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <svg class="icon-comment" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </button>
            </div>
          ` : ''}
        </div>
      `;
    };

    return `
      <div class="review-section">
        <div class="review-field">
          <div class="field-content">
            <label>Tipo de Organización</label>
            <span>${getOrgTypeName(o.type)}</span>
          </div>
        </div>
        ${renderField('name', 'Nombre', o.name)}
        ${renderField('address', 'Dirección', o.address)}
        ${renderField('region', 'Región', o.region)}
        ${renderField('commune', 'Comuna', o.commune)}
        ${o.neighborhood ? renderField('neighborhood', 'Unidad Vecinal', o.neighborhood) : ''}
        ${renderField('email', 'Email', o.email)}
        ${renderField('phone', 'Teléfono', o.phone)}
        ${renderField('description', 'Objetivos', o.description, true)}
      </div>
    `;
  }

  /**
   * Renderiza el tab de miembros
   */
  renderMembersTab(org, canReview = true) {
    const members = org.members || [];
    const isReviewable = canReview && org.status === ORG_STATUS.IN_REVIEW;

    if (members.length === 0) {
      return '<p class="no-data">No hay miembros registrados</p>';
    }

    return `
      <div class="review-members-list">
        <div class="members-count">Total: ${members.length} miembros fundadores</div>
        <table class="members-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre</th>
              <th>RUT</th>
              ${isReviewable ? '<th class="th-action">Acción</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${members.map((m, i) => {
              const memberId = m.id || `member_${i}`;
              const memberLabel = `Miembro #${i + 1}: ${m.firstName} ${m.lastName}`;
              return `
                <tr class="member-row ${isReviewable ? 'reviewable' : ''}" data-member-id="${memberId}">
                  <td>${i + 1}</td>
                  <td>${m.firstName} ${m.lastName}</td>
                  <td>${m.rut}</td>
                  ${isReviewable ? `
                    <td class="td-action">
                      <button class="btn-mark-error btn-mark-member" data-type="member" data-key="${memberId}" data-label="${memberLabel}" title="Marcar para corrección">
                        <svg class="icon-mark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="15" y1="9" x2="9" y2="15"></line>
                          <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                        <svg class="icon-comment" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                      </button>
                    </td>
                  ` : ''}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Renderiza el tab de comisión
   */
  renderCommissionTab(org, canReview = true) {
    const commission = org.commission;
    const isReviewable = canReview && org.status === ORG_STATUS.IN_REVIEW;

    if (!commission?.members?.length) {
      return '<p class="no-data">No hay comisión electoral registrada</p>';
    }

    const roles = ['Presidente', 'Secretario', 'Vocal'];
    const signatures = org.signatures || {};

    return `
      <div class="review-commission">
        <div class="commission-field ${isReviewable ? 'reviewable' : ''}" data-field-key="electionDate">
          <div class="commission-field-content">
            <label>Fecha de Elección</label>
            <span>${commission.electionDate ? (() => {
              const [year, month, day] = commission.electionDate.split('-').map(Number);
              const date = new Date(year, month - 1, day);
              return date.toLocaleDateString('es-CL');
            })() : '-'}</span>
          </div>
          ${isReviewable ? `
            <button class="btn-mark-error" data-type="commission" data-key="electionDate" data-label="Fecha de Elección" title="Marcar para corrección">
              <svg class="icon-mark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              <svg class="icon-comment" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
          ` : ''}
        </div>

        <h4 class="commission-subtitle">Miembros de la Comisión Electoral</h4>
        <div class="commission-members-review">
          ${commission.members.map((m, i) => {
            const sig = signatures[m.id];
            const memberId = m.id || `commission_member_${i}`;
            const memberLabel = `${roles[i]} Comisión: ${m.firstName} ${m.lastName}`;
            return `
              <div class="commission-member-card ${isReviewable ? 'reviewable' : ''}" data-member-id="${memberId}">
                <div class="commission-member-info">
                  <div class="member-role">${roles[i]}</div>
                  <div class="member-name">${m.firstName} ${m.lastName}</div>
                  <div class="member-rut">${m.rut}</div>
                  <div class="member-signature ${sig ? 'signed' : 'pending'}">
                    ${sig
                      ? `✓ Firmado (${sig.type === 'drawn' ? 'Digital' : sig.type === 'digital' ? 'Clave Única' : 'Manual'})`
                      : '⚠️ Sin firma'}
                  </div>
                </div>
                ${isReviewable ? `
                  <button class="btn-mark-error btn-mark-commission" data-type="commission" data-key="${memberId}" data-label="${memberLabel}" title="Marcar para corrección">
                    <svg class="icon-mark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <svg class="icon-comment" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </button>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Renderiza el tab de documentos con opción de marcar para corrección
   */
  renderDocumentsTab(org, canReview = true) {
    const documents = org.documents || {};
    const isReviewable = canReview && org.status === ORG_STATUS.IN_REVIEW;
    const hasMinistroApproval = org.status === ORG_STATUS.MINISTRO_APPROVED ||
                                org.provisionalDirectorio ||
                                org.comisionElectoral;

    const docNames = {
      'ACTA_CONSTITUTIVA': 'Acta Constitutiva',
      'ESTATUTOS': 'Estatutos',
      'REGISTRO_SOCIOS': 'Registro de Socios',
      'DECLARACION_JURADA_PRESIDENTE': 'Declaración Jurada',
      'ACTA_COMISION_ELECTORAL': 'Acta Comisión Electoral'
    };

    // Documentos oficiales generados por el sistema
    const officialDocs = [
      { id: 'acta_asamblea', name: 'Acta de Asamblea General Constitutiva', icon: '📜', required: true },
      { id: 'lista_socios', name: 'Lista de Socios Constitución', icon: '📋', required: true },
      { id: 'certificado', name: 'Certificado del Ministro de Fe', icon: '🏛️', required: true },
      { id: 'certificacion', name: 'Certificación Municipal', icon: '📄', required: true },
      { id: 'deposito', name: 'Depósito de Antecedentes', icon: '📁', required: true }
    ];

    // Declaraciones juradas por director
    const directorio = org.provisionalDirectorio || {};
    const declaracionesJuradas = [];
    if (directorio.president) {
      declaracionesJuradas.push({ id: 'decl_presidente', name: `Declaración Jurada - Presidente: ${directorio.president.name}`, icon: '✍️' });
    }
    if (directorio.secretary) {
      declaracionesJuradas.push({ id: 'decl_secretario', name: `Declaración Jurada - Secretario: ${directorio.secretary.name}`, icon: '✍️' });
    }
    if (directorio.treasurer) {
      declaracionesJuradas.push({ id: 'decl_tesorero', name: `Declaración Jurada - Tesorero: ${directorio.treasurer.name}`, icon: '✍️' });
    }
    if (directorio.additionalMembers) {
      directorio.additionalMembers.forEach((member, i) => {
        declaracionesJuradas.push({ id: `decl_adicional_${i}`, name: `Declaración Jurada - ${member.cargo || 'Director'}: ${member.name}`, icon: '✍️' });
      });
    }

    const docList = Object.entries(documents);
    const hasOfficialDocs = hasMinistroApproval;

    if (docList.length === 0 && !org.certificates && !hasOfficialDocs) {
      return '<p class="no-data">No hay documentos generados. Los documentos oficiales se generarán automáticamente cuando el Ministro de Fe apruebe la asamblea constitutiva.</p>';
    }

    const roles = ['Presidente', 'Secretario', 'Vocal'];

    return `
      <div class="review-documents-list">
        ${hasOfficialDocs ? `
          <div class="official-docs-section">
            <h4 class="docs-subtitle" style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#065f46" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              Documentos Oficiales (Ley Nº 19.418)
            </h4>
            <p style="font-size: 12px; color: #6b7280; margin-bottom: 12px;">
              Documentos generados automáticamente con los datos validados por el Ministro de Fe.
            </p>
            ${officialDocs.map(doc => `
              <div class="document-item-admin official-doc" style="border-left: 3px solid #10b981;">
                <div class="doc-info">
                  <span class="doc-icon">${doc.icon}</span>
                  <span class="doc-name">${doc.name}</span>
                  <span class="doc-badge" style="background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">Oficial</span>
                </div>
                <div class="doc-actions">
                  <button class="btn-view-official-pdf" data-doc-id="${doc.id}" data-org-id="${org.id}" title="Ver documento" style="background: #ecfdf5; color: #065f46; border: 1px solid #10b981; padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    Ver
                  </button>
                  <button class="btn-download-official-pdf" data-doc-id="${doc.id}" data-org-id="${org.id}" title="Descargar PDF" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Descargar
                  </button>
                </div>
              </div>
            `).join('')}

            ${declaracionesJuradas.length > 0 ? `
              <h5 style="margin: 16px 0 8px; font-size: 13px; color: #374151; font-weight: 600;">Declaraciones Juradas de Directores</h5>
              ${declaracionesJuradas.map(doc => `
                <div class="document-item-admin official-doc" style="border-left: 3px solid #f59e0b;">
                  <div class="doc-info">
                    <span class="doc-icon">${doc.icon}</span>
                    <span class="doc-name" style="font-size: 13px;">${doc.name}</span>
                  </div>
                  <div class="doc-actions">
                    <button class="btn-view-official-pdf" data-doc-id="${doc.id}" data-org-id="${org.id}" title="Ver documento" style="background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      Ver
                    </button>
                    <button class="btn-download-official-pdf" data-doc-id="${doc.id}" data-org-id="${org.id}" title="Descargar PDF" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      Descargar
                    </button>
                  </div>
                </div>
              `).join('')}
            ` : ''}

            <div style="margin-top: 16px; padding: 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac;">
              <button class="btn-download-all-pdfs" data-org-id="${org.id}" style="
                width: 100%;
                padding: 12px 20px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
              ">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Descargar Todos los Documentos
              </button>
            </div>
          </div>
        ` : ''}

        ${docList.length > 0 ? `
          <h4 class="docs-subtitle" style="margin-top: ${hasOfficialDocs ? '24px' : '0'};">Documentos Subidos</h4>
          ${docList.map(([type, doc]) => `
            <div class="document-item-admin ${isReviewable ? 'reviewable' : ''}">
              <div class="doc-info">
                <span class="doc-icon">📄</span>
                <span class="doc-name">${docNames[type] || type}</span>
                ${doc.signaturesApplied ? `<span class="doc-signatures">${doc.signaturesApplied} firmas</span>` : ''}
              </div>
              <div class="doc-actions">
                <button class="btn-view-doc-admin" data-doc-type="${type}" title="Ver documento">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  Ver
                </button>
                <button class="btn-print-doc-admin" data-doc-type="${type}" title="Imprimir documento">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                  Imprimir
                </button>
                ${isReviewable ? `
                  <button class="btn-mark-error doc-error" data-type="document" data-key="${type}" data-label="${docNames[type] || type}" title="Marcar para corrección">
                    <svg class="icon-mark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <svg class="icon-comment" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        ` : ''}

        ${org.certificates ? `
          <h4 class="docs-subtitle">Certificados de Antecedentes</h4>
          ${Object.entries(org.certificates).map(([memberId, cert]) => {
            const memberIndex = org.commission?.members?.findIndex(m => m.id === memberId) ?? -1;
            const member = org.commission?.members?.[memberIndex];
            const role = roles[memberIndex] || 'Miembro';
            const certLabel = `Certificado ${role}: ${member ? `${member.firstName} ${member.lastName}` : 'Miembro'}`;
            return `
              <div class="document-item-admin ${isReviewable ? 'reviewable' : ''}">
                <div class="doc-info">
                  <span class="doc-icon">📋</span>
                  <span class="doc-name">${role}: ${member ? `${member.firstName} ${member.lastName}` : 'Miembro'}</span>
                  <span class="cert-uploaded-badge">✓ Subido</span>
                </div>
                <div class="doc-actions">
                  <button class="btn-view-cert-admin" data-member-id="${memberId}" title="Ver certificado">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    Ver
                  </button>
                  ${isReviewable ? `
                    <button class="btn-mark-error doc-error" data-type="certificate" data-key="${memberId}" data-label="${certLabel}" title="Marcar para corrección">
                      <svg class="icon-mark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                      </svg>
                      <svg class="icon-comment" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        ` : ''}
      </div>
    `;
  }

  /**
   * Renderiza el indicador de próximo paso según el estado
   */
  renderNextStepIndicator(org) {
    const status = org.status;
    let icon = '';
    let title = '';
    let message = '';
    let bgColor = '';
    let borderColor = '';
    let iconBg = '';

    switch (status) {
      case ORG_STATUS.WAITING_MINISTRO_REQUEST:
        icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>`;
        title = 'Esperando Accion del Administrador';
        message = 'El usuario completó los pasos iniciales. Debe agendar un Ministro de Fe para validar la asamblea constitutiva.';
        bgColor = '#fef3c7';
        borderColor = '#f59e0b';
        iconBg = '#f59e0b';
        break;

      case ORG_STATUS.MINISTRO_SCHEDULED:
        icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>`;
        title = 'Esperando Validacion del Ministro de Fe';
        message = 'Ministro de Fe agendado. Se espera que asista a la asamblea constitutiva y valide las firmas de los miembros fundadores.';
        bgColor = '#dbeafe';
        borderColor = '#3b82f6';
        iconBg = '#3b82f6';
        break;

      case ORG_STATUS.MINISTRO_APPROVED:
        icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <polyline points="16 11 18 13 22 9"></polyline>
        </svg>`;
        title = 'Esperando Accion del Usuario';
        message = 'El Ministro de Fe validó la asamblea. El usuario debe continuar con el proceso completando los pasos restantes del formulario (documentos, comisión electoral, etc.).';
        bgColor = '#d1fae5';
        borderColor = '#10b981';
        iconBg = '#10b981';
        break;

      case ORG_STATUS.PENDING_REVIEW:
        icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>`;
        title = 'Esperando Revision del Administrador';
        message = 'El usuario completó todos los pasos. La solicitud está lista para ser revisada por el administrador.';
        bgColor = '#fef3c7';
        borderColor = '#f59e0b';
        iconBg = '#f59e0b';
        break;

      case ORG_STATUS.IN_REVIEW:
        icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>`;
        title = 'En Revision por Administrador';
        message = 'El administrador está revisando la solicitud. Puede aprobar, solicitar correcciones o enviar al Registro Civil.';
        bgColor = '#e0e7ff';
        borderColor = '#6366f1';
        iconBg = '#6366f1';
        break;

      case ORG_STATUS.REJECTED:
        icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>`;
        title = 'Esperando Correcciones del Usuario';
        message = 'Se solicitaron correcciones al usuario. Debe modificar los campos indicados y reenviar la solicitud.';
        bgColor = '#fee2e2';
        borderColor = '#ef4444';
        iconBg = '#ef4444';
        break;

      case ORG_STATUS.SENT_TO_REGISTRY:
        icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>`;
        title = 'Enviada al Registro Civil';
        message = 'La solicitud fue enviada al Registro Civil para su inscripción oficial. Esperando confirmación.';
        bgColor = '#dbeafe';
        borderColor = '#1e3a5f';
        iconBg = '#1e3a5f';
        break;

      case ORG_STATUS.APPROVED:
        icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>`;
        title = 'Proceso Completado';
        message = 'La organización ha sido aprobada e inscrita oficialmente. No hay acciones pendientes.';
        bgColor = '#d1fae5';
        borderColor = '#059669';
        iconBg = '#059669';
        break;

      default:
        return '';
    }

    return `
      <div class="next-step-indicator" style="
        background: ${bgColor};
        border: 1px solid ${borderColor};
        border-radius: 12px;
        padding: 14px 18px;
        margin: 0 24px 16px;
        display: flex;
        align-items: flex-start;
        gap: 14px;
      ">
        <div style="
          background: ${iconBg};
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        ">
          ${icon}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 14px; color: #1f2937; margin-bottom: 4px;">
            ${title}
          </div>
          <div style="font-size: 13px; color: #4b5563; line-height: 1.5;">
            ${message}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza el tab de historial
   */
  renderHistoryTab(org) {
    const history = org.statusHistory || [];
    if (history.length === 0) {
      return '<p class="no-data">Sin historial de estados</p>';
    }

    return `
      <div class="review-history">
        ${history.map(h => `
          <div class="history-item">
            <div class="history-dot" style="background: ${ORG_STATUS_COLORS[h.status] || '#6b7280'}"></div>
            <div class="history-content">
              <div class="history-status">${ORG_STATUS_LABELS[h.status] || h.status}</div>
              <div class="history-date">${new Date(h.date).toLocaleString('es-CL')}</div>
              ${h.comment ? `<div class="history-comment">${h.comment}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Renderiza los botones de acción según el estado
   */
  renderActionButtons(org) {
    const status = org.status;

    switch (status) {
      case ORG_STATUS.PENDING_REVIEW:
        return `
          <button class="btn-secondary btn-start-review">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            Iniciar Revisión
          </button>
        `;

      case ORG_STATUS.IN_REVIEW:
        return `
          <button class="btn-danger btn-reject">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            Rechazar
          </button>
          <button class="btn-primary btn-send-registry">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13"></path>
              <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
            </svg>
            Enviar a Registro Civil
          </button>
        `;

      case ORG_STATUS.SENT_TO_REGISTRY:
        return `
          <button class="btn-danger btn-reject">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            Rechazar
          </button>
          <button class="btn-success btn-approve">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Aprobar Organización
          </button>
        `;

      case ORG_STATUS.APPROVED:
        return `
          <span class="status-final">✅ Organización aprobada</span>
          <button class="btn-danger btn-dissolve-org" style="margin-left: auto;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            Disolver Organización
          </button>
        `;

      case ORG_STATUS.REJECTED:
        return `
          <span class="status-final rejected">⚠️ Solicitud rechazada - Esperando correcciones del usuario</span>
        `;

      default:
        return '';
    }
  }

  /**
   * Actualiza el estado de una organización
   */
  updateOrgStatus(orgId, newStatus, comment) {
    const org = organizationsService.updateStatus(orgId, newStatus, comment);
    if (org) {
      showToast(`Estado actualizado: ${ORG_STATUS_LABELS[newStatus]}`, 'success');
      this.renderApplicationsList();
      this.updateStats();
    } else {
      showToast('Error al actualizar el estado', 'error');
    }
  }

  /**
   * FASE 5: Modal para disolver organización
   */
  openDissolveModal(org, parentModal) {
    const confirmModal = document.createElement('div');
    confirmModal.className = 'admin-review-modal-overlay';
    confirmModal.style.zIndex = '10002';

    confirmModal.innerHTML = `
      <div class="admin-review-modal" style="max-width: 500px;">
        <div class="review-modal-header" style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);">
          <h3 style="color: #dc2626; margin: 0;">⚠️ Disolver Organización</h3>
          <button class="review-close-btn dissolve-cancel">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="review-modal-body" style="padding: 24px;">
          <div style="background: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>Esta acción es irreversible.</strong> La organización será marcada como disuelta y no podrá realizar más actividades.
            </p>
          </div>

          <div style="margin-bottom: 16px;">
            <strong>Organización:</strong> ${org.organization?.name}
          </div>

          <form id="dissolve-form">
            <div class="form-group">
              <label>Razón de la disolución <span class="required">*</span></label>
              <select name="reason" required style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 12px;">
                <option value="">Seleccionar...</option>
                <option value="incumplimiento">Incumplimiento de responsabilidades</option>
                <option value="inactiva">Organización inactiva</option>
                <option value="solicitud_usuario">Solicitud del usuario</option>
                <option value="violacion_estatutos">Violación de estatutos</option>
                <option value="irregularidades">Irregularidades detectadas</option>
                <option value="otra">Otra razón</option>
              </select>
            </div>

            <div class="form-group">
              <label>Detalles adicionales</label>
              <textarea name="details" rows="4"
                placeholder="Describa los motivos específicos de la disolución..."
                style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;"></textarea>
            </div>

            <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary dissolve-cancel">Cancelar</button>
              <button type="submit" class="btn btn-danger">Confirmar Disolución</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(confirmModal);

    // Event listeners
    confirmModal.querySelectorAll('.dissolve-cancel').forEach(btn => {
      btn.addEventListener('click', () => confirmModal.remove());
    });

    const form = confirmModal.querySelector('#dissolve-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const reason = formData.get('reason');
      const details = formData.get('details');

      const reasonLabels = {
        'incumplimiento': 'Incumplimiento de responsabilidades',
        'inactiva': 'Organización inactiva',
        'solicitud_usuario': 'Solicitud del usuario',
        'violacion_estatutos': 'Violación de estatutos',
        'irregularidades': 'Irregularidades detectadas',
        'otra': 'Otra razón'
      };

      const fullReason = `${reasonLabels[reason]}${details ? ': ' + details : ''}`;

      const result = organizationsService.dissolveOrganization(org.id, fullReason, 'admin');
      if (result) {
        showToast('Organización disuelta correctamente', 'success');
        confirmModal.remove();
        parentModal.remove();
        this.renderApplicationsList();
        this.updateStats();
      } else {
        showToast('Error al disolver la organización', 'error');
      }
    });
  }

  /**
   * FASE 2: Modal para gestión de Ministro de Fe
   */
  openMinistroModal(org) {
    const isWaiting = org.status === ORG_STATUS.WAITING_MINISTRO_REQUEST;
    const isScheduled = org.status === ORG_STATUS.MINISTRO_SCHEDULED;

    const modal = document.createElement('div');
    modal.className = 'admin-review-modal-overlay';

    // Parsear fecha correctamente para evitar desfase de zona horaria
    let electionDate = 'No especificada';
    if (org.electionDate) {
      const [year, month, day] = org.electionDate.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      electionDate = date.toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }

    // Parsear fecha correctamente para evitar desfase de zona horaria
    let formattedUserDate = electionDate;
    if (org.electionDate) {
      const [year, month, day] = org.electionDate.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      formattedUserDate = date.toLocaleDateString('es-CL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      formattedUserDate = formattedUserDate.charAt(0).toUpperCase() + formattedUserDate.slice(1);
    }

    // Preferencia de contacto
    const contactPref = org.organization?.contactPreference;
    const contactLabel = contactPref === 'email' ? 'Correo Electrónico' : 'Teléfono';
    const contactValue = contactPref === 'email' ? org.organization?.email : org.organization?.phone;

    modal.innerHTML = `
      <div class="admin-review-modal ministro-request-modal">
        <div class="review-modal-header" style="background: linear-gradient(135deg, #fff4e6 0%, #ffe0b2 100%);">
          <div class="review-header-left">
            <h2 style="color: #ff9800;">📝 Solicitud de Ministro de Fe</h2>
            <p style="margin: 4px 0 0; color: #f57c00; font-size: 14px;">${org.organization?.name}</p>
          </div>
          <button class="review-close-btn ministro-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="review-modal-body" style="padding: 24px;">
          <!-- Sección destacada: Solicitud del Usuario -->
          <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #1e40af; font-size: 16px; display: flex; align-items: center; gap: 8px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
              Solicitud del Usuario
            </h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
              <div style="background: white; padding: 14px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">📅 Fecha Solicitada</span>
                <p style="margin: 6px 0 0; font-size: 15px; font-weight: 600; color: #1e293b;">${formattedUserDate}</p>
              </div>
              <div style="background: white; padding: 14px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">🕐 Hora Solicitada</span>
                <p style="margin: 6px 0 0; font-size: 15px; font-weight: 600; color: #1e293b;">${org.electionTime || 'No especificada'}</p>
              </div>
              <div style="background: white; padding: 14px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); grid-column: 1 / -1;">
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">📍 Dirección Solicitada para Asamblea</span>
                <p style="margin: 6px 0 0; font-size: 15px; font-weight: 600; color: #1e293b;">${org.assemblyAddress || 'No especificada'}</p>
              </div>
              <div style="background: white; padding: 14px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); grid-column: 1 / -1;">
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">${contactPref === 'email' ? '📧' : '📞'} Preferencia de Contacto</span>
                <p style="margin: 6px 0 0; font-size: 15px; font-weight: 600; color: #1e293b;">${contactLabel}: ${contactValue || 'No especificado'}</p>
              </div>
            </div>
            ${org.comments ? `
              <div style="margin-top: 16px; padding: 14px; background: white; border-radius: 8px; border-left: 3px solid #3b82f6;">
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">💬 Comentarios del Usuario</span>
                <p style="margin: 6px 0 0; color: #334155; font-size: 14px;">${org.comments}</p>
              </div>
            ` : ''}
          </div>

          <!-- Información de la Organización -->
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
            <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px;">Información de la Organización</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; color: #4b5563; font-size: 14px;">
              <div><strong>Tipo:</strong> ${getOrgTypeName(org.organization?.type)}</div>
              <div><strong>Comuna:</strong> ${org.organization?.commune || 'N/A'}</div>
              <div><strong>Miembros Fundadores:</strong> ${org.members?.length || 0}</div>
              <div><strong>Dirección Organización:</strong> ${org.organization?.address || 'N/A'}</div>
            </div>
          </div>

          ${isWaiting ? `
            <div style="background: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 8px 0; color: #1e40af; font-size: 16px;">Acción Requerida</h3>
              <p style="margin: 0; color: #3b82f6; font-size: 14px;">
                Esta organización requiere que se asigne un <strong>Ministro de Fe</strong> para la asamblea de constitución.
              </p>
            </div>

            <form id="schedule-ministro-form">
              <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 16px;">Agendar Ministro de Fe</h3>

              <div class="form-group">
                <label>Seleccionar Ministro de Fe <span class="required">*</span></label>
                <select name="ministroId" id="ministro-select" required class="input-styled">
                  <option value="">-- Selecciona fecha y hora primero --</option>
                </select>
                <p id="ministro-availability-warning" style="color: #f59e0b; font-size: 13px; margin-top: 8px; display: none;">
                  ℹ️ Los ministros listados están disponibles para la fecha/hora seleccionada
                </p>
                ${ministroService.getActive().length === 0 ? `
                  <p style="color: #ef4444; font-size: 14px; margin-top: 8px;">
                    ⚠️ No hay Ministros de Fe activos. Por favor, agrega uno en <strong>Gestionar Ministros de Fe</strong>.
                  </p>
                ` : ''}
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>Fecha de la Asamblea <span class="required">*</span></label>
                  <input type="date" name="scheduledDate" required
                    value="${org.electionDate || ''}"
                    min="${new Date().toISOString().split('T')[0]}">
                </div>

                <div class="form-group">
                  <label>Hora <span class="required">*</span></label>
                  <select name="scheduledTime" required class="input-styled">
                    <option value="">-- Seleccionar Hora --</option>
                    ${(() => {
                      const baseHours = ministroAvailabilityService.getAvailableHours();
                      const userTime = org.electionTime || '';
                      // Include user's requested time if not already in the list
                      const allHours = userTime && !baseHours.includes(userTime)
                        ? [...baseHours, userTime].sort()
                        : baseHours;
                      return allHours.map(hour => `
                        <option value="${hour}" ${hour === userTime ? 'selected' : ''}>
                          ${hour}${hour === userTime && !baseHours.includes(hour) ? ' (solicitado)' : ''}
                        </option>
                      `).join('');
                    })()}
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label>Lugar de la Reunión <span class="required">*</span></label>
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;" id="location-options-container"
                     data-user-address="${org.assemblyAddress || ''}"
                     data-org-address="${org.organization?.address || ''}"
                     data-muni-address="Blanco Encalada 1335, Renca">
                  <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; transition: all 0.2s;" class="location-option">
                    <input type="radio" name="locationOption" value="user" style="width: 16px; height: 16px;" ${org.assemblyAddress ? 'checked' : ''}>
                    <div style="flex: 1;">
                      <strong style="display: block; color: #1f2937; font-size: 14px;">Dirección solicitada por usuario</strong>
                      <span style="font-size: 13px; color: #6b7280;">${org.assemblyAddress || 'No especificada'}</span>
                    </div>
                  </label>
                  <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; transition: all 0.2s;" class="location-option">
                    <input type="radio" name="locationOption" value="org" style="width: 16px; height: 16px;" ${!org.assemblyAddress ? 'checked' : ''}>
                    <div style="flex: 1;">
                      <strong style="display: block; color: #1f2937; font-size: 14px;">Dirección de la organización</strong>
                      <span style="font-size: 13px; color: #6b7280;">${org.organization?.address || 'No especificada'}</span>
                    </div>
                  </label>
                  <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; transition: all 0.2s;" class="location-option">
                    <input type="radio" name="locationOption" value="muni" style="width: 16px; height: 16px;">
                    <div style="flex: 1;">
                      <strong style="display: block; color: #1f2937; font-size: 14px;">Municipalidad de Renca</strong>
                      <span style="font-size: 13px; color: #6b7280;">Blanco Encalada 1335, Renca</span>
                    </div>
                  </label>
                  <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; transition: all 0.2s;" class="location-option">
                    <input type="radio" name="locationOption" value="custom" style="width: 16px; height: 16px;">
                    <div style="flex: 1;">
                      <strong style="display: block; color: #1f2937; font-size: 14px;">Otra dirección</strong>
                      <input type="text" id="custom-location-input" placeholder="Escriba la dirección..."
                        style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 6px; display: none;"
                        disabled>
                    </div>
                  </label>
                </div>
                <input type="hidden" name="location" id="final-location" value="${org.assemblyAddress || org.organization?.address || ''}" required>
              </div>

              <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary ministro-close">Cancelar</button>
                <button type="submit" class="btn btn-primary">📅 Agendar Ministro de Fe</button>
              </div>
            </form>
          ` : ''}

          ${isScheduled ? `
            <div style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 48px; height: 48px; background: #10b981; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  </div>
                  <div>
                    <h3 style="margin: 0; color: #065f46; font-size: 18px; font-weight: 700;">Ministro de Fe Agendado</h3>
                    <p style="margin: 4px 0 0; color: #047857; font-size: 13px;">La asamblea ha sido programada exitosamente</p>
                  </div>
                </div>
                <button type="button" id="btn-edit-ministro" class="btn btn-secondary" style="font-size: 13px; padding: 8px 14px; display: flex; align-items: center; gap: 6px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Modificar Asignación
                </button>
              </div>

              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: white; padding: 16px; border-radius: 10px;">
                <div style="padding: 12px; background: #f0fdf4; border-radius: 8px;">
                  <span style="font-size: 11px; color: #047857; text-transform: uppercase; font-weight: 600;">⚖️ Ministro de Fe</span>
                  <p style="margin: 6px 0 0; font-size: 15px; font-weight: 600; color: #065f46;">${org.ministroData?.name}</p>
                  <p style="margin: 2px 0 0; font-size: 13px; color: #047857;">RUT: ${org.ministroData?.rut}</p>
                </div>
                <div style="padding: 12px; background: #f0fdf4; border-radius: 8px;">
                  <span style="font-size: 11px; color: #047857; text-transform: uppercase; font-weight: 600;">📅 Fecha y Hora</span>
                  <p style="margin: 6px 0 0; font-size: 15px; font-weight: 600; color: #065f46;">${(() => {
                    if (org.ministroData?.scheduledDate) {
                      const [year, month, day] = org.ministroData.scheduledDate.split('-').map(Number);
                      const date = new Date(year, month - 1, day);
                      return date.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                    }
                    return 'No especificada';
                  })()}</p>
                  <p style="margin: 2px 0 0; font-size: 13px; color: #047857;">Hora: ${org.ministroData?.scheduledTime || 'No especificada'}</p>
                </div>
                <div style="padding: 12px; background: #f0fdf4; border-radius: 8px; grid-column: 1 / -1;">
                  <span style="font-size: 11px; color: #047857; text-transform: uppercase; font-weight: 600;">📍 Lugar</span>
                  <p style="margin: 6px 0 0; font-size: 15px; font-weight: 600; color: #065f46;">${org.ministroData?.location || 'No especificado'}</p>
                </div>
              </div>
            </div>

            <div style="background: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <div style="font-size: 24px;">⏳</div>
                <div>
                  <h3 style="margin: 0 0 6px 0; color: #1e40af; font-size: 15px; font-weight: 600;">Esperando Validación del Ministro de Fe</h3>
                  <p style="margin: 0; color: #3b82f6; font-size: 14px; line-height: 1.5;">
                    El <strong>Ministro de Fe</strong> debe presidir la asamblea, validar las firmas de los miembros y designar el <strong>Directorio Provisorio</strong>.
                    Esta acción se realiza desde el panel del Ministro de Fe.
                  </p>
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary ministro-close">Cerrar</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelectorAll('.ministro-close').forEach(btn => {
      btn.addEventListener('click', () => modal.remove());
    });

    // Button: Edit Ministro
    const btnEditMinistro = modal.querySelector('#btn-edit-ministro');
    if (btnEditMinistro) {
      btnEditMinistro.addEventListener('click', () => {
        modal.remove();
        this.openEditMinistroModal(org);
      });
    }

    // Form: Schedule Ministro
    const scheduleForm = modal.querySelector('#schedule-ministro-form');
    if (scheduleForm) {
      // Función para actualizar el dropdown de ministros según disponibilidad
      const updateMinistroDropdown = () => {
        const dateInput = scheduleForm.querySelector('input[name="scheduledDate"]');
        const timeSelect = scheduleForm.querySelector('select[name="scheduledTime"]');
        const ministroSelect = scheduleForm.querySelector('#ministro-select');
        const warning = scheduleForm.querySelector('#ministro-availability-warning');

        const selectedDate = dateInput.value;
        const selectedTime = timeSelect.value;

        if (!selectedDate || !selectedTime) {
          ministroSelect.innerHTML = '<option value="">-- Selecciona fecha y hora primero --</option>';
          warning.style.display = 'none';
          return;
        }

        // Filtrar ministros disponibles
        const allMinistros = ministroService.getActive();
        const availableMinistros = allMinistros.filter(ministro =>
          ministroAvailabilityService.isAvailable(ministro.id, selectedDate, selectedTime)
        );

        // Actualizar dropdown
        if (availableMinistros.length === 0) {
          ministroSelect.innerHTML = '<option value="">⚠️ No hay ministros disponibles para esta fecha/hora</option>';
          warning.style.display = 'block';
          warning.style.color = '#ef4444';
          warning.textContent = '⚠️ Ningún ministro está disponible. Todos tienen bloqueada esta fecha/hora.';
        } else {
          ministroSelect.innerHTML = `
            <option value="">-- Seleccionar Ministro de Fe (${availableMinistros.length} disponible${availableMinistros.length !== 1 ? 's' : ''}) --</option>
            ${availableMinistros.map(ministro => `
              <option value="${ministro.id}">
                ${ministro.firstName} ${ministro.lastName} - ${ministro.rut}
              </option>
            `).join('')}
          `;
          warning.style.display = 'block';
          warning.style.color = '#059669';
          warning.textContent = `✓ ${availableMinistros.length} ministro(s) disponible(s) para esta fecha/hora`;
        }

        // Mostrar ministros no disponibles en consola para debug
        const unavailableMinistros = allMinistros.filter(ministro =>
          !ministroAvailabilityService.isAvailable(ministro.id, selectedDate, selectedTime)
        );
        if (unavailableMinistros.length > 0) {
          console.log('🚫 Ministros NO disponibles:', unavailableMinistros.map(m => `${m.firstName} ${m.lastName}`));
        }
      };

      // Event listeners para fecha y hora
      const dateInput = scheduleForm.querySelector('input[name="scheduledDate"]');
      const timeSelect = scheduleForm.querySelector('select[name="scheduledTime"]');

      if (dateInput) {
        dateInput.addEventListener('change', updateMinistroDropdown);
      }
      if (timeSelect) {
        timeSelect.addEventListener('change', updateMinistroDropdown);
      }

      // Actualizar al cargar si ya hay fecha y hora
      updateMinistroDropdown();

      // Event listeners para selector de ubicación
      const locationRadios = scheduleForm.querySelectorAll('input[name="locationOption"]');
      const customLocationInput = scheduleForm.querySelector('#custom-location-input');
      const finalLocationInput = scheduleForm.querySelector('#final-location');
      const locationOptions = scheduleForm.querySelectorAll('.location-option');
      const locationContainer = scheduleForm.querySelector('#location-options-container');

      // Obtener direcciones de los data attributes
      const userAddress = locationContainer?.dataset.userAddress || '';
      const orgAddress = locationContainer?.dataset.orgAddress || '';
      const muniAddress = locationContainer?.dataset.muniAddress || 'Blanco Encalada 1335, Renca';

      const updateLocationValue = () => {
        const selectedRadio = scheduleForm.querySelector('input[name="locationOption"]:checked');
        if (!selectedRadio) return;

        // Actualizar estilos visuales
        locationOptions.forEach(option => {
          option.style.borderColor = '#d1d5db';
          option.style.background = 'white';
        });
        const selectedOption = selectedRadio.closest('.location-option');
        if (selectedOption) {
          selectedOption.style.borderColor = '#3b82f6';
          selectedOption.style.background = '#eff6ff';
        }

        switch (selectedRadio.value) {
          case 'user':
            finalLocationInput.value = userAddress;
            if (customLocationInput) {
              customLocationInput.style.display = 'none';
              customLocationInput.disabled = true;
            }
            break;
          case 'org':
            finalLocationInput.value = orgAddress;
            if (customLocationInput) {
              customLocationInput.style.display = 'none';
              customLocationInput.disabled = true;
            }
            break;
          case 'muni':
            finalLocationInput.value = muniAddress;
            if (customLocationInput) {
              customLocationInput.style.display = 'none';
              customLocationInput.disabled = true;
            }
            break;
          case 'custom':
            if (customLocationInput) {
              customLocationInput.style.display = 'block';
              customLocationInput.disabled = false;
              customLocationInput.focus();
              finalLocationInput.value = customLocationInput.value;
            }
            break;
        }
      };

      locationRadios.forEach(radio => {
        radio.addEventListener('change', updateLocationValue);
      });

      if (customLocationInput) {
        customLocationInput.addEventListener('input', () => {
          if (finalLocationInput) {
            finalLocationInput.value = customLocationInput.value;
          }
        });
      }

      // Inicializar valor de ubicación
      updateLocationValue();

      scheduleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(scheduleForm);

        // Obtener el Ministro de Fe seleccionado
        const ministroId = formData.get('ministroId');
        const ministro = ministroService.getById(ministroId);

        if (!ministro) {
          showToast('Error: Ministro de Fe no encontrado', 'error');
          return;
        }

        const scheduledDate = formData.get('scheduledDate');
        const scheduledTime = formData.get('scheduledTime');
        const location = formData.get('location');

        // Verificar disponibilidad del ministro
        const isAvailable = ministroAvailabilityService.isAvailable(ministroId, scheduledDate, scheduledTime);
        if (!isAvailable) {
          showToast('⚠️ El ministro no está disponible en esta fecha/hora. Ha bloqueado su disponibilidad.', 'error');
          return;
        }

        // Verificar conflictos de horario
        const hasConflict = ministroAssignmentService.hasScheduleConflict(ministroId, scheduledDate, scheduledTime);
        if (hasConflict) {
          const confirmed = confirm(
            `⚠️ ADVERTENCIA: El ministro ${ministro.firstName} ${ministro.lastName} ya tiene otra asamblea agendada en esta fecha y hora.\n\n` +
            `Fecha: ${new Date(scheduledDate).toLocaleDateString('es-CL')}\n` +
            `Hora: ${scheduledTime}\n\n` +
            `¿Estás seguro de que deseas continuar con esta asignación?\n` +
            `(El ministro podría realizar múltiples asambleas al mismo horario)`
          );

          if (!confirmed) {
            return;
          }
        }

        const ministroData = {
          name: `${ministro.firstName} ${ministro.lastName}`,
          rut: ministro.rut,
          scheduledDate,
          scheduledTime,
          location
        };

        const updated = organizationsService.scheduleMinistro(org.id, ministroData);
        if (updated) {
          // Crear asignación para el ministro
          try {
            ministroAssignmentService.create({
              ministroId: ministro.id,
              ministroName: `${ministro.firstName} ${ministro.lastName}`,
              ministroRut: ministro.rut,
              organizationId: org.id,
              organizationName: org.organization?.name || org.organizationName,
              scheduledDate,
              scheduledTime,
              location
            });

            // Enviar notificaciones
            const { notificationService } = await import('../../services/NotificationService.js');

            // Notificación al usuario - primera asignación
            notificationService.create({
              userId: org.userId,
              type: 'ministro_assigned',
              title: '✅ Ministro de Fe Asignado',
              message: `¡Tu solicitud ha sido procesada! Se ha asignado un Ministro de Fe para la asamblea de ${org.organization?.name}.\n\n` +
                      `Ministro: ${ministro.firstName} ${ministro.lastName}\n` +
                      `Fecha: ${new Date(scheduledDate).toLocaleDateString('es-CL')} a las ${scheduledTime}\n` +
                      `Lugar: ${location}`,
              data: { organizationId: org.id, ministroData }
            });

            // Notificación al ministro - nueva asignación
            notificationService.create({
              ministroId: ministro.id,
              type: 'new_assignment',
              title: '⚖️ Nueva Asignación de Asamblea',
              message: `Se te ha asignado una nueva asamblea constitutiva.\n\n` +
                      `Organización: ${org.organization?.name}\n` +
                      `Fecha: ${new Date(scheduledDate).toLocaleDateString('es-CL')} a las ${scheduledTime}\n` +
                      `Lugar: ${location}`,
              data: { organizationId: org.id, scheduledDate, scheduledTime, location }
            });

            showToast('Ministro de Fe agendado correctamente. Notificados: usuario y ministro.', 'success');
            modal.remove();
            this.renderApplicationsList();
            this.updateStats();
          } catch (error) {
            console.error('Error creating assignment:', error);
            showToast('Agendado, pero error al crear asignación', 'error');
          }
        } else {
          showToast('Error al agendar Ministro de Fe', 'error');
        }
      });
    }

    // Form: Approve Ministro & Designate Directorio
    const approveForm = modal.querySelector('#approve-ministro-form');
    if (approveForm) {
      // Canvas signature setup
      const canvas = modal.querySelector('#ministro-signature-canvas');
      const clearBtn = modal.querySelector('#clear-signature');

      if (canvas) {
        const ctx = canvas.getContext('2d');
        let isDrawing = false;

        // Set canvas size
        canvas.width = canvas.offsetWidth;
        canvas.height = 150;

        canvas.addEventListener('mousedown', (e) => {
          isDrawing = true;
          ctx.beginPath();
          ctx.moveTo(e.offsetX, e.offsetY);
        });

        canvas.addEventListener('mousemove', (e) => {
          if (isDrawing) {
            ctx.lineTo(e.offsetX, e.offsetY);
            ctx.stroke();
          }
        });

        canvas.addEventListener('mouseup', () => isDrawing = false);
        canvas.addEventListener('mouseleave', () => isDrawing = false);

        clearBtn?.addEventListener('click', () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        });
      }

      approveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(approveForm);

        const presidentId = formData.get('president');
        const secretaryId = formData.get('secretary');
        const treasurerId = formData.get('treasurer');

        // Validar que no se repitan
        if (presidentId === secretaryId || presidentId === treasurerId || secretaryId === treasurerId) {
          showToast('Los cargos deben ser asignados a diferentes personas', 'error');
          return;
        }

        // Obtener signature
        const signatureData = canvas?.toDataURL('image/png');
        if (!signatureData || signatureData === canvas?.toDataURL()) {
          showToast('Por favor firme en el recuadro', 'error');
          return;
        }

        const president = org.members.find(m => m.id === presidentId);
        const secretary = org.members.find(m => m.id === secretaryId);
        const treasurer = org.members.find(m => m.id === treasurerId);

        const provisionalDirectorio = { president, secretary, treasurer };

        const updated = organizationsService.approveByMinistro(org.id, provisionalDirectorio, signatureData);
        if (updated) {
          showToast('Directorio Provisorio designado. La organización puede continuar el proceso.', 'success');
          modal.remove();
          this.renderApplicationsList();
          this.updateStats();
        } else {
          showToast('Error al aprobar', 'error');
        }
      });
    }
  }

  /**
   * Modal para editar ministro asignado
   */
  openEditMinistroModal(org) {
    const modal = document.createElement('div');
    modal.className = 'admin-review-modal-overlay';

    // Obtener la asignación actual
    const currentAssignment = ministroAssignmentService.getByOrganizationId(org.id)[0];

    modal.innerHTML = `
      <div class="admin-review-modal" style="max-width: 600px;">
        <div class="review-modal-header" style="background: linear-gradient(135deg, #fff4e6 0%, #ffe0b2 100%);">
          <div class="review-header-left">
            <h2 style="color: #ff9800;">✏️ Editar Ministro de Fe Asignado</h2>
            <p style="margin: 4px 0 0; color: #f57c00; font-size: 14px;">${org.organization?.name}</p>
          </div>
          <button class="review-close-btn edit-ministro-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="review-modal-body" style="padding: 24px;">
          <div style="background: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <h4 style="margin: 0 0 8px 0; color: #1e40af;">Asignación Actual:</h4>
            <div style="color: #3b82f6; font-size: 14px;">
              <p style="margin: 4px 0;"><strong>Ministro:</strong> ${org.ministroData?.name}</p>
              <p style="margin: 4px 0;"><strong>Fecha:</strong> ${new Date(org.ministroData?.scheduledDate).toLocaleDateString('es-CL')}</p>
              <p style="margin: 4px 0;"><strong>Hora:</strong> ${org.ministroData?.scheduledTime}</p>
            </div>
          </div>

          <form id="edit-ministro-form">
            <div class="form-group">
              <label>Nuevo Ministro de Fe <span class="required">*</span></label>
              <select name="ministroId" id="edit-ministro-select" required class="input-styled">
                ${ministroService.getActive().map(ministro => {
                  const isCurrentMinistro = currentAssignment && currentAssignment.ministroId === ministro.id;
                  return `
                    <option value="${ministro.id}" ${isCurrentMinistro ? 'selected' : ''}>
                      ${ministro.firstName} ${ministro.lastName} - ${ministro.rut}
                    </option>
                  `;
                }).join('')}
              </select>
              <p id="edit-ministro-availability-warning" style="color: #f59e0b; font-size: 13px; margin-top: 8px; display: none;">
                ℹ️ Los ministros listados están disponibles para la fecha/hora seleccionada
              </p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label>Nueva Fecha <span class="required">*</span></label>
                <input type="date" name="scheduledDate" required
                  value="${org.ministroData?.scheduledDate || ''}"
                  min="${new Date().toISOString().split('T')[0]}">
              </div>

              <div class="form-group">
                <label>Nueva Hora <span class="required">*</span></label>
                <select name="scheduledTime" required class="input-styled">
                  <option value="">-- Seleccionar Hora --</option>
                  ${ministroAvailabilityService.getAvailableHours().map(hour => {
                    const currentTime = org.ministroData?.scheduledTime || '10:00';
                    const normalizedCurrent = ministroAvailabilityService.normalizeTime(currentTime);
                    return `
                      <option value="${hour}" ${hour === normalizedCurrent ? 'selected' : ''}>
                        ${hour}
                      </option>
                    `;
                  }).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Lugar <span class="required">*</span></label>
              <input type="text" name="location" required
                value="${org.ministroData?.location || ''}"
                placeholder="Ej: Municipalidad de Renca, Sala de Reuniones">
            </div>

            <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary edit-ministro-close">Cancelar</button>
              <button type="submit" class="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelectorAll('.edit-ministro-close').forEach(btn => {
      btn.addEventListener('click', () => modal.remove());
    });

    const editForm = modal.querySelector('#edit-ministro-form');

    // Función para actualizar el dropdown de ministros según disponibilidad
    const updateEditMinistroDropdown = () => {
      const dateInput = editForm.querySelector('input[name="scheduledDate"]');
      const timeSelect = editForm.querySelector('select[name="scheduledTime"]');
      const ministroSelect = editForm.querySelector('#edit-ministro-select');
      const warning = editForm.querySelector('#edit-ministro-availability-warning');

      const selectedDate = dateInput.value;
      const selectedTime = timeSelect.value;

      if (!selectedDate || !selectedTime) {
        warning.style.display = 'none';
        return;
      }

      // Filtrar ministros disponibles
      const allMinistros = ministroService.getActive();
      const currentMinistroId = currentAssignment?.ministroId;
      const availableMinistros = allMinistros.filter(ministro =>
        ministro.id === currentMinistroId || // Siempre incluir el ministro actual
        ministroAvailabilityService.isAvailable(ministro.id, selectedDate, selectedTime)
      );

      // Actualizar dropdown manteniendo la selección actual
      const selectedValue = ministroSelect.value;

      if (availableMinistros.length === 0) {
        ministroSelect.innerHTML = '<option value="">⚠️ No hay ministros disponibles para esta fecha/hora</option>';
        warning.style.display = 'block';
        warning.style.color = '#ef4444';
        warning.textContent = '⚠️ Ningún ministro está disponible para esta fecha/hora.';
      } else {
        ministroSelect.innerHTML = availableMinistros.map(ministro => {
          const isCurrentMinistro = ministro.id === currentMinistroId;
          const isSelected = ministro.id === selectedValue || (selectedValue === '' && isCurrentMinistro);
          return `
            <option value="${ministro.id}" ${isSelected ? 'selected' : ''}>
              ${ministro.firstName} ${ministro.lastName} - ${ministro.rut}${isCurrentMinistro ? ' (Actual)' : ''}
            </option>
          `;
        }).join('');

        warning.style.display = 'block';
        warning.style.color = '#059669';
        warning.textContent = `✓ ${availableMinistros.length} ministro(s) disponible(s) para esta fecha/hora`;
      }

      // Mostrar ministros no disponibles en consola para debug
      const unavailableMinistros = allMinistros.filter(ministro =>
        ministro.id !== currentMinistroId &&
        !ministroAvailabilityService.isAvailable(ministro.id, selectedDate, selectedTime)
      );
      if (unavailableMinistros.length > 0) {
        console.log('🚫 Ministros NO disponibles (editar):', unavailableMinistros.map(m => `${m.firstName} ${m.lastName}`));
      }
    };

    // Event listeners para fecha y hora
    const editDateInput = editForm.querySelector('input[name="scheduledDate"]');
    const editTimeSelect = editForm.querySelector('select[name="scheduledTime"]');

    if (editDateInput) {
      editDateInput.addEventListener('change', updateEditMinistroDropdown);
    }
    if (editTimeSelect) {
      editTimeSelect.addEventListener('change', updateEditMinistroDropdown);
    }

    // Actualizar al cargar
    updateEditMinistroDropdown();

    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(editForm);

      const ministroId = formData.get('ministroId');
      const ministro = ministroService.getById(ministroId);

      if (!ministro) {
        showToast('Error: Ministro de Fe no encontrado', 'error');
        return;
      }

      const scheduledDate = formData.get('scheduledDate');
      const scheduledTime = formData.get('scheduledTime');
      const location = formData.get('location');

      // Verificar disponibilidad del nuevo ministro
      const isAvailable = ministroAvailabilityService.isAvailable(ministroId, scheduledDate, scheduledTime);
      if (!isAvailable) {
        showToast('⚠️ El ministro no está disponible en esta fecha/hora', 'error');
        return;
      }

      // Verificar conflictos (solo si es diferente ministro o diferente horario)
      const isDifferentMinistro = !currentAssignment || currentAssignment.ministroId !== ministroId;
      const isDifferentSchedule = org.ministroData?.scheduledDate !== scheduledDate || org.ministroData?.scheduledTime !== scheduledTime;

      if (isDifferentMinistro || isDifferentSchedule) {
        const hasConflict = ministroAssignmentService.hasScheduleConflict(ministroId, scheduledDate, scheduledTime);
        if (hasConflict) {
          const confirmed = confirm(
            `⚠️ ADVERTENCIA: El ministro ${ministro.firstName} ${ministro.lastName} ya tiene otra asamblea en esta fecha/hora.\n\n` +
            `¿Deseas continuar de todas formas?`
          );
          if (!confirmed) return;
        }
      }

      const oldMinistroData = { ...org.ministroData };

      const newMinistroData = {
        name: `${ministro.firstName} ${ministro.lastName}`,
        rut: ministro.rut,
        scheduledDate,
        scheduledTime,
        location
      };

      // Actualizar la organización con los nuevos datos
      const updated = organizationsService.scheduleMinistro(org.id, newMinistroData);

      if (updated) {
        // Actualizar o crear asignación
        if (currentAssignment) {
          ministroAssignmentService.update(currentAssignment.id, {
            ministroId: ministro.id,
            ministroName: `${ministro.firstName} ${ministro.lastName}`,
            ministroRut: ministro.rut,
            scheduledDate,
            scheduledTime,
            location
          });
        } else {
          ministroAssignmentService.create({
            ministroId: ministro.id,
            ministroName: `${ministro.firstName} ${ministro.lastName}`,
            ministroRut: ministro.rut,
            organizationId: org.id,
            organizationName: org.organization?.name,
            scheduledDate,
            scheduledTime,
            location
          });
        }

        // Enviar notificación al usuario
        const { notificationService } = await import('../../services/NotificationService.js');

        // Verificar si había datos previos válidos
        const hadPreviousData = oldMinistroData && oldMinistroData.name;

        // Detectar cambios reales (solo si hay datos previos para comparar)
        const hasMinistroChanged = hadPreviousData && oldMinistroData.name !== newMinistroData.name;
        const hasScheduleChanged = hadPreviousData && (
          oldMinistroData.scheduledDate !== newMinistroData.scheduledDate ||
          oldMinistroData.scheduledTime !== newMinistroData.scheduledTime
        );
        const hasLocationChanged = hadPreviousData && oldMinistroData.location !== newMinistroData.location;

        // Notificaciones al USUARIO
        if (!hadPreviousData) {
          // Primera asignación - notificar al usuario que su solicitud fue agendada
          notificationService.create({
            userId: org.userId,
            type: 'ministro_assigned',
            title: '✅ Ministro de Fe Asignado',
            message: `¡Tu solicitud ha sido procesada! Se ha asignado un Ministro de Fe para la asamblea de ${org.organization?.name}.\n\n` +
                    `Ministro: ${newMinistroData.name}\n` +
                    `Fecha: ${new Date(scheduledDate).toLocaleDateString('es-CL')} a las ${scheduledTime}\n` +
                    `Lugar: ${location}`,
            data: { organizationId: org.id, ministroData: newMinistroData }
          });
        } else if (hasMinistroChanged && hasScheduleChanged) {
          notificationService.create({
            userId: org.userId,
            type: 'ministro_changed',
            title: '⚖️ Cambio de Ministro de Fe y Horario',
            message: `Se ha actualizado el Ministro de Fe y el horario para la asamblea de ${org.organization?.name}.\n\n` +
                    `Nuevo Ministro: ${newMinistroData.name}\n` +
                    `Nueva Fecha: ${new Date(scheduledDate).toLocaleDateString('es-CL')} a las ${scheduledTime}`,
            data: { organizationId: org.id, oldMinistroData, newMinistroData }
          });
        } else if (hasMinistroChanged) {
          notificationService.create({
            userId: org.userId,
            type: 'ministro_changed',
            title: '⚖️ Cambio de Ministro de Fe',
            message: `Se ha asignado un nuevo Ministro de Fe para la asamblea de ${org.organization?.name}.\n\n` +
                    `Ministro Anterior: ${oldMinistroData.name}\n` +
                    `Nuevo Ministro: ${newMinistroData.name}\n` +
                    `Fecha: ${new Date(scheduledDate).toLocaleDateString('es-CL')} a las ${scheduledTime}`,
            data: { organizationId: org.id, oldMinistroData, newMinistroData }
          });
        } else if (hasScheduleChanged && hasLocationChanged) {
          // Cambió tanto el horario como el lugar
          notificationService.create({
            userId: org.userId,
            type: 'schedule_location_change',
            title: '📅📍 Cambio de Horario y Lugar',
            message: `Se ha modificado el horario y lugar de la asamblea de ${org.organization?.name}.\n\n` +
                    `Fecha Anterior: ${new Date(oldMinistroData.scheduledDate).toLocaleDateString('es-CL')} a las ${oldMinistroData.scheduledTime}\n` +
                    `Nueva Fecha: ${new Date(scheduledDate).toLocaleDateString('es-CL')} a las ${scheduledTime}\n\n` +
                    `Lugar Anterior: ${oldMinistroData.location}\n` +
                    `Nuevo Lugar: ${location}`,
            data: { organizationId: org.id, oldData: oldMinistroData, newData: newMinistroData }
          });
        } else if (hasScheduleChanged) {
          notificationService.create({
            userId: org.userId,
            type: 'schedule_change',
            title: '📅 Cambio de Horario de Asamblea',
            message: `Se ha modificado el horario de la asamblea de ${org.organization?.name}.\n\n` +
                    `Fecha Anterior: ${new Date(oldMinistroData.scheduledDate).toLocaleDateString('es-CL')} a las ${oldMinistroData.scheduledTime}\n` +
                    `Nueva Fecha: ${new Date(scheduledDate).toLocaleDateString('es-CL')} a las ${scheduledTime}`,
            data: { organizationId: org.id, oldSchedule: oldMinistroData, newSchedule: newMinistroData }
          });
        } else if (hasLocationChanged) {
          notificationService.create({
            userId: org.userId,
            type: 'location_change',
            title: '📍 Cambio de Lugar de Asamblea',
            message: `Se ha modificado el lugar de la asamblea de ${org.organization?.name}.\n\n` +
                    `Lugar Anterior: ${oldMinistroData.location}\n` +
                    `Nuevo Lugar: ${location}`,
            data: { organizationId: org.id, oldLocation: oldMinistroData.location, newLocation: location }
          });
        }

        // Notificaciones al MINISTRO DE FE
        // Obtener el ID del ministro anterior (si existía)
        const oldMinistroId = currentAssignment?.ministroId;
        const newMinistroId = ministroId;

        // Si cambió el ministro, notificar al ministro ANTERIOR (si existe) que fue removido
        if (hasMinistroChanged && oldMinistroId) {
          notificationService.create({
            ministroId: oldMinistroId,
            type: 'assignment_removed',
            title: '📋 Asignación Removida',
            message: `Has sido removido de la asamblea de "${org.organization?.name}".\n\n` +
                    `Fecha original: ${new Date(oldMinistroData.scheduledDate).toLocaleDateString('es-CL')} a las ${oldMinistroData.scheduledTime}\n` +
                    `Lugar: ${oldMinistroData.location}`,
            data: { organizationId: org.id, reason: 'reassigned' }
          });
        }

        // Notificar al ministro NUEVO (o actual si no cambió)
        if (!hadPreviousData || hasMinistroChanged) {
          // Primera asignación o ministro nuevo - notificar nueva asignación
          notificationService.create({
            ministroId: newMinistroId,
            type: 'new_assignment',
            title: '⚖️ Nueva Asignación de Asamblea',
            message: `Se te ha asignado una nueva asamblea constitutiva.\n\n` +
                    `Organización: ${org.organization?.name}\n` +
                    `Fecha: ${new Date(scheduledDate).toLocaleDateString('es-CL')} a las ${scheduledTime}\n` +
                    `Lugar: ${location}`,
            data: { organizationId: org.id, scheduledDate, scheduledTime, location }
          });
        } else if (hasScheduleChanged && hasLocationChanged) {
          // Mismo ministro pero cambió horario Y ubicación
          notificationService.create({
            ministroId: newMinistroId,
            type: 'schedule_location_change',
            title: '📅📍 Cambio de Horario y Lugar',
            message: `Se ha modificado el horario y lugar de una asamblea asignada.\n\n` +
                    `Organización: ${org.organization?.name}\n` +
                    `Fecha Anterior: ${new Date(oldMinistroData.scheduledDate).toLocaleDateString('es-CL')} a las ${oldMinistroData.scheduledTime}\n` +
                    `Nueva Fecha: ${new Date(scheduledDate).toLocaleDateString('es-CL')} a las ${scheduledTime}\n` +
                    `Lugar Anterior: ${oldMinistroData.location}\n` +
                    `Nuevo Lugar: ${location}`,
            data: { organizationId: org.id, oldData: oldMinistroData, newData: { scheduledDate, scheduledTime, location } }
          });
        } else if (hasScheduleChanged) {
          // Mismo ministro pero cambió el horario - notificar cambio
          notificationService.create({
            ministroId: newMinistroId,
            type: 'schedule_change',
            title: '📅 Cambio de Horario de Asamblea',
            message: `Se ha modificado el horario de una asamblea asignada.\n\n` +
                    `Organización: ${org.organization?.name}\n` +
                    `Fecha Anterior: ${new Date(oldMinistroData.scheduledDate).toLocaleDateString('es-CL')} a las ${oldMinistroData.scheduledTime}\n` +
                    `Nueva Fecha: ${new Date(scheduledDate).toLocaleDateString('es-CL')} a las ${scheduledTime}\n` +
                    `Lugar: ${location}`,
            data: { organizationId: org.id, oldSchedule: oldMinistroData, newSchedule: { scheduledDate, scheduledTime, location } }
          });
        } else if (hasLocationChanged) {
          // Mismo ministro pero cambió solo la ubicación - notificar cambio
          notificationService.create({
            ministroId: newMinistroId,
            type: 'location_change',
            title: '📍 Cambio de Lugar de Asamblea',
            message: `Se ha modificado el lugar de una asamblea asignada.\n\n` +
                    `Organización: ${org.organization?.name}\n` +
                    `Lugar Anterior: ${oldMinistroData.location}\n` +
                    `Nuevo Lugar: ${location}\n` +
                    `Fecha: ${new Date(scheduledDate).toLocaleDateString('es-CL')} a las ${scheduledTime}`,
            data: { organizationId: org.id, oldLocation: oldMinistroData.location, newLocation: location }
          });
        }

        // Actualizar mensaje de éxito
        let successMsg = '✓ Ministro de Fe actualizado correctamente.';
        if (hasMinistroChanged && oldMinistroId) {
          successMsg += ' Notificados: usuario, ministro anterior y nuevo ministro.';
        } else if (!hadPreviousData || hasMinistroChanged || hasScheduleChanged || hasLocationChanged) {
          successMsg += ' Notificados: usuario y ministro de fe.';
        }

        showToast(successMsg, 'success');
        modal.remove();
        this.renderApplicationsList();
        this.updateStats();
      } else {
        showToast('Error al actualizar el Ministro de Fe', 'error');
      }
    });
  }

  /**
   * Ver PDF oficial en modal
   */
  viewOfficialPDF(orgId, docId) {
    const orgs = JSON.parse(localStorage.getItem('user_organizations') || '[]');
    const org = orgs.find(o => o.id === orgId);

    if (!org) {
      showToast('Organización no encontrada', 'error');
      return;
    }

    let pdfDoc;
    let docTitle = '';

    try {
      const directorio = org.provisionalDirectorio || {};

      switch (docId) {
        case 'acta_asamblea':
          pdfDoc = pdfService.generateActaAsamblea(org);
          docTitle = 'Acta de Asamblea General Constitutiva';
          break;
        case 'lista_socios':
          pdfDoc = pdfService.generateListaSocios(org);
          docTitle = 'Lista de Socios Constitución';
          break;
        case 'certificado':
          pdfDoc = pdfService.generateCertificado(org);
          docTitle = 'Certificado del Ministro de Fe';
          break;
        case 'certificacion':
          pdfDoc = pdfService.generateCertificacion(org);
          docTitle = 'Certificación Municipal';
          break;
        case 'deposito':
          pdfDoc = pdfService.generateDepositoAntecedentes(org);
          docTitle = 'Depósito de Antecedentes';
          break;
        case 'decl_presidente':
          if (directorio.president) {
            pdfDoc = pdfService.generateDeclaracionJurada(org, directorio.president);
            docTitle = `Declaración Jurada - Presidente: ${directorio.president.name}`;
          }
          break;
        case 'decl_secretario':
          if (directorio.secretary) {
            pdfDoc = pdfService.generateDeclaracionJurada(org, directorio.secretary);
            docTitle = `Declaración Jurada - Secretario: ${directorio.secretary.name}`;
          }
          break;
        case 'decl_tesorero':
          if (directorio.treasurer) {
            pdfDoc = pdfService.generateDeclaracionJurada(org, directorio.treasurer);
            docTitle = `Declaración Jurada - Tesorero: ${directorio.treasurer.name}`;
          }
          break;
        default:
          // Manejar declaraciones de directores adicionales
          if (docId.startsWith('decl_adicional_')) {
            const index = parseInt(docId.replace('decl_adicional_', ''));
            if (directorio.additionalMembers && directorio.additionalMembers[index]) {
              const member = directorio.additionalMembers[index];
              pdfDoc = pdfService.generateDeclaracionJurada(org, member);
              docTitle = `Declaración Jurada - ${member.cargo || 'Director'}: ${member.name}`;
            }
          }
          break;
      }

      if (!pdfDoc) {
        showToast('No se pudo generar el documento', 'error');
        return;
      }

      // Crear modal para mostrar el PDF
      const pdfDataUrl = pdfService.getPDFDataURL(pdfDoc);

      const previewModal = document.createElement('div');
      previewModal.className = 'pdf-preview-modal';
      previewModal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 500000;';
      previewModal.innerHTML = `
        <div style="background: white; border-radius: 12px; width: 90%; max-width: 900px; height: 90vh; display: flex; flex-direction: column; overflow: hidden;">
          <div style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">${docTitle}</h3>
            <div style="display: flex; gap: 8px;">
              <button class="btn-download-preview" style="padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Descargar
              </button>
              <button class="btn-close-preview" style="padding: 8px 12px; background: #f3f4f6; color: #374151; border: none; border-radius: 6px; font-weight: 500; cursor: pointer;">
                ✕ Cerrar
              </button>
            </div>
          </div>
          <div style="flex: 1; overflow: hidden;">
            <iframe src="${pdfDataUrl}" style="width: 100%; height: 100%; border: none;"></iframe>
          </div>
        </div>
      `;

      document.body.appendChild(previewModal);

      previewModal.querySelector('.btn-close-preview').addEventListener('click', () => previewModal.remove());
      previewModal.addEventListener('click', (e) => { if (e.target === previewModal) previewModal.remove(); });
      previewModal.querySelector('.btn-download-preview').addEventListener('click', () => {
        this.downloadOfficialPDF(orgId, docId);
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast('Error al generar el documento PDF', 'error');
    }
  }

  /**
   * Descargar PDF oficial
   */
  downloadOfficialPDF(orgId, docId) {
    const orgs = JSON.parse(localStorage.getItem('user_organizations') || '[]');
    const org = orgs.find(o => o.id === orgId);

    if (!org) {
      showToast('Organización no encontrada', 'error');
      return;
    }

    let pdfDoc;
    let filename = '';
    const orgName = (org.organization?.name || org.organizationName || 'Organizacion').replace(/\s+/g, '_');

    try {
      const directorio = org.provisionalDirectorio || {};

      switch (docId) {
        case 'acta_asamblea':
          pdfDoc = pdfService.generateActaAsamblea(org);
          filename = `Acta_Asamblea_${orgName}.pdf`;
          break;
        case 'lista_socios':
          pdfDoc = pdfService.generateListaSocios(org);
          filename = `Lista_Socios_${orgName}.pdf`;
          break;
        case 'certificado':
          pdfDoc = pdfService.generateCertificado(org);
          filename = `Certificado_${orgName}.pdf`;
          break;
        case 'certificacion':
          pdfDoc = pdfService.generateCertificacion(org);
          filename = `Certificacion_${orgName}.pdf`;
          break;
        case 'deposito':
          pdfDoc = pdfService.generateDepositoAntecedentes(org);
          filename = `Deposito_Antecedentes_${orgName}.pdf`;
          break;
        case 'decl_presidente':
          if (directorio.president) {
            pdfDoc = pdfService.generateDeclaracionJurada(org, directorio.president);
            filename = `Declaracion_Jurada_Presidente_${directorio.president.name?.replace(/\s+/g, '_') || 'Presidente'}.pdf`;
          }
          break;
        case 'decl_secretario':
          if (directorio.secretary) {
            pdfDoc = pdfService.generateDeclaracionJurada(org, directorio.secretary);
            filename = `Declaracion_Jurada_Secretario_${directorio.secretary.name?.replace(/\s+/g, '_') || 'Secretario'}.pdf`;
          }
          break;
        case 'decl_tesorero':
          if (directorio.treasurer) {
            pdfDoc = pdfService.generateDeclaracionJurada(org, directorio.treasurer);
            filename = `Declaracion_Jurada_Tesorero_${directorio.treasurer.name?.replace(/\s+/g, '_') || 'Tesorero'}.pdf`;
          }
          break;
        default:
          // Manejar declaraciones de directores adicionales
          if (docId.startsWith('decl_adicional_')) {
            const index = parseInt(docId.replace('decl_adicional_', ''));
            if (directorio.additionalMembers && directorio.additionalMembers[index]) {
              const member = directorio.additionalMembers[index];
              pdfDoc = pdfService.generateDeclaracionJurada(org, member);
              filename = `Declaracion_Jurada_${member.cargo || 'Director'}_${member.name?.replace(/\s+/g, '_') || index}.pdf`;
            }
          }
          break;
      }

      if (!pdfDoc) {
        showToast('No se pudo generar el documento', 'error');
        return;
      }

      pdfService.downloadPDF(pdfDoc, filename);
      showToast(`Documento "${filename}" descargado`, 'success');

    } catch (error) {
      console.error('Error downloading PDF:', error);
      showToast('Error al descargar el documento PDF', 'error');
    }
  }

  /**
   * Descargar todos los PDFs de una organización
   */
  downloadAllPDFs(orgId) {
    const orgs = JSON.parse(localStorage.getItem('user_organizations') || '[]');
    const org = orgs.find(o => o.id === orgId);

    if (!org) {
      showToast('Organización no encontrada', 'error');
      return;
    }

    try {
      const documents = pdfService.generateAllDocuments(org);

      if (documents.length === 0) {
        showToast('No hay documentos para descargar', 'warning');
        return;
      }

      // Descargar cada documento con un pequeño delay
      let downloadCount = 0;
      documents.forEach((doc, index) => {
        setTimeout(() => {
          pdfService.downloadPDF(doc.doc, doc.name);
          downloadCount++;
          if (downloadCount === documents.length) {
            showToast(`Se descargaron ${documents.length} documentos`, 'success');
          }
        }, index * 300); // 300ms delay entre descargas
      });

    } catch (error) {
      console.error('Error downloading all PDFs:', error);
      showToast('Error al descargar los documentos', 'error');
    }
  }

}

// Instancia singleton
export const adminDashboard = new AdminDashboard();
