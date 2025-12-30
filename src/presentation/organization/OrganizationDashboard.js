/**
 * Dashboard de Administración de Organización Aprobada
 * Permite al usuario gestionar todos los aspectos de su organización comunitaria
 */

import { organizationsService, ORG_STATUS } from '../../services/OrganizationsService.js';
import { alertsService, ALERT_PRIORITY } from '../../services/AlertsService.js';
// ministroAssignmentService ya no se usa - Ministro de Fe solo es para constitución
// import { ministroAssignmentService } from '../../services/MinistroAssignmentService.js';
import { showToast } from '../../app.js';

// Importar utilidades compartidas
import {
  formatDate,
  parseDateTimeSafe,
  getOrgType,
  getOrgIcon
} from '../../shared/utils/index.js';

// Wrapper para compatibilidad con código existente
const formatDateSafe = (dateStr, options = {}) => formatDate(dateStr, { fallback: '-', ...options });
const getOrgTypeName = getOrgType;

class OrganizationDashboard {
  constructor() {
    this.currentOrg = null;
    this.currentTab = 'overview';
  }

  /**
   * Abre el dashboard para una organización específica
   */
  open(orgId) {
    const org = organizationsService.getById(orgId);
    if (!org || org.status !== ORG_STATUS.APPROVED) {
      showToast('Esta organización no está disponible', 'error');
      return;
    }

    this.currentOrg = org;
    this.render();
  }

