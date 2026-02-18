/**
 * Dashboard de Administrador
 * Gestión de solicitudes de organizaciones comunitarias
 */

import { organizationsService, ORG_STATUS, ORG_STATUS_LABELS, ORG_STATUS_COLORS } from '../../services/OrganizationsService.js';
import { apiService } from '../../services/ApiService.js';
import { alertsService } from '../../services/AlertsService.js';
import { showToast } from '../../app.js';
import { initScheduleManager } from './ScheduleManager.js';
import { initMinistroManager } from './MinistroManager.js';
import { initUnidadesVecinalesManager } from './UnidadesVecinalesManager.js';
import { initEstatutosAdminManager } from './EstatutosAdminManager.js';
import { initMetricsDashboardManager } from './MetricsDashboardManager.js';
import { initAuditLogManager } from './AuditLogManager.js';
import { initUserManager } from './UserManager.js';
import { initCalendarManager } from './CalendarManager.js';
import { initSearchGlobalManager } from './SearchGlobalManager.js';
import { initExportManager } from './ExportManager.js';
import { ministroService } from '../../services/MinistroService.js';
import { ministroAssignmentService } from '../../services/MinistroAssignmentService.js';
import { ministroAvailabilityService } from '../../services/MinistroAvailabilityService.js';
import { scheduleService } from '../../services/ScheduleService.js';
import { pdfService } from '../../services/PDFService.js';
import JSZip from 'jszip';

// Importar utilidades compartidas
import {
  formatDate,
  getOrgName,
  getOrgType as getOrgTypeFromUtils,
  getOrgAddress,
  getOrgComuna,
  getOrgIcon
} from '../../shared/utils/index.js';

// SEGURIDAD: Importar funciones de sanitización para prevenir XSS
import { escapeHtml, sanitizeText } from '../../shared/utils/sanitize.js';

// Wrapper para compatibilidad - formatDateSafe usa formatDate
const formatDateSafe = (dateStr) => formatDate(dateStr, { fallback: '-' });

// Wrapper para getOrgType que soporta formato legacy
const getOrgType = (org) => {
  if (typeof org === 'string') return org;
  return org?.organizationType || org?.organization?.type || org?.type;
};

// Usar getOrgType de utils para nombre legible
const getOrgTypeName = getOrgTypeFromUtils;

class AdminDashboard {
  constructor() {
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.currentView = 'applications'; // 'applications', 'schedule', 'ministro', 'uv'
    this.scheduleManager = null;
    this.ministroManager = null;
    this.uvManager = null;
    this.estatutosManager = null;
    this.metricsManager = null;
    this.auditLogManager = null;
    this.userManager = null;
    this.calendarManager = null;
    this.exportManager = null;
  }

  /**
   * Inicializa el dashboard de administrador
   */
  async init() {
    // Cargar datos del servidor
    await Promise.all([
      this.loadOrganizations(),
      this.loadMinistros()
    ]);
    this.renderApplicationsList();
    this.updateStats();
    this.setupEventListeners();
    this.exportManager = initExportManager();
    this.initSearchGlobal();
  }

  // ============ VIEW DISPATCH ============

  /**
   * Dispatch central para cambiar vistas desde el sidebar
   */
  showView(viewName) {
    // Grouped org filters
    const orgFilterMap = {
      'org-all': 'all',
      'org-pending': 'pending_review',
      'org-process': 'in_process',
      'org-approved': 'approved_group',
      'org-rejected': 'rejected'
    };

    if (orgFilterMap[viewName] !== undefined) {
      this.currentFilter = orgFilterMap[viewName];
      // Update clean filter chips active state
      document.querySelectorAll('.muni-filter-chip-clean').forEach(c => c.classList.remove('active'));
      const matchingChip = document.querySelector(`.muni-filter-chip-clean[data-filter="${orgFilterMap[viewName]}"]`);
      if (matchingChip) matchingChip.classList.add('active');
      else {
        // For grouped filters not in chips, deactivate all
      }
      this.showApplications(true); // skip reload for filter-only
      sessionStorage.setItem('admin_current_view', viewName);
      return;
    }

    const viewMap = {
      'applications': () => this.showApplications(),
      'schedule': () => this.showScheduleManager(),
      'ministro': () => this.showMinistroManager(),
      'uv': () => this.showUVManager(),
      'estatutos': () => this.showEstatutosManager(),
      'timbre': () => this.showTimbreModal(),
      'documentos': () => this.showDocumentosModal(),
      'metrics': () => this.showMetricsManager(),
      'audit': () => this.showAuditLog(),
      'users': () => this.showUserManager(),
      'calendar': () => this.showCalendarManager(),
      'export': () => {
        if (this.exportManager && this.organizations) {
          this.exportManager.exportOrganizationsCSV(this.organizations);
          showToast('Exportacion iniciada', 'success');
        }
      }
    };

    const handler = viewMap[viewName];
    if (handler) {
      handler();
      // Persistir vista actual para restaurar al recargar
      sessionStorage.setItem('admin_current_view', viewName);
    }
  }

  // ============ DRY HELPERS ============

  /**
   * Oculta los elementos de la vista de solicitudes
   */
  hideApplicationElements() {
    const toolbar = document.querySelector('.admin-toolbar');
    if (toolbar) toolbar.style.display = 'none';
    const filterBar = document.querySelector('.muni-filters-clean');
    if (filterBar) filterBar.style.display = 'none';
    const appList = document.getElementById('admin-applications-list');
    if (appList) appList.style.display = 'none';
  }

  /**
   * Muestra los elementos de la vista de solicitudes
   */
  showApplicationElements() {
    const toolbar = document.querySelector('.admin-toolbar');
    if (toolbar) toolbar.style.display = '';
    const filterBar = document.querySelector('.muni-filters-clean');
    if (filterBar) filterBar.style.display = '';
    const appList = document.getElementById('admin-applications-list');
    if (appList) appList.style.display = '';
  }

