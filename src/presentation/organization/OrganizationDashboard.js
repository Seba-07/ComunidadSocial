/**
 * Dashboard de Administración de Organización Aprobada
 * Permite al usuario gestionar todos los aspectos de su organización comunitaria
 */

import { organizationsService, ORG_STATUS } from '../../services/OrganizationsService.js';
import { alertsService, ALERT_PRIORITY } from '../../services/AlertsService.js';
// ministroAssignmentService ya no se usa - Ministro de Fe solo es para constitución
// import { ministroAssignmentService } from '../../services/MinistroAssignmentService.js';
import { orgDocumentService } from '../../services/OrgDocumentService.js';
import { pdfService } from '../../services/PDFService.js';
import { apiService } from '../../services/ApiService.js';
import { jsPDF } from 'jspdf';
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
    this.orgDocuments = [];
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
              <span class="info-value">${org.organizationName || org.organization?.name || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Tipo</span>
              <span class="info-value">${getOrgTypeName(org.organizationType || org.organization?.type)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Dirección</span>
              <span class="info-value">${org.address || org.organization?.address || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Comuna</span>
              <span class="info-value">${org.comuna || org.organization?.commune || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Unidad Vecinal</span>
              <span class="info-value">${org.unidadVecinal || org.organization?.neighborhood || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Fecha de Aprobación</span>
              <span class="info-value">${approvedDate ? new Date(approvedDate).toLocaleDateString('es-CL') : '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Email</span>
              <span class="info-value">${org.contactEmail || org.organization?.email || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Teléfono</span>
              <span class="info-value">${org.contactPhone || org.organization?.phone || '-'}</span>
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
            <button class="quick-action-btn" id="btn-view-validation">
              <span class="action-icon">✅</span>
              <span>Ver Validación Ministro</span>
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
                    <button class="btn-icon btn-edit-member" data-rut="${member.rut}" title="Editar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button class="btn-icon btn-delete-member" data-rut="${member.rut}" title="Eliminar">
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
  /**
   * Obtiene la configuración de cargos del directorio según el tipo de organización
   */
  getDirectorioConfig(orgType) {
    const configs = {
      JUNTA_VECINOS: { cargos: [
        { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb' },
        { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6' },
        { id: 'secretario', nombre: 'Secretario/a', color: '#10b981' },
        { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b' },
        { id: 'director1', nombre: 'Director/a', color: '#6366f1' }
      ]},
      COMITE_VECINOS: { cargos: [
        { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb' },
        { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6' },
        { id: 'secretario', nombre: 'Secretario/a', color: '#10b981' },
        { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b' },
        { id: 'director1', nombre: 'Director/a', color: '#6366f1' }
      ]},
      COMITE_VIVIENDA: { cargos: [
        { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb' },
        { id: 'secretario', nombre: 'Secretario/a', color: '#10b981' },
        { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b' },
        { id: 'director1', nombre: 'Director/a 1', color: '#6366f1' },
        { id: 'director2', nombre: 'Director/a 2', color: '#ec4899' }
      ]},
      CENTRO_PADRES: { cargos: [
        { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb' },
        { id: 'secretario', nombre: 'Secretario General', color: '#10b981' },
        { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b' },
        { id: 'director1', nombre: 'Director/a', color: '#6366f1' }
      ]},
      COMITE_CONVIVENCIA: { cargos: [
        { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb' },
        { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6' },
        { id: 'secretario', nombre: 'Secretario/a', color: '#10b981' },
        { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b' },
        { id: 'directorPrevencion', nombre: 'Director/a de Prevención', color: '#ef4444' },
        { id: 'directorConvivencia', nombre: 'Director/a de Convivencia', color: '#06b6d4' }
      ]}
    };
    // Default para la mayoría de tipos
    const defaultConfig = { cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb' },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6' },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981' },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b' },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1' }
    ]};
    // Intentar desde estatutosSnapshot primero, luego config local
    const snapshotCargos = this.currentOrg.estatutosSnapshot?.directorio?.cargos;
    if (snapshotCargos && snapshotCargos.length > 0) return { cargos: snapshotCargos };
    return configs[orgType] || defaultConfig;
  }

  /**
   * Obtiene el miembro del directorio provisorio para un cargo dado
   */
  getProvisionalMember(org, cargoId) {
    const prov = org.provisionalDirectorio || org.directorioProvisorio;
    if (!prov) return null;
    // Mapeo de id de cargo a campo del provisionalDirectorio
    const fieldMap = {
      'presidente': 'president',
      'vicepresidente': 'vicePresident',
      'secretario': 'secretary',
      'tesorero': 'treasurer',
      'director1': null,
      'director2': null,
      'directorPrevencion': null,
      'directorConvivencia': null
    };
    const field = fieldMap[cargoId];
    if (field && prov[field]) return prov[field];
    // También buscar con nombre en español directamente
    if (prov[cargoId]) return prov[cargoId];
    // Buscar en additionalMembers para directores
    if (cargoId.startsWith('director') && prov.additionalMembers) {
      const idx = cargoId === 'director1' ? 0 : cargoId === 'director2' ? 1 : null;
      if (idx !== null && prov.additionalMembers[idx]) return prov.additionalMembers[idx];
    }
    // Buscar en miembros del org por role
    const roleMap = { 'presidente': 'president', 'vicepresidente': 'vice_president', 'secretario': 'secretary', 'tesorero': 'treasurer', 'director1': 'director', 'director2': 'director' };
    const memberRole = roleMap[cargoId];
    if (memberRole && org.members) {
      const found = org.members.filter(m => m.role === memberRole);
      if (cargoId === 'director2') return found[1] || null;
      return found[0] || null;
    }
    return null;
  }

  renderDirectorio() {
    const org = this.currentOrg;
    const orgType = org.organizationType || org.organization?.type;
    const config = this.getDirectorioConfig(orgType);
    const cargos = config.cargos;
    const isProvisional = !org.definitiveDirectorio;
    const lastElection = org.lastDirectorioElection;
    const lastElectionDate = lastElection?.date ? new Date(lastElection.date).toLocaleDateString('es-CL') : null;
    const dirType = org.provisionalDirectorio?.type === 'ELECTO' ? 'Electo' : 'Provisorio';

    const roleDescriptions = {
      'presidente': 'Representa legal y judicialmente a la organización.',
      'vicepresidente': 'Reemplaza al presidente y colabora en la gestión.',
      'secretario': 'Administra los libros de socios y actas.',
      'tesorero': 'Lleva la contabilidad y administra los recursos.',
      'director1': 'Colabora en la gestión y toma de decisiones.',
      'director2': 'Colabora en la gestión y toma de decisiones.',
      'directorPrevencion': 'Coordina acciones de prevención comunitaria.',
      'directorConvivencia': 'Promueve la convivencia y resolución de conflictos.'
    };

    return `
      <div class="org-directorio-section">
        <div class="section-header">
          <h3>Directorio ${isProvisional ? `<span style="background:#f59e0b20;color:#b45309;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;margin-left:8px;">${dirType}</span>` : ''}</h3>
          <button class="btn-schedule-election-assembly" id="btn-schedule-election-assembly">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Agendar Elección
          </button>
        </div>

        <div class="directorio-info">
          <p>El directorio debe contar con al menos ${cargos.length} miembros titulares mayores de 18 años, elegidos por votación directa. Cada miembro dura <strong>3 años</strong> en su cargo, con posibilidad de reelección.</p>
          ${isProvisional && dirType === 'Provisorio' ? '<p style="color:#b45309;font-size:13px;">Este es el directorio provisorio designado en la asamblea constitutiva. Agende una asamblea con elección para definir el directorio definitivo.</p>' : ''}
          ${lastElectionDate ? `<p style="color:#059669;font-size:13px;">Ultima elección: <strong>${lastElectionDate}</strong></p>` : ''}
        </div>

        <div class="directorio-cards">
          ${cargos.map(cargo => {
            const member = this.getProvisionalMember(org, cargo.id);
            const memberName = member ? `${member.firstName || member.name || ''} ${member.lastName || member.apellidoPaterno || ''}`.trim() : null;
            const memberRut = member?.rut || '-';
            const initial = memberName ? memberName[0]?.toUpperCase() : '?';
            return `
              <div class="directorio-card ${member ? '' : 'empty'}" style="border-top: 3px solid ${cargo.color}">
                <div class="directorio-role" style="color:${cargo.color}">${cargo.nombre}</div>
                ${member ? `
                  <div class="directorio-member">
                    <div class="member-avatar large" style="background:${cargo.color}20;color:${cargo.color}">${initial}</div>
                    <div class="member-details">
                      <span class="member-name">${memberName}</span>
                      <span class="member-rut">${memberRut}</span>
                    </div>
                  </div>
                  <div class="directorio-description">${roleDescriptions[cargo.id] || ''}</div>
                ` : `
                  <div class="empty-slot">
                    <span>Sin asignar</span>
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
    const statusConfig = {
      draft: { label: 'Borrador', color: '#6b7280', bg: '#f3f4f6' },
      convocada: { label: 'Convocada', color: '#2563eb', bg: '#eff6ff' },
      en_curso: { label: 'En Curso', color: '#059669', bg: '#ecfdf5' },
      finalizada: { label: 'Finalizada', color: '#7c3aed', bg: '#f5f3ff' },
      cancelada: { label: 'Cancelada', color: '#ef4444', bg: '#fef2f2' }
    };

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
              ${asambleas.map(asamblea => {
                const st = statusConfig[asamblea.status] || statusConfig.draft;
                const agendaCount = (asamblea.agendaItems || []).length;
                return `
                <div class="asamblea-item">
                  <div class="asamblea-date">${asamblea.date ? new Date(asamblea.date).toLocaleDateString('es-CL') : '-'}</div>
                  <div class="asamblea-info">
                    <span class="asamblea-type ${asamblea.type}">${asamblea.type === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'}</span>
                    <span class="asamblea-title">${asamblea.title || 'Sin título'}</span>
                    <span class="assembly-status-badge" style="background:${st.bg};color:${st.color};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">${st.label}</span>
                    ${agendaCount > 0 ? `<span style="font-size:11px;color:#6b7280;">${agendaCount} punto${agendaCount > 1 ? 's' : ''}</span>` : ''}
                  </div>
                  <div class="asamblea-attendance">${asamblea.attendance || 0} asist.</div>
                  <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <button class="btn-view-assembly" data-id="${asamblea.id}" style="padding: 6px 12px; font-size: 12px; border: 1px solid #d1d5db; border-radius: 6px; background: white; cursor: pointer;">Ver</button>
                    ${asamblea.status === 'draft' ? `<button class="btn-convoke-assembly" data-id="${asamblea.id}" style="padding: 6px 12px; font-size: 12px; border: 1px solid #2563eb; border-radius: 6px; background: #eff6ff; color: #2563eb; cursor: pointer; font-weight:600;">Convocar</button>` : ''}
                    ${asamblea.status === 'convocada' ? `<button class="btn-start-assembly" data-id="${asamblea.id}" style="padding: 6px 12px; font-size: 12px; border: 1px solid #059669; border-radius: 6px; background: #ecfdf5; color: #059669; cursor: pointer; font-weight:600;">Iniciar</button>` : ''}
                    ${asamblea.status === 'en_curso' ? `<button class="btn-finish-assembly" data-id="${asamblea.id}" style="padding: 6px 12px; font-size: 12px; border: 1px solid #7c3aed; border-radius: 6px; background: #f5f3ff; color: #7c3aed; cursor: pointer; font-weight:600;">Finalizar</button>` : ''}
                    ${['draft', 'convocada'].includes(asamblea.status) ? `<button class="btn-delete-assembly" data-id="${asamblea.id}" style="padding: 6px 12px; font-size: 12px; border: 1px solid #fecaca; border-radius: 6px; background: white; color: #ef4444; cursor: pointer;">Eliminar</button>` : ''}
                  </div>
                </div>
              `;}).join('')}
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
                <div class="election-item" data-id="${e.id}">
                  <div class="election-date">${new Date(e.date).toLocaleDateString('es-CL')}</div>
                  <div class="election-info">
                    <span class="election-type">${e.type === 'total' ? 'Renovación Total' : 'Renovación Parcial'}</span>
                    <span class="election-result ${e.result === 'Pendiente' ? 'pending' : ''}">${e.result || 'Sin resultado'}</span>
                  </div>
                  <div class="election-participation">${e.participation || 0}% participación</div>
                  <div class="election-actions" style="display: flex; gap: 6px; margin-left: auto;">
                    <button class="btn-edit-election" data-id="${e.id}" style="padding: 4px 10px; font-size: 12px; border: 1px solid #d1d5db; border-radius: 6px; background: white; cursor: pointer; color: #3b82f6;">Editar</button>
                    <button class="btn-delete-election" data-id="${e.id}" style="padding: 4px 10px; font-size: 12px; border: 1px solid #fca5a5; border-radius: 6px; background: white; cursor: pointer; color: #ef4444;">Eliminar</button>
                  </div>
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
                  <button class="btn-view-comm" data-id="${c.id}" style="padding: 6px 12px; font-size: 12px; border: 1px solid #d1d5db; border-radius: 6px; background: white; cursor: pointer;">Ver</button>
                  <button class="btn-delete-comm" data-id="${c.id}" style="padding: 6px 10px; font-size: 12px; border: 1px solid #fecaca; border-radius: 6px; background: white; color: #ef4444; cursor: pointer;">×</button>
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
                  <button class="btn-delete-tx" data-id="${tx.id}" style="padding: 4px 8px; font-size: 11px; border: 1px solid #fecaca; border-radius: 4px; background: white; color: #ef4444; cursor: pointer; margin-left: 8px;" title="Eliminar">×</button>
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
                <div style="display: flex; gap: 6px;">
                  <button class="btn-view-project" data-id="${proyecto.id}" style="padding: 6px 12px; font-size: 12px; border: 1px solid #d1d5db; border-radius: 6px; background: white; cursor: pointer;">Ver</button>
                  <button class="btn-delete-project" data-id="${proyecto.id}" style="padding: 6px 12px; font-size: 12px; border: 1px solid #fecaca; border-radius: 6px; background: white; color: #ef4444; cursor: pointer;">Eliminar</button>
                </div>
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
                <div class="doc-actions">
                  <button class="btn-view-legal-doc" data-doc-type="estatutos">Ver</button>
                  <button class="btn-download-legal-doc" data-doc-type="estatutos">⬇</button>
                </div>
              </div>
              <div class="doc-item">
                <span class="doc-icon">📄</span>
                <span class="doc-name">Acta Constitutiva</span>
                <div class="doc-actions">
                  <button class="btn-view-legal-doc" data-doc-type="acta">Ver</button>
                  <button class="btn-download-legal-doc" data-doc-type="acta">⬇</button>
                </div>
              </div>
              <div class="doc-item">
                <span class="doc-icon">📄</span>
                <span class="doc-name">Certificación Municipal</span>
                <div class="doc-actions">
                  <button class="btn-view-legal-doc" data-doc-type="certificacion">Ver</button>
                  <button class="btn-download-legal-doc" data-doc-type="certificacion">⬇</button>
                </div>
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

        <!-- Documentos Subidos de la Organizacion -->
        <div class="org-uploaded-documents-section" style="margin-top: 32px;">
          <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #1f2937;">Documentos Subidos</h3>
            <button class="btn-upload-org-doc" id="btn-upload-org-doc" style="
              display: inline-flex; align-items: center; gap: 8px;
              padding: 10px 20px; background: #2563eb; color: white;
              border: none; border-radius: 8px; font-size: 14px; font-weight: 500;
              cursor: pointer; transition: background 0.2s;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Subir Documento
            </button>
          </div>
          <div id="org-documents-list" style="min-height: 60px;">
            ${this.renderOrgDocuments()}
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
            <div class="actividad-card" data-category="${act.category || 'general'}" data-id="${act.id}">
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
                <div class="actividad-actions" style="margin-top: 8px; display: flex; gap: 8px;">
                  <button class="btn-edit-activity" data-id="${act.id}" style="padding: 4px 12px; font-size: 12px; border: 1px solid #d1d5db; border-radius: 6px; background: white; cursor: pointer;">Editar</button>
                  <button class="btn-delete-activity" data-id="${act.id}" style="padding: 4px 12px; font-size: 12px; border: 1px solid #fecaca; border-radius: 6px; background: white; color: #ef4444; cursor: pointer;">Eliminar</button>
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

  // ==========================================
  // Documentos de la Organizacion - Metodos
  // ==========================================

  /**
   * Categorias de documentos con labels y colores
   */
  get DOC_CATEGORIES() {
    return {
      ACTA_ASAMBLEA: { label: 'Acta de Asamblea', color: '#2563eb' },
      BALANCE: { label: 'Balance Financiero', color: '#10b981' },
      INFORME: { label: 'Informe', color: '#8b5cf6' },
      CERTIFICADO: { label: 'Certificado', color: '#f59e0b' },
      CORRESPONDENCIA: { label: 'Correspondencia', color: '#06b6d4' },
      OTRO: { label: 'Otro', color: '#6b7280' }
    };
  }

  /**
   * Carga los documentos subidos de la organizacion desde el servidor
   */
  async loadOrgDocuments() {
    if (!this.currentOrg) return;
    try {
      const response = await orgDocumentService.getDocuments(this.currentOrg.id);
      this.orgDocuments = response.documents || response || [];
    } catch (error) {
      console.error('Error al cargar documentos de la organizacion:', error);
      this.orgDocuments = [];
    }
  }

  /**
   * Renderiza la lista de documentos subidos
   */
  renderOrgDocuments() {
    if (!this.orgDocuments || this.orgDocuments.length === 0) {
      return `
        <div class="empty-state-card" style="
          text-align: center; padding: 40px 20px;
          background: #f9fafb; border: 2px dashed #e5e7eb;
          border-radius: 12px;
        ">
          <span style="font-size: 48px; display: block; margin-bottom: 12px;">📂</span>
          <p style="margin: 0; color: #6b7280; font-size: 15px;">No hay documentos subidos aun</p>
          <p style="margin: 8px 0 0; color: #9ca3af; font-size: 13px;">Sube actas, balances, informes y otros documentos de tu organizacion</p>
        </div>
      `;
    }

    return `
      <div class="org-docs-grid" style="display: flex; flex-direction: column; gap: 12px;">
        ${this.orgDocuments.map(doc => {
          const catInfo = this.DOC_CATEGORIES[doc.category] || this.DOC_CATEGORIES.OTRO;
          const uploadDate = doc.uploadDate || doc.createdAt;
          const formattedDate = uploadDate ? new Date(uploadDate).toLocaleDateString('es-CL') : '-';
          const fileSize = doc.size ? this.formatFileSize(doc.size) : (doc.fileSize ? this.formatFileSize(doc.fileSize) : '-');
          return `
            <div class="org-doc-item" style="
              display: flex; align-items: center; gap: 16px;
              padding: 16px; background: white;
              border: 1px solid #e5e7eb; border-radius: 10px;
              transition: box-shadow 0.2s;
            ">
              <div class="org-doc-icon" style="
                width: 44px; height: 44px; border-radius: 10px;
                background: ${catInfo.color}15; display: flex;
                align-items: center; justify-content: center; flex-shrink: 0;
              ">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${catInfo.color}" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <div class="org-doc-info" style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span style="font-weight: 600; color: #1f2937; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${doc.name || 'Sin nombre'}</span>
                  <span style="
                    display: inline-block; padding: 2px 10px; border-radius: 12px;
                    font-size: 11px; font-weight: 600; color: white;
                    background: ${catInfo.color};
                  ">${catInfo.label}</span>
                </div>
                <div style="display: flex; gap: 16px; margin-top: 4px; font-size: 12px; color: #9ca3af;">
                  <span>${formattedDate}</span>
                  <span>${fileSize}</span>
                  ${doc.description ? `<span style="color: #6b7280;">${doc.description}</span>` : ''}
                </div>
              </div>
              <div class="org-doc-actions" style="display: flex; gap: 8px; flex-shrink: 0;">
                <button class="btn-download-org-doc" data-doc-id="${doc._id || doc.id}" title="Descargar" style="
                  width: 36px; height: 36px; border: 1px solid #e5e7eb;
                  border-radius: 8px; background: white; cursor: pointer;
                  display: flex; align-items: center; justify-content: center;
                  transition: background 0.2s;
                ">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </button>
                <button class="btn-delete-org-doc" data-doc-id="${doc._id || doc.id}" data-doc-name="${doc.name || ''}" title="Eliminar" style="
                  width: 36px; height: 36px; border: 1px solid #fecaca;
                  border-radius: 8px; background: white; cursor: pointer;
                  display: flex; align-items: center; justify-content: center;
                  transition: background 0.2s;
                ">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Formatea bytes a formato legible
   */
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  /**
   * Muestra el modal de subida de documentos
   */
  showUploadModal(parentOverlay) {
    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal">
        <div class="org-modal-header">
          <h3>Subir Documento</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body">
          <form id="form-upload-org-doc">
            <div class="form-group">
              <label>Archivo *</label>
              <div id="upload-drop-zone" style="
                border: 2px dashed #d1d5db; border-radius: 10px;
                padding: 32px 20px; text-align: center; cursor: pointer;
                transition: border-color 0.2s, background 0.2s;
                background: #f9fafb;
              ">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" style="margin: 0 auto 12px; display: block;">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <p style="margin: 0; color: #6b7280; font-size: 14px;">Arrastra un archivo aqui o <strong style="color: #2563eb;">haz clic para seleccionar</strong></p>
                <p style="margin: 8px 0 0; color: #9ca3af; font-size: 12px;">PDF, Word, Excel, imagenes. Max 10 MB</p>
                <input type="file" id="upload-file-input" style="display: none;" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif" required>
              </div>
              <div id="upload-file-preview" style="display: none; margin-top: 12px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">📎</span>
                  <div style="flex: 1; min-width: 0;">
                    <span id="upload-file-name" style="font-weight: 600; color: #166534; font-size: 13px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
                    <span id="upload-file-size" style="font-size: 12px; color: #4ade80;"></span>
                  </div>
                  <button type="button" id="upload-file-remove" style="
                    background: none; border: none; cursor: pointer;
                    color: #ef4444; font-size: 18px; line-height: 1;
                  ">&times;</button>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label>Nombre del Documento *</label>
              <input type="text" id="upload-doc-name" placeholder="Ej: Acta Asamblea Enero 2026" required>
            </div>
            <div class="form-group">
              <label>Descripcion</label>
              <textarea id="upload-doc-description" rows="3" placeholder="Breve descripcion del contenido del documento..."></textarea>
            </div>
            <div class="form-group">
              <label>Categoria *</label>
              <select id="upload-doc-category" required>
                <option value="">Seleccione una categoria</option>
                <option value="ACTA_ASAMBLEA">Acta de Asamblea</option>
                <option value="BALANCE">Balance Financiero</option>
                <option value="INFORME">Informe</option>
                <option value="CERTIFICADO">Certificado</option>
                <option value="CORRESPONDENCIA">Correspondencia</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
          </form>
        </div>
        <div class="org-modal-footer">
          <button class="btn-cancel" type="button">Cancelar</button>
          <button class="btn-save" type="submit" form="form-upload-org-doc" id="btn-submit-upload">Subir Documento</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // References
    const dropZone = modal.querySelector('#upload-drop-zone');
    const fileInput = modal.querySelector('#upload-file-input');
    const filePreview = modal.querySelector('#upload-file-preview');
    const fileName = modal.querySelector('#upload-file-name');
    const fileSize = modal.querySelector('#upload-file-size');
    const fileRemove = modal.querySelector('#upload-file-remove');
    let selectedFile = null;

    // Click to select file
    dropZone.addEventListener('click', () => fileInput.click());

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#2563eb';
      dropZone.style.background = '#eff6ff';
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = '#d1d5db';
      dropZone.style.background = '#f9fafb';
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#d1d5db';
      dropZone.style.background = '#f9fafb';
      if (e.dataTransfer.files.length > 0) {
        selectedFile = e.dataTransfer.files[0];
        showFilePreview(selectedFile);
      }
    });

    // File input change
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        selectedFile = fileInput.files[0];
        showFilePreview(selectedFile);
      }
    });

    const showFilePreview = (file) => {
      fileName.textContent = file.name;
      fileSize.textContent = this.formatFileSize(file.size);
      dropZone.style.display = 'none';
      filePreview.style.display = 'block';
    };

    // Remove file
    fileRemove.addEventListener('click', () => {
      selectedFile = null;
      fileInput.value = '';
      dropZone.style.display = 'block';
      filePreview.style.display = 'none';
    });

    // Close handlers
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Submit
    modal.querySelector('#form-upload-org-doc').addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!selectedFile) {
        showToast('Debe seleccionar un archivo', 'error');
        return;
      }

      // Max 10 MB
      if (selectedFile.size > 10 * 1024 * 1024) {
        showToast('El archivo no puede superar los 10 MB', 'error');
        return;
      }

      const name = modal.querySelector('#upload-doc-name').value.trim();
      const description = modal.querySelector('#upload-doc-description').value.trim();
      const category = modal.querySelector('#upload-doc-category').value;

      if (!name || !category) {
        showToast('Complete todos los campos obligatorios', 'error');
        return;
      }

      const submitBtn = modal.querySelector('#btn-submit-upload');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Subiendo...';

      await this.uploadDocument(selectedFile, name, description, category, parentOverlay);
      modal.remove();
    });
  }

  /**
   * Sube un documento al servidor
   */
  async uploadDocument(file, name, description, category, parentOverlay) {
    try {
      await orgDocumentService.uploadDocument(this.currentOrg.id, file, name, description, category);
      showToast('Documento subido correctamente', 'success');
      await this.loadOrgDocuments();
      // Refresh the documents list in the DOM
      const listContainer = parentOverlay?.querySelector('#org-documents-list');
      if (listContainer) {
        listContainer.innerHTML = this.renderOrgDocuments();
        this.attachOrgDocumentListeners(parentOverlay);
      }
    } catch (error) {
      console.error('Error al subir documento:', error);
      showToast(error.message || 'Error al subir el documento', 'error');
    }
  }

  /**
   * Elimina un documento subido de la organizacion con confirmacion
   */
  async deleteOrgDocument(docId, parentOverlay) {
    const docName = this.orgDocuments.find(d => (d._id || d.id) === docId)?.name || 'este documento';

    const confirmModal = document.createElement('div');
    confirmModal.className = 'org-modal-overlay';
    confirmModal.innerHTML = `
      <div class="org-modal" style="max-width: 440px;">
        <div class="org-modal-header">
          <h3>Confirmar Eliminacion</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="text-align: center; padding: 24px;">
          <div style="font-size: 48px; margin-bottom: 16px;">🗑️</div>
          <p style="margin: 0; color: #374151; font-size: 15px;">
            ¿Estas seguro de que deseas eliminar <strong>"${docName}"</strong>?
          </p>
          <p style="margin: 8px 0 0; color: #9ca3af; font-size: 13px;">Esta accion no se puede deshacer.</p>
        </div>
        <div class="org-modal-footer" style="justify-content: center; gap: 12px;">
          <button class="btn-cancel" type="button">Cancelar</button>
          <button class="btn-danger" id="btn-confirm-delete-doc" style="
            background: #ef4444; color: white; border: none;
            padding: 10px 24px; border-radius: 8px; font-weight: 500;
            cursor: pointer;
          ">Eliminar</button>
        </div>
      </div>
    `;

    document.body.appendChild(confirmModal);

    confirmModal.querySelector('.modal-close').addEventListener('click', () => confirmModal.remove());
    confirmModal.querySelector('.btn-cancel').addEventListener('click', () => confirmModal.remove());
    confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) confirmModal.remove(); });

    confirmModal.querySelector('#btn-confirm-delete-doc').addEventListener('click', async () => {
      try {
        await orgDocumentService.deleteDocument(this.currentOrg.id, docId);
        showToast('Documento eliminado correctamente', 'success');
        confirmModal.remove();
        await this.loadOrgDocuments();
        // Refresh the documents list in the DOM
        const listContainer = parentOverlay?.querySelector('#org-documents-list');
        if (listContainer) {
          listContainer.innerHTML = this.renderOrgDocuments();
          this.attachOrgDocumentListeners(parentOverlay);
        }
      } catch (error) {
        console.error('Error al eliminar documento:', error);
        showToast(error.message || 'Error al eliminar el documento', 'error');
        confirmModal.remove();
      }
    });
  }

  /**
   * Adjunta listeners para los botones de documentos subidos (download, delete)
   */
  attachOrgDocumentListeners(overlay) {
    // Download buttons
    overlay.querySelectorAll('.btn-download-org-doc').forEach(btn => {
      btn.addEventListener('click', async () => {
        const docId = btn.dataset.docId;
        try {
          await orgDocumentService.downloadDocument(this.currentOrg.id, docId);
        } catch (error) {
          showToast(error.message || 'Error al descargar el documento', 'error');
        }
      });
    });

    // Delete buttons
    overlay.querySelectorAll('.btn-delete-org-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = btn.dataset.docId;
        this.deleteOrgDocument(docId, overlay);
      });
    });
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

  // attachEventListeners removed - modal overlay no longer used

  // attachContentListeners removed - modal overlay no longer used

  /**
   * Refresca el contenido del tab actual (ahora solo para páginas full-page)
   */
  refreshContent(overlayOrDummy) {
    // Check if there's a pending refresh from an InPage modal
    if (this._pendingRefreshContainer) {
      const container = this._pendingRefreshContainer;
      this._pendingRefreshContainer = null;
      this.refreshContentInContainer(container, this.currentTab);
      return;
    }
    // Fallback: find the current org page container
    const currentPage = sessionStorage.getItem('app_current_page');
    if (currentPage && currentPage.startsWith('org-')) {
      const tabName = currentPage.replace('org-', '');
      const container = document.getElementById(`org-${tabName}-content`);
      if (container) {
        this.refreshContentInContainer(container, this.currentTab);
      }
    }
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
   * Modal para nueva asamblea (con agenda dinámica y quórum)
   */
  openNewAssemblyModal(parentOverlay, preselectedType) {
    const agendaTypeOptions = `
      <option value="custom">Tema General</option>
      <option value="eleccion_directorio">Elección de Directorio</option>
      <option value="aprobacion_presupuesto">Aprobación de Presupuesto</option>
      <option value="reforma_estatutos">Reforma de Estatutos</option>
      <option value="memoria_anual">Memoria Anual</option>
      <option value="disolucion">Disolución</option>
    `;

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 650px;">
        <div class="org-modal-header">
          <h3>Nueva Asamblea</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="max-height: 70vh; overflow-y: auto;">
          <form id="form-new-assembly">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
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
                <label>Título *</label>
                <input type="text" id="assembly-title" required placeholder="Ej: Elección de Directorio 2026">
              </div>
            </div>
            <div class="form-group">
              <label>Descripción</label>
              <textarea id="assembly-description" rows="2" placeholder="Descripción breve de la asamblea"></textarea>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom:16px;">
              <div class="form-group" style="margin-bottom:0;">
                <label>Tipo de Quórum</label>
                <select id="assembly-quorum-type">
                  <option value="percentage">Porcentaje de socios</option>
                  <option value="number">Número fijo</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label>Valor de Quórum</label>
                <input type="number" id="assembly-quorum-value" value="50" min="1" max="100">
              </div>
            </div>

            <div style="border-top: 1px solid #e5e7eb; padding-top: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <label style="font-weight: 600; margin-bottom:0;">Puntos de Agenda</label>
                <button type="button" id="btn-add-agenda-item" style="padding: 4px 12px; font-size: 12px; border: 1px solid #2563eb; border-radius: 6px; background: #eff6ff; color: #2563eb; cursor: pointer; font-weight:600;">+ Agregar Punto</button>
              </div>
              <div id="agenda-items-container">
                <!-- Agenda items added dynamically -->
              </div>
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

    let agendaCounter = 0;
    const agendaContainer = modal.querySelector('#agenda-items-container');

    const addAgendaItem = (preType) => {
      agendaCounter++;
      const row = document.createElement('div');
      row.className = 'agenda-item-row';
      row.style.cssText = 'display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:start;margin-bottom:10px;padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;';
      row.dataset.index = agendaCounter;
      row.innerHTML = `
        <div>
          <input type="text" placeholder="Título del punto" class="agenda-title" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;margin-bottom:6px;" required>
          <select class="agenda-type" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;">
            ${agendaTypeOptions}
          </select>
          <div class="voting-mode-container" style="display:none;margin-top:6px;">
            <select class="agenda-voting-mode" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;">
              <option value="per_cargo">Votación por cargo individual</option>
              <option value="per_lista">Votación por lista completa</option>
            </select>
          </div>
        </div>
        <button type="button" class="btn-remove-agenda" style="padding:6px 10px;border:1px solid #fecaca;border-radius:6px;background:white;color:#ef4444;cursor:pointer;font-size:16px;line-height:1;">&times;</button>
      `;
      agendaContainer.appendChild(row);

      const typeSelect = row.querySelector('.agenda-type');
      const votingContainer = row.querySelector('.voting-mode-container');
      if (preType) {
        typeSelect.value = preType;
        if (preType === 'eleccion_directorio') votingContainer.style.display = 'block';
      }
      typeSelect.addEventListener('change', () => {
        votingContainer.style.display = typeSelect.value === 'eleccion_directorio' ? 'block' : 'none';
      });

      row.querySelector('.btn-remove-agenda').addEventListener('click', () => row.remove());
    };

    modal.querySelector('#btn-add-agenda-item').addEventListener('click', () => addAgendaItem());

    // Pre-add election agenda item if coming from directorio
    if (preselectedType === 'eleccion_directorio') {
      addAgendaItem('eleccion_directorio');
      modal.querySelector('#assembly-type').value = 'extraordinaria';
      modal.querySelector('#assembly-title').value = 'Elección de Directorio';
    }

    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());

    modal.querySelector('#form-new-assembly').addEventListener('submit', async (e) => {
      e.preventDefault();

      // Collect agenda items
      const agendaItems = [];
      agendaContainer.querySelectorAll('.agenda-item-row').forEach(row => {
        const title = row.querySelector('.agenda-title').value.trim();
        const type = row.querySelector('.agenda-type').value;
        const votingMode = type === 'eleccion_directorio' ? row.querySelector('.agenda-voting-mode').value : null;
        if (title) agendaItems.push({ title, type, votingMode });
      });

      const assemblyData = {
        type: modal.querySelector('#assembly-type').value,
        date: modal.querySelector('#assembly-date').value,
        time: modal.querySelector('#assembly-time').value,
        title: modal.querySelector('#assembly-title').value.trim(),
        description: modal.querySelector('#assembly-description').value.trim(),
        quorumType: modal.querySelector('#assembly-quorum-type').value,
        quorumValue: parseInt(modal.querySelector('#assembly-quorum-value').value) || 50,
        agendaItems
      };

      try {
        const orgId = this.currentOrg._id || this.currentOrg.id;
        const result = await apiService.createAssembly(orgId, assemblyData);
        if (!this.currentOrg.assemblies) this.currentOrg.assemblies = [];
        this.currentOrg.assemblies.push(result);
        showToast('Asamblea creada correctamente', 'success');
        modal.remove();
        this.refreshContent(parentOverlay);
      } catch (err) {
        showToast(err.message || 'Error al crear asamblea', 'error');
      }
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
        this.openDefinitiveDirectorioModal(parentOverlay);
        break;

      case ALERT_TYPES.REGISTRO_SOCIOS:
        this.openRegistroSociosModal(parentOverlay);
        break;

      case ALERT_TYPES.COMISION_REVISORA:
        this.openComisionRevisoraModal(parentOverlay);
        break;

      case ALERT_TYPES.TRICEL_DESIGNATION:
        this.openTricelDesignationModal(parentOverlay);
        break;

      case ALERT_TYPES.DIRECTORIO_RENEWAL:
        this.currentTab = 'elecciones';
        this.refreshContent(parentOverlay);
        setTimeout(() => this.openNewElectionModal(parentOverlay), 100);
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
    modal.querySelector('#form-dissolution').addEventListener('submit', async (e) => {
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

      try {
        await organizationsService.dissolveOrganization(
          this.currentOrg.id,
          reason,
          details || 'Solicitud de disolución por parte del usuario'
        );

        showToast('Solicitud de disolución enviada correctamente. La organización ha sido disuelta.', 'success');
        modal.remove();
        parentOverlay.remove();

        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err) {
        console.error('Error dissolving:', err);
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
        <div class="modal-header" style="padding: 24px; background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); color: white; border-bottom: none;">
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
                      accent-color: #2563eb;
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

        // Refrescar dashboard (usando método full-page)
        this.refreshContent();
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

  // ============ MODALES FALTANTES ============

  /**
   * Modal para editar directorio
   */
  openEditDirectorioModal(parentOverlay) {
    const org = this.currentOrg;
    const members = org.members || [];
    const commission = org.commission?.members || [];
    const roles = ['Presidente', 'Secretario', 'Tesorero'];

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 600px;">
        <div class="org-modal-header">
          <h3>Editar Directorio</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px;">
          <p style="color: #6b7280; margin-bottom: 20px; font-size: 14px;">Seleccione los miembros para cada cargo del directorio. Solo se pueden asignar socios registrados.</p>
          ${roles.map((role, i) => {
            const current = commission[i];
            return `
              <div class="form-group" style="margin-bottom: 16px;">
                <label style="font-weight: 600; color: #1e293b; margin-bottom: 6px; display: block;">${role}</label>
                <select id="directorio-${role.toLowerCase()}" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;">
                  <option value="">-- Seleccionar socio --</option>
                  ${members.map(m => {
                    const name = `${m.firstName || m.primerNombre || ''} ${m.lastName || m.apellidoPaterno || ''}`.trim();
                    const selected = current && (current.rut === m.rut) ? 'selected' : '';
                    return `<option value="${m.rut}" ${selected}>${name} (${m.rut || 'Sin RUT'})</option>`;
                  }).join('')}
                </select>
              </div>
            `;
          }).join('')}
          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button class="btn-cancel" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer;">Cancelar</button>
            <button class="btn-save-directorio" style="padding: 10px 20px; border: none; border-radius: 8px; background: #3b82f6; color: white; cursor: pointer; font-weight: 600;">Guardar Cambios</button>
          </div>
        </div>
      </div>
    `;

    parentOverlay.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('.btn-save-directorio').addEventListener('click', async () => {
      const newCommission = roles.map(role => {
        const rut = modal.querySelector(`#directorio-${role.toLowerCase()}`).value;
        if (!rut) return null;
        const member = members.find(m => m.rut === rut);
        return member ? { firstName: member.firstName || member.primerNombre, lastName: member.lastName || member.apellidoPaterno, rut: member.rut, role: role.toLowerCase() } : null;
      }).filter(Boolean);

      if (newCommission.length < 3) {
        showToast('Debe asignar al menos Presidente, Secretario y Tesorero', 'error');
        return;
      }

      try {
        await organizationsService.update(org.id || org._id, {
          commission: { members: newCommission, electionDate: org.commission?.electionDate || new Date().toISOString() }
        });
        this.currentOrg.commission = { members: newCommission, electionDate: org.commission?.electionDate || new Date().toISOString() };
        showToast('Directorio actualizado correctamente', 'success');
        modal.remove();
        this.refreshContent(parentOverlay);
      } catch (err) {
        showToast('Error al actualizar directorio', 'error');
      }
    });
  }

  /**
   * Modal para convocar elección
   */
  openNewElectionModal(parentOverlay) {
    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 550px;">
        <div class="org-modal-header">
          <h3>Convocar Eleccion de Directorio</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px;">
          <p style="color: #6b7280; margin-bottom: 20px; font-size: 14px;">Complete los datos para convocar una nueva eleccion de directorio segun la Ley 19.418.</p>
          <form id="form-new-election">
            <div class="form-group" style="margin-bottom: 16px;">
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Tipo de Eleccion *</label>
              <select id="election-type" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;" required>
                <option value="total">Renovacion Total del Directorio</option>
                <option value="parcial">Renovacion Parcial</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 16px;">
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Fecha de Eleccion *</label>
              <input type="date" id="election-date" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;" required min="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group" style="margin-bottom: 16px;">
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Hora</label>
              <input type="time" id="election-time" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;" value="10:00">
            </div>
            <div class="form-group" style="margin-bottom: 16px;">
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Lugar</label>
              <input type="text" id="election-location" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;" placeholder="Ej: Sede social de la organizacion">
            </div>
            <div class="form-group" style="margin-bottom: 16px;">
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Observaciones</label>
              <textarea id="election-notes" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; min-height: 80px;" placeholder="Notas adicionales..."></textarea>
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
              <button type="button" class="btn-cancel" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer;">Cancelar</button>
              <button type="submit" style="padding: 10px 20px; border: none; border-radius: 8px; background: #3b82f6; color: white; cursor: pointer; font-weight: 600;">Convocar Eleccion</button>
            </div>
          </form>
        </div>
      </div>
    `;

    parentOverlay.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#form-new-election').addEventListener('submit', async (e) => {
      e.preventDefault();
      const org = this.currentOrg;
      const elections = org.elections || [];
      const newElection = {
        id: Date.now().toString(),
        type: modal.querySelector('#election-type').value,
        date: modal.querySelector('#election-date').value,
        time: modal.querySelector('#election-time').value,
        location: modal.querySelector('#election-location').value,
        notes: modal.querySelector('#election-notes').value,
        status: 'convocada',
        participation: 0,
        result: 'Pendiente'
      };
      elections.push(newElection);
      try {
        await organizationsService.update(org.id || org._id, { elections });
        this.currentOrg.elections = elections;
        showToast('Eleccion convocada exitosamente', 'success');
        modal.remove();
        this.refreshContent(parentOverlay);
      } catch (err) {
        showToast('Error al convocar eleccion', 'error');
      }
    });
  }

  /**
   * Modal para crear nueva comunicacion
   */
  openNewCommunicationModal(parentOverlay) {
    const org = this.currentOrg;
    const members = org.members || [];
    const membersWithEmail = members.filter(m => m.email);

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 600px;">
        <div class="org-modal-header">
          <h3>Nueva Comunicacion</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px;">
          <p style="color: #6b7280; margin-bottom: 16px; font-size: 14px;">Enviar comunicacion a ${membersWithEmail.length} socios con email registrado.</p>
          <form id="form-new-communication">
            <div class="form-group" style="margin-bottom: 16px;">
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Asunto *</label>
              <input type="text" id="comm-subject" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;" placeholder="Asunto de la comunicacion" required>
            </div>
            <div class="form-group" style="margin-bottom: 16px;">
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Tipo</label>
              <select id="comm-type" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;">
                <option value="general">General</option>
                <option value="asamblea">Citacion a Asamblea</option>
                <option value="actividad">Invitacion a Actividad</option>
                <option value="informe">Informe de Gestion</option>
                <option value="urgente">Aviso Urgente</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 16px;">
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Mensaje *</label>
              <textarea id="comm-message" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; min-height: 120px;" placeholder="Escriba el mensaje..." required></textarea>
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
              <button type="button" class="btn-cancel" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer;">Cancelar</button>
              <button type="submit" style="padding: 10px 20px; border: none; border-radius: 8px; background: #3b82f6; color: white; cursor: pointer; font-weight: 600;">Enviar Comunicacion</button>
            </div>
          </form>
        </div>
      </div>
    `;

    parentOverlay.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#form-new-communication').addEventListener('submit', async (e) => {
      e.preventDefault();
      const communications = org.communications || [];
      const newComm = {
        id: Date.now().toString(),
        subject: modal.querySelector('#comm-subject').value,
        type: modal.querySelector('#comm-type').value,
        message: modal.querySelector('#comm-message').value,
        date: new Date().toISOString(),
        recipients: membersWithEmail.length,
        status: 'sent'
      };
      communications.push(newComm);
      try {
        await organizationsService.update(org.id || org._id, { communications });
        this.currentOrg.communications = communications;
        showToast(`Comunicacion enviada a ${membersWithEmail.length} socios`, 'success');
        modal.remove();
        this.refreshContent(parentOverlay);
      } catch (err) {
        showToast('Error al enviar comunicacion', 'error');
      }
    });
  }

  /**
   * Modal para editar un miembro existente
   */
  openEditMemberModal(memberRut, parentOverlay) {
    const org = this.currentOrg;
    const members = org.members || [];
    const member = members.find(m => m.rut === memberRut);
    if (!member) { showToast('Miembro no encontrado', 'error'); return; }

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 500px;">
        <div class="org-modal-header">
          <h3>Editar Socio</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px;">
          <form id="form-edit-member">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label style="font-weight: 600; display: block; margin-bottom: 6px;">Nombre *</label>
                <input type="text" id="edit-firstName" value="${member.firstName || member.primerNombre || ''}" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;" required>
              </div>
              <div class="form-group">
                <label style="font-weight: 600; display: block; margin-bottom: 6px;">Apellido *</label>
                <input type="text" id="edit-lastName" value="${member.lastName || member.apellidoPaterno || ''}" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;" required>
              </div>
            </div>
            <div class="form-group" style="margin-top: 12px;">
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">RUT</label>
              <input type="text" value="${member.rut || ''}" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; background: #f1f5f9;" disabled>
            </div>
            <div class="form-group" style="margin-top: 12px;">
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Email</label>
              <input type="email" id="edit-email" value="${member.email || ''}" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;">
            </div>
            <div class="form-group" style="margin-top: 12px;">
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Telefono</label>
              <input type="tel" id="edit-phone" value="${member.phone || ''}" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;">
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
              <button type="button" class="btn-cancel" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer;">Cancelar</button>
              <button type="submit" style="padding: 10px 20px; border: none; border-radius: 8px; background: #3b82f6; color: white; cursor: pointer; font-weight: 600;">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    parentOverlay.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#form-edit-member').addEventListener('submit', async (e) => {
      e.preventDefault();
      const idx = members.findIndex(m => m.rut === memberRut);
      if (idx === -1) return;
      members[idx] = {
        ...members[idx],
        firstName: modal.querySelector('#edit-firstName').value,
        lastName: modal.querySelector('#edit-lastName').value,
        email: modal.querySelector('#edit-email').value,
        phone: modal.querySelector('#edit-phone').value
      };
      try {
        await organizationsService.update(org.id || org._id, { members });
        this.currentOrg.members = members;
        showToast('Socio actualizado correctamente', 'success');
        modal.remove();
        this.refreshContent(parentOverlay);
      } catch (err) {
        showToast('Error al actualizar socio', 'error');
      }
    });
  }

  /**
   * Eliminar un miembro
   */
  async deleteMember(memberRut, parentOverlay) {
    const org = this.currentOrg;
    const members = org.members || [];
    const member = members.find(m => m.rut === memberRut);
    if (!member) return;

    const name = `${member.firstName || ''} ${member.lastName || ''}`.trim();
    if (!confirm(`¿Está seguro de eliminar al socio ${name}? Esta acción no se puede deshacer.`)) return;

    const updatedMembers = members.filter(m => m.rut !== memberRut);
    try {
      await organizationsService.update(org.id || org._id, { members: updatedMembers });
      this.currentOrg.members = updatedMembers;
      showToast(`Socio ${name} eliminado`, 'success');
      this.refreshContent(parentOverlay);
    } catch (err) {
      showToast('Error al eliminar socio', 'error');
    }
  }

  /**
   * Ver resumen de validación del Ministro de Fe
   */
  showValidationSummary(parentOverlay) {
    const org = this.currentOrg;
    const vd = org.validationData || {};
    const pd = org.provisionalDirectorio || {};
    const ec = org.electoralCommission || [];
    const attendees = org.validatedAttendees || [];
    const ministroSig = vd.ministroSignature || org.ministroSignature;

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
        <div class="org-modal-header" style="background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); color: white;">
          <h3>Resumen de Validacion - Asamblea Constitutiva</h3>
          <button class="modal-close" style="color: white;">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px;">
          ${vd.validatedAt ? `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">✅</span>
                <div>
                  <strong style="color: #166534;">Validacion Completada</strong>
                  <p style="margin: 4px 0 0; color: #15803d; font-size: 13px;">Validado el ${new Date(vd.validatedAt).toLocaleDateString('es-CL')} por ${vd.validatorName || 'Ministro de Fe'}</p>
                </div>
              </div>
            </div>
          ` : '<div style="background: #fffbeb; padding: 16px; border-radius: 12px; margin-bottom: 20px;"><strong style="color: #92400e;">Pendiente de validacion</strong></div>'}

          <h4 style="margin: 20px 0 12px; color: #1e293b;">Directorio Provisorio</h4>
          <div style="display: grid; gap: 8px;">
            ${pd.president ? `<div style="display: flex; justify-content: space-between; padding: 12px; background: #f8fafc; border-radius: 8px;"><span style="font-weight: 600;">Presidente</span><span>${pd.president.firstName || ''} ${pd.president.lastName || ''} (${pd.president.rut || '-'})</span></div>` : ''}
            ${pd.secretary ? `<div style="display: flex; justify-content: space-between; padding: 12px; background: #f8fafc; border-radius: 8px;"><span style="font-weight: 600;">Secretario</span><span>${pd.secretary.firstName || ''} ${pd.secretary.lastName || ''} (${pd.secretary.rut || '-'})</span></div>` : ''}
            ${pd.treasurer ? `<div style="display: flex; justify-content: space-between; padding: 12px; background: #f8fafc; border-radius: 8px;"><span style="font-weight: 600;">Tesorero</span><span>${pd.treasurer.firstName || ''} ${pd.treasurer.lastName || ''} (${pd.treasurer.rut || '-'})</span></div>` : ''}
          </div>

          <h4 style="margin: 20px 0 12px; color: #1e293b;">Comision Electoral (${ec.length} miembros)</h4>
          <div style="display: grid; gap: 8px;">
            ${ec.length > 0 ? ec.map((m, i) => `
              <div style="display: flex; justify-content: space-between; padding: 12px; background: #f8fafc; border-radius: 8px;">
                <span>Miembro ${i + 1}</span>
                <span>${m.firstName || ''} ${m.lastName || ''} (${m.rut || '-'})</span>
              </div>
            `).join('') : '<p style="color: #6b7280; font-size: 14px;">Sin datos de comision electoral</p>'}
          </div>

          <h4 style="margin: 20px 0 12px; color: #1e293b;">Asistentes Validados</h4>
          <p style="color: #6b7280; font-size: 14px;">${attendees.length > 0 ? `${attendees.length} asistentes registrados en la asamblea constitutiva` : 'Sin registro de asistentes'}</p>

          ${ministroSig ? `
            <h4 style="margin: 20px 0 12px; color: #1e293b;">Firma del Ministro de Fe</h4>
            <div style="text-align: center; padding: 16px; background: #f8fafc; border-radius: 12px;">
              <img src="${ministroSig}" alt="Firma Ministro" style="max-width: 300px; max-height: 150px;">
            </div>
          ` : ''}

          <div style="text-align: right; margin-top: 24px;">
            <button class="btn-close-summary" style="padding: 10px 24px; border: none; border-radius: 8px; background: #3b82f6; color: white; cursor: pointer; font-weight: 600;">Cerrar</button>
          </div>
        </div>
      </div>
    `;

    parentOverlay.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-close-summary').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  // ============ DETALLE Y EDICIÓN ============

  /**
   * Modal detalle de asamblea con edición de asistencia
   */
  showAssemblyDetail(assemblyId, parentOverlay) {
    const assembly = (this.currentOrg.assemblies || []).find(a => a.id === assemblyId);
    if (!assembly) return;

    const orgId = this.currentOrg._id || this.currentOrg.id;
    const statusConfig = {
      draft: { label: 'Borrador', color: '#6b7280', bg: '#f3f4f6' },
      convocada: { label: 'Convocada', color: '#2563eb', bg: '#eff6ff' },
      en_curso: { label: 'En Curso', color: '#059669', bg: '#ecfdf5' },
      finalizada: { label: 'Finalizada', color: '#7c3aed', bg: '#f5f3ff' },
      cancelada: { label: 'Cancelada', color: '#ef4444', bg: '#fef2f2' }
    };
    const st = statusConfig[assembly.status] || statusConfig.draft;
    const members = this.currentOrg.members || [];
    const totalMembers = members.length;
    const quorumRequired = assembly.quorumType === 'percentage'
      ? Math.ceil(totalMembers * (assembly.quorumValue || 50) / 100)
      : (assembly.quorumValue || 0);
    const attendeeCount = (assembly.attendees || []).length;
    const quorumMet = attendeeCount >= quorumRequired;

    const agendaTypeLabels = {
      eleccion_directorio: 'Elección de Directorio',
      aprobacion_presupuesto: 'Aprobación de Presupuesto',
      reforma_estatutos: 'Reforma de Estatutos',
      memoria_anual: 'Memoria Anual',
      disolucion: 'Disolución',
      custom: 'Tema General'
    };

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 700px; max-height: 90vh;">
        <div class="org-modal-header">
          <h3>${assembly.title || 'Detalle de Asamblea'}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px; overflow-y: auto; max-height: 70vh;">
          <!-- Info general -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
            <div style="padding: 12px; background: #f8fafc; border-radius: 8px;">
              <span style="font-weight: 600; font-size:12px; color:#6b7280;">Estado</span>
              <div style="margin-top:4px;"><span class="assembly-status-badge" style="background:${st.bg};color:${st.color};padding:4px 12px;border-radius:10px;font-size:13px;font-weight:600;">${st.label}</span></div>
            </div>
            <div style="padding: 12px; background: #f8fafc; border-radius: 8px;">
              <span style="font-weight: 600; font-size:12px; color:#6b7280;">Tipo</span>
              <div style="margin-top:4px;">${assembly.type === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'}</div>
            </div>
            <div style="padding: 12px; background: #f8fafc; border-radius: 8px;">
              <span style="font-weight: 600; font-size:12px; color:#6b7280;">Fecha</span>
              <div style="margin-top:4px;">${assembly.date ? new Date(assembly.date).toLocaleDateString('es-CL') : '-'} ${assembly.time || ''}</div>
            </div>
            <div style="padding: 12px; border-radius: 8px; background: ${quorumMet ? '#ecfdf5' : '#fef2f2'};">
              <span style="font-weight: 600; font-size:12px; color:#6b7280;">Quórum</span>
              <div class="quorum-indicator" style="margin-top:4px;">
                <span style="font-weight:600;color:${quorumMet ? '#059669' : '#ef4444'};">${attendeeCount} / ${quorumRequired}</span>
                <span style="font-size:11px;color:#6b7280;"> (${assembly.quorumValue || 50}${assembly.quorumType === 'percentage' ? '%' : ' pers.'})</span>
              </div>
            </div>
          </div>

          ${assembly.description ? `<div style="padding:12px;background:#f8fafc;border-radius:8px;margin-bottom:16px;"><span style="font-weight:600;display:block;margin-bottom:4px;">Descripción</span><p style="margin:0;color:#4b5563;">${assembly.description}</p></div>` : ''}

          <!-- Agenda Items -->
          <h4 style="margin:16px 0 8px;">Puntos de Agenda</h4>
          ${(assembly.agendaItems || []).length > 0 ? assembly.agendaItems.map((item, idx) => {
            const typeLabel = agendaTypeLabels[item.type] || item.type;
            const isElection = item.type === 'eleccion_directorio';
            const candidateCount = (item.candidates || []).length;
            const voteCount = (item.votes || []).length;
            return `
            <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:10px;${item.votingOpen ? 'border-color:#059669;background:#f0fdf4;' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <strong>${idx + 1}. ${item.title}</strong>
                  <span style="font-size:11px;color:#6b7280;margin-left:8px;">${typeLabel}</span>
                  ${item.votingMode ? `<span style="font-size:11px;color:#2563eb;margin-left:6px;">(${item.votingMode === 'per_cargo' ? 'Por cargo' : 'Por lista'})</span>` : ''}
                </div>
                <div style="display:flex;gap:6px;">
                  ${isElection && assembly.status !== 'finalizada' && assembly.status !== 'cancelada' ? `<button class="btn-manage-candidates" data-agenda-id="${item.id}" style="padding:4px 10px;font-size:11px;border:1px solid #2563eb;border-radius:6px;background:#eff6ff;color:#2563eb;cursor:pointer;">Candidatos (${candidateCount})</button>` : ''}
                  ${assembly.status === 'en_curso' ? `<button class="btn-toggle-voting" data-agenda-id="${item.id}" style="padding:4px 10px;font-size:11px;border:1px solid ${item.votingOpen ? '#ef4444' : '#059669'};border-radius:6px;background:${item.votingOpen ? '#fef2f2' : '#ecfdf5'};color:${item.votingOpen ? '#ef4444' : '#059669'};cursor:pointer;font-weight:600;">${item.votingOpen ? 'Cerrar Votación' : 'Abrir Votación'}</button>` : ''}
                </div>
              </div>
              ${isElection ? `<div style="font-size:12px;color:#6b7280;margin-top:6px;">${candidateCount} candidatos | ${voteCount} votos registrados</div>` : ''}
              ${item.result ? `<div style="margin-top:8px;padding:8px 12px;background:#f5f3ff;border-radius:6px;font-size:12px;color:#7c3aed;">
                <strong>Resultado:</strong> ${item.result.mode === 'per_lista' ? `Lista ganadora: ${item.result.winningLista || '-'} con ${item.result.votesByLista?.[item.result.winningLista] || 0} votos` : Object.entries(item.result.winners || {}).map(([cargo, w]) => `${cargo}: ${w.firstName} ${w.lastName} (${w.votes} votos)`).join(' | ')}
              </div>` : ''}
            </div>`;
          }).join('') : '<p style="color:#6b7280;font-size:13px;">No hay puntos de agenda definidos.</p>'}

          <!-- Attendees -->
          <h4 style="margin:16px 0 8px;">Asistencia (${attendeeCount})</h4>
          ${attendeeCount > 0 ? `
            <div style="max-height:150px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;">
              ${(assembly.attendees || []).map(a => `
                <div style="display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">
                  <span>${a.firstName} ${a.lastName}</span>
                  <span style="color:#6b7280;">${a.rut || ''}</span>
                </div>
              `).join('')}
            </div>
          ` : '<p style="color:#6b7280;font-size:13px;">Sin asistentes registrados.</p>'}

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button class="btn-cancel" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer;">Cerrar</button>
          </div>
        </div>
      </div>
    `;

    const appendTarget = parentOverlay || document.body;
    appendTarget.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Toggle voting buttons
    modal.querySelectorAll('.btn-toggle-voting').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await apiService.toggleVoting(orgId, assemblyId, btn.dataset.agendaId);
          // Refresh org data and re-open detail
          const updatedOrg = await apiService.getOrganization(orgId);
          Object.assign(this.currentOrg, updatedOrg);
          modal.remove();
          this.showAssemblyDetail(assemblyId, parentOverlay);
          showToast('Estado de votación actualizado', 'success');
        } catch (err) {
          showToast(err.message || 'Error', 'error');
        }
      });
    });

    // Manage candidates buttons
    modal.querySelectorAll('.btn-manage-candidates').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.remove();
        this.showCandidatesManager(assemblyId, btn.dataset.agendaId, parentOverlay);
      });
    });
  }

  /**
   * Modal para gestionar candidatos de un punto de elección
   */
  showCandidatesManager(assemblyId, agendaItemId, parentOverlay) {
    const assembly = (this.currentOrg.assemblies || []).find(a => a.id === assemblyId);
    if (!assembly) return;
    const agendaItem = (assembly.agendaItems || []).find(i => i.id === agendaItemId);
    if (!agendaItem) return;

    const orgId = this.currentOrg._id || this.currentOrg.id;
    const members = this.currentOrg.members || [];
    const currentCandidates = agendaItem.candidates || [];
    const votingMode = agendaItem.votingMode || 'per_cargo';
    const cargos = ['presidente', 'secretario', 'tesorero', 'director'];

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 600px;">
        <div class="org-modal-header">
          <h3>Gestionar Candidatos</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px; max-height:65vh; overflow-y:auto;">
          <p style="color:#6b7280;font-size:13px;margin-bottom:16px;">Modo: <strong>${votingMode === 'per_cargo' ? 'Por cargo individual' : 'Por lista completa'}</strong></p>

          <div id="candidates-list">
            ${currentCandidates.map((c, i) => `
              <div class="candidate-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;padding:8px;background:#f9fafb;border-radius:8px;">
                <span style="flex:1;">${c.firstName} ${c.lastName} (${c.rut})</span>
                ${votingMode === 'per_cargo' ? `<span style="font-size:12px;color:#2563eb;">${c.cargo || '-'}</span>` : `<span style="font-size:12px;color:#2563eb;">${c.lista || '-'}</span>`}
              </div>
            `).join('')}
          </div>

          <h4 style="margin:16px 0 8px;">Agregar Candidato</h4>
          <div style="display:grid;gap:8px;">
            <select id="candidate-member" style="padding:10px;border:1px solid #d1d5db;border-radius:8px;">
              <option value="">Seleccionar socio...</option>
              ${members.map(m => `<option value="${m.rut}">${m.firstName} ${m.lastName} (${m.rut})</option>`).join('')}
            </select>
            ${votingMode === 'per_cargo' ? `
              <select id="candidate-cargo" style="padding:10px;border:1px solid #d1d5db;border-radius:8px;">
                ${cargos.map(c => `<option value="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
              </select>
            ` : `
              <input type="text" id="candidate-lista" placeholder="Nombre de la lista" style="padding:10px;border:1px solid #d1d5db;border-radius:8px;">
            `}
            <button id="btn-add-candidate" style="padding:10px 20px;border:none;border-radius:8px;background:#2563eb;color:white;cursor:pointer;font-weight:600;">Agregar</button>
          </div>

          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:24px;">
            <button class="btn-cancel" style="padding:10px 20px;border:1px solid #d1d5db;border-radius:8px;background:white;cursor:pointer;">Cerrar</button>
            <button id="btn-save-candidates" style="padding:10px 20px;border:none;border-radius:8px;background:#059669;color:white;cursor:pointer;font-weight:600;">Guardar Candidatos</button>
          </div>
        </div>
      </div>
    `;

    const appendTarget = parentOverlay || document.body;
    appendTarget.appendChild(modal);

    let candidates = [...currentCandidates];

    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());

    modal.querySelector('#btn-add-candidate').addEventListener('click', () => {
      const rut = modal.querySelector('#candidate-member').value;
      if (!rut) return showToast('Selecciona un socio', 'error');
      const member = members.find(m => m.rut === rut);
      if (!member) return;

      const newCandidate = {
        rut: member.rut,
        firstName: member.firstName,
        lastName: member.lastName,
        cargo: votingMode === 'per_cargo' ? modal.querySelector('#candidate-cargo')?.value : null,
        lista: votingMode === 'per_lista' ? modal.querySelector('#candidate-lista')?.value : null
      };
      candidates.push(newCandidate);

      // Update list display
      const listEl = modal.querySelector('#candidates-list');
      listEl.innerHTML += `
        <div class="candidate-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;padding:8px;background:#f9fafb;border-radius:8px;">
          <span style="flex:1;">${newCandidate.firstName} ${newCandidate.lastName} (${newCandidate.rut})</span>
          <span style="font-size:12px;color:#2563eb;">${newCandidate.cargo || newCandidate.lista || '-'}</span>
        </div>
      `;
      showToast('Candidato agregado', 'success');
    });

    modal.querySelector('#btn-save-candidates').addEventListener('click', async () => {
      try {
        await apiService.addCandidates(orgId, assemblyId, agendaItemId, candidates);
        // Update local data
        agendaItem.candidates = candidates;
        showToast('Candidatos guardados', 'success');
        modal.remove();
        this.showAssemblyDetail(assemblyId, parentOverlay);
      } catch (err) {
        showToast(err.message || 'Error al guardar', 'error');
      }
    });
  }

  /**
   * Modal detalle de proyecto con edición de progreso y estado
   */
  showProjectDetail(projectId, parentOverlay) {
    const project = (this.currentOrg.projects || []).find(p => p.id === projectId);
    if (!project) return;

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 600px;">
        <div class="org-modal-header">
          <h3>${project.title}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px;">
          <div style="display: grid; gap: 12px;">
            <div style="display: flex; justify-content: space-between; padding: 12px; background: #f8fafc; border-radius: 8px;">
              <span style="font-weight: 600;">Categoría</span>
              <span>${project.category || 'General'}</span>
            </div>
            <div style="padding: 12px; background: #f8fafc; border-radius: 8px;">
              <span style="font-weight: 600; display: block; margin-bottom: 4px;">Descripción</span>
              <p style="margin: 0; color: #4b5563;">${project.description || 'Sin descripción'}</p>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px; background: #f8fafc; border-radius: 8px;">
              <span style="font-weight: 600;">Presupuesto</span>
              <span>$${(project.budget || 0).toLocaleString('es-CL')}</span>
            </div>
          </div>
          <div style="margin-top: 20px; display: grid; gap: 16px;">
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Estado</label>
              <select id="edit-project-status" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;">
                <option value="planning" ${project.status === 'planning' ? 'selected' : ''}>En Planificación</option>
                <option value="in_progress" ${project.status === 'in_progress' ? 'selected' : ''}>En Ejecución</option>
                <option value="paused" ${project.status === 'paused' ? 'selected' : ''}>Pausado</option>
                <option value="completed" ${project.status === 'completed' ? 'selected' : ''}>Completado</option>
              </select>
            </div>
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Progreso: <span id="progress-value">${project.progress || 0}</span>%</label>
              <input type="range" id="edit-project-progress" min="0" max="100" value="${project.progress || 0}" style="width: 100%;">
            </div>
          </div>
          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button class="btn-cancel" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer;">Cerrar</button>
            <button class="btn-save-project" style="padding: 10px 20px; border: none; border-radius: 8px; background: #3b82f6; color: white; cursor: pointer; font-weight: 600;">Guardar Cambios</button>
          </div>
        </div>
      </div>
    `;

    parentOverlay.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    const rangeInput = modal.querySelector('#edit-project-progress');
    const progressLabel = modal.querySelector('#progress-value');
    rangeInput.addEventListener('input', () => { progressLabel.textContent = rangeInput.value; });

    modal.querySelector('.btn-save-project').addEventListener('click', async () => {
      const idx = this.currentOrg.projects.findIndex(p => p.id === projectId);
      if (idx !== -1) {
        this.currentOrg.projects[idx].status = modal.querySelector('#edit-project-status').value;
        this.currentOrg.projects[idx].progress = parseInt(rangeInput.value);
        try {
          await organizationsService.update(this.currentOrg.id, { projects: this.currentOrg.projects });
          showToast('Proyecto actualizado', 'success');
          modal.remove();
          this.refreshContent(parentOverlay);
        } catch (err) {
          showToast('Error al guardar', 'error');
        }
      }
    });
  }

  /**
   * Modal detalle de comunicación
   */
  showCommunicationDetail(commId, parentOverlay) {
    const comm = (this.currentOrg.communications || []).find(c => c.id === commId);
    if (!comm) return;

    const typeLabels = { general: 'General', asamblea: 'Citación a Asamblea', actividad: 'Invitación a Actividad', informe: 'Informe de Gestión', urgente: 'Aviso Urgente' };

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 600px;">
        <div class="org-modal-header">
          <h3>${comm.subject}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px;">
          <div style="display: flex; gap: 16px; margin-bottom: 16px; font-size: 13px; color: #6b7280;">
            <span>${new Date(comm.date).toLocaleDateString('es-CL')}</span>
            <span>${typeLabels[comm.type] || comm.type}</span>
            <span>${comm.recipients || 0} destinatarios</span>
            <span style="color: ${comm.status === 'sent' ? '#10b981' : '#f59e0b'};">${comm.status === 'sent' ? 'Enviado' : 'Borrador'}</span>
          </div>
          <div style="padding: 16px; background: #f8fafc; border-radius: 8px; white-space: pre-wrap; color: #1f2937; line-height: 1.6;">
${comm.message || 'Sin contenido'}
          </div>
          <div style="text-align: right; margin-top: 20px;">
            <button class="btn-cancel" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer;">Cerrar</button>
          </div>
        </div>
      </div>
    `;

    parentOverlay.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  /**
   * Modal detalle de actividad con edición
   */
  showActivityDetail(activityId, parentOverlay) {
    const act = (this.currentOrg.activities || []).find(a => a.id === activityId);
    if (!act) return;

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 550px;">
        <div class="org-modal-header">
          <h3>Editar Actividad</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px;">
          <form id="form-edit-activity">
            <div class="form-group" style="margin-bottom: 12px;">
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Nombre *</label>
              <input type="text" id="edit-act-title" value="${act.title || ''}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;" required>
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Categoría</label>
              <select id="edit-act-category" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;">
                <option value="deportiva" ${act.category === 'deportiva' ? 'selected' : ''}>Deportiva</option>
                <option value="cultural" ${act.category === 'cultural' ? 'selected' : ''}>Cultural</option>
                <option value="educativa" ${act.category === 'educativa' ? 'selected' : ''}>Educativa</option>
                <option value="recreativa" ${act.category === 'recreativa' ? 'selected' : ''}>Recreativa</option>
                <option value="medioambiental" ${act.category === 'medioambiental' ? 'selected' : ''}>Medioambiental</option>
              </select>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
              <div>
                <label style="font-weight: 600; display: block; margin-bottom: 6px;">Fecha *</label>
                <input type="date" id="edit-act-date" value="${act.date || ''}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;" required>
              </div>
              <div>
                <label style="font-weight: 600; display: block; margin-bottom: 6px;">Hora</label>
                <input type="time" id="edit-act-time" value="${act.time || ''}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;">
              </div>
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Lugar</label>
              <input type="text" id="edit-act-location" value="${act.location || ''}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;">
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label style="font-weight: 600; display: block; margin-bottom: 6px;">Descripción</label>
              <textarea id="edit-act-desc" rows="3" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;">${act.description || ''}</textarea>
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
              <button type="button" class="btn-cancel" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer;">Cancelar</button>
              <button type="submit" style="padding: 10px 20px; border: none; border-radius: 8px; background: #3b82f6; color: white; cursor: pointer; font-weight: 600;">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    parentOverlay.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#form-edit-activity').addEventListener('submit', async (e) => {
      e.preventDefault();
      const idx = this.currentOrg.activities.findIndex(a => a.id === activityId);
      if (idx !== -1) {
        this.currentOrg.activities[idx] = {
          ...this.currentOrg.activities[idx],
          title: modal.querySelector('#edit-act-title').value.trim(),
          category: modal.querySelector('#edit-act-category').value,
          date: modal.querySelector('#edit-act-date').value,
          time: modal.querySelector('#edit-act-time').value,
          location: modal.querySelector('#edit-act-location').value.trim(),
          description: modal.querySelector('#edit-act-desc').value.trim()
        };
        try {
          await organizationsService.update(this.currentOrg.id, { activities: this.currentOrg.activities });
          showToast('Actividad actualizada', 'success');
          modal.remove();
          this.refreshContent(parentOverlay);
        } catch (err) {
          showToast('Error al guardar', 'error');
        }
      }
    });
  }

  /**
   * Eliminar un item genérico (assemblies, projects, activities, communications)
   */
  async deleteItem(arrayName, itemId, label, parentOverlay) {
    if (!confirm(`¿Está seguro de eliminar esta ${label}? Esta acción no se puede deshacer.`)) return;

    const arr = this.currentOrg[arrayName] || [];
    this.currentOrg[arrayName] = arr.filter(item => item.id !== itemId);
    try {
      await organizationsService.update(this.currentOrg.id, { [arrayName]: this.currentOrg[arrayName] });
      showToast(`${label.charAt(0).toUpperCase() + label.slice(1)} eliminada`, 'success');
      this.refreshContent(parentOverlay);
    } catch (err) {
      showToast(`Error al eliminar ${label}`, 'error');
    }
  }

  /**
   * Eliminar transacción financiera (recalcula balance)
   */
  async deleteTransaction(txId, parentOverlay) {
    if (!confirm('¿Eliminar este movimiento? El saldo será recalculado.')) return;

    const finances = this.currentOrg.finances || { balance: 0, transactions: [] };
    const tx = finances.transactions.find(t => t.id === txId);
    if (!tx) return;

    // Revertir del balance
    if (tx.type === 'income') {
      finances.balance -= tx.amount;
    } else {
      finances.balance += tx.amount;
    }
    finances.transactions = finances.transactions.filter(t => t.id !== txId);
    this.currentOrg.finances = finances;

    try {
      await organizationsService.update(this.currentOrg.id, { finances });
      showToast('Movimiento eliminado', 'success');
      this.refreshContent(parentOverlay);
    } catch (err) {
      showToast('Error al eliminar movimiento', 'error');
    }
  }

  /**
   * Genera certificado PDF (residencia o socio)
   */
  async generateCertificate(type) {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const org = this.currentOrg;
      const orgName = org.organization?.name || 'Organización';
      const orgType = getOrgTypeName(org.organization?.type);
      const today = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });

      // Header
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('MUNICIPALIDAD DE RENCA', 105, 20, { align: 'center' });
      doc.text('Dirección de Desarrollo Comunitario', 105, 26, { align: 'center' });
      doc.setDrawColor(41, 142, 203);
      doc.setLineWidth(0.5);
      doc.line(30, 32, 180, 32);

      if (type === 'residencia') {
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text('CERTIFICADO DE RESIDENCIA', 105, 50, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(40);
        const text = `La ${orgType} "${orgName}", con domicilio en ${org.organization?.address || 'dirección no registrada'}, comuna de ${org.organization?.commune || 'Renca'}, Región Metropolitana, certifica que la organización se encuentra constituida y vigente, con personalidad jurídica otorgada conforme a la Ley 19.418 sobre Juntas de Vecinos y demás Organizaciones Comunitarias.`;
        doc.text(text, 30, 70, { maxWidth: 150 });

        doc.text(`Número de socios activos: ${(org.members || []).length}`, 30, 115);
        doc.text(`Se extiende el presente certificado a petición del interesado.`, 30, 130);
        doc.text(`Renca, ${today}`, 30, 155);

        doc.setFontSize(10);
        doc.text('_____________________________', 105, 190, { align: 'center' });
        doc.text('Firma Presidente', 105, 197, { align: 'center' });
        doc.text(orgName, 105, 203, { align: 'center' });
      } else {
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text('CERTIFICADO DE SOCIO', 105, 50, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(40);
        doc.text(`La ${orgType} "${orgName}" certifica que las siguientes`, 30, 70);
        doc.text(`personas son socios activos de la organización:`, 30, 78);

        let y = 95;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('N°', 30, y);
        doc.text('Nombre', 45, y);
        doc.text('RUT', 140, y);
        doc.setFont(undefined, 'normal');
        y += 8;

        (org.members || []).slice(0, 25).forEach((m, i) => {
          doc.text(`${i + 1}`, 30, y);
          doc.text(`${m.firstName || ''} ${m.lastName || ''}`, 45, y);
          doc.text(`${m.rut || '-'}`, 140, y);
          y += 7;
          if (y > 270) { doc.addPage(); y = 20; }
        });

        y += 10;
        doc.setFontSize(11);
        doc.text(`Renca, ${today}`, 30, y);
        y += 25;
        doc.setFontSize(10);
        doc.text('_____________________________', 105, y, { align: 'center' });
        doc.text('Firma Presidente', 105, y + 7, { align: 'center' });
      }

      doc.save(`certificado_${type}_${orgName.replace(/\s+/g, '_')}.pdf`);
      showToast(`Certificado de ${type === 'residencia' ? 'residencia' : 'socio'} generado`, 'success');
    } catch (err) {
      console.error('Error generating certificate:', err);
      showToast('Error al generar certificado. Verifique que jsPDF esté disponible.', 'error');
    }
  }

  /**
   * Muestra balance anual resumido
   */
  showAnnualBalance(parentOverlay) {
    const finances = this.currentOrg.finances || { balance: 0, transactions: [] };
    const txs = finances.transactions || [];
    const currentYear = new Date().getFullYear();

    // Agrupar por mes del año actual
    const months = Array.from({ length: 12 }, (_, i) => ({
      name: new Date(currentYear, i).toLocaleDateString('es-CL', { month: 'long' }),
      income: 0, expense: 0
    }));

    txs.forEach(tx => {
      const d = new Date(tx.date);
      if (d.getFullYear() === currentYear) {
        const m = d.getMonth();
        if (tx.type === 'income') months[m].income += tx.amount;
        else months[m].expense += tx.amount;
      }
    });

    const totalIncome = months.reduce((s, m) => s + m.income, 0);
    const totalExpense = months.reduce((s, m) => s + m.expense, 0);

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 650px; max-height: 90vh; overflow-y: auto;">
        <div class="org-modal-header">
          <h3>Balance Anual ${currentYear}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px;">
            <div style="text-align: center; padding: 16px; background: #f0fdf4; border-radius: 10px;">
              <div style="font-size: 20px; font-weight: 700; color: #166534;">+$${totalIncome.toLocaleString('es-CL')}</div>
              <div style="font-size: 12px; color: #4ade80; margin-top: 4px;">Total Ingresos</div>
            </div>
            <div style="text-align: center; padding: 16px; background: #fef2f2; border-radius: 10px;">
              <div style="font-size: 20px; font-weight: 700; color: #991b1b;">-$${totalExpense.toLocaleString('es-CL')}</div>
              <div style="font-size: 12px; color: #f87171; margin-top: 4px;">Total Gastos</div>
            </div>
            <div style="text-align: center; padding: 16px; background: #eff6ff; border-radius: 10px;">
              <div style="font-size: 20px; font-weight: 700; color: #1e40af;">$${(finances.balance || 0).toLocaleString('es-CL')}</div>
              <div style="font-size: 12px; color: #3b82f6; margin-top: 4px;">Saldo Actual</div>
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="border-bottom: 2px solid #e5e7eb;">
                <th style="text-align: left; padding: 10px 8px; color: #374151;">Mes</th>
                <th style="text-align: right; padding: 10px 8px; color: #166534;">Ingresos</th>
                <th style="text-align: right; padding: 10px 8px; color: #991b1b;">Gastos</th>
                <th style="text-align: right; padding: 10px 8px; color: #1e40af;">Neto</th>
              </tr>
            </thead>
            <tbody>
              ${months.map(m => `
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 8px; text-transform: capitalize;">${m.name}</td>
                  <td style="padding: 8px; text-align: right; color: #166534;">${m.income > 0 ? '+$' + m.income.toLocaleString('es-CL') : '-'}</td>
                  <td style="padding: 8px; text-align: right; color: #991b1b;">${m.expense > 0 ? '-$' + m.expense.toLocaleString('es-CL') : '-'}</td>
                  <td style="padding: 8px; text-align: right; font-weight: 600; color: ${m.income - m.expense >= 0 ? '#166534' : '#991b1b'};">$${(m.income - m.expense).toLocaleString('es-CL')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="text-align: right; margin-top: 20px;">
            <button class="btn-cancel" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer;">Cerrar</button>
          </div>
        </div>
      </div>
    `;

    parentOverlay.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  /**
   * Exporta movimientos financieros a CSV
   */
  exportFinancesCSV() {
    const finances = this.currentOrg.finances || { balance: 0, transactions: [] };
    const txs = finances.transactions || [];

    if (txs.length === 0) {
      showToast('No hay movimientos para exportar', 'info');
      return;
    }

    const orgName = this.currentOrg.organization?.name || 'Organizacion';
    const BOM = '\uFEFF';
    const header = 'Fecha,Tipo,Descripción,Monto\n';
    const rows = txs.map(tx => {
      const date = new Date(tx.date).toLocaleDateString('es-CL');
      const type = tx.type === 'income' ? 'Ingreso' : 'Gasto';
      const desc = `"${(tx.description || '').replace(/"/g, '""')}"`;
      const amount = tx.type === 'income' ? tx.amount : -tx.amount;
      return `${date},${type},${desc},${amount}`;
    }).join('\n');

    const footer = `\nSaldo actual:,,,$${finances.balance || 0}`;

    const blob = new Blob([BOM + header + rows + footer], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movimientos_${orgName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Movimientos exportados a CSV', 'success');
  }

  /**
   * Modal para registrar directorio definitivo (post-elecciones)
   */
  openDefinitiveDirectorioModal(parentOverlay) {
    const org = this.currentOrg;
    const members = org.members || [];
    const roles = ['Presidente', 'Secretario', 'Tesorero'];
    const provisional = org.provisionalDirectorio;

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 620px;">
        <div class="org-modal-header">
          <h3>Registrar Directorio Definitivo</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px;">
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              <strong>Ley 19.418:</strong> Tras la aprobación, el directorio provisional debe ser reemplazado por uno definitivo elegido en asamblea dentro de 60 días.
            </p>
          </div>
          ${provisional ? `
            <div style="background: #f9fafb; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
              <p style="margin: 0 0 8px; font-weight: 600; color: #6b7280; font-size: 13px;">Directorio Provisional Actual:</p>
              <p style="margin: 2px 0; font-size: 13px; color: #374151;">Presidente: ${provisional.president?.firstName || '-'} ${provisional.president?.lastName || ''}</p>
              <p style="margin: 2px 0; font-size: 13px; color: #374151;">Secretario: ${provisional.secretary?.firstName || '-'} ${provisional.secretary?.lastName || ''}</p>
              <p style="margin: 2px 0; font-size: 13px; color: #374151;">Tesorero: ${provisional.treasurer?.firstName || '-'} ${provisional.treasurer?.lastName || ''}</p>
            </div>
          ` : ''}
          <p style="color: #6b7280; margin-bottom: 16px; font-size: 14px;">Seleccione los miembros elegidos en asamblea para cada cargo:</p>
          ${roles.map(role => `
            <div class="form-group" style="margin-bottom: 16px;">
              <label style="font-weight: 600; color: #1e293b; margin-bottom: 6px; display: block;">${role} *</label>
              <select id="def-dir-${role.toLowerCase()}" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;" required>
                <option value="">-- Seleccionar socio --</option>
                ${members.map(m => {
                  const name = `${m.firstName || ''} ${m.lastName || ''}`.trim();
                  return `<option value="${m.rut}">${name} (${m.rut || 'Sin RUT'})</option>`;
                }).join('')}
              </select>
            </div>
          `).join('')}
          <div class="form-group" style="margin-bottom: 16px;">
            <label style="font-weight: 600; color: #1e293b; margin-bottom: 6px; display: block;">Fecha de Elección en Asamblea *</label>
            <input type="date" id="def-dir-date" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;" required>
          </div>
          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button class="btn-cancel" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer;">Cancelar</button>
            <button class="btn-save-def-dir" style="padding: 10px 20px; border: none; border-radius: 8px; background: #059669; color: white; cursor: pointer; font-weight: 600;">Registrar Directorio Definitivo</button>
          </div>
        </div>
      </div>
    `;

    parentOverlay.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('.btn-save-def-dir').addEventListener('click', async () => {
      const roles = ['Presidente', 'Secretario', 'Tesorero'];
      const newCommission = roles.map(role => {
        const rut = modal.querySelector(`#def-dir-${role.toLowerCase()}`).value;
        if (!rut) return null;
        const member = members.find(m => m.rut === rut);
        return member ? { firstName: member.firstName, lastName: member.lastName, rut: member.rut, role: role.toLowerCase() } : null;
      }).filter(Boolean);

      if (newCommission.length < 3) {
        showToast('Debe asignar los 3 cargos del directorio', 'error');
        return;
      }

      const electionDate = modal.querySelector('#def-dir-date').value;
      if (!electionDate) {
        showToast('Debe indicar la fecha de elección', 'error');
        return;
      }

      try {
        const updateData = {
          commission: { members: newCommission, electionDate },
          provisionalDirectorio: null
        };
        await organizationsService.update(org.id || org._id, updateData);
        this.currentOrg.commission = { members: newCommission, electionDate };
        this.currentOrg.provisionalDirectorio = null;

        alertsService.completeAlert(org.id || org._id, 'directorio_definitivo', {
          directorio: { members: newCommission, electionDate }
        });

        showToast('Directorio definitivo registrado correctamente', 'success');
        modal.remove();
        this.refreshContent(parentOverlay);
      } catch (err) {
        showToast('Error al registrar directorio', 'error');
      }
    });
  }

  /**
   * Modal para actualizar registro de socios
   */
  openRegistroSociosModal(parentOverlay) {
    const org = this.currentOrg;
    const members = org.members || [];
    const activeCount = members.filter(m => m.status !== 'inactive').length;
    const inactiveCount = members.filter(m => m.status === 'inactive').length;

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 580px;">
        <div class="org-modal-header">
          <h3>Actualizar Registro de Socios</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px;">
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              <strong>Ley 19.418:</strong> El registro de socios debe mantenerse actualizado semestralmente ante la municipalidad.
            </p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px;">
            <div style="background: #f0fdf4; border-radius: 10px; padding: 16px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #059669;">${activeCount}</div>
              <div style="font-size: 12px; color: #6b7280;">Socios Activos</div>
            </div>
            <div style="background: #fef2f2; border-radius: 10px; padding: 16px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #dc2626;">${inactiveCount}</div>
              <div style="font-size: 12px; color: #6b7280;">Inactivos</div>
            </div>
            <div style="background: #f8fafc; border-radius: 10px; padding: 16px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #1e293b;">${members.length}</div>
              <div style="font-size: 12px; color: #6b7280;">Total</div>
            </div>
          </div>

          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px; max-height: 200px; overflow-y: auto;">
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <th style="text-align: left; padding: 4px 8px; color: #6b7280;">Nombre</th>
                  <th style="text-align: left; padding: 4px 8px; color: #6b7280;">RUT</th>
                  <th style="text-align: center; padding: 4px 8px; color: #6b7280;">Estado</th>
                </tr>
              </thead>
              <tbody>
                ${members.map(m => `
                  <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 4px 8px;">${m.firstName || ''} ${m.lastName || ''}</td>
                    <td style="padding: 4px 8px;">${m.rut || '-'}</td>
                    <td style="padding: 4px 8px; text-align: center;">
                      <span style="padding: 2px 8px; border-radius: 10px; font-size: 11px; background: ${m.status === 'inactive' ? '#fef2f2' : '#f0fdf4'}; color: ${m.status === 'inactive' ? '#dc2626' : '#059669'};">
                        ${m.status === 'inactive' ? 'Inactivo' : 'Activo'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label style="font-weight: 600; color: #1e293b; margin-bottom: 6px; display: block;">Observaciones</label>
            <textarea id="registro-obs" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; min-height: 60px;" placeholder="Notas sobre cambios en el registro..."></textarea>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button class="btn-cancel" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer;">Cancelar</button>
            <button class="btn-confirm-registro" style="padding: 10px 20px; border: none; border-radius: 8px; background: #3b82f6; color: white; cursor: pointer; font-weight: 600;">Confirmar Actualización</button>
          </div>
        </div>
      </div>
    `;

    parentOverlay.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('.btn-confirm-registro').addEventListener('click', async () => {
      try {
        await organizationsService.update(org.id || org._id, {
          lastSociosUpdate: new Date().toISOString(),
          members: org.members
        });
        this.currentOrg.lastSociosUpdate = new Date().toISOString();

        alertsService.completeAlert(org.id || org._id, 'registro_socios', {});

        showToast('Registro de socios actualizado correctamente', 'success');
        modal.remove();
        this.refreshContent(parentOverlay);
      } catch (err) {
        showToast('Error al actualizar registro', 'error');
      }
    });
  }

  /**
   * Modal para designar Comisión Revisora de Cuentas
   */
  openComisionRevisoraModal(parentOverlay) {
    const org = this.currentOrg;
    const members = org.members || [];
    const commission = org.commission?.members || [];
    const commissionRuts = new Set(commission.map(m => m.rut));
    const eligibleMembers = members.filter(m => !commissionRuts.has(m.rut) && m.status !== 'inactive');
    const currentComision = org.comisionRevisora || [];

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 600px;">
        <div class="org-modal-header">
          <h3>Designar Comisión Revisora de Cuentas</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px;">
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              <strong>Ley 19.418, Art. 25:</strong> La comisión revisora de cuentas debe ser elegida anualmente en asamblea ordinaria. No pueden ser miembros del directorio.
            </p>
          </div>

          ${currentComision.length > 0 ? `
            <div style="background: #f9fafb; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
              <p style="margin: 0 0 8px; font-weight: 600; color: #6b7280; font-size: 13px;">Comisión Actual:</p>
              ${currentComision.map(m => `
                <p style="margin: 2px 0; font-size: 13px; color: #374151;">${m.firstName || ''} ${m.lastName || ''} (${m.rut || '-'})</p>
              `).join('')}
            </div>
          ` : ''}

          <p style="color: #6b7280; margin-bottom: 16px; font-size: 14px;">Seleccione 3 socios que no pertenezcan al directorio:</p>
          ${[1, 2, 3].map(i => `
            <div class="form-group" style="margin-bottom: 16px;">
              <label style="font-weight: 600; color: #1e293b; margin-bottom: 6px; display: block;">Miembro ${i} ${i <= 2 ? '*' : '(Suplente)'}</label>
              <select id="comision-rev-${i}" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;" ${i <= 2 ? 'required' : ''}>
                <option value="">-- Seleccionar socio --</option>
                ${eligibleMembers.map(m => {
                  const name = `${m.firstName || ''} ${m.lastName || ''}`.trim();
                  return `<option value="${m.rut}">${name} (${m.rut || 'Sin RUT'})</option>`;
                }).join('')}
              </select>
            </div>
          `).join('')}
          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button class="btn-cancel" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer;">Cancelar</button>
            <button class="btn-save-comision" style="padding: 10px 20px; border: none; border-radius: 8px; background: #059669; color: white; cursor: pointer; font-weight: 600;">Designar Comisión</button>
          </div>
        </div>
      </div>
    `;

    parentOverlay.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('.btn-save-comision').addEventListener('click', async () => {
      const selectedMembers = [1, 2, 3].map(i => {
        const rut = modal.querySelector(`#comision-rev-${i}`).value;
        if (!rut) return null;
        const member = members.find(m => m.rut === rut);
        return member ? { firstName: member.firstName, lastName: member.lastName, rut: member.rut } : null;
      }).filter(Boolean);

      if (selectedMembers.length < 2) {
        showToast('Debe designar al menos 2 miembros para la comisión', 'error');
        return;
      }

      const ruts = selectedMembers.map(m => m.rut);
      if (new Set(ruts).size !== ruts.length) {
        showToast('No puede seleccionar el mismo socio más de una vez', 'error');
        return;
      }

      try {
        await organizationsService.update(org.id || org._id, {
          comisionRevisora: selectedMembers,
          lastComisionRevisoraElection: new Date().toISOString()
        });
        this.currentOrg.comisionRevisora = selectedMembers;
        this.currentOrg.lastComisionRevisoraElection = new Date().toISOString();

        alertsService.completeAlert(org.id || org._id, 'comision_revisora', { comision: selectedMembers });

        showToast('Comisión Revisora de Cuentas designada correctamente', 'success');
        modal.remove();
        this.refreshContent(parentOverlay);
      } catch (err) {
        showToast('Error al designar comisión', 'error');
      }
    });
  }

  /**
   * Modal para designar TRICEL (Tribunal Calificador de Elecciones)
   */
  openTricelDesignationModal(parentOverlay) {
    const org = this.currentOrg;
    const members = org.members || [];
    const commission = org.commission?.members || [];
    const commissionRuts = new Set(commission.map(m => m.rut));
    const eligibleMembers = members.filter(m => !commissionRuts.has(m.rut) && m.status !== 'inactive');
    const currentTricel = org.tricelData;

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 600px;">
        <div class="org-modal-header">
          <h3>Designar TRICEL</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px;">
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>Tribunal Calificador de Elecciones:</strong> Debe designarse al menos 2 meses antes del vencimiento del directorio. Sus miembros no pueden ser candidatos ni pertenecer al directorio actual.
            </p>
          </div>

          ${currentTricel ? `
            <div style="background: #f9fafb; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
              <p style="margin: 0 0 8px; font-weight: 600; color: #6b7280; font-size: 13px;">TRICEL Actual (designado ${currentTricel.designatedAt ? new Date(currentTricel.designatedAt).toLocaleDateString('es-CL') : 'N/A'}):</p>
              ${(currentTricel.members || []).map(m => `
                <p style="margin: 2px 0; font-size: 13px; color: #374151;">${m.firstName || ''} ${m.lastName || ''} (${m.rut || '-'})</p>
              `).join('')}
            </div>
          ` : ''}

          <p style="color: #6b7280; margin-bottom: 16px; font-size: 14px;">Seleccione 3 socios para integrar el TRICEL:</p>
          ${['Presidente TRICEL', 'Secretario TRICEL', 'Vocal'].map((role, i) => `
            <div class="form-group" style="margin-bottom: 16px;">
              <label style="font-weight: 600; color: #1e293b; margin-bottom: 6px; display: block;">${role} *</label>
              <select id="tricel-member-${i}" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;" required>
                <option value="">-- Seleccionar socio --</option>
                ${eligibleMembers.map(m => {
                  const name = `${m.firstName || ''} ${m.lastName || ''}`.trim();
                  return `<option value="${m.rut}">${name} (${m.rut || 'Sin RUT'})</option>`;
                }).join('')}
              </select>
            </div>
          `).join('')}
          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button class="btn-cancel" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer;">Cancelar</button>
            <button class="btn-save-tricel" style="padding: 10px 20px; border: none; border-radius: 8px; background: #7c3aed; color: white; cursor: pointer; font-weight: 600;">Designar TRICEL</button>
          </div>
        </div>
      </div>
    `;

    parentOverlay.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('.btn-save-tricel').addEventListener('click', async () => {
      const tricelRoles = ['presidente', 'secretario', 'vocal'];
      const tricelMembers = [0, 1, 2].map(i => {
        const rut = modal.querySelector(`#tricel-member-${i}`).value;
        if (!rut) return null;
        const member = members.find(m => m.rut === rut);
        return member ? { firstName: member.firstName, lastName: member.lastName, rut: member.rut, role: tricelRoles[i] } : null;
      }).filter(Boolean);

      if (tricelMembers.length < 3) {
        showToast('Debe designar los 3 miembros del TRICEL', 'error');
        return;
      }

      const ruts = tricelMembers.map(m => m.rut);
      if (new Set(ruts).size !== ruts.length) {
        showToast('No puede seleccionar el mismo socio más de una vez', 'error');
        return;
      }

      try {
        const tricelData = { members: tricelMembers };
        await organizationsService.update(org.id || org._id, {
          tricelDesignated: true,
          tricelData: { ...tricelData, designatedAt: new Date().toISOString() }
        });
        this.currentOrg.tricelDesignated = true;
        this.currentOrg.tricelData = { ...tricelData, designatedAt: new Date().toISOString() };

        alertsService.completeAlert(org.id || org._id, 'tricel_designation', { tricel: tricelData });

        showToast('TRICEL designado correctamente', 'success');
        modal.remove();
        this.refreshContent(parentOverlay);
      } catch (err) {
        showToast('Error al designar TRICEL', 'error');
      }
    });
  }

  /**
   * Modal para editar resultados de una elección
   */
  showElectionDetail(electionId, parentOverlay) {
    const elections = this.currentOrg.elections || [];
    const election = elections.find(e => e.id === electionId);
    if (!election) return;

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 550px;">
        <div class="org-modal-header">
          <h3>Detalle de Elección</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
            <div>
              <label style="font-size: 12px; color: #6b7280; display: block;">Fecha</label>
              <span style="font-weight: 600;">${new Date(election.date).toLocaleDateString('es-CL')}</span>
            </div>
            <div>
              <label style="font-size: 12px; color: #6b7280; display: block;">Tipo</label>
              <span style="font-weight: 600;">${election.type === 'total' ? 'Renovación Total' : 'Renovación Parcial'}</span>
            </div>
            <div>
              <label style="font-size: 12px; color: #6b7280; display: block;">Hora</label>
              <span>${election.time || 'No especificada'}</span>
            </div>
            <div>
              <label style="font-size: 12px; color: #6b7280; display: block;">Lugar</label>
              <span>${election.location || 'No especificado'}</span>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label style="font-weight: 600; display: block; margin-bottom: 6px;">Estado / Resultado</label>
            <select id="election-result-edit" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px;">
              <option value="Pendiente" ${election.result === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
              <option value="Completada" ${election.result === 'Completada' ? 'selected' : ''}>Completada</option>
              <option value="Directorio Elegido" ${election.result === 'Directorio Elegido' ? 'selected' : ''}>Directorio Elegido</option>
              <option value="Sin quórum" ${election.result === 'Sin quórum' ? 'selected' : ''}>Sin quórum</option>
              <option value="Suspendida" ${election.result === 'Suspendida' ? 'selected' : ''}>Suspendida</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label style="font-weight: 600; display: block; margin-bottom: 6px;">Participación (%)</label>
            <div style="display: flex; align-items: center; gap: 12px;">
              <input type="range" id="election-participation-edit" min="0" max="100" value="${election.participation || 0}" style="flex: 1;">
              <span id="participation-display" style="min-width: 40px; font-weight: 700; color: #3b82f6;">${election.participation || 0}%</span>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label style="font-weight: 600; display: block; margin-bottom: 6px;">Observaciones</label>
            <textarea id="election-notes-edit" class="input-styled" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; min-height: 60px;">${election.notes || ''}</textarea>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button class="btn-cancel" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer;">Cancelar</button>
            <button class="btn-save-election" style="padding: 10px 20px; border: none; border-radius: 8px; background: #3b82f6; color: white; cursor: pointer; font-weight: 600;">Guardar Cambios</button>
          </div>
        </div>
      </div>
    `;

    parentOverlay.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    const rangeInput = modal.querySelector('#election-participation-edit');
    const display = modal.querySelector('#participation-display');
    rangeInput.addEventListener('input', () => {
      display.textContent = rangeInput.value + '%';
    });

    modal.querySelector('.btn-save-election').addEventListener('click', async () => {
      election.result = modal.querySelector('#election-result-edit').value;
      election.participation = parseInt(rangeInput.value);
      election.notes = modal.querySelector('#election-notes-edit').value;

      try {
        await organizationsService.update(this.currentOrg.id || this.currentOrg._id, { elections });
        showToast('Elección actualizada correctamente', 'success');
        modal.remove();
        this.refreshContent(parentOverlay);
      } catch (err) {
        showToast('Error al actualizar elección', 'error');
      }
    });
  }

  // ============================================================
  // MÉTODOS PARA INTEGRACIÓN CON MENÚ LATERAL (PÁGINAS COMPLETAS)
  // ============================================================

  /**
   * Establece la organización activa (para uso desde OrganizationMenuManager)
   */
  setOrganization(org) {
    this.currentOrg = org;
  }

  /**
   * Obtiene la organización activa
   */
  getOrganization() {
    return this.currentOrg;
  }

  /**
   * Renderiza contenido de un tab específico
   */
  renderTab(tabName) {
    this.currentTab = tabName;
    return this.renderTabContent();
  }

  /**
   * Genera un PDF legal y lo muestra en un modal de previsualización
   */
  viewLegalDocument(docType) {
    try {
      const org = this.currentOrg;
      if (!org) { showToast('No hay organización seleccionada', 'error'); return; }

      let doc, title;
      if (docType === 'estatutos') {
        // Si hay contenido de estatutos, generar PDF desde texto
        if (org.estatutos) {
          doc = this._generateEstatutosPDF(org);
          title = 'Estatutos';
        } else {
          showToast('No hay estatutos disponibles para esta organización', 'error');
          return;
        }
      } else if (docType === 'acta') {
        doc = pdfService.generateActaAsamblea(org);
        title = 'Acta Constitutiva';
      } else if (docType === 'certificacion') {
        doc = pdfService.generateCertificacion(org, org.certificNumber || '');
        title = 'Certificación Municipal';
      } else {
        showToast('Tipo de documento no reconocido', 'error');
        return;
      }

      const blobUrl = pdfService.getPDFDataURL(doc);
      this._showPDFPreviewModal(blobUrl, title, doc);
    } catch (error) {
      console.error('Error generando documento:', error);
      showToast('Error al generar el documento: ' + error.message, 'error');
    }
  }

  /**
   * Descarga un PDF legal directamente
   */
  downloadLegalDocument(docType) {
    try {
      const org = this.currentOrg;
      if (!org) { showToast('No hay organización seleccionada', 'error'); return; }
      const orgName = (org.organizationName || org.organization?.name || 'Organizacion').replace(/\s+/g, '_');

      let doc, filename;
      if (docType === 'estatutos') {
        if (org.estatutos) {
          doc = this._generateEstatutosPDF(org);
          filename = `Estatutos_${orgName}.pdf`;
        } else {
          showToast('No hay estatutos disponibles', 'error');
          return;
        }
      } else if (docType === 'acta') {
        doc = pdfService.generateActaAsamblea(org);
        filename = `Acta_Constitutiva_${orgName}.pdf`;
      } else if (docType === 'certificacion') {
        doc = pdfService.generateCertificacion(org, org.certificNumber || '');
        filename = `Certificacion_Municipal_${orgName}.pdf`;
      } else {
        showToast('Tipo de documento no reconocido', 'error');
        return;
      }

      pdfService.downloadPDF(doc, filename);
      showToast(`${filename} descargado`, 'success');
    } catch (error) {
      console.error('Error descargando documento:', error);
      showToast('Error al descargar: ' + error.message, 'error');
    }
  }

  /**
   * Genera un PDF a partir del contenido de estatutos (texto plano)
   */
  _generateEstatutosPDF(org) {
    const doc = new jsPDF();
    const orgName = org.organizationName || org.organization?.name || 'Organización';
    const content = org.estatutos || '';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ESTATUTOS', 105, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.text(orgName, 105, 28, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const lines = doc.splitTextToSize(content, 170);
    let y = 40;
    const pageHeight = 280;

    for (const line of lines) {
      if (y > pageHeight) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 20, y);
      y += 5;
    }

    return doc;
  }

  /**
   * Muestra un modal con previsualización de PDF
   */
  _showPDFPreviewModal(blobUrl, title, doc) {
    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:200000;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;width:100%;max-width:800px;height:90vh;display:flex;flex-direction:column;overflow:hidden;">
        <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">
          <h3 style="margin:0;font-size:18px;color:#1e293b;">${title}</h3>
          <div style="display:flex;gap:8px;">
            <button id="modal-download-pdf" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;border:none;padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px;">
              ⬇ Descargar PDF
            </button>
            <button id="modal-close-pdf" style="background:#f1f5f9;border:none;width:36px;height:36px;border-radius:8px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;">✕</button>
          </div>
        </div>
        <div style="flex:1;overflow:hidden;">
          <iframe src="${blobUrl}" style="width:100%;height:100%;border:none;"></iframe>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#modal-close-pdf').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#modal-download-pdf').addEventListener('click', () => {
      const orgName = (this.currentOrg.organizationName || this.currentOrg.organization?.name || 'Doc').replace(/\s+/g, '_');
      pdfService.downloadPDF(doc, `${title.replace(/\s+/g, '_')}_${orgName}.pdf`);
    });
  }

  /**
   * Adjunta listeners a un contenedor genérico (para uso en páginas completas)
   * Similar a attachContentListeners pero no requiere overlay del modal
   */
  attachContentListenersToContainer(container) {
    if (!container) return;

    // Botones de acción de alertas
    container.querySelectorAll('.alert-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const alertType = btn.dataset.alertType;
        this.handleAlertActionInPage(alertType, container);
      });
    });

    // Agregar nuevo socio
    const btnAddMember = container.querySelector('#btn-add-new-member');
    if (btnAddMember) {
      btnAddMember.addEventListener('click', () => this.openAddMemberModalInPage(container));
    }

    // Acciones rápidas
    container.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        // Disparar evento personalizado para que OrganizationMenuManager maneje la navegación
        window.dispatchEvent(new CustomEvent('org-quick-action', { detail: { action } }));
      });
    });

    // Nueva asamblea
    const btnNewAssembly = container.querySelector('#btn-new-assembly') || container.querySelector('#btn-first-assembly');
    if (btnNewAssembly) {
      btnNewAssembly.addEventListener('click', () => this.openNewAssemblyModalInPage(container));
    }

    // Nuevo proyecto
    const btnNewProject = container.querySelector('#btn-new-project') || container.querySelector('#btn-first-project');
    if (btnNewProject) {
      btnNewProject.addEventListener('click', () => this.openNewProjectModalInPage(container));
    }

    // Nueva actividad
    const btnNewActivity = container.querySelector('#btn-new-activity') || container.querySelector('#btn-first-activity');
    if (btnNewActivity) {
      btnNewActivity.addEventListener('click', () => this.openNewActivityModalInPage(container));
    }

    // Nueva transacción
    const btnNewTransaction = container.querySelector('#btn-new-transaction');
    if (btnNewTransaction) {
      btnNewTransaction.addEventListener('click', () => this.openNewTransactionModalInPage(container));
    }

    // Agendar elección desde directorio
    const btnScheduleElection = container.querySelector('#btn-schedule-election-assembly');
    if (btnScheduleElection) {
      btnScheduleElection.addEventListener('click', () => {
        // Navigate to asambleas tab and open modal with election pre-selected
        window.dispatchEvent(new CustomEvent('org-quick-action', { detail: { action: 'asambleas' } }));
        setTimeout(() => {
          const asambleasContainer = document.getElementById('org-asambleas-content');
          this.openNewAssemblyModal({ querySelector: () => null, querySelectorAll: () => [] }, 'eleccion_directorio');
          this._pendingRefreshContainer = asambleasContainer || container;
        }, 300);
      });
    }

    // Assembly status action buttons
    container.querySelectorAll('.btn-convoke-assembly').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orgId = this.currentOrg._id || this.currentOrg.id;
        try {
          await apiService.updateAssemblyStatus(orgId, btn.dataset.id, 'convocar');
          const asm = this.currentOrg.assemblies.find(a => a.id === btn.dataset.id);
          if (asm) { asm.status = 'convocada'; asm.convokedAt = new Date().toISOString(); }
          showToast('Asamblea convocada', 'success');
          this.refreshContentInContainer(container, this.currentTab);
        } catch (err) { showToast(err.message || 'Error', 'error'); }
      });
    });
    container.querySelectorAll('.btn-start-assembly').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orgId = this.currentOrg._id || this.currentOrg.id;
        try {
          await apiService.updateAssemblyStatus(orgId, btn.dataset.id, 'iniciar');
          const asm = this.currentOrg.assemblies.find(a => a.id === btn.dataset.id);
          if (asm) { asm.status = 'en_curso'; asm.startedAt = new Date().toISOString(); }
          showToast('Asamblea iniciada', 'success');
          this.refreshContentInContainer(container, this.currentTab);
        } catch (err) { showToast(err.message || 'Error', 'error'); }
      });
    });
    container.querySelectorAll('.btn-finish-assembly').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Finalizar esta asamblea? Se cerrarán todas las votaciones y se procesarán los resultados.')) return;
        const orgId = this.currentOrg._id || this.currentOrg.id;
        try {
          const result = await apiService.updateAssemblyStatus(orgId, btn.dataset.id, 'finalizar');
          // Refresh entire org to get updated directorio
          const updatedOrg = await apiService.getOrganization(orgId);
          Object.assign(this.currentOrg, updatedOrg);
          showToast('Asamblea finalizada', 'success');
          this.refreshContentInContainer(container, this.currentTab);
        } catch (err) { showToast(err.message || 'Error', 'error'); }
      });
    });

    // Nueva elección
    const btnNewElection = container.querySelector('#btn-new-election') || container.querySelector('#btn-urgent-election');
    if (btnNewElection) {
      btnNewElection.addEventListener('click', () => this.openNewElectionModalInPage(container));
    }

    // Editar elección
    container.querySelectorAll('.btn-edit-election').forEach(btn => {
      btn.addEventListener('click', () => this.showElectionDetailInPage(btn.dataset.id, container));
    });

    // Eliminar elección
    container.querySelectorAll('.btn-delete-election').forEach(btn => {
      btn.addEventListener('click', () => this.deleteItemInPage('elections', btn.dataset.id, 'elección', container));
    });

    // Nueva comunicación
    const btnNewComm = container.querySelector('#btn-new-communication') || container.querySelector('#btn-first-communication');
    if (btnNewComm) {
      btnNewComm.addEventListener('click', () => this.openNewCommunicationModalInPage(container));
    }

    // Templates de comunicación
    container.querySelectorAll('.template-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const template = btn.dataset.template;
        const subjects = { asamblea: 'Citacion a Asamblea', actividad: 'Invitacion a Actividad', informe: 'Informe de Gestion', urgente: 'Aviso Urgente' };
        this.openNewCommunicationModalInPage(container);
        setTimeout(() => {
          const modal = document.querySelector('.org-modal-overlay');
          if (modal) {
            const subjectInput = modal.querySelector('#comm-subject');
            const typeSelect = modal.querySelector('#comm-type');
            if (subjectInput) subjectInput.value = subjects[template] || '';
            if (typeSelect) typeSelect.value = template || 'general';
          }
        }, 100);
      });
    });

    // Editar y eliminar miembros
    container.querySelectorAll('.btn-edit-member').forEach(btn => {
      btn.addEventListener('click', () => this.openEditMemberModalInPage(btn.dataset.rut, container));
    });
    container.querySelectorAll('.btn-delete-member').forEach(btn => {
      btn.addEventListener('click', () => this.deleteMemberInPage(btn.dataset.rut, container));
    });

    // Filtro de actividades
    container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        container.querySelectorAll('.actividad-card').forEach(card => {
          if (filter === 'all' || card.dataset.category === filter) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });

    // Ver detalle de asamblea
    container.querySelectorAll('.btn-view-assembly').forEach(btn => {
      btn.addEventListener('click', () => this.showAssemblyDetailInPage(btn.dataset.id, container));
    });

    // Eliminar asamblea
    container.querySelectorAll('.btn-delete-assembly').forEach(btn => {
      btn.addEventListener('click', () => this.deleteItemInPage('assemblies', btn.dataset.id, 'asamblea', container));
    });

    // Ver detalle de proyecto
    container.querySelectorAll('.btn-view-project').forEach(btn => {
      btn.addEventListener('click', () => this.showProjectDetailInPage(btn.dataset.id, container));
    });

    // Eliminar proyecto
    container.querySelectorAll('.btn-delete-project').forEach(btn => {
      btn.addEventListener('click', () => this.deleteItemInPage('projects', btn.dataset.id, 'proyecto', container));
    });

    // Ver comunicación
    container.querySelectorAll('.btn-view-comm').forEach(btn => {
      btn.addEventListener('click', () => this.showCommunicationDetailInPage(btn.dataset.id, container));
    });

    // Eliminar comunicación
    container.querySelectorAll('.btn-delete-comm').forEach(btn => {
      btn.addEventListener('click', () => this.deleteItemInPage('communications', btn.dataset.id, 'comunicación', container));
    });

    // Eliminar transacción
    container.querySelectorAll('.btn-delete-tx').forEach(btn => {
      btn.addEventListener('click', () => this.deleteTransactionInPage(btn.dataset.id, container));
    });

    // Editar actividad
    container.querySelectorAll('.btn-edit-activity').forEach(btn => {
      btn.addEventListener('click', () => this.showActivityDetailInPage(btn.dataset.id, container));
    });

    // Eliminar actividad
    container.querySelectorAll('.btn-delete-activity').forEach(btn => {
      btn.addEventListener('click', () => this.deleteItemInPage('activities', btn.dataset.id, 'actividad', container));
    });

    // Generar certificados
    const btnCertResidencia = container.querySelector('#btn-cert-residencia');
    if (btnCertResidencia) {
      btnCertResidencia.addEventListener('click', () => this.generateCertificate('residencia'));
    }
    const btnCertSocio = container.querySelector('#btn-cert-socio');
    if (btnCertSocio) {
      btnCertSocio.addEventListener('click', () => this.generateCertificate('socio'));
    }

    // Ver balance anual
    const btnAnnualBalance = container.querySelector('#btn-annual-balance');
    if (btnAnnualBalance) {
      btnAnnualBalance.addEventListener('click', () => this.showAnnualBalanceInPage(container));
    }

    // Exportar finanzas
    const btnExportFinances = container.querySelector('#btn-export-finances');
    if (btnExportFinances) {
      btnExportFinances.addEventListener('click', () => this.exportFinancesCSV());
    }

    // Botón asignar en directorio (slots vacíos)
    container.querySelectorAll('.btn-assign').forEach(btn => {
      btn.addEventListener('click', () => this.openEditDirectorioModalInPage(container));
    });

    // Ver documentos legales (Estatutos, Acta, Certificación)
    container.querySelectorAll('.btn-view-legal-doc').forEach(btn => {
      btn.addEventListener('click', () => this.viewLegalDocument(btn.dataset.docType));
    });
    container.querySelectorAll('.btn-download-legal-doc').forEach(btn => {
      btn.addEventListener('click', () => this.downloadLegalDocument(btn.dataset.docType));
    });

    // Upload documento
    const btnUploadDoc = container.querySelector('#btn-upload-doc');
    if (btnUploadDoc) {
      btnUploadDoc.addEventListener('click', () => this.showUploadModalInPage(container));
    }

    const btnUploadOrgDoc = container.querySelector('#btn-upload-org-doc');
    if (btnUploadOrgDoc) {
      btnUploadOrgDoc.addEventListener('click', () => this.showUploadModalInPage(container));
      this.loadOrgDocuments().then(() => {
        const listContainer = container.querySelector('#org-documents-list');
        if (listContainer) {
          listContainer.innerHTML = this.renderOrgDocuments();
          this.attachOrgDocumentListenersToContainer(container);
        }
      });
    }

    this.attachOrgDocumentListenersToContainer(container);
  }

  /**
   * Adjunta listeners de documentos a un contenedor
   */
  attachOrgDocumentListenersToContainer(container) {
    container.querySelectorAll('.btn-view-org-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = btn.dataset.docId;
        this.viewOrgDocument(docId);
      });
    });
    container.querySelectorAll('.btn-download-org-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = btn.dataset.docId;
        this.downloadOrgDocument(docId);
      });
    });
    container.querySelectorAll('.btn-delete-org-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = btn.dataset.docId;
        this.deleteOrgDocumentInPage(docId, container);
      });
    });
  }

  /**
   * Refresca el contenido en un contenedor de página
   */
  refreshContentInContainer(container, tabName) {
    if (!container) return;
    this.currentTab = tabName;
    container.innerHTML = this.renderTabContent();
    this.attachContentListenersToContainer(container);
  }

  // Métodos wrapper para modales en páginas (añaden modal a document.body)
  openAddMemberModalInPage(container) {
    this.openAddMemberModal({ querySelector: () => null, querySelectorAll: () => [] });
    // Reemplazar el callback de refresh
    this._pendingRefreshContainer = container;
  }

  openNewAssemblyModalInPage(container) {
    this.openNewAssemblyModal({ querySelector: () => null, querySelectorAll: () => [] });
    this._pendingRefreshContainer = container;
  }

  openNewProjectModalInPage(container) {
    this.openNewProjectModal({ querySelector: () => null, querySelectorAll: () => [] });
    this._pendingRefreshContainer = container;
  }

  openNewActivityModalInPage(container) {
    this.openNewActivityModal({ querySelector: () => null, querySelectorAll: () => [] });
    this._pendingRefreshContainer = container;
  }

  openNewTransactionModalInPage(container) {
    this.openNewTransactionModal({ querySelector: () => null, querySelectorAll: () => [] });
    this._pendingRefreshContainer = container;
  }

  openEditDirectorioModalInPage(container) {
    this.openEditDirectorioModal({ querySelector: () => null, querySelectorAll: () => [] });
    this._pendingRefreshContainer = container;
  }

  openNewElectionModalInPage(container) {
    this.openNewElectionModal({ querySelector: () => null, querySelectorAll: () => [] });
    this._pendingRefreshContainer = container;
  }

  openNewCommunicationModalInPage(container) {
    this.openNewCommunicationModal({ querySelector: () => null, querySelectorAll: () => [] });
    this._pendingRefreshContainer = container;
  }

  openEditMemberModalInPage(rut, container) {
    this.openEditMemberModal(rut, { querySelector: () => null, querySelectorAll: () => [] });
    this._pendingRefreshContainer = container;
  }

  showUploadModalInPage(container) {
    this.showUploadModal({ querySelector: () => null, querySelectorAll: () => [] });
    this._pendingRefreshContainer = container;
  }

  handleAlertActionInPage(alertType, container) {
    // Disparar evento para que OrganizationMenuManager maneje
    window.dispatchEvent(new CustomEvent('org-alert-action', { detail: { alertType } }));
  }

  deleteMemberInPage(rut, container) {
    this.deleteMember(rut, { querySelector: () => null, querySelectorAll: () => [] });
    setTimeout(() => this.refreshContentInContainer(container, this.currentTab), 500);
  }

  deleteItemInPage(type, id, label, container) {
    this.deleteItem(type, id, label, { querySelector: () => null, querySelectorAll: () => [] });
    setTimeout(() => this.refreshContentInContainer(container, this.currentTab), 500);
  }

  deleteTransactionInPage(id, container) {
    this.deleteTransaction(id, { querySelector: () => null, querySelectorAll: () => [] });
    setTimeout(() => this.refreshContentInContainer(container, this.currentTab), 500);
  }

  deleteOrgDocumentInPage(docId, container) {
    this.deleteOrgDocument(docId, { querySelector: () => null, querySelectorAll: () => [] });
    setTimeout(() => this.refreshContentInContainer(container, this.currentTab), 500);
  }

  showAssemblyDetailInPage(id, container) {
    this.showAssemblyDetail(id, document.body);
  }

  showProjectDetailInPage(id, container) {
    this.showProjectDetail(id, document.body);
  }

  showCommunicationDetailInPage(id, container) {
    this.showCommunicationDetail(id, document.body);
  }

  showElectionDetailInPage(id, container) {
    this.showElectionDetail(id, document.body);
  }

  showActivityDetailInPage(id, container) {
    this.showActivityDetail(id, document.body);
  }

  showAnnualBalanceInPage(container) {
    this.showAnnualBalance(document.body);
  }
}

// Instancia singleton
export const organizationDashboard = new OrganizationDashboard();