  /**
   * Renderiza el dashboard completo
   */
  render() {
    const overlay = document.createElement('div');
    overlay.className = 'org-dashboard-overlay';
    overlay.innerHTML = `
      <div class="org-dashboard">
        <div class="org-dashboard-header">
          <div class="org-dashboard-title">
            <div class="org-icon">${getOrgIcon(this.currentOrg.organization?.type)}</div>
            <div class="org-title-info">
              <h2>${this.currentOrg.organization?.name || 'Mi Organización'}</h2>
              <span class="org-type-badge">${getOrgTypeName(this.currentOrg.organization?.type)}</span>
            </div>
          </div>
          <button class="org-dashboard-close">&times;</button>
        </div>

        <div class="org-dashboard-nav">
          <button class="org-nav-btn active" data-tab="overview">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Resumen
          </button>
          <button class="org-nav-btn" data-tab="members">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Socios
          </button>
          <button class="org-nav-btn" data-tab="directorio">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Directorio
          </button>
          <button class="org-nav-btn" data-tab="asambleas">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Asambleas
          </button>
          <button class="org-nav-btn" data-tab="elecciones">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Elecciones
          </button>
          <button class="org-nav-btn" data-tab="comunicaciones">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            Comunicaciones
          </button>
          <button class="org-nav-btn" data-tab="finanzas">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            Finanzas
          </button>
          <button class="org-nav-btn" data-tab="proyectos">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            Proyectos
          </button>
          <button class="org-nav-btn" data-tab="documentos">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            Documentos
          </button>
          <button class="org-nav-btn" data-tab="actividades">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Actividades
          </button>
        </div>

        <div class="org-dashboard-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.attachEventListeners(overlay);
  }

  /**
   * Renderiza el contenido de la pestaña actual
   */
  renderTabContent() {
    switch (this.currentTab) {
      case 'overview':
        return this.renderOverview();
      case 'members':
        return this.renderMembers();
      case 'directorio':
        return this.renderDirectorio();
      case 'asambleas':
        return this.renderAsambleas();
      case 'elecciones':
        return this.renderElecciones();
      case 'comunicaciones':
        return this.renderComunicaciones();
      case 'finanzas':
        return this.renderFinanzas();
      case 'proyectos':
        return this.renderProyectos();
      case 'documentos':
        return this.renderDocumentos();
      case 'actividades':
        return this.renderActividades();
      default:
        return this.renderOverview();
    }
  }

  /**
   * Resumen general
   */
  renderOverview() {
    const org = this.currentOrg;
    const members = org.members || [];
    const commission = org.commission?.members || [];
    const approvedDate = org.statusHistory?.find(h => h.status === ORG_STATUS.APPROVED)?.date;

    // FASE 4: Obtener alertas de la organización
    const alerts = alertsService.getOrganizationAlerts(org.id);
    const criticalAlerts = alerts.filter(a => a.priority === ALERT_PRIORITY.CRITICAL);
    const highAlerts = alerts.filter(a => a.priority === ALERT_PRIORITY.HIGH);

    return `
      <div class="org-overview">
        ${alerts.length > 0 ? `
          <div class="org-alerts-section">
            <div class="alerts-header">
              <h3>
                ${alertsService.getPriorityIcon(criticalAlerts.length > 0 ? ALERT_PRIORITY.CRITICAL : ALERT_PRIORITY.HIGH)}
                Responsabilidades y Alertas
              </h3>
              <span class="alerts-count">
                ${alerts.length} ${alerts.length === 1 ? 'pendiente' : 'pendientes'}
              </span>
            </div>

            <div class="alerts-list">
              ${alerts.map(alert => `
                <div class="alert-card alert-${alert.priority}" data-alert-id="${alert.id}">
                  <div class="alert-header">
                    <div class="alert-icon">${alertsService.getPriorityIcon(alert.priority)}</div>
                    <div class="alert-info">
                      <h4>${alert.title}</h4>
                      <p>${alert.description}</p>
                      ${alert.frequency ? `<span class="alert-frequency">${alert.frequency}</span>` : ''}
                    </div>
                    <div class="alert-status">
                      ${alert.daysRemaining < 0
                        ? `<span class="alert-overdue">Vencido hace ${Math.abs(alert.daysRemaining)} días</span>`
                        : alert.daysRemaining === 0
                          ? `<span class="alert-today">¡Vence hoy!</span>`
                          : `<span class="alert-days">${alert.daysRemaining} ${alert.daysRemaining === 1 ? 'día' : 'días'}</span>`
                      }
                      <span class="alert-date">${new Date(alert.dueDate).toLocaleDateString('es-CL')}</span>
                    </div>
                  </div>
                  ${alert.actionRequired ? `
                    <div class="alert-actions">
                      <button class="btn btn-sm btn-primary alert-action-btn" data-alert-type="${alert.type}">
                        ${alert.actionLabel || 'Completar'}
                      </button>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : `
          <div class="org-alerts-section no-alerts">
            <div class="no-alerts-icon">✅</div>
            <h3>¡Todo al día!</h3>
            <p>No tienes responsabilidades pendientes en este momento.</p>
          </div>
        `}

        <div class="org-welcome-card">
          <div class="welcome-icon">🎉</div>
          <div class="welcome-content">
            <h3>¡Bienvenido al Panel de Administración!</h3>
            <p>Desde aquí puedes gestionar todos los aspectos de tu organización: socios, directorio, finanzas, proyectos y más.</p>
          </div>
        </div>

        <div class="org-stats-grid">
          <div class="org-stat-card">
            <div class="stat-icon members">👥</div>
            <div class="stat-info">
              <span class="stat-value">${members.length}</span>
              <span class="stat-label">Socios Fundadores</span>
            </div>
          </div>
          <div class="org-stat-card">
            <div class="stat-icon directorio">👔</div>
            <div class="stat-info">
              <span class="stat-value">${commission.length}</span>
              <span class="stat-label">Miembros Directorio</span>
            </div>
          </div>
          <div class="org-stat-card">
            <div class="stat-icon proyectos">📋</div>
            <div class="stat-info">
              <span class="stat-value">${org.projects?.length || 0}</span>
              <span class="stat-label">Proyectos Activos</span>
            </div>
          </div>
          <div class="org-stat-card">
            <div class="stat-icon actividades">📅</div>
            <div class="stat-info">
              <span class="stat-value">${org.activities?.length || 0}</span>
              <span class="stat-label">Actividades</span>
            </div>
          </div>
        </div>

        <div class="org-info-section">
          <h4>Información de la Organización</h4>
          <div class="org-info-grid">
            <div class="info-item">
              <span class="info-label">Nombre Legal</span>
              <span class="info-value">${org.organization?.name || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Tipo</span>
              <span class="info-value">${getOrgTypeName(org.organization?.type)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Dirección</span>
              <span class="info-value">${org.organization?.address || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Comuna</span>
              <span class="info-value">${org.organization?.commune || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Unidad Vecinal</span>
              <span class="info-value">${org.organization?.neighborhood || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Fecha de Aprobación</span>
              <span class="info-value">${approvedDate ? new Date(approvedDate).toLocaleDateString('es-CL') : '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Email</span>
              <span class="info-value">${org.organization?.email || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Teléfono</span>
              <span class="info-value">${org.organization?.phone || '-'}</span>
            </div>
          </div>
        </div>

        <!-- Sección de Ministro de Fe removida - solo aplica durante el proceso de constitución -->

        <div class="org-quick-actions">
          <h4>Acciones Rápidas</h4>
          <div class="quick-actions-grid">
            <button class="quick-action-btn" data-action="add-member">
              <span class="action-icon">➕</span>
              <span>Agregar Socio</span>
            </button>
            <button class="quick-action-btn" data-action="new-assembly">
              <span class="action-icon">📋</span>
              <span>Nueva Asamblea</span>
            </button>
            <button class="quick-action-btn" data-action="new-project">
              <span class="action-icon">🚀</span>
              <span>Nuevo Proyecto</span>
            </button>
            <button class="quick-action-btn" data-action="certificate">
              <span class="action-icon">📄</span>
              <span>Certificado de Residencia</span>
            </button>
          </div>
        </div>

        <div class="org-danger-zone">
          <h4>Zona de Riesgo</h4>
          <div class="danger-zone-content">
            <div class="danger-info">
              <span class="danger-icon">⚠️</span>
              <div class="danger-text">
                <strong>Solicitar Disolución</strong>
                <p>Esta acción es irreversible. La organización será disuelta permanentemente.</p>
              </div>
            </div>
            <button class="btn-danger" id="btn-request-dissolution">
              Solicitar Disolución
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Sección de validación de firmas - DEPRECADA
   * Esta sección ya no se usa porque el Ministro de Fe solo es para el proceso de constitución.
   * Una vez que la organización está aprobada, no se necesita esta validación.
   */
  renderSignatureValidationSection() {
    // Retornar vacío - esta sección ya no se muestra en organizaciones aprobadas
    // El Ministro de Fe solo interviene durante el proceso de constitución
    return '';
  }

  /**
   * Gestión de Socios/Miembros
   */
  renderMembers() {
    const members = this.currentOrg.members || [];

    return `
      <div class="org-members-section">
        <div class="section-header">
          <h3>Gestión de Socios</h3>
          <button class="btn-add-member" id="btn-add-new-member">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Agregar Socio
          </button>
        </div>

        <div class="members-info-card">
          <p><strong>Requisitos para ser socio:</strong> Tener al menos 14 años de edad y residencia en la unidad vecinal.</p>
        </div>

        <div class="members-stats">
          <div class="member-stat">
            <span class="stat-number">${members.length}</span>
            <span class="stat-text">Total Socios</span>
          </div>
          <div class="member-stat">
            <span class="stat-number">${members.filter(m => m.status === 'active').length || members.length}</span>
            <span class="stat-text">Activos</span>
          </div>
        </div>

        <div class="members-table-container">
          <table class="members-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>RUT</th>
                <th>Teléfono</th>
                <th>Fecha Ingreso</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${members.length > 0 ? members.map((member, index) => `
                <tr>
                  <td class="member-name">
                    <div class="member-avatar">${(member.firstName?.[0] || 'S').toUpperCase()}</div>
                    <span>${member.firstName} ${member.lastName}</span>
                  </td>
                  <td>${member.rut || '-'}</td>
                  <td>${member.phone || '-'}</td>
                  <td>${member.joinDate ? new Date(member.joinDate).toLocaleDateString('es-CL') : 'Fundador'}</td>
                  <td>
                    <span class="status-badge ${member.status || 'active'}">${member.status === 'inactive' ? 'Inactivo' : 'Activo'}</span>
                  </td>
                  <td class="actions-cell">
                    <button class="btn-icon edit" data-action="edit-member" data-id="${member.id || index}" title="Editar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button class="btn-icon delete" data-action="delete-member" data-id="${member.id || index}" title="Eliminar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="6" class="empty-state">No hay socios registrados</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Directorio de la organización
   */
  renderDirectorio() {
    const commission = this.currentOrg.commission?.members || [];
    const electionDate = this.currentOrg.commission?.electionDate;
    const roles = ['Presidente', 'Secretario', 'Tesorero'];
    const roleDescriptions = {
      'Presidente': 'Representa legal y judicialmente a la organización. Administra el patrimonio y ejecuta los acuerdos de la asamblea.',
      'Secretario': 'Administra los libros de socios y actas. Emite certificados y citaciones a asambleas.',
      'Tesorero': 'Lleva la contabilidad y administra los recursos financieros de la organización.'
    };

    return `
      <div class="org-directorio-section">
        <div class="section-header">
          <h3>Directorio</h3>
          <button class="btn-edit-directorio" id="btn-edit-directorio">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Editar Directorio
          </button>
        </div>

        <div class="directorio-info">
          <p>El directorio debe contar con al menos 3 miembros titulares mayores de 18 años, elegidos por votación directa. Cada miembro dura <strong>3 años</strong> en su cargo, con posibilidad de reelección.</p>
          ${electionDate ? `<p class="election-date">Fecha de elección: <strong>${new Date(electionDate).toLocaleDateString('es-CL')}</strong></p>` : ''}
        </div>

        <div class="directorio-cards">
          ${roles.map((role, index) => {
            const member = commission[index];
            return `
              <div class="directorio-card ${member ? '' : 'empty'}">
                <div class="directorio-role">${role}</div>
                ${member ? `
                  <div class="directorio-member">
                    <div class="member-avatar large">${member.firstName?.[0]?.toUpperCase() || '?'}</div>
                    <div class="member-details">
                      <span class="member-name">${member.firstName} ${member.lastName}</span>
                      <span class="member-rut">${member.rut || '-'}</span>
                    </div>
                  </div>
                  <div class="directorio-description">${roleDescriptions[role]}</div>
                ` : `
                  <div class="empty-slot">
                    <span>Sin asignar</span>
                    <button class="btn-assign" data-role="${role}">Asignar</button>
                  </div>
                `}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Gestión de Asambleas
   */
  renderAsambleas() {
    const asambleas = this.currentOrg.assemblies || [];

    return `
      <div class="org-asambleas-section">
        <div class="section-header">
          <h3>Asambleas</h3>
          <button class="btn-new-assembly" id="btn-new-assembly">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nueva Asamblea
          </button>
        </div>

        <div class="assembly-types">
          <div class="assembly-type-card ordinaria">
            <h4>Asamblea Ordinaria</h4>
            <p>Se realiza al menos una vez al año para aprobar la memoria, balance anual y elegir directorio cuando corresponda.</p>
          </div>
          <div class="assembly-type-card extraordinaria">
            <h4>Asamblea Extraordinaria</h4>
            <p>Se convoca para tratar asuntos específicos como reformas de estatutos, disolución o materias urgentes.</p>
          </div>
        </div>

        <div class="asambleas-list">
          <h4>Historial de Asambleas</h4>
          ${asambleas.length > 0 ? `
            <div class="asambleas-table">
              ${asambleas.map(asamblea => `
                <div class="asamblea-item">
                  <div class="asamblea-date">${new Date(asamblea.date).toLocaleDateString('es-CL')}</div>
                  <div class="asamblea-info">
                    <span class="asamblea-type ${asamblea.type}">${asamblea.type === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'}</span>
                    <span class="asamblea-title">${asamblea.title || 'Sin título'}</span>
                  </div>
                  <div class="asamblea-attendance">${asamblea.attendance || 0} asistentes</div>
                  <button class="btn-view-acta" data-id="${asamblea.id}">Ver Acta</button>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="empty-state-card">
              <span class="empty-icon">📋</span>
              <p>No hay asambleas registradas</p>
              <button class="btn-primary" id="btn-first-assembly">Crear Primera Asamblea</button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Gestión de Elecciones para renovar directorio
   */
  renderElecciones() {
    const org = this.currentOrg;
    const directorio = org.commission?.members || [];
    const electionDate = org.commission?.electionDate;
    const nextElectionDate = electionDate ? new Date(new Date(electionDate).getTime() + (3 * 365 * 24 * 60 * 60 * 1000)) : null;
    const elections = org.elections || [];

    // Calcular si toca renovar
    const today = new Date();
    const needsRenewal = nextElectionDate && today >= nextElectionDate;

    return `
      <div class="org-elecciones-section">
        <div class="section-header">
          <h3>Elecciones y Renovación de Directorio</h3>
          <button class="btn-new-election" id="btn-new-election">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Convocar Elección
          </button>
        </div>

        <div class="elecciones-info">
          <p>Según la Ley 19.418, el directorio dura <strong>3 años</strong> en sus funciones. La renovación se realiza mediante elección directa en asamblea ordinaria, con voto secreto e informado.</p>
        </div>

        ${needsRenewal ? `
          <div class="alert-renewal" style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <span style="font-size: 28px;">⚠️</span>
              <div>
                <strong style="color: #92400e; font-size: 16px;">Renovación Pendiente</strong>
                <p style="margin: 4px 0 0; color: #78350f; font-size: 14px;">El período del directorio actual ha vencido. Debe convocar a elecciones.</p>
              </div>
            </div>
            <button class="btn-primary" id="btn-urgent-election" style="margin-top: 8px;">Convocar Elección Ahora</button>
          </div>
        ` : ''}

        <div class="current-term-card">
          <h4>Directorio Actual</h4>
          <div class="term-info">
            <div class="term-dates">
              <div class="term-item">
                <span class="label">Fecha de Elección:</span>
                <span class="value">${electionDate ? new Date(electionDate).toLocaleDateString('es-CL') : 'No registrada'}</span>
              </div>
              <div class="term-item">
                <span class="label">Próxima Renovación:</span>
                <span class="value ${needsRenewal ? 'overdue' : ''}">${nextElectionDate ? nextElectionDate.toLocaleDateString('es-CL') : 'No calculada'}</span>
              </div>
            </div>
            <div class="current-directorio-mini">
              ${directorio.map((m, i) => {
                const roles = ['Presidente', 'Secretario', 'Tesorero'];
                return `
                  <div class="mini-member">
                    <span class="role">${roles[i] || 'Director'}</span>
                    <span class="name">${m.firstName || m.name} ${m.lastName || ''}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <div class="elections-history">
          <h4>Historial de Elecciones</h4>
          ${elections.length > 0 ? `
            <div class="elections-list">
              ${elections.map(e => `
                <div class="election-item">
                  <div class="election-date">${new Date(e.date).toLocaleDateString('es-CL')}</div>
                  <div class="election-info">
                    <span class="election-type">${e.type === 'total' ? 'Renovación Total' : 'Renovación Parcial'}</span>
                    <span class="election-result">${e.result || 'Sin resultado'}</span>
                  </div>
                  <div class="election-participation">${e.participation || 0}% participación</div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="empty-state-card">
              <span class="empty-icon">🗳️</span>
              <p>No hay elecciones registradas en el sistema</p>
              <p style="font-size: 12px; color: #6b7280;">La primera elección corresponde a la constitución de la organización</p>
            </div>
          `}
        </div>

        <div class="election-process-info">
          <h4>Proceso Electoral</h4>
          <div class="process-steps">
            <div class="step">
              <span class="step-number">1</span>
              <div class="step-content">
                <strong>Convocatoria</strong>
                <p>Citar a asamblea ordinaria con 10 días de anticipación mínimo</p>
              </div>
            </div>
            <div class="step">
              <span class="step-number">2</span>
              <div class="step-content">
                <strong>Inscripción de Candidatos</strong>
                <p>Los candidatos deben ser socios con al menos 1 año de antigüedad</p>
              </div>
            </div>
            <div class="step">
              <span class="step-number">3</span>
              <div class="step-content">
                <strong>Votación</strong>
                <p>Voto secreto e informado. Quórum mínimo del 50% de socios</p>
              </div>
            </div>
            <div class="step">
              <span class="step-number">4</span>
              <div class="step-content">
                <strong>Proclamación</strong>
                <p>Comunicar resultados y actualizar ante la municipalidad</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Comunicaciones e Información a Socios
   */
  renderComunicaciones() {
    const org = this.currentOrg;
    const communications = org.communications || [];
    const members = org.members || [];

    return `
      <div class="org-comunicaciones-section">
        <div class="section-header">
          <h3>Comunicaciones a Socios</h3>
          <button class="btn-new-communication" id="btn-new-communication">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            Nueva Comunicación
          </button>
        </div>

        <div class="comunicaciones-info">
          <p>Mantén informados a los socios sobre actividades, asambleas y noticias importantes de la organización. Las comunicaciones se enviarán por email a los socios registrados.</p>
        </div>

        <div class="comm-stats">
          <div class="stat-card">
            <span class="stat-number">${members.length}</span>
            <span class="stat-label">Socios Registrados</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">${members.filter(m => m.email).length}</span>
            <span class="stat-label">Con Email</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">${communications.length}</span>
            <span class="stat-label">Comunicaciones Enviadas</span>
          </div>
        </div>

        <div class="quick-templates">
          <h4>Plantillas Rápidas</h4>
          <div class="templates-grid">
            <button class="template-btn" data-template="asamblea">
              <span class="template-icon">📋</span>
              <span class="template-name">Citación a Asamblea</span>
            </button>
            <button class="template-btn" data-template="actividad">
              <span class="template-icon">🎉</span>
              <span class="template-name">Invitación a Actividad</span>
            </button>
            <button class="template-btn" data-template="informe">
              <span class="template-icon">📊</span>
              <span class="template-name">Informe de Gestión</span>
            </button>
            <button class="template-btn" data-template="urgente">
              <span class="template-icon">🚨</span>
              <span class="template-name">Aviso Urgente</span>
            </button>
          </div>
        </div>

        <div class="communications-history">
          <h4>Historial de Comunicaciones</h4>
          ${communications.length > 0 ? `
            <div class="communications-list">
              ${communications.map(c => `
                <div class="communication-item">
                  <div class="comm-date">${new Date(c.date).toLocaleDateString('es-CL')}</div>
                  <div class="comm-info">
                    <span class="comm-subject">${c.subject}</span>
                    <span class="comm-recipients">${c.recipients || members.length} destinatarios</span>
                  </div>
                  <div class="comm-status ${c.status || 'sent'}">
                    ${c.status === 'sent' ? '✓ Enviado' : c.status === 'draft' ? '📝 Borrador' : '✓ Enviado'}
                  </div>
                  <button class="btn-view-comm" data-id="${c.id}">Ver</button>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="empty-state-card">
              <span class="empty-icon">📧</span>
              <p>No hay comunicaciones enviadas</p>
              <button class="btn-primary" id="btn-first-communication">Enviar Primera Comunicación</button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Gestión de Finanzas
   */
  renderFinanzas() {
    const finanzas = this.currentOrg.finances || { balance: 0, transactions: [] };

    return `
      <div class="org-finanzas-section">
        <div class="section-header">
          <h3>Finanzas</h3>
          <button class="btn-new-transaction" id="btn-new-transaction">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Registrar Movimiento
          </button>
        </div>

        <div class="finanzas-info">
          <p>Cada organización debe tener una cuenta bancaria a su nombre y presentar un balance anual. Las juntas de vecinos <strong>no pueden perseguir fines de lucro</strong>.</p>
        </div>

        <div class="finanzas-summary">
          <div class="balance-card">
            <span class="balance-label">Saldo Actual</span>
            <span class="balance-amount">$${(finanzas.balance || 0).toLocaleString('es-CL')}</span>
          </div>
          <div class="finance-stat">
            <span class="stat-label">Ingresos del Mes</span>
            <span class="stat-value income">+$${(finanzas.monthlyIncome || 0).toLocaleString('es-CL')}</span>
          </div>
          <div class="finance-stat">
            <span class="stat-label">Gastos del Mes</span>
            <span class="stat-value expense">-$${(finanzas.monthlyExpense || 0).toLocaleString('es-CL')}</span>
          </div>
        </div>

        <div class="transactions-section">
          <h4>Últimos Movimientos</h4>
          ${finanzas.transactions?.length > 0 ? `
            <div class="transactions-list">
              ${finanzas.transactions.slice(0, 10).map(tx => `
                <div class="transaction-item ${tx.type}">
                  <div class="tx-icon">${tx.type === 'income' ? '↗️' : '↘️'}</div>
                  <div class="tx-info">
                    <span class="tx-description">${tx.description}</span>
                    <span class="tx-date">${new Date(tx.date).toLocaleDateString('es-CL')}</span>
                  </div>
                  <span class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}$${tx.amount.toLocaleString('es-CL')}</span>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="empty-state-card">
              <span class="empty-icon">💰</span>
              <p>No hay movimientos registrados</p>
            </div>
          `}
        </div>

        <div class="finance-actions">
          <button class="btn-secondary" id="btn-annual-balance">Ver Balance Anual</button>
          <button class="btn-secondary" id="btn-export-finances">Exportar Movimientos</button>
        </div>
      </div>
    `;
  }

  /**
   * Gestión de Proyectos
   */
  renderProyectos() {
    const proyectos = this.currentOrg.projects || [];

    return `
      <div class="org-proyectos-section">
        <div class="section-header">
          <h3>Proyectos Comunitarios</h3>
          <button class="btn-new-project" id="btn-new-project">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nuevo Proyecto
          </button>
        </div>

        <div class="proyectos-info">
          <p>Las organizaciones pueden proponer y ejecutar proyectos que beneficien a los vecinos: mejoras de infraestructura, áreas verdes, seguridad ciudadana, entre otros.</p>
        </div>

        <div class="proyectos-grid">
          ${proyectos.length > 0 ? proyectos.map(proyecto => `
            <div class="proyecto-card ${proyecto.status}">
              <div class="proyecto-header">
                <span class="proyecto-status">${this.getProjectStatusLabel(proyecto.status)}</span>
                <span class="proyecto-category">${proyecto.category || 'General'}</span>
              </div>
              <h4 class="proyecto-title">${proyecto.title}</h4>
              <p class="proyecto-description">${proyecto.description || ''}</p>
              <div class="proyecto-progress">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${proyecto.progress || 0}%"></div>
                </div>
                <span class="progress-text">${proyecto.progress || 0}% completado</span>
              </div>
              <div class="proyecto-footer">
                <span class="proyecto-budget">$${(proyecto.budget || 0).toLocaleString('es-CL')}</span>
                <button class="btn-view-project" data-id="${proyecto.id}">Ver detalles</button>
              </div>
            </div>
          `).join('') : `
            <div class="empty-state-card full-width">
              <span class="empty-icon">🚀</span>
              <h4>No hay proyectos activos</h4>
              <p>Crea un nuevo proyecto para mejorar tu comunidad</p>
              <button class="btn-primary" id="btn-first-project">Crear Primer Proyecto</button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Gestión de Documentos
   */
  renderDocumentos() {
    const documentos = this.currentOrg.documents || [];

    return `
      <div class="org-documentos-section">
        <div class="section-header">
          <h3>Documentos</h3>
          <button class="btn-upload-doc" id="btn-upload-doc">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Subir Documento
          </button>
        </div>

        <div class="documentos-categories">
          <div class="doc-category">
            <h4>📜 Documentos Legales</h4>
            <div class="doc-list">
              <div class="doc-item">
                <span class="doc-icon">📄</span>
                <span class="doc-name">Estatutos</span>
                <button class="btn-view-doc">Ver</button>
              </div>
              <div class="doc-item">
                <span class="doc-icon">📄</span>
                <span class="doc-name">Acta Constitutiva</span>
                <button class="btn-view-doc">Ver</button>
              </div>
              <div class="doc-item">
                <span class="doc-icon">📄</span>
                <span class="doc-name">Personalidad Jurídica</span>
                <button class="btn-view-doc">Ver</button>
              </div>
            </div>
          </div>

          <div class="doc-category">
            <h4>📋 Certificados</h4>
            <div class="doc-list">
              <div class="doc-item generate">
                <span class="doc-icon">🏠</span>
                <span class="doc-name">Certificado de Residencia</span>
                <button class="btn-generate-cert" id="btn-cert-residencia">Generar</button>
              </div>
              <div class="doc-item generate">
                <span class="doc-icon">👤</span>
                <span class="doc-name">Certificado de Socio</span>
                <button class="btn-generate-cert" id="btn-cert-socio">Generar</button>
              </div>
            </div>
          </div>

          <div class="doc-category">
            <h4>📝 Actas de Asamblea</h4>
            <div class="doc-list">
              ${this.currentOrg.assemblies?.length > 0 ?
                this.currentOrg.assemblies.map(a => `
                  <div class="doc-item">
                    <span class="doc-icon">📄</span>
                    <span class="doc-name">Acta ${new Date(a.date).toLocaleDateString('es-CL')}</span>
                    <button class="btn-view-doc" data-id="${a.id}">Ver</button>
                  </div>
                `).join('') :
                '<p class="no-docs">No hay actas registradas</p>'
              }
            </div>
          </div>

          <div class="doc-category">
            <h4>📁 Otros Documentos</h4>
            <div class="doc-list">
              ${documentos.filter(d => d.category === 'other').length > 0 ?
                documentos.filter(d => d.category === 'other').map(doc => `
                  <div class="doc-item">
                    <span class="doc-icon">📄</span>
                    <span class="doc-name">${doc.name}</span>
                    <button class="btn-view-doc" data-id="${doc.id}">Ver</button>
                  </div>
                `).join('') :
                '<p class="no-docs">No hay documentos adicionales</p>'
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Gestión de Actividades
   */
  renderActividades() {
    const actividades = this.currentOrg.activities || [];

    return `
      <div class="org-actividades-section">
        <div class="section-header">
          <h3>Actividades</h3>
          <button class="btn-new-activity" id="btn-new-activity">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nueva Actividad
          </button>
        </div>

        <div class="actividades-info">
          <p>Las organizaciones pueden desarrollar actividades deportivas, medioambientales, educativas, de capacitación, recreativas o culturales que involucren a los vecinos.</p>
        </div>

        <div class="actividades-filter">
          <button class="filter-btn active" data-filter="all">Todas</button>
          <button class="filter-btn" data-filter="deportiva">🏃 Deportivas</button>
          <button class="filter-btn" data-filter="cultural">🎭 Culturales</button>
          <button class="filter-btn" data-filter="educativa">📚 Educativas</button>
          <button class="filter-btn" data-filter="recreativa">🎉 Recreativas</button>
        </div>

        <div class="actividades-grid">
          ${actividades.length > 0 ? actividades.map(act => `
            <div class="actividad-card">
              <div class="actividad-date">
                <span class="day">${new Date(act.date).getDate()}</span>
                <span class="month">${new Date(act.date).toLocaleDateString('es-CL', { month: 'short' })}</span>
              </div>
              <div class="actividad-content">
                <span class="actividad-category">${act.category || 'General'}</span>
                <h4 class="actividad-title">${act.title}</h4>
                <p class="actividad-description">${act.description || ''}</p>
                <div class="actividad-footer">
                  <span class="actividad-time">🕐 ${act.time || '--:--'}</span>
                  <span class="actividad-location">📍 ${act.location || 'Por definir'}</span>
                </div>
              </div>
            </div>
          `).join('') : `
            <div class="empty-state-card full-width">
              <span class="empty-icon">📅</span>
              <h4>No hay actividades programadas</h4>
              <p>Organiza actividades para tu comunidad</p>
              <button class="btn-primary" id="btn-first-activity">Crear Primera Actividad</button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Helper para etiquetas de estado de proyecto
   */
  getProjectStatusLabel(status) {
    const labels = {
      'planning': 'En Planificación',
      'in_progress': 'En Ejecución',
      'completed': 'Completado',
      'paused': 'Pausado'
    };
    return labels[status] || 'Pendiente';
  }

  /**
   * Adjunta event listeners
   */
  attachEventListeners(overlay) {
    // Cerrar dashboard
    overlay.querySelector('.org-dashboard-close').addEventListener('click', () => {
      overlay.remove();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    // Navegación por tabs
    overlay.querySelectorAll('.org-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTab = btn.dataset.tab;
        overlay.querySelectorAll('.org-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        overlay.querySelector('.org-dashboard-content').innerHTML = this.renderTabContent();
        this.attachContentListeners(overlay);
      });
    });

    // Listeners del contenido
    this.attachContentListeners(overlay);
  }

  /**
   * Adjunta listeners específicos del contenido
   */
  attachContentListeners(overlay) {
    // Botón de validación manual de firmas - DEPRECADO
    // El Ministro de Fe solo interviene durante la constitución, no en organizaciones activas
    // const btnUserValidate = overlay.querySelector('.btn-user-validate');
    // if (btnUserValidate) {
    //   btnUserValidate.addEventListener('click', () => {
    //     this.showUserValidationModal(overlay);
    //   });
    // }

    // FASE 4: Botones de acción de alertas
    overlay.querySelectorAll('.alert-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const alertType = btn.dataset.alertType;
        this.handleAlertAction(alertType, overlay);
      });
    });

    // Agregar nuevo socio
    const btnAddMember = overlay.querySelector('#btn-add-new-member');
    if (btnAddMember) {
      btnAddMember.addEventListener('click', () => this.openAddMemberModal(overlay));
    }

    // Acciones rápidas
    overlay.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        switch (action) {
          case 'add-member':
            this.currentTab = 'members';
            this.refreshContent(overlay);
            setTimeout(() => this.openAddMemberModal(overlay), 100);
            break;
          case 'new-assembly':
            this.currentTab = 'asambleas';
            this.refreshContent(overlay);
            break;
          case 'new-project':
            this.currentTab = 'proyectos';
            this.refreshContent(overlay);
            break;
          case 'certificate':
            this.currentTab = 'documentos';
            this.refreshContent(overlay);
            break;
        }
      });
    });

    // Nueva asamblea
    const btnNewAssembly = overlay.querySelector('#btn-new-assembly') || overlay.querySelector('#btn-first-assembly');
    if (btnNewAssembly) {
      btnNewAssembly.addEventListener('click', () => this.openNewAssemblyModal(overlay));
    }

    // Nuevo proyecto
    const btnNewProject = overlay.querySelector('#btn-new-project') || overlay.querySelector('#btn-first-project');
    if (btnNewProject) {
      btnNewProject.addEventListener('click', () => this.openNewProjectModal(overlay));
    }

    // Nueva actividad
    const btnNewActivity = overlay.querySelector('#btn-new-activity') || overlay.querySelector('#btn-first-activity');
    if (btnNewActivity) {
      btnNewActivity.addEventListener('click', () => this.openNewActivityModal(overlay));
    }

    // Nueva transacción
    const btnNewTransaction = overlay.querySelector('#btn-new-transaction');
    if (btnNewTransaction) {
      btnNewTransaction.addEventListener('click', () => this.openNewTransactionModal(overlay));
    }

    // FASE 5: Solicitar disolución
    const btnRequestDissolution = overlay.querySelector('#btn-request-dissolution');
    if (btnRequestDissolution) {
      btnRequestDissolution.addEventListener('click', () => this.openDissolutionModal(overlay));
    }
  }

  /**
   * Refresca el contenido del tab actual
   */
  refreshContent(overlay) {
    overlay.querySelectorAll('.org-nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === this.currentTab);
    });
    overlay.querySelector('.org-dashboard-content').innerHTML = this.renderTabContent();
    this.attachContentListeners(overlay);
  }

  /**
   * Modal para agregar nuevo socio
   */
  openAddMemberModal(parentOverlay) {
    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal">
        <div class="org-modal-header">
          <h3>Agregar Nuevo Socio</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body">
          <form id="form-add-member">
            <div class="form-row">
              <div class="form-group">
                <label>Nombre *</label>
                <input type="text" id="member-firstname" required>
              </div>
              <div class="form-group">
                <label>Apellido *</label>
                <input type="text" id="member-lastname" required>
              </div>
            </div>
            <div class="form-group">
              <label>RUT *</label>
              <input type="text" id="member-rut" placeholder="12.345.678-9" required>
            </div>
            <div class="form-group">
              <label>Teléfono</label>
              <input type="tel" id="member-phone" value="+56 ">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="member-email">
            </div>
            <div class="form-group">
              <label>Dirección</label>
              <input type="text" id="member-address">
            </div>
          </form>
        </div>
        <div class="org-modal-footer">
          <button class="btn-cancel" type="button">Cancelar</button>
          <button class="btn-save" type="submit" form="form-add-member">Agregar Socio</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#form-add-member').addEventListener('submit', (e) => {
      e.preventDefault();

      const newMember = {
        id: 'member_' + Date.now(),
        firstName: modal.querySelector('#member-firstname').value.trim(),
        lastName: modal.querySelector('#member-lastname').value.trim(),
        rut: modal.querySelector('#member-rut').value.trim(),
        phone: modal.querySelector('#member-phone').value.trim(),
        email: modal.querySelector('#member-email').value.trim(),
        address: modal.querySelector('#member-address').value.trim(),
        joinDate: new Date().toISOString(),
        status: 'active'
      };

      if (!this.currentOrg.members) this.currentOrg.members = [];
      this.currentOrg.members.push(newMember);
      organizationsService.update(this.currentOrg.id, { members: this.currentOrg.members });

      showToast('Socio agregado correctamente', 'success');
      modal.remove();
      this.refreshContent(parentOverlay);
    });
  }

  /**
   * Modal para nueva asamblea
   */
  openNewAssemblyModal(parentOverlay) {
    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal">
        <div class="org-modal-header">
          <h3>Nueva Asamblea</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body">
          <form id="form-new-assembly">
            <div class="form-group">
              <label>Tipo de Asamblea *</label>
              <select id="assembly-type" required>
                <option value="ordinaria">Ordinaria</option>
                <option value="extraordinaria">Extraordinaria</option>
              </select>
            </div>
            <div class="form-group">
              <label>Fecha *</label>
              <input type="date" id="assembly-date" required>
            </div>
            <div class="form-group">
              <label>Hora</label>
              <input type="time" id="assembly-time">
            </div>
            <div class="form-group">
              <label>Título/Tema Principal *</label>
              <input type="text" id="assembly-title" required>
            </div>
            <div class="form-group">
              <label>Descripción</label>
              <textarea id="assembly-description" rows="3"></textarea>
            </div>
          </form>
        </div>
        <div class="org-modal-footer">
          <button class="btn-cancel" type="button">Cancelar</button>
          <button class="btn-save" type="submit" form="form-new-assembly">Crear Asamblea</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());

    modal.querySelector('#form-new-assembly').addEventListener('submit', (e) => {
      e.preventDefault();

      const newAssembly = {
        id: 'assembly_' + Date.now(),
        type: modal.querySelector('#assembly-type').value,
        date: modal.querySelector('#assembly-date').value,
        time: modal.querySelector('#assembly-time').value,
        title: modal.querySelector('#assembly-title').value.trim(),
        description: modal.querySelector('#assembly-description').value.trim(),
        attendance: 0,
        createdAt: new Date().toISOString()
      };

      if (!this.currentOrg.assemblies) this.currentOrg.assemblies = [];
      this.currentOrg.assemblies.push(newAssembly);
      organizationsService.update(this.currentOrg.id, { assemblies: this.currentOrg.assemblies });

      showToast('Asamblea creada correctamente', 'success');
      modal.remove();
      this.refreshContent(parentOverlay);
    });
  }

  /**
   * Modal para nuevo proyecto
   */
  openNewProjectModal(parentOverlay) {
    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal">
        <div class="org-modal-header">
          <h3>Nuevo Proyecto</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body">
          <form id="form-new-project">
            <div class="form-group">
              <label>Nombre del Proyecto *</label>
              <input type="text" id="project-title" required>
            </div>
            <div class="form-group">
              <label>Categoría</label>
              <select id="project-category">
                <option value="infraestructura">Infraestructura</option>
                <option value="areas_verdes">Áreas Verdes</option>
                <option value="seguridad">Seguridad Ciudadana</option>
                <option value="cultura">Cultura</option>
                <option value="deporte">Deporte</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div class="form-group">
              <label>Descripción *</label>
              <textarea id="project-description" rows="3" required></textarea>
            </div>
            <div class="form-group">
              <label>Presupuesto Estimado ($)</label>
              <input type="number" id="project-budget" min="0">
            </div>
          </form>
        </div>
        <div class="org-modal-footer">
          <button class="btn-cancel" type="button">Cancelar</button>
          <button class="btn-save" type="submit" form="form-new-project">Crear Proyecto</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());

    modal.querySelector('#form-new-project').addEventListener('submit', (e) => {
      e.preventDefault();

      const newProject = {
        id: 'project_' + Date.now(),
        title: modal.querySelector('#project-title').value.trim(),
        category: modal.querySelector('#project-category').value,
        description: modal.querySelector('#project-description').value.trim(),
        budget: parseInt(modal.querySelector('#project-budget').value) || 0,
        status: 'planning',
        progress: 0,
        createdAt: new Date().toISOString()
      };

      if (!this.currentOrg.projects) this.currentOrg.projects = [];
      this.currentOrg.projects.push(newProject);
      organizationsService.update(this.currentOrg.id, { projects: this.currentOrg.projects });

      showToast('Proyecto creado correctamente', 'success');
      modal.remove();
      this.refreshContent(parentOverlay);
    });
  }

  /**
   * Modal para nueva actividad
   */
  openNewActivityModal(parentOverlay) {
    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal">
        <div class="org-modal-header">
          <h3>Nueva Actividad</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body">
          <form id="form-new-activity">
            <div class="form-group">
              <label>Nombre de la Actividad *</label>
              <input type="text" id="activity-title" required>
            </div>
            <div class="form-group">
              <label>Categoría</label>
              <select id="activity-category">
                <option value="deportiva">🏃 Deportiva</option>
                <option value="cultural">🎭 Cultural</option>
                <option value="educativa">📚 Educativa</option>
                <option value="recreativa">🎉 Recreativa</option>
                <option value="medioambiental">🌱 Medioambiental</option>
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Fecha *</label>
                <input type="date" id="activity-date" required>
              </div>
              <div class="form-group">
                <label>Hora</label>
                <input type="time" id="activity-time">
              </div>
            </div>
            <div class="form-group">
              <label>Lugar</label>
              <input type="text" id="activity-location">
            </div>
            <div class="form-group">
              <label>Descripción</label>
              <textarea id="activity-description" rows="3"></textarea>
            </div>
          </form>
        </div>
        <div class="org-modal-footer">
          <button class="btn-cancel" type="button">Cancelar</button>
          <button class="btn-save" type="submit" form="form-new-activity">Crear Actividad</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());

    modal.querySelector('#form-new-activity').addEventListener('submit', (e) => {
      e.preventDefault();

      const newActivity = {
        id: 'activity_' + Date.now(),
        title: modal.querySelector('#activity-title').value.trim(),
        category: modal.querySelector('#activity-category').value,
        date: modal.querySelector('#activity-date').value,
        time: modal.querySelector('#activity-time').value,
        location: modal.querySelector('#activity-location').value.trim(),
        description: modal.querySelector('#activity-description').value.trim(),
        createdAt: new Date().toISOString()
      };

      if (!this.currentOrg.activities) this.currentOrg.activities = [];
      this.currentOrg.activities.push(newActivity);
      organizationsService.update(this.currentOrg.id, { activities: this.currentOrg.activities });

      showToast('Actividad creada correctamente', 'success');
      modal.remove();
      this.refreshContent(parentOverlay);
    });
  }

  /**
   * Modal para nueva transacción financiera
   */
  openNewTransactionModal(parentOverlay) {
    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal">
        <div class="org-modal-header">
          <h3>Registrar Movimiento</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body">
          <form id="form-new-transaction">
            <div class="form-group">
              <label>Tipo *</label>
              <select id="tx-type" required>
                <option value="income">Ingreso</option>
                <option value="expense">Gasto</option>
              </select>
            </div>
            <div class="form-group">
              <label>Monto ($) *</label>
              <input type="number" id="tx-amount" min="1" required>
            </div>
            <div class="form-group">
              <label>Descripción *</label>
              <input type="text" id="tx-description" required>
            </div>
            <div class="form-group">
              <label>Fecha</label>
              <input type="date" id="tx-date" value="${new Date().toISOString().split('T')[0]}">
            </div>
          </form>
        </div>
        <div class="org-modal-footer">
          <button class="btn-cancel" type="button">Cancelar</button>
          <button class="btn-save" type="submit" form="form-new-transaction">Registrar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());

    modal.querySelector('#form-new-transaction').addEventListener('submit', (e) => {
      e.preventDefault();

      const type = modal.querySelector('#tx-type').value;
      const amount = parseInt(modal.querySelector('#tx-amount').value);

      const newTx = {
        id: 'tx_' + Date.now(),
        type: type,
        amount: amount,
        description: modal.querySelector('#tx-description').value.trim(),
        date: modal.querySelector('#tx-date').value,
        createdAt: new Date().toISOString()
      };

      if (!this.currentOrg.finances) {
        this.currentOrg.finances = { balance: 0, transactions: [] };
      }

      this.currentOrg.finances.transactions = this.currentOrg.finances.transactions || [];
      this.currentOrg.finances.transactions.unshift(newTx);

      // Actualizar balance
      if (type === 'income') {
        this.currentOrg.finances.balance += amount;
      } else {
        this.currentOrg.finances.balance -= amount;
      }

      organizationsService.update(this.currentOrg.id, { finances: this.currentOrg.finances });

      showToast('Movimiento registrado correctamente', 'success');
      modal.remove();
      this.refreshContent(parentOverlay);
    });
  }

  /**
   * FASE 4: Maneja las acciones de las alertas
   */
  async handleAlertAction(alertType, parentOverlay) {
    const { ALERT_TYPES } = await import('../../services/AlertsService.js');

    switch (alertType) {
      case ALERT_TYPES.DIRECTORIO_DEFINITIVO:
        showToast('Funcionalidad en desarrollo: Registrar Directorio Definitivo', 'info');
        // TODO: Abrir modal para registrar directorio definitivo
        break;

      case ALERT_TYPES.REGISTRO_SOCIOS:
        showToast('Funcionalidad en desarrollo: Actualizar Registro de Socios', 'info');
        // TODO: Abrir modal para subir registro actualizado
        break;

      case ALERT_TYPES.COMISION_REVISORA:
        showToast('Funcionalidad en desarrollo: Elegir Comisión Revisora de Cuentas', 'info');
        // TODO: Abrir modal para designar comisión revisora
        break;

      case ALERT_TYPES.TRICEL_DESIGNATION:
        showToast('Funcionalidad en desarrollo: Designar TRICEL', 'info');
        // TODO: Abrir modal para designar TRICEL
        break;

      case ALERT_TYPES.DIRECTORIO_RENEWAL:
        showToast('Funcionalidad en desarrollo: Renovar Directorio', 'info');
        // TODO: Iniciar proceso electoral
        break;

      default:
        showToast('Acción no reconocida', 'error');
    }
  }

  /**
   * FASE 5: Modal para solicitar disolución de la organización
   */
  openDissolutionModal(parentOverlay) {
    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal dissolution-modal">
        <div class="org-modal-header dissolution-header">
          <h3>⚠️ Solicitar Disolución de Organización</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body">
          <div class="dissolution-warning">
            <div class="warning-box">
              <strong>ADVERTENCIA:</strong> Esta acción es irreversible.
              La organización será disuelta permanentemente y no podrá ser restaurada.
            </div>
          </div>

          <form id="form-dissolution">
            <div class="form-group">
              <label>Motivo de la Disolución *</label>
              <select id="dissolution-reason" required>
                <option value="">Seleccione un motivo</option>
                <option value="solicitud_usuario">Decisión de la Asamblea</option>
                <option value="inactiva">Organización inactiva</option>
                <option value="objetivos_cumplidos">Objetivos cumplidos</option>
                <option value="fusion">Fusión con otra organización</option>
                <option value="falta_recursos">Falta de recursos</option>
                <option value="otra">Otra razón</option>
              </select>
            </div>

            <div class="form-group">
              <label>Detalles Adicionales</label>
              <textarea
                id="dissolution-details"
                rows="4"
                placeholder="Proporcione información adicional sobre la solicitud de disolución..."
              ></textarea>
            </div>

            <div class="form-group confirmation-group">
              <label class="checkbox-label">
                <input type="checkbox" id="confirm-dissolution" required>
                <span>Confirmo que entiendo que esta acción es irreversible y que la organización <strong>"${this.currentOrg.organization?.name}"</strong> será disuelta permanentemente.</span>
              </label>
            </div>
          </form>
        </div>
        <div class="org-modal-footer">
          <button class="btn-cancel" type="button">Cancelar</button>
          <button class="btn-danger" type="submit" form="form-dissolution" id="btn-confirm-dissolution">
            Solicitar Disolución
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Form submit
    modal.querySelector('#form-dissolution').addEventListener('submit', (e) => {
      e.preventDefault();

      const reason = modal.querySelector('#dissolution-reason').value;
      const details = modal.querySelector('#dissolution-details').value.trim();
      const confirmed = modal.querySelector('#confirm-dissolution').checked;

      if (!reason) {
        showToast('Debe seleccionar un motivo', 'error');
        return;
      }

      if (!confirmed) {
        showToast('Debe confirmar la disolución', 'error');
        return;
      }

      // Confirmar disolución
      const success = organizationsService.dissolveOrganization(
        this.currentOrg.id,
        reason,
        details || 'Solicitud de disolución por parte del usuario'
      );

      if (success) {
        showToast('Solicitud de disolución enviada correctamente. La organización ha sido disuelta.', 'success');
        modal.remove();
        parentOverlay.remove(); // Cerrar dashboard

        // Recargar página para actualizar lista
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showToast('Error al procesar la disolución', 'error');
      }
    });
  }

  /**
   * Modal para que el usuario valide firmas manualmente - DEPRECADO
   * Esta función ya no se usa porque el Ministro de Fe solo interviene
   * durante el proceso de constitución, no en organizaciones activas.
   */
  showUserValidationModal(parentOverlay) {
    // Función deprecada - retornar sin hacer nada
    console.warn('showUserValidationModal: Esta función está deprecada');
    return;

    // Código deprecado abajo - mantener por referencia
    const org = this.currentOrg;
    // const assignment = ministroAssignmentService.getByOrganizationId(org.id)[0];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 700px;">
        <div class="modal-header" style="padding: 24px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; border-bottom: none;">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 12px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              <path d="M2 2l7.586 7.586"></path>
              <circle cx="11" cy="11" r="2"></circle>
            </svg>
            Validación Manual de Firmas
          </h3>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${org.organizationName}</p>
        </div>
        <form id="user-validate-signatures-form" style="padding: 24px;">
          <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: 500;">
              ⚠️ <strong>Validación Alternativa</strong><br>
              Como el Ministro de Fe no realizó la validación en la fecha programada, puedes validar las firmas manualmente.
              Las fotos de los carnets de identidad ya fueron cargadas en el sistema.
            </p>
          </div>

          <div style="background: #e0f2fe; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #0284c7;">
            <p style="margin: 0 0 12px; font-size: 14px; color: #075985; font-weight: 600;">
              📸 Fotos de Carnets Disponibles
            </p>
            <div id="id-photos-preview" style="display: flex; flex-direction: column; gap: 12px;">
              ${org.commission?.members.map((member, index) => {
                const roles = ['Presidente', 'Secretario', 'Vocal'];
                const photos = org.idPhotos?.[member.id];

                return `
                  <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #bae6fd;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <strong style="color: #0c4a6e;">${roles[index]}: ${member.name} ${member.lastName}</strong>
                      ${photos?.front && photos?.back ? `
                        <span style="color: #10b981; font-size: 13px; font-weight: 600;">✓ Fotos disponibles</span>
                      ` : `
                        <span style="color: #ef4444; font-size: 13px; font-weight: 600;">⚠️ Fotos no disponibles</span>
                      `}
                    </div>
                    ${photos?.front && photos?.back ? `
                      <div style="display: flex; gap: 8px;">
                        <button type="button" class="btn-secondary-sm btn-view-id-photo" data-member-id="${member.id}" data-side="front" style="font-size: 12px; padding: 6px 12px;">
                          Ver Frontal
                        </button>
                        <button type="button" class="btn-secondary-sm btn-view-id-photo" data-member-id="${member.id}" data-side="back" style="font-size: 12px; padding: 6px 12px;">
                          Ver Trasero
                        </button>
                      </div>
                    ` : `
                      <p style="margin: 0; font-size: 12px; color: #64748b;">Las fotos no fueron cargadas en el proceso inicial.</p>
                    `}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 20px; margin-top: 24px;">
            ${org.commission?.members.map((member, index) => {
              const roles = ['Presidente', 'Secretario', 'Vocal'];
              return `
                <div style="border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px;">
                  <div style="display: flex; align-items: start; gap: 12px;">
                    <input type="checkbox" id="validate-user-${index}" name="${roles[index].toLowerCase()}" required style="
                      width: 20px;
                      height: 20px;
                      margin-top: 4px;
                      cursor: pointer;
                      accent-color: #3b82f6;
                    ">
                    <div style="flex: 1;">
                      <label for="validate-user-${index}" style="cursor: pointer; display: block; font-weight: 600; font-size: 15px; color: #1f2937; margin-bottom: 4px;">
                        ${index === 0 ? '👤' : index === 1 ? '📝' : '💰'} ${roles[index]}
                      </label>
                      <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280;">Confirmar identidad y firma de ${member.name} ${member.lastName}</p>
                      <input type="text" id="user-${roles[index].toLowerCase()}-name" placeholder="Nombre completo" value="${member.name} ${member.lastName}" required style="
                        width: 100%;
                        padding: 10px;
                        border: 1px solid #e5e7eb;
                        border-radius: 6px;
                        font-size: 14px;
                        box-sizing: border-box;
                        margin-bottom: 8px;
                      ">
                      <input type="text" id="user-${roles[index].toLowerCase()}-rut" placeholder="RUT (ej: 12.345.678-9)" value="${member.rut}" required style="
                        width: 100%;
                        padding: 10px;
                        border: 1px solid #e5e7eb;
                        border-radius: 6px;
                        font-size: 14px;
                        box-sizing: border-box;
                      ">
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div style="margin-top: 24px;">
            <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">
              Observaciones (opcional)
            </label>
            <textarea id="user-validation-notes" rows="3" style="
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
              ⚠️ Al confirmar, certificas que has verificado la identidad de los firmantes mediante las fotos de sus carnets de identidad.
            </p>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-user-validation">
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

    // Event listeners para ver fotos
    modal.querySelectorAll('.btn-view-id-photo').forEach(btn => {
      btn.addEventListener('click', () => {
        const memberId = btn.dataset.memberId;
        const side = btn.dataset.side;
        const photo = org.idPhotos?.[memberId]?.[side];

        if (photo) {
          this.showIdPhotoModal(photo, side);
        }
      });
    });

    // Cancelar
    modal.querySelector('#btn-cancel-user-validation').addEventListener('click', () => modal.remove());

    // Submit
    modal.querySelector('#user-validate-signatures-form').addEventListener('submit', (e) => {
      e.preventDefault();

      const validationData = {
        validatedBy: 'ORGANIZADOR',
        validatorId: org.userId,
        validatorName: 'Organizador',
        signatures: {
          presidente: {
            name: modal.querySelector('#user-presidente-name').value.trim(),
            rut: modal.querySelector('#user-presidente-rut').value.trim(),
            validated: modal.querySelector('#validate-user-0').checked
          },
          secretario: {
            name: modal.querySelector('#user-secretario-name').value.trim(),
            rut: modal.querySelector('#user-secretario-rut').value.trim(),
            validated: modal.querySelector('#validate-user-1').checked
          },
          vocal: {
            name: modal.querySelector('#user-vocal-name').value.trim(),
            rut: modal.querySelector('#user-vocal-rut').value.trim(),
            validated: modal.querySelector('#validate-user-2').checked
          },
          notes: modal.querySelector('#user-validation-notes').value.trim()
        }
      };

      try {
        if (assignment) {
          ministroAssignmentService.markSignaturesValidated(assignment.id, validationData);
        } else {
          // Crear asignación si no existe
          const newAssignment = ministroAssignmentService.create({
            ministroId: org.ministroData.ministroId,
            ministroName: org.ministroData.ministroName,
            ministroRut: org.ministroData.ministroRut,
            organizationId: org.id,
            organizationName: org.organizationName,
            scheduledDate: org.ministroData.scheduledDate,
            scheduledTime: org.ministroData.scheduledTime,
            location: org.ministroData.location
          });

          ministroAssignmentService.markSignaturesValidated(newAssignment.id, validationData);
        }

        showToast('✅ Firmas validadas exitosamente', 'success');
        modal.remove();

        // Refrescar dashboard
        parentOverlay.querySelector('.org-dashboard-content').innerHTML = this.renderTabContent();
        this.attachContentListeners(parentOverlay);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  /**
   * Muestra modal con foto de carnet
   */
  showIdPhotoModal(photo, side) {
    const photoModal = document.createElement('div');
    photoModal.className = 'modal-overlay';
    photoModal.style.display = 'flex';
    photoModal.style.zIndex = '10001';
    photoModal.innerHTML = `
      <div class="modal-content" style="max-width: 800px;">
        <div class="modal-header">
          <h3>Carnet ${side === 'front' ? 'Frontal' : 'Trasero'}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body" style="text-align: center; padding: 24px;">
          <img src="${photo.data}" alt="Carnet" style="max-width: 100%; max-height: 70vh; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
          <div style="margin-top: 16px; color: #6b7280; font-size: 14px;">
            ${photo.fileName} • ${(photo.fileSize / 1024).toFixed(1)} KB
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(photoModal);

    photoModal.querySelector('.modal-close-btn').addEventListener('click', () => photoModal.remove());
    photoModal.addEventListener('click', (e) => {
      if (e.target === photoModal) photoModal.remove();
    });
  }
}

// Instancia singleton
export const organizationDashboard = new OrganizationDashboard();
