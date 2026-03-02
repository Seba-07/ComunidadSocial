/**
 * SidebarManager - Dynamic sidebar and bottom nav for all roles
 * Generates HTML with the same IDs/classes as the original hardcoded HTML
 * so that CSS and OrganizationMenuManager continue working without changes.
 */

// SVG icon definitions (reused across sidebar and bottom nav)
const ICONS = {
  home: '<svg width="{w}" height="{h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
  crearOrg: '<svg width="{w}" height="{h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M9 22V12h6v10"></path></svg>',
  guia: '<svg width="{w}" height="{h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
  biblioteca: '<svg width="{w}" height="{h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
  noticias: '<svg width="{w}" height="{h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"></path><path d="M21 13v6a2 2 0 0 1-2 2"></path><path d="M21 6h-8a2 2 0 0 0-2 2v7"></path></svg>',
  admin: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>',
  overview: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
  members: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
  directorio: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
  asambleas: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path></svg>',
  elecciones: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
  comunicaciones: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
  finanzas: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
  proyectos: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
  documentos: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
  actividades: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
  password: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
  memberIcon: '<svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
};

function icon(name, w = 22, h = 22) {
  return (ICONS[name] || '').replace(/\{w\}/g, w).replace(/\{h\}/g, h);
}

// Org admin menu items (sidebar sub-items under "Administración")
const ORG_NAV_ITEMS = [
  { page: 'org-overview', icon: 'overview', label: 'Resumen' },
  { page: 'org-members', icon: 'members', label: 'Socios' },
  { page: 'org-directorio', icon: 'directorio', label: 'Directorio' },
  { page: 'org-asambleas', icon: 'asambleas', label: 'Asambleas' },
  { page: 'org-elecciones', icon: 'elecciones', label: 'Elecciones' },
  { page: 'org-comunicaciones', icon: 'comunicaciones', label: 'Comunicaciones' },
  { page: 'org-finanzas', icon: 'finanzas', label: 'Finanzas' },
  { page: 'org-proyectos', icon: 'proyectos', label: 'Proyectos' },
  { page: 'org-documentos', icon: 'documentos', label: 'Documentos' },
  { page: 'org-actividades', icon: 'actividades', label: 'Actividades' },
];

// Secondary nav icons (full SVGs with nav-icon class for sidebar)
const SECONDARY_NAV_ICONS = {
  'mis-organizaciones': '<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M9 22V12h6v10"></path></svg>',
  'guia-constitucion': '<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
  'biblioteca': '<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
  'noticias': '<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"></path><path d="M21 13v6a2 2 0 0 1-2 2"></path><path d="M21 6h-8a2 2 0 0 0-2 2v7"></path></svg>',
};

// Secondary nav items (below org section)
const SECONDARY_NAV_ITEMS = [
  { page: 'mis-organizaciones', label: 'Crear Organización' },
  { page: 'guia-constitucion', label: 'Guia de Constitucion' },
  { page: 'biblioteca', label: 'Biblioteca de Documentos' },
  { page: 'noticias', label: 'Noticias' },
];

// Org bottom nav items
const ORG_BOTTOM_NAV = [
  { page: 'home', icon: 'home', label: 'Inicio' },
  { page: 'mis-organizaciones', icon: 'crearOrg', label: 'Crear Org' },
  { page: 'guia-constitucion', icon: 'guia', label: 'Guía' },
  { page: 'biblioteca', icon: 'biblioteca', label: 'Biblioteca' },
  { page: 'noticias', icon: 'noticias', label: 'Noticias' },
];

// Member sidebar items
const MEMBER_NAV_ITEMS = [
  { page: 'member-overview', icon: 'overview', label: 'Información' },
  { page: 'member-directorio', icon: 'directorio', label: 'Directorio' },
  { page: 'member-documentos', icon: 'documentos', label: 'Documentos' },
  { page: 'member-actividades', icon: 'actividades', label: 'Actividades' },
  { page: 'member-asambleas', icon: 'asambleas', label: 'Asambleas' },
  { page: 'member-password', icon: 'password', label: 'Cambiar Contraseña' },
];

// Member bottom nav items
const MEMBER_BOTTOM_NAV = [
  { page: 'member-overview', icon: 'home', label: 'Inicio' },
  { page: 'member-asambleas', icon: 'members', label: 'Asambleas' },
  { page: 'member-directorio', icon: 'directorio', label: 'Directorio' },
  { page: 'member-documentos', icon: 'guia', label: 'Documentos' },
];

