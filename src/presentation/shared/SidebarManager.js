/**
 * SidebarManager - Unified sidebar for Organizador, Miembro, and Miembro Directivo.
 * Uses `.unified-sidebar__*` CSS classes (shared with React SharedSidebar).
 * Preserves IDs: #org-nav-section, #org-selector, #org-nav-items for OrganizationMenuManager.
 */

const STORAGE_KEY = 'sidebar-collapsed';

// Org admin menu items (flat list — no collapsible section)
const ORG_NAV_ITEMS = [
  { page: 'org-overview', icon: '📊', label: 'Resumen' },
  { page: 'org-members', icon: '👥', label: 'Socios' },
  { page: 'org-directorio', icon: '👤', label: 'Directorio' },
  { page: 'org-asambleas', icon: '🗣️', label: 'Asambleas' },
  { page: 'org-elecciones', icon: '✅', label: 'Elecciones' },
  { page: 'org-comunicaciones', icon: '✉️', label: 'Comunicaciones' },
  { page: 'org-finanzas', icon: '💰', label: 'Finanzas' },
  { page: 'org-proyectos', icon: '📁', label: 'Proyectos' },
  { page: 'org-documentos', icon: '📄', label: 'Documentos' },
  { page: 'org-actividades', icon: '📅', label: 'Actividades' },
];

// Secondary nav items (below org section, separated)
const SECONDARY_NAV_ITEMS = [
  { page: 'mis-organizaciones', icon: '🏠', label: 'Mis Organizaciones' },
  { page: 'guia-constitucion', icon: '📑', label: 'Guía' },
  { page: 'biblioteca', icon: '📚', label: 'Biblioteca' },
  { page: 'noticias', icon: '📰', label: 'Noticias' },
];

// Member sidebar items
const MEMBER_NAV_ITEMS = [
  { page: 'member-overview', icon: '🏠', label: 'Información' },
  { page: 'member-directorio', icon: '👤', label: 'Directorio' },
  { page: 'member-documentos', icon: '📄', label: 'Documentos' },
  { page: 'member-actividades', icon: '📅', label: 'Actividades' },
  { page: 'member-asambleas', icon: '🗣️', label: 'Asambleas' },
  { page: 'member-password', icon: '🔒', label: 'Cambiar Contraseña' },
];

// Bottom nav icon SVGs (kept small for mobile)
const BOTTOM_ICONS = {
  home: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  members: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
  directorio: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  docs: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  guia: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  biblioteca: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  noticias: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"/><path d="M21 13v6a2 2 0 0 1-2 2"/><path d="M21 6h-8a2 2 0 0 0-2 2v7"/></svg>',
  crearOrg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
};

// Org bottom nav items
const ORG_BOTTOM_NAV = [
  { page: 'home', icon: 'home', label: 'Inicio' },
  { page: 'mis-organizaciones', icon: 'crearOrg', label: 'Mis Orgs' },
  { page: 'guia-constitucion', icon: 'guia', label: 'Guía' },
  { page: 'biblioteca', icon: 'biblioteca', label: 'Biblioteca' },
  { page: 'noticias', icon: 'noticias', label: 'Noticias' },
];

// Member bottom nav items
const MEMBER_BOTTOM_NAV = [
  { page: 'member-overview', icon: 'home', label: 'Inicio' },
  { page: 'member-asambleas', icon: 'members', label: 'Asambleas' },
  { page: 'member-directorio', icon: 'directorio', label: 'Directorio' },
  { page: 'member-documentos', icon: 'docs', label: 'Documentos' },
];

// Chevron SVG for toggle button
const CHEVRON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';


class SidebarManager {
  constructor() {
    this.currentRole = null;
    this.collapsed = false;
  }

  /**
   * Initialize sidebar + bottom nav for a given role
   * @param {string} role - ORGANIZADOR | MIEMBRO | MIEMBRO_DIRECTIVO
   */
  init(role) {
    this.currentRole = role;
    this.collapsed = this._getCollapsedState();
    this._updateCSSVariable();
    this.renderSidebar(role);
    this.renderBottomNav(role);
  }

