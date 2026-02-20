/**
 * OrganizationMenuManager
 *
 * Gestiona la integración de organizaciones aprobadas en el menú lateral.
 * Solo muestra organizaciones con estado 'approved' (aprobadas por Registro Civil).
 * Permite navegación a páginas completas en lugar de modales.
 */

import { organizationsService, ORG_STATUS } from '../../services/OrganizationsService.js';
import { organizationDashboard } from './OrganizationDashboard.js';
import { showToast } from '../../app.js';
import { getOrgIcon, getOrgType } from '../../shared/utils/index.js';

class OrganizationMenuManager {
  constructor() {
    this.approvedOrgs = [];
    this.activeOrgId = null;
    this.initialized = false;
    this.menuCollapsed = false;
  }

  /**
   * Inicializa el gestor del menú de organizaciones
   */
  async init() {
    if (this.initialized) return;

    await this.loadApprovedOrganizations();
    this.setupUI();
    this.attachEventListeners();
    this.restoreActiveOrganization();
    this.restoreMenuState();

    this.initialized = true;
    console.log('[OrganizationMenuManager] Initialized with', this.approvedOrgs.length, 'approved organizations');
  }

  /**
   * Carga las organizaciones aprobadas del usuario actual
   */
  async loadApprovedOrganizations() {
    try {
      // Primero intentar usar datos ya cargados por renderOrganizations() / sync()
      let allOrgs = organizationsService.getAll();
      console.log('[OrganizationMenuManager] Cached orgs:', allOrgs?.length || 0);

      // Si no hay datos cacheados, intentar API
      if (!allOrgs || allOrgs.length === 0) {
        allOrgs = await organizationsService.getCurrentUserOrganizations();
        console.log('[OrganizationMenuManager] Orgs from API:', allOrgs?.length || 0);
      }

      // Último recurso: localStorage
      if (!allOrgs || allOrgs.length === 0) {
        try {
          const lsData = localStorage.getItem('user_organizations');
          if (lsData) {
            allOrgs = JSON.parse(lsData);
            console.log('[OrganizationMenuManager] Fallback to localStorage:', allOrgs?.length || 0);
          }
        } catch (e) { /* ignore */ }
      }

      if (!allOrgs) allOrgs = [];
      console.log('[OrganizationMenuManager] All orgs statuses:', allOrgs.map(o => ({ name: o.organizationName || o.organization?.name, status: o.status })));

      this.approvedOrgs = allOrgs.filter(org => org.status === ORG_STATUS.APPROVED);
      console.log('[OrganizationMenuManager] Approved orgs found:', this.approvedOrgs.length);
      return this.approvedOrgs;
    } catch (error) {
      console.error('[OrganizationMenuManager] Error loading organizations:', error);
      this.approvedOrgs = [];
      return [];
    }
  }

  /**
   * Configura la UI del menú según las organizaciones disponibles
   */
  setupUI() {
    const navSection = document.getElementById('org-nav-section');
    const selector = document.getElementById('org-selector');

    if (this.approvedOrgs.length === 0) {
      if (navSection) navSection.style.display = 'none';
      return;
    }

    // Mostrar sección
    if (navSection) navSection.style.display = 'block';

    // Poblar selector
    if (selector) {
      selector.innerHTML = this.approvedOrgs.map(org => {
        const orgId = org._id || org.id;
        const orgName = org.organization?.name || org.organizationName || 'Organización';
        return `<option value="${orgId}">${orgName}</option>`;
      }).join('');
    }
  }