class SidebarManager {
  constructor() {
    this.currentRole = null;
  }

  /**
   * Initialize sidebar + bottom nav for a given role
   * @param {string} role - ORGANIZADOR | MIEMBRO | MIEMBRO_DIRECTIVO
   */
  init(role) {
    this.currentRole = role;
    this.renderSidebar(role);
    this.renderBottomNav(role);
  }

  /**
   * Render sidebar content into #sidebar-content
   */
  renderSidebar(role) {
    const container = document.getElementById('sidebar-content');
    if (!container) return;

    if (role === 'ORGANIZADOR' || role === 'MIEMBRO_DIRECTIVO') {
      container.innerHTML = this._renderOrgSidebar();
    } else if (role === 'MIEMBRO') {
      container.innerHTML = this._renderMemberSidebar();
    }
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
   * Generate org sidebar HTML (Home + org-selector + admin menu + secondary)
   */
  _renderOrgSidebar() {
    // Home link
    let html = `<ul class="nav-list">
                <li><a href="#" data-page="home" class="nav-link active">
                    <svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    <span class="nav-text">Inicio</span>
                </a></li>
            </ul>`;

    // Org nav section
    html += `<div id="org-nav-section" class="nav-org-section" style="display: none;">
                <div class="org-selector-container">
                    <label for="org-selector" class="org-selector-label">Mi Organización</label>
                    <select id="org-selector" class="org-selector">
                        <!-- Opciones generadas dinámicamente -->
                    </select>
                </div>
                <div class="nav-section-collapsible" id="org-menu-toggle">
                    <span class="nav-section-title">
                        ${ICONS.admin}
                        Administración
                    </span>
                    <svg class="chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
                <ul class="nav-section-items" id="org-nav-items">`;

    for (const item of ORG_NAV_ITEMS) {
      html += `<li><a href="#" data-page="${item.page}" class="nav-link-sub">
                        ${ICONS[item.icon]}
                        <span>${item.label}</span>
                    </a></li>`;
    }

    html += `</ul>
            </div>`;

    // Secondary nav
    html += `<ul class="nav-list nav-list-secondary">`;
    for (const item of SECONDARY_NAV_ITEMS) {
      html += `<li><a href="#" data-page="${item.page}" class="nav-link">
                    ${SECONDARY_NAV_ICONS[item.page]}
                    <span class="nav-text">${item.label}</span>
                </a></li>`;
    }
    html += `</ul>`;

    return html;
  }

  /**
   * Generate member sidebar HTML
   */
  _renderMemberSidebar() {
    let html = `<div id="member-nav-section" class="nav-org-section" style="display: block;">
                <div class="nav-section-collapsible" style="cursor:default;">
                    <span class="nav-section-title">
                        ${ICONS.memberIcon}
                        Mi Organización
                    </span>
                </div>
                <ul class="nav-section-items" style="display:block;">`;

    for (const item of MEMBER_NAV_ITEMS) {
      html += `<li><a href="#" data-page="${item.page}" class="nav-link-sub">
                        ${ICONS[item.icon]}
                        <span>${item.label}</span>
                    </a></li>`;
    }

    html += `</ul>
            </div>`;

    return html;
  }

  /**
   * Generate bottom nav items HTML
   */
  _renderBottomNavItems(items, activePage) {
    let html = '';
    for (const item of items) {
      const isActive = item.page === activePage ? ' active' : '';
      html += `<button class="nav-item${isActive}" data-page="${item.page}">
                ${icon(item.icon, 24, 24)}
                <span>${item.label}</span>
            </button>`;
    }
    return html;
  }

  /**
   * Update active link in sidebar and bottom nav
   */
  updateActiveLink(page) {
    // Sidebar: remove active from all nav-link-sub
    document.querySelectorAll('#sidebar-content .nav-link-sub').forEach(l => l.classList.remove('active'));
    const sidebarLink = document.querySelector(`#sidebar-content [data-page="${page}"]`);
    if (sidebarLink) sidebarLink.classList.add('active');

    // Bottom nav: remove active from all nav-item
    const bottomNav = document.getElementById('bottom-nav-container') || document.getElementById('member-bottom-nav');
    if (bottomNav) {
      bottomNav.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      const bottomLink = bottomNav.querySelector(`[data-page="${page}"]`);
      if (bottomLink) bottomLink.classList.add('active');
    }
  }
}

export const sidebarManager = new SidebarManager();