  /**
   * Render the unified sidebar into #side-nav
   */
  renderSidebar(role) {
    const sideNav = document.getElementById('side-nav');
    if (!sideNav) return;

    // Apply unified sidebar class
    sideNav.className = 'side-nav unified-sidebar' + (this.collapsed ? ' unified-sidebar--collapsed' : '');

    // Get user info from localStorage
    const user = this._getUser();
    const title = this._getTitleForRole(role);
    const initials = title.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    let html = '';

    // Close button (mobile)
    html += `<button class="unified-sidebar__close-btn" id="close-nav-btn" aria-label="Cerrar menú">
      <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>`;

    // Header
    html += `<div class="unified-sidebar__header">
      <h2 class="unified-sidebar__title">${this.collapsed ? initials : title}</h2>
      <p class="unified-sidebar__subtitle">${user.firstName || ''} ${user.lastName || ''}</p>
    </div>`;

    // Content container (for compatibility)
    html += '<div id="sidebar-content">';

    if (role === 'ORGANIZADOR' || role === 'MIEMBRO_DIRECTIVO') {
      html += this._renderOrgContent();
    } else if (role === 'MIEMBRO') {
      html += this._renderMemberContent();
    }

    html += '</div>';

    // Footer - Toggle + Logout
    html += `<div class="unified-sidebar__footer">
      <button class="unified-sidebar__toggle-btn" id="sidebar-toggle-btn" aria-label="${this.collapsed ? 'Expandir menú' : 'Colapsar menú'}">
        ${CHEVRON_SVG}
        <span class="unified-sidebar__toggle-label">${this.collapsed ? '' : 'Colapsar'}</span>
      </button>
      <button class="unified-sidebar__logout" id="sidebar-logout-btn">
        <span class="unified-sidebar__logout-icon">🚪</span>
        Cerrar sesión
      </button>
    </div>`;

    sideNav.innerHTML = html;

    // Add unified sidebar class to body for layout adjustments
    document.body.classList.add('has-unified-sidebar');

    // Attach event listeners
    this._attachCloseBtn();
    this._attachLogout();
    this._attachToggle();
  }

  /**
   * Generate org sidebar content (Home + org selector + flat org items + secondary section)
   */
  _renderOrgContent() {
    let html = '';

    // Scrollable nav wrapper
    html += '<nav class="unified-sidebar__nav">';

    // Home item
    html += this._renderItem({ page: 'home', icon: '🏠', label: 'Inicio' }, true);

    // Org selector (hidden until OrganizationMenuManager populates it)
    html += `<div id="org-nav-section" style="display: none;">
      <div class="unified-sidebar__org-container">
        <span class="unified-sidebar__org-label">Mi Organización</span>
        <select id="org-selector" class="unified-sidebar__org-selector">
          <!-- Populated dynamically by OrganizationMenuManager -->
        </select>
      </div>
      <div id="org-nav-items">`;

    // Flat list of org admin items (no collapsible section)
    for (const item of ORG_NAV_ITEMS) {
      html += this._renderItem(item);
    }

    html += `</div>
    </div>`;

    // Section separator + secondary items
    html += '<div class="unified-sidebar__section">';
    for (const item of SECONDARY_NAV_ITEMS) {
      html += this._renderItem(item);
    }
    html += '</div>';

    html += '</nav>';
    return html;
  }

  /**
   * Generate member sidebar content
   */
  _renderMemberContent() {
    let html = '';

    html += '<nav class="unified-sidebar__nav">';
    html += '<div id="member-nav-section">';

    for (const item of MEMBER_NAV_ITEMS) {
      html += this._renderItem(item, item.page === 'member-overview');
    }

    html += '</div>';
    html += '</nav>';
    return html;
  }

  /**
   * Render a single sidebar item with tooltip support
   */
  _renderItem(item, isActive = false) {
    const activeClass = isActive ? ' unified-sidebar__item--active' : '';
    return `<a href="#" data-page="${item.page}" class="unified-sidebar__item${activeClass}" title="${item.label}">
      <span class="unified-sidebar__item-icon">${item.icon}</span>
      <span class="unified-sidebar__item-label">${item.label}</span>
      <span class="unified-sidebar__tooltip">${item.label}</span>
    </a>`;
  }