  /**
   * Adjunta event listeners
   */
  attachEventListeners() {
    // Selector de organización
    const selector = document.getElementById('org-selector');
    if (selector) {
      selector.addEventListener('change', (e) => {
        this.setActiveOrganization(e.target.value);
        showToast(`Organización: ${selector.options[selector.selectedIndex].text}`, 'info');
      });
    }

    // Toggle de menú colapsable
    const toggle = document.getElementById('org-menu-toggle');
    const items = document.getElementById('org-nav-items');
    if (toggle && items) {
      toggle.addEventListener('click', () => {
        this.menuCollapsed = !this.menuCollapsed;
        toggle.classList.toggle('collapsed', this.menuCollapsed);
        items.classList.toggle('collapsed', this.menuCollapsed);
        localStorage.setItem('org-menu-collapsed', this.menuCollapsed);
      });
    }

    // Navegación a páginas de organización
    document.querySelectorAll('[data-page^="org-"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        this.navigateToOrgPage(page);
      });
    });

    // Escuchar eventos de acciones rápidas
    window.addEventListener('org-quick-action', (e) => {
      const { action } = e.detail;
      this.handleQuickAction(action);
    });

    // Escuchar evento de navegación para renderizar contenido
    window.addEventListener('page-navigate', (e) => {
      const { page } = e.detail;
      if (page.startsWith('org-')) {
        this.renderCurrentPage(page);
      }
    });
  }

  /**
   * Establece la organización activa
   */
  setActiveOrganization(orgId) {
    this.activeOrgId = orgId;
    const org = this.approvedOrgs.find(o => (o._id || o.id) === orgId);

    if (org) {
      // Actualizar OrganizationDashboard para reutilizar sus métodos
      organizationDashboard.setOrganization(org);

      // Guardar en sessionStorage
      sessionStorage.setItem('activeOrganizationId', orgId);

      // Si estamos en una página de organización, re-renderizar
      const currentPage = sessionStorage.getItem('app_current_page');
      if (currentPage && currentPage.startsWith('org-')) {
        this.renderCurrentPage(currentPage);
      }
    }
  }

  /**
   * Restaura la organización activa desde sessionStorage
   */
  restoreActiveOrganization() {
    const savedId = sessionStorage.getItem('activeOrganizationId');
    if (savedId && this.approvedOrgs.some(o => (o._id || o.id) === savedId)) {
      this.setActiveOrganization(savedId);
      const selector = document.getElementById('org-selector');
      if (selector) selector.value = savedId;
    } else if (this.approvedOrgs.length > 0) {
      // Seleccionar la primera por defecto
      const firstOrgId = this.approvedOrgs[0]._id || this.approvedOrgs[0].id;
      this.setActiveOrganization(firstOrgId);
    }
  }

  /**
   * Restaura el estado del menú (colapsado/expandido)
   */
  restoreMenuState() {
    const collapsed = localStorage.getItem('org-menu-collapsed') === 'true';
    this.menuCollapsed = collapsed;

    const toggle = document.getElementById('org-menu-toggle');
    const items = document.getElementById('org-nav-items');
    if (toggle && items && collapsed) {
      toggle.classList.add('collapsed');
      items.classList.add('collapsed');
    }
  }

  /**
   * Navega a una página de organización
   */
  navigateToOrgPage(page) {
    if (!this.activeOrgId) {
      showToast('Selecciona una organización primero', 'error');
      return;
    }

    // Importar appState dinámicamente para evitar dependencias circulares
    import('../../app.js').then(({ appState }) => {
      appState.navigateTo(page);
    });
  }

  /**
   * Renderiza la página actual de organización
   */
  renderCurrentPage(page) {
    if (!this.activeOrgId) return;

    const org = organizationDashboard.getOrganization();
    if (!org) return;

    const tabName = page.replace('org-', '');
    const container = document.getElementById(`org-${tabName}-content`);
    const headerContainer = document.getElementById(`org-page-header-${tabName}`);

    if (!container) {
      console.warn('[OrganizationMenuManager] Container not found for tab:', tabName);
      return;
    }

    // Renderizar header de la organización
    if (headerContainer) {
      headerContainer.innerHTML = this.renderOrgHeader(org, tabName);
    }

    // Renderizar contenido del tab
    container.innerHTML = organizationDashboard.renderTab(tabName);

    // Adjuntar listeners
    organizationDashboard.attachContentListenersToContainer(container);

    // Actualizar navegación activa
    this.updateActiveNavigation(page);

    // Scroll al inicio
    window.scrollTo(0, 0);
  }

  /**
   * Renderiza el header de la organización para las páginas
   */
  renderOrgHeader(org, tabName) {
    const tabTitles = {
      'overview': 'Resumen',
      'members': 'Socios',
      'directorio': 'Directorio',
      'asambleas': 'Asambleas',
      'elecciones': 'Elecciones',
      'comunicaciones': 'Comunicaciones',
      'finanzas': 'Finanzas',
      'proyectos': 'Proyectos',
      'documentos': 'Documentos',
      'actividades': 'Actividades'
    };

    const orgName = org.organization?.name || org.organizationName || 'Mi Organización';
    const orgType = getOrgType(org.organization?.type);
    const orgIcon = getOrgIcon(org.organization?.type);

    return `
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
        <div style="font-size: 40px;">${orgIcon}</div>
        <div style="flex: 1;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #1e293b;">${orgName}</h1>
          <div style="display: flex; align-items: center; gap: 12px; margin-top: 4px;">
            <span style="font-size: 14px; color: #64748b;">${orgType}</span>
            <span style="padding: 2px 10px; background: #dcfce7; color: #166534; border-radius: 12px; font-size: 12px; font-weight: 600;">Registrada</span>
          </div>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 18px; font-weight: 600; color: #1e40af;">${tabTitles[tabName] || ''}</span>
        </div>
      </div>
    `;
  }

  /**
   * Actualiza la navegación activa en el menú
   */
  updateActiveNavigation(page) {
    // Quitar active de todos los links del menú de org
    document.querySelectorAll('.nav-link-sub').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.page === page) {
        link.classList.add('active');
      }
    });

    // Quitar active de los links principales
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
  }

  /**
   * Maneja acciones rápidas desde el dashboard
   */
  handleQuickAction(action) {
    const actionToPage = {
      'add-member': 'org-members',
      'new-assembly': 'org-asambleas',
      'new-project': 'org-proyectos',
      'certificate': 'org-documentos'
    };

    const page = actionToPage[action];
    if (page) {
      this.navigateToOrgPage(page);
    }
  }

  /**
   * Refresca las organizaciones (llamar después de cambios)
   */
  async refresh() {
    await this.loadApprovedOrganizations();
    this.setupUI();

    // Verificar si la org activa aún existe
    if (this.activeOrgId && !this.approvedOrgs.some(o => (o._id || o.id) === this.activeOrgId)) {
      this.restoreActiveOrganization();
    }
  }

  /**
   * Verifica si hay organizaciones aprobadas
   */
  hasApprovedOrganizations() {
    return this.approvedOrgs.length > 0;
  }

  /**
   * Obtiene la organización activa
   */
  getActiveOrganization() {
    if (!this.activeOrgId) return null;
    return this.approvedOrgs.find(o => (o._id || o.id) === this.activeOrgId);
  }
}

// Instancia singleton
export const organizationMenuManager = new OrganizationMenuManager();