  /**
   * Oculta todos los containers de managers
   */
  hideAllManagerViews() {
    ['schedule-manager-view', 'ministro-manager-view', 'uv-manager-view',
     'metrics-manager-view', 'audit-log-view', 'user-manager-view',
     'calendar-manager-view'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    // Restaurar ancho normal del dashboard
    const dashboard = document.querySelector('.admin-dashboard');
    if (dashboard) dashboard.classList.remove('admin-wide-view');
  }

  /**
   * Actualiza los badges del sidebar con conteos
   */
  updateSidebarBadges() {
    const orgs = organizationsService.getAll();
    const counts = { all: orgs.length, pending: 0, process: 0, approved: 0, rejected: 0 };
    orgs.forEach(o => {
      if (o.status === ORG_STATUS.PENDING_REVIEW) counts.pending++;
      else if ([ORG_STATUS.WAITING_MINISTRO_REQUEST, ORG_STATUS.MINISTRO_SCHEDULED,
                ORG_STATUS.MINISTRO_APPROVED, ORG_STATUS.IN_REVIEW,
                ORG_STATUS.SENT_TO_REGISTRY, ORG_STATUS.REGISTRY_OBSERVATIONS].includes(o.status)) counts.process++;
      else if (o.status === ORG_STATUS.APPROVED) counts.approved++;
      else if (o.status === ORG_STATUS.REJECTED) counts.rejected++;
    });

    const badgeMap = {
      'badge-org-all': counts.all,
      'badge-org-pending': counts.pending,
      'badge-org-process': counts.process,
      'badge-org-approved': counts.approved,
      'badge-org-rejected': counts.rejected
    };
    Object.entries(badgeMap).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  }

  /**
   * Actualiza el item activo del sidebar
   */
  updateSidebarActive(viewName) {
    document.querySelectorAll('.nav-link-sub').forEach(link => {
      link.classList.toggle('active', link.dataset.adminView === viewName);
    });
    // Also handle top-level nav-link for panel
    document.querySelectorAll('.nav-link[data-admin-view]').forEach(link => {
      link.classList.toggle('active', link.dataset.adminView === viewName);
    });
  }

  /**
   * Carga los ministros desde el servidor
   */
  async loadMinistros() {
    try {
      console.log('🔄 Cargando ministros del servidor...');
      await ministroService.loadFromServer();
      console.log('✅ Ministros cargados:', ministroService.getAll().length);
    } catch (e) {
      console.error('❌ Error cargando ministros:', e);
    }
  }

  /**
   * Carga las organizaciones desde el servidor
   */
  async loadOrganizations() {
    try {
      console.log('🔄 Cargando organizaciones del servidor...');
      this.organizations = await organizationsService.getAllAsync();
      console.log('✅ Organizaciones cargadas:', this.organizations?.length);
    } catch (e) {
      console.error('❌ Error cargando organizaciones:', e);
      this.organizations = [];
    }
  }

  // Button setup methods removed - sidebar handles navigation now

  /**
   * Muestra la página de gestión de estatutos
   */
  showEstatutosManager() {
    // Navegar a la página de estatutos
    if (typeof window.showPage === 'function') {
      window.showPage('page-estatutos-admin');
    } else {
      // Fallback: mostrar la página manualmente
      document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
      const page = document.getElementById('page-estatutos-admin');
      if (page) page.classList.add('active');
    }

    // Inicializar el manager de estatutos
    if (!this.estatutosManager) {
      this.estatutosManager = initEstatutosAdminManager();
    }
    if (this.estatutosManager) {
      this.estatutosManager.show();
    }
  }

  // setupTimbreManagerButton removed - sidebar handles navigation

  /**
   * Muestra el modal de gestión de timbre virtual y firma digital
   */
  async showTimbreModal() {
    // Primero obtener el timbre y firma actuales
    let timbreData = { timbreVirtual: null, firmaDigital: null };
    try {
      const response = await fetch(`${apiService.baseUrl}/users/me/timbre-firma`, {
        credentials: 'include'
      });
      if (response.ok) {
        timbreData = await response.json();
      }
    } catch (error) {
      console.error('Error al cargar timbre:', error);
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'timbre-modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header" style="background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); color: white; padding: 20px; border-radius: 16px 16px 0 0;">
          <h3 style="margin: 0; font-size: 18px; display: flex; align-items: center; gap: 10px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="6" width="20" height="12" rx="2"></rect>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            Timbre Virtual y Firma Digital
          </h3>
          <button class="modal-close-btn" style="position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px;">&times;</button>
        </div>

        <div class="modal-body" style="padding: 24px;">
          <p style="color: #6b7280; margin-bottom: 24px; font-size: 14px;">
            Configura tu timbre virtual y firma digital para usar en los certificados oficiales.
          </p>

          <!-- Sección Timbre Virtual -->
          <div class="timbre-section" style="margin-bottom: 32px; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e5e7eb;">
            <h4 style="margin: 0 0 16px; display: flex; align-items: center; gap: 8px; color: #1e40af;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Timbre Virtual (Sello Oficial)
            </h4>

            <div id="timbre-preview" style="margin-bottom: 16px;">
              ${timbreData.timbreVirtual?.imagen ? `
                <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #d1fae5;">
                  <img src="${timbreData.timbreVirtual.imagen}" alt="Timbre actual" style="max-width: 120px; max-height: 120px; border-radius: 8px; border: 2px solid #10b981;">
                  <div>
                    <p style="margin: 0 0 4px; color: #16a34a; font-weight: 600;">✓ Timbre configurado</p>
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">
                      Subido: ${timbreData.timbreVirtual.fechaSubida ? new Date(timbreData.timbreVirtual.fechaSubida).toLocaleDateString('es-CL') : 'N/A'}
                    </p>
                    <button class="btn-delete-timbre" style="margin-top: 8px; padding: 6px 12px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; font-size: 12px; cursor: pointer;">
                      Eliminar
                    </button>
                  </div>
                </div>
              ` : `
                <div style="padding: 24px; background: white; border-radius: 8px; border: 2px dashed #d1d5db; text-align: center;">
                  <p style="margin: 0 0 12px; color: #6b7280;">No hay timbre configurado</p>
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">Sube una imagen PNG o JPG de tu timbre oficial</p>
                </div>
              `}
            </div>

            <div style="display: flex; gap: 12px;">
              <label for="timbre-input" style="flex: 1; padding: 12px 16px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; border-radius: 8px; font-weight: 600; cursor: pointer; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
                Subir Timbre
              </label>
              <input type="file" id="timbre-input" accept="image/png,image/jpeg" style="display: none;">
            </div>
          </div>

          <!-- Sección Firma Digital -->
          <div class="firma-section" style="padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e5e7eb;">
            <h4 style="margin: 0 0 16px; display: flex; align-items: center; gap: 8px; color: #7c3aed;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 19.5v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8l6 6v11.5z"/>
                <path d="M12 18v-6"/>
                <path d="M9 15l3 3 3-3"/>
              </svg>
              Firma Digital
            </h4>

            <div id="firma-preview" style="margin-bottom: 16px;">
              ${timbreData.firmaDigital?.imagen ? `
                <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e9d5ff;">
                  <img src="${timbreData.firmaDigital.imagen}" alt="Firma actual" style="max-width: 150px; max-height: 80px; border-radius: 8px; border: 2px solid #8b5cf6;">
                  <div>
                    <p style="margin: 0 0 4px; color: #7c3aed; font-weight: 600;">✓ Firma configurada</p>
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">
                      Subida: ${timbreData.firmaDigital.fechaSubida ? new Date(timbreData.firmaDigital.fechaSubida).toLocaleDateString('es-CL') : 'N/A'}
                    </p>
                    <button class="btn-delete-firma" style="margin-top: 8px; padding: 6px 12px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; font-size: 12px; cursor: pointer;">
                      Eliminar
                    </button>
                  </div>
                </div>
              ` : `
                <div style="padding: 24px; background: white; border-radius: 8px; border: 2px dashed #d1d5db; text-align: center;">
                  <p style="margin: 0 0 12px; color: #6b7280;">No hay firma configurada</p>
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">Sube una imagen PNG o JPG de tu firma</p>
                </div>
              `}
            </div>

            <div style="display: flex; gap: 12px;">
              <label for="firma-input" style="flex: 1; padding: 12px 16px; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; border-radius: 8px; font-weight: 600; cursor: pointer; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
                Subir Firma
              </label>
              <input type="file" id="firma-input" accept="image/png,image/jpeg" style="display: none;">
            </div>
          </div>

          <!-- Info de uso -->
          <div style="margin-top: 24px; padding: 16px; background: #fef3c7; border-radius: 8px; border: 1px solid #fcd34d;">
            <p style="margin: 0; color: #92400e; font-size: 13px;">
              <strong>¿Cómo se usan?</strong><br>
              El timbre y la firma se aplicarán automáticamente a los certificados oficiales cuando apruebes el envío a Registro Civil.
            </p>
          </div>
        </div>

        <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end;">
          <button class="btn-close-modal" style="padding: 10px 20px; background: #f3f4f6; color: #374151; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
            Cerrar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.modal-close-btn').addEventListener('click', () => modal.remove());
    modal.querySelector('.btn-close-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Subir timbre
    modal.querySelector('#timbre-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        showToast('La imagen es muy grande. Máximo 2MB.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const response = await fetch(`${apiService.baseUrl}/users/me/timbre-virtual`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imagen: event.target.result })
          });

          if (!response.ok) throw new Error('Error al subir');

          showToast('Timbre virtual guardado correctamente', 'success');
          modal.remove();
          this.showTimbreModal();
        } catch (error) {
          showToast('Error al guardar el timbre', 'error');
        }
      };
      reader.readAsDataURL(file);
    });

    // Subir firma
    modal.querySelector('#firma-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        showToast('La imagen es muy grande. Máximo 2MB.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const response = await fetch(`${apiService.baseUrl}/users/me/firma-digital`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imagen: event.target.result })
          });

          if (!response.ok) throw new Error('Error al subir');

          showToast('Firma digital guardada correctamente', 'success');
          modal.remove();
          this.showTimbreModal();
        } catch (error) {
          showToast('Error al guardar la firma', 'error');
        }
      };
      reader.readAsDataURL(file);
    });

    // Eliminar timbre
    modal.querySelector('.btn-delete-timbre')?.addEventListener('click', async () => {
      if (!confirm('¿Eliminar el timbre virtual?')) return;
      try {
        await fetch(`${apiService.baseUrl}/users/me/timbre-virtual`, {
          method: 'DELETE',
          credentials: 'include'
        });
        showToast('Timbre eliminado', 'success');
        modal.remove();
        this.showTimbreModal();
      } catch (error) {
        showToast('Error al eliminar', 'error');
      }
    });

    // Eliminar firma
    modal.querySelector('.btn-delete-firma')?.addEventListener('click', async () => {
      if (!confirm('¿Eliminar la firma digital?')) return;
      try {
        await fetch(`${apiService.baseUrl}/users/me/firma-digital`, {
          method: 'DELETE',
          credentials: 'include'
        });
        showToast('Firma eliminada', 'success');
        modal.remove();
        this.showTimbreModal();
      } catch (error) {
        showToast('Error al eliminar', 'error');
      }
    });
  }

  // setupDocumentosManagerButton removed - sidebar handles navigation

  /**
   * Muestra el modal de gestión de documentos/plantillas
   */
  showDocumentosModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'documentos-modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header" style="background: linear-gradient(135deg, #047857 0%, #10b981 100%); color: white; padding: 20px; border-radius: 16px 16px 0 0;">
          <h3 style="margin: 0; font-size: 18px; display: flex; align-items: center; gap: 10px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.342a2 2 0 0 0-.602-1.43l-4.44-4.342A2 2 0 0 0 13.56 2H6a2 2 0 0 0-2 2z"></path>
              <path d="M9 13h6"></path>
              <path d="M9 17h3"></path>
              <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
            </svg>
            Documentos Oficiales
          </h3>
          <button class="modal-close-btn" style="position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px;">&times;</button>
        </div>

        <div class="modal-body" style="padding: 24px;">
          <p style="color: #6b7280; margin-bottom: 24px; font-size: 14px;">
            Documentos y plantillas disponibles para las organizaciones. Estos documentos se generan automáticamente según el tipo de organización.
          </p>

          <div class="documentos-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">

            <!-- Estatutos -->
            <div class="documento-card" style="padding: 20px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0; cursor: pointer; transition: all 0.2s;" data-doc="estatutos">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="width: 44px; height: 44px; background: #10b981; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <div>
                  <h4 style="margin: 0; font-size: 15px; color: #065f46; font-weight: 600;">Estatutos</h4>
                  <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">Estatutos tipo por organización</p>
                </div>
              </div>
              <span style="font-size: 11px; color: #059669; background: #d1fae5; padding: 4px 8px; border-radius: 4px;">Configurar en Editor</span>
            </div>

            <!-- Acta de Constitución -->
            <div class="documento-card" style="padding: 20px; background: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe; cursor: pointer; transition: all 0.2s;" data-doc="acta">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="width: 44px; height: 44px; background: #2563eb; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                  </svg>
                </div>
                <div>
                  <h4 style="margin: 0; font-size: 15px; color: #1e40af; font-weight: 600;">Acta de Constitución</h4>
                  <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">Generada automáticamente</p>
                </div>
              </div>
              <span style="font-size: 11px; color: #1d4ed8; background: #dbeafe; padding: 4px 8px; border-radius: 4px;">Auto-generado</span>
            </div>

            <!-- Registro de Socios -->
            <div class="documento-card" style="padding: 20px; background: #fef3c7; border-radius: 12px; border: 1px solid #fde68a; cursor: pointer; transition: all 0.2s;" data-doc="registro">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="width: 44px; height: 44px; background: #f59e0b; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <div>
                  <h4 style="margin: 0; font-size: 15px; color: #92400e; font-weight: 600;">Registro de Socios</h4>
                  <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">Lista de miembros fundadores</p>
                </div>
              </div>
              <span style="font-size: 11px; color: #b45309; background: #fef3c7; padding: 4px 8px; border-radius: 4px;">Auto-generado</span>
            </div>

            <!-- Certificado de Vigencia -->
            <div class="documento-card" style="padding: 20px; background: #fdf4ff; border-radius: 12px; border: 1px solid #f5d0fe; cursor: pointer; transition: all 0.2s;" data-doc="vigencia">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="width: 44px; height: 44px; background: #a855f7; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <circle cx="12" cy="8" r="7"></circle>
                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                  </svg>
                </div>
                <div>
                  <h4 style="margin: 0; font-size: 15px; color: #7e22ce; font-weight: 600;">Cert. de Vigencia</h4>
                  <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">Certificado oficial</p>
                </div>
              </div>
              <span style="font-size: 11px; color: #9333ea; background: #f3e8ff; padding: 4px 8px; border-radius: 4px;">Con timbre digital</span>
            </div>

            <!-- Certificado de Directorio -->
            <div class="documento-card" style="padding: 20px; background: #fef2f2; border-radius: 12px; border: 1px solid #fecaca; cursor: pointer; transition: all 0.2s;" data-doc="directorio">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="width: 44px; height: 44px; background: #ef4444; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="20" y1="8" x2="20" y2="14"></line>
                    <line x1="23" y1="11" x2="17" y2="11"></line>
                  </svg>
                </div>
                <div>
                  <h4 style="margin: 0; font-size: 15px; color: #b91c1c; font-weight: 600;">Cert. de Directorio</h4>
                  <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">Miembros directiva</p>
                </div>
              </div>
              <span style="font-size: 11px; color: #dc2626; background: #fee2e2; padding: 4px 8px; border-radius: 4px;">Con timbre digital</span>
            </div>

            <!-- Comprobante de Solicitud -->
            <div class="documento-card" style="padding: 20px; background: #f0fdfa; border-radius: 12px; border: 1px solid #99f6e4; cursor: pointer; transition: all 0.2s;" data-doc="comprobante">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="width: 44px; height: 44px; background: #14b8a6; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                  </svg>
                </div>
                <div>
                  <h4 style="margin: 0; font-size: 15px; color: #0f766e; font-weight: 600;">Comprobante</h4>
                  <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">Solicitud de inscripción</p>
                </div>
              </div>
              <span style="font-size: 11px; color: #0d9488; background: #ccfbf1; padding: 4px 8px; border-radius: 4px;">Auto-generado</span>
            </div>

          </div>

          <div style="margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
            <h5 style="margin: 0 0 8px; color: #475569; font-size: 13px; font-weight: 600;">ℹ️ Información</h5>
            <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.6;">
              Los documentos se generan automáticamente según los datos de cada organización.
              Para modificar las plantillas de estatutos por tipo de organización,
              utiliza el <strong>Editor de Estatutos</strong> disponible en el panel de administración.
            </p>
          </div>
        </div>

        <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end;">
          <button class="btn-close-modal" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer;">
            Cerrar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Cerrar modal
    const closeBtn = modal.querySelector('.modal-close-btn');
    const closeFooterBtn = modal.querySelector('.btn-close-modal');

    const closeModal = () => modal.remove();

    closeBtn.addEventListener('click', closeModal);
    closeFooterBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Hover effects para las tarjetas
    const cards = modal.querySelectorAll('.documento-card');
    cards.forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
      });

      // Click en tarjeta de estatutos abre el editor
      card.addEventListener('click', () => {
        const docType = card.dataset.doc;
        if (docType === 'estatutos') {
          modal.remove();
          this.showEstatutosManager();
        }
      });
    });
  }

  // ============ MANAGERS ============

  showMetricsManager() {
    this.hideApplicationElements();
    this.hideAllManagerViews();

    let metricsView = document.getElementById('metrics-manager-view');
    if (!metricsView) {
      metricsView = document.createElement('div');
      metricsView.id = 'metrics-manager-view';
      metricsView.style.cssText = 'padding: 20px;';
      document.querySelector('.admin-dashboard').appendChild(metricsView);
    }
    metricsView.style.display = 'block';

    if (!this.metricsManager) {
      this.metricsManager = initMetricsDashboardManager(metricsView);
    } else {
      this.metricsManager.render();
    }
    this.currentView = 'metrics';
    this.updateSidebarActive('metrics');
  }

  showAuditLog() {
    this.hideApplicationElements();
    this.hideAllManagerViews();

    let auditView = document.getElementById('audit-log-view');
    if (!auditView) {
      auditView = document.createElement('div');
      auditView.id = 'audit-log-view';
      auditView.style.cssText = 'padding: 20px;';
      document.querySelector('.admin-dashboard').appendChild(auditView);
    }
    auditView.style.display = 'block';

    if (!this.auditLogManager) {
      this.auditLogManager = initAuditLogManager(auditView);
    } else {
      this.auditLogManager.render();
    }
    this.currentView = 'audit';
    this.updateSidebarActive('audit');
  }

  showUserManager() {
    this.hideApplicationElements();
    this.hideAllManagerViews();

    let userView = document.getElementById('user-manager-view');
    if (!userView) {
      userView = document.createElement('div');
      userView.id = 'user-manager-view';
      userView.style.cssText = 'padding: 20px;';
      document.querySelector('.admin-dashboard').appendChild(userView);
    }
    userView.style.display = 'block';

    if (!this.userManager) {
      this.userManager = initUserManager(userView);
    } else {
      this.userManager.render();
    }
    this.currentView = 'users';
    this.updateSidebarActive('users');
  }

  showCalendarManager() {
    this.hideApplicationElements();
    this.hideAllManagerViews();

    let calView = document.getElementById('calendar-manager-view');
    if (!calView) {
      calView = document.createElement('div');
      calView.id = 'calendar-manager-view';
      calView.style.cssText = 'padding: 20px;';
      document.querySelector('.admin-dashboard').appendChild(calView);
    }
    calView.style.display = 'block';

    if (!this.calendarManager) {
      this.calendarManager = initCalendarManager(calView);
    } else {
      this.calendarManager.render();
    }
    this.currentView = 'calendar';
    this.updateSidebarActive('calendar');
  }

  initSearchGlobal() {
    try {
      this.searchGlobal = initSearchGlobalManager();
    } catch (e) {
      console.warn('SearchGlobalManager init error:', e);
    }
  }

  /**
   * Muestra la vista de gestión de horarios
   */
  async showScheduleManager() {
    this.currentView = 'schedule';
    this.hideApplicationElements();
    this.hideAllManagerViews();

    // El schedule manager necesita más ancho por su layout de 2 columnas
    const dashboard = document.querySelector('.admin-dashboard');
    if (dashboard) dashboard.classList.add('admin-wide-view');

    const scheduleView = document.getElementById('schedule-manager-view');
    scheduleView.style.display = 'block';

    if (!this.scheduleManager) {
      this.scheduleManager = await initScheduleManager(scheduleView);
    }
    this.updateSidebarActive('schedule');
  }

  /**
   * Muestra la vista de gestión de ministros
   */
  showMinistroManager() {
    this.currentView = 'ministro';
    this.hideApplicationElements();
    this.hideAllManagerViews();

    const ministroView = document.getElementById('ministro-manager-view');
    ministroView.style.display = 'block';

    if (!this.ministroManager) {
      this.ministroManager = initMinistroManager(ministroView);
    }
    this.updateSidebarActive('ministro');
  }

  /**
   * Muestra la vista de gestión de unidades vecinales
   */
  showUVManager() {
    this.currentView = 'uv';
    this.hideApplicationElements();
    this.hideAllManagerViews();

    const uvView = document.getElementById('uv-manager-view');
    uvView.style.display = 'block';

    if (!this.uvManager) {
      this.uvManager = initUnidadesVecinalesManager(uvView);
    }
    this.updateSidebarActive('uv');
  }

  /**
   * Muestra la vista de solicitudes
   */
  async showApplications(skipReload = false) {
    this.currentView = 'applications';

    if (!skipReload) {
      await this.loadOrganizations();
    }

    this.hideAllManagerViews();
    this.showApplicationElements();

    this.renderApplicationsList();
    this.updateStats();
    this.updateSidebarActive('applications');
  }

  /**
   * Configura los event listeners
   */
  setupEventListeners() {
    // Filtros limpios
    document.querySelectorAll('.muni-filter-chip-clean').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const target = e.target.closest('.muni-filter-chip-clean');
        if (!target) return;
        document.querySelectorAll('.muni-filter-chip-clean').forEach(c => c.classList.remove('active'));
        target.classList.add('active');
        this.currentFilter = target.dataset.filter;
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

    // Escuchar evento del ScheduleManager para navegar a una org
    window.addEventListener('admin-open-org-review', (e) => {
      const { orgId } = e.detail;
      if (orgId) {
        // Cambiar a vista de organizaciones y abrir el modal
        this.showApplications(true).then(() => {
          this.openReviewModal(orgId);
        });
      }
    });
  }

  /**
   * Actualiza las estadísticas
   */
  updateStats() {
    const orgs = organizationsService.getAll();
    this.organizations = orgs;

    const counts = {
      pending: 0,
      ministro: 0,
      review: 0,
      registry: 0,
      approved: 0,
      process: 0
    };

    orgs.forEach(o => {
      if (o.status === ORG_STATUS.PENDING_REVIEW) counts.pending++;
      else if (o.status === ORG_STATUS.WAITING_MINISTRO_REQUEST || o.status === ORG_STATUS.MINISTRO_SCHEDULED) { counts.ministro++; counts.process++; }
      else if (o.status === ORG_STATUS.IN_REVIEW) { counts.review++; counts.process++; }
      else if (o.status === ORG_STATUS.SENT_TO_REGISTRY) { counts.registry++; counts.process++; }
      else if (o.status === ORG_STATUS.MINISTRO_APPROVED) counts.process++;
      else if (o.status === ORG_STATUS.REGISTRY_OBSERVATIONS) counts.process++;
      else if (o.status === ORG_STATUS.APPROVED) counts.approved++;
    });

    // Filter chip counters
    const pendingEl = document.getElementById('admin-pending-count');
    const ministroEl = document.getElementById('admin-ministro-count');
    const reviewEl = document.getElementById('admin-review-count');
    const registryEl = document.getElementById('admin-registry-count');
    const approvedEl = document.getElementById('admin-approved-count');

    if (pendingEl) pendingEl.textContent = counts.pending;
    if (ministroEl) ministroEl.textContent = counts.ministro;
    if (reviewEl) reviewEl.textContent = counts.review;
    if (registryEl) registryEl.textContent = counts.registry;
    if (approvedEl) approvedEl.textContent = counts.approved;

    // Toolbar total count
    const statTotal = document.getElementById('stat-total');
    if (statTotal) statTotal.textContent = orgs.length;

    // Sidebar badges
    this.updateSidebarBadges();
  }

  /**
   * Filtra las organizaciones
   */
  getFilteredOrganizations() {
    let orgs = organizationsService.getAll();
    this.organizations = orgs;

    // Filtrar por estado (con soporte para filtros agrupados)
    if (this.currentFilter !== 'all') {
      if (this.currentFilter === 'in_process') {
        // Grupo "en proceso": todos los estados intermedios
        const processStatuses = [
          ORG_STATUS.WAITING_MINISTRO_REQUEST, ORG_STATUS.MINISTRO_SCHEDULED,
          ORG_STATUS.MINISTRO_APPROVED, ORG_STATUS.IN_REVIEW,
          ORG_STATUS.SENT_TO_REGISTRY, ORG_STATUS.REGISTRY_OBSERVATIONS
        ];
        orgs = orgs.filter(o => processStatuses.includes(o.status));
      } else if (this.currentFilter === 'approved_group') {
        orgs = orgs.filter(o => o.status === ORG_STATUS.APPROVED);
      } else {
        orgs = orgs.filter(o => o.status === this.currentFilter);
      }
    }

    if (this.searchQuery) {
      orgs = orgs.filter(o =>
        getOrgName(o)?.toLowerCase().includes(this.searchQuery) ||
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

    // Usar _id o id para el identificador de MongoDB
    const orgId = org._id || org.id;

    // SEGURIDAD: Sanitizar datos de usuario para prevenir XSS
    const safeOrgId = escapeHtml(orgId || '');
    const safeOrgName = escapeHtml(getOrgName(org));

    // FASE 5: Verificar si es organización fantasma
    let ghostBadge = '';
    if (org.status === ORG_STATUS.APPROVED) {
      const ghostStatus = alertsService.isGhostOrganization(orgId);
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
      <div class="admin-app-row ${ghostBadge ? 'has-ghost-indicator' : ''}" data-org-id="${safeOrgId}">
        <div class="app-row-main">
          <div class="app-row-icon">${typeIcon}</div>
          <div class="app-row-info">
            <span class="app-row-name">${safeOrgName}</span>
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

    // SEGURIDAD: Sanitizar todos los datos de usuario para prevenir XSS
    const safeOrgName = escapeHtml(getOrgName(org));
    const safeCommune = escapeHtml(org.comuna || org.commune || 'Sin ubicación');
    const safeAddress = escapeHtml(org.address || '-');
    const safePhone = escapeHtml(org.contactPhone || '-');
    const safeEmail = escapeHtml(org.contactEmail || '-');
    const safeSchedule = escapeHtml(org.organization?.preferredSchedule || '');
    const safeDescription = escapeHtml(org.description || org.objectives || '');

    const modal = document.createElement('div');
    modal.className = 'admin-review-modal-overlay';
    modal.innerHTML = `
      <div class="admin-review-modal preview-modal">
        <div class="review-modal-header">
          <div class="review-header-left">
            <span class="review-type-badge">${typeIcon} ${typeName}</span>
            <h2>${safeOrgName}</h2>
            <div class="review-header-meta">
              <span>📍 ${safeCommune}</span>
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
                <span class="detail-value">${safeAddress}</span>
              </div>
              <div class="preview-detail-row">
                <span class="detail-label">Teléfono</span>
                <span class="detail-value">${safePhone}</span>
              </div>
              <div class="preview-detail-row">
                <span class="detail-label">Email</span>
                <span class="detail-value">${safeEmail}</span>
              </div>
              <div class="preview-detail-row">
                <span class="detail-label">Forma de Contacto Preferida</span>
                <span class="detail-value">${(org.organization?.contactPreference || org.contactPreference) === 'email' ? '📧 Email' : '📞 Teléfono'}</span>
              </div>
              ${safeSchedule ? `
                <div class="preview-detail-row full">
                  <span class="detail-label">Días y Horarios de Preferencia</span>
                  <span class="detail-value">${safeSchedule}</span>
                </div>
              ` : ''}
              ${safeDescription ? `
                <div class="preview-detail-row full">
                  <span class="detail-label">Objetivos</span>
                  <span class="detail-value">${safeDescription}</span>
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
                      <span class="name">${escapeHtml(m.firstName || '')} ${escapeHtml(m.lastName || '')}</span>
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
            <h2>${getOrgName(org)}</h2>
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
          ${(org.status === ORG_STATUS.MINISTRO_APPROVED || org.status === ORG_STATUS.SENT_TO_REGISTRY) ? `
            <button class="review-tab active" data-tab="registro-civil" style="background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); color: white; border: none;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              Registro Civil
            </button>
          ` : `
            <button class="review-tab active" data-tab="info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              Informacion
            </button>
          `}
          <button class="review-tab" data-tab="members">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Miembros
          </button>
          <button class="review-tab" data-tab="directorio-comision">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Directorio
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
          ${(org.status === ORG_STATUS.MINISTRO_APPROVED || org.status === ORG_STATUS.SENT_TO_REGISTRY) ? `
            <div class="review-tab-content active" id="tab-registro-civil">
              ${this.renderRegistroCivilTab(org)}
            </div>
          ` : `
            <div class="review-tab-content active" id="tab-info">
              ${this.renderInfoTab(org)}
            </div>
          `}
          <div class="review-tab-content" id="tab-members">
            ${this.renderMembersTab(org)}
          </div>
          <div class="review-tab-content" id="tab-directorio-comision">
            ${this.renderDirectorioComisionTab(org)}
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

      confirmModal.querySelector('.btn-confirm-reject').addEventListener('click', async () => {
        const generalComment = confirmModal.querySelector('#reject-general-observation')?.value.trim() || '';

        // Recolectar todas las correcciones con sus comentarios actualizados
        const corrections = {
          fields: { ...markedCorrections.fields },
          documents: { ...markedCorrections.documents },
          certificates: { ...markedCorrections.certificates },
          members: { ...markedCorrections.members },
          commission: { ...markedCorrections.commission }
        };

        const result = await organizationsService.rejectWithCorrections(org.id, corrections, generalComment);
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

    // Botón para enviar a Registro Civil (desde ministro_approved)
    modal.querySelector('.btn-send-to-registry')?.addEventListener('click', () => {
      this.openSendToRegistryModal(org, modal);
    });


    // Botones para navegar a secciones de documentos
    modal.querySelectorAll('.btn-goto-docs-section').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        // Cambiar a la pestaña de Documentos
        const docsTab = modal.querySelector('.review-tab[data-tab="documents"]');
        if (docsTab) {
          docsTab.click();
          // Esperar a que se renderice y hacer scroll a la sección
          setTimeout(() => {
            let targetElement = null;
            if (section === 'oficiales') {
              targetElement = modal.querySelector('.docs-subtitle');
            } else if (section === 'declaraciones') {
              targetElement = modal.querySelector('h4.docs-subtitle:nth-of-type(2)') ||
                              [...modal.querySelectorAll('.docs-subtitle')].find(el => el.textContent.includes('Declaraciones'));
            } else if (section === 'certificados') {
              targetElement = [...modal.querySelectorAll('.docs-subtitle')].find(el => el.textContent.includes('Certificados'));
            }
            if (targetElement) {
              targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              targetElement.style.background = '#fef3c7';
              setTimeout(() => { targetElement.style.background = ''; }, 2000);
            }
          }, 100);
        }
      });
    });

    // Botón para descargar carpeta de Registro Civil
    modal.querySelector('.btn-download-registry-package')?.addEventListener('click', () => {
      this.downloadRegistryPackage(org);
    });

    // Botón para confirmar Registro Civil (desde tab de Registro Civil)
    modal.querySelector('.btn-confirm-registry-tab')?.addEventListener('click', () => {
      this.openConfirmRegistryModal(org, modal);
    });

    // Botón para agregar observaciones del Registro Civil (desde tab de Registro Civil)
    modal.querySelector('.btn-registry-observations-tab')?.addEventListener('click', () => {
      this.openRegistryObservationsModal(org, modal);
    });

    // Botón para confirmar Registro Civil (desde sent_registry)
    modal.querySelector('.btn-confirm-registry')?.addEventListener('click', () => {
      this.openConfirmRegistryModal(org, modal);
    });

    // FASE 5: Botón de disolución
    modal.querySelector('.btn-dissolve-org')?.addEventListener('click', () => {
      this.openDissolveModal(org, modal);
    });

    // Botón para agregar observaciones del Registro Civil
    modal.querySelector('.btn-registry-observations')?.addEventListener('click', () => {
      this.openRegistryObservationsModal(org, modal);
    });

    // Botón para reenviar al Registro Civil después de corregir observaciones
    modal.querySelector('.btn-resend-registry')?.addEventListener('click', () => {
      this.openSendToRegistryModal(org, modal);
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
        const certKey = btn.dataset.certKey;
        const memberId = btn.dataset.memberId;
        this.viewCertificate(org, certKey || memberId);
      });
    });

    // Event listeners para subir certificados
    modal.querySelectorAll('.btn-upload-cert-admin').forEach(btn => {
      btn.addEventListener('click', () => {
        const memberId = btn.dataset.memberId;
        const fileInput = modal.querySelector(`.cert-file-input[data-member-id="${memberId}"]`);
        if (fileInput) fileInput.click();
      });
    });

    modal.querySelectorAll('.cert-file-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
          const file = e.target.files[0];
          const memberId = e.target.dataset.memberId;
          const memberRut = e.target.dataset.memberRut;
          const memberName = e.target.dataset.memberName;
          await this.uploadCertificate(org, memberId, memberRut, memberName, file, modal);
        }
      });
    });
  }

  /**
   * Sube un certificado de antecedentes para un miembro
   */
  async uploadCertificate(org, memberId, memberRut, memberName, file, modal) {
    // Validar que sea PDF
    if (file.type !== 'application/pdf') {
      showToast('Solo se permiten archivos PDF', 'error');
      return;
    }

    // Validar tamaño (máx 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('El archivo no debe superar 5MB', 'error');
      return;
    }

    try {
      // Mostrar loading en el botón
      const uploadBtn = modal.querySelector(`.btn-upload-cert-admin[data-member-id="${memberId}"]`);
      if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
          </svg>
          Subiendo...
        `;
      }

      // Leer archivo como base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Preparar estructura de certificados
      const certificates = org.certificates || {};
      certificates[memberId] = {
        file: base64,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        memberName: memberName,
        memberRut: memberRut
      };

      // Actualizar organización en la base de datos
      await organizationsService.updateOrganization(org.id, { certificates });

      // Actualizar el objeto org local
      org.certificates = certificates;

      showToast(`Certificado de ${memberName} subido correctamente`, 'success');

      // Refrescar la tabla del modal
      this.refreshDirectorioTable(org, modal);

    } catch (error) {
      console.error('Error al subir certificado:', error);
      showToast('Error al subir el certificado', 'error');

      // Restaurar botón
      const uploadBtn = modal.querySelector(`.btn-upload-cert-admin[data-member-id="${memberId}"]`);
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Subir
        `;
      }
    }
  }

  /**
   * Refresca la tabla del Directorio después de subir un certificado
   */
  refreshDirectorioTable(org, modal) {
    const directorioContent = modal.querySelector('#tab-directorio-comision');
    if (directorioContent) {
      // Regenerar contenido del tab Directorio
      directorioContent.innerHTML = this.renderDirectorioComisionTab(org);

      // Volver a añadir event listeners
      this.addDirectorioEventListeners(org, modal);
    }
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
  viewCertificate(org, keyOrMemberId) {
    const certificates = org.certificates || {};
    const certificatesStep5 = org.certificatesStep5 || {};

    // Helper para normalizar RUT
    const normalizeRut = (rut) => {
      if (!rut) return '';
      return String(rut).replace(/\./g, '').replace(/-/g, '').toLowerCase().trim();
    };

    // Buscar certificado por múltiples métodos
    // Primero buscar en certificatesStep5 (presidente, secretario, tesorero, comision1, comision2, comision3)
    let cert = certificatesStep5[keyOrMemberId];

    // Si no, buscar en certificates tradicional
    if (!cert) {
      cert = certificates[keyOrMemberId];
    }

    // Si no se encuentra por ID, buscar por RUT en la comisión
    if (!cert) {
      const commissionMembers = org.commission?.members || [];
      const comisionElectoral = org.comisionElectoral || [];
      const directorio = org.provisionalDirectorio || org.directorio || {};
      const allMembers = [
        ...commissionMembers,
        ...comisionElectoral,
        directorio.president,
        directorio.secretary,
        directorio.treasurer,
        ...(directorio.additionalMembers || [])
      ].filter(Boolean);

      // Buscar el miembro que tenga este ID
      const memberWithId = allMembers.find(m => m.id === memberId || m._id === memberId);

      if (memberWithId?.rut) {
        const memberRutNorm = normalizeRut(memberWithId.rut);
        // Buscar certificado por RUT
        for (const [key, c] of Object.entries(certificates)) {
          const certRutNorm = normalizeRut(c.memberRut || c.rut);
          if (certRutNorm === memberRutNorm) {
            cert = c;
            break;
          }
        }
        // También buscar en org.commission.members para encontrar el ID original
        if (!cert) {
          for (const cm of commissionMembers) {
            if (normalizeRut(cm.rut) === memberRutNorm) {
              cert = certificates[cm.id] || certificates[cm._id];
              if (cert) break;
            }
          }
        }
      }
    }

    if (!cert) {
      showToast('Certificado no disponible', 'error');
      return;
    }

    // Buscar nombre del miembro segun el key
    let memberName = 'Miembro';
    const roleLabels = { presidente: 'Presidente', secretario: 'Secretario', tesorero: 'Tesorero', comision1: 'Comision Electoral 1', comision2: 'Comision Electoral 2', comision3: 'Comision Electoral 3' };
    if (roleLabels[keyOrMemberId]) {
      memberName = roleLabels[keyOrMemberId];
    } else {
      const member = org.commission?.members?.find(m => m.id === keyOrMemberId) ||
                     org.comisionElectoral?.find(m => m.id === keyOrMemberId);
      if (member) memberName = member.name || `${member.firstName} ${member.lastName}`;
    }

    // Normalizar formato del certificado (certificatesStep5 usa base64/type, anterior usa data)
    const certData = cert.data || (cert.base64 ? `data:${cert.type || 'application/pdf'};base64,${cert.base64}` : null);
    const certFileName = cert.fileName || cert.name || 'certificado';

    // Determinar si es PDF o imagen
    const isPDF = certData && (certData.startsWith('data:application/pdf') || (cert.type && cert.type.includes('pdf')));
    const isImage = certData && (certData.startsWith('data:image/') || (cert.type && cert.type.startsWith('image/')));

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
            <iframe src="${certData}" class="certificate-pdf-viewer" title="Certificado de ${memberName}"></iframe>
          ` : isImage ? `
            <img src="${certData}" alt="Certificado de ${memberName}" class="certificate-image">
          ` : certFileName ? `
            <div class="certificate-file-info">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span class="cert-filename">${certFileName}</span>
              <span class="cert-upload-date">Subido: ${cert.uploadedAt ? new Date(cert.uploadedAt).toLocaleDateString('es-CL') : 'N/A'}</span>
              ${certData ? `
                <a href="${certData}" download="${certFileName}" class="btn-download-cert">
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
          ${certData ? `
            <a href="${certData}" download="${certFileName || 'certificado.pdf'}" class="btn-download-cert-footer">
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
        <title>${docNames[docType] || docType} - ${getOrgName(org) || 'Documento'}</title>
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
          <p>${getOrgName(org) || ''}</p>
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
    // Buscar datos de organización en múltiples ubicaciones
    const orgData = org.organization || {};
    const o = {
      type: orgData.type || orgData.organizationType || org.type || org.organizationType,
      name: orgData.name || orgData.organizationName || org.name || org.organizationName,
      address: orgData.address || org.address,
      region: orgData.region || org.region,
      commune: orgData.commune || org.commune,
      neighborhood: orgData.neighborhood || orgData.unidadVecinal || org.neighborhood || org.unidadVecinal,
      email: orgData.email || org.email,
      phone: orgData.phone || org.phone,
      description: orgData.description || orgData.objectives || org.description || org.objectives
    };
    const isReviewable = canReview && org.status === ORG_STATUS.IN_REVIEW;
    const hasMinistroApproval = org.status === ORG_STATUS.MINISTRO_APPROVED ||
                                org.provisionalDirectorio ||
                                org.comisionElectoral;
    const members = org.members || [];
    const attendees = org.attendees || [];

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

    const renderStaticField = (label, value, icon = '') => {
      if (!value) return '';
      return `
        <div class="review-field" style="border-left: 3px solid #e5e7eb;">
          <div class="field-content" style="display: flex; align-items: center; gap: 8px;">
            ${icon ? `<span style="font-size: 16px;">${icon}</span>` : ''}
            <div>
              <label>${label}</label>
              <span>${value}</span>
            </div>
          </div>
        </div>
      `;
    };

    // Formatear fecha de asamblea si existe
    const formatAssemblyDate = () => {
      const date = org.assemblyDate || org.scheduledDate;
      if (!date) return null;
      try {
        const d = new Date(date);
        return d.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      } catch (e) {
        return date;
      }
    };

    const assemblyDate = formatAssemblyDate();

    return `
      <div class="review-section">
        <table class="members-table">
          <tbody>
            <tr>
              <td style="width: 140px;"><strong>Tipo</strong></td>
              <td>${getOrgTypeName(o.type) || '-'}</td>
            </tr>
            <tr>
              <td><strong>Nombre</strong></td>
              <td>${o.name || '-'}</td>
            </tr>
            <tr>
              <td><strong>Dirección</strong></td>
              <td>${o.address || '-'}</td>
            </tr>
            <tr>
              <td><strong>Comuna</strong></td>
              <td>${o.commune || '-'}${o.region ? `, ${o.region}` : ''}</td>
            </tr>
            ${o.neighborhood ? `
            <tr>
              <td><strong>Unidad Vecinal</strong></td>
              <td>${o.neighborhood}</td>
            </tr>
            ` : ''}
            <tr>
              <td><strong>Email</strong></td>
              <td>${o.email || '-'}</td>
            </tr>
            <tr>
              <td><strong>Teléfono</strong></td>
              <td>${o.phone || '-'}</td>
            </tr>
            ${members.length > 0 ? `
            <tr>
              <td><strong>Socios Fundadores</strong></td>
              <td>${members.length} personas</td>
            </tr>
            ` : ''}
            ${attendees.length > 0 ? `
            <tr>
              <td><strong>Asistentes Asamblea</strong></td>
              <td>${attendees.length} personas</td>
            </tr>
            ` : ''}
            ${assemblyDate ? `
            <tr>
              <td><strong>Fecha Asamblea</strong></td>
              <td>${assemblyDate}</td>
            </tr>
            ` : ''}
            ${o.description ? `
            <tr>
              <td><strong>Objetivos</strong></td>
              <td style="white-space: pre-wrap;">${o.description}</td>
            </tr>
            ` : ''}
          </tbody>
        </table>
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
   * Renderiza el tab combinado de directorio y comisión en formato tabla compacto
   */
  renderDirectorioComisionTab(org) {
    const directorio = org.provisionalDirectorio || org.directorio || {};
    const comisionElectoral = org.comisionElectoral || [];
    const commission = org.commission || {};
    const certificates = org.certificates || {};
    const hasMinistroApproval = org.status === ORG_STATUS.MINISTRO_APPROVED ||
                                org.provisionalDirectorio ||
                                org.comisionElectoral;

    if (!hasMinistroApproval && !directorio.president && !comisionElectoral.length && !commission?.members?.length) {
      return `
        <div class="no-data" style="text-align: center; padding: 32px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" style="margin: 0 auto 12px;">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <p style="color: #6b7280; margin: 0;">El directorio y comisión serán asignados cuando el Ministro de Fe apruebe la asamblea constitutiva.</p>
        </div>
      `;
    }

    // Helper para normalizar RUT para comparación
    const normalizeRut = (rut) => {
      if (!rut) return '';
      return String(rut).replace(/\./g, '').replace(/-/g, '').toLowerCase().trim();
    };

    // Helper para obtener certificado por RUT o ID
    const getCertForMember = (member) => {
      if (!member) return null;

      // Buscar por ID directo
      if (member.id && certificates[member.id]) return certificates[member.id];
      if (member._id && certificates[member._id]) return certificates[member._id];

      // Buscar en org.commission.members para encontrar el ID original
      const commissionMembers = org.commission?.members || [];
      const memberRutNorm = normalizeRut(member.rut);

      for (const cm of commissionMembers) {
        const cmRutNorm = normalizeRut(cm.rut);
        if (cmRutNorm && cmRutNorm === memberRutNorm) {
          // Encontramos el miembro en la comisión, buscar su certificado por ID
          if (cm.id && certificates[cm.id]) return certificates[cm.id];
          if (cm._id && certificates[cm._id]) return certificates[cm._id];
        }
      }

      // Buscar por RUT normalizado en todas las claves y valores del objeto certificates
      for (const [key, cert] of Object.entries(certificates)) {
        // Comparar RUT del certificado con RUT del miembro
        const certRutNorm = normalizeRut(cert.memberRut || cert.rut);
        if (certRutNorm && certRutNorm === memberRutNorm) return cert;

        // También buscar si la clave contiene el RUT
        if (key.includes(memberRutNorm) || normalizeRut(key) === memberRutNorm) return cert;
      }

      return null;
    };

    // Construir filas del directorio con certificados
    const directorioRows = [];
    if (directorio.president) {
      const cert = getCertForMember(directorio.president);
      directorioRows.push({ cargo: 'Presidente(a)', nombre: directorio.president.name || '-', rut: directorio.president.rut || '-', cert, memberId: directorio.president.id || directorio.president._id });
    }
    if (directorio.secretary) {
      const cert = getCertForMember(directorio.secretary);
      directorioRows.push({ cargo: 'Secretario(a)', nombre: directorio.secretary.name || '-', rut: directorio.secretary.rut || '-', cert, memberId: directorio.secretary.id || directorio.secretary._id });
    }
    if (directorio.treasurer) {
      const cert = getCertForMember(directorio.treasurer);
      directorioRows.push({ cargo: 'Tesorero(a)', nombre: directorio.treasurer.name || '-', rut: directorio.treasurer.rut || '-', cert, memberId: directorio.treasurer.id || directorio.treasurer._id });
    }
    if (directorio.additionalMembers) {
      directorio.additionalMembers.forEach(m => {
        const cert = getCertForMember(m);
        directorioRows.push({ cargo: m.cargo || 'Director(a)', nombre: m.name || '-', rut: m.rut || '-', cert, memberId: m.id || m._id });
      });
    }

    // Construir filas de comisión con certificados
    const comisionRows = [];
    const roles = ['Presidente', 'Secretario', 'Vocal'];
    if (comisionElectoral.length > 0) {
      comisionElectoral.forEach((m, i) => {
        const cert = getCertForMember(m);
        comisionRows.push({
          cargo: roles[i] || 'Miembro',
          nombre: m.name || `${m.firstName || ''} ${m.lastName || ''}`.trim() || '-',
          rut: m.rut || '-',
          cert,
          memberId: m.id || m._id
        });
      });
    } else if (commission?.members?.length) {
      commission.members.forEach((m, i) => {
        const cert = getCertForMember(m);
        comisionRows.push({
          cargo: roles[i] || 'Miembro',
          nombre: `${m.firstName || ''} ${m.lastName || ''}`.trim() || '-',
          rut: m.rut || '-',
          cert,
          memberId: m.id || m._id
        });
      });
    }

    // En estado ministro_approved solo mostramos info, no opciones de carga
    const isReadOnly = org.status === ORG_STATUS.MINISTRO_APPROVED;

    const renderCertCell = (row) => {
      if (row.cert) {
        return `<button class="btn-view-cert-admin" data-member-id="${row.memberId}" style="background: #10b981; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          Ver
        </button>`;
      }
      // En modo solo lectura (ministro_approved), mostrar indicador sin opción de subir
      if (isReadOnly) {
        return `<span style="color: #9ca3af; font-size: 12px; font-style: italic;">No disponible</span>`;
      }
      return `
        <input type="file" class="cert-file-input" data-member-id="${row.memberId}" data-member-rut="${row.rut}" data-member-name="${row.nombre}" accept=".pdf" style="display: none;">
        <button class="btn-upload-cert-admin" data-member-id="${row.memberId}" style="background: #f59e0b; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Subir
        </button>`;
    };

    return `
      <div class="review-directorio-comision">
        ${directorioRows.length > 0 ? `
          <div class="members-count" style="margin-bottom: 8px;">Directorio Provisorio (${directorioRows.length})</div>
          <table class="members-table" style="margin-bottom: 20px;">
            <thead>
              <tr>
                <th>Cargo</th>
                <th>Nombre</th>
                <th>RUT</th>
                <th>Certificado</th>
              </tr>
            </thead>
            <tbody>
              ${directorioRows.map(r => `
                <tr>
                  <td><strong>${r.cargo}</strong></td>
                  <td>${r.nombre}</td>
                  <td>${r.rut}</td>
                  <td>${renderCertCell(r)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        ${comisionRows.length > 0 ? `
          <div class="members-count" style="margin-bottom: 8px;">Comisión Electoral (${comisionRows.length})</div>
          <table class="members-table">
            <thead>
              <tr>
                <th>Cargo</th>
                <th>Nombre</th>
                <th>RUT</th>
                <th>Certificado</th>
              </tr>
            </thead>
            <tbody>
              ${comisionRows.map(r => `
                <tr>
                  <td><strong>${r.cargo}</strong></td>
                  <td>${r.nombre}</td>
                  <td>${r.rut}</td>
                  <td>${renderCertCell(r)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      </div>
    `;
  }

  /**
   * Renderiza el tab de documentos con opción de marcar para corrección
   */
  renderDocumentsTab(org, canReview = true) {
    // Obtener el ID correcto (MongoDB usa _id)
    const orgId = org._id || org.id;
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
                  <button class="btn-view-official-pdf" data-doc-id="${doc.id}" data-org-id="${orgId}" title="Ver documento" style="background: #ecfdf5; color: #065f46; border: 1px solid #10b981; padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    Ver
                  </button>
                  <button class="btn-download-official-pdf" data-doc-id="${doc.id}" data-org-id="${orgId}" title="Descargar PDF" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
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
                    <button class="btn-view-official-pdf" data-doc-id="${doc.id}" data-org-id="${orgId}" title="Ver documento" style="background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      Ver
                    </button>
                    <button class="btn-download-official-pdf" data-doc-id="${doc.id}" data-org-id="${orgId}" title="Descargar PDF" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
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
              <button class="btn-download-all-pdfs" data-org-id="${orgId}" style="
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

        ${(() => {
          // Funcion para renderizar un certificado
          const renderCertItem = (item) => `
            <div class="document-item-admin ${isReviewable ? 'reviewable' : ''}">
              <div class="doc-info">
                <span class="doc-icon">📋</span>
                <span class="doc-name">${item.role}: ${item.name || 'Sin nombre'}</span>
                ${item.cert ? '<span class="cert-uploaded-badge">Subido</span>' : '<span style="color: #dc2626; font-size: 11px;">No disponible</span>'}
              </div>
              <div class="doc-actions">
                ${item.cert ? `
                  <button class="btn-view-cert-admin" data-cert-key="${item.certKey}" title="Ver certificado">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    Ver
                  </button>
                ` : ''}
                ${isReviewable && item.cert ? `
                  <button class="btn-mark-error doc-error" data-type="certificate" data-key="${item.certKey}" data-label="Certificado ${item.role}: ${item.name}" title="Marcar para correccion">
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

          // Certificados del Directorio Provisorio (desde certificatesStep5)
          const certs = org.certificatesStep5 || {};
          const dir = org.provisionalDirectorio || {};
          const dirCerts = [];

          // Presidente
          if (dir.president) {
            const cert = certs.presidente || certs.president;
            const name = dir.president.name || `${dir.president.firstName || ''} ${dir.president.lastName || ''}`.trim();
            dirCerts.push({ role: 'Presidente', name, cert, certKey: 'presidente' });
          }

          // Secretario
          if (dir.secretary) {
            const cert = certs.secretario || certs.secretary;
            const name = dir.secretary.name || `${dir.secretary.firstName || ''} ${dir.secretary.lastName || ''}`.trim();
            dirCerts.push({ role: 'Secretario', name, cert, certKey: 'secretario' });
          }

          // Tesorero
          if (dir.treasurer) {
            const cert = certs.tesorero || certs.treasurer;
            const name = dir.treasurer.name || `${dir.treasurer.firstName || ''} ${dir.treasurer.lastName || ''}`.trim();
            dirCerts.push({ role: 'Tesorero', name, cert, certKey: 'tesorero' });
          }

          // Certificados de la Comision Electoral
          const comCerts = [];
          const comMembers = org.comisionElectoral || org.commission?.members || [];
          const comRoles = ['Presidente', 'Secretario', 'Vocal'];

          comMembers.forEach((m, i) => {
            const certKey = `comision${i + 1}`;
            const cert = certs[certKey] || org.certificates?.[m.id] || org.certificates?.[m._id];
            const name = m.name || `${m.firstName || ''} ${m.lastName || ''}`.trim();
            comCerts.push({ role: comRoles[i] || 'Miembro', name, cert, certKey });
          });

          let html = '';

          // Mostrar certificados del Directorio Provisorio
          if (dirCerts.length > 0) {
            html += `<h4 class="docs-subtitle">Certificados de Antecedentes - Directorio Provisorio</h4>`;
            html += dirCerts.map(c => renderCertItem(c)).join('');
          }

          // Mostrar certificados de la Comision Electoral
          if (comCerts.length > 0) {
            html += `<h4 class="docs-subtitle" style="margin-top: 20px;">Certificados de Antecedentes - Comision Electoral</h4>`;
            html += comCerts.map(c => renderCertItem(c)).join('');
          }

          return html;
        })()}
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
        borderColor = '#2563eb';
        iconBg = '#2563eb';
        break;

      case ORG_STATUS.MINISTRO_APPROVED:
        icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>`;
        title = 'Listo para Enviar al Registro Civil';
        message = 'El Ministro de Fe validó la asamblea constitutiva. Revise la información y documentos que serán enviados al Registro Civil para la inscripción oficial de la organización.';
        bgColor = '#dbeafe';
        borderColor = '#2563eb';
        iconBg = '#2563eb';
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

      case ORG_STATUS.REGISTRY_OBSERVATIONS:
        icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>`;
        title = 'Observaciones del Registro Civil';
        message = 'El Registro Civil ha enviado observaciones. El usuario debe revisar y corregir los puntos indicados para continuar con la inscripción.';
        bgColor = '#fef2f2';
        borderColor = '#dc2626';
        iconBg = '#dc2626';
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
   * Renderiza el tab de Registro Civil con resumen y botón de envío
   */
  renderRegistroCivilTab(org) {
    const orgId = org._id || org.id;
    const directorio = org.provisionalDirectorio || {};
    const comision = org.comisionElectoral || [];
    const members = org.members || [];
    const orgName = getOrgName(org) || 'Sin nombre';
    const orgType = getOrgTypeName(org.organization?.type || org.type) || 'Organizacion Comunitaria';

    // Contar documentos disponibles
    const docsCount = {
      oficiales: 5, // Acta, Lista, Certificado, Certificación, Depósito
      declaraciones: 0,
      certificados: Object.keys(org.certificates || {}).length
    };

    if (directorio.president) docsCount.declaraciones++;
    if (directorio.secretary) docsCount.declaraciones++;
    if (directorio.treasurer) docsCount.declaraciones++;
    if (directorio.additionalMembers) docsCount.declaraciones += directorio.additionalMembers.length;

    return `
      <div class="registro-civil-tab">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 50%;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <div>
              <h3 style="margin: 0; font-size: 18px;">Envío al Registro Civil</h3>
              <p style="margin: 4px 0 0; opacity: 0.9; font-size: 13px;">Paso final para la inscripción oficial de la organización</p>
            </div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
          <h4 style="margin: 0 0 12px; color: #1e293b; font-size: 14px;">Resumen de la Solicitud</h4>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Organización</div>
              <div style="font-weight: 600; color: #1e293b;">${orgName}</div>
              <div style="font-size: 12px; color: #64748b;">${orgType}</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Miembros Fundadores</div>
              <div style="font-weight: 600; color: #1e293b;">${members.length} personas</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Directorio Provisorio</div>
              <div style="font-weight: 600; color: #1e293b;">
                ${directorio.president ? directorio.president.name : 'No asignado'} (Presidente)
              </div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Comisión Electoral</div>
              <div style="font-weight: 600; color: #1e293b;">${comision.length} miembros</div>
            </div>
          </div>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
          <h4 style="margin: 0 0 12px; color: #166534; font-size: 14px; display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            Documentos a Enviar
          </h4>
          <div style="display: grid; gap: 8px;">
            <button class="btn-goto-docs-section" data-section="oficiales" style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 10px 12px; border-radius: 6px; border: 1px solid #e5e7eb; cursor: pointer; width: 100%; transition: all 0.2s;">
              <span style="color: #374151; display: flex; align-items: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                Documentos Oficiales
              </span>
              <span style="display: flex; align-items: center; gap: 8px;">
                <span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">${docsCount.oficiales}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </span>
            </button>
            <button class="btn-goto-docs-section" data-section="declaraciones" style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 10px 12px; border-radius: 6px; border: 1px solid #e5e7eb; cursor: pointer; width: 100%; transition: all 0.2s;">
              <span style="color: #374151; display: flex; align-items: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                Declaraciones Juradas
              </span>
              <span style="display: flex; align-items: center; gap: 8px;">
                <span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">${docsCount.declaraciones}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </span>
            </button>
            <button class="btn-goto-docs-section" data-section="certificados" style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 10px 12px; border-radius: 6px; border: 1px solid #e5e7eb; cursor: pointer; width: 100%; transition: all 0.2s;">
              <span style="color: #374151; display: flex; align-items: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Certificados de Antecedentes
              </span>
              <span style="display: flex; align-items: center; gap: 8px;">
                <span style="background: #2563eb; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">${docsCount.certificados}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </span>
            </button>
          </div>
        </div>

        ${org.status === ORG_STATUS.SENT_TO_REGISTRY ? `
          <!-- Estado: Enviada al Registro Civil - Esperando respuesta -->
          <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 2px solid #2563eb; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
              <div style="background: #2563eb; padding: 10px; border-radius: 50%;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <div>
                <h4 style="margin: 0; color: #1e40af; font-size: 16px;">Esperando Respuesta del Registro Civil</h4>
                <p style="margin: 4px 0 0; color: #2563eb; font-size: 13px;">La solicitud fue enviada. Cuando reciba respuesta, seleccione una opcion:</p>
              </div>
            </div>

            <div style="display: grid; gap: 12px;">
              <button class="btn-confirm-registry-tab" data-org-id="${orgId}" style="
                width: 100%;
                padding: 16px 24px;
                background: linear-gradient(135deg, #059669 0%, #10b981 100%);
                color: white;
                border: none;
                border-radius: 10px;
                font-weight: 600;
                font-size: 15px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                transition: all 0.2s;
                box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
              ">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Registro Civil Aprobo la Organizacion
              </button>

              <button class="btn-registry-observations-tab" data-org-id="${orgId}" style="
                width: 100%;
                padding: 16px 24px;
                background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
                color: white;
                border: none;
                border-radius: 10px;
                font-weight: 600;
                font-size: 15px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                transition: all 0.2s;
                box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
              ">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                Registro Civil Envio Observaciones
              </button>
            </div>
          </div>
        ` : `
          <!-- Estado: Listo para enviar al Registro Civil -->
          <div style="background: #fefce8; border: 1px solid #fde047; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <div>
                <div style="font-weight: 600; color: #854d0e; margin-bottom: 4px;">Importante</div>
                <p style="margin: 0; color: #713f12; font-size: 13px; line-height: 1.5;">
                  Una vez enviada la solicitud al Registro Civil, deberá esperar su respuesta.
                  El Registro Civil puede aprobar la inscripción o solicitar correcciones que serán
                  notificadas al usuario correspondiente.
                </p>
              </div>
            </div>
          </div>

          <div style="display: grid; gap: 12px;">
            <button class="btn-download-registry-package" data-org-id="${orgId}" style="
              width: 100%;
              padding: 14px 24px;
              background: linear-gradient(135deg, #059669 0%, #10b981 100%);
              color: white;
              border: none;
              border-radius: 10px;
              font-weight: 600;
              font-size: 15px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
              transition: all 0.2s;
              box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
            ">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Descargar Carpeta para Registro Civil
            </button>
          </div>
        `}
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

      case ORG_STATUS.MINISTRO_APPROVED:
        return `
          <button class="btn-primary btn-send-to-registry">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
            Enviar a Registro Civil
          </button>
        `;

      case ORG_STATUS.SENT_TO_REGISTRY:
        return `
          <button class="btn-warning btn-registry-observations">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Agregar Observaciones
          </button>
          <button class="btn-success btn-confirm-registry">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Confirmar Registro Civil
          </button>
        `;

      case ORG_STATUS.REGISTRY_OBSERVATIONS:
        return `
          <button class="btn-primary btn-resend-registry">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13"></path>
              <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
            </svg>
            Reenviar al Registro Civil
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
  async updateOrgStatus(orgId, newStatus, comment) {
    const org = await organizationsService.updateStatus(orgId, newStatus, comment);
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
    confirmModal.style.zIndex = '200000';

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
            <strong>Organización:</strong> ${getOrgName(org)}
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
   * Descargar carpeta ZIP con toda la documentación para el Registro Civil
   */
  async downloadRegistryPackage(org) {
    const orgName = getOrgName(org) || 'Organizacion';
    const safeOrgName = orgName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '_');

    // Mostrar loading
    const loadingToast = document.createElement('div');
    loadingToast.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 24px 32px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 1080; text-align: center;';
    loadingToast.innerHTML = `
      <div style="width: 48px; height: 48px; border: 4px solid #e5e7eb; border-top-color: #059669; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
      <p style="margin: 0; font-weight: 600; color: #1f2937;">Generando carpeta ZIP...</p>
      <p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;">Esto puede tomar unos segundos</p>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(loadingToast);

    try {
      const zip = new JSZip();
      const directorio = org.provisionalDirectorio || {};

      // Carpeta 1: Documentos Oficiales
      const oficiales = zip.folder('01_Documentos_Oficiales');

      // Acta de Asamblea
      try {
        const actaPdf = pdfService.generateActaAsamblea(org);
        if (actaPdf) {
          const actaBlob = pdfService.getPDFBlob(actaPdf);
          oficiales.file('01_Acta_Asamblea_Constitutiva.pdf', actaBlob);
        }
      } catch (e) { console.warn('Error generando Acta:', e); }

      // Lista de Socios
      try {
        const listaPdf = pdfService.generateListaSocios(org);
        if (listaPdf) {
          const listaBlob = pdfService.getPDFBlob(listaPdf);
          oficiales.file('02_Lista_Socios_Constitucion.pdf', listaBlob);
        }
      } catch (e) { console.warn('Error generando Lista:', e); }

      // Certificado del Ministro de Fe
      try {
        const certPdf = pdfService.generateCertificado(org);
        if (certPdf) {
          const certBlob = pdfService.getPDFBlob(certPdf);
          oficiales.file('03_Certificado_Ministro_Fe.pdf', certBlob);
        }
      } catch (e) { console.warn('Error generando Certificado:', e); }

      // Certificación Municipal
      try {
        const certMunPdf = pdfService.generateCertificacion(org);
        if (certMunPdf) {
          const certMunBlob = pdfService.getPDFBlob(certMunPdf);
          oficiales.file('04_Certificacion_Municipal.pdf', certMunBlob);
        }
      } catch (e) { console.warn('Error generando Certificación:', e); }

      // Depósito de Antecedentes
      try {
        const depPdf = pdfService.generateDepositoAntecedentes(org);
        if (depPdf) {
          const depBlob = pdfService.getPDFBlob(depPdf);
          oficiales.file('05_Deposito_Antecedentes.pdf', depBlob);
        }
      } catch (e) { console.warn('Error generando Depósito:', e); }

      // Carpeta 2: Declaraciones Juradas
      const declaraciones = zip.folder('02_Declaraciones_Juradas');
      let declNum = 1;

      // Declaración del Presidente
      if (directorio.president) {
        try {
          const declPdf = pdfService.generateDeclaracionJurada(org, directorio.president);
          if (declPdf) {
            const declBlob = pdfService.getPDFBlob(declPdf);
            const fileName = `${String(declNum++).padStart(2, '0')}_Declaracion_Presidente_${directorio.president.name.replace(/\s+/g, '_')}.pdf`;
            declaraciones.file(fileName, declBlob);
          }
        } catch (e) { console.warn('Error generando declaración presidente:', e); }
      }

      // Declaración del Secretario
      if (directorio.secretary) {
        try {
          const declPdf = pdfService.generateDeclaracionJurada(org, directorio.secretary);
          if (declPdf) {
            const declBlob = pdfService.getPDFBlob(declPdf);
            const fileName = `${String(declNum++).padStart(2, '0')}_Declaracion_Secretario_${directorio.secretary.name.replace(/\s+/g, '_')}.pdf`;
            declaraciones.file(fileName, declBlob);
          }
        } catch (e) { console.warn('Error generando declaración secretario:', e); }
      }

      // Declaración del Tesorero
      if (directorio.treasurer) {
        try {
          const declPdf = pdfService.generateDeclaracionJurada(org, directorio.treasurer);
          if (declPdf) {
            const declBlob = pdfService.getPDFBlob(declPdf);
            const fileName = `${String(declNum++).padStart(2, '0')}_Declaracion_Tesorero_${directorio.treasurer.name.replace(/\s+/g, '_')}.pdf`;
            declaraciones.file(fileName, declBlob);
          }
        } catch (e) { console.warn('Error generando declaración tesorero:', e); }
      }

      // Declaraciones de miembros adicionales
      if (directorio.additionalMembers) {
        for (const member of directorio.additionalMembers) {
          try {
            const declPdf = pdfService.generateDeclaracionJurada(org, member);
            if (declPdf) {
              const declBlob = pdfService.getPDFBlob(declPdf);
              const cargo = member.cargo || 'Director';
              const fileName = `${String(declNum++).padStart(2, '0')}_Declaracion_${cargo}_${member.name.replace(/\s+/g, '_')}.pdf`;
              declaraciones.file(fileName, declBlob);
            }
          } catch (e) { console.warn('Error generando declaración adicional:', e); }
        }
      }

      // Carpeta 3: Certificados de Antecedentes
      const certificados = zip.folder('03_Certificados_Antecedentes');
      const certs = org.certificatesStep5 || {};

      const certMapping = {
        presidente: { name: directorio.president?.name, cargo: 'Presidente' },
        secretario: { name: directorio.secretary?.name, cargo: 'Secretario' },
        tesorero: { name: directorio.treasurer?.name, cargo: 'Tesorero' },
        comision1: { name: org.comisionElectoral?.[0]?.name, cargo: 'Comision_Electoral_1' },
        comision2: { name: org.comisionElectoral?.[1]?.name, cargo: 'Comision_Electoral_2' },
        comision3: { name: org.comisionElectoral?.[2]?.name, cargo: 'Comision_Electoral_3' }
      };

      let certNum = 1;
      for (const [key, info] of Object.entries(certMapping)) {
        const cert = certs[key];
        if (cert && info.name) {
          try {
            let certData, certType;
            if (cert.base64) {
              certData = cert.base64;
              certType = cert.type || 'image/png';
            } else if (cert.data) {
              certData = cert.data;
              certType = cert.type || 'image/png';
            } else if (typeof cert === 'string') {
              certData = cert;
              certType = 'image/png';
            }

            if (certData) {
              const extension = certType.includes('pdf') ? 'pdf' : certType.includes('png') ? 'png' : 'jpg';
              const fileName = `${String(certNum++).padStart(2, '0')}_Certificado_${info.cargo}_${info.name.replace(/\s+/g, '_')}.${extension}`;

              // Convertir base64 a blob
              const byteCharacters = atob(certData.replace(/^data:.*?;base64,/, ''));
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              certificados.file(fileName, byteArray);
            }
          } catch (e) { console.warn(`Error agregando certificado ${key}:`, e); }
        }
      }

      // Generar y descargar el ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Registro_Civil_${safeOrgName}_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      loadingToast.remove();
      showToast('Carpeta ZIP descargada correctamente', 'success');

    } catch (error) {
      console.error('Error generando ZIP:', error);
      loadingToast.remove();
      showToast('Error al generar la carpeta ZIP', 'error');
    }
  }

  /**
   * Modal para enviar solicitud al Registro Civil
   */
  openSendToRegistryModal(org, parentModal) {
    const confirmModal = document.createElement('div');
    confirmModal.className = 'admin-review-modal-overlay';
    confirmModal.style.zIndex = '200000';

    confirmModal.innerHTML = `
      <div class="admin-review-modal" style="max-width: 500px;">
        <div class="review-modal-header" style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);">
          <h3 style="color: #1e40af; margin: 0;">📤 Enviar a Registro Civil</h3>
          <button class="review-close-btn send-cancel">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="review-modal-body" style="padding: 24px;">
          <div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #166534; font-size: 14px;">
              <strong>La asamblea ha sido validada por el Ministro de Fe.</strong>
              Ahora debe enviar la documentación al Registro Civil para la inscripción oficial.
            </p>
          </div>

          <div style="margin-bottom: 16px;">
            <strong>Organización:</strong> ${getOrgName(org)}
          </div>

          <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0 0 8px 0; color: #92400e; font-size: 13px; font-weight: 600;">
              Documentos a enviar:
            </p>
            <ul style="margin: 0; padding-left: 20px; color: #92400e; font-size: 13px;">
              <li>Acta de Asamblea Constitutiva</li>
              <li>Lista de Miembros Fundadores</li>
              <li>Estatutos de la Organización</li>
              <li>Certificado del Ministro de Fe</li>
            </ul>
          </div>

          <form id="send-registry-form">
            <div class="form-group">
              <label>Número de Oficio/Referencia (opcional)</label>
              <input type="text" name="reference" placeholder="Ej: OF-2024-001234"
                style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 12px;">
            </div>

            <div class="form-group">
              <label>Notas adicionales</label>
              <textarea name="notes" rows="3"
                placeholder="Información adicional sobre el envío..."
                style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;"></textarea>
            </div>

            <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary send-cancel">Cancelar</button>
              <button type="submit" class="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                  <path d="M22 2L11 13"></path>
                  <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
                </svg>
                Confirmar Envío
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(confirmModal);

    // Event listeners
    confirmModal.querySelectorAll('.send-cancel').forEach(btn => {
      btn.addEventListener('click', () => confirmModal.remove());
    });

    const form = confirmModal.querySelector('#send-registry-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const reference = formData.get('reference');
      const notes = formData.get('notes');

      const comment = `Enviado al Registro Civil${reference ? ' - Ref: ' + reference : ''}${notes ? '. Notas: ' + notes : ''}`;

      // Actualizar estado a sent_registry
      const orgId = org._id || org.id;
      const result = await organizationsService.updateStatus(orgId, ORG_STATUS.SENT_TO_REGISTRY, comment);
      if (result) {
        showToast('Solicitud enviada al Registro Civil', 'success');
        confirmModal.remove();
        parentModal.remove();
        this.renderApplicationsList();
        this.updateStats();
      } else {
        showToast('Error al actualizar el estado', 'error');
      }
    });
  }

  /**
   * Modal para confirmar respuesta del Registro Civil
   */
  openConfirmRegistryModal(org, parentModal) {
    const confirmModal = document.createElement('div');
    confirmModal.className = 'admin-review-modal-overlay';
    confirmModal.style.zIndex = '200000';

    confirmModal.innerHTML = `
      <div class="admin-review-modal" style="max-width: 500px;">
        <div class="review-modal-header" style="background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);">
          <h3 style="color: #166534; margin: 0;">✅ Confirmar Registro Civil</h3>
          <button class="review-close-btn confirm-cancel">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="review-modal-body" style="padding: 24px;">
          <div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #166534; font-size: 14px;">
              <strong>¡Felicitaciones!</strong> El Registro Civil ha aprobado la inscripción de esta organización.
              Al confirmar, la organización quedará oficialmente registrada.
            </p>
          </div>

          <div style="margin-bottom: 16px;">
            <strong>Organización:</strong> ${getOrgName(org)}
          </div>

          <form id="confirm-registry-form">
            <div class="form-group">
              <label>Número de Inscripción en Registro Civil <span class="required">*</span></label>
              <input type="text" name="registryNumber" required placeholder="Ej: RC-2024-12345"
                style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 12px;">
            </div>

            <div class="form-group">
              <label>Fecha de Inscripción <span class="required">*</span></label>
              <input type="date" name="registryDate" required
                style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 12px;">
            </div>

            <div class="form-group">
              <label>Observaciones</label>
              <textarea name="observations" rows="3"
                placeholder="Observaciones adicionales..."
                style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;"></textarea>
            </div>

            <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary confirm-cancel">Cancelar</button>
              <button type="submit" class="btn btn-success">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Aprobar Organización
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(confirmModal);

    // Establecer fecha de hoy por defecto
    const dateInput = confirmModal.querySelector('input[name="registryDate"]');
    dateInput.value = new Date().toISOString().split('T')[0];

    // Event listeners
    confirmModal.querySelectorAll('.confirm-cancel').forEach(btn => {
      btn.addEventListener('click', () => confirmModal.remove());
    });

    const form = confirmModal.querySelector('#confirm-registry-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const registryNumber = formData.get('registryNumber');
      const registryDate = formData.get('registryDate');
      const observations = formData.get('observations');

      const comment = `Inscripción confirmada - N° ${registryNumber} - Fecha: ${registryDate}${observations ? '. Obs: ' + observations : ''}`;

      // Guardar datos del registro civil en la organización
      org.registryCivil = {
        number: registryNumber,
        date: registryDate,
        observations: observations
      };

      // Actualizar estado a approved
      const orgId = org._id || org.id;
      const result = await organizationsService.updateStatus(orgId, ORG_STATUS.APPROVED, comment);
      if (result) {
        showToast('¡Organización aprobada exitosamente!', 'success');
        confirmModal.remove();
        parentModal.remove();
        this.renderApplicationsList();
        this.updateStats();
      } else {
        showToast('Error al aprobar la organización', 'error');
      }
    });
  }

  /**
   * Modal para agregar observaciones del Registro Civil
   */
  openRegistryObservationsModal(org, parentModal) {
    const obsModal = document.createElement('div');
    obsModal.className = 'admin-review-modal-overlay';
    obsModal.style.zIndex = '200000';

    obsModal.innerHTML = `
      <div class="admin-review-modal" style="max-width: 550px;">
        <div class="review-modal-header" style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);">
          <h3 style="color: #dc2626; margin: 0;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Observaciones del Registro Civil
          </h3>
          <button class="review-close-btn obs-cancel">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="review-modal-body" style="padding: 24px;">
          <div style="background: #fefce8; border: 2px solid #fde047; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #854d0e; font-size: 14px;">
              <strong>Importante:</strong> Al agregar observaciones, el usuario será notificado y deberá corregir los puntos indicados antes de poder continuar con la inscripción.
            </p>
          </div>

          <div style="margin-bottom: 16px;">
            <strong>Organización:</strong> ${getOrgName(org)}
          </div>

          <form id="registry-observations-form">
            <div class="form-group">
              <label>Observaciones del Registro Civil <span class="required">*</span></label>
              <textarea name="observations" rows="5" required
                placeholder="Detalle las observaciones o correcciones requeridas por el Registro Civil..."
                style="width: 100%; padding: 12px; border: 1px solid #fca5a5; border-radius: 6px; font-size: 14px;"></textarea>
            </div>

            <div class="form-group" style="margin-top: 16px;">
              <label>Fecha límite para corrección</label>
              <input type="date" name="deadline"
                style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;">
            </div>

            <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary obs-cancel">Cancelar</button>
              <button type="submit" class="btn btn-danger" style="background: #dc2626;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                Registrar Observaciones
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(obsModal);

    // Event listeners
    obsModal.querySelectorAll('.obs-cancel').forEach(btn => {
      btn.addEventListener('click', () => obsModal.remove());
    });

    const form = obsModal.querySelector('#registry-observations-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const observations = formData.get('observations');
      const deadline = formData.get('deadline');

      const comment = `Observaciones del Registro Civil: ${observations}${deadline ? ' - Fecha límite: ' + deadline : ''}`;

      // Guardar observaciones en la organización
      org.registryObservations = {
        observations: observations,
        deadline: deadline,
        date: new Date().toISOString()
      };

      // Actualizar estado a registry_observations
      const orgId = org._id || org.id;
      const result = await organizationsService.updateStatus(orgId, ORG_STATUS.REGISTRY_OBSERVATIONS, comment);
      if (result) {
        showToast('Observaciones registradas. El usuario será notificado.', 'success');
        obsModal.remove();
        parentModal.remove();
        this.renderApplicationsList();
        this.updateStats();
      } else {
        showToast('Error al registrar observaciones', 'error');
      }
    });
  }

  /**
   * FASE 2: Modal para gestión de Ministro de Fe
   */
  openMinistroModal(org) {
    const isWaiting = org.status === ORG_STATUS.WAITING_MINISTRO_REQUEST;
    const isScheduled = org.status === ORG_STATUS.MINISTRO_SCHEDULED;

    // Obtener datos de la asignación (fuente más confiable que org.ministroData)
    const assignment = ministroAssignmentService.getByOrganizationId(org.id || org._id)?.[0];

    // Combinar datos: priorizar asignación, luego org.ministroData
    // NOTA: En el servidor, ministroData guarda "name" y "rut", no "ministroName" y "ministroRut"
    const ministroInfo = {
      ministroName: assignment?.ministroName || org.ministroData?.ministroName || org.ministroData?.name || null,
      ministroRut: assignment?.ministroRut || org.ministroData?.ministroRut || org.ministroData?.rut || null,
      scheduledDate: assignment?.scheduledDate || org.ministroData?.scheduledDate || null,
      scheduledTime: assignment?.scheduledTime || org.ministroData?.scheduledTime || null,
      location: assignment?.location || org.ministroData?.location || null
    };

    const modal = document.createElement('div');
    modal.className = 'admin-review-modal-overlay';

    // Parsear fecha correctamente - puede venir como Date object o string
    // IMPORTANTE: Si es string "YYYY-MM-DD", parsearlo manualmente para evitar problemas de timezone
    let electionDate = 'No especificada';
    let electionDateForInput = '';
    let formattedUserDate = 'No especificada';

    if (org.electionDate) {
      let date;
      const dateStr = org.electionDate;

      // Si es string en formato YYYY-MM-DD, parsear manualmente para evitar desfase de zona horaria
      if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
        date = new Date(year, month - 1, day, 12, 0, 0); // Usar mediodía para evitar problemas
      } else {
        date = new Date(dateStr);
      }

      if (!isNaN(date.getTime())) {
        electionDate = date.toLocaleDateString('es-CL', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        // Formato para input date (yyyy-mm-dd) - usar los valores locales
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        electionDateForInput = `${y}-${m}-${d}`;

        // Formatear fecha completa con día de la semana
        formattedUserDate = date.toLocaleDateString('es-CL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        formattedUserDate = formattedUserDate.charAt(0).toUpperCase() + formattedUserDate.slice(1);
      }
    }

    // Preferencia de contacto - usar los campos contactPhone y contactEmail de la organización
    const contactPhone = org.contactPhone || org.phone || '';
    const contactEmail = org.contactEmail || org.email || '';
    const contactPref = org.contactPreference || 'phone';
    const contactLabel = contactPref === 'email' ? 'Correo Electrónico' : 'Teléfono';
    const contactValue = contactPref === 'email' ? contactEmail : contactPhone;

    // Dirección de la organización
    const orgAddress = org.address || '';

    // Datos de documentación para revisión del admin
    const dir = org.provisionalDirectorio || {};
    const additionalMembers = dir.additionalMembers || [];
    const commission = org.electoralCommission || [];
    const allMembers = org.members || [];
    // estatutos puede ser string directo o objeto {tipo, contenido}
    const rawEstatutos = org.estatutos || org.estatutosSnapshot?.documentoGenerado || '';
    const estatutos = typeof rawEstatutos === 'object' ? (rawEstatutos.contenido || rawEstatutos.texto || JSON.stringify(rawEstatutos)) : rawEstatutos;

    // Helper para extraer nombre de miembros (diferentes formatos)
    const extractName = (m) => {
      if (!m) return 'Sin nombre';
      if (m.primerNombre) {
        const fn = [m.primerNombre, m.segundoNombre].filter(Boolean).join(' ');
        const ln = [m.apellidoPaterno, m.apellidoMaterno].filter(Boolean).join(' ');
        return (fn + ' ' + ln).trim() || 'Sin nombre';
      }
      if (m.firstName) return `${m.firstName} ${m.lastName || ''}`.trim();
      return m.name || m.nombre || 'Sin nombre';
    };

    const cargoLabels = { president: 'Presidente', secretary: 'Secretario', treasurer: 'Tesorero', director: 'Director', member: 'Miembro', electoral_commission: 'Com. Electoral' };

    modal.innerHTML = `
      <div class="admin-review-modal ministro-request-modal">
        <div class="review-modal-header ministro-modal-header-redesign">
          <div class="review-header-left">
            <div class="ministro-modal-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 8v8"></path>
                <path d="M8 12h8"></path>
              </svg>
            </div>
            <div class="ministro-modal-titles">
              <h2>Solicitud de Ministro de Fe</h2>
              <p>${getOrgName(org)}</p>
            </div>
          </div>
          <button class="review-close-btn ministro-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="review-modal-body" style="padding: 24px;">
          ${isScheduled ? `
            <!-- ===== VISTA: MINISTRO YA AGENDADO ===== -->
            <div class="ministro-modal-content">
              <!-- COLUMNA IZQUIERDA: Información -->
              <div class="ministro-info-column">
                <!-- Tarjeta: Datos de la Organización -->
                <div class="ministro-info-card">
                  <div class="ministro-info-card-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    <h4>Datos de la Organización</h4>
                  </div>
                  <div class="ministro-info-card-body">
                    <div class="ministro-data-grid">
                      <div class="ministro-data-item">
                        <span class="ministro-data-label">Tipo</span>
                        <span class="ministro-data-value">${getOrgTypeName(getOrgType(org))}</span>
                      </div>
                      <div class="ministro-data-item">
                        <span class="ministro-data-label">Comuna</span>
                        <span class="ministro-data-value">${getOrgComuna(org)}</span>
                      </div>
                      <div class="ministro-data-item">
                        <span class="ministro-data-label">Miembros Fundadores</span>
                        <span class="ministro-data-value">${org.members?.length || 0} personas</span>
                      </div>
                      <div class="ministro-data-item">
                        <span class="ministro-data-label">Dirección Sede</span>
                        <span class="ministro-data-value ${orgAddress ? '' : 'muted'}">${orgAddress || 'No especificada'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Tarjeta: Contacto del Solicitante -->
                <div class="ministro-info-card">
                  <div class="ministro-info-card-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                    </svg>
                    <h4>Contacto del Solicitante</h4>
                  </div>
                  <div class="ministro-info-card-body">
                    <div class="ministro-contact-row">
                      <div class="ministro-contact-item">
                        <div class="ministro-contact-icon phone ${contactPref === 'phone' ? 'preferred' : ''}">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                          </svg>
                        </div>
                        <div class="ministro-contact-details">
                          <span class="ministro-contact-label">Teléfono ${contactPref === 'phone' ? '<span class="contact-pref-badge">Preferido</span>' : ''}</span>
                          <span class="ministro-contact-value">${contactPhone || 'No disponible'}</span>
                        </div>
                      </div>
                      <div class="ministro-contact-item">
                        <div class="ministro-contact-icon email ${contactPref === 'email' ? 'preferred' : ''}">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                          </svg>
                        </div>
                        <div class="ministro-contact-details">
                          <span class="ministro-contact-label">Correo ${contactPref === 'email' ? '<span class="contact-pref-badge">Preferido</span>' : ''}</span>
                          <span class="ministro-contact-value">${contactEmail || 'No disponible'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- COLUMNA DERECHA: Asignación -->
              <div class="ministro-form-column">
                <!-- Tarjeta: Ministro Asignado -->
                <div class="ministro-info-card ministro-confirmed-card">
                  <div class="ministro-info-card-header" style="border-color: #bbf7d0;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <h4 style="color: #065f46;">Ministro de Fe Asignado</h4>
                  </div>
                  <div class="ministro-info-card-body">
                    <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
                      <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: white; font-size: 20px; font-weight: 700;">
                        ${(ministroInfo.ministroName || 'M').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style="margin: 0; font-size: 16px; font-weight: 700; color: #1e293b;">${ministroInfo.ministroName || 'Sin asignar'}</p>
                        <p style="margin: 2px 0 0; font-size: 13px; color: #64748b;">RUT: ${ministroInfo.ministroRut || 'No disponible'}</p>
                      </div>
                    </div>

                    <div class="ministro-data-grid">
                      <div class="ministro-data-item">
                        <span class="ministro-data-label">Fecha Agendada</span>
                        <span class="ministro-data-value highlight">${(() => {
                          if (ministroInfo.scheduledDate) {
                            const dateStr = ministroInfo.scheduledDate;
                            if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
                              const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
                              const date = new Date(year, month - 1, day, 12, 0, 0);
                              return date.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                            }
                          }
                          return 'No especificada';
                        })()}</span>
                      </div>
                      <div class="ministro-data-item">
                        <span class="ministro-data-label">Hora</span>
                        <span class="ministro-data-value highlight">${ministroInfo.scheduledTime || 'No especificada'}</span>
                      </div>
                      <div class="ministro-data-item full-width">
                        <span class="ministro-data-label">Lugar</span>
                        <span class="ministro-data-value ${ministroInfo.location ? '' : 'muted'}">${ministroInfo.location || 'No especificado'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Botón modificar -->
                <button type="button" id="btn-edit-ministro" class="ministro-btn-edit">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Modificar Asignación
                </button>

                <!-- Info siguiente paso -->
                <div class="ministro-next-step-info">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0369a1" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <p>
                    <strong>Siguiente paso:</strong> El Ministro de Fe debe presidir la asamblea constitutiva y validar las firmas de los socios fundadores.
                  </p>
                </div>
              </div>
            </div>
          ` : `
            <!-- ===== VISTA: ESPERANDO AGENDAR MINISTRO ===== -->
            <div class="ministro-modal-content">
              <!-- COLUMNA IZQUIERDA: Información -->
              <div class="ministro-info-column">
                <!-- Tarjeta: Solicitud del Usuario -->
                <div class="ministro-info-card ministro-request-highlight">
                  <div class="ministro-info-card-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                    </svg>
                    <h4>Solicitud del Usuario</h4>
                  </div>
                  <div class="ministro-info-card-body">
                    <div class="ministro-data-grid">
                      <div class="ministro-data-item">
                        <span class="ministro-data-label">Fecha Solicitada</span>
                        <span class="ministro-data-value highlight">${formattedUserDate}</span>
                      </div>
                      <div class="ministro-data-item">
                        <span class="ministro-data-label">Hora Solicitada</span>
                        <span class="ministro-data-value ${org.electionTime ? 'highlight' : 'muted'}">${org.electionTime || 'No especificada'}</span>
                      </div>
                      <div class="ministro-data-item full-width">
                        <span class="ministro-data-label">Dirección para Asamblea</span>
                        <span class="ministro-data-value ${org.assemblyAddress ? '' : 'muted'}">${org.assemblyAddress || 'No especificada'}</span>
                      </div>
                    </div>

                    <!-- Datos de contacto del usuario -->
                    <div class="ministro-contact-row">
                      <div class="ministro-contact-item">
                        <div class="ministro-contact-icon phone ${contactPref === 'phone' ? 'preferred' : ''}">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                          </svg>
                        </div>
                        <div class="ministro-contact-details">
                          <span class="ministro-contact-label">Teléfono ${contactPref === 'phone' ? '<span class="contact-pref-badge">Preferido</span>' : ''}</span>
                          <span class="ministro-contact-value">${contactPhone || 'No disponible'}</span>
                        </div>
                      </div>
                      <div class="ministro-contact-item">
                        <div class="ministro-contact-icon email ${contactPref === 'email' ? 'preferred' : ''}">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                          </svg>
                        </div>
                        <div class="ministro-contact-details">
                          <span class="ministro-contact-label">Correo ${contactPref === 'email' ? '<span class="contact-pref-badge">Preferido</span>' : ''}</span>
                          <span class="ministro-contact-value">${contactEmail || 'No disponible'}</span>
                        </div>
                      </div>
                    </div>

                    ${org.comments ? `
                      <div class="ministro-comments-box">
                        <p><strong>Comentarios:</strong> ${org.comments}</p>
                      </div>
                    ` : ''}
                  </div>
                </div>

                <!-- Tarjeta: Información de la Organización -->
                <div class="ministro-info-card">
                  <div class="ministro-info-card-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    <h4>Datos de la Organización</h4>
                  </div>
                  <div class="ministro-info-card-body">
                    <div class="ministro-data-grid">
                      <div class="ministro-data-item">
                        <span class="ministro-data-label">Tipo</span>
                        <span class="ministro-data-value">${getOrgTypeName(getOrgType(org))}</span>
                      </div>
                      <div class="ministro-data-item">
                        <span class="ministro-data-label">Comuna</span>
                        <span class="ministro-data-value">${getOrgComuna(org)}</span>
                      </div>
                      <div class="ministro-data-item">
                        <span class="ministro-data-label">Miembros Fundadores</span>
                        <span class="ministro-data-value">${org.members?.length || 0} personas</span>
                      </div>
                      <div class="ministro-data-item">
                        <span class="ministro-data-label">Dirección Sede</span>
                        <span class="ministro-data-value ${orgAddress ? '' : 'muted'}">${orgAddress || 'No especificada'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Tarjeta: Documentación de la Solicitud -->
                <div class="ministro-info-card">
                  <div class="ministro-info-card-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <h4>Documentación de la Solicitud</h4>
                  </div>
                  <div class="ministro-info-card-body" style="padding: 0;">
                    <!-- Tabs -->
                    <div class="admin-doc-tabs" style="display: flex; border-bottom: 2px solid #e2e8f0; background: #f8fafc;">
                      <button class="admin-doc-tab active" data-tab="directorio" style="flex: 1; padding: 10px 8px; font-size: 13px; font-weight: 600; color: #2563eb; background: white; border: none; border-bottom: 2px solid #2563eb; margin-bottom: -2px; cursor: pointer; transition: all 0.2s;">Directorio</button>
                      <button class="admin-doc-tab" data-tab="comision" style="flex: 1; padding: 10px 8px; font-size: 13px; font-weight: 500; color: #64748b; background: transparent; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px; cursor: pointer; transition: all 0.2s;">Comisión</button>
                      <button class="admin-doc-tab" data-tab="miembros" style="flex: 1; padding: 10px 8px; font-size: 13px; font-weight: 500; color: #64748b; background: transparent; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px; cursor: pointer; transition: all 0.2s;">Miembros</button>
                      <button class="admin-doc-tab" data-tab="documentos" style="flex: 1; padding: 10px 8px; font-size: 13px; font-weight: 500; color: #64748b; background: transparent; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px; cursor: pointer; transition: all 0.2s;">Documentos</button>
                    </div>

                    <!-- Tab: Directorio -->
                    <div class="admin-doc-tab-content" data-tab-content="directorio" style="padding: 16px;">
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        ${['president', 'secretary', 'treasurer'].map(cargo => {
                          const member = dir[cargo];
                          return member ? `
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                              <div style="font-size: 11px; font-weight: 600; color: #2563eb; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">${cargoLabels[cargo]}</div>
                              <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${extractName(member)}</div>
                              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">RUT: ${member.rut || 'No registrado'}</div>
                            </div>
                          ` : `
                            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px;">
                              <div style="font-size: 11px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">${cargoLabels[cargo]}</div>
                              <div style="font-size: 13px; color: #991b1b;">No asignado</div>
                            </div>
                          `;
                        }).join('')}
                        ${additionalMembers.map((m, i) => `
                          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                            <div style="font-size: 11px; font-weight: 600; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">${cargoLabels[m.role] || m.role || 'Director'}</div>
                            <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${extractName(m)}</div>
                            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">RUT: ${m.rut || 'No registrado'}</div>
                          </div>
                        `).join('')}
                      </div>
                      ${!dir.president && !dir.secretary && !dir.treasurer && additionalMembers.length === 0 ? '<p style="text-align: center; color: #94a3b8; font-size: 13px; padding: 20px 0;">No se registró directorio provisorio</p>' : ''}
                    </div>

                    <!-- Tab: Comisión Electoral -->
                    <div class="admin-doc-tab-content" data-tab-content="comision" style="padding: 16px; display: none;">
                      ${commission.length > 0 ? `
                        <ol style="margin: 0; padding-left: 24px; list-style: decimal;">
                          ${commission.map(m => `
                            <li style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px;">
                              <span style="font-weight: 600; color: #1e293b;">${extractName(m)}</span>
                              <span style="color: #64748b; margin-left: 8px; font-size: 12px;">RUT: ${m.rut || 'No registrado'}</span>
                            </li>
                          `).join('')}
                        </ol>
                      ` : '<p style="text-align: center; color: #94a3b8; font-size: 13px; padding: 20px 0;">No se registró comisión electoral</p>'}
                    </div>

                    <!-- Tab: Miembros Fundadores -->
                    <div class="admin-doc-tab-content" data-tab-content="miembros" style="padding: 16px; display: none;">
                      ${allMembers.length > 0 ? `
                        <div style="max-height: 280px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <thead>
                              <tr style="background: #f8fafc; position: sticky; top: 0;">
                                <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; width: 40px;">#</th>
                                <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0;">Nombre</th>
                                <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0;">RUT</th>
                                <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0;">Rol</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${allMembers.map((m, i) => `
                                <tr style="border-bottom: 1px solid #f1f5f9;${i % 2 === 1 ? ' background: #fafbfc;' : ''}">
                                  <td style="padding: 8px 12px; color: #94a3b8;">${i + 1}</td>
                                  <td style="padding: 8px 12px; font-weight: 500; color: #1e293b;">${extractName(m)}</td>
                                  <td style="padding: 8px 12px; color: #64748b;">${m.rut || 'No registrado'}</td>
                                  <td style="padding: 8px 12px; color: #64748b;">${m.role ? (cargoLabels[m.role] || m.role) : 'Miembro'}</td>
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                        </div>
                        <p style="font-size: 12px; color: #94a3b8; margin-top: 8px; text-align: right;">${allMembers.length} miembro${allMembers.length !== 1 ? 's' : ''} registrado${allMembers.length !== 1 ? 's' : ''}</p>
                      ` : '<p style="text-align: center; color: #94a3b8; font-size: 13px; padding: 20px 0;">No se registraron miembros fundadores</p>'}
                    </div>

                    <!-- Tab: Documentos -->
                    <div class="admin-doc-tab-content" data-tab-content="documentos" style="padding: 16px; display: none;">
                      <div id="generated-docs-container" style="margin-bottom: 16px;">
                        <div id="generated-docs-loading" style="text-align: center; padding: 12px; color: #94a3b8; font-size: 13px;">Cargando documentos generados...</div>
                      </div>
                      <div id="certificate-files-container" style="margin-bottom: 16px;">
                        <h5 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 8px;">Certificados de Antecedentes (Directorio)</h5>
                        <div id="certificate-files-loading" style="color: #94a3b8; font-size: 13px;">Cargando certificados...</div>
                      </div>
                      ${(() => {
                        const cargoLabelsEs = { presidente: 'Presidente', secretario: 'Secretario', tesorero: 'Tesorero', vicepresidente: 'Vicepresidente', director: 'Director', director1: 'Director 1', director2: 'Director 2', comision1: 'Com. Electoral 1', comision2: 'Com. Electoral 2', comision3: 'Com. Electoral 3', ...cargoLabels };
                        const membersWithCert = allMembers.filter(m => m.certificate);
                        const membersWithoutCert = allMembers.filter(m => !m.certificate);
                        let html = '';

                        // Firmas de comisión electoral
                        html += '<div style="margin-bottom: 16px;"><h5 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 8px;">Firmas Comisión Electoral</h5>';
                        if (commission.length > 0) {
                          html += '<div style="display: grid; gap: 6px;">';
                          commission.forEach(m => {
                            const hasSig = !!m.signature;
                            html += '<div style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: ' + (hasSig ? '#f0fdf4' : '#fef2f2') + '; border: 1px solid ' + (hasSig ? '#bbf7d0' : '#fecaca') + '; border-radius: 8px; font-size: 13px;">';
                            html += '<span style="color: ' + (hasSig ? '#16a34a' : '#dc2626') + '; font-size: 16px;">' + (hasSig ? '✓' : '✗') + '</span>';
                            html += '<span style="font-weight: 500; color: #1e293b;">' + extractName(m) + '</span>';
                            html += '<span style="color: ' + (hasSig ? '#166534' : '#991b1b') + '; margin-left: auto; font-size: 12px;">' + (hasSig ? 'Firmado' : 'Sin firma') + '</span>';
                            html += '</div>';
                          });
                          html += '</div>';
                        } else {
                          html += '<p style="color: #94a3b8; font-size: 13px;">No se registró comisión electoral</p>';
                        }
                        html += '</div>';

                        // Certificados de miembros
                        html += '<div><h5 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 8px;">Certificados de Miembros Fundadores</h5>';
                        if (allMembers.length > 0) {
                          html += '<div style="display: flex; gap: 12px; margin-bottom: 8px;">';
                          html += '<div style="flex: 1; text-align: center; padding: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;"><span style="font-size: 20px; font-weight: 700; color: #16a34a;">' + membersWithCert.length + '</span><br><span style="font-size: 12px; color: #166534;">Con certificado</span></div>';
                          html += '<div style="flex: 1; text-align: center; padding: 10px; background: ' + (membersWithoutCert.length > 0 ? '#fef2f2' : '#f0fdf4') + '; border: 1px solid ' + (membersWithoutCert.length > 0 ? '#fecaca' : '#bbf7d0') + '; border-radius: 8px;"><span style="font-size: 20px; font-weight: 700; color: ' + (membersWithoutCert.length > 0 ? '#dc2626' : '#16a34a') + ';">' + membersWithoutCert.length + '</span><br><span style="font-size: 12px; color: ' + (membersWithoutCert.length > 0 ? '#991b1b' : '#166534') + ';">Sin certificado</span></div>';
                          html += '</div>';
                        } else {
                          html += '<p style="color: #94a3b8; font-size: 13px;">No se registraron miembros</p>';
                        }
                        html += '</div>';

                        return html;
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              <!-- COLUMNA DERECHA: Formulario -->
              <div class="ministro-form-column">
                ${isWaiting ? `
                <div class="ministro-action-alert">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <p>Asigna un Ministro de Fe para la asamblea constitutiva</p>
                </div>

                <form id="schedule-ministro-form" class="ministro-form-section">
                  <h4>Agendar Ministro de Fe</h4>

                  <div class="ministro-form-row">
                    <div class="form-group">
                      <label>Fecha <span class="required">*</span></label>
                      <input type="date" name="scheduledDate" required
                        value="${electionDateForInput}"
                        min="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                      <label>Hora <span class="required">*</span></label>
                      <select name="scheduledTime" required class="input-styled">
                        <option value="">Seleccionar...</option>
                        ${(() => {
                          const baseHours = ministroAvailabilityService.getAvailableHours();
                          const userTime = org.electionTime || '';
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

                  <div class="ministro-form-row single">
                    <div class="form-group">
                      <label>Ministro de Fe <span class="required">*</span></label>
                      <select name="ministroId" id="ministro-select" required class="input-styled">
                        <option value="">-- Selecciona fecha y hora primero --</option>
                      </select>
                      <p id="ministro-availability-warning" style="color: #f59e0b; font-size: 12px; margin-top: 6px; display: none;">
                        Los ministros listados están disponibles para la fecha/hora seleccionada
                      </p>
                      ${ministroService.getActive().length === 0 ? `
                        <p style="color: #ef4444; font-size: 12px; margin-top: 6px;">
                          No hay Ministros de Fe activos. Agrega uno en "Gestionar Ministros de Fe".
                        </p>
                      ` : ''}
                    </div>
                  </div>

                  <div class="form-group">
                    <label>Lugar de la Reunión <span class="required">*</span></label>
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;" id="location-options-container"
                         data-user-address="${org.assemblyAddress || ''}"
                         data-org-address="${orgAddress}"
                         data-muni-address="Blanco Encalada 1335, Renca">
                      <label class="location-option-card ${org.assemblyAddress ? 'selected' : ''}">
                        <input type="radio" name="locationOption" value="user" ${org.assemblyAddress ? 'checked' : ''}>
                        <div class="location-option-content">
                          <div class="location-option-title">Dirección del usuario</div>
                          <div class="location-option-address">${org.assemblyAddress || 'No especificada'}</div>
                        </div>
                      </label>
                      <label class="location-option-card ${!org.assemblyAddress && orgAddress ? 'selected' : ''}">
                        <input type="radio" name="locationOption" value="org" ${!org.assemblyAddress && orgAddress ? 'checked' : ''}>
                        <div class="location-option-content">
                          <div class="location-option-title">Sede de la organización</div>
                          <div class="location-option-address">${orgAddress || 'No especificada'}</div>
                        </div>
                      </label>
                      <label class="location-option-card">
                        <input type="radio" name="locationOption" value="muni">
                        <div class="location-option-content">
                          <div class="location-option-title">Municipalidad de Renca</div>
                          <div class="location-option-address">Blanco Encalada 1335, Renca</div>
                        </div>
                      </label>
                      <label class="location-option-card">
                        <input type="radio" name="locationOption" value="custom">
                        <div class="location-option-content">
                          <div class="location-option-title">Otra dirección</div>
                          <input type="text" id="custom-location-input" placeholder="Escriba la dirección..."
                            style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 6px; display: none;"
                            disabled>
                        </div>
                      </label>
                    </div>
                    <input type="hidden" name="location" id="final-location" value="${org.assemblyAddress || orgAddress || ''}" required>
                  </div>

                  <div style="display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary ministro-close">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Agendar Ministro</button>
                  </div>
                </form>

                <div style="text-align: center; margin: 16px 0; color: #94a3b8; font-size: 13px;">
                  ── ¿La documentación tiene problemas? ──
                </div>
                <button type="button" id="btn-request-corrections" class="ministro-btn-edit" style="width: 100%; background: #fef2f2; color: #dc2626; border-color: #fecaca;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  Solicitar Correcciones al Usuario
                </button>

                <!-- Panel de correcciones v2 (oculto por defecto) -->
                <div id="corrections-panel" style="display: none;">
                  <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin-top: 12px;">
                    <h4 style="margin: 0 0 4px; color: #991b1b; font-size: 15px; font-weight: 700;">Solicitar Correcciones</h4>
                    <p style="margin: 0 0 16px; color: #b91c1c; font-size: 12px;">Selecciona los ítems específicos que requieren corrección. Al marcar uno, escribe la observación.</p>

                    <div style="display: grid; gap: 6px;" id="corrections-accordion">

                      <!-- Sección 1: Datos Generales -->
                      <div class="corr-accordion-section">
                        <div class="corr-accordion-header" style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; user-select: none;">
                          <span style="transition: transform 0.2s; font-size: 11px;">&#9654;</span>
                          <span style="font-size: 13px; font-weight: 600; color: #1e293b; flex: 1;">Datos de la Organizaci&oacute;n</span>
                          <span class="corr-section-count" style="background: #e2e8f0; color: #64748b; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">0</span>
                        </div>
                        <div class="corr-accordion-body" style="display: none; padding: 8px 0 0 0;">
                          ${(() => {
                            const datosFields = [
                              { field: 'organizationName', label: 'Nombre', value: org.organizationName || '' },
                              { field: 'address', label: 'Direcci\u00f3n', value: org.address || '' },
                              { field: 'commune', label: 'Comuna', value: org.comuna || org.commune || 'Renca' },
                              { field: 'region', label: 'Regi\u00f3n', value: org.region || 'Metropolitana' },
                              { field: 'neighborhood', label: 'Unidad Vecinal', value: org.unidadVecinal || '' },
                              { field: 'email', label: 'Email', value: org.contactEmail || '' },
                              { field: 'phone', label: 'Tel\u00e9fono', value: org.contactPhone || '' },
                              { field: 'description', label: 'Descripci\u00f3n', value: org.description || '' },
                              { field: 'objectives', label: 'Objetivos', value: org.objectives || '' }
                            ];
                            return datosFields.map(f => `
                              <div class="correction-selectable-item" data-category="datos_generales" data-field="${f.field}" style="padding: 6px 10px; border: 1px solid #f1f5f9; border-radius: 6px; margin-bottom: 4px;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; color: #334155;">
                                  <input type="checkbox" class="correction-item-check">
                                  <span style="font-weight: 600; min-width: 90px;">${f.label}:</span>
                                  <span style="color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.value || '(vac\u00edo)'}</span>
                                </label>
                                <textarea class="correction-item-message" style="display: none; width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; resize: vertical; min-height: 40px; font-family: inherit;" placeholder="Observaci\u00f3n sobre ${f.label.toLowerCase()}..."></textarea>
                              </div>
                            `).join('');
                          })()}
                        </div>
                      </div>

                      <!-- Sección 2: Directorio -->
                      <div class="corr-accordion-section">
                        <div class="corr-accordion-header" style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; user-select: none;">
                          <span style="transition: transform 0.2s; font-size: 11px;">&#9654;</span>
                          <span style="font-size: 13px; font-weight: 600; color: #1e293b; flex: 1;">Directorio Provisorio</span>
                          <span class="corr-section-count" style="background: #e2e8f0; color: #64748b; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">0</span>
                        </div>
                        <div class="corr-accordion-body" style="display: none; padding: 8px 0 0 0;">
                          ${(() => {
                            const dirItems = [];
                            ['president', 'secretary', 'treasurer'].forEach(cargo => {
                              const m = dir[cargo];
                              if (m) dirItems.push({ memberId: m.rut || cargo, memberName: extractName(m), role: cargoLabels[cargo] || cargo });
                            });
                            additionalMembers.forEach(m => {
                              dirItems.push({ memberId: m.rut || m.id || '', memberName: extractName(m), role: cargoLabels[m.role] || m.role || 'Director' });
                            });
                            if (dirItems.length === 0) return '<p style="color: #94a3b8; font-size: 12px; padding: 4px 10px;">No hay miembros de directorio registrados</p>';
                            return dirItems.map(d => `
                              <div class="correction-selectable-item" data-category="directorio" data-member-id="${d.memberId}" data-member-name="${d.memberName}" data-role="${d.role}" style="padding: 6px 10px; border: 1px solid #f1f5f9; border-radius: 6px; margin-bottom: 4px;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; color: #334155;">
                                  <input type="checkbox" class="correction-item-check">
                                  <span style="font-weight: 600;">${d.role}:</span>
                                  <span style="color: #64748b;">${d.memberName}</span>
                                </label>
                                <textarea class="correction-item-message" style="display: none; width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; resize: vertical; min-height: 40px; font-family: inherit;" placeholder="Observaci\u00f3n sobre este miembro..."></textarea>
                              </div>
                            `).join('');
                          })()}
                        </div>
                      </div>

                      <!-- Sección 3: Comisión Electoral -->
                      <div class="corr-accordion-section">
                        <div class="corr-accordion-header" style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; user-select: none;">
                          <span style="transition: transform 0.2s; font-size: 11px;">&#9654;</span>
                          <span style="font-size: 13px; font-weight: 600; color: #1e293b; flex: 1;">Comisi&oacute;n Electoral</span>
                          <span class="corr-section-count" style="background: #e2e8f0; color: #64748b; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">0</span>
                        </div>
                        <div class="corr-accordion-body" style="display: none; padding: 8px 0 0 0;">
                          ${(() => {
                            if (!commission || commission.length === 0) return '<p style="color: #94a3b8; font-size: 12px; padding: 4px 10px;">No se registr\u00f3 comisi\u00f3n electoral</p>';
                            return commission.map((m, i) => {
                              const name = extractName(m);
                              const role = ['Presidente', 'Secretario', 'Vocal'][i] || 'Miembro';
                              return `
                              <div class="correction-selectable-item" data-category="comision_electoral" data-member-id="${m.rut || m.id || ''}" data-member-name="${name}" data-role="${role}" style="padding: 6px 10px; border: 1px solid #f1f5f9; border-radius: 6px; margin-bottom: 4px;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; color: #334155;">
                                  <input type="checkbox" class="correction-item-check">
                                  <span style="font-weight: 600;">${role}:</span>
                                  <span style="color: #64748b;">${name}</span>
                                </label>
                                <textarea class="correction-item-message" style="display: none; width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; resize: vertical; min-height: 40px; font-family: inherit;" placeholder="Observaci\u00f3n sobre este miembro..."></textarea>
                              </div>`;
                            }).join('');
                          })()}
                        </div>
                      </div>

                      <!-- Sección 4: Miembros Fundadores -->
                      <div class="corr-accordion-section">
                        <div class="corr-accordion-header" style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; user-select: none;">
                          <span style="transition: transform 0.2s; font-size: 11px;">&#9654;</span>
                          <span style="font-size: 13px; font-weight: 600; color: #1e293b; flex: 1;">Miembros Fundadores (${allMembers.length})</span>
                          <span class="corr-section-count" style="background: #e2e8f0; color: #64748b; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">0</span>
                        </div>
                        <div class="corr-accordion-body" style="display: none; padding: 8px 0 0 0;">
                          ${allMembers.length > 5 ? `<input type="text" class="corr-member-search" placeholder="Buscar miembro por nombre o RUT..." style="width: 100%; padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; margin-bottom: 6px; font-family: inherit;">` : ''}
                          <div class="corr-members-list" style="max-height: 300px; overflow-y: auto;">
                          ${(() => {
                            if (allMembers.length === 0) return '<p style="color: #94a3b8; font-size: 12px; padding: 4px 10px;">No se registraron miembros</p>';
                            return allMembers.map((m, i) => {
                              const name = extractName(m);
                              const rut = m.rut || '';
                              return `
                              <div class="correction-selectable-item" data-category="miembros" data-member-id="${m.id || m._id || rut || i}" data-member-name="${name}" data-searchable="${name.toLowerCase()} ${rut.toLowerCase()}" style="padding: 6px 10px; border: 1px solid #f1f5f9; border-radius: 6px; margin-bottom: 4px;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; color: #334155;">
                                  <input type="checkbox" class="correction-item-check">
                                  <span style="font-weight: 600; min-width: 24px; color: #94a3b8;">${i + 1}.</span>
                                  <span style="flex: 1;">${name}</span>
                                  <span style="color: #94a3b8; font-size: 11px;">${rut}</span>
                                </label>
                                <textarea class="correction-item-message" style="display: none; width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; resize: vertical; min-height: 40px; font-family: inherit;" placeholder="Observaci\u00f3n sobre este miembro..."></textarea>
                              </div>`;
                            }).join('');
                          })()}
                          </div>
                        </div>
                      </div>

                      <!-- Sección 5: Documentos (se puebla async) -->
                      <div class="corr-accordion-section">
                        <div class="corr-accordion-header" style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; user-select: none;">
                          <span style="transition: transform 0.2s; font-size: 11px;">&#9654;</span>
                          <span style="font-size: 13px; font-weight: 600; color: #1e293b; flex: 1;">Documentos</span>
                          <span class="corr-section-count" style="background: #e2e8f0; color: #64748b; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">0</span>
                        </div>
                        <div class="corr-accordion-body" style="display: none; padding: 8px 0 0 0;">
                          <div id="corr-docs-list"><p style="color: #94a3b8; font-size: 12px; padding: 4px 10px;">Cargando documentos...</p></div>
                        </div>
                      </div>

                      <!-- Sección 6: Certificados (se puebla async) -->
                      <div class="corr-accordion-section">
                        <div class="corr-accordion-header" style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; user-select: none;">
                          <span style="transition: transform 0.2s; font-size: 11px;">&#9654;</span>
                          <span style="font-size: 13px; font-weight: 600; color: #1e293b; flex: 1;">Certificados</span>
                          <span class="corr-section-count" style="background: #e2e8f0; color: #64748b; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">0</span>
                        </div>
                        <div class="corr-accordion-body" style="display: none; padding: 8px 0 0 0;">
                          <div id="corr-certs-list"><p style="color: #94a3b8; font-size: 12px; padding: 4px 10px;">Cargando certificados...</p></div>
                        </div>
                      </div>

                    </div>

                    <div style="margin-top: 14px;">
                      <label style="font-size: 13px; font-weight: 600; color: #1e293b; display: block; margin-bottom: 6px;">Observaci&oacute;n General</label>
                      <textarea id="corrections-general-comment" style="width: 100%; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; resize: vertical; min-height: 70px; font-family: inherit;" placeholder="Comentario general sobre las correcciones requeridas..."></textarea>
                    </div>

                    <div style="display: flex; gap: 10px; margin-top: 16px;">
                      <button type="button" id="btn-cancel-corrections" class="btn btn-secondary" style="flex: 1;">Cancelar</button>
                      <button type="button" id="btn-send-corrections" class="btn" style="flex: 1; background: #dc2626; color: white; border: none; border-radius: 8px; padding: 10px; font-weight: 600; cursor: pointer;">Enviar Correcciones (0)</button>
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
          `}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners - Tabs de documentación
    const docTabs = modal.querySelectorAll('.admin-doc-tab');
    const docContents = modal.querySelectorAll('.admin-doc-tab-content');
    docTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        docTabs.forEach(t => {
          t.style.color = '#64748b';
          t.style.fontWeight = '500';
          t.style.background = 'transparent';
          t.style.borderBottom = '2px solid transparent';
          t.classList.remove('active');
        });
        tab.style.color = '#2563eb';
        tab.style.fontWeight = '600';
        tab.style.background = 'white';
        tab.style.borderBottom = '2px solid #2563eb';
        tab.classList.add('active');
        docContents.forEach(c => {
          c.style.display = c.dataset.tabContent === target ? 'block' : 'none';
        });
      });
    });

    // Cargar documentos generados asincrónicamente desde colección separada
    const loadGeneratedDocs = async () => {
      const container = modal.querySelector('#generated-docs-container');
      const loading = modal.querySelector('#generated-docs-loading');
      if (!container) return;

      try {
        const { apiService } = await import('../../services/ApiService.js');
        const genDocs = await apiService.get(`/organizations/${org._id}/generated-documents`);

        if (!genDocs || genDocs.length === 0) {
          container.innerHTML = '';
          return;
        }

        const DOC_TYPE_LABELS = {
          'ACTA_CONSTITUTIVA': 'Acta Constitutiva',
          'ESTATUTOS': 'Estatutos',
          'REGISTRO_SOCIOS': 'Registro de Socios',
          'CERTIFICADO_MINISTRO_FE': 'Certificado del Ministro de Fe',
          'CERTIFICACION_MUNICIPAL': 'Certificación Municipal',
          'DEPOSITO_ANTECEDENTES': 'Depósito de Antecedentes'
        };
        const DOC_ICONS = { 'ACTA_CONSTITUTIVA': '📜', 'ESTATUTOS': '📘', 'REGISTRO_SOCIOS': '📋', 'CERTIFICADO_MINISTRO_FE': '🏛️', 'CERTIFICACION_MUNICIPAL': '🏢', 'DEPOSITO_ANTECEDENTES': '📁' };
        const getDocLabel = (doc) => {
          if (DOC_TYPE_LABELS[doc.docType]) return DOC_TYPE_LABELS[doc.docType];
          if (doc.docType && doc.docType.startsWith('DECLARACION_JURADA')) return 'Declaración Jurada' + (doc.cargoNombre ? ' - ' + doc.cargoNombre : '');
          return doc.docType || 'Documento';
        };
        const getDocIcon = (dt) => DOC_ICONS[dt] || (dt && dt.startsWith('DECLARACION_JURADA') ? '📄' : '📄');

        let html = '<h5 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 10px; display: flex; align-items: center; gap: 6px;">📂 Documentos Generados del Wizard <span style="background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">' + genDocs.length + '</span></h5>';
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">';
        genDocs.forEach((doc, idx) => {
          const label = getDocLabel(doc);
          const icon = getDocIcon(doc.docType);
          const isEdited = !!doc.editedAt;
          html += '<div style="display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px;">';
          html += '<div style="display: flex; align-items: center; gap: 6px;"><span style="font-size: 18px;">' + icon + '</span><span style="font-weight: 600; color: #334155; flex: 1; font-size: 12px; line-height: 1.3;">' + label + '</span></div>';
          if (isEdited) html += '<span style="display: inline-flex; align-items: center; gap: 3px; background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; width: fit-content;">✏️ Editado</span>';
          html += '<button class="btn-view-gen-doc" data-doc-idx="' + idx + '" style="margin-top: auto; padding: 5px 10px; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;">Ver</button>';
          html += '</div>';
        });
        html += '</div><hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">';
        container.innerHTML = html;

        // Event listeners para botones "Ver"
        // Formatea texto plano del documento a HTML con estilos (replica el wizard)
        const formatDocContent = (rawContent) => {
          let html = rawContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          // Resaltar RUTs
          html = html.replace(/(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])/gi, '<span style="background: #dbeafe; padding: 1px 3px; border-radius: 3px; color: #1e40af;">$1</span>');
          const lines = html.split('\n');
          const formatted = [];
          lines.forEach(line => {
            const trimmed = line.trim();
            // Separadores
            if (/^[═─━\-=_]{4,}$/.test(trimmed)) {
              formatted.push('<hr style="border: none; border-top: 1px solid #cbd5e1; margin: 12px 0;">');
              return;
            }
            // BORRADOR
            if (trimmed.includes('BORRADOR')) {
              formatted.push('<p style="text-align: center; color: #dc2626; font-weight: bold; font-size: 14pt; margin: 10px 0; padding: 8px; background: #fef2f2; border: 1px dashed #dc2626; border-radius: 4px;">' + trimmed + '</p>');
              return;
            }
            // Títulos (TODO MAYÚSCULAS, más de 3 chars con letras)
            if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && /[A-ZÁÉÍÓÚÑ]/.test(trimmed) && (!trimmed.includes(':') || trimmed.split(':')[0].length > 30)) {
              formatted.push('<p style="font-weight: bold; font-size: 13pt; text-align: center; margin: 18px 0 8px; text-transform: uppercase;">' + trimmed + '</p>');
              return;
            }
            // Líneas vacías
            if (trimmed === '') { formatted.push('<br>'); return; }
            // Líneas normales (preservar indentación)
            const leading = line.match(/^\s*/)[0].length;
            const indent = leading > 0 ? 'padding-left: ' + (leading * 7) + 'px;' : '';
            formatted.push('<p style="margin: 3px 0; ' + indent + '">' + trimmed + '</p>');
          });
          return formatted.join('');
        };

        container.querySelectorAll('.btn-view-gen-doc').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.docIdx);
            const doc = genDocs[idx];
            if (!doc) return;
            let label = getDocLabel(doc);
            const subModal = document.createElement('div');
            subModal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200001; display: flex; align-items: center; justify-content: center; padding: 20px;';
            const formattedContent = formatDocContent(doc.content.split('========== FIRMAS ==========')[0] || doc.content);
            subModal.innerHTML = '<div style="background: #f1f5f9; border-radius: 12px; width: 100%; max-width: 900px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.25);">'
              + '<div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); border-radius: 12px 12px 0 0;">'
              + '<h4 style="margin: 0; font-size: 16px; color: white;">' + label + (doc.editedAt ? ' <span style="background: rgba(255,255,255,0.2); color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">Editado</span>' : '') + '</h4>'
              + '<button class="close-sub-modal" style="background: rgba(255,255,255,0.2); border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 20px; color: white; display: flex; align-items: center; justify-content: center;">&times;</button>'
              + '</div>'
              + '<div style="flex: 1; overflow-y: auto; padding: 20px; background: #f8fafc;">'
              + '<div class="document-page" style="max-width: 816px; width: 100%; margin: 0 auto; background: white; box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-radius: 4px;">'
              + '<img src="/doc-header.png" alt="" style="width: 100%; height: auto; display: block;" onerror="this.style.display=\'none\'">'
              + '<div style="padding: 30px 40px; min-height: 600px; font-family: \'Times New Roman\', Times, serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a;">' + formattedContent + '</div>'
              + '<img src="/doc-footer.png" alt="" style="width: 100%; height: auto; display: block; margin-top: auto;" onerror="this.style.display=\'none\'">'
              + '</div></div></div>';
            document.body.appendChild(subModal);
            subModal.querySelector('.close-sub-modal').addEventListener('click', () => subModal.remove());
            subModal.addEventListener('click', (e) => { if (e.target === subModal) subModal.remove(); });
          });
        });
      } catch (err) {
        console.error('Error cargando documentos generados:', err);
        if (loading) loading.textContent = '';
      }
    };
    loadGeneratedDocs();

    // Cargar certificados base64 desde colección separada
    const loadCertificateFiles = async () => {
      const container = modal.querySelector('#certificate-files-container');
      if (!container) return;
      try {
        const { apiService } = await import('../../services/ApiService.js');
        const certFiles = await apiService.get(`/organizations/${org._id}/certificate-files`);
        console.log('📋 [Admin] certFiles desde API:', certFiles?.length || 0, 'archivos', certFiles);
        const cargoLabelsEs = { presidente: 'Presidente', secretario: 'Secretario', tesorero: 'Tesorero', vicepresidente: 'Vicepresidente', director: 'Director', director1: 'Director 1', director2: 'Director 2', comision1: 'Com. Electoral 1', comision2: 'Com. Electoral 2', comision3: 'Com. Electoral 3' };

        // También usar metadata de org.certificatesStep5 para saber qué cargos existen
        const certsMeta = org.certificatesStep5 || [];
        console.log('📋 [Admin] certsMeta desde org:', certsMeta);
        const metaArray = Array.isArray(certsMeta) ? certsMeta : Object.entries(certsMeta).filter(([k]) => k !== '_id').map(([key, val]) => ({ memberId: key, memberName: typeof val === 'object' ? (val.memberName || val.name || '') : key }));
        console.log('📋 [Admin] metaArray:', metaArray);

        // Merge: metadata de org + base64 de colección separada
        const mergedCerts = metaArray.map(meta => {
          const fileData = certFiles.find(f => f.memberId === meta.memberId);
          console.log('📋 [Admin] Merge cert:', meta.memberId, '→ fileData encontrado:', !!fileData, fileData ? 'cert length: ' + (fileData.certificate?.length || 0) : '');
          return { ...meta, certificate: fileData ? fileData.certificate : '' };
        });
        // También agregar certs que solo están en la colección separada
        certFiles.forEach(f => {
          if (!mergedCerts.find(m => m.memberId === f.memberId)) {
            mergedCerts.push(f);
          }
        });

        const hasAnyCertData = mergedCerts.some(c => c.certificate && c.certificate.length > 50);
        let html = '<h5 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 8px;">Certificados de Antecedentes (Directorio)</h5>';
        if (!hasAnyCertData && certFiles.length === 0 && metaArray.length > 0) {
          html += '<p style="color: #f59e0b; font-size: 12px; margin: 0 0 8px; padding: 6px 10px; background: #fefce8; border: 1px solid #fef08a; border-radius: 6px;">Los archivos de certificados no se encontraron en el servidor. Es posible que la solicitud se haya creado antes de esta funcionalidad o que hubo un error al guardarlos.</p>';
        }
        if (mergedCerts.length > 0) {
          html += '<div style="display: grid; gap: 6px;">';
          mergedCerts.forEach((cert, idx) => {
            const cargoId = cert.memberId || '';
            const label = cargoLabelsEs[cargoId] || cargoId || 'Desconocido';
            const fileName = cert.memberName || cert.name || '';
            const hasData = !!(cert.certificate && cert.certificate.length > 50);
            html += '<div style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: ' + (hasData ? '#f0fdf4' : '#fef2f2') + '; border: 1px solid ' + (hasData ? '#bbf7d0' : '#fecaca') + '; border-radius: 8px; font-size: 13px;">';
            html += '<span style="color: ' + (hasData ? '#16a34a' : '#dc2626') + '; font-size: 16px;">' + (hasData ? '✓' : '✗') + '</span>';
            html += '<span style="font-weight: 600; color: #475569; min-width: 90px;">' + label + '</span>';
            html += '<span style="color: #64748b; flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + (fileName || '') + '</span>';
            if (hasData) {
              html += '<button class="btn-view-cert" data-cert-idx="' + idx + '" style="padding: 4px 12px; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap;">Ver</button>';
              html += '<button class="btn-download-cert" data-cert-idx="' + idx + '" style="padding: 4px 12px; background: #059669; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap;">Descargar</button>';
            } else {
              html += '<span style="color: #991b1b; font-size: 12px;">Sin archivo</span>';
            }
            html += '</div>';
          });
          html += '</div>';
        } else {
          html += '<p style="color: #94a3b8; font-size: 13px;">No se cargaron certificados del directorio</p>';
        }
        container.innerHTML = html;

        // Event listeners para botones "Ver" certificado
        container.querySelectorAll('.btn-view-cert').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.certIdx);
            const cert = mergedCerts[idx];
            if (!cert || !cert.certificate) return;
            const cargoId = cert.memberId || '';
            const label = cargoLabelsEs[cargoId] || cargoId || 'Certificado';
            const base64 = cert.certificate;
            const isImage = base64.startsWith('data:image') || (!base64.startsWith('data:') && !base64.startsWith('JVBER'));
            const dataUri = base64.startsWith('data:') ? base64 : (isImage ? 'data:image/jpeg;base64,' + base64 : 'data:application/pdf;base64,' + base64);

            const certModal = document.createElement('div');
            certModal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200002; display: flex; align-items: center; justify-content: center; padding: 20px;';
            let contentHtml;
            if (isImage || base64.startsWith('data:image')) {
              contentHtml = '<img src="' + dataUri + '" style="max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 8px;" />';
            } else {
              contentHtml = '<iframe src="' + dataUri + '" style="width: 100%; height: 70vh; border: none; border-radius: 8px;"></iframe>';
            }
            certModal.innerHTML = '<div style="background: white; border-radius: 12px; width: 100%; max-width: 800px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.25);"><div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #e2e8f0;"><h4 style="margin: 0; font-size: 15px; color: #1e293b;">Certificado - ' + label + '</h4><button class="close-cert-modal" style="background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px; color: #64748b; display: flex; align-items: center; justify-content: center;">&times;</button></div><div style="flex: 1; overflow: auto; padding: 20px; display: flex; align-items: center; justify-content: center; background: #f8fafc;">' + contentHtml + '</div></div>';
            document.body.appendChild(certModal);
            certModal.querySelector('.close-cert-modal').addEventListener('click', () => certModal.remove());
            certModal.addEventListener('click', (e) => { if (e.target === certModal) certModal.remove(); });
          });
        });

        // Event listeners para botones "Descargar" certificado
        container.querySelectorAll('.btn-download-cert').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.certIdx);
            const cert = mergedCerts[idx];
            if (!cert || !cert.certificate) return;
            const cargoId = cert.memberId || '';
            const label = cargoLabelsEs[cargoId] || cargoId || 'certificado';
            const base64 = cert.certificate;
            const isImage = base64.startsWith('data:image') || (!base64.startsWith('data:') && !base64.startsWith('JVBER'));
            const dataUri = base64.startsWith('data:') ? base64 : (isImage ? 'data:image/jpeg;base64,' + base64 : 'data:application/pdf;base64,' + base64);
            const ext = isImage ? '.jpg' : '.pdf';
            const a = document.createElement('a');
            a.href = dataUri;
            a.download = 'certificado_' + label.toLowerCase().replace(/\s+/g, '_') + ext;
            document.body.appendChild(a);
            a.click();
            a.remove();
          });
        });
      } catch (err) {
        console.error('Error cargando certificados:', err);
        const loading = container.querySelector('#certificate-files-loading');
        if (loading) loading.textContent = 'No se pudieron cargar los certificados';
      }
    };
    loadCertificateFiles();

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
        const availableMinistros = allMinistros.filter(ministro => {
          const mId = ministro._id || ministro.id;
          return ministroAvailabilityService.isAvailable(mId, selectedDate, selectedTime);
        });

        // Actualizar dropdown
        if (availableMinistros.length === 0) {
          ministroSelect.innerHTML = '<option value="">⚠️ No hay ministros disponibles para esta fecha/hora</option>';
          warning.style.display = 'block';
          warning.style.color = '#ef4444';
          warning.textContent = '⚠️ Ningún ministro está disponible. Todos tienen bloqueada esta fecha/hora.';
        } else {
          ministroSelect.innerHTML = `
            <option value="">-- Seleccionar Ministro de Fe (${availableMinistros.length} disponible${availableMinistros.length !== 1 ? 's' : ''}) --</option>
            ${availableMinistros.map(ministro => {
              const mId = ministro._id || ministro.id;
              return `
              <option value="${mId}">
                ${ministro.firstName} ${ministro.lastName} - ${ministro.rut}
              </option>
            `}).join('')}
          `;
          warning.style.display = 'block';
          warning.style.color = '#059669';
          warning.textContent = `✓ ${availableMinistros.length} ministro(s) disponible(s) para esta fecha/hora`;
        }

        // Mostrar ministros no disponibles en consola para debug
        const unavailableMinistros = allMinistros.filter(ministro => {
          const mId = ministro._id || ministro.id;
          return !ministroAvailabilityService.isAvailable(mId, selectedDate, selectedTime);
        });
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
      const locationOptionCards = scheduleForm.querySelectorAll('.location-option-card');
      const locationContainer = scheduleForm.querySelector('#location-options-container');

      // Obtener direcciones de los data attributes
      const userAddress = locationContainer?.dataset.userAddress || '';
      const orgAddressValue = locationContainer?.dataset.orgAddress || '';
      const muniAddress = locationContainer?.dataset.muniAddress || 'Blanco Encalada 1335, Renca';

      const updateLocationValue = () => {
        const selectedRadio = scheduleForm.querySelector('input[name="locationOption"]:checked');
        if (!selectedRadio) return;

        // Actualizar estilos visuales usando clases CSS
        locationOptionCards.forEach(card => {
          card.classList.remove('selected');
        });
        const selectedCard = selectedRadio.closest('.location-option-card');
        if (selectedCard) {
          selectedCard.classList.add('selected');
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
            finalLocationInput.value = orgAddressValue;
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

        // Agregar loading al botón
        const submitBtn = scheduleForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-small"></span> Agendando...';

        const formData = new FormData(scheduleForm);

        // ID de la organización
        const orgId = org._id || org.id;

        // Obtener el Ministro de Fe seleccionado
        const ministroId = formData.get('ministroId');
        const ministro = ministroService.getById(ministroId);

        if (!ministro) {
          showToast('Error: Ministro de Fe no encontrado. Verifica que haya ministros activos.', 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
          return;
        }

        const mId = ministro._id || ministro.id;
        const scheduledDate = formData.get('scheduledDate');
        const scheduledTime = formData.get('scheduledTime');
        const location = formData.get('location');

        // Verificar disponibilidad del ministro
        const isAvailable = ministroAvailabilityService.isAvailable(mId, scheduledDate, scheduledTime);
        if (!isAvailable) {
          showToast('⚠️ El ministro no está disponible en esta fecha/hora. Ha bloqueado su disponibilidad.', 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
          return;
        }

        // Verificar conflictos de horario (await porque es async)
        const hasConflict = await ministroAssignmentService.hasScheduleConflict(mId, scheduledDate, scheduledTime);
        if (hasConflict) {
          // Formatear fecha correctamente sin problemas de timezone
          let formattedConflictDate = scheduledDate;
          if (scheduledDate && typeof scheduledDate === 'string') {
            const [year, month, day] = scheduledDate.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day, 12, 0, 0);
            formattedConflictDate = dateObj.toLocaleDateString('es-CL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            });
          }

          const confirmed = confirm(
            `⚠️ ADVERTENCIA: El ministro ${ministro.firstName} ${ministro.lastName} ya tiene otra asamblea agendada en esta fecha y hora.\n\n` +
            `Fecha: ${formattedConflictDate}\n` +
            `Hora: ${scheduledTime}\n\n` +
            `¿Estás seguro de que deseas continuar con esta asignación?\n` +
            `(El ministro podría realizar múltiples asambleas al mismo horario)`
          );

          if (!confirmed) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            return;
          }
        }

        const ministroData = {
          ministroId: mId,
          ministroName: `${ministro.firstName} ${ministro.lastName}`,
          ministroRut: ministro.rut,
          scheduledDate,
          scheduledTime,
          location
        };

        try {
          const updated = await organizationsService.scheduleMinistro(orgId, ministroData);
          if (updated) {
            // Crear asignación para el ministro
            ministroAssignmentService.create({
              ministroId: mId,
              ministroName: `${ministro.firstName} ${ministro.lastName}`,
              ministroRut: ministro.rut,
              organizationId: orgId,
              organizationName: getOrgName(org) || org.organizationName,
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
              message: `¡Tu solicitud ha sido procesada! Se ha asignado un Ministro de Fe para la asamblea de ${getOrgName(org)}.\n\n` +
                      `Ministro: ${ministro.firstName} ${ministro.lastName}\n` +
                      `Fecha: ${formatDateSafe(scheduledDate)} a las ${scheduledTime}\n` +
                      `Lugar: ${location}`,
              data: { organizationId: orgId, ministroData }
            });

            // Notificación al ministro - nueva asignación
            notificationService.create({
              ministroId: mId,
              type: 'new_assignment',
              title: '⚖️ Nueva Asignación de Asamblea',
              message: `Se te ha asignado una nueva asamblea constitutiva.\n\n` +
                      `Organización: ${getOrgName(org)}\n` +
                      `Fecha: ${formatDateSafe(scheduledDate)} a las ${scheduledTime}\n` +
                      `Lugar: ${location}`,
              data: { organizationId: orgId, scheduledDate, scheduledTime, location }
            });

            showToast('Ministro de Fe agendado correctamente. Notificados: usuario y ministro.', 'success');
            modal.remove();

            // Mostrar modal de duración de bloqueo
            this._showBlockDurationModal({
              ministroId: mId,
              ministroName: `${ministro.firstName} ${ministro.lastName}`,
              date: scheduledDate,
              time: scheduledTime,
              orgName: getOrgName(org) || org.organizationName
            });

            this.renderApplicationsList();
            this.updateStats();
          } else {
            showToast('Error al agendar Ministro de Fe', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
          }
        } catch (error) {
          console.error('Error scheduling ministro:', error);
          showToast('Error al agendar Ministro de Fe: ' + (error.message || 'Error desconocido'), 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
      });
    }

    // Corrections panel logic
    const btnRequestCorrections = modal.querySelector('#btn-request-corrections');
    const correctionsPanel = modal.querySelector('#corrections-panel');
    if (btnRequestCorrections && correctionsPanel) {
      const scheduleFormEl = modal.querySelector('#schedule-ministro-form');
      const actionAlert = modal.querySelector('.ministro-action-alert');
      const correctionsSeparator = btnRequestCorrections.previousElementSibling; // the "── ¿La documentación tiene problemas? ──" div

      // --- v2 Corrections Panel Logic ---

      const updateCorrectionCount = () => {
        const total = correctionsPanel.querySelectorAll('.correction-item-check:checked').length;
        const btnSend = modal.querySelector('#btn-send-corrections');
        if (btnSend) btnSend.textContent = `Enviar Correcciones (${total})`;
        // Update per-section counts
        correctionsPanel.querySelectorAll('.corr-accordion-section').forEach(sec => {
          const count = sec.querySelectorAll('.correction-item-check:checked').length;
          const badge = sec.querySelector('.corr-section-count');
          if (badge) {
            badge.textContent = count;
            badge.style.background = count > 0 ? '#fecaca' : '#e2e8f0';
            badge.style.color = count > 0 ? '#dc2626' : '#64748b';
          }
        });
      };

      // Accordion toggle
      correctionsPanel.querySelectorAll('.corr-accordion-header').forEach(header => {
        header.addEventListener('click', () => {
          const body = header.nextElementSibling;
          const arrow = header.querySelector('span');
          if (body.style.display === 'none') {
            body.style.display = 'block';
            if (arrow) arrow.style.transform = 'rotate(90deg)';
          } else {
            body.style.display = 'none';
            if (arrow) arrow.style.transform = '';
          }
        });
      });

      // Item checkbox → show/hide textarea
      correctionsPanel.addEventListener('change', (e) => {
        if (e.target.classList.contains('correction-item-check')) {
          const textarea = e.target.closest('.correction-selectable-item')?.querySelector('.correction-item-message');
          if (textarea) {
            textarea.style.display = e.target.checked ? 'block' : 'none';
            if (!e.target.checked) textarea.value = '';
          }
          updateCorrectionCount();
        }
      });

      // Member search filter
      const memberSearch = correctionsPanel.querySelector('.corr-member-search');
      if (memberSearch) {
        memberSearch.addEventListener('input', () => {
          const q = memberSearch.value.toLowerCase();
          correctionsPanel.querySelectorAll('.corr-members-list .correction-selectable-item').forEach(item => {
            const searchable = item.dataset.searchable || '';
            item.style.display = searchable.includes(q) ? '' : 'none';
          });
        });
      }

      // Populate documents section async
      const populateCorrDocs = async () => {
        const container = correctionsPanel.querySelector('#corr-docs-list');
        if (!container) return;
        try {
          const { apiService } = await import('../../services/ApiService.js');
          const genDocs = await apiService.get(`/organizations/${org._id}/generated-documents`);
          if (!genDocs || genDocs.length === 0) {
            container.innerHTML = '<p style="color: #94a3b8; font-size: 12px; padding: 4px 10px;">No hay documentos generados</p>';
            return;
          }
          const DOC_LABELS = { 'ACTA_CONSTITUTIVA': 'Acta Constitutiva', 'ESTATUTOS': 'Estatutos', 'REGISTRO_SOCIOS': 'Registro de Socios', 'CERTIFICADO_MINISTRO_FE': 'Certificado del Ministro de Fe', 'CERTIFICACION_MUNICIPAL': 'Certificaci\u00f3n Municipal', 'DEPOSITO_ANTECEDENTES': 'Dep\u00f3sito de Antecedentes' };
          const getLabel = (doc) => {
            if (DOC_LABELS[doc.docType]) return DOC_LABELS[doc.docType];
            if (doc.docType && doc.docType.startsWith('DECLARACION_JURADA')) return 'Declaraci\u00f3n Jurada' + (doc.cargoNombre ? ' - ' + doc.cargoNombre : '');
            return doc.docType || 'Documento';
          };
          container.innerHTML = genDocs.map(doc => {
            const label = getLabel(doc);
            return `
              <div class="correction-selectable-item" data-category="documentos" data-doc-type="${doc.docType || ''}" style="padding: 6px 10px; border: 1px solid #f1f5f9; border-radius: 6px; margin-bottom: 4px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; color: #334155;">
                  <input type="checkbox" class="correction-item-check">
                  <span style="font-weight: 600;">${label}</span>
                </label>
                <textarea class="correction-item-message" style="display: none; width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; resize: vertical; min-height: 40px; font-family: inherit;" placeholder="Observaci\u00f3n sobre este documento..."></textarea>
              </div>`;
          }).join('');
        } catch (err) {
          container.innerHTML = '<p style="color: #ef4444; font-size: 12px; padding: 4px 10px;">Error cargando documentos</p>';
        }
      };

      // Populate certificates section async
      const populateCorrCerts = async () => {
        const container = correctionsPanel.querySelector('#corr-certs-list');
        if (!container) return;
        try {
          const { apiService } = await import('../../services/ApiService.js');
          const certFiles = await apiService.get(`/organizations/${org._id}/certificate-files`);
          const cargoLabelsEs = { presidente: 'Presidente', secretario: 'Secretario', tesorero: 'Tesorero', vicepresidente: 'Vicepresidente', director: 'Director', director1: 'Director 1', director2: 'Director 2', comision1: 'Com. Electoral 1', comision2: 'Com. Electoral 2', comision3: 'Com. Electoral 3' };
          const certsMeta = org.certificatesStep5 || [];
          const metaArray = Array.isArray(certsMeta) ? certsMeta : Object.entries(certsMeta).filter(([k]) => k !== '_id').map(([key, val]) => ({ memberId: key, memberName: typeof val === 'object' ? (val.memberName || val.name || '') : key }));
          const mergedCerts = metaArray.map(meta => {
            const fileData = certFiles.find(f => f.memberId === meta.memberId);
            return { ...meta, hasFile: !!(fileData && fileData.certificate && fileData.certificate.length > 50) };
          });
          certFiles.forEach(f => {
            if (!mergedCerts.find(m => m.memberId === f.memberId)) {
              mergedCerts.push({ ...f, hasFile: !!(f.certificate && f.certificate.length > 50) });
            }
          });
          if (mergedCerts.length === 0) {
            container.innerHTML = '<p style="color: #94a3b8; font-size: 12px; padding: 4px 10px;">No hay certificados registrados</p>';
            return;
          }
          container.innerHTML = mergedCerts.map(cert => {
            const cargoId = cert.memberId || '';
            const label = cargoLabelsEs[cargoId] || cargoId || 'Desconocido';
            const memberName = cert.memberName || cert.name || '';
            const displayLabel = label + (memberName ? ': ' + memberName : '');
            return `
              <div class="correction-selectable-item" data-category="certificados" data-member-id="${cargoId}" data-member-name="${memberName}" style="padding: 6px 10px; border: 1px solid #f1f5f9; border-radius: 6px; margin-bottom: 4px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; color: #334155;">
                  <input type="checkbox" class="correction-item-check">
                  <span style="font-weight: 600;">${displayLabel}</span>
                  <span style="color: ${cert.hasFile ? '#16a34a' : '#dc2626'}; font-size: 11px; margin-left: auto;">${cert.hasFile ? 'Con archivo' : 'Sin archivo'}</span>
                </label>
                <textarea class="correction-item-message" style="display: none; width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; resize: vertical; min-height: 40px; font-family: inherit;" placeholder="Observaci\u00f3n sobre este certificado..."></textarea>
              </div>`;
          }).join('');
        } catch (err) {
          container.innerHTML = '<p style="color: #ef4444; font-size: 12px; padding: 4px 10px;">Error cargando certificados</p>';
        }
      };

      // Open corrections panel
      btnRequestCorrections.addEventListener('click', () => {
        if (scheduleFormEl) scheduleFormEl.style.display = 'none';
        if (actionAlert) actionAlert.style.display = 'none';
        if (correctionsSeparator) correctionsSeparator.style.display = 'none';
        btnRequestCorrections.style.display = 'none';
        correctionsPanel.style.display = 'block';
        // Load async sections
        populateCorrDocs();
        populateCorrCerts();
      });

      // Cancel corrections
      const btnCancelCorrections = modal.querySelector('#btn-cancel-corrections');
      if (btnCancelCorrections) {
        btnCancelCorrections.addEventListener('click', () => {
          correctionsPanel.style.display = 'none';
          if (scheduleFormEl) scheduleFormEl.style.display = '';
          if (actionAlert) actionAlert.style.display = '';
          if (correctionsSeparator) correctionsSeparator.style.display = '';
          btnRequestCorrections.style.display = '';
          // Reset all
          correctionsPanel.querySelectorAll('.correction-item-check').forEach(chk => { chk.checked = false; });
          correctionsPanel.querySelectorAll('.correction-item-message').forEach(ta => { ta.style.display = 'none'; ta.value = ''; });
          const generalComment = modal.querySelector('#corrections-general-comment');
          if (generalComment) generalComment.value = '';
          updateCorrectionCount();
        });
      }

      // Send corrections (v2 format)
      const btnSendCorrections = modal.querySelector('#btn-send-corrections');
      if (btnSendCorrections) {
        btnSendCorrections.addEventListener('click', async () => {
          const checkedItems = correctionsPanel.querySelectorAll('.correction-item-check:checked');
          const generalComment = (modal.querySelector('#corrections-general-comment')?.value || '').trim();

          if (checkedItems.length === 0 && !generalComment) {
            showToast('Selecciona al menos un \u00edtem o escribe un comentario general', 'error');
            return;
          }

          // Build v2 corrections array
          const corrections = [];
          checkedItems.forEach(chk => {
            const item = chk.closest('.correction-selectable-item');
            if (!item) return;
            const category = item.dataset.category;
            const message = (item.querySelector('.correction-item-message')?.value || '').trim() || 'Requiere correcci\u00f3n';

            // Build label from context
            let label = '';
            if (category === 'datos_generales') {
              const fieldLabel = item.querySelector('span[style*="font-weight: 600"]');
              label = fieldLabel ? fieldLabel.textContent.replace(':', '').trim() : (item.dataset.field || 'Campo');
            } else if (category === 'documentos') {
              const docLabel = item.querySelector('span[style*="font-weight: 600"]');
              label = docLabel ? docLabel.textContent.trim() : (item.dataset.docType || 'Documento');
            } else if (category === 'certificados') {
              const certLabel = item.querySelector('span[style*="font-weight: 600"]');
              label = certLabel ? certLabel.textContent.trim() : 'Certificado';
            } else {
              // directorio, comision_electoral, miembros
              const role = item.dataset.role || '';
              const memberName = item.dataset.memberName || '';
              label = role ? (role + ': ' + memberName) : memberName;
            }

            corrections.push({
              category,
              field: item.dataset.field || undefined,
              memberId: item.dataset.memberId || undefined,
              memberName: item.dataset.memberName || undefined,
              role: item.dataset.role || undefined,
              docType: item.dataset.docType || undefined,
              label: label || 'Sin especificar',
              message
            });
          });

          if (corrections.length === 0 && !generalComment) {
            showToast('No se pudieron construir las correcciones', 'error');
            return;
          }

          const orgId = org._id || org.id;

          // Disable button
          btnSendCorrections.disabled = true;
          btnSendCorrections.textContent = 'Enviando...';

          try {
            await organizationsService.rejectWithCorrections(orgId, corrections, generalComment);
            showToast('Correcciones enviadas al usuario correctamente', 'success');
            modal.remove();
            this.renderApplicationsList();
            this.updateStats();
          } catch (error) {
            console.error('Error sending corrections:', error);
            showToast('Error al enviar correcciones: ' + (error.message || 'Error desconocido'), 'error');
            btnSendCorrections.disabled = false;
            btnSendCorrections.textContent = `Enviar Correcciones (${checkedItems.length})`;
          }
        });
      }
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

        const updated = await organizationsService.approveByMinistro(org.id, provisionalDirectorio, signatureData);
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

    // Obtener el ID correcto de la organización
    const orgId = org.id || org._id;

    // Obtener la asignación actual
    const currentAssignment = ministroAssignmentService.getByOrganizationId(orgId)?.[0];

    // Combinar datos: priorizar asignación, luego org.ministroData
    // NOTA: En el servidor, ministroData guarda "name" y "rut", no "ministroName" y "ministroRut"
    const ministroInfo = {
      ministroName: currentAssignment?.ministroName || org.ministroData?.ministroName || org.ministroData?.name || null,
      ministroRut: currentAssignment?.ministroRut || org.ministroData?.ministroRut || org.ministroData?.rut || null,
      scheduledDate: currentAssignment?.scheduledDate || org.ministroData?.scheduledDate || null,
      scheduledTime: currentAssignment?.scheduledTime || org.ministroData?.scheduledTime || null,
      location: currentAssignment?.location || org.ministroData?.location || null
    };

    // Formatear fecha para input date (yyyy-MM-dd)
    let dateForInput = '';
    if (ministroInfo.scheduledDate) {
      const dateStr = ministroInfo.scheduledDate;
      if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        dateForInput = dateStr.split('T')[0]; // Toma solo la parte yyyy-MM-dd
      } else if (dateStr instanceof Date) {
        dateForInput = dateStr.toISOString().split('T')[0];
      }
    }

    modal.innerHTML = `
      <div class="admin-review-modal ministro-request-modal" style="max-width: 600px;">
        <div class="review-modal-header ministro-modal-header-redesign" style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ea580c 100%) !important;">
          <div class="review-header-left">
            <div class="ministro-modal-icon" style="background: rgba(255,255,255,0.2);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </div>
            <div class="ministro-modal-titles">
              <h2>Modificar Asignación</h2>
              <p>${getOrgName(org)}</p>
            </div>
          </div>
          <button class="review-close-btn ministro-close edit-ministro-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="review-modal-body" style="padding: 24px;">
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #10b981; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <div style="width: 40px; height: 40px; background: #10b981; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h4 style="margin: 0; color: #065f46; font-size: 16px; font-weight: 700;">Asignación Actual</h4>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div style="background: white; padding: 12px; border-radius: 10px; text-align: center;">
                <span style="font-size: 10px; color: #047857; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 4px;">Ministro</span>
                <p style="margin: 0; font-size: 14px; font-weight: 700; color: #065f46;">${ministroInfo.ministroName || 'No asignado'}</p>
              </div>
              <div style="background: white; padding: 12px; border-radius: 10px; text-align: center;">
                <span style="font-size: 10px; color: #047857; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 4px;">Fecha</span>
                <p style="margin: 0; font-size: 14px; font-weight: 700; color: #065f46;">${dateForInput ? new Date(dateForInput + 'T12:00:00').toLocaleDateString('es-CL') : 'No especificada'}</p>
              </div>
              <div style="background: white; padding: 12px; border-radius: 10px; text-align: center;">
                <span style="font-size: 10px; color: #047857; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 4px;">Hora</span>
                <p style="margin: 0; font-size: 14px; font-weight: 700; color: #065f46;">${ministroInfo.scheduledTime || 'No especificada'}</p>
              </div>
              <div style="background: white; padding: 12px; border-radius: 10px; text-align: center;">
                <span style="font-size: 10px; color: #047857; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 4px;">Lugar</span>
                <p style="margin: 0; font-size: 14px; font-weight: 700; color: #065f46; word-break: break-word;">${ministroInfo.location || 'No especificado'}</p>
              </div>
            </div>
          </div>

          <form id="edit-ministro-form">
            <div class="form-group">
              <label>Nuevo Ministro de Fe <span class="required">*</span></label>
              <select name="ministroId" id="edit-ministro-select" required class="input-styled">
                ${ministroService.getActive().map(ministro => {
                  const mId = ministro.id || ministro._id;
                  const isCurrentMinistro = currentAssignment && (currentAssignment.ministroId === ministro.id || currentAssignment.ministroId === ministro._id);
                  return `
                    <option value="${mId}" ${isCurrentMinistro ? 'selected' : ''}>
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
                  value="${dateForInput}"
                  min="${new Date().toISOString().split('T')[0]}">
              </div>

              <div class="form-group">
                <label>Nueva Hora <span class="required">*</span></label>
                <select name="scheduledTime" required class="input-styled">
                  <option value="">-- Seleccionar Hora --</option>
                  ${ministroAvailabilityService.getAvailableHours().map(hour => {
                    const currentTime = ministroInfo.scheduledTime || '10:00';
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
                value="${ministroInfo.location || ''}"
                placeholder="Ej: Municipalidad de Renca, Sala de Reuniones">
            </div>

            <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end;">
              <button type="button" class="btn edit-ministro-close" style="background: #f3f4f6; color: #6b7280; border: 1px solid #d1d5db; padding: 12px 24px; border-radius: 10px; font-weight: 600; cursor: pointer;">Cancelar</button>
              <button type="submit" class="btn" style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.3);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
      const availableMinistros = allMinistros.filter(ministro => {
        const mId = ministro.id || ministro._id;
        return mId === currentMinistroId || // Siempre incluir el ministro actual
          ministroAvailabilityService.isAvailable(mId, selectedDate, selectedTime);
      });

      // Actualizar dropdown manteniendo la selección actual
      const selectedValue = ministroSelect.value;

      if (availableMinistros.length === 0) {
        ministroSelect.innerHTML = '<option value="">⚠️ No hay ministros disponibles para esta fecha/hora</option>';
        warning.style.display = 'block';
        warning.style.color = '#ef4444';
        warning.textContent = '⚠️ Ningún ministro está disponible para esta fecha/hora.';
      } else {
        ministroSelect.innerHTML = availableMinistros.map(ministro => {
          const mId = ministro.id || ministro._id;
          const isCurrentMinistro = mId === currentMinistroId;
          const isSelected = mId === selectedValue || (selectedValue === '' && isCurrentMinistro);
          return `
            <option value="${mId}" ${isSelected ? 'selected' : ''}>
              ${ministro.firstName} ${ministro.lastName} - ${ministro.rut}${isCurrentMinistro ? ' (Actual)' : ''}
            </option>
          `;
        }).join('');

        warning.style.display = 'block';
        warning.style.color = '#059669';
        warning.textContent = `✓ ${availableMinistros.length} ministro(s) disponible(s) para esta fecha/hora`;
      }

      // Mostrar ministros no disponibles en consola para debug
      const unavailableMinistros = allMinistros.filter(ministro => {
        const mId = ministro.id || ministro._id;
        return mId !== currentMinistroId &&
          !ministroAvailabilityService.isAvailable(mId, selectedDate, selectedTime);
      });
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
      const isDifferentSchedule = ministroInfo.scheduledDate !== scheduledDate || ministroInfo.scheduledTime !== scheduledTime;

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

      const oldMinistroData = { ...ministroInfo };

      const newMinistroData = {
        ministroId: ministro.id || ministro._id,
        ministroName: `${ministro.firstName} ${ministro.lastName}`,
        ministroRut: ministro.rut,
        scheduledDate,
        scheduledTime,
        location
      };

      // Actualizar la organización con los nuevos datos
      const updated = await organizationsService.scheduleMinistro(orgId, newMinistroData);

      if (updated) {
        // Actualizar o crear asignación
        const ministroIdForAssignment = ministro.id || ministro._id;
        if (currentAssignment) {
          // Obtener el ID correcto de la asignación (MongoDB usa _id)
          const assignmentId = currentAssignment._id || currentAssignment.id;

          // Construir registro de cambios para el ministro
          const changes = {};
          if (hadPreviousData) {
            if (hasMinistroChanged) changes.ministro = true;
            if (oldMinistroData.scheduledDate !== scheduledDate) changes.date = true;
            if (oldMinistroData.scheduledTime !== scheduledTime) changes.time = true;
            if (oldMinistroData.location !== location) changes.location = true;
          }

          const hasAnyChange = Object.keys(changes).length > 0;

          // Preparar datos de actualización
          const updateData = {
            ministroId: ministroIdForAssignment,
            ministroName: `${ministro.firstName} ${ministro.lastName}`,
            ministroRut: ministro.rut,
            scheduledDate,
            scheduledTime,
            location
          };

          // Si hubo cambios, marcar como modificado y guardar el historial
          if (hasAnyChange) {
            updateData.appointmentWasModified = true;
            updateData.appointmentChanges = [
              ...(currentAssignment.appointmentChanges || []),
              {
                changedAt: new Date().toISOString(),
                changedBy: 'admin',
                changes,
                previousData: {
                  scheduledDate: oldMinistroData.scheduledDate,
                  scheduledTime: oldMinistroData.scheduledTime,
                  location: oldMinistroData.location,
                  ministroName: oldMinistroData.ministroName
                }
              }
            ];
          }

          await ministroAssignmentService.update(assignmentId, updateData);
        } else {
          await ministroAssignmentService.create({
            ministroId: ministroIdForAssignment,
            ministroName: `${ministro.firstName} ${ministro.lastName}`,
            ministroRut: ministro.rut,
            organizationId: orgId,
            organizationName: getOrgName(org),
            scheduledDate,
            scheduledTime,
            location
          });
        }

        // Enviar notificación al usuario
        const { notificationService } = await import('../../services/NotificationService.js');

        // Verificar si había datos previos válidos
        const hadPreviousData = oldMinistroData && oldMinistroData.ministroName;

        // Detectar cambios reales (solo si hay datos previos para comparar)
        const hasMinistroChanged = hadPreviousData && oldMinistroData.ministroName !== newMinistroData.ministroName;
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
            message: `¡Tu solicitud ha sido procesada! Se ha asignado un Ministro de Fe para la asamblea de ${getOrgName(org)}.\n\n` +
                    `Ministro: ${newMinistroData.ministroName}\n` +
                    `Fecha: ${formatDateSafe(scheduledDate)} a las ${scheduledTime}\n` +
                    `Lugar: ${location}`,
            data: { organizationId: org.id, ministroData: newMinistroData }
          });
        } else if (hasMinistroChanged && hasScheduleChanged) {
          notificationService.create({
            userId: org.userId,
            type: 'ministro_changed',
            title: '⚖️ Cambio de Ministro de Fe y Horario',
            message: `Se ha actualizado el Ministro de Fe y el horario para la asamblea de ${getOrgName(org)}.\n\n` +
                    `Nuevo Ministro: ${newMinistroData.ministroName}\n` +
                    `Nueva Fecha: ${formatDateSafe(scheduledDate)} a las ${scheduledTime}`,
            data: { organizationId: org.id, oldMinistroData, newMinistroData }
          });
        } else if (hasMinistroChanged) {
          notificationService.create({
            userId: org.userId,
            type: 'ministro_changed',
            title: '⚖️ Cambio de Ministro de Fe',
            message: `Se ha asignado un nuevo Ministro de Fe para la asamblea de ${getOrgName(org)}.\n\n` +
                    `Ministro Anterior: ${oldMinistroData.ministroName}\n` +
                    `Nuevo Ministro: ${newMinistroData.ministroName}\n` +
                    `Fecha: ${formatDateSafe(scheduledDate)} a las ${scheduledTime}`,
            data: { organizationId: org.id, oldMinistroData, newMinistroData }
          });
        } else if (hasScheduleChanged && hasLocationChanged) {
          // Cambió tanto el horario como el lugar
          notificationService.create({
            userId: org.userId,
            type: 'schedule_location_change',
            title: '📅📍 Cambio de Horario y Lugar',
            message: `Se ha modificado el horario y lugar de la asamblea de ${getOrgName(org)}.\n\n` +
                    `Fecha Anterior: ${new Date(oldMinistroData.scheduledDate).toLocaleDateString('es-CL')} a las ${oldMinistroData.scheduledTime}\n` +
                    `Nueva Fecha: ${formatDateSafe(scheduledDate)} a las ${scheduledTime}\n\n` +
                    `Lugar Anterior: ${oldMinistroData.location}\n` +
                    `Nuevo Lugar: ${location}`,
            data: { organizationId: org.id, oldData: oldMinistroData, newData: newMinistroData }
          });
        } else if (hasScheduleChanged) {
          notificationService.create({
            userId: org.userId,
            type: 'schedule_change',
            title: '📅 Cambio de Horario de Asamblea',
            message: `Se ha modificado el horario de la asamblea de ${getOrgName(org)}.\n\n` +
                    `Fecha Anterior: ${new Date(oldMinistroData.scheduledDate).toLocaleDateString('es-CL')} a las ${oldMinistroData.scheduledTime}\n` +
                    `Nueva Fecha: ${formatDateSafe(scheduledDate)} a las ${scheduledTime}`,
            data: { organizationId: org.id, oldSchedule: oldMinistroData, newSchedule: newMinistroData }
          });
        } else if (hasLocationChanged) {
          notificationService.create({
            userId: org.userId,
            type: 'location_change',
            title: '📍 Cambio de Lugar de Asamblea',
            message: `Se ha modificado el lugar de la asamblea de ${getOrgName(org)}.\n\n` +
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
            message: `Has sido removido de la asamblea de "${getOrgName(org)}".\n\n` +
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
                    `Organización: ${getOrgName(org)}\n` +
                    `Fecha: ${formatDateSafe(scheduledDate)} a las ${scheduledTime}\n` +
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
                    `Organización: ${getOrgName(org)}\n` +
                    `Fecha Anterior: ${new Date(oldMinistroData.scheduledDate).toLocaleDateString('es-CL')} a las ${oldMinistroData.scheduledTime}\n` +
                    `Nueva Fecha: ${formatDateSafe(scheduledDate)} a las ${scheduledTime}\n` +
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
                    `Organización: ${getOrgName(org)}\n` +
                    `Fecha Anterior: ${new Date(oldMinistroData.scheduledDate).toLocaleDateString('es-CL')} a las ${oldMinistroData.scheduledTime}\n` +
                    `Nueva Fecha: ${formatDateSafe(scheduledDate)} a las ${scheduledTime}\n` +
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
                    `Organización: ${getOrgName(org)}\n` +
                    `Lugar Anterior: ${oldMinistroData.location}\n` +
                    `Nuevo Lugar: ${location}\n` +
                    `Fecha: ${formatDateSafe(scheduledDate)} a las ${scheduledTime}`,
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

        // Si cambió la fecha/hora, mostrar modal de bloqueo
        if (!hadPreviousData || hasScheduleChanged || hasMinistroChanged) {
          this._showBlockDurationModal({
            ministroId: ministroId,
            ministroName: `${ministro.firstName} ${ministro.lastName}`,
            date: scheduledDate,
            time: scheduledTime,
            orgName: getOrgName(org)
          });
        }

        this.renderApplicationsList();
        this.updateStats();
      } else {
        showToast('Error al actualizar el Ministro de Fe', 'error');
      }
    });
  }

  /**
   * Muestra modal para configurar duración de bloqueo de ministro
   */
  _showBlockDurationModal({ ministroId, ministroName, date, time, orgName }) {
    const modal = document.createElement('div');
    modal.className = 'admin-review-modal-overlay';

    const _calcEnd = (startTime, hours) => {
      if (!startTime || !hours) return '';
      const [h, m] = startTime.split(':').map(Number);
      const endH = Math.min(h + hours - 1, 23);
      return `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const previewEnd = _calcEnd(time, 4);

    modal.innerHTML = `
      <div class="admin-review-modal" style="max-width: 480px;">
        <div class="review-modal-header" style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);">
          <div class="review-header-left">
            <h2 style="margin:0;color:white;font-size:18px;">Bloqueo de Disponibilidad</h2>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${orgName} - ${date} ${time}</p>
          </div>
          <button class="review-close-btn block-dur-close" style="color:white;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="review-modal-body" style="padding:24px;">
          <div style="background:#f0fdf4;border:2px solid #10b981;border-radius:12px;padding:14px 18px;margin-bottom:20px;">
            <p style="margin:0;font-size:14px;color:#065f46;font-weight:600;">Ministro: ${ministroName}</p>
          </div>
          <div style="margin-bottom:20px;">
            <label style="display:block;font-weight:600;margin-bottom:8px;font-size:14px;color:#374151;">Duración del bloqueo</label>
            <div id="admin-block-dur-options" style="display:flex;flex-direction:column;gap:8px;">
              <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;">
                <input type="radio" name="adminBlockDur" value="2" style="accent-color:#7c3aed;"> <span>2 horas</span>
              </label>
              <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;">
                <input type="radio" name="adminBlockDur" value="3" style="accent-color:#7c3aed;"> <span>3 horas</span>
              </label>
              <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:2px solid #7c3aed;border-radius:10px;cursor:pointer;background:#f5f3ff;">
                <input type="radio" name="adminBlockDur" value="4" checked style="accent-color:#7c3aed;"> <span>4 horas <span style="color:#7c3aed;font-size:12px;">(recomendado)</span></span>
              </label>
              <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;">
                <input type="radio" name="adminBlockDur" value="6" style="accent-color:#7c3aed;"> <span>6 horas</span>
              </label>
              <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;">
                <input type="radio" name="adminBlockDur" value="fullday" style="accent-color:#7c3aed;"> <span>Día completo</span>
              </label>
            </div>
          </div>
          <div id="admin-block-preview" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:14px;color:#5b21b6;">
            Preview: ${time} - ${previewEnd} (4 horas)
          </div>
          <div style="display:flex;gap:12px;justify-content:flex-end;">
            <button id="admin-block-skip" style="padding:10px 20px;border:2px solid #e5e7eb;border-radius:10px;background:white;cursor:pointer;font-size:14px;font-weight:500;">Omitir</button>
            <button id="admin-block-confirm" style="padding:10px 20px;border:none;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white;cursor:pointer;font-size:14px;font-weight:600;">Crear Bloqueo</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Actualizar preview
    const updatePreview = () => {
      const selected = modal.querySelector('input[name="adminBlockDur"]:checked');
      const preview = modal.querySelector('#admin-block-preview');
      if (!selected || !preview) return;

      if (selected.value === 'fullday') {
        preview.textContent = 'Preview: Día completo bloqueado';
      } else {
        const hours = parseInt(selected.value);
        const end = _calcEnd(time, hours);
        preview.textContent = `Preview: ${time} - ${end} (${hours} horas)`;
      }

      modal.querySelectorAll('#admin-block-dur-options label').forEach(label => {
        const radio = label.querySelector('input[type="radio"]');
        if (radio.checked) {
          label.style.borderColor = '#7c3aed';
          label.style.background = '#f5f3ff';
        } else {
          label.style.borderColor = '#e5e7eb';
          label.style.background = 'white';
        }
      });
    };

    modal.querySelectorAll('input[name="adminBlockDur"]').forEach(r => r.addEventListener('change', updatePreview));

    const close = () => modal.remove();
    modal.querySelector('.block-dur-close').addEventListener('click', close);
    modal.querySelector('#admin-block-skip').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    modal.querySelector('#admin-block-confirm').addEventListener('click', async () => {
      const selected = modal.querySelector('input[name="adminBlockDur"]:checked');
      const isFullDay = selected.value === 'fullday';
      const durationHours = isFullDay ? null : parseInt(selected.value);

      try {
        await apiService.createBlockFromConfirmation({
          ministroId,
          ministroName,
          date,
          startTime: time,
          durationHours,
          fullDay: isFullDay,
          reason: `Asamblea: ${orgName}`
        });
        scheduleService.invalidateBlocksCache();
        showToast('Bloqueo de disponibilidad creado', 'success');
      } catch (error) {
        console.error('Error creando bloqueo:', error);
        showToast('Error al crear bloqueo: ' + (error.message || 'Error'), 'error');
      }
      modal.remove();
    });
  }

  /**
   * Ver PDF oficial en modal
   */
  async viewOfficialPDF(orgId, docId) {
    console.log('📄 viewOfficialPDF called:', { orgId, docId });

    // Mostrar loading
    showToast('Generando documento...', 'info');

    // Obtener datos frescos del servidor para asegurar que tenemos los datos de validación
    let org;
    try {
      org = await organizationsService.getByIdAsync(orgId);
      console.log('📄 Organization fetched from server:', org ? org.organizationName : 'NOT FOUND');
    } catch (e) {
      console.error('Error fetching organization:', e);
      // Fallback a datos en caché
      org = this.organizations.find(o => (o._id === orgId || o.id === orgId));
      console.log('📄 Using cached organization:', org ? org.organizationName : 'NOT FOUND');
    }

    console.log('📄 provisionalDirectorio:', JSON.stringify(org?.provisionalDirectorio, null, 2));
    console.log('📄 comisionElectoral:', JSON.stringify(org?.comisionElectoral, null, 2));
    console.log('📄 validationData:', JSON.stringify(org?.validationData, null, 2));
    console.log('📄 members:', org?.members?.length);

    if (!org) {
      showToast('Organización no encontrada', 'error');
      return;
    }

    let pdfDoc;
    let docTitle = '';

    try {
      console.log('📄 Generating PDF for docId:', docId);
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

      console.log('📄 pdfDoc generated:', pdfDoc ? 'YES' : 'NO');

      if (!pdfDoc) {
        showToast('No se pudo generar el documento', 'error');
        return;
      }

      // Crear modal para mostrar el PDF usando Blob URL (más eficiente para PDFs grandes)
      console.log('📄 Getting PDF Blob...');
      const pdfBlob = pdfService.getPDFBlob(pdfDoc);
      const pdfBlobUrl = URL.createObjectURL(pdfBlob);
      console.log('📄 PDF Blob URL:', pdfBlobUrl ? 'Generated' : 'FAILED');

      const previewModal = document.createElement('div');
      previewModal.className = 'pdf-preview-modal';
      previewModal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1050;';
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
            <iframe src="${pdfBlobUrl}" style="width: 100%; height: 100%; border: none;"></iframe>
          </div>
        </div>
      `;

      document.body.appendChild(previewModal);

      // Función para limpiar el modal y liberar memoria del blob URL
      const closeModal = () => {
        URL.revokeObjectURL(pdfBlobUrl);
        previewModal.remove();
      };

      previewModal.querySelector('.btn-close-preview').addEventListener('click', closeModal);
      previewModal.addEventListener('click', (e) => { if (e.target === previewModal) closeModal(); });
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
  async downloadOfficialPDF(orgId, docId) {
    // Obtener datos frescos del servidor
    let org;
    try {
      org = await organizationsService.getByIdAsync(orgId);
    } catch (e) {
      console.error('Error fetching organization:', e);
      org = this.organizations.find(o => (o._id === orgId || o.id === orgId));
    }

    if (!org) {
      showToast('Organización no encontrada', 'error');
      return;
    }

    let pdfDoc;
    let filename = '';
    const orgName = (getOrgName(org) || org.organizationName || 'Organizacion').replace(/\s+/g, '_');

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
  async downloadAllPDFs(orgId) {
    // Obtener datos frescos del servidor
    let org;
    try {
      org = await organizationsService.getByIdAsync(orgId);
    } catch (e) {
      console.error('Error fetching organization:', e);
      org = this.organizations.find(o => (o._id === orgId || o.id === orgId));
    }

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