  /**
   * Render bottom nav into #bottom-nav-container
   */
  renderBottomNav(role) {
    const container = document.getElementById('bottom-nav-container');
    if (!container) return;

    if (role === 'ORGANIZADOR' || role === 'MIEMBRO_DIRECTIVO') {
      container.innerHTML = this._renderBottomNavItems(ORG_BOTTOM_NAV, 'home');
      container.style.display = '';
    } else if (role === 'MIEMBRO') {
      container.innerHTML = this._renderBottomNavItems(MEMBER_BOTTOM_NAV, 'member-overview');
      container.id = 'member-bottom-nav';
      container.style.display = '';
    }
  }

  /**
   * Generate bottom nav items HTML
   */
  _renderBottomNavItems(items, activePage) {
    let html = '';
    for (const item of items) {
      const isActive = item.page === activePage ? ' active' : '';
      html += `<button class="nav-item${isActive}" data-page="${item.page}">
        ${BOTTOM_ICONS[item.icon] || ''}
        <span>${item.label}</span>
      </button>`;
    }
    return html;
  }

  /**
   * Update active link in sidebar and bottom nav
   */
  updateActiveLink(page) {
    // Sidebar: remove active from all unified items
    document.querySelectorAll('#side-nav .unified-sidebar__item').forEach(el => {
      el.classList.remove('unified-sidebar__item--active');
    });
    const sidebarLink = document.querySelector(`#side-nav [data-page="${page}"]`);
    if (sidebarLink) sidebarLink.classList.add('unified-sidebar__item--active');

    // Bottom nav
    const bottomNav = document.getElementById('bottom-nav-container') || document.getElementById('member-bottom-nav');
    if (bottomNav) {
      bottomNav.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      const bottomLink = bottomNav.querySelector(`[data-page="${page}"]`);
      if (bottomLink) bottomLink.classList.add('active');
    }
  }

  /**
   * Toggle collapsed state
   */
  toggleCollapsed() {
    this.collapsed = !this.collapsed;
    this._saveCollapsedState();
    this._updateCSSVariable();

    const sideNav = document.getElementById('side-nav');
    if (sideNav) {
      sideNav.classList.toggle('unified-sidebar--collapsed', this.collapsed);
    }

    // Update title
    const titleEl = sideNav?.querySelector('.unified-sidebar__title');
    if (titleEl) {
      const title = this._getTitleForRole(this.currentRole);
      const initials = title.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      titleEl.textContent = this.collapsed ? initials : title;
    }

    // Update toggle button label
    const toggleLabel = sideNav?.querySelector('.unified-sidebar__toggle-label');
    if (toggleLabel) {
      toggleLabel.textContent = this.collapsed ? '' : 'Colapsar';
    }
  }

  /**
   * Attach close button for mobile sidebar
   */
  _attachCloseBtn() {
    const closeBtn = document.getElementById('close-nav-btn');
    const sideNav = document.getElementById('side-nav');
    if (closeBtn && sideNav) {
      closeBtn.addEventListener('click', () => {
        sideNav.classList.remove('open');
        const overlay = document.getElementById('overlay');
        if (overlay) overlay.remove();
      });
    }
  }

  /**
   * Attach logout listener to sidebar logout button
   */
  _attachLogout() {
    const logoutBtn = document.getElementById('sidebar-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        // Trigger the same logout as the header logout button
        const headerLogout = document.getElementById('logout-btn');
        if (headerLogout) {
          headerLogout.click();
        }
      });
    }
  }

  /**
   * Attach toggle button listener
   */
  _attachToggle() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.toggleCollapsed();
      });
    }
  }

  /**
   * Get collapsed state from localStorage
   */
  _getCollapsedState() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Save collapsed state to localStorage
   */
  _saveCollapsedState() {
    try {
      localStorage.setItem(STORAGE_KEY, String(this.collapsed));
    } catch {}
  }

  /**
   * Update CSS variable for sidebar width
   */
  _updateCSSVariable() {
    const width = this.collapsed ? '72px' : '260px';
    document.documentElement.style.setProperty('--sidebar-width', width);
  }

  /**
   * Get user data from localStorage
   */
  _getUser() {
    try {
      return JSON.parse(localStorage.getItem('currentUser')) || {};
    } catch { return {}; }
  }

  /**
   * Get sidebar title based on role
   */
  _getTitleForRole(role) {
    if (role === 'MIEMBRO') return 'Mi Organización';
    return 'Mi Organización'; // Both ORGANIZADOR and MIEMBRO_DIRECTIVO
  }
}

export const sidebarManager = new SidebarManager();
