/**
 * Main Entry Point
 * Integra la nueva arquitectura con la UI existente
 */

// Importar estilos compartidos (se incluirán en el bundle CSS)
import './src/shared/styles/variables.css';
import './src/shared/styles/components.css';

import { initializeApp, appState, showToast, handleLogout } from './src/app.js';
// WizardController migrated to React - /app/wizard
import { CHILE_REGIONS, getComunasByRegion } from './src/data/chile-regions.js';
import { getUserRepository } from './src/infrastructure/config/container.js';
import { organizationsService, ORG_STATUS, ORG_STATUS_LABELS, ORG_STATUS_COLORS } from './src/services/OrganizationsService.js';
// AdminDashboard migrated to React - /app/admin
import { organizationMenuManager } from './src/presentation/organization/OrganizationMenuManager.js';
import { sidebarManager } from './src/presentation/shared/SidebarManager.js';
import { notificationService } from './src/services/NotificationService.js';
import { pdfService } from './src/services/PDFService.js';
import { apiService } from './src/services/ApiService.js';
import { indexedDBService } from './src/infrastructure/database/IndexedDBService.js';
import guiaConstitucionManager from './src/presentation/guia/GuiaConstitucionManager.js';
import bibliotecaManager from './src/presentation/biblioteca/BibliotecaManager.js';
import newsManager from './src/presentation/news/NewsManager.js';

// Componente de estado de conexión (se auto-inicializa)
import './src/shared/components/ConnectionStatus.js';

console.log('📦 main.js cargado');

// Función global para abrir wizard con progreso guardado (accesible desde onclick)
window.openLocalDraftWizard = function() {
  window.location.href = '/app/wizard';
};

// Función global para descartar borrador local
window.discardLocalDraft = function() {
  if (confirm('¿Estás seguro de que deseas descartar este borrador? Esta acción no se puede deshacer.')) {
    localStorage.removeItem('wizardProgress');
    showToast('Borrador descartado', 'info');
    if (typeof renderOrganizations === 'function') {
      renderOrganizations();
    } else {
      location.reload();
    }
  }
};

// Helper: Obtener icono según tipo de organización
function getOrgIcon(type) {
  if (type === 'JUNTA_VECINOS' || type === 'COMITE_VECINOS') return '🏘️';
  if (type?.startsWith('CLUB_')) return '⚽';
  if (type?.startsWith('CENTRO_')) return '🏢';
  if (type?.startsWith('AGRUPACION_')) return '👥';
  if (type?.startsWith('COMITE_')) return '📋';
  if (type?.startsWith('ORG_')) return '🎯';
  if (type === 'GRUPO_TEATRO') return '🎭';
  if (type === 'CORO') return '🎵';
  if (type === 'TALLER_ARTESANIA') return '🎨';
  return '👥';
}

// Helper: Obtener nombre legible del tipo
function getOrgTypeName(type) {
  const types = {
    'JUNTA_VECINOS': 'Junta de Vecinos', 'COMITE_VECINOS': 'Comité de Vecinos',
    'CLUB_DEPORTIVO': 'Club Deportivo', 'CLUB_ADULTO_MAYOR': 'Club de Adulto Mayor',
    'CLUB_JUVENIL': 'Club Juvenil', 'CLUB_CULTURAL': 'Club Cultural',
    'CENTRO_MADRES': 'Centro de Madres', 'CENTRO_PADRES': 'Centro de Padres y Apoderados',
    'CENTRO_CULTURAL': 'Centro Cultural', 'AGRUPACION_FOLCLORICA': 'Agrupación Folclórica',
    'AGRUPACION_CULTURAL': 'Agrupación Cultural', 'AGRUPACION_JUVENIL': 'Agrupación Juvenil',
    'AGRUPACION_AMBIENTAL': 'Agrupación Ambiental', 'COMITE_VIVIENDA': 'Comité de Vivienda',
    'COMITE_ALLEGADOS': 'Comité de Allegados', 'COMITE_APR': 'Comité de Agua Potable Rural',
    'ORG_SCOUT': 'Organización Scout', 'ORG_MUJERES': 'Organización de Mujeres',
    'GRUPO_TEATRO': 'Grupo de Teatro', 'CORO': 'Coro o Agrupación Musical',
    'TALLER_ARTESANIA': 'Taller de Artesanía', 'OTRA_FUNCIONAL': 'Otra Organización Funcional'
  };
  return types[type] || 'Organización Comunitaria';
}

// Service Worker (PWA)
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

if ('serviceWorker' in navigator && !isDevelopment) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎯 DOM Content Loaded - Inicializando eventos...');

  // Check if special roles are logged in - redirect to their dashboards
  const earlyUser = localStorage.getItem('currentUser');
  if (earlyUser) {
    try {
      const parsed = JSON.parse(earlyUser);
      if (parsed.role === 'MINISTRO_FE') {
        console.log('⚖️ Ministro detectado, redirigiendo al dashboard de ministro...');
        window.location.href = '/app/ministro';
        return;
      }
      if (parsed.role === 'MUNICIPALIDAD') {
        console.log('🏛️ Admin detectado, redirigiendo al dashboard de admin...');
        window.location.href = '/app/admin';
        return;
      }
    } catch (e) {
      localStorage.removeItem('currentUser');
    }
  }
  // Legacy migration: if currentMinistro exists, migrate to currentUser
  const legacyMinistro = localStorage.getItem('currentMinistro');
  if (legacyMinistro) {
    try {
      const ministro = JSON.parse(legacyMinistro);
      if (ministro.role === 'MINISTRO_FE') {
        localStorage.setItem('currentUser', legacyMinistro);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.removeItem('currentMinistro');
        localStorage.removeItem('isMinistroAuthenticated');
        window.location.href = '/app/ministro';
        return;
      }
    } catch (e) {
      localStorage.removeItem('currentMinistro');
    }
  }

  // Inicializar aplicación primero
  await initializeApp();

  // Cargar usuario desde localStorage
  // Nota: auth_token está en HttpOnly cookie (no accesible via JS)
  // Usamos isAuthenticated flag + currentUser para verificar sesión
  const currentUserData = localStorage.getItem('currentUser');
  const isAuthenticated = localStorage.getItem('isAuthenticated');

  if (currentUserData && isAuthenticated) {
    try {
      const user = JSON.parse(currentUserData);
      appState.setCurrentUser(user);
      appState.initializeAuthService();

      // For non-MIEMBRO roles, render sidebar immediately
      if (user.role !== 'MIEMBRO') {
        sidebarManager.init('ORGANIZADOR');
      }
      // MIEMBRO sidebar is rendered later after determining if directivo

      // Actualizar nombre en header
      const userName = document.getElementById('user-name');
      if (userName) {
        userName.textContent = user.firstName || user.profile?.firstName || user.email;
      }

      // Actualizar foto y iniciales en header
      const headerPhoto = document.getElementById('header-user-photo');
      const headerInitials = document.getElementById('header-user-initials');
      if (headerPhoto && headerInitials) {
        if (user.profile?.photo) {
          headerPhoto.src = user.profile.photo;
          headerPhoto.style.display = 'block';
          headerInitials.style.display = 'none';
        } else {
          headerPhoto.style.display = 'none';
          headerInitials.style.display = 'block';
          const firstName = user.firstName || user.profile?.firstName || 'U';
          const lastName = user.lastName || user.profile?.lastName || 'S';
          const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
          headerInitials.textContent = initials;
        }
      }

      console.log('✅ Usuario cargado:', user);

      // Sincronizar datos desde el servidor
      if (user.role !== 'MIEMBRO') {
        // Mostrar UI inmediatamente con datos de cache
        hideLoadingScreen();
        // Fire-and-forget: sync en background, no bloquear UI
        Promise.all([
          organizationsService.sync(),
          notificationService.sync()
        ]).then(() => {
          notificationService.startPolling();
        }).catch((syncError) => {
          console.warn('Error sincronizando datos:', syncError);
          notificationService.startPolling();
        });
      } else {
        // MIEMBRO: sync en background sin bloquear
        notificationService.sync().then(() => notificationService.startPolling()).catch(() => notificationService.startPolling());
      }

      // Pre-cargar datos del perfil por si el usuario navega allí
      loadProfileData();

      // Setup para usuarios MIEMBRO (bifurca entre directivo y socio regular)
      if (user.role === 'MIEMBRO') {
        try {
          // 1. Obtener datos de la organización + flag _isDirectivo
          const memberData = await apiService.getMyOrganization();
          let memberOrgs = [];
          if (memberData && memberData.organizations) {
            memberOrgs = memberData.organizations;
          } else if (memberData) {
            memberOrgs = [memberData];
          }

          // Determinar si alguna org tiene _isDirectivo
          const directivoOrg = memberOrgs.find(o => o._isDirectivo);
          const isDirectivoMiembro = !!directivoOrg;

          if (isDirectivoMiembro) {
            // ========== DIRECTIVO: mostrar dashboard completo de organizador ==========
            console.log('🔑 Miembro directivo detectado, cargando dashboard de organizador...');
            sessionStorage.setItem('isDirectivoMiembro', 'true');

            // Render org sidebar + bottom nav for directivo
            sidebarManager.init('MIEMBRO_DIRECTIVO');

            // Pre-cargar organizaciones en organizationsService
            organizationsService.organizations = memberOrgs;
            organizationsService.loaded = true;
            localStorage.setItem('user_organizations', JSON.stringify(memberOrgs));

            // Mostrar UI inmediatamente
            hideLoadingScreen();

            // Inicializar menú de organizaciones en sidebar (no bloquear)
            organizationMenuManager.init().catch(e => console.error('Error menú:', e));

            // Navegar a org-overview
            const savedPage = sessionStorage.getItem('app_current_page');
            if (savedPage && (savedPage.startsWith('org-') || savedPage === 'profile')) {
              appState.navigateTo(savedPage);
            } else {
              appState.navigateTo('org-overview');
            }
          } else {
            // ========== SOCIO REGULAR: mostrar MemberDashboard limitado ==========
            sessionStorage.removeItem('isDirectivoMiembro');

            // Render member sidebar + bottom nav
            sidebarManager.init('MIEMBRO');

            // Mostrar UI inmediatamente
            hideLoadingScreen();

            // Reemplazar Home con contenido de miembro
            const pageHome = document.getElementById('page-home');
            if (pageHome) {
              const orgName = (memberOrgs[0]?.organizationName) || user.organizationName || 'tu organización';
              const firstName = user.firstName || user.name || 'Socio/a';
              pageHome.innerHTML = `
                <section class="home-welcome-section">
                  <div class="welcome-hero">
                    <div class="welcome-hero-content">
                      <h2>Bienvenido/a, ${firstName}</h2>
                      <p>${orgName}</p>
                    </div>
                  </div>
                </section>
                <section class="home-quick-links">
                  <h3>Accesos Rápidos</h3>
                  <div class="quick-links-grid">
                    <button class="quick-link-card" data-page="member-overview">
                      <div class="quick-link-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                          <polyline points="9 22 9 12 15 12 15 22"></polyline>
                        </svg>
                      </div>
                      <span class="quick-link-label">Mi Organización</span>
                      <span class="quick-link-desc">Resumen general</span>
                    </button>
                    <button class="quick-link-card" data-page="member-directorio">
                      <div class="quick-link-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      </div>
                      <span class="quick-link-label">Directorio</span>
                      <span class="quick-link-desc">Mesa directiva</span>
                    </button>
                    <button class="quick-link-card" data-page="member-documentos">
                      <div class="quick-link-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <line x1="16" y1="13" x2="8" y2="13"></line>
                          <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                      </div>
                      <span class="quick-link-label">Documentos</span>
                      <span class="quick-link-desc">Archivos de la organización</span>
                    </button>
                    <button class="quick-link-card" data-page="member-actividades">
                      <div class="quick-link-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                      </div>
                      <span class="quick-link-label">Actividades</span>
                      <span class="quick-link-desc">Eventos y reuniones</span>
                    </button>
                    <button class="quick-link-card" data-page="member-asambleas">
                      <div class="quick-link-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                      </div>
                      <span class="quick-link-label">Asambleas</span>
                      <span class="quick-link-desc">Reuniones y votaciones</span>
                    </button>
                    <button class="quick-link-card" data-page="member-password">
                      <div class="quick-link-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      </div>
                      <span class="quick-link-label">Contraseña</span>
                      <span class="quick-link-desc">Cambiar mi contraseña</span>
                    </button>
                  </div>
                </section>
              `;
            }

            // Import dinámico de MemberDashboard con datos pre-cargados
            const { memberDashboard } = await import('./src/presentation/member/MemberDashboard.js');
            memberDashboard.initWithData(memberOrgs, user);

            // Actualizar sidebar con organizaciones del miembro
            if (memberDashboard.orgs.length > 0) {
              const memberNavSection = document.getElementById('member-nav-section');
              if (memberNavSection) {
                const collapsibleDiv = memberNavSection.querySelector('.nav-section-collapsible');
                if (collapsibleDiv) {
                  if (memberDashboard.orgs.length === 1) {
                    // Una sola org: mostrar nombre directamente
                    const sidebarTitle = collapsibleDiv.querySelector('.nav-section-title');
                    if (sidebarTitle) {
                      const svgIcon = sidebarTitle.querySelector('svg');
                      sidebarTitle.textContent = '';
                      if (svgIcon) sidebarTitle.appendChild(svgIcon);
                      sidebarTitle.append(` ${memberDashboard.org.organizationName}`);
                    }
                  } else {
                    // Múltiples orgs: agregar selector dropdown
                    const sidebarTitle = collapsibleDiv.querySelector('.nav-section-title');
                    if (sidebarTitle) {
                      const svgIcon = sidebarTitle.querySelector('svg');
                      sidebarTitle.innerHTML = '';
                      if (svgIcon) sidebarTitle.appendChild(svgIcon);

                      const select = document.createElement('select');
                      select.id = 'member-org-selector';
                      select.style.cssText = 'margin-left:8px;padding:4px 8px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-weight:600;background:white;color:#1e293b;max-width:180px;cursor:pointer;';
                      memberDashboard.orgs.forEach(o => {
                        const opt = document.createElement('option');
                        opt.value = o._id || o.id;
                        opt.textContent = o.organizationName;
                        if ((o._id || o.id) === memberDashboard.getActiveOrgId()) opt.selected = true;
                        select.appendChild(opt);
                      });
                      select.addEventListener('change', () => {
                        memberDashboard.selectOrg(select.value);
                        // Re-render la página actual
                        const currentPage = document.querySelector('.page-view[style*="display: block"], .page-view:not([style*="display: none"])');
                        if (currentPage) {
                          const pageId = currentPage.id.replace('page-', '').replace('member-', '');
                          memberDashboard.renderPage(pageId);
                        }
                        // Actualizar home welcome subtitle
                        const homeWelcome = document.querySelector('#page-home .welcome-hero-content p');
                        if (homeWelcome) homeWelcome.textContent = memberDashboard.org?.organizationName || '';
                      });
                      sidebarTitle.appendChild(select);
                    }
                  }
                }
              }

              // Home welcome subtitle
              const homeWelcome = document.querySelector('#page-home .welcome-hero-content p');
              if (homeWelcome) homeWelcome.textContent = memberDashboard.org?.organizationName || '';
            }

            // Listeners para navegación de miembro (sidebar + home quick links + bottom nav)
            const setupMemberNavListeners = () => {
              document.querySelectorAll('[data-page^="member-"]').forEach(link => {
                link.addEventListener('click', (e) => {
                  e.preventDefault();
                  const page = link.dataset.page;
                  appState.navigateTo(page);
                  const pageName = page.replace('member-', '');
                  memberDashboard.renderPage(pageName);
                  // Update active state via SidebarManager
                  sidebarManager.updateActiveLink(page);
                });
              });
            };
            setupMemberNavListeners();

            // Check for mustChangePassword
            const params = new URLSearchParams(window.location.search);
            if (user.mustChangePassword || params.get('changePassword') === 'true') {
              appState.navigateTo('member-password');
              memberDashboard.renderPage('password');
            } else {
              // Restaurar página guardada o ir a overview por defecto
              const savedMemberPage = sessionStorage.getItem('app_current_page');
              if (savedMemberPage && savedMemberPage.startsWith('member-')) {
                appState.navigateTo(savedMemberPage);
                memberDashboard.renderPage(savedMemberPage.replace('member-', ''));
              } else {
                appState.navigateTo('member-overview');
                memberDashboard.renderPage('overview');
              }
            }
          }
        } catch (memberErr) {
          console.error('Error setting up member dashboard:', memberErr);
        }
      }

      // Restaurar página guardada al recargar (solo para usuarios no-admin y no-miembro)
      // Los admin se restauran en el bloque de admin setup
      if (user.role !== 'MUNICIPALIDAD' && user.role !== 'MIEMBRO') {
        const savedPage = sessionStorage.getItem('app_current_page');
        console.log('🔄 Restaurando página para', user.role, ':', savedPage);
        if (savedPage && savedPage !== 'admin') {
          appState.navigateTo(savedPage);
        }
      }
    } catch (error) {
      console.error('Error al cargar usuario:', error);
    }
  } else if (currentUserData && !isAuthenticated) {
    // Usuario en localStorage pero sin flag de autenticación - limpiar
    console.log('Sesión no válida, limpiando datos...');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAuthenticated');
  }

  // Click en logo para volver al inicio (o admin si es administrador, o member-overview si es miembro)
  const logoHomeLink = document.getElementById('logo-home-link');
  if (logoHomeLink) {
    logoHomeLink.addEventListener('click', (e) => {
      e.preventDefault();
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          if (user.role === 'MUNICIPALIDAD') {
            appState.navigateTo('admin');
            return;
          }
          if (user.role === 'MIEMBRO') {
            if (sessionStorage.getItem('isDirectivoMiembro') === 'true') {
              appState.navigateTo('org-overview');
            } else {
              appState.navigateTo('member-overview');
              import('./src/presentation/member/MemberDashboard.js').then(m => m.memberDashboard.renderPage('overview'));
            }
            return;
          }
        } catch (err) {
          console.error('Error parsing user data:', err);
        }
      }
      appState.navigateTo('home');
    });
  }

  // Botón "Comenzar ahora" - Abrir wizard
  const btnCrearOrg = document.getElementById('btn-crear-organizacion');
  console.log('Comenzar ahora button:', btnCrearOrg);
  if (btnCrearOrg) {
    btnCrearOrg.addEventListener('click', () => {
      console.log('🚀 Comenzar ahora clicked!');
      console.log('Usuario autenticado, abriendo wizard...');
      // Abrir wizard
      window.location.href = '/app/wizard';
    });
    console.log('✅ Comenzar ahora event listener attached');
  }

  // Botón de logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      // Mostrar loading screen inmediatamente para evitar flash de contenido
      const app = document.getElementById('app');
      if (app) app.classList.remove('loaded');

      // Detener polling de notificaciones
      notificationService.stopPolling();

      // Limpiar cookies del servidor y localStorage
      await apiService.logout();
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('user_organizations');
      localStorage.removeItem('ministros_fe');
      localStorage.removeItem('ministro_assignments');
      localStorage.removeItem('user_notifications');
      sessionStorage.removeItem('isDirectivoMiembro');

      await handleLogout();

      // Redirigir inmediatamente a auth
      window.location.href = '/app/login';
    });
  }

  // Menú lateral
  const menuBtn = document.getElementById('menu-btn');
  const sideNav = document.getElementById('side-nav');
  const closeNavBtn = document.getElementById('close-nav-btn');
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
  const mainContent = document.getElementById('main-content');
  const isDesktop = () => window.innerWidth >= 1024;

  // Restore sidebar collapsed state from localStorage on desktop
  if (isDesktop() && sideNav && mainContent) {
    const savedCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (savedCollapsed) {
      sideNav.classList.add('collapsed');
      mainContent.classList.add('sidebar-collapsed');
    }
  }

  // Mobile menu button - only for mobile overlay behavior
  if (menuBtn && sideNav) {
    menuBtn.addEventListener('click', () => {
      const isOpen = sideNav.classList.contains('open');
      const existingOverlay = document.getElementById('overlay');

      if (isOpen) {
        sideNav.classList.remove('open');
        if (existingOverlay) existingOverlay.remove();
      } else {
        sideNav.classList.add('open');

        if (!existingOverlay) {
          const overlay = document.createElement('div');
          overlay.id = 'overlay';
          overlay.className = 'overlay active';
          document.body.appendChild(overlay);

          overlay.addEventListener('click', () => {
            sideNav.classList.remove('open');
            overlay.remove();
          });
        }
      }
    });
  }

  if (closeNavBtn) {
    closeNavBtn.addEventListener('click', () => {
      sideNav.classList.remove('open');
      const overlay = document.getElementById('overlay');
      if (overlay) overlay.remove();
    });
  }

  // Desktop sidebar toggle (collapse/expand)
  if (sidebarToggleBtn && sideNav && mainContent) {
    sidebarToggleBtn.addEventListener('click', () => {
      sideNav.classList.toggle('collapsed');
      mainContent.classList.toggle('sidebar-collapsed');
      localStorage.setItem('sidebarCollapsed', sideNav.classList.contains('collapsed'));
    });
  }

  // Notifications Panel
  const notificationsBtn = document.getElementById('notifications-btn');
  const notificationsPanel = document.getElementById('notifications-panel');
  const notificationsList = document.getElementById('notifications-list');
  const btnMarkAllRead = document.getElementById('btn-mark-all-read');
  const notificationsOverlay = document.getElementById('notifications-overlay');
  const btnCloseNotifications = document.getElementById('btn-close-notifications');
  const notificationCountBadge = document.getElementById('notification-count-badge');

  function openNotificationsPanel() {
    if (notificationsOverlay) notificationsOverlay.classList.add('open');
    if (notificationsPanel) notificationsPanel.classList.add('open');
    loadNotifications();
  }

  function closeNotificationsPanel() {
    if (notificationsOverlay) notificationsOverlay.classList.remove('open');
    if (notificationsPanel) notificationsPanel.classList.remove('open');
  }

  async function loadNotifications() {
    if (!appState.currentUser) return;

    try {
      // Cargar notificaciones desde el servidor
      const notifications = await notificationService.getAllAsync();
      const unreadNotifications = notifications.filter(n => !n.read);
      const unreadCount = unreadNotifications.length;

      // Update header badge
      const badge = document.querySelector('.notification-badge');
      if (badge) {
        if (unreadCount > 0) {
          badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }

      // Update panel count badge
      if (notificationCountBadge) {
        if (unreadCount > 0) {
          notificationCountBadge.textContent = `${unreadCount} nueva${unreadCount !== 1 ? 's' : ''}`;
          notificationCountBadge.style.display = 'inline-block';
        } else {
          notificationCountBadge.style.display = 'none';
        }
      }

      // Show/hide mark all button
      if (btnMarkAllRead) {
        btnMarkAllRead.style.display = unreadCount > 0 ? 'block' : 'none';
      }

      // Render notifications
      if (notifications.length === 0) {
        notificationsList.innerHTML = `
          <div class="notifications-empty">
            <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            <p>No tienes notificaciones</p>
          </div>
        `;
      } else {
        notificationsList.innerHTML = notifications.map(notif => {
          const timeAgo = getTimeAgo(new Date(notif.createdAt));
          const icon = notif.type === 'schedule_change' ? '📅' :
                       notif.type === 'ministro_assigned' ? '⚖️' :
                       notif.type === 'status_update' ? '🔔' :
                       notif.type === 'organization_deleted' ? '🗑️' : '📬';
          const notifId = notif._id || notif.id;

          return `
            <div class="notification-item ${notif.read ? '' : 'unread'}" data-id="${notifId}">
              <div class="notification-content">
                <div class="notification-icon">${icon}</div>
                <div class="notification-text">
                  <p class="notification-title">${notif.title}</p>
                  <p class="notification-message">${notif.message}</p>
                  <span class="notification-time">${timeAgo}</span>
                  <div class="notification-actions">
                    ${!notif.read ? `<button class="btn-notification btn-mark-read" data-id="${notifId}">Marcar como leída</button>` : ''}
                    <button class="btn-notification btn-delete" data-id="${notifId}">Eliminar</button>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('');

        // Add event listeners to actions
        notificationsList.querySelectorAll('.btn-mark-read').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const notifId = btn.dataset.id;
            await notificationService.markAsRead(notifId);
            loadNotifications();
          });
        });

        notificationsList.querySelectorAll('.btn-delete').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const notifId = btn.dataset.id;
            await notificationService.delete(notifId);
            loadNotifications();
          });
        });
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }

  // Función para actualizar solo el badge sin recargar todo el panel
  async function updateNotificationBadge() {
    if (!appState.currentUser) return;
    try {
      const count = await notificationService.getUnreadCountAsync();
      const badge = document.querySelector('.notification-badge');
      if (badge) {
        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : count;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (e) {
      console.error('Error updating badge:', e);
    }
  }

  function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-CL');
  }

  if (notificationsBtn) {
    notificationsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = notificationsPanel && notificationsPanel.classList.contains('open');

      if (isOpen) {
        closeNotificationsPanel();
      } else {
        openNotificationsPanel();
      }
    });
  }

  // Close button
  if (btnCloseNotifications) {
    btnCloseNotifications.addEventListener('click', closeNotificationsPanel);
  }

  // Close on overlay click
  if (notificationsOverlay) {
    notificationsOverlay.addEventListener('click', closeNotificationsPanel);
  }

  if (btnMarkAllRead) {
    btnMarkAllRead.addEventListener('click', async () => {
      if (appState.currentUser) {
        await notificationService.markAllAsRead(appState.currentUser.id);
        loadNotifications();
        showToast('Todas las notificaciones marcadas como leídas', 'success');
      }
    });
  }

  // Load notification badge on init (cargar badge al inicio)
  if (appState.currentUser) {
    updateNotificationBadge();
  }

  // Navegación
  document.querySelectorAll('.nav-link, .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      if (page) {
        appState.navigateTo(page);
        // Cargar datos del perfil si se navega a esa página
        if (page === 'profile') {
          loadProfileData();
        } else if (page === 'mis-organizaciones') {
          renderOrganizations();
        } else if (page === 'guia-constitucion') {
          guiaConstitucionManager.init();
        } else if (page === 'biblioteca') {
          bibliotecaManager.init();
        } else if (page === 'noticias') {
          newsManager.init();
        }
      }
    });
  });

  // Quick link cards en Home
  document.querySelectorAll('.quick-link-card').forEach(card => {
    card.addEventListener('click', () => {
      const page = card.dataset.page;
      if (page) {
        appState.navigateTo(page);
        if (page === 'mis-organizaciones') {
          renderOrganizations();
        } else if (page === 'guia-constitucion') {
          guiaConstitucionManager.init();
        } else if (page === 'biblioteca') {
          bibliotecaManager.init();
        } else if (page === 'noticias') {
          newsManager.init();
        }
      }
    });
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      const parent = btn.closest('.page-view');

      parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      parent.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      const activeContent = parent.querySelector(`#${tabId}`);
      if (activeContent) {
        activeContent.classList.add('active');
      }
    });
  });

  // Click en nombre de usuario para ir al perfil
  const userNameBtn = document.getElementById('user-name-btn');
  if (userNameBtn) {
    userNameBtn.addEventListener('click', () => {
      appState.navigateTo('profile');
      loadProfileData();
    });
  }

  // Botón volver al inicio desde perfil
  const btnBackHome = document.querySelector('.btn-back-home');
  if (btnBackHome) {
    btnBackHome.addEventListener('click', () => {
      // Si es MUNICIPALIDAD, ir al panel de admin
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          if (user.role === 'MUNICIPALIDAD') {
            appState.navigateTo('admin');
            return;
          }
        } catch (err) {
          console.error('Error parsing user data:', err);
        }
      }
      appState.navigateTo('home');
    });
  }

  // Inicializar features
  initCounters();
  initSearch();
  initPoll();
  initEvents();
  initProfile();
  initOrganizations();

  // Verificar si el usuario es admin y configurar UI
  setupUserRoleUI();
});

// Animated counter
function animateCounter(element) {
  // Skip admin dashboard counters (they don't have data-target and are managed dynamically)
  if (element.id && element.id.startsWith('admin-')) {
    return;
  }

  const target = parseInt(element.dataset.target);

  // Skip if no valid target
  if (isNaN(target)) {
    return;
  }

  const duration = 2000;
  const increment = target / (duration / 16);
  let current = 0;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      element.textContent = target.toLocaleString();
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current).toLocaleString();
    }
  }, 16);
}

function initCounters() {
  const counters = document.querySelectorAll('.stat-value, .stat-number');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(counter => observer.observe(counter));
}

// Quick search
function initSearch() {
  const searchInput = document.getElementById('quick-search');
  const searchClear = document.getElementById('search-clear');
  const searchResults = document.getElementById('search-results');

  if (!searchInput) return;

  const searchData = [
    { title: 'Reglamento Interno Consejos Escolares', description: 'Documento oficial con normativas y procedimientos', category: 'Documentos', icon: '📄' },
    { title: 'Taller de Liderazgo Estudiantil', description: 'Capacitación gratuita para estudiantes', category: 'Eventos', icon: '🎓' },
  ];

  let searchTimeout;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    if (query) {
      searchClear.classList.add('visible');
    } else {
      searchClear.classList.remove('visible');
      searchResults.classList.remove('visible');
      return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.classList.remove('visible');
    searchResults.classList.remove('visible');
    searchInput.focus();
  });

  function performSearch(query) {
    const lowerQuery = query.toLowerCase();
    const results = searchData.filter(item =>
      item.title.toLowerCase().includes(lowerQuery) ||
      item.description.toLowerCase().includes(lowerQuery)
    );

    if (results.length > 0) {
      searchResults.innerHTML = results.map(result => `
        <div class="search-result-item">
          <div class="search-result-title">${result.icon} ${result.title}</div>
          <div class="search-result-description">${result.description}</div>
        </div>
      `).join('');
      searchResults.classList.add('visible');
    } else {
      searchResults.innerHTML = `
        <div class="search-no-results">
          <div>No se encontraron resultados para "${query}"</div>
        </div>
      `;
      searchResults.classList.add('visible');
    }
  }
}

// Poll
function initPoll() {
  const pollOptions = document.querySelectorAll('.poll-option');

  pollOptions.forEach(option => {
    option.addEventListener('click', () => {
      pollOptions.forEach(opt => opt.style.borderColor = '');
      option.style.borderColor = 'var(--primary-color)';
      option.style.borderWidth = '3px';
      showToast('¡Gracias por tu voto!');
    });
  });
}

// Events
function initEvents() {
  const eventBtns = document.querySelectorAll('.event-btn');

  eventBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.textContent === 'Confirmar') {
        btn.textContent = '✓ Confirmado';
        btn.style.background = 'var(--gradient-primary)';
        btn.style.color = 'white';
        showToast('Asistencia confirmada');
      } else {
        btn.textContent = 'Confirmar';
        btn.style.background = 'transparent';
        btn.style.color = 'var(--primary-color)';
        showToast('Asistencia cancelada');
      }
    });
  });
}

// Online/Offline status
window.addEventListener('online', () => {
  showToast('Conexión restaurada', 'success');
});

window.addEventListener('offline', () => {
  showToast('Sin conexión - Modo offline activado', 'info');
});

// ========================================
// Centralizar lógica al navegar entre páginas
// ========================================
window.addEventListener('page-navigate', (e) => {
  const { page } = e.detail;
  if (page === 'profile') {
    loadProfileData();
  } else if (page === 'mis-organizaciones') {
    renderOrganizations();
  } else if (page === 'guia-constitucion') {
    guiaConstitucionManager.init();
  } else if (page === 'biblioteca') {
    bibliotecaManager.init();
  } else if (page === 'noticias') {
    newsManager.init();
  }
});

// ========================================
// Profile Page Functions
// ========================================

async function loadProfileData() {
  // Siempre consultar al servidor para datos frescos y completos
  try {
    const data = await apiService.getCurrentUser();
    if (data && data.user) {
      // Actualizar localStorage con datos completos del servidor
      // Preservar campos existentes (ej: organizationId, organizationName de MIEMBRO)
      const existing = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const safeUser = {
        ...existing,
        _id: data.user._id,
        rut: data.user.rut || '',
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        email: data.user.email,
        phone: data.user.phone || '',
        address: data.user.address || '',
        region: data.user.region || '',
        commune: data.user.commune || '',
        role: data.user.role,
        createdAt: data.user.createdAt || '',
        mustChangePassword: data.user.mustChangePassword
      };
      localStorage.setItem('currentUser', JSON.stringify(safeUser));
      renderProfileUI(safeUser);
      return;
    }
  } catch (error) {
    console.warn('No se pudo obtener datos del servidor, usando localStorage:', error.message);
  }

  // Fallback: usar localStorage si el servidor no responde
  const userData = localStorage.getItem('currentUser');
  if (!userData) {
    console.log('loadProfileData: No user data found');
    return;
  }
  try {
    renderProfileUI(JSON.parse(userData));
  } catch (error) {
    console.error('Error loading profile data:', error);
  }
}

function renderProfileUI(user) {
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  const rut = user.rut || '';
  const phone = user.phone || '';
  const address = user.address || '';
  const region = user.region || (user.role === 'MUNICIPALIDAD' ? 'RM' : '');
  const commune = user.commune || (user.role === 'MUNICIPALIDAD' ? 'Renca' : '');

  // Header
  const initials = `${(firstName || 'U')[0]}${(lastName || 'S')[0]}`.toUpperCase();
  const fullName = `${firstName} ${lastName}`.trim() || 'Usuario';

  const profileInitialsEl = document.getElementById('profile-initials');
  const profileFullnameEl = document.getElementById('profile-fullname');
  const profileEmailEl = document.getElementById('profile-email');

  if (profileInitialsEl) profileInitialsEl.textContent = initials;
  if (profileFullnameEl) profileFullnameEl.textContent = fullName;
  if (profileEmailEl) profileEmailEl.textContent = user.email || '';

  // Profile photo
  const photoEl = document.getElementById('profile-photo');
  const initialsEl = document.getElementById('profile-initials');
  if (photoEl && initialsEl) {
    const photo = user.photo || '';
    if (photo) {
      photoEl.src = photo;
      photoEl.style.display = 'block';
      initialsEl.style.display = 'none';
    } else {
      photoEl.style.display = 'none';
      initialsEl.style.display = 'block';
    }
  }

  // Role badge
  const roleBadge = document.getElementById('profile-role-badge');
  if (roleBadge) {
    const roleLabels = {
      'MUNICIPALIDAD': 'Municipalidad',
      'ORGANIZADOR': 'Organizador',
      'MIEMBRO': 'Miembro',
      'MINISTRO_FE': 'Ministro de Fe'
    };
    roleBadge.textContent = roleLabels[user.role] || 'Usuario';
    roleBadge.classList.toggle('admin', user.role === 'MUNICIPALIDAD');
  }

  // Get region name
  const regionObj = CHILE_REGIONS.find(r => r.id === region);
  const regionName = regionObj ? regionObj.name : '-';

  // Display values
  const displayFullname = document.getElementById('display-fullname');
  const displayRut = document.getElementById('display-rut');
  const displayPhone = document.getElementById('display-phone');
  const displayAddress = document.getElementById('display-address');
  const displayRegion = document.getElementById('display-region');
  const displayCommune = document.getElementById('display-commune');
  const displayEmail = document.getElementById('display-email');

  if (displayFullname) displayFullname.textContent = fullName;
  if (displayRut) displayRut.textContent = rut || '-';
  if (displayPhone) displayPhone.textContent = phone || '-';
  if (displayAddress) displayAddress.textContent = address || '-';
  if (displayRegion) displayRegion.textContent = regionName;
  if (displayCommune) displayCommune.textContent = commune || '-';
  if (displayEmail) displayEmail.textContent = user.email || '-';

  // Form values
  const profileFirstname = document.getElementById('profile-firstname');
  const profileLastname = document.getElementById('profile-lastname');
  const profileRut = document.getElementById('profile-rut');
  const profilePhone = document.getElementById('profile-phone');
  const profileAddress = document.getElementById('profile-address');

  if (profileFirstname) profileFirstname.value = firstName;
  if (profileLastname) profileLastname.value = lastName;
  if (profileRut) profileRut.value = rut;
  if (profilePhone) profilePhone.value = phone || '+56 ';
  if (profileAddress) profileAddress.value = address;

  // Load regions dropdown
  const regionSelect = document.getElementById('profile-region');
  if (regionSelect) {
    regionSelect.innerHTML = '<option value="">Selecciona una región</option>';
    CHILE_REGIONS.forEach(r => {
      const option = document.createElement('option');
      option.value = r.id;
      option.textContent = r.name;
      if (r.id === region) {
        option.selected = true;
      }
      regionSelect.appendChild(option);
    });
  }

  // Load comunas if region is selected
  if (region) {
    loadComunas(region, commune);
  }

  // Account info
  const displayAccountType = document.getElementById('display-account-type');
  const displayCreated = document.getElementById('display-created');

  if (displayAccountType) {
    const roleLabels = {
      'MUNICIPALIDAD': 'Municipalidad',
      'ORGANIZADOR': 'Organizador',
      'MIEMBRO': 'Miembro',
      'MINISTRO_FE': 'Ministro de Fe'
    };
    displayAccountType.textContent = roleLabels[user.role] || 'Usuario';
  }

  if (user.createdAt && displayCreated) {
    const date = new Date(user.createdAt);
    displayCreated.textContent = date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

function loadComunas(regionId, selectedCommune = '') {
  const communeSelect = document.getElementById('profile-commune');
  if (!communeSelect) return;

  const comunas = getComunasByRegion(regionId);

  communeSelect.innerHTML = '<option value="">Selecciona una comuna</option>';
  comunas.forEach(comuna => {
    const option = document.createElement('option');
    option.value = comuna;
    option.textContent = comuna;
    if (comuna === selectedCommune) {
      option.selected = true;
    }
    communeSelect.appendChild(option);
  });
}

function initProfile() {
  // Edit Personal Info
  const btnEditPersonal = document.getElementById('btn-edit-personal');
  const formPersonal = document.getElementById('form-personal');
  const displayPersonal = document.getElementById('display-personal');
  const btnCancelPersonal = document.getElementById('btn-cancel-personal');

  if (btnEditPersonal) {
    btnEditPersonal.addEventListener('click', () => {
      formPersonal.style.display = 'flex';
      displayPersonal.style.display = 'none';
      btnEditPersonal.style.display = 'none';
    });
  }

  if (btnCancelPersonal) {
    btnCancelPersonal.addEventListener('click', () => {
      formPersonal.style.display = 'none';
      displayPersonal.style.display = 'flex';
      btnEditPersonal.style.display = 'block';
      loadProfileData(); // Reset form values
    });
  }

  // Region change handler
  const regionSelect = document.getElementById('profile-region');
  if (regionSelect) {
    regionSelect.addEventListener('change', (e) => {
      const regionId = e.target.value;
      loadComunas(regionId);
    });
  }

  // Photo upload handler
  const photoUpload = document.getElementById('photo-upload');
  if (photoUpload) {
    photoUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        showToast('Por favor selecciona una imagen válida', 'error');
        return;
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        showToast('La imagen no debe superar los 2MB', 'error');
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result;

        // Update UI immediately
        const photoEl = document.getElementById('profile-photo');
        const initialsEl = document.getElementById('profile-initials');
        const headerPhotoEl = document.getElementById('header-user-photo');

        photoEl.src = base64;
        photoEl.style.display = 'block';
        initialsEl.style.display = 'none';

        // Update header photo
        if (headerPhotoEl) {
          headerPhotoEl.src = base64;
          headerPhotoEl.style.display = 'block';
          const headerInitials = document.getElementById('header-user-initials');
          if (headerInitials) headerInitials.style.display = 'none';
        }

        // Save to localStorage and IndexedDB
        const userData = localStorage.getItem('currentUser');
        if (userData) {
          const user = JSON.parse(userData);
          user.profile = { ...user.profile, photo: base64 };
          localStorage.setItem('currentUser', JSON.stringify(user));

          // Persist to IndexedDB
          try {
            const userRepository = getUserRepository();
            await userRepository.update(user.id, { profile: user.profile });
          } catch (error) {
            console.error('Error saving photo to DB:', error);
          }

          showToast('Foto de perfil actualizada', 'success');
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Save Personal Info
  if (formPersonal) {
    formPersonal.addEventListener('submit', async (e) => {
      e.preventDefault();

      const userData = localStorage.getItem('currentUser');
      if (!userData) return;

      const user = JSON.parse(userData);

      // Obtener valores del formulario
      const profileData = {
        firstName: document.getElementById('profile-firstname').value.trim(),
        lastName: document.getElementById('profile-lastname').value.trim(),
        phone: document.getElementById('profile-phone').value.trim(),
        address: document.getElementById('profile-address').value.trim(),
        region: document.getElementById('profile-region').value,
        commune: document.getElementById('profile-commune').value
      };

      // Guardar en el servidor
      try {
        const result = await apiService.updateProfile(profileData);

        // Actualizar datos locales con la respuesta del servidor
        const mergedUser = { ...user, ...(result.user || result) };
        localStorage.setItem('currentUser', JSON.stringify(mergedUser));

        // Update header name
        const userName = document.getElementById('user-name');
        if (userName) {
          userName.textContent = profileData.firstName || user.email;
        }

        // Reset view
        formPersonal.style.display = 'none';
        displayPersonal.style.display = 'flex';
        btnEditPersonal.style.display = 'block';

        loadProfileData();
        showToast('Información actualizada correctamente', 'success');
      } catch (error) {
        console.error('Error saving profile:', error);
        showToast(error.message || 'Error al guardar el perfil. Intenta de nuevo.', 'error');
      }
    });
  }

  // Edit Security (Password)
  const btnEditSecurity = document.getElementById('btn-edit-security');
  const formSecurity = document.getElementById('form-security');
  const displaySecurity = document.getElementById('display-security');
  const btnCancelSecurity = document.getElementById('btn-cancel-security');

  if (btnEditSecurity) {
    btnEditSecurity.addEventListener('click', () => {
      formSecurity.style.display = 'flex';
      displaySecurity.style.display = 'none';
      btnEditSecurity.style.display = 'none';
    });
  }

  if (btnCancelSecurity) {
    btnCancelSecurity.addEventListener('click', () => {
      formSecurity.style.display = 'none';
      displaySecurity.style.display = 'flex';
      btnEditSecurity.style.display = 'block';
      // Clear password fields
      document.getElementById('current-password').value = '';
      document.getElementById('new-password').value = '';
      document.getElementById('confirm-new-password').value = '';
    });
  }

  // Save Password
  if (formSecurity) {
    formSecurity.addEventListener('submit', async (e) => {
      e.preventDefault();

      const currentPassword = document.getElementById('current-password').value;
      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-new-password').value;

      // Validate
      if (newPassword.length < 6) {
        showToast('La nueva contraseña debe tener al menos 6 caracteres', 'error');
        return;
      }

      if (newPassword !== confirmPassword) {
        showToast('Las contraseñas no coinciden', 'error');
        return;
      }

      // For now, just show success (in real app, verify current password with backend)
      const userData = localStorage.getItem('currentUser');
      if (!userData) return;

      const user = JSON.parse(userData);

      // Note: In production, password change should be handled by backend
      // This is just for demonstration
      user.password = newPassword;
      localStorage.setItem('currentUser', JSON.stringify(user));

      // Persist to IndexedDB
      try {
        const userRepository = getUserRepository();
        await userRepository.update(user.id, { password: newPassword });
      } catch (error) {
        console.error('Error saving password to DB:', error);
      }

      // Reset view
      formSecurity.style.display = 'none';
      displaySecurity.style.display = 'flex';
      btnEditSecurity.style.display = 'block';

      // Clear password fields
      document.getElementById('current-password').value = '';
      document.getElementById('new-password').value = '';
      document.getElementById('confirm-new-password').value = '';

      showToast('Contraseña actualizada correctamente', 'success');
    });
  }

  // Logout from profile page
  const btnLogoutProfile = document.getElementById('btn-logout-profile');
  if (btnLogoutProfile) {
    btnLogoutProfile.addEventListener('click', async () => {
      // Limpiar cookies del servidor y localStorage
      await apiService.logout();
      localStorage.removeItem('isAuthenticated');
      sessionStorage.removeItem('isDirectivoMiembro');

      await handleLogout();
      showToast('Sesión cerrada correctamente', 'success');

      setTimeout(() => {
        window.location.href = '/app/login';
      }, 500);
    });
  }
}

// ========================================
// Organizations Management
// ========================================

function initOrganizations() {
  // Botones para crear nueva organización
  const btnNuevaOrg = document.getElementById('btn-nueva-organizacion');
  const btnCrearPrimeraOrg = document.getElementById('btn-crear-primera-org');
  const btnCrearOrg = document.getElementById('btn-crear-organizacion');

  const openWizard = () => {
    window.location.href = '/app/wizard';
  };

  if (btnNuevaOrg) btnNuevaOrg.addEventListener('click', openWizard);
  if (btnCrearPrimeraOrg) btnCrearPrimeraOrg.addEventListener('click', openWizard);
  if (btnCrearOrg) btnCrearOrg.addEventListener('click', openWizard);
}

/**
 * Auto-sync certificados y estatutos desde IndexedDB para orgs que no los tienen en server.
 * Se ejecuta una sola vez por sesión (flag en sessionStorage).
 */
async function syncCertificatesFromIndexedDB(organizations) {
  // Solo ejecutar una vez por sesión
  if (sessionStorage.getItem('cert_sync_done')) return;
  sessionStorage.setItem('cert_sync_done', '1');

  try {
    await indexedDBService.init();
    const localCerts = await indexedDBService.getAllWizardCertificates();
    const localEstatutos = await indexedDBService.getWizardEstatutos().catch(() => null);

    const hasCerts = localCerts && Object.keys(localCerts).length > 0;
    const hasEstatutos = localEstatutos && localEstatutos.length > 50;

    if (!hasCerts && !hasEstatutos) return;

    // Filtrar orgs que podrían necesitar sync
    const syncableStatuses = ['waiting_ministro', 'ministro_scheduled'];
    const orgsToSync = organizations.filter(org => {
      if (!syncableStatuses.includes(org.status)) return false;
      const needsCerts = hasCerts && Array.isArray(org.certificatesStep5) && org.certificatesStep5.some(c => !c.certificate);
      const needsEstatutos = hasEstatutos && !org.estatutos;
      return needsCerts || needsEstatutos;
    });

    if (orgsToSync.length === 0) return;

    for (const org of orgsToSync) {
      // Construir payload de certificados que faltan
      let certsToSync = null;
      if (hasCerts && Array.isArray(org.certificatesStep5)) {
        const certs = {};
        for (const certEntry of org.certificatesStep5) {
          if (!certEntry.certificate && localCerts[certEntry.memberId]?.base64) {
            certs[certEntry.memberId] = {
              certificate: localCerts[certEntry.memberId].base64,
              name: localCerts[certEntry.memberId].name || ''
            };
          }
        }
        if (Object.keys(certs).length > 0) certsToSync = certs;
      }

      // Estatutos
      const estatutosToSync = (hasEstatutos && !org.estatutos) ? localEstatutos : null;

      if (certsToSync || estatutosToSync) {
        console.log(`🔄 Sync para org ${org._id}: ${certsToSync ? Object.keys(certsToSync).length + ' certs' : ''} ${estatutosToSync ? '+ estatutos' : ''}`);
        try {
          const result = await apiService.syncCertificates(org._id, certsToSync, estatutosToSync);
          console.log(`✅ Sincronizado: ${result.synced} certs, estatutos: ${result.estatutosSynced}`);
        } catch (err) {
          console.warn(`⚠️ Error sync org ${org._id}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Error en auto-sync:', err.message);
  }
}

async function renderOrganizations() {
  console.log('🔄 renderOrganizations() iniciado');

  let organizations;
  try {
    organizations = await organizationsService.getCurrentUserOrganizations();
  } catch (e) {
    console.error('❌ Error en getCurrentUserOrganizations:', e);
    organizations = [];
  }

  // Si la API no retornó datos, intentar usar datos cacheados del sync() inicial
  if (!organizations || organizations.length === 0) {
    const cached = organizationsService.getAll();
    if (cached && cached.length > 0) {
      console.log('📦 Usando datos cacheados (memory):', cached.length);
      organizations = cached;
    } else {
      // Último recurso: localStorage cache
      try {
        const lsData = localStorage.getItem('user_organizations');
        if (lsData) {
          const lsOrgs = JSON.parse(lsData);
          if (Array.isArray(lsOrgs) && lsOrgs.length > 0) {
            console.log('📦 Usando datos cacheados (localStorage):', lsOrgs.length);
            organizations = lsOrgs;
          }
        }
      } catch (e) { /* ignore */ }
    }
  }

  if (!organizations) organizations = [];
  console.log('📋 Organizaciones obtenidas del servidor:', organizations.length);

  // Verificar si hay un progreso guardado en localStorage
  const savedProgress = getSavedWizardProgress();

  // Combinar organizaciones con el borrador local si existe
  let allOrganizations = [...organizations];
  if (savedProgress) {
    allOrganizations.unshift(savedProgress); // Agregar al inicio
  }

  // Filtrar organizaciones aprobadas - esas solo se muestran en sidebar "Mi Organización"
  allOrganizations = allOrganizations.filter(org => org.status !== ORG_STATUS.APPROVED);

  // Check for deletion notice notifications
  let hasDeletionNotices = false;
  try {
    const allNotifs = await notificationService.getAllAsync();
    hasDeletionNotices = allNotifs.some(n => n.type === 'organization_deleted');
  } catch (e) { /* ignore */ }

  const hasOrgs = allOrganizations.length > 0 || hasDeletionNotices;
  console.log('📋 Organizaciones a mostrar (sin aprobadas):', allOrganizations.length, allOrganizations);

  // Auto-sync certificados desde IndexedDB para orgs que no los tienen en server
  syncCertificatesFromIndexedDB(organizations);

  const noOrgsSection = document.getElementById('no-organizations');
  const orgsList = document.getElementById('organizations-list');
  const heroSection = document.getElementById('hero-section');
  const btnNuevaOrg = document.getElementById('btn-nueva-organizacion');

  console.log('🔍 DOM elements:', { noOrgsSection: !!noOrgsSection, orgsList: !!orgsList, heroSection: !!heroSection, btnNuevaOrg: !!btnNuevaOrg });

  if (!orgsList) {
    console.warn('⚠️ organizations-list element not found in DOM');
    return;
  }

  if (hasOrgs) {
    // Mostrar lista, ocultar mensaje vacío
    if (noOrgsSection) noOrgsSection.style.display = 'none';
    orgsList.style.display = 'grid';
    if (heroSection) heroSection.style.display = 'none';
    if (btnNuevaOrg) btnNuevaOrg.style.display = 'flex';

    // Obtener notificaciones de organizaciones eliminadas
    let deletionNotices = '';
    try {
      const allNotifs = await notificationService.getAllAsync();
      const deletionNotifs = allNotifs.filter(n => n.type === 'organization_deleted');
      deletionNotices = deletionNotifs.map(notif => {
        const notifId = notif._id || notif.id;
        const orgName = notif.data?.organizationName || 'Organización';
        return `
          <div class="org-card deletion-notice-card" data-notif-id="${notifId}" style="background:linear-gradient(135deg,#fef2f2,#fee2e2);border:2px solid #fca5a5;position:relative;">
            <div style="padding:20px;text-align:center;">
              <div style="font-size:40px;margin-bottom:10px;">🗑️</div>
              <h3 style="margin:0 0 6px;font-size:16px;font-weight:700;color:#991b1b;">Organización eliminada</h3>
              <p style="margin:0 0 4px;font-size:14px;color:#dc2626;font-weight:600;">"${orgName}"</p>
              <p style="margin:0 0 16px;font-size:13px;color:#7f1d1d;line-height:1.4;">${notif.message || 'La eliminación fue aprobada por el administrador.'}</p>
              <button class="btn-dismiss-deletion" data-notif-id="${notifId}" style="
                background:#dc2626;color:white;border:none;padding:8px 20px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;
              ">Entendido, eliminar aviso</button>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.warn('Error loading deletion notifications:', e);
    }

    // Renderizar cards de organizaciones
    orgsList.innerHTML = deletionNotices + allOrganizations.map(org => renderOrganizationCard(org)).join('');

    // Event listeners para avisos de eliminación
    orgsList.querySelectorAll('.btn-dismiss-deletion').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const notifId = btn.dataset.notifId;
        try {
          await notificationService.delete(notifId);
          const card = btn.closest('.deletion-notice-card');
          if (card) card.remove();
          showToast('Aviso eliminado', 'info');
          // Si no quedan orgs ni avisos, mostrar sección vacía
          const remaining = orgsList.querySelectorAll('.org-card');
          if (remaining.length === 0) renderOrganizations();
        } catch (err) {
          showToast('Error al eliminar aviso', 'error');
        }
      });
    });

    // Agregar event listeners a las cards
    orgsList.querySelectorAll('.org-card').forEach(card => {
      const orgId = card.dataset.orgId;

      card.querySelector('.btn-org-view')?.addEventListener('click', (e) => {
        e.stopPropagation();
        viewOrganization(orgId);
      });

      card.querySelector('.btn-org-continue')?.addEventListener('click', (e) => {
        e.stopPropagation();
        continueOrganizationWizard(orgId);
      });

      card.querySelector('.btn-org-continue-draft')?.addEventListener('click', (e) => {
        e.stopPropagation();
        // Solo para drafts del servidor (no local-draft, que usa onclick)
        continueDraftOrganization(orgId);
      });

      card.querySelector('.btn-org-discard-draft')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('¿Estás seguro de que deseas descartar este borrador? Esta acción no se puede deshacer.')) {
          localStorage.removeItem('wizardProgress');
          showToast('Borrador descartado', 'info');
          renderOrganizations(); // Re-renderizar sin el borrador
        }
      });

      card.querySelector('.btn-org-delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const org = organizationsService.getById(orgId);
        handleDeleteOrganization(orgId, org);
      });

      // Agregar click al aviso de cita con cambios para ver detalles
      card.querySelector('.org-appointment-modified-notice')?.addEventListener('click', (e) => {
        e.stopPropagation();
        viewOrganization(orgId);
      });
    });
  } else {
    // Mostrar mensaje vacío
    if (noOrgsSection) noOrgsSection.style.display = 'flex';
    orgsList.style.display = 'none';
    if (heroSection) heroSection.style.display = 'block';
    if (btnNuevaOrg) btnNuevaOrg.style.display = 'none';
  }
  console.log('✅ renderOrganizations() completado');
}

// Helper: Obtener progreso guardado del wizard como objeto de organización
function getSavedWizardProgress() {
  try {
    const saved = localStorage.getItem('wizardProgress');
    if (!saved) return null;

    const progress = JSON.parse(saved);

    // Verificar que no sea muy antiguo (7 días)
    const savedDate = new Date(progress.savedAt);
    const now = new Date();
    const daysDiff = (now - savedDate) / (1000 * 60 * 60 * 24);

    if (daysDiff >= 7) {
      localStorage.removeItem('wizardProgress');
      return null;
    }

    // Verificar que tenga datos mínimos de organización
    const orgData = progress.formData?.organization;
    if (!orgData || !orgData.name) {
      // Si no tiene nombre, no mostrar (está muy incompleto)
      return null;
    }

    // Crear objeto de organización falso para mostrar en el dashboard
    return {
      id: 'local-draft',
      _id: 'local-draft',
      status: 'draft',
      isLocalDraft: true,
      organizationType: orgData.type,
      organizationName: orgData.name,
      address: orgData.address,
      comuna: orgData.commune || 'Renca',
      organization: orgData,
      members: progress.formData?.members || [],
      createdAt: progress.savedAt,
      currentStep: progress.currentStep,
      totalSteps: 8
    };
  } catch (e) {
    console.error('Error loading wizard progress:', e);
    return null;
  }
}

function renderOrganizationCard(org) {
  const statusLabel = ORG_STATUS_LABELS[org.status] || org.status;
  const statusColor = ORG_STATUS_COLORS[org.status] || '#6b7280';
  const isApproved = org.status === ORG_STATUS.APPROVED;
  const isPending = [ORG_STATUS.PENDING_REVIEW, ORG_STATUS.IN_REVIEW, ORG_STATUS.SENT_TO_REGISTRY].includes(org.status);
  const isRejected = org.status === ORG_STATUS.REJECTED;
  const isDraft = org.status === ORG_STATUS.DRAFT || org.status === 'draft';
  const isLocalDraft = org.isLocalDraft === true;
  const isMinistroApproved = org.status === ORG_STATUS.MINISTRO_APPROVED;
  const isSentToRegistry = org.status === ORG_STATUS.SENT_TO_REGISTRY;
  // canContinueWizard solo para estados donde usuario puede continuar (rechazado con correcciones pendientes)
  const canContinueWizard = org.status === ORG_STATUS.REJECTED && org.corrections && !org.corrections.resolved;
  const isDissolved = org.status === ORG_STATUS.DISSOLVED;
  const isDeletionRequested = org.status === ORG_STATUS.DELETION_REQUESTED;
  const canDelete = !isLocalDraft && !isApproved && !isDissolved && !isDeletionRequested;

  // Detectar si la última entrada en statusHistory es un rechazo de eliminación
  const lastHistory = org.statusHistory?.[org.statusHistory.length - 1];
  const deletionRejected = lastHistory?.comment?.includes('Solicitud de eliminación rechazada');
  const deletionRejectionReason = deletionRejected ? (lastHistory.comment.match(/Motivo: (.+)/)?.[1] || '') : '';

  // Obtener tipo - soportar formato nuevo (backend) y viejo (localStorage)
  const orgType = org.organizationType || org.organization?.type;
  const orgName = org.organizationName || org.organization?.name || 'Sin nombre';
  const orgAddress = org.address || org.organization?.address || '';
  const orgComuna = org.comuna || org.organization?.commune || 'Renca';

  // Iconos según tipo
  const typeIcon = getOrgIcon(orgType);
  const typeName = getOrgTypeName(orgType);

  // Formato de fecha
  const createdDate = new Date(org.createdAt).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Progress bar para estados pendientes
  let progressBar = '';
  if (isPending) {
    const steps = [
      { key: ORG_STATUS.PENDING_REVIEW, label: 'Enviada' },
      { key: ORG_STATUS.IN_REVIEW, label: 'En Revisión' },
      { key: ORG_STATUS.SENT_TO_REGISTRY, label: 'Registro Civil' },
      { key: ORG_STATUS.APPROVED, label: 'Aprobada' }
    ];
    const currentIndex = steps.findIndex(s => s.key === org.status);

    progressBar = `
      <div class="org-progress">
        <div class="org-progress-bar">
          ${steps.map((step, i) => `
            <div class="progress-step ${i <= currentIndex ? 'completed' : ''} ${i === currentIndex ? 'current' : ''}">
              <div class="step-dot"></div>
              <span class="step-label">${step.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Usar _id o id para el identificador
  const orgId = org._id || org.id;

  return `
    <div class="org-card ${isApproved ? 'org-approved' : ''} ${isRejected ? 'org-rejected' : ''} ${isDraft ? 'org-draft' : ''}" data-org-id="${orgId}">
      <div class="org-card-header">
        <div class="org-type-icon">${typeIcon}</div>
        <div class="org-status-badge" style="background: ${isLocalDraft ? '#6366f120' : statusColor + '20'}; color: ${isLocalDraft ? '#6366f1' : statusColor}">
          ${isLocalDraft ? '📝 Borrador' : isDraft ? '📝 Guardado' : statusLabel}
        </div>
      </div>

      <div class="org-card-body">
        <h3 class="org-name">${orgName}</h3>
        <p class="org-type">${typeName}</p>
        <p class="org-location">📍 ${orgComuna}${orgAddress ? ', ' + orgAddress : ''}</p>
        <p class="org-date">${isLocalDraft ? 'Guardado el' : 'Creada el'} ${createdDate}</p>

        ${isLocalDraft ? `
          <div class="local-draft-progress" style="margin-top: 12px; background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border-radius: 8px; padding: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="font-size: 16px;">📋</span>
              <span style="font-weight: 600; color: #4f46e5;">Paso ${org.currentStep || 1} de ${org.totalSteps || 8}</span>
            </div>
            <div style="background: #c7d2fe; border-radius: 4px; height: 6px; overflow: hidden;">
              <div style="background: linear-gradient(90deg, #6366f1, #4f46e5); height: 100%; width: ${((org.currentStep || 1) / (org.totalSteps || 8)) * 100}%; transition: width 0.3s;"></div>
            </div>
            <p style="margin: 8px 0 0; font-size: 12px; color: #6366f1;">Continúa donde lo dejaste para completar el registro.</p>
          </div>
        ` : ''}

        ${progressBar}

        ${isRejected ? `
          <div class="org-rejection-notice">
            <span class="rejection-icon">⚠️</span>
            <span>Requiere correcciones. Revisa los comentarios.</span>
          </div>
        ` : ''}

        ${isDeletionRequested ? `
          <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 2px solid #fca5a5; border-radius: 12px; padding: 14px; margin-top: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">🗑️</span>
              <div style="flex: 1;">
                <p style="margin: 0; font-weight: 700; color: #991b1b; font-size: 14px;">Eliminación solicitada</p>
                <p style="margin: 2px 0 0; font-size: 12px; color: #dc2626;">Esperando aprobación del administrador</p>
              </div>
            </div>
          </div>
        ` : ''}

        ${deletionRejected ? `
          <div style="background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%); border: 2px solid #fcd34d; border-radius: 12px; padding: 14px; margin-top: 12px;">
            <div style="display: flex; align-items: flex-start; gap: 10px;">
              <span style="font-size: 24px;">❌</span>
              <div style="flex: 1;">
                <p style="margin: 0; font-weight: 700; color: #92400e; font-size: 14px;">Solicitud de eliminación rechazada</p>
                ${deletionRejectionReason ? `<p style="margin: 4px 0 0; font-size: 13px; color: #78350f; line-height: 1.4;"><strong>Motivo del administrador:</strong> ${deletionRejectionReason}</p>` : '<p style="margin: 2px 0 0; font-size: 12px; color: #a16207;">El administrador rechazó la solicitud sin especificar motivo.</p>'}
              </div>
            </div>
          </div>
        ` : ''}

        ${(() => {
          // Detectar si hay diferencias entre lo solicitado y lo asignado
          if (org.status !== ORG_STATUS.MINISTRO_SCHEDULED || !org.ministroData) return '';

          const requestedDate = org.electionDate;
          const requestedTime = org.electionTime;
          const requestedLocation = org.assemblyAddress || org.organization?.address;

          const assignedDate = org.ministroData.scheduledDate;
          const assignedTime = org.ministroData.scheduledTime;
          const assignedLocation = org.ministroData.location;

          // Comparar valores (normalizar fechas para comparación)
          const dateChanged = requestedDate && assignedDate && requestedDate.split('T')[0] !== assignedDate.split('T')[0];
          const timeChanged = requestedTime && assignedTime && requestedTime !== assignedTime;
          const locationChanged = requestedLocation && assignedLocation && requestedLocation.toLowerCase().trim() !== assignedLocation.toLowerCase().trim();

          const hasChanges = org.appointmentWasModified || dateChanged || timeChanged || locationChanged;

          if (!hasChanges) return '';

          // Formatear fechas para mostrar
          const formatDateShort = (dateStr) => {
            if (!dateStr) return '-';
            try {
              const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
              const [y, m, day] = d.split('-').map(Number);
              return new Date(y, m - 1, day).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
            } catch { return dateStr; }
          };

          const changes = [];
          if (dateChanged) changes.push('📅 ' + formatDateShort(requestedDate) + ' → ' + formatDateShort(assignedDate));
          if (timeChanged) changes.push('🕐 ' + requestedTime + ' → ' + assignedTime);
          if (locationChanged) changes.push('📍 Lugar modificado');

          return '<div class="org-appointment-modified-notice" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 12px; padding: 12px; margin-top: 12px; animation: pulse-card 2s ease-in-out infinite; cursor: pointer;">' +
            '<div style="display: flex; align-items: flex-start; gap: 10px;">' +
              '<span style="font-size: 24px; animation: bell-shake 1s ease-in-out infinite;">🔔</span>' +
              '<div style="flex: 1;">' +
                '<p style="margin: 0; font-weight: 700; color: #92400e; font-size: 14px;">Cita con Cambios</p>' +
                '<p style="margin: 4px 0 0; font-size: 11px; color: #a16207; line-height: 1.4;">' + changes.join(' • ') + '</p>' +
                '<p style="margin: 4px 0 0; font-size: 10px; color: #b45309;">Click para ver detalles</p>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<style>' +
            '@keyframes pulse-card { 0%, 100% { box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3); } 50% { box-shadow: 0 4px 16px rgba(245, 158, 11, 0.5); } }' +
            '@keyframes bell-shake { 0%, 100% { transform: rotate(0deg); } 10%, 30%, 50%, 70%, 90% { transform: rotate(-5deg); } 20%, 40%, 60%, 80% { transform: rotate(5deg); } }' +
          '</style>';
        })()}

        ${isMinistroApproved ? `
          <div class="org-waiting-registry-notice" style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 2px solid #2563eb; border-radius: 12px; padding: 14px; margin-top: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">✅</span>
              <div style="flex: 1;">
                <p style="margin: 0; font-weight: 700; color: #1e40af; font-size: 14px;">Asamblea Validada</p>
                <p style="margin: 2px 0 0; font-size: 12px; color: #1d4ed8;">Esperando que la municipalidad envíe documentación al Registro Civil.</p>
              </div>
            </div>
          </div>
        ` : ''}

        ${isSentToRegistry ? `
          <div class="org-sent-registry-notice" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 12px; padding: 14px; margin-top: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">📄</span>
              <div style="flex: 1;">
                <p style="margin: 0; font-weight: 700; color: #92400e; font-size: 14px;">Enviado al Registro Civil</p>
                <p style="margin: 2px 0 0; font-size: 12px; color: #a16207;">Tu documentación está siendo procesada. Te notificaremos cuando esté lista.</p>
              </div>
            </div>
          </div>
        ` : ''}

        ${isDraft && !isLocalDraft ? `
          <div class="org-draft-notice" style="background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); border: 2px dashed #6366f1; border-radius: 12px; padding: 14px; margin-top: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">📋</span>
              <div style="flex: 1;">
                <p style="margin: 0; font-weight: 700; color: #4338ca; font-size: 14px;">Proceso Inconcluso</p>
                <p style="margin: 2px 0 0; font-size: 12px; color: #4f46e5;">Tienes un formulario guardado. Continúa donde lo dejaste.</p>
              </div>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="org-card-actions">
        ${!isDraft && !isLocalDraft ? `
          <button class="btn-org-view">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            Ver detalles
          </button>
        ` : ''}
        ${isLocalDraft ? `
          <button onclick="event.stopPropagation(); window.openLocalDraftWizard();" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; flex: 1; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Continuar
          </button>
          <button onclick="event.stopPropagation(); window.discardLocalDraft();" style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 10px 12px; border-radius: 8px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px;" title="Descartar borrador">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        ` : ''}
        ${isDraft && !isLocalDraft ? `
          <button class="btn-org-continue-draft" data-org-id="${orgId}" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; flex: 1; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Continuar Registro
          </button>
        ` : ''}
        ${canContinueWizard ? `
          <button class="btn-org-continue" data-org-id="${orgId}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Continuar Solicitud
          </button>
        ` : ''}
        ${canDelete ? `
          <button class="btn-org-delete" data-org-id="${orgId}" style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 10px 12px; border-radius: 8px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px;" title="Eliminar solicitud">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Eliminar
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

async function handleDeleteOrganization(orgId, org) {
  if (!org) {
    showToast('No se pudo encontrar la organización', 'error');
    return;
  }

  const orgName = org.organizationName || 'esta organización';

  // Cannot request deletion if already in deletion_requested
  if (org.status === 'deletion_requested') {
    showToast('Ya existe una solicitud de eliminación pendiente', 'info');
    return;
  }

  // Simple cases: only draft - just confirm and delete immediately
  const simpleStatuses = ['draft'];
  if (simpleStatuses.includes(org.status)) {
    if (!confirm(`¿Estás seguro de que deseas eliminar "${orgName}"?\n\nEsta acción no se puede deshacer.`)) {
      return;
    }
    try {
      await organizationsService.deleteOrganization(orgId);
      showToast('Solicitud eliminada exitosamente', 'success');
      renderOrganizations();
    } catch (e) {
      showToast(e.message || 'Error al eliminar', 'error');
    }
    return;
  }

  // Complex cases: show modal with reason textarea
  const overlay = document.createElement('div');
  overlay.id = 'delete-org-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,0.25);">
      <div style="padding:24px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <div style="width:44px;height:44px;border-radius:12px;background:#fee2e2;display:flex;align-items:center;justify-content:center;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </div>
          <div>
            <h3 style="margin:0;font-size:18px;font-weight:700;color:#111;">Eliminar solicitud</h3>
            <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${orgName}</p>
          </div>
        </div>
        <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:12px;margin-bottom:16px;">
          <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
            Esta solicitud ya tiene avances con la municipalidad o el ministro de fe. Se enviará una solicitud de eliminación al administrador para su aprobación.
          </p>
        </div>
        <label style="display:block;font-size:14px;font-weight:600;color:#374151;margin-bottom:6px;">Motivo de la eliminación <span style="color:#dc2626;">*</span></label>
        <textarea id="delete-org-reason" maxlength="500" placeholder="Explica brevemente por qué deseas eliminar esta solicitud..." style="width:100%;min-height:100px;padding:10px 12px;border:1.5px solid #d1d5db;border-radius:10px;font-size:14px;font-family:inherit;resize:vertical;box-sizing:border-box;"></textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          <span id="delete-org-char-count" style="font-size:12px;color:#9ca3af;">0 / 500</span>
          <span id="delete-org-error" style="font-size:12px;color:#dc2626;display:none;">El motivo es obligatorio</span>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button id="delete-org-cancel" style="flex:1;padding:10px 16px;border-radius:10px;border:1.5px solid #d1d5db;background:white;color:#374151;font-weight:600;font-size:14px;cursor:pointer;">Cancelar</button>
          <button id="delete-org-confirm" style="flex:1;padding:10px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,#ef4444,#dc2626);color:white;font-weight:600;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Solicitar Eliminación
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const textarea = document.getElementById('delete-org-reason');
  const charCount = document.getElementById('delete-org-char-count');
  const errorMsg = document.getElementById('delete-org-error');
  const confirmBtn = document.getElementById('delete-org-confirm');
  const cancelBtn = document.getElementById('delete-org-cancel');

  textarea.addEventListener('input', () => {
    charCount.textContent = `${textarea.value.length} / 500`;
    if (textarea.value.trim()) errorMsg.style.display = 'none';
  });

  cancelBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  confirmBtn.addEventListener('click', async () => {
    const reason = textarea.value.trim();
    if (!reason) {
      errorMsg.style.display = 'inline';
      textarea.style.borderColor = '#dc2626';
      textarea.focus();
      return;
    }

    // Loading state
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner-small" style="width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.6s linear infinite;display:inline-block;"></span> Eliminando...';
    cancelBtn.disabled = true;

    try {
      const result = await organizationsService.deleteOrganization(orgId, reason);
      // Success state
      const isDeletionRequest = result?.deletionRequested;
      overlay.querySelector('div > div').innerHTML = `
        <div style="text-align:center;padding:32px 20px;">
          <div style="width:56px;height:56px;border-radius:50%;background:${isDeletionRequest ? '#fef3c7' : '#dcfce7'};display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${isDeletionRequest ? '#f59e0b' : '#16a34a'}" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111;">${isDeletionRequest ? 'Solicitud enviada' : 'Solicitud eliminada'}</h3>
          <p style="margin:0;font-size:14px;color:#6b7280;">${isDeletionRequest ? 'Tu solicitud de eliminación ha sido enviada al administrador para su aprobación.' : 'La solicitud ha sido eliminada y se ha notificado a los involucrados.'}</p>
          <button id="delete-org-done" style="margin-top:20px;padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:white;font-weight:600;font-size:14px;cursor:pointer;">Entendido</button>
        </div>
      `;
      document.getElementById('delete-org-done').addEventListener('click', () => {
        overlay.remove();
        renderOrganizations();
      });
    } catch (e) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = 'Eliminar Solicitud';
      cancelBtn.disabled = false;
      showToast(e.message || 'Error al eliminar', 'error');
    }
  });
}

async function viewOrganization(orgId, forceRefresh = false) {
  let org;

  // Si forceRefresh, obtener siempre del servidor primero
  if (forceRefresh) {
    console.log('Forzando recarga de organización desde servidor:', orgId);
    org = await organizationsService.getByIdAsync(orgId);
  } else {
    org = organizationsService.getById(orgId);
  }

  // Si no se encuentra localmente, intentar obtenerla del servidor
  if (!org) {
    console.log('Organización no encontrada localmente, buscando en servidor:', orgId);
    org = await organizationsService.getByIdAsync(orgId);
  }

  if (!org) {
    console.error('No se pudo encontrar la organización:', orgId);
    showToast('No se pudo cargar la organización', 'error');
    return;
  }

  const statusLabel = ORG_STATUS_LABELS[org.status] || org.status;
  const statusColor = ORG_STATUS_COLORS[org.status] || '#6b7280';
  const isRejected = org.status === ORG_STATUS.REJECTED;
  const corrections = org.corrections;

  // Generar HTML de correcciones si existen
  let correctionsHTML = '';
  if (isRejected && corrections && !corrections.resolved) {
    const isV2 = corrections.version === 2 && Array.isArray(corrections.items);

    if (isV2) {
      // ── v2: ítems específicos agrupados por categoría ──
      const categoryMeta = {
        'datos_generales': { title: 'Datos de la Organización', icon: '\ud83d\udccb', action: 'Editar' },
        'directorio': { title: 'Directorio Provisorio', icon: '\ud83d\udc64', action: 'Editar' },
        'comision_electoral': { title: 'Comisión Electoral', icon: '\ud83d\uddf3\ufe0f', action: 'Editar' },
        'miembros': { title: 'Miembros Fundadores', icon: '\ud83d\udc65', action: 'Editar' },
        'documentos': { title: 'Documentos', icon: '\ud83d\udcc4', action: 'Resubir' },
        'certificados': { title: 'Certificados', icon: '\ud83d\udcce', action: 'Resubir' }
      };

      // Group items by category
      const grouped = {};
      corrections.items.forEach(item => {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
      });

      const correctedFields = org.userCorrectedFields || {};

      let categoriesHTML = '';
      for (const [cat, items] of Object.entries(grouped)) {
        const meta = categoryMeta[cat] || { title: cat, icon: '📌', action: 'Editar' };
        const catCorrectedCount = items.filter(item => {
          const itemKey = item.field || item.memberId || item.docType || item.label;
          return correctedFields[cat] && correctedFields[cat][itemKey];
        }).length;

        categoriesHTML += `
          <div class="correction-category" style="margin-bottom: 16px;">
            <h5 style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">
              ${meta.icon} ${meta.title}
              <span style="margin-left: auto; font-size: 12px; font-weight: 500; padding: 2px 8px; border-radius: 10px; ${catCorrectedCount === items.length ? 'background: #dcfce7; color: #166534;' : 'background: #fef3c7; color: #92400e;'}">${catCorrectedCount}/${items.length}</span>
            </h5>
            <div class="correction-items-list" style="display: flex; flex-direction: column; gap: 10px;">
              ${items.map(item => {
                const itemKey = item.field || item.memberId || item.docType || item.label;
                const isCorrected = correctedFields[cat] && correctedFields[cat][itemKey];
                const correctionData = isCorrected ? correctedFields[cat][itemKey] : null;
                const newValue = correctionData?.newValue || '';
                const correctedAt = correctionData?.correctedAt ? new Date(correctionData.correctedAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '';

                if (isCorrected) {
                  // ═══ ÍTEM CORREGIDO (VERDE) ═══
                  return `
                  <div class="correction-item-card corrected" data-type="${cat}" data-key="${itemKey}" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #86efac; border-radius: 12px; padding: 14px 16px; position: relative;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                      <span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #22c55e; border-radius: 50%; color: white; font-size: 16px; font-weight: bold;">✓</span>
                      <span style="font-weight: 600; color: #166534; font-size: 14px; flex: 1;">${item.label}</span>
                      <span style="font-size: 11px; color: #15803d; background: #bbf7d0; padding: 2px 8px; border-radius: 6px;">Corregido</span>
                    </div>
                    ${newValue ? `
                    <div style="background: white; border: 1px solid #86efac; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;">
                      <span style="font-size: 11px; color: #166534; font-weight: 600; text-transform: uppercase;">Nuevo valor:</span>
                      <p style="margin: 4px 0 0; color: #15803d; font-size: 13px; line-height: 1.4;">${newValue.length > 100 ? newValue.substring(0, 100) + '...' : newValue}</p>
                    </div>
                    ` : ''}
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <button class="btn-toggle-details" data-target="details-${cat}-${itemKey.replace(/[^a-zA-Z0-9]/g, '_')}" style="padding: 6px 12px; background: #e0f2fe; color: #0369a1; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                        👁️ Ver detalles
                      </button>
                      <button class="btn-edit-correction" data-type="${cat}" data-key="${itemKey}" style="padding: 6px 12px; background: #f0fdf4; color: #166534; border: 1px solid #86efac; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;">
                        ✏️ Modificar
                      </button>
                      ${correctedAt ? `<span style="font-size: 10px; color: #6b7280; margin-left: auto;">Corregido: ${correctedAt}</span>` : ''}
                    </div>
                    <div id="details-${cat}-${itemKey.replace(/[^a-zA-Z0-9]/g, '_')}" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #86efac;">
                      <div style="background: #fefce8; border: 1px solid #fde047; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px;">
                        <span style="font-size: 11px; color: #854d0e; font-weight: 600;">Observación original del revisor:</span>
                        <p style="margin: 4px 0 0; color: #713f12; font-size: 12px;">${item.message}</p>
                      </div>
                      <div class="correction-item-user-response" style="margin-top: 8px;">
                        <label style="font-size: 11px; color: #166534; font-weight: 500;">Comentario adicional (opcional):</label>
                        <input type="text" class="user-field-response" data-type="${cat}" data-key="${itemKey}"
                               style="width: 100%; padding: 8px 10px; border: 1px solid #86efac; border-radius: 6px; font-size: 12px; margin-top: 4px; box-sizing: border-box;"
                               placeholder="Agrega una nota sobre esta corrección...">
                      </div>
                    </div>
                  </div>
                `;
                } else {
                  // ═══ ÍTEM PENDIENTE (ROJO/AMARILLO) ═══
                  return `
                  <div class="correction-item-card pending" data-type="${cat}" data-key="${itemKey}" style="background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%); border: 2px solid #f87171; border-radius: 12px; padding: 14px 16px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                      <span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #dc2626; border-radius: 50%; color: white; font-size: 14px;">!</span>
                      <span style="font-weight: 600; color: #991b1b; font-size: 14px; flex: 1;">${item.label}</span>
                      <button class="btn-edit-correction" data-type="${cat}" data-key="${itemKey}" style="padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        ✏️ ${meta.action}
                      </button>
                    </div>
                    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px;">
                      <div style="display: flex; align-items: flex-start; gap: 8px;">
                        <span style="font-size: 16px;">⚠️</span>
                        <div>
                          <span style="font-size: 11px; color: #92400e; font-weight: 600;">Observación del revisor:</span>
                          <p style="margin: 4px 0 0; color: #78350f; font-size: 13px; line-height: 1.4;">${item.message}</p>
                        </div>
                      </div>
                    </div>
                    <div class="correction-item-user-response">
                      <label style="font-size: 11px; color: #991b1b; font-weight: 500;">Tu respuesta (opcional):</label>
                      <input type="text" class="user-field-response" data-type="${cat}" data-key="${itemKey}"
                             style="width: 100%; padding: 8px 10px; border: 1px solid #fca5a5; border-radius: 6px; font-size: 12px; margin-top: 4px; box-sizing: border-box;"
                             placeholder="Agrega una nota sobre esta corrección...">
                    </div>
                  </div>
                `;
                }
              }).join('')}
            </div>
          </div>
        `;
      }

      correctionsHTML = `
        <div class="org-corrections-section">
          <div class="corrections-alert">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div class="corrections-alert-content">
              <h4>Correcciones Requeridas (${corrections.items.length} ítem${corrections.items.length !== 1 ? 's' : ''})</h4>
              <p>La municipalidad ha solicitado las siguientes correcciones específicas para continuar con el proceso.</p>
            </div>
          </div>

          ${corrections.generalComment ? `
            <div class="correction-general-comment">
              <strong>Observación general:</strong>
              <p>${corrections.generalComment}</p>
            </div>
          ` : ''}

          ${categoriesHTML}

          <div class="user-observations-section general-observation">
            <label for="user-correction-comments">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Observación general para el revisor (opcional)
            </label>
            <textarea id="user-correction-comments" class="user-observations-textarea"
                      placeholder="Escriba aquí cualquier comentario o aclaración general sobre las correcciones realizadas..."></textarea>
          </div>

          <!-- Indicador de progreso de correcciones -->
          <div class="correction-progress" id="correction-progress-${org.id || org._id}" style="background: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 600; color: #374151; font-size: 14px;">Progreso de correcciones</span>
              <span id="correction-count-${org.id || org._id}" style="font-weight: 700; color: #dc2626; font-size: 14px;">${Object.keys(correctedFields).reduce((acc, cat) => acc + Object.keys(correctedFields[cat] || {}).length, 0)} / ${corrections.items.length}</span>
            </div>
            <div style="background: #e2e8f0; border-radius: 4px; height: 8px; overflow: hidden;">
              <div id="correction-bar-${org.id || org._id}" style="background: linear-gradient(90deg, #10b981, #059669); height: 100%; width: ${Math.round((Object.keys(correctedFields).reduce((acc, cat) => acc + Object.keys(correctedFields[cat] || {}).length, 0) / corrections.items.length) * 100)}%; transition: width 0.3s ease;"></div>
            </div>
            <p id="correction-status-${org.id || org._id}" style="margin: 8px 0 0; font-size: 12px; color: ${Object.keys(correctedFields).reduce((acc, cat) => acc + Object.keys(correctedFields[cat] || {}).length, 0) >= corrections.items.length ? '#059669' : '#dc2626'};">
              ${Object.keys(correctedFields).reduce((acc, cat) => acc + Object.keys(correctedFields[cat] || {}).length, 0) >= corrections.items.length
                ? '✓ Todas las correcciones completadas. Puede reenviar para revisión.'
                : '⚠️ Debe completar todas las correcciones antes de reenviar.'}
            </p>
          </div>

          <div class="correction-actions">
            <button class="btn-resubmit-org" id="btn-resubmit-${org.id || org._id}" ${Object.keys(correctedFields).reduce((acc, cat) => acc + Object.keys(correctedFields[cat] || {}).length, 0) < corrections.items.length ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 2L11 13"></path>
                <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
              </svg>
              Reenviar para Revisión
            </button>
          </div>
        </div>
      `;
    } else {
      // ── v1 Legacy: formato antiguo con fields/documents/certificates ──
      const fieldLabels = {
        'name': 'Nombre de la organización',
        'address': 'Dirección',
        'commune': 'Comuna',
        'region': 'Región',
        'neighborhood': 'Unidad Vecinal',
        'email': 'Email',
        'phone': 'Teléfono',
        'description': 'Objetivos'
      };

      const docNames = {
        'ACTA_CONSTITUTIVA': 'Acta Constitutiva',
        'ESTATUTOS': 'Estatutos',
        'REGISTRO_SOCIOS': 'Registro de Socios',
        'DECLARACION_JURADA_PRESIDENTE': 'Declaración Jurada',
        'ACTA_COMISION_ELECTORAL': 'Acta Comisión Electoral'
      };

      const roles = ['Presidente', 'Secretario', 'Vocal'];
      const correctedFields = org.userCorrectedFields || {};

      correctionsHTML = `
        <div class="org-corrections-section">
          <div class="corrections-alert">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div class="corrections-alert-content">
              <h4>Correcciones Requeridas</h4>
              <p>La municipalidad ha solicitado las siguientes correcciones para continuar con el proceso.</p>
            </div>
          </div>

          ${corrections.generalComment ? `
            <div class="correction-general-comment">
              <strong>Observación general:</strong>
              <p>${corrections.generalComment}</p>
            </div>
          ` : ''}

          ${corrections.fields && Object.keys(corrections.fields).length > 0 ? `
            <div class="correction-category">
              <h5>Información a corregir:</h5>
              <div class="correction-items-list">
                ${Object.entries(corrections.fields).map(([key, val]) => {
                  const isCorrected = correctedFields.field && correctedFields.field[key];
                  return `
                  <div class="correction-item-card ${isCorrected ? 'corrected' : ''}" data-type="field" data-key="${key}">
                    <div class="correction-item-header">
                      <span class="correction-item-name">${fieldLabels[key] || key}</span>
                      <button class="btn-edit-correction" data-type="field" data-key="${key}">${isCorrected ? '✓ Editado' : 'Editar'}</button>
                    </div>
                    <div class="correction-item-current">
                      <span class="label">Valor actual:</span>
                      <span class="value">${org.organization?.[key] || '-'}</span>
                    </div>
                    ${typeof val === 'object' && val.comment ? `
                      <div class="correction-item-reviewer-comment">
                        <span class="label">${isCorrected ? 'Observación atendida:' : 'Observación del revisor:'}</span>
                        <p>${val.comment}</p>
                      </div>
                    ` : typeof val === 'string' && val ? `
                      <div class="correction-item-reviewer-comment">
                        <span class="label">${isCorrected ? 'Observación atendida:' : 'Observación del revisor:'}</span>
                        <p>${val}</p>
                      </div>
                    ` : ''}
                    <div class="correction-item-user-response">
                      <label>Tu respuesta (opcional):</label>
                      <input type="text" class="user-field-response" data-type="field" data-key="${key}"
                             placeholder="Agrega una nota sobre esta corrección...">
                    </div>
                  </div>
                `;}).join('')}
              </div>
            </div>
          ` : ''}

          ${corrections.documents && Object.keys(corrections.documents).length > 0 ? `
            <div class="correction-category">
              <h5>Documentos a corregir:</h5>
              <div class="correction-items-list">
                ${Object.entries(corrections.documents).map(([key, val]) => {
                  const isCorrected = correctedFields.document && correctedFields.document[key];
                  return `
                  <div class="correction-item-card ${isCorrected ? 'corrected' : ''}" data-type="document" data-key="${key}">
                    <div class="correction-item-header">
                      <span class="correction-item-name">${docNames[key] || key}</span>
                      <button class="btn-edit-correction" data-type="document" data-key="${key}">${isCorrected ? '✓ Resubido' : 'Resubir'}</button>
                    </div>
                    ${typeof val === 'object' && val.comment ? `
                      <div class="correction-item-reviewer-comment">
                        <span class="label">${isCorrected ? 'Observación atendida:' : 'Observación del revisor:'}</span>
                        <p>${val.comment}</p>
                      </div>
                    ` : typeof val === 'string' && val ? `
                      <div class="correction-item-reviewer-comment">
                        <span class="label">${isCorrected ? 'Observación atendida:' : 'Observación del revisor:'}</span>
                        <p>${val}</p>
                      </div>
                    ` : ''}
                    <div class="correction-item-user-response">
                      <label>Tu respuesta (opcional):</label>
                      <input type="text" class="user-field-response" data-type="document" data-key="${key}"
                             placeholder="Agrega una nota sobre esta corrección...">
                    </div>
                  </div>
                `;}).join('')}
              </div>
            </div>
          ` : ''}

          ${corrections.certificates && Object.keys(corrections.certificates).length > 0 ? `
            <div class="correction-category">
              <h5>Certificados a corregir:</h5>
              <div class="correction-items-list">
                ${Object.entries(corrections.certificates).map(([memberId, val]) => {
                  const memberIndex = org.commission?.members?.findIndex(m => m.id === memberId) ?? -1;
                  const member = org.commission?.members?.[memberIndex];
                  const role = roles[memberIndex] || 'Miembro';
                  const isCorrected = correctedFields.certificate && correctedFields.certificate[memberId];
                  return `
                    <div class="correction-item-card ${isCorrected ? 'corrected' : ''}" data-type="certificate" data-key="${memberId}">
                      <div class="correction-item-header">
                        <span class="correction-item-name">${role}: ${member ? `${member.firstName} ${member.lastName}` : 'Miembro'}</span>
                        <button class="btn-edit-correction" data-type="certificate" data-key="${memberId}">${isCorrected ? '✓ Resubido' : 'Resubir'}</button>
                      </div>
                      ${typeof val === 'object' && val.comment ? `
                        <div class="correction-item-reviewer-comment">
                          <span class="label">${isCorrected ? 'Observación atendida:' : 'Observación del revisor:'}</span>
                          <p>${val.comment}</p>
                        </div>
                      ` : typeof val === 'string' && val ? `
                        <div class="correction-item-reviewer-comment">
                          <span class="label">${isCorrected ? 'Observación atendida:' : 'Observación del revisor:'}</span>
                          <p>${val}</p>
                        </div>
                      ` : ''}
                      <div class="correction-item-user-response">
                        <label>Tu respuesta (opcional):</label>
                        <input type="text" class="user-field-response" data-type="certificate" data-key="${memberId}"
                               placeholder="Agrega una nota sobre esta corrección...">
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          ${corrections.members && Object.keys(corrections.members).length > 0 ? `
            <div class="correction-category">
              <h5>Miembros fundadores a corregir:</h5>
              <div class="correction-items-list">
                ${Object.entries(corrections.members).map(([memberId, val]) => {
                  const member = org.members?.find(m => m.id === memberId);
                  const isCorrected = correctedFields.member && correctedFields.member[memberId];
                  return `
                    <div class="correction-item-card ${isCorrected ? 'corrected' : ''}" data-type="member" data-key="${memberId}">
                      <div class="correction-item-header">
                        <span class="correction-item-name">Miembro: ${member ? `${member.firstName} ${member.lastName}` : 'Miembro'}</span>
                        <button class="btn-edit-correction" data-type="member" data-key="${memberId}">${isCorrected ? '✓ Corregido' : 'Editar'}</button>
                      </div>
                      ${typeof val === 'object' && val.comment ? `
                        <div class="correction-item-reviewer-comment">
                          <span class="label">${isCorrected ? 'Observación atendida:' : 'Observación del revisor:'}</span>
                          <p>${val.comment}</p>
                        </div>
                      ` : typeof val === 'string' && val ? `
                        <div class="correction-item-reviewer-comment">
                          <span class="label">${isCorrected ? 'Observación atendida:' : 'Observación del revisor:'}</span>
                          <p>${val}</p>
                        </div>
                      ` : ''}
                      <div class="correction-item-user-response">
                        <label>Tu respuesta (opcional):</label>
                        <input type="text" class="user-field-response" data-type="member" data-key="${memberId}"
                               placeholder="Agrega una nota sobre esta corrección...">
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          ${corrections.commission && Object.keys(corrections.commission).length > 0 ? `
            <div class="correction-category">
              <h5>Comisión Electoral a corregir:</h5>
              <div class="correction-items-list">
                ${Object.entries(corrections.commission).map(([key, val]) => {
                  let label = key;
                  if (key === 'electionDate') {
                    label = 'Fecha de Elección';
                  } else {
                    const memberIndex = org.commission?.members?.findIndex(m => m.id === key) ?? -1;
                    const member = org.commission?.members?.[memberIndex];
                    const commRole = ['Presidente', 'Secretario', 'Vocal'][memberIndex] || 'Miembro';
                    label = `${commRole}: ${member ? `${member.firstName} ${member.lastName}` : 'Miembro'}`;
                  }
                  const isCorrected = correctedFields.commission && correctedFields.commission[key];
                  return `
                    <div class="correction-item-card ${isCorrected ? 'corrected' : ''}" data-type="commission" data-key="${key}">
                      <div class="correction-item-header">
                        <span class="correction-item-name">${label}</span>
                        <button class="btn-edit-correction" data-type="commission" data-key="${key}">${isCorrected ? '✓ Corregido' : 'Editar'}</button>
                      </div>
                      ${typeof val === 'object' && val.comment ? `
                        <div class="correction-item-reviewer-comment">
                          <span class="label">${isCorrected ? 'Observación atendida:' : 'Observación del revisor:'}</span>
                          <p>${val.comment}</p>
                        </div>
                      ` : typeof val === 'string' && val ? `
                        <div class="correction-item-reviewer-comment">
                          <span class="label">${isCorrected ? 'Observación atendida:' : 'Observación del revisor:'}</span>
                          <p>${val}</p>
                        </div>
                      ` : ''}
                      <div class="correction-item-user-response">
                        <label>Tu respuesta (opcional):</label>
                        <input type="text" class="user-field-response" data-type="commission" data-key="${key}"
                               placeholder="Agrega una nota sobre esta corrección...">
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <div class="user-observations-section general-observation">
            <label for="user-correction-comments">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Observación general para el revisor (opcional)
            </label>
            <textarea id="user-correction-comments" class="user-observations-textarea"
                      placeholder="Escriba aquí cualquier comentario o aclaración general sobre las correcciones realizadas..."></textarea>
          </div>

          <div class="correction-actions">
            <button class="btn-resubmit-org" id="btn-resubmit-${org.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 2L11 13"></path>
                <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
              </svg>
              Reenviar para Revisión
            </button>
          </div>
        </div>
      `;
    }
  }
  // Nota: Si corrections.resolved = true pero el status ya no es 'rejected',
  // no mostramos nada - las correcciones ya fueron procesadas y la organización avanzó

  // Generar HTML de información de Ministro asignado o cita pendiente
  const isMinistroScheduled = org.status === ORG_STATUS.MINISTRO_SCHEDULED;
  const isWaitingMinistro = org.status === ORG_STATUS.WAITING_MINISTRO_REQUEST;

  let appointmentHTML = '';

  // Si ya tiene Ministro asignado - mostrar información prominente
  if (isMinistroScheduled && org.ministroData) {
    // Parsear fecha correctamente
    let formattedDate = '-';
    const dateToUse = org.ministroData.scheduledDate || org.electionDate;
    if (dateToUse) {
      try {
        let dateStr = dateToUse;
        // Si tiene 'T' (ISO format), tomar solo la parte de la fecha
        if (typeof dateStr === 'string' && dateStr.includes('T')) {
          dateStr = dateStr.split('T')[0];
        }
        const [year, month, day] = String(dateStr).split('-').map(Number);
        if (year && month && day) {
          const date = new Date(year, month - 1, day, 12, 0, 0);
          formattedDate = date.toLocaleDateString('es-CL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
        }
      } catch (e) {
        console.error('Error parseando fecha:', e);
        formattedDate = '-';
      }
    }

    const timeToUse = org.ministroData.scheduledTime || org.electionTime || '-';
    const locationToUse = org.ministroData.location || org.assemblyAddress || org.organization?.address || '-';

    // Detectar diferencias entre lo solicitado y lo asignado
    const requestedDate = org.electionDate;
    const requestedTime = org.electionTime;
    const requestedLocation = org.assemblyAddress || org.organization?.address;

    const assignedDate = org.ministroData.scheduledDate;
    const assignedTime = org.ministroData.scheduledTime;
    const assignedLocation = org.ministroData.location;

    // Normalizar fechas para comparación
    const normDate = (d) => d ? (d.includes('T') ? d.split('T')[0] : d) : null;
    const dateChanged = requestedDate && assignedDate && normDate(requestedDate) !== normDate(assignedDate);
    const timeChanged = requestedTime && assignedTime && requestedTime !== assignedTime;
    const locationChanged = requestedLocation && assignedLocation && requestedLocation.toLowerCase().trim() !== assignedLocation.toLowerCase().trim();

    const hasAnyChanges = dateChanged || timeChanged || locationChanged;

    // Función para formatear fechas de forma corta
    const formatDateCompare = (dateStr) => {
      if (!dateStr) return '-';
      try {
        const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const [y, m, day] = d.split('-').map(Number);
        return new Date(y, m - 1, day).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
      } catch { return dateStr; }
    };

    // Notificación de cambios (solo si hay cambios reales)
    let changesNoticeHTML = '';
    if (hasAnyChanges) {
      changesNoticeHTML = `
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px; border: 1px solid #f59e0b;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <span style="font-size: 20px;">📋</span>
            <p style="margin: 0; color: #92400e; font-weight: 700; font-size: 14px;">Cambios respecto a tu solicitud</p>
          </div>
          <div style="display: flex; gap: 16px; flex-wrap: wrap;">
            ${dateChanged ? `<div style="background: white; border-radius: 8px; padding: 10px 14px; flex: 1; min-width: 150px;">
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; text-transform: uppercase;">Fecha</p>
              <p style="margin: 0; font-size: 13px;"><span style="color: #dc2626; text-decoration: line-through;">${formatDateCompare(requestedDate)}</span> → <span style="color: #059669; font-weight: 600;">${formatDateCompare(assignedDate)}</span></p>
            </div>` : ''}
            ${timeChanged ? `<div style="background: white; border-radius: 8px; padding: 10px 14px; flex: 1; min-width: 150px;">
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; text-transform: uppercase;">Hora</p>
              <p style="margin: 0; font-size: 13px;"><span style="color: #dc2626; text-decoration: line-through;">${requestedTime}</span> → <span style="color: #059669; font-weight: 600;">${assignedTime}</span></p>
            </div>` : ''}
            ${locationChanged ? `<div style="background: white; border-radius: 8px; padding: 10px 14px; flex: 1; min-width: 200px;">
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; text-transform: uppercase;">Lugar</p>
              <p style="margin: 0; font-size: 12px; color: #059669; font-weight: 600;">${assignedLocation}</p>
            </div>` : ''}
          </div>
        </div>
      `;
    }

    appointmentHTML = `
      <!-- Header Principal - Cita Confirmada -->
      <div style="background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); border-radius: 20px; padding: 24px; margin-bottom: 20px; color: white; box-shadow: 0 10px 25px rgba(37, 99, 235, 0.25);">
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
          <div style="width: 56px; height: 56px; min-width: 56px; background: rgba(255,255,255,0.2); border-radius: 14px; display: flex; align-items: center; justify-content: center;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div style="min-width: 0;">
            <h3 style="margin: 0; font-size: 24px; font-weight: 700;">Cita Confirmada</h3>
            <p style="margin: 4px 0 0; opacity: 0.9; font-size: 15px;">Asamblea de constitución programada</p>
          </div>
        </div>

        <!-- Info - Fecha y Hora -->
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <div style="flex: 1; background: rgba(255,255,255,0.18); border-radius: 14px; padding: 18px; text-align: center;">
            <p style="margin: 0; font-size: 28px;">📅</p>
            <p style="margin: 8px 0 0; font-size: 16px; font-weight: 600;">${formattedDate}</p>
          </div>
          <div style="flex: 0.6; background: rgba(255,255,255,0.18); border-radius: 14px; padding: 18px; text-align: center;">
            <p style="margin: 0; font-size: 28px;">🕐</p>
            <p style="margin: 8px 0 0; font-size: 18px; font-weight: 700;">${timeToUse}</p>
          </div>
        </div>

        <!-- Ministro -->
        <div style="background: rgba(255,255,255,0.18); border-radius: 14px; padding: 16px; display: flex; align-items: center; gap: 14px; margin-bottom: 12px;">
          <span style="font-size: 28px;">⚖️</span>
          <div style="min-width: 0;">
            <p style="margin: 0; font-size: 12px; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.5px;">Ministro de Fe</p>
            <p style="margin: 4px 0 0; font-size: 17px; font-weight: 600;">${org.ministroData.name || 'Por asignar'}</p>
          </div>
        </div>

        <!-- Ubicación -->
        <div style="background: rgba(255,255,255,0.12); border-radius: 14px; padding: 16px; display: flex; align-items: center; gap: 14px;">
          <span style="font-size: 28px;">📍</span>
          <div style="min-width: 0; flex: 1;">
            <p style="margin: 0; font-size: 12px; opacity: 0.85; letter-spacing: 0.5px;">Lugar</p>
            <p style="margin: 4px 0 0; font-size: 16px; font-weight: 500; word-break: break-word;">${locationToUse}</p>
          </div>
        </div>
      </div>

      ${changesNoticeHTML}

      <!-- Qué llevar -->
      <div style="background: #f1f5f9; border-radius: 16px; padding: 20px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
        <h5 style="margin: 0 0 14px 0; color: #1e293b; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 22px;">🎒</span> Qué llevar
        </h5>
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
          <span style="background: white; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 20px; font-size: 14px; color: #334155; font-weight: 500;">🪪 Cédulas</span>
          <span style="background: white; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 20px; font-size: 14px; color: #334155; font-weight: 500;">📕 Actas</span>
          <span style="background: white; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 20px; font-size: 14px; color: #334155; font-weight: 500;">📗 Socios</span>
          <span style="background: white; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 20px; font-size: 14px; color: #334155; font-weight: 500;">📘 Contabilidad</span>
          <span style="background: white; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 20px; font-size: 14px; color: #334155; font-weight: 500;">🖊️ Lápiz azul</span>
          <span style="background: white; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 20px; font-size: 14px; color: #334155; font-weight: 500;">📄 Estatutos x3</span>
        </div>
      </div>

      <!-- Quiénes deben asistir -->
      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 16px; padding: 20px; margin-bottom: 16px; border: 1px solid #f59e0b;">
        <h5 style="margin: 0 0 14px 0; color: #92400e; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 22px;">👥</span> Asistencia obligatoria
        </h5>
        <div style="display: flex; flex-wrap: wrap; gap: 12px;">
          <div style="background: white; border-radius: 12px; padding: 16px; flex: 1; min-width: 160px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #b45309; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Directorio</p>
            ${(() => {
              const dir = org.provisionalDirectorio;
              if (dir && (dir.president || dir.secretary || dir.treasurer)) {
                let html = '';
                if (dir.president) html += '<p style="margin: 0 0 6px 0; font-size: 14px; color: #44403c;">• ' + (dir.president.firstName || '') + ' ' + (dir.president.lastName || '').charAt(0) + '.</p>';
                if (dir.secretary) html += '<p style="margin: 0 0 6px 0; font-size: 14px; color: #44403c;">• ' + (dir.secretary.firstName || '') + ' ' + (dir.secretary.lastName || '').charAt(0) + '.</p>';
                if (dir.treasurer) html += '<p style="margin: 0 0 6px 0; font-size: 14px; color: #44403c;">• ' + (dir.treasurer.firstName || '') + ' ' + (dir.treasurer.lastName || '').charAt(0) + '.</p>';
                return html || '<p style="margin: 0; font-size: 14px; color: #78716c;">Ver solicitud</p>';
              }
              const directors = org.members?.filter(m => ['president', 'secretary', 'treasurer'].includes(m.role)) || [];
              if (directors.length === 0) return '<p style="margin: 0; font-size: 14px; color: #78716c;">Ver solicitud</p>';
              return directors.map(m => '<p style="margin: 0 0 6px 0; font-size: 14px; color: #44403c;">• ' + (m.firstName || '') + ' ' + (m.lastName || '').charAt(0) + '.</p>').join('');
            })()}
          </div>
          <div style="background: white; border-radius: 12px; padding: 16px; flex: 1; min-width: 160px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #b45309; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Com. Electoral</p>
            ${(() => {
              const commission = org.electoralCommission || [];
              if (commission.length === 0) return '<p style="margin: 0; font-size: 14px; color: #78716c;">Ver solicitud</p>';
              return commission.map(m => '<p style="margin: 0 0 6px 0; font-size: 14px; color: #44403c;">• ' + (m.firstName || m.name || '') + ' ' + (m.lastName || '').charAt(0) + '.</p>').join('');
              })()}
            </div>
          </div>
        </div>
    `;
  }
  // Si está esperando asignación de Ministro
  else if (isWaitingMinistro && (org.electionDate || org.assemblyAddress)) {
    // Parsear fecha correctamente para evitar desfase de zona horaria
    let formattedDate = '-';
    if (org.electionDate) {
      try {
        let dateStr = org.electionDate;
        // Manejar diferentes formatos de fecha
        if (typeof dateStr === 'string') {
          // Si tiene 'T' (ISO format), tomar solo la parte de la fecha
          if (dateStr.includes('T')) {
            dateStr = dateStr.split('T')[0];
          }
          const [year, month, day] = dateStr.split('-').map(Number);
          if (year && month && day) {
            const date = new Date(year, month - 1, day, 12, 0, 0);
            formattedDate = date.toLocaleDateString('es-CL', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
            // Capitalizar primera letra
            formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
          }
        }
      } catch (e) {
        console.error('Error parseando fecha:', e);
        formattedDate = '-';
      }
    }

    // Obtener datos de contacto - buscar en múltiples lugares
    const president = org.members?.find(m => m.role === 'president') || org.members?.[0];
    const contactPreference = org.contactPreference || org.organization?.contactPreference || 'phone';
    const contactPreferenceLabel = contactPreference === 'email' ? '📧 Correo Electrónico' : '📞 Teléfono';
    const contactValue = contactPreference === 'email'
      ? (org.contactEmail || org.organization?.email || president?.email || '-')
      : (org.contactPhone || org.organization?.phone || president?.phone || '-');

    appointmentHTML = `
      <div class="org-appointment-highlight">
        <div class="appointment-highlight-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <h3>Solicitud de Ministro de Fe Enviada</h3>
        </div>

        <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 24px;">⏳</div>
          <div>
            <p style="margin: 0; color: #92400e; font-weight: 600;">Esperando asignación de Ministro de Fe</p>
            <p style="margin: 4px 0 0; color: #a16207; font-size: 13px;">La municipalidad revisará tu solicitud y te asignará un Ministro de Fe.</p>
          </div>
        </div>

        <p style="font-size: 14px; color: #6b7280; margin-bottom: 16px; font-weight: 500;">Fecha y hora solicitadas:</p>

        <div class="appointment-highlight-grid">
          <div class="appointment-highlight-item">
            <div class="appointment-icon">📅</div>
            <div class="appointment-info">
              <span class="appointment-label">Fecha Solicitada</span>
              <span class="appointment-value">${formattedDate}</span>
            </div>
          </div>

          <div class="appointment-highlight-item">
            <div class="appointment-icon">🕐</div>
            <div class="appointment-info">
              <span class="appointment-label">Hora Solicitada</span>
              <span class="appointment-value">${org.electionTime || '-'}</span>
            </div>
          </div>

          <div class="appointment-highlight-item full-width">
            <div class="appointment-icon">📍</div>
            <div class="appointment-info">
              <span class="appointment-label">Lugar Propuesto</span>
              <span class="appointment-value">${org.assemblyAddress || org.organization?.address || '-'}</span>
            </div>
          </div>

          <div class="appointment-highlight-item full-width">
            <div class="appointment-icon">${contactPreference === 'email' ? '📧' : '📞'}</div>
            <div class="appointment-info">
              <span class="appointment-label">Preferencia de Contacto</span>
              <span class="appointment-value">${contactPreferenceLabel} - ${contactValue || '-'}</span>
            </div>
          </div>
        </div>

        ${org.comments ? `
          <div class="appointment-comments">
            <span class="comments-label">Comentarios adicionales:</span>
            <p>${org.comments}</p>
          </div>
        ` : ''}

        <div class="appointment-notice">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span>La Municipalidad confirmará la fecha y te asignará un Ministro de Fe. Serás contactado por tu medio preferido.</span>
        </div>
      </div>
    `;
  }
  // Si la asamblea fue validada por el ministro - esperando envío a RC
  else if (org.status === ORG_STATUS.MINISTRO_APPROVED) {
    appointmentHTML = `
      <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 16px; padding: 20px; margin-bottom: 20px; border: 2px solid #2563eb;">
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
          <div style="width: 48px; height: 48px; background: #2563eb; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e40af;">Asamblea Validada</h3>
            <p style="margin: 2px 0 0; color: #1d4ed8; font-size: 13px;">El Ministro de Fe validó tu asamblea constitutiva</p>
          </div>
        </div>
        <div style="background: white; border-radius: 10px; padding: 14px; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 24px;">⏳</span>
          <div>
            <p style="margin: 0; font-weight: 600; color: #1e40af; font-size: 14px;">Esperando envío al Registro Civil</p>
            <p style="margin: 4px 0 0; font-size: 12px; color: #2563eb;">La municipalidad preparará la documentación y la enviará al Registro Civil. Te notificaremos cuando esto ocurra.</p>
          </div>
        </div>
      </div>
    `;
  }
  // Si ya fue enviada al Registro Civil
  else if (org.status === ORG_STATUS.SENT_TO_REGISTRY) {
    appointmentHTML = `
      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 16px; padding: 20px; margin-bottom: 20px; border: 2px solid #f59e0b;">
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
          <div style="width: 48px; height: 48px; background: #f59e0b; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #92400e;">Enviado al Registro Civil</h3>
            <p style="margin: 2px 0 0; color: #a16207; font-size: 13px;">Tu documentación está siendo procesada</p>
          </div>
        </div>
        <div style="background: white; border-radius: 10px; padding: 14px; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 24px;">📋</span>
          <div>
            <p style="margin: 0; font-weight: 600; color: #92400e; font-size: 14px;">Esperando respuesta del Registro Civil</p>
            <p style="margin: 4px 0 0; font-size: 12px; color: #a16207;">Este proceso puede tomar algunos días. Te notificaremos cuando tu organización esté oficialmente registrada.</p>
          </div>
        </div>
      </div>
    `;
  }
  // Si ya está aprobada/registrada
  else if (org.status === ORG_STATUS.APPROVED) {
    appointmentHTML = `
      <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 16px; padding: 20px; margin-bottom: 20px; border: 2px solid #10b981;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 48px; height: 48px; background: #10b981; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #065f46;">¡Organización Registrada!</h3>
            <p style="margin: 2px 0 0; color: #047857; font-size: 13px;">Tu organización está legalmente constituida en el Registro Civil</p>
          </div>
        </div>
      </div>
    `;
  }

  const modal = document.createElement('div');
  modal.className = 'org-detail-modal-overlay';
  modal.innerHTML = `
    <div class="org-detail-modal ${isRejected ? 'has-corrections' : ''}">
      <div class="org-detail-header">
        <h2>${org.organization?.name || 'Organización'}</h2>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="org-detail-body">
        <div class="org-detail-status" style="background: ${statusColor}20; color: ${statusColor}">
          ${statusLabel}
        </div>

        ${appointmentHTML}

        ${correctionsHTML}

        <div class="org-detail-section">
          <h4>Información General</h4>
          <div class="detail-row ${corrections?.fields?.name ? 'needs-correction' : ''}">
            <span class="detail-label">Tipo:</span>
            <span class="detail-value">${getOrgTypeName(org.organizationType || org.organization?.type)}</span>
          </div>
          <div class="detail-row ${corrections?.fields?.address ? 'needs-correction' : ''}">
            <span class="detail-label">Dirección:</span>
            <span class="detail-value">${org.address || org.organization?.address || org.assemblyAddress || '-'}</span>
          </div>
          <div class="detail-row ${corrections?.fields?.commune ? 'needs-correction' : ''}">
            <span class="detail-label">Comuna:</span>
            <span class="detail-value">${org.commune || org.organization?.commune || 'Renca'}</span>
          </div>
          <div class="detail-row ${corrections?.fields?.region ? 'needs-correction' : ''}">
            <span class="detail-label">Región:</span>
            <span class="detail-value">${org.region || org.organization?.region || 'Metropolitana'}</span>
          </div>
          <div class="detail-row ${corrections?.fields?.email ? 'needs-correction' : ''}">
            <span class="detail-label">Email:</span>
            <span class="detail-value">${org.contactEmail || org.organization?.email || org.members?.[0]?.email || '-'}</span>
          </div>
          <div class="detail-row ${corrections?.fields?.phone ? 'needs-correction' : ''}">
            <span class="detail-label">Teléfono:</span>
            <span class="detail-value">${org.contactPhone || org.organization?.phone || org.members?.[0]?.phone || '-'}</span>
          </div>
        </div>

        <div class="org-detail-section">
          <h4>Miembros</h4>
          <div class="detail-row">
            <span class="detail-label">Total fundadores:</span>
            <span class="detail-value">${org.members?.length || 0} miembros</span>
          </div>
        </div>

        ${(org.status === 'ministro_approved' || org.status === 'sent_registry' || org.status === 'approved') && (org.provisionalDirectorio || org.comisionElectoral) ? `
        <div class="org-detail-section">
          <h4 style="display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            Documentos Oficiales
          </h4>
          <p style="font-size: 12px; color: #6b7280; margin-bottom: 12px;">Documentos generados automáticamente con los datos validados por el Ministro de Fe.</p>
          <div class="official-docs-list" style="display: flex; flex-direction: column; gap: 8px;">
            <div class="doc-item-user" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac;">
              <span style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #065f46;">
                📜 Acta de Asamblea General Constitutiva
              </span>
              <div style="display: flex; gap: 6px;">
                <button class="btn-view-user-pdf" data-doc-id="acta_asamblea" data-org-id="${org.id || org._id}" style="padding: 6px 10px; background: #10b981; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Ver</button>
                <button class="btn-download-user-pdf" data-doc-id="acta_asamblea" data-org-id="${org.id || org._id}" style="padding: 6px 10px; background: #065f46; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Descargar</button>
              </div>
            </div>
            <div class="doc-item-user" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac;">
              <span style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #065f46;">
                📋 Lista de Socios Constitución
              </span>
              <div style="display: flex; gap: 6px;">
                <button class="btn-view-user-pdf" data-doc-id="lista_socios" data-org-id="${org.id || org._id}" style="padding: 6px 10px; background: #10b981; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Ver</button>
                <button class="btn-download-user-pdf" data-doc-id="lista_socios" data-org-id="${org.id || org._id}" style="padding: 6px 10px; background: #065f46; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Descargar</button>
              </div>
            </div>
            <div class="doc-item-user" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac;">
              <span style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #065f46;">
                🏛️ Certificado del Ministro de Fe
              </span>
              <div style="display: flex; gap: 6px;">
                <button class="btn-view-user-pdf" data-doc-id="certificado" data-org-id="${org.id || org._id}" style="padding: 6px 10px; background: #10b981; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Ver</button>
                <button class="btn-download-user-pdf" data-doc-id="certificado" data-org-id="${org.id || org._id}" style="padding: 6px 10px; background: #065f46; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Descargar</button>
              </div>
            </div>
            <div class="doc-item-user" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac;">
              <span style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #065f46;">
                📄 Certificación Municipal
              </span>
              <div style="display: flex; gap: 6px;">
                <button class="btn-view-user-pdf" data-doc-id="certificacion" data-org-id="${org.id || org._id}" style="padding: 6px 10px; background: #10b981; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Ver</button>
                <button class="btn-download-user-pdf" data-doc-id="certificacion" data-org-id="${org.id || org._id}" style="padding: 6px 10px; background: #065f46; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Descargar</button>
              </div>
            </div>
            <div class="doc-item-user" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac;">
              <span style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #065f46;">
                📁 Depósito de Antecedentes
              </span>
              <div style="display: flex; gap: 6px;">
                <button class="btn-view-user-pdf" data-doc-id="deposito" data-org-id="${org.id || org._id}" style="padding: 6px 10px; background: #10b981; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Ver</button>
                <button class="btn-download-user-pdf" data-doc-id="deposito" data-org-id="${org.id || org._id}" style="padding: 6px 10px; background: #065f46; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Descargar</button>
              </div>
            </div>
          </div>
          <button class="btn-download-all-user-pdfs" data-org-id="${org.id || org._id}" style="width: 100%; margin-top: 12px; padding: 12px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Descargar Todos los Documentos
          </button>
        </div>
        ` : ''}

        <div class="org-detail-section">
          <h4>Historial de Estados</h4>
          <div class="status-timeline">
            ${org.statusHistory?.map(h => `
              <div class="timeline-item">
                <div class="timeline-dot" style="background: ${ORG_STATUS_COLORS[h.status] || '#6b7280'}"></div>
                <div class="timeline-content">
                  <span class="timeline-status">${ORG_STATUS_LABELS[h.status] || h.status}</span>
                  <span class="timeline-date">${new Date(h.date).toLocaleDateString('es-CL')}</span>
                  ${h.comment ? `<span class="timeline-comment">${h.comment}</span>` : ''}
                </div>
              </div>
            `).join('') || '<p>Sin historial</p>'}
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('.modal-close-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  // Event listeners para PDFs oficiales
  modal.querySelectorAll('.btn-view-user-pdf').forEach(btn => {
    btn.addEventListener('click', () => {
      const docId = btn.dataset.docId;
      const orgId = btn.dataset.orgId;
      viewUserPDF(orgId, docId);
    });
  });

  modal.querySelectorAll('.btn-download-user-pdf').forEach(btn => {
    btn.addEventListener('click', () => {
      const docId = btn.dataset.docId;
      const orgId = btn.dataset.orgId;
      downloadUserPDF(orgId, docId);
    });
  });

  modal.querySelectorAll('.btn-download-all-user-pdfs').forEach(btn => {
    btn.addEventListener('click', () => {
      const orgId = btn.dataset.orgId;
      downloadAllUserPDFs(orgId);
    });
  });

  // Event listeners para edición de correcciones
  if (isRejected && corrections) {
    // Botones "Ver detalles" para expandir/colapsar ítems corregidos
    modal.querySelectorAll('.btn-toggle-details').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          const isHidden = targetEl.style.display === 'none';
          targetEl.style.display = isHidden ? 'block' : 'none';
          btn.innerHTML = isHidden ? '🔽 Ocultar detalles' : '👁️ Ver detalles';
        }
      });
    });

    // Botones de edición
    modal.querySelectorAll('.btn-edit-correction').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const type = btn.dataset.type;
        const key = btn.dataset.key;
        openCorrectionEditor(org, type, key, modal);
      });
    });

    // Botón de reenvío
    const resubmitBtn = modal.querySelector('.btn-resubmit-org');
    if (resubmitBtn) {
      resubmitBtn.addEventListener('click', async () => {
        // Crear modal de confirmación visual
        const confirmModal = document.createElement('div');
        confirmModal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:400000;';
        confirmModal.innerHTML = `
          <div id="resubmit-modal-content" style="background:white;border-radius:20px;width:90%;max-width:420px;padding:32px;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.3);">
            <div id="resubmit-icon" style="font-size:64px;margin-bottom:16px;">📤</div>
            <h3 id="resubmit-title" style="margin:0 0 12px;font-size:22px;color:#1e293b;">¿Reenviar para Revisión?</h3>
            <p id="resubmit-message" style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.5;">Sus correcciones serán enviadas al revisor para su evaluación.</p>
            <div id="resubmit-buttons" style="display:flex;gap:12px;justify-content:center;">
              <button id="btn-cancel-resubmit" style="padding:12px 28px;background:#f1f5f9;color:#64748b;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">Cancelar</button>
              <button id="btn-confirm-resubmit" style="padding:12px 28px;background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">Sí, Enviar</button>
            </div>
            <div id="resubmit-loading" style="display:none;">
              <div style="width:60px;height:60px;border:4px solid #e2e8f0;border-top-color:#10b981;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px;"></div>
              <p style="color:#64748b;font-size:15px;">Enviando solicitud...</p>
            </div>
          </div>
          <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        `;

        document.body.appendChild(confirmModal);

        // Event: Cancelar
        confirmModal.querySelector('#btn-cancel-resubmit').addEventListener('click', () => confirmModal.remove());
        confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) confirmModal.remove(); });

        // Event: Confirmar
        confirmModal.querySelector('#btn-confirm-resubmit').addEventListener('click', async () => {
          // Mostrar loading
          confirmModal.querySelector('#resubmit-buttons').style.display = 'none';
          confirmModal.querySelector('#resubmit-loading').style.display = 'block';
          confirmModal.querySelector('#resubmit-icon').style.display = 'none';
          confirmModal.querySelector('#resubmit-title').textContent = 'Enviando...';
          confirmModal.querySelector('#resubmit-message').style.display = 'none';

          // Recolectar respuestas por campo
          const fieldResponses = {};
          modal.querySelectorAll('.user-field-response').forEach(input => {
            const type = input.dataset.type;
            const key = input.dataset.key;
            const response = input.value.trim();
            if (response) {
              if (!fieldResponses[type]) fieldResponses[type] = {};
              fieldResponses[type][key] = response;
            }
          });

          const generalComment = modal.querySelector('#user-correction-comments')?.value.trim() || '';

          try {
            const result = await organizationsService.resubmitForReview(org.id || org._id, generalComment, fieldResponses);

            if (result) {
              // Mostrar éxito
              confirmModal.querySelector('#resubmit-loading').style.display = 'none';
              confirmModal.querySelector('#resubmit-modal-content').innerHTML = `
                <div style="font-size:80px;margin-bottom:20px;animation:bounceIn 0.5s ease;">✅</div>
                <h3 style="margin:0 0 12px;font-size:24px;color:#10b981;font-weight:700;">¡Enviado Correctamente!</h3>
                <p style="margin:0 0 8px;color:#374151;font-size:16px;">Su solicitud ha sido reenviada para revisión.</p>
                <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Recibirá una notificación cuando el revisor evalúe sus correcciones.</p>
                <button id="btn-close-success" style="padding:14px 36px;background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;">Entendido</button>
                <style>@keyframes bounceIn{0%{transform:scale(0)}50%{transform:scale(1.2)}100%{transform:scale(1)}}</style>
              `;

              confirmModal.querySelector('#btn-close-success').addEventListener('click', () => {
                confirmModal.remove();
                modal.remove();
                renderOrganizations();
              });
            } else {
              throw new Error('No se pudo reenviar');
            }
          } catch (error) {
            console.error('Error al reenviar:', error);
            confirmModal.querySelector('#resubmit-loading').style.display = 'none';
            confirmModal.querySelector('#resubmit-modal-content').innerHTML = `
              <div style="font-size:64px;margin-bottom:16px;">❌</div>
              <h3 style="margin:0 0 12px;font-size:22px;color:#dc2626;">Error al Enviar</h3>
              <p style="margin:0 0 24px;color:#64748b;font-size:15px;">${error.message || 'Ocurrió un error. Por favor intente nuevamente.'}</p>
              <button id="btn-close-error" style="padding:12px 28px;background:#f1f5f9;color:#64748b;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">Cerrar</button>
            `;
            confirmModal.querySelector('#btn-close-error').addEventListener('click', () => confirmModal.remove());
          }
        });
      });
    }
  }
}

// Funciones para manejo de PDFs del usuario
async function viewUserPDF(orgId, docId) {
  console.log('viewUserPDF called with:', { orgId, docId });

  let org = organizationsService.getById(orgId);

  // Si no se encuentra localmente, intentar obtenerla del servidor
  if (!org) {
    console.log('Org not found locally, fetching from server...');
    org = await organizationsService.getByIdAsync(orgId);
  }

  console.log('Organization data:', org);

  if (!org) {
    showToast('Organización no encontrada', 'error');
    return;
  }

  let pdfDoc;
  let docTitle = '';

  try {
    console.log('Generating PDF for:', docId);
    switch (docId) {
      case 'acta_asamblea':
        console.log('Calling generateActaAsamblea...');
        pdfDoc = pdfService.generateActaAsamblea(org);
        console.log('generateActaAsamblea returned:', pdfDoc);
        docTitle = 'Acta de Asamblea General Constitutiva';
        break;
      case 'lista_socios':
        console.log('Calling generateListaSocios...');
        pdfDoc = pdfService.generateListaSocios(org);
        console.log('generateListaSocios returned:', pdfDoc);
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
      default:
        showToast('Documento no encontrado', 'error');
        return;
    }

    if (!pdfDoc) {
      showToast('No se pudo generar el documento', 'error');
      return;
    }

    const pdfDataUrl = pdfService.getPDFDataURL(pdfDoc);

    const previewModal = document.createElement('div');
    previewModal.className = 'pdf-preview-modal';
    previewModal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 300000;';
    previewModal.innerHTML = `
      <div style="background: white; border-radius: 12px; width: 95%; max-width: 900px; height: 90vh; display: flex; flex-direction: column; overflow: hidden;">
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
              Cerrar
            </button>
          </div>
        </div>
        <div style="flex: 1; overflow: hidden;">
          <iframe src="${pdfDataUrl}" style="width: 100%; height: 100%; border: none;"></iframe>
        </div>
      </div>
    `;

    document.body.appendChild(previewModal);

    // Función para limpiar el modal y revocar el blob URL
    const closeModal = () => {
      URL.revokeObjectURL(pdfDataUrl); // Limpiar blob URL para evitar memory leaks
      previewModal.remove();
    };

    previewModal.querySelector('.btn-close-preview').addEventListener('click', closeModal);
    previewModal.addEventListener('click', (e) => { if (e.target === previewModal) closeModal(); });
    previewModal.querySelector('.btn-download-preview').addEventListener('click', () => {
      downloadUserPDF(orgId, docId);
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    showToast('Error al generar el documento PDF', 'error');
  }
}

async function downloadUserPDF(orgId, docId) {
  let org = organizationsService.getById(orgId);

  // Si no se encuentra localmente, intentar obtenerla del servidor
  if (!org) {
    org = await organizationsService.getByIdAsync(orgId);
  }

  if (!org) {
    showToast('Organización no encontrada', 'error');
    return;
  }

  let pdfDoc;
  let filename = '';
  const orgName = (org.organization?.name || org.organizationName || 'Organizacion').replace(/\s+/g, '_');

  try {
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
      default:
        showToast('Documento no encontrado', 'error');
        return;
    }

    if (!pdfDoc) {
      showToast('No se pudo generar el documento', 'error');
      return;
    }

    pdfService.downloadPDF(pdfDoc, filename);
    showToast(`Documento descargado`, 'success');

  } catch (error) {
    console.error('Error downloading PDF:', error);
    showToast('Error al descargar el documento PDF', 'error');
  }
}

async function downloadAllUserPDFs(orgId) {
  let org = organizationsService.getById(orgId);

  // Si no se encuentra localmente, intentar obtenerla del servidor
  if (!org) {
    org = await organizationsService.getByIdAsync(orgId);
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

    let downloadCount = 0;
    documents.forEach((doc, index) => {
      setTimeout(() => {
        pdfService.downloadPDF(doc.doc, doc.name);
        downloadCount++;
        if (downloadCount === documents.length) {
          showToast(`Se descargaron ${documents.length} documentos`, 'success');
        }
      }, index * 300);
    });

  } catch (error) {
    console.error('Error downloading all PDFs:', error);
    showToast('Error al descargar los documentos', 'error');
  }
}

// Función para abrir el editor de correcciones (v2 con soporte para nuevas categorías)
function openCorrectionEditor(org, type, key, parentModal) {
  // Obtener el ítem de corrección específico para mostrar el mensaje del admin
  const correctionItem = org.corrections?.items?.find(item => {
    const itemKey = item.field || item.memberId || item.docType || item.label;
    return item.category === type && itemKey === key;
  });
  const adminMessage = correctionItem?.message || 'Requiere corrección';

  // Labels para campos de datos generales
  const fieldLabels = {
    'organizationName': 'Nombre de la organización',
    'name': 'Nombre de la organización',
    'address': 'Dirección',
    'commune': 'Comuna',
    'comuna': 'Comuna',
    'region': 'Región',
    'neighborhood': 'Unidad Vecinal',
    'unidadVecinal': 'Unidad Vecinal',
    'email': 'Email',
    'contactEmail': 'Email de contacto',
    'phone': 'Teléfono',
    'contactPhone': 'Teléfono de contacto',
    'description': 'Descripción',
    'objectives': 'Objetivos',
    'Descripción': 'Descripción',
    'Objetivos': 'Objetivos'
  };

  // Labels para cargos del directorio
  const roleLabels = {
    'president': 'Presidente',
    'secretary': 'Secretario',
    'treasurer': 'Tesorero',
    'director': 'Director'
  };

  // Helper para extraer nombre de miembro
  const extractMemberName = (m) => {
    if (!m) return 'Sin nombre';
    if (m.primerNombre) {
      const fn = [m.primerNombre, m.segundoNombre].filter(Boolean).join(' ');
      const ln = [m.apellidoPaterno, m.apellidoMaterno].filter(Boolean).join(' ');
      return (fn + ' ' + ln).trim() || 'Sin nombre';
    }
    if (m.firstName) return `${m.firstName} ${m.lastName || ''}`.trim();
    return m.name || m.nombre || 'Sin nombre';
  };

  // ═══════════════════════════════════════════════════════════════
  // CATEGORÍA: DATOS GENERALES (organizationName, address, description, etc.)
  // ═══════════════════════════════════════════════════════════════
  if (type === 'datos_generales' || type === 'field') {
    // Mapear key a campo real de la organización
    const fieldMapping = {
      'Nombre': 'organizationName',
      'Dirección': 'address',
      'Comuna': 'comuna',
      'Email': 'contactEmail',
      'Teléfono': 'contactPhone',
      'Descripción': 'description',
      'Objetivos': 'objectives'
    };
    const actualField = fieldMapping[key] || key;
    const currentValue = org[actualField] || org.organization?.[actualField] || '';
    const label = fieldLabels[key] || fieldLabels[actualField] || key;

    const editModal = document.createElement('div');
    editModal.className = 'correction-edit-modal-overlay';
    editModal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200001; display: flex; align-items: center; justify-content: center; padding: 20px;';

    const isTextArea = actualField === 'description' || actualField === 'objectives' || key === 'Descripción' || key === 'Objetivos';

    editModal.innerHTML = `
      <div class="correction-edit-modal" style="background: white; border-radius: 16px; width: 100%; max-width: 500px; box-shadow: 0 25px 50px rgba(0,0,0,0.25); overflow: hidden;">
        <div class="correction-edit-header" style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);">
          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: white;">✏️ Editar: ${label}</h3>
          <button class="modal-close-btn" style="background: rgba(255,255,255,0.2); border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 20px; color: white; display: flex; align-items: center; justify-content: center;">&times;</button>
        </div>
        <div class="correction-edit-body" style="padding: 24px;">
          <!-- Observación del admin -->
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
            <div style="display: flex; align-items: flex-start; gap: 10px;">
              <span style="font-size: 18px;">⚠️</span>
              <div>
                <strong style="color: #92400e; font-size: 13px;">Observación del revisor:</strong>
                <p style="margin: 4px 0 0; color: #78350f; font-size: 14px;">${adminMessage}</p>
              </div>
            </div>
          </div>

          <!-- Valor actual -->
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-weight: 600; color: #374151; font-size: 13px; margin-bottom: 6px;">Valor enviado anteriormente:</label>
            <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; color: #64748b; font-size: 14px; ${isTextArea ? 'max-height: 100px; overflow-y: auto;' : ''}">${currentValue || '<em style="color: #94a3b8;">(vacío)</em>'}</div>
          </div>

          <!-- Nuevo valor -->
          <div>
            <label style="display: block; font-weight: 600; color: #374151; font-size: 13px; margin-bottom: 6px;">Nuevo valor corregido: <span style="color: #dc2626;">*</span></label>
            ${isTextArea ?
              `<textarea id="correction-new-value" style="width: 100%; min-height: 120px; padding: 12px; border: 2px solid #3b82f6; border-radius: 8px; font-size: 14px; resize: vertical; box-sizing: border-box;">${currentValue}</textarea>` :
              `<input type="text" id="correction-new-value" style="width: 100%; padding: 12px; border: 2px solid #3b82f6; border-radius: 8px; font-size: 14px; box-sizing: border-box;" value="${currentValue}">`
            }
          </div>
        </div>
        <div class="correction-edit-footer" style="padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; gap: 12px; justify-content: flex-end; background: #f8fafc;">
          <button class="btn-cancel-edit" style="padding: 10px 20px; background: #f1f5f9; color: #64748b; border: none; border-radius: 8px; font-weight: 500; cursor: pointer;">Cancelar</button>
          <button class="btn-save-edit" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">✓ Guardar Corrección</button>
        </div>
      </div>
    `;

    document.body.appendChild(editModal);

    editModal.querySelector('.modal-close-btn').addEventListener('click', () => editModal.remove());
    editModal.querySelector('.btn-cancel-edit').addEventListener('click', () => editModal.remove());
    editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.remove(); });

    editModal.querySelector('.btn-save-edit').addEventListener('click', async () => {
      const newValue = document.getElementById('correction-new-value').value.trim();
      if (!newValue) {
        showToast('El valor no puede estar vacío', 'error');
        return;
      }

      // Preparar datos para actualizar
      const updateData = {};
      updateData[actualField] = newValue;

      // Marcar este campo como corregido por el usuario
      if (!org.userCorrectedFields) org.userCorrectedFields = {};
      if (!org.userCorrectedFields[type]) org.userCorrectedFields[type] = {};
      org.userCorrectedFields[type][key] = {
        correctedAt: new Date().toISOString(),
        newValue: newValue
      };
      updateData.userCorrectedFields = org.userCorrectedFields;

      try {
        await organizationsService.update(org.id || org._id, updateData);
        org[actualField] = newValue;
        showToast('Campo actualizado correctamente', 'success');
        editModal.remove();
        parentModal.remove();
        viewOrganization(org.id || org._id, true);
      } catch (error) {
        console.error('Error al guardar corrección:', error);
        showToast('Error al guardar: ' + (error.message || 'Error desconocido'), 'error');
      }
    });

  // ═══════════════════════════════════════════════════════════════
  // CATEGORÍA: DIRECTORIO (president, secretary, treasurer, additionalMembers)
  // ═══════════════════════════════════════════════════════════════
  } else if (type === 'directorio') {
    // Usar provisionalDirectorio o buscar alternativas
    let dir = org.provisionalDirectorio || {};

    // Si provisionalDirectorio está vacío, intentar construirlo desde org.members
    const dirIsEmpty = !dir.president && !dir.secretary && !dir.treasurer && (!dir.additionalMembers || dir.additionalMembers.length === 0);

    if (dirIsEmpty && org.members && org.members.length > 0) {
      // Buscar miembros con roles de directorio
      const president = org.members.find(m => m.role === 'president');
      const secretary = org.members.find(m => m.role === 'secretary');
      const treasurer = org.members.find(m => m.role === 'treasurer');
      const directors = org.members.filter(m => m.role === 'director');

      if (president || secretary || treasurer || directors.length > 0) {
        dir = {
          president: president || null,
          secretary: secretary || null,
          treasurer: treasurer || null,
          additionalMembers: directors
        };
        console.log('Directorio construido desde members:', dir);
      }
    }

    let member = null;
    let memberPath = '';
    let role = 'member';

    // Normalizar RUT para comparación (quitar puntos y guión, lowercase)
    const normalizeRut = (rut) => {
      if (!rut) return '';
      return rut.replace(/[.\-]/g, '').toLowerCase();
    };

    const keyNormalized = normalizeRut(key);
    const keyLower = key.toLowerCase().trim();

    // ═══ BÚSQUEDA 1: Por RUT (formato más común desde admin) ═══
    // El admin envía memberId = m.rut || cargo, así que es probable que key sea un RUT
    const isRutFormat = /^\d{7,8}[\dkK]$/i.test(keyNormalized) || /^\d{1,2}\.\d{3}\.\d{3}[-]?[\dkK]$/i.test(key);
    console.log('¿Es formato RUT?:', isRutFormat, '- Key normalizado:', keyNormalized);

    if (isRutFormat || key.includes('.') || key.includes('-')) {
      // Buscar por RUT en presidente, secretario, tesorero
      for (const roleKey of ['president', 'secretary', 'treasurer']) {
        if (dir[roleKey] && dir[roleKey].rut) {
          const memberRutNorm = normalizeRut(dir[roleKey].rut);
          console.log(`Comparando RUT con ${roleKey}:`, memberRutNorm, 'vs', keyNormalized);
          if (memberRutNorm === keyNormalized) {
            member = dir[roleKey];
            memberPath = roleKey;
            role = roleKey;
            console.log('Encontrado por RUT en', roleKey);
            break;
          }
        }
      }

      // Si no encontró, buscar en miembros adicionales por RUT
      if (!member && dir.additionalMembers && dir.additionalMembers.length > 0) {
        const idx = dir.additionalMembers.findIndex(m => {
          const memberRutNorm = normalizeRut(m.rut);
          return memberRutNorm === keyNormalized;
        });
        if (idx !== -1) {
          member = dir.additionalMembers[idx];
          memberPath = `additionalMembers.${idx}`;
          role = 'director';
          console.log('Encontrado en additionalMembers por RUT:', idx);
        }
      }
    }

    // ═══ BÚSQUEDA 2: Por rol directo (en inglés o español) ═══
    if (!member) {
      const directRoleMap = {
        'president': 'president',
        'secretary': 'secretary',
        'treasurer': 'treasurer',
        'presidente': 'president',
        'secretario': 'secretary',
        'tesorero': 'treasurer'
      };

      if (directRoleMap[keyLower]) {
        role = directRoleMap[keyLower];
        memberPath = role;
        member = dir[role];
        console.log('Búsqueda directa por rol:', role, '-> Encontrado:', !!member);
      }
    }

    // ═══ BÚSQUEDA 3: Formato "Rol: Nombre" ═══
    if (!member) {
      const roleMatch = key.match(/^(Presidente|Secretario|Tesorero|Director\s*\d*):\s*(.+)$/i);
      console.log('Regex roleMatch:', roleMatch);

      if (roleMatch) {
        const roleText = roleMatch[1].toLowerCase();
        const memberName = roleMatch[2];

        if (roleText === 'presidente') role = 'president';
        else if (roleText === 'secretario') role = 'secretary';
        else if (roleText === 'tesorero') role = 'treasurer';
        else if (roleText.startsWith('director')) role = 'director';

        console.log('Rol extraído:', role, 'Nombre extraído:', memberName);

        if (role !== 'director' && dir[role]) {
          member = dir[role];
          memberPath = role;
          console.log('Encontrado por rol después de regex:', !!member);
        } else if (dir.additionalMembers && dir.additionalMembers.length > 0) {
          const idx = dir.additionalMembers.findIndex(m => {
            const name = extractMemberName(m);
            return name.toLowerCase().includes(memberName.toLowerCase().split(' ')[0]);
          });
          if (idx !== -1) {
            member = dir.additionalMembers[idx];
            memberPath = `additionalMembers.${idx}`;
            console.log('Encontrado en additionalMembers:', idx);
          }
        }
      }
    }

    // ═══ BÚSQUEDA 4: Por nombre en todos los miembros del directorio ═══
    if (!member) {
      const searchName = key.toLowerCase();
      console.log('Búsqueda por nombre:', searchName);

      for (const roleKey of ['president', 'secretary', 'treasurer']) {
        if (dir[roleKey]) {
          const name = extractMemberName(dir[roleKey]).toLowerCase();
          console.log(`Comparando con ${roleKey}:`, name);
          if (name.includes(searchName) || searchName.includes(name.split(' ')[0])) {
            member = dir[roleKey];
            memberPath = roleKey;
            role = roleKey;
            console.log('Encontrado por nombre en', roleKey);
            break;
          }
        }
      }

      if (!member && dir.additionalMembers && dir.additionalMembers.length > 0) {
        const idx = dir.additionalMembers.findIndex(m => {
          const name = extractMemberName(m).toLowerCase();
          return name.includes(searchName) || searchName.includes(name.split(' ')[0]);
        });
        if (idx !== -1) {
          member = dir.additionalMembers[idx];
          memberPath = `additionalMembers.${idx}`;
          role = 'director';
          console.log('Encontrado en additionalMembers por nombre:', idx);
        }
      }
    }

    // ═══ BÚSQUEDA 5: En org.members si el directorio está vacío ═══
    if (!member) {
      console.log('Último intento - buscando en org.members');
      const orgMembers = org.members || [];

      // Buscar por RUT en org.members
      if (isRutFormat || key.includes('.') || key.includes('-')) {
        const foundMember = orgMembers.find(m => normalizeRut(m.rut) === keyNormalized);
        if (foundMember) {
          member = foundMember;
          memberPath = 'members_by_rut';
          role = foundMember.role || 'member';
          console.log('Encontrado en org.members por RUT');
        }
      }

      // Buscar por role en org.members
      if (!member) {
        const roleMap = { 'president': 'president', 'presidente': 'president', 'secretary': 'secretary', 'secretario': 'secretary', 'treasurer': 'treasurer', 'tesorero': 'treasurer' };
        const targetRole = roleMap[keyLower];
        if (targetRole) {
          const foundMember = orgMembers.find(m => m.role === targetRole);
          if (foundMember) {
            member = foundMember;
            memberPath = 'members_by_role';
            role = targetRole;
            console.log('Encontrado en org.members por role');
          }
        }
      }
    }

    // ═══ BÚSQUEDA 6: Usando correctionItem.role del admin ═══
    if (!member && correctionItem?.role) {
      console.log('Búsqueda usando correctionItem.role:', correctionItem.role);
      const roleFromCorrection = correctionItem.role.toLowerCase();
      const roleMapping = {
        'presidente': 'president',
        'secretario': 'secretary',
        'tesorero': 'treasurer',
        'director': 'director'
      };

      const targetRole = roleMapping[roleFromCorrection] || roleFromCorrection;
      console.log('Target role mapeado:', targetRole);

      if (targetRole !== 'director' && dir[targetRole]) {
        member = dir[targetRole];
        memberPath = targetRole;
        role = targetRole;
        console.log('Encontrado usando correctionItem.role en dir');
      } else if (targetRole === 'director' && dir.additionalMembers?.length > 0) {
        // Si es director, buscar por nombre en additionalMembers
        const searchName = correctionItem.memberName?.toLowerCase() || '';
        if (searchName) {
          const idx = dir.additionalMembers.findIndex(m => {
            const name = extractMemberName(m).toLowerCase();
            return name.includes(searchName.split(' ')[0]) || searchName.includes(name.split(' ')[0]);
          });
          if (idx !== -1) {
            member = dir.additionalMembers[idx];
            memberPath = `additionalMembers.${idx}`;
            role = 'director';
            console.log('Encontrado director en additionalMembers:', idx);
          }
        } else {
          // Tomar el primer director disponible
          member = dir.additionalMembers[0];
          memberPath = 'additionalMembers.0';
          role = 'director';
          console.log('Tomando primer director disponible');
        }
      }

      // Si aún no encontró, buscar en org.members por role
      if (!member) {
        const orgMembers = org.members || [];
        const foundMember = orgMembers.find(m => m.role === targetRole);
        if (foundMember) {
          member = foundMember;
          memberPath = 'members_by_correction_role';
          role = targetRole;
          console.log('Encontrado en org.members usando correctionItem.role');
        }
      }
    }

    // Obtener lista de miembros disponibles para asignar a cargos
    const availableMembers = (org.members || []).filter(m => {
      // Excluir miembros que ya tienen cargo en el directorio
      const memberRut = m.rut || '';
      const isPresident = dir.president?.rut === memberRut;
      const isSecretary = dir.secretary?.rut === memberRut;
      const isTreasurer = dir.treasurer?.rut === memberRut;
      const isAdditional = (dir.additionalMembers || []).some(am => am?.rut === memberRut);
      return !isPresident && !isSecretary && !isTreasurer && !isAdditional;
    });

    // Generar opciones de miembros disponibles
    const memberOptionsHTML = availableMembers.map(m => {
      const name = extractMemberName(m);
      return `<option value="${m.rut || ''}" data-member='${JSON.stringify(m).replace(/'/g, "&#39;")}'>${name} - ${m.rut || 'Sin RUT'}</option>`;
    }).join('');

    // Generar HTML del directorio actual
    const generateCargoCard = (cargoKey, cargoLabel, currentMember, isAdditional = false, additionalIndex = -1) => {
      const name = currentMember ? extractMemberName(currentMember) : 'Sin asignar';
      const rut = currentMember?.rut || '';
      const memberRole = currentMember?.role || currentMember?.cargo || '';
      const hasCorrection = correctionItem?.role?.toLowerCase() === cargoLabel.toLowerCase() ||
                           (correctionItem?.memberId && currentMember?.rut === correctionItem.memberId);

      // Íconos según el cargo
      const getIcon = (key) => {
        const icons = { 'president': '👑', 'secretary': '📝', 'treasurer': '💰', 'director': '⭐', 'vocal': '🗳️' };
        return icons[key] || '👤';
      };

      const dataAttr = isAdditional ? `data-cargo="additional_${additionalIndex}" data-index="${additionalIndex}"` : `data-cargo="${cargoKey}"`;

      return `
        <div class="cargo-card ${isAdditional ? 'additional' : ''}" ${dataAttr} style="background: ${hasCorrection ? '#fef2f2' : '#f8fafc'}; border: 2px solid ${hasCorrection ? '#f87171' : '#e2e8f0'}; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">${getIcon(cargoKey)}</span>
              <strong style="color: #1e293b; font-size: 15px;">${cargoLabel}</strong>
              ${hasCorrection ? '<span style="background: #dc2626; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">CORREGIR</span>' : ''}
            </div>
          </div>

          ${currentMember ? `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <div style="flex: 1;">
                  <p style="margin: 0; font-weight: 600; color: #334155;">${name}</p>
                  <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">RUT: ${rut || 'No especificado'}</p>
                </div>
                <div style="display: flex; gap: 6px; flex-shrink: 0;">
                  <button class="btn-edit-member-data" ${dataAttr} style="padding: 6px 10px; background: #e0f2fe; color: #0369a1; border: none; border-radius: 6px; font-size: 11px; cursor: pointer; white-space: nowrap;">
                    ✏️ Editar datos
                  </button>
                  <button class="${isAdditional ? 'btn-remove-additional' : 'btn-remove-cargo'}" ${dataAttr} style="padding: 6px 10px; background: #fee2e2; color: #dc2626; border: none; border-radius: 6px; font-size: 11px; cursor: pointer;">
                    ✕ Quitar
                  </button>
                </div>
              </div>
            </div>
          ` : `
            <div style="background: #fef3c7; border: 1px dashed #f59e0b; border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 12px;">
              <p style="margin: 0; color: #92400e; font-size: 13px;">⚠️ Cargo sin asignar</p>
            </div>
          `}

          ${!isAdditional ? `
            <div style="display: flex; gap: 8px; align-items: center;">
              <select class="select-new-member" data-cargo="${cargoKey}" style="flex: 1; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 13px; cursor: pointer;">
                <option value="">-- Seleccionar otro miembro --</option>
                ${memberOptionsHTML}
              </select>
              <button class="btn-assign-cargo" data-cargo="${cargoKey}" style="padding: 10px 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;">
                Asignar
              </button>
            </div>
          ` : ''}
        </div>
      `;
    };

    // Labels de cargos adicionales
    const getAdditionalCargoLabel = (member, index) => {
      const role = member?.role || member?.cargo || '';
      const roleLabelsMap = {
        'director': 'Director',
        'vocal': 'Vocal',
        'director_1': 'Director 1',
        'director_2': 'Director 2',
        'director_3': 'Director 3',
        'primer_director': 'Primer Director',
        'segundo_director': 'Segundo Director',
        'tercer_director': 'Tercer Director'
      };
      return roleLabelsMap[role?.toLowerCase()] || role || `Director ${index + 1}`;
    };

    const editModal = document.createElement('div');
    editModal.className = 'correction-edit-modal-overlay';
    editModal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200001; display: flex; align-items: center; justify-content: center; padding: 20px;';
    editModal.innerHTML = `
      <div class="correction-edit-modal" style="background: white; border-radius: 16px; width: 100%; max-width: 650px; max-height: 90vh; box-shadow: 0 25px 50px rgba(0,0,0,0.25); overflow: hidden; display: flex; flex-direction: column;">
        <div class="correction-edit-header" style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); flex-shrink: 0;">
          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: white;">👥 Gestionar Directorio Provisorio</h3>
          <button class="modal-close-btn" style="background: rgba(255,255,255,0.2); border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 20px; color: white;">&times;</button>
        </div>

        <div class="correction-edit-body" style="padding: 24px; overflow-y: auto; flex: 1;">
          <!-- Observación del admin -->
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
            <div style="display: flex; align-items: flex-start; gap: 10px;">
              <span style="font-size: 18px;">⚠️</span>
              <div>
                <strong style="color: #92400e; font-size: 13px;">Observación del revisor:</strong>
                <p style="margin: 4px 0 0; color: #78350f; font-size: 14px;">${adminMessage}</p>
              </div>
            </div>
          </div>

          <!-- Info -->
          <div style="background: #eff6ff; border: 1px solid #93c5fd; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #1e40af; font-size: 13px;">
              <strong>💡 Instrucciones:</strong> Puede quitar miembros de sus cargos, asignar nuevos miembros, o intercambiar posiciones. Los cambios se guardarán al presionar "Guardar Cambios".
            </p>
          </div>

          <!-- Directorio -->
          <div id="directorio-cards">
            ${generateCargoCard('president', 'Presidente', dir.president)}
            ${generateCargoCard('secretary', 'Secretario', dir.secretary)}
            ${generateCargoCard('treasurer', 'Tesorero', dir.treasurer)}
          </div>

          <!-- Directores adicionales -->
          <div id="directorio-additional" style="margin-top: 16px; padding-top: 16px; border-top: 2px dashed #e2e8f0; ${!(dir.additionalMembers && dir.additionalMembers.length > 0) ? 'display:none;' : ''}">
            <h4 style="margin: 0 0 12px; font-size: 14px; color: #64748b;">Directores Adicionales</h4>
            <div id="additional-cards">
              ${(dir.additionalMembers || []).map((m, idx) =>
                generateCargoCard(`additional_${idx}`, getAdditionalCargoLabel(m, idx), m, true, idx)
              ).join('')}
            </div>
          </div>
        </div>

        <div class="correction-edit-footer" style="padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; gap: 12px; justify-content: flex-end; background: #f8fafc; flex-shrink: 0;">
          <button class="btn-cancel-edit" style="padding: 10px 20px; background: #f1f5f9; color: #64748b; border: none; border-radius: 8px; font-weight: 500; cursor: pointer;">Cancelar</button>
          <button class="btn-save-directorio" style="padding: 10px 24px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">✓ Guardar Cambios</button>
        </div>
      </div>
    `;

    document.body.appendChild(editModal);

    // Estado local del directorio para modificaciones
    let localDir = {
      president: dir.president ? { ...dir.president } : null,
      secretary: dir.secretary ? { ...dir.secretary } : null,
      treasurer: dir.treasurer ? { ...dir.treasurer } : null,
      additionalMembers: (dir.additionalMembers || []).map(m => ({ ...m }))
    };

    // Función para actualizar la vista
    const updateView = () => {
      // Actualizar cargos principales
      const container = editModal.querySelector('#directorio-cards');
      container.innerHTML = `
        ${generateCargoCard('president', 'Presidente', localDir.president)}
        ${generateCargoCard('secretary', 'Secretario', localDir.secretary)}
        ${generateCargoCard('treasurer', 'Tesorero', localDir.treasurer)}
      `;

      // Actualizar directores adicionales
      const additionalContainer = editModal.querySelector('#additional-cards');
      const additionalSection = editModal.querySelector('#directorio-additional');
      if (additionalContainer && additionalSection) {
        if (localDir.additionalMembers && localDir.additionalMembers.length > 0) {
          additionalSection.style.display = '';
          additionalContainer.innerHTML = localDir.additionalMembers.map((m, idx) =>
            generateCargoCard(`additional_${idx}`, getAdditionalCargoLabel(m, idx), m, true, idx)
          ).join('');
        } else {
          additionalSection.style.display = 'none';
        }
      }

      attachCargoListeners();
    };

    // Función para abrir sub-modal de edición de datos del miembro
    const openEditMemberDataModal = (cargoKey, isAdditional, additionalIndex) => {
      let member;
      let cargoLabel;

      if (isAdditional) {
        member = localDir.additionalMembers[additionalIndex];
        cargoLabel = getAdditionalCargoLabel(member, additionalIndex);
      } else {
        member = localDir[cargoKey];
        cargoLabel = cargoKey === 'president' ? 'Presidente' : cargoKey === 'secretary' ? 'Secretario' : 'Tesorero';
      }

      if (!member) {
        showToast('No hay miembro para editar', 'warning');
        return;
      }

      const subModal = document.createElement('div');
      subModal.className = 'correction-edit-modal-overlay';
      subModal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:300001;';
      subModal.innerHTML = `
        <div style="background:white;border-radius:16px;width:95%;max-width:450px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
          <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;font-size:18px;color:#1e293b;">Editar Datos - ${cargoLabel}</h3>
            <button class="sub-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;padding:4px;">&times;</button>
          </div>
          <div style="padding:24px;overflow-y:auto;">
            <div style="display:grid;gap:16px;">
              <div>
                <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">RUT</label>
                <input type="text" id="edit-member-rut" value="${member.rut || ''}" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box;">
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                  <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Primer Nombre</label>
                  <input type="text" id="edit-member-firstName" value="${member.firstName || ''}" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box;">
                </div>
                <div>
                  <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Segundo Nombre</label>
                  <input type="text" id="edit-member-segundoNombre" value="${member.segundoNombre || ''}" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box;">
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                  <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Apellido Paterno</label>
                  <input type="text" id="edit-member-lastName" value="${member.lastName || ''}" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box;">
                </div>
                <div>
                  <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Apellido Materno</label>
                  <input type="text" id="edit-member-apellidoMaterno" value="${member.apellidoMaterno || ''}" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box;">
                </div>
              </div>
              <div>
                <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Email</label>
                <input type="email" id="edit-member-email" value="${member.email || ''}" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box;">
              </div>
              <div>
                <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Teléfono</label>
                <input type="tel" id="edit-member-phone" value="${member.phone || ''}" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box;">
              </div>
            </div>
          </div>
          <div style="padding:16px 24px;border-top:1px solid #e2e8f0;display:flex;gap:12px;justify-content:flex-end;">
            <button class="btn-cancel-sub" style="padding:10px 20px;background:#f1f5f9;color:#64748b;border:none;border-radius:8px;font-weight:500;cursor:pointer;">Cancelar</button>
            <button class="btn-save-member-data" style="padding:10px 20px;background:#3b82f6;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Guardar</button>
          </div>
        </div>
      `;

      document.body.appendChild(subModal);

      // Event listeners
      subModal.querySelector('.sub-modal-close').addEventListener('click', () => subModal.remove());
      subModal.querySelector('.btn-cancel-sub').addEventListener('click', () => subModal.remove());
      subModal.addEventListener('click', (e) => { if (e.target === subModal) subModal.remove(); });

      subModal.querySelector('.btn-save-member-data').addEventListener('click', () => {
        const newData = {
          rut: subModal.querySelector('#edit-member-rut').value.trim(),
          firstName: subModal.querySelector('#edit-member-firstName').value.trim(),
          segundoNombre: subModal.querySelector('#edit-member-segundoNombre').value.trim(),
          lastName: subModal.querySelector('#edit-member-lastName').value.trim(),
          apellidoMaterno: subModal.querySelector('#edit-member-apellidoMaterno').value.trim(),
          email: subModal.querySelector('#edit-member-email').value.trim(),
          phone: subModal.querySelector('#edit-member-phone').value.trim()
        };

        if (!newData.firstName || !newData.lastName) {
          showToast('Nombre y apellido paterno son obligatorios', 'warning');
          return;
        }

        // Actualizar miembro en localDir
        if (isAdditional) {
          localDir.additionalMembers[additionalIndex] = { ...localDir.additionalMembers[additionalIndex], ...newData };
        } else {
          localDir[cargoKey] = { ...localDir[cargoKey], ...newData };
        }

        subModal.remove();
        updateView();
        showToast('Datos actualizados', 'success');
      });
    };

    // Función para adjuntar listeners
    const attachCargoListeners = () => {
      // Botones de quitar cargo principal
      editModal.querySelectorAll('.btn-remove-cargo').forEach(btn => {
        btn.addEventListener('click', () => {
          const cargo = btn.dataset.cargo;
          localDir[cargo] = null;
          updateView();
        });
      });

      // Botones de asignar cargo
      editModal.querySelectorAll('.btn-assign-cargo').forEach(btn => {
        btn.addEventListener('click', () => {
          const cargo = btn.dataset.cargo;
          const select = editModal.querySelector(`.select-new-member[data-cargo="${cargo}"]`);
          const selectedOption = select.selectedOptions[0];

          if (!selectedOption || !selectedOption.value) {
            showToast('Seleccione un miembro', 'warning');
            return;
          }

          try {
            const memberData = JSON.parse(selectedOption.dataset.member.replace(/&#39;/g, "'"));
            localDir[cargo] = { ...memberData, role: cargo };
            updateView();
            showToast(`${memberData.firstName || 'Miembro'} asignado como ${cargo === 'president' ? 'Presidente' : cargo === 'secretary' ? 'Secretario' : 'Tesorero'}`, 'success');
          } catch (e) {
            console.error('Error parsing member data:', e);
            showToast('Error al asignar miembro', 'error');
          }
        });
      });

      // Botones de quitar adicionales
      editModal.querySelectorAll('.btn-remove-additional').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.index);
          localDir.additionalMembers.splice(idx, 1);
          updateView();
        });
      });

      // Botones de editar datos del miembro
      editModal.querySelectorAll('.btn-edit-member-data').forEach(btn => {
        btn.addEventListener('click', () => {
          const cargoKey = btn.dataset.cargo;
          const isAdditional = cargoKey && cargoKey.startsWith('additional_');
          const additionalIndex = isAdditional ? parseInt(btn.dataset.index) : -1;
          openEditMemberDataModal(isAdditional ? null : cargoKey, isAdditional, additionalIndex);
        });
      });
    };

    // Attach initial listeners
    attachCargoListeners();

    editModal.querySelector('.modal-close-btn').addEventListener('click', () => editModal.remove());
    editModal.querySelector('.btn-cancel-edit').addEventListener('click', () => editModal.remove());
    editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.remove(); });

    // Guardar cambios
    editModal.querySelector('.btn-save-directorio').addEventListener('click', async () => {
      // Validar que haya al menos presidente
      if (!localDir.president) {
        showToast('Debe asignar al menos un Presidente', 'error');
        return;
      }

      // Actualizar provisionalDirectorio
      org.provisionalDirectorio = {
        ...org.provisionalDirectorio,
        president: localDir.president,
        secretary: localDir.secretary,
        treasurer: localDir.treasurer,
        additionalMembers: localDir.additionalMembers
      };

      // Marcar como corregido
      if (!org.userCorrectedFields) org.userCorrectedFields = {};
      if (!org.userCorrectedFields[type]) org.userCorrectedFields[type] = {};
      org.userCorrectedFields[type][key] = {
        correctedAt: new Date().toISOString(),
        changes: 'Directorio modificado'
      };

      try {
        await organizationsService.update(org.id || org._id, {
          provisionalDirectorio: org.provisionalDirectorio,
          userCorrectedFields: org.userCorrectedFields
        });

        showToast('Directorio actualizado correctamente. El admin será notificado.', 'success');
        editModal.remove();
        parentModal.remove();
        viewOrganization(org.id || org._id, true);
      } catch (error) {
        console.error('Error al guardar directorio:', error);
        showToast('Error al guardar: ' + (error.message || 'Error desconocido'), 'error');
      }
    });

  // ═══════════════════════════════════════════════════════════════
  // CATEGORÍA: COMISIÓN ELECTORAL
  // ═══════════════════════════════════════════════════════════════
  } else if (type === 'comision_electoral' || type === 'commission') {
    // Normalizar RUT para comparación
    const normalizeRut = (rut) => {
      if (!rut) return '';
      return rut.replace(/[.\-]/g, '').toLowerCase();
    };

    const keyNormalized = normalizeRut(key);
    const commission = org.electoralCommission || org.comisionElectoral || [];
    let memberIndex = -1;

    // Búsqueda por RUT
    const isRutFormat = /^\d{7,8}[\dkK]$/i.test(keyNormalized) || /^\d{1,2}\.\d{3}\.\d{3}[-]?[\dkK]$/i.test(key);
    if (isRutFormat || key.includes('.') || key.includes('-')) {
      memberIndex = commission.findIndex(m => normalizeRut(m.rut) === keyNormalized);
    }

    // Búsqueda por nombre
    if (memberIndex === -1) {
      memberIndex = commission.findIndex(m => {
        const name = extractMemberName(m);
        return key.toLowerCase().includes(name.split(' ')[0].toLowerCase()) ||
               name.toLowerCase().includes(key.split(' ')[0].toLowerCase());
      });
    }

    // Búsqueda por formato "Miembro N"
    if (memberIndex === -1 && key.match(/miembro\s*(\d+)/i)) {
      memberIndex = parseInt(key.match(/miembro\s*(\d+)/i)[1]) - 1;
    }

    // Búsqueda por formato "Rol: Nombre"
    if (memberIndex === -1) {
      const roleMatch = key.match(/^(Presidente|Secretario|Vocal|Miembro):\s*(.+)$/i);
      if (roleMatch) {
        const memberName = roleMatch[2].toLowerCase();
        memberIndex = commission.findIndex(m => {
          const name = extractMemberName(m).toLowerCase();
          return name.includes(memberName.split(' ')[0]) || memberName.includes(name.split(' ')[0]);
        });
      }
    }

    const member = commission[memberIndex];

    if (!member) {
      console.error('Miembro de comisión no encontrado. Key:', key, 'Comisión:', JSON.stringify(commission, null, 2));
      showToast('Miembro de comisión electoral no encontrado. Revise la consola para más detalles.', 'error');
      return;
    }

    const currentName = extractMemberName(member);
    const currentRut = member.rut || '';

    const editModal = document.createElement('div');
    editModal.className = 'correction-edit-modal-overlay';
    editModal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200001; display: flex; align-items: center; justify-content: center; padding: 20px;';
    editModal.innerHTML = `
      <div class="correction-edit-modal" style="background: white; border-radius: 16px; width: 100%; max-width: 550px; box-shadow: 0 25px 50px rgba(0,0,0,0.25); overflow: hidden;">
        <div class="correction-edit-header" style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: white;">🗳️ Editar Miembro Comisión Electoral</h3>
          <button class="modal-close-btn" style="background: rgba(255,255,255,0.2); border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 20px; color: white;">&times;</button>
        </div>
        <div class="correction-edit-body" style="padding: 24px;">
          <!-- Observación del admin -->
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
            <div style="display: flex; align-items: flex-start; gap: 10px;">
              <span style="font-size: 18px;">⚠️</span>
              <div>
                <strong style="color: #92400e; font-size: 13px;">Observación del revisor:</strong>
                <p style="margin: 4px 0 0; color: #78350f; font-size: 14px;">${adminMessage}</p>
              </div>
            </div>
          </div>

          <!-- Datos actuales -->
          <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
            <strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">Datos enviados anteriormente:</strong>
            <p style="margin: 8px 0 0; color: #334155; font-size: 14px;">${currentName} - RUT: ${currentRut || 'No especificado'}</p>
          </div>

          <!-- Campos editables -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <label style="display: block; font-weight: 600; color: #374151; font-size: 13px; margin-bottom: 6px;">Primer Nombre <span style="color: #dc2626;">*</span></label>
              <input type="text" id="edit-comm-firstname" style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; box-sizing: border-box;" value="${member.firstName || member.primerNombre || ''}">
            </div>
            <div>
              <label style="display: block; font-weight: 600; color: #374151; font-size: 13px; margin-bottom: 6px;">Apellido Paterno <span style="color: #dc2626;">*</span></label>
              <input type="text" id="edit-comm-lastname" style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; box-sizing: border-box;" value="${member.lastName || member.apellidoPaterno || ''}">
            </div>
            <div style="grid-column: 1 / -1;">
              <label style="display: block; font-weight: 600; color: #374151; font-size: 13px; margin-bottom: 6px;">RUT <span style="color: #dc2626;">*</span></label>
              <input type="text" id="edit-comm-rut" style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; box-sizing: border-box;" value="${currentRut}" placeholder="12.345.678-9">
            </div>
          </div>
        </div>
        <div class="correction-edit-footer" style="padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; gap: 12px; justify-content: flex-end; background: #f8fafc;">
          <button class="btn-cancel-edit" style="padding: 10px 20px; background: #f1f5f9; color: #64748b; border: none; border-radius: 8px; font-weight: 500; cursor: pointer;">Cancelar</button>
          <button class="btn-save-edit" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">✓ Guardar Corrección</button>
        </div>
      </div>
    `;

    document.body.appendChild(editModal);

    editModal.querySelector('.modal-close-btn').addEventListener('click', () => editModal.remove());
    editModal.querySelector('.btn-cancel-edit').addEventListener('click', () => editModal.remove());
    editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.remove(); });

    editModal.querySelector('.btn-save-edit').addEventListener('click', async () => {
      const newFirstName = document.getElementById('edit-comm-firstname').value.trim();
      const newLastName = document.getElementById('edit-comm-lastname').value.trim();
      const newRut = document.getElementById('edit-comm-rut').value.trim();

      if (!newFirstName || !newLastName) {
        showToast('Nombre y apellido son requeridos', 'error');
        return;
      }

      // Actualizar miembro de comisión
      org.electoralCommission[memberIndex] = {
        ...org.electoralCommission[memberIndex],
        firstName: newFirstName,
        primerNombre: newFirstName,
        lastName: newLastName,
        apellidoPaterno: newLastName,
        rut: newRut
      };

      // Marcar como corregido
      if (!org.userCorrectedFields) org.userCorrectedFields = {};
      if (!org.userCorrectedFields[type]) org.userCorrectedFields[type] = {};
      org.userCorrectedFields[type][key] = {
        correctedAt: new Date().toISOString()
      };

      try {
        await organizationsService.update(org.id || org._id, {
          electoralCommission: org.electoralCommission,
          userCorrectedFields: org.userCorrectedFields
        });

        showToast('Miembro de comisión actualizado correctamente', 'success');
        editModal.remove();
        parentModal.remove();
        viewOrganization(org.id || org._id, true);
      } catch (error) {
        console.error('Error al guardar corrección:', error);
        showToast('Error al guardar: ' + (error.message || 'Error desconocido'), 'error');
      }
    });

  // ═══════════════════════════════════════════════════════════════
  // CATEGORÍA: MIEMBROS FUNDADORES
  // ═══════════════════════════════════════════════════════════════
  } else if (type === 'miembros' || type === 'member') {
    // Normalizar RUT para comparación
    const normalizeRut = (rut) => {
      if (!rut) return '';
      return rut.replace(/[.\-]/g, '').toLowerCase();
    };

    const keyNormalized = normalizeRut(key);
    const members = org.members || [];
    let memberIndex = -1;

    // Búsqueda por RUT normalizado
    const isRutFormat = /^\d{7,8}[\dkK]$/i.test(keyNormalized) || /^\d{1,2}\.\d{3}\.\d{3}[-]?[\dkK]$/i.test(key);
    if (isRutFormat || key.includes('.') || key.includes('-')) {
      memberIndex = members.findIndex(m => normalizeRut(m.rut) === keyNormalized);
    }

    // Búsqueda por ID o RUT exacto
    if (memberIndex === -1) {
      memberIndex = members.findIndex(m => m.rut === key || m._id === key || m.id === key);
    }

    // Búsqueda por nombre
    if (memberIndex === -1) {
      memberIndex = members.findIndex(m => {
        const name = extractMemberName(m);
        return key.toLowerCase().includes(name.split(' ')[0].toLowerCase()) ||
               name.toLowerCase().includes(key.split(' ')[0].toLowerCase());
      });
    }

    // Búsqueda por formato "Nombre Completo"
    if (memberIndex === -1) {
      const keyLower = key.toLowerCase();
      memberIndex = members.findIndex(m => {
        const name = extractMemberName(m).toLowerCase();
        return name === keyLower || keyLower.includes(name) || name.includes(keyLower);
      });
    }

    const member = members[memberIndex];

    if (!member) {
      showToast('Miembro fundador no encontrado', 'error');
      return;
    }

    const currentName = extractMemberName(member);
    const currentRut = member.rut || '';

    const editModal = document.createElement('div');
    editModal.className = 'correction-edit-modal-overlay';
    editModal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200001; display: flex; align-items: center; justify-content: center; padding: 20px;';
    editModal.innerHTML = `
      <div class="correction-edit-modal" style="background: white; border-radius: 16px; width: 100%; max-width: 550px; box-shadow: 0 25px 50px rgba(0,0,0,0.25); overflow: hidden;">
        <div class="correction-edit-header" style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: white;">👥 Editar Miembro Fundador</h3>
          <button class="modal-close-btn" style="background: rgba(255,255,255,0.2); border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 20px; color: white;">&times;</button>
        </div>
        <div class="correction-edit-body" style="padding: 24px;">
          <!-- Observación del admin -->
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
            <div style="display: flex; align-items: flex-start; gap: 10px;">
              <span style="font-size: 18px;">⚠️</span>
              <div>
                <strong style="color: #92400e; font-size: 13px;">Observación del revisor:</strong>
                <p style="margin: 4px 0 0; color: #78350f; font-size: 14px;">${adminMessage}</p>
              </div>
            </div>
          </div>

          <!-- Datos actuales -->
          <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
            <strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">Datos enviados anteriormente:</strong>
            <p style="margin: 8px 0 0; color: #334155; font-size: 14px;">${currentName} - RUT: ${currentRut || 'No especificado'}</p>
          </div>

          <!-- Campos editables -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <label style="display: block; font-weight: 600; color: #374151; font-size: 13px; margin-bottom: 6px;">Primer Nombre <span style="color: #dc2626;">*</span></label>
              <input type="text" id="edit-member-firstname" style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; box-sizing: border-box;" value="${member.firstName || member.primerNombre || ''}">
            </div>
            <div>
              <label style="display: block; font-weight: 600; color: #374151; font-size: 13px; margin-bottom: 6px;">Apellido Paterno <span style="color: #dc2626;">*</span></label>
              <input type="text" id="edit-member-lastname" style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; box-sizing: border-box;" value="${member.lastName || member.apellidoPaterno || ''}">
            </div>
            <div style="grid-column: 1 / -1;">
              <label style="display: block; font-weight: 600; color: #374151; font-size: 13px; margin-bottom: 6px;">RUT <span style="color: #dc2626;">*</span></label>
              <input type="text" id="edit-member-rut" style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; box-sizing: border-box;" value="${currentRut}" placeholder="12.345.678-9">
            </div>
          </div>
        </div>
        <div class="correction-edit-footer" style="padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; gap: 12px; justify-content: flex-end; background: #f8fafc;">
          <button class="btn-cancel-edit" style="padding: 10px 20px; background: #f1f5f9; color: #64748b; border: none; border-radius: 8px; font-weight: 500; cursor: pointer;">Cancelar</button>
          <button class="btn-save-edit" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">✓ Guardar Corrección</button>
        </div>
      </div>
    `;

    document.body.appendChild(editModal);

    editModal.querySelector('.modal-close-btn').addEventListener('click', () => editModal.remove());
    editModal.querySelector('.btn-cancel-edit').addEventListener('click', () => editModal.remove());
    editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.remove(); });

    editModal.querySelector('.btn-save-edit').addEventListener('click', async () => {
      const newFirstName = document.getElementById('edit-member-firstname').value.trim();
      const newLastName = document.getElementById('edit-member-lastname').value.trim();
      const newRut = document.getElementById('edit-member-rut').value.trim();

      if (!newFirstName || !newLastName) {
        showToast('Nombre y apellido son requeridos', 'error');
        return;
      }

      // Actualizar miembro
      org.members[memberIndex] = {
        ...org.members[memberIndex],
        firstName: newFirstName,
        primerNombre: newFirstName,
        lastName: newLastName,
        apellidoPaterno: newLastName,
        rut: newRut
      };

      // Marcar como corregido
      if (!org.userCorrectedFields) org.userCorrectedFields = {};
      if (!org.userCorrectedFields[type]) org.userCorrectedFields[type] = {};
      org.userCorrectedFields[type][key] = {
        correctedAt: new Date().toISOString()
      };

      try {
        await organizationsService.update(org.id || org._id, {
          members: org.members,
          userCorrectedFields: org.userCorrectedFields
        });

        showToast('Miembro actualizado correctamente', 'success');
        editModal.remove();
        parentModal.remove();
        viewOrganization(org.id || org._id, true);
      } catch (error) {
        console.error('Error al guardar corrección:', error);
        showToast('Error al guardar: ' + (error.message || 'Error desconocido'), 'error');
      }
    });

  // ═══════════════════════════════════════════════════════════════
  // CATEGORÍA: DOCUMENTOS Y CERTIFICADOS
  // ═══════════════════════════════════════════════════════════════
  } else if (type === 'documentos' || type === 'certificados' || type === 'document' || type === 'certificate') {
    // Por ahora mostrar mensaje - se podría implementar un file picker
    showToast('Para resubir documentos o certificados, por favor contacte al administrador o vuelva a enviar la solicitud completa', 'info');
  } else {
    // Tipo desconocido
    console.warn('Tipo de corrección desconocido:', type, key);
    showToast('Este tipo de corrección no puede editarse desde aquí', 'info');
  }
}

/**
 * Continúa el wizard para una organización aprobada por el Ministro de Fe
 * @param {string} orgId - ID de la organización
 */
function continueOrganizationWizard(orgId) {
  const org = organizationsService.getById(orgId);
  if (!org) {
    showToast('Organización no encontrada', 'error');
    return;
  }

  if (org.status !== ORG_STATUS.MINISTRO_APPROVED) {
    showToast('Esta organización no está lista para continuar', 'error');
    return;
  }

  // Crear datos del wizard basados en la organización existente
  const wizardProgress = {
    currentStep: 3, // Paso 3: Documentos (después de Ministro de Fe)
    organizationId: org.id, // Guardar referencia a la organización existente
    formData: {
      organization: org.organization || {},
      members: org.members || [],
      commission: org.commission || {
        members: [],
        electionDate: null
      },
      statutes: org.statutes || {
        type: 'template',
        content: null
      },
      documents: org.documents || {},
      certificates: org.certificates || {},
      otherDocuments: org.otherDocuments || [],
      signatures: org.signatures || {}
    },
    savedAt: new Date().toISOString()
  };

  // Guardar el progreso en localStorage para que el wizard lo cargue
  localStorage.setItem('wizardProgress', JSON.stringify(wizardProgress));

  // Redirect to React wizard
  window.location.href = '/app/wizard';
}

/**
 * Continúa una organización en estado draft (borrador)
 */
function continueDraftOrganization(orgId) {
  const org = organizationsService.getById(orgId);
  if (!org) {
    showToast('Organización no encontrada', 'error');
    return;
  }

  // Construir el progreso del wizard a partir de los datos guardados
  const wizardProgress = {
    currentStep: 1, // Empezar desde el paso 1 para revisar
    organizationId: orgId,
    formData: {
      organization: {
        type: org.organizationType,
        name: org.organizationName,
        address: org.address,
        region: org.region || 'RM',
        commune: org.comuna || 'Renca',
        territory: org.territory,
        unidadVecinal: org.unidadVecinal
      },
      members: org.members || [],
      commission: {
        members: org.electoralCommission || [],
        electionDate: org.electionDate || null
      },
      statutes: org.statutes || { type: 'template', content: null },
      documents: org.documents || {},
      certificates: org.certificates || {},
      otherDocuments: org.otherDocuments || [],
      signatures: org.signatures || {}
    },
    savedAt: new Date().toISOString()
  };

  // Guardar el progreso en localStorage para que el wizard lo cargue
  localStorage.setItem('wizardProgress', JSON.stringify(wizardProgress));

  // Redirect to React wizard
  window.location.href = `/app/wizard/${orgId}`;
}

// Exportar para uso desde el wizard
window.refreshOrganizations = renderOrganizations;
window.organizationsService = organizationsService;

// ========================================
// Historial de Cambios de Citas
// ========================================

/**
 * Muestra el modal con el historial completo de cambios de cita
 * @param {string} orgId - ID de la organización
 */
window.showAppointmentHistory = function(orgId) {
  const orgs = JSON.parse(localStorage.getItem('user_organizations') || '[]');
  const org = orgs.find(o => o.id === orgId);

  if (!org) {
    console.error('Organización no encontrada:', orgId);
    return;
  }

  const changes = org.appointmentChanges || [];
  const original = org.originalAppointment;
  const current = org.ministroData;

  // Helper para formatear fecha
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-CL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Crear modal - z-index muy alto para que aparezca encima de otros modales (org-detail-modal tiene 200000)
  const modal = document.createElement('div');
  modal.className = 'appointment-history-modal-overlay';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 300000; padding: 20px;';

  // Generar HTML del historial
  let changesHTML = '';

  if (changes.length === 0) {
    changesHTML = `
      <div style="text-align: center; padding: 40px; color: #6b7280;">
        <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
        <p>No hay cambios registrados. Esta es la cita original.</p>
      </div>
    `;
  } else {
    // Mostrar cada cambio en orden cronológico inverso (más reciente primero)
    changesHTML = changes.slice().reverse().map((change, index) => {
      const changeDate = new Date(change.changedAt);
      const changeDateFormatted = changeDate.toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      const changeTimeFormatted = changeDate.toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const changeNumber = changes.length - index;

      return `
        <div style="background: ${index === 0 ? '#fef3c7' : '#f9fafb'}; border: 2px solid ${index === 0 ? '#f59e0b' : '#e5e7eb'}; border-radius: 12px; padding: 20px; margin-bottom: 16px; ${index === 0 ? 'box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="background: ${index === 0 ? '#f59e0b' : '#6b7280'}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                ${index === 0 ? 'Cambio más reciente' : `Cambio #${changeNumber}`}
              </span>
            </div>
            <span style="font-size: 13px; color: #6b7280;">${changeDateFormatted} - ${changeTimeFormatted}</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: start;">
            <!-- Datos anteriores -->
            <div style="background: #fee2e2; border-radius: 8px; padding: 16px;">
              <h5 style="margin: 0 0 12px 0; color: #991b1b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
                Antes
              </h5>
              ${change.changes?.ministro ? `
                <p style="margin: 0 0 8px 0; font-size: 14px;">
                  <span style="color: #6b7280;">Ministro:</span><br>
                  <strong style="color: #991b1b; text-decoration: line-through;">${change.previousData?.name || '-'}</strong>
                </p>
              ` : ''}
              ${change.changes?.date ? `
                <p style="margin: 0 0 8px 0; font-size: 14px;">
                  <span style="color: #6b7280;">Fecha:</span><br>
                  <strong style="color: #991b1b; text-decoration: line-through;">${formatDate(change.previousData?.scheduledDate)}</strong>
                </p>
              ` : ''}
              ${change.changes?.time ? `
                <p style="margin: 0 0 8px 0; font-size: 14px;">
                  <span style="color: #6b7280;">Hora:</span><br>
                  <strong style="color: #991b1b; text-decoration: line-through;">${change.previousData?.scheduledTime || '-'}</strong>
                </p>
              ` : ''}
              ${change.changes?.location ? `
                <p style="margin: 0; font-size: 14px;">
                  <span style="color: #6b7280;">Lugar:</span><br>
                  <strong style="color: #991b1b; text-decoration: line-through;">${change.previousData?.location || '-'}</strong>
                </p>
              ` : ''}
            </div>

            <!-- Flecha -->
            <div style="display: flex; align-items: center; justify-content: center; padding-top: 30px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>

            <!-- Datos nuevos -->
            <div style="background: #d1fae5; border-radius: 8px; padding: 16px;">
              <h5 style="margin: 0 0 12px 0; color: #065f46; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
                Después
              </h5>
              ${change.changes?.ministro ? `
                <p style="margin: 0 0 8px 0; font-size: 14px;">
                  <span style="color: #6b7280;">Ministro:</span><br>
                  <strong style="color: #065f46;">${change.newData?.name || '-'}</strong>
                </p>
              ` : ''}
              ${change.changes?.date ? `
                <p style="margin: 0 0 8px 0; font-size: 14px;">
                  <span style="color: #6b7280;">Fecha:</span><br>
                  <strong style="color: #065f46;">${formatDate(change.newData?.scheduledDate)}</strong>
                </p>
              ` : ''}
              ${change.changes?.time ? `
                <p style="margin: 0 0 8px 0; font-size: 14px;">
                  <span style="color: #6b7280;">Hora:</span><br>
                  <strong style="color: #065f46;">${change.newData?.scheduledTime || '-'}</strong>
                </p>
              ` : ''}
              ${change.changes?.location ? `
                <p style="margin: 0; font-size: 14px;">
                  <span style="color: #6b7280;">Lugar:</span><br>
                  <strong style="color: #065f46;">${change.newData?.location || '-'}</strong>
                </p>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // HTML de la cita original
  let originalHTML = '';
  if (original) {
    const originalDateFormatted = original.assignedAt
      ? new Date(original.assignedAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
      : '-';

    originalHTML = `
      <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #2563eb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="width: 40px; height: 40px; background: #2563eb; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">📌</div>
          <div>
            <h4 style="margin: 0; color: #1e40af; font-size: 16px; font-weight: 700;">Cita Original</h4>
            <p style="margin: 2px 0 0; color: #2563eb; font-size: 13px;">Asignada el ${originalDateFormatted}</p>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
          <div style="background: white; padding: 12px; border-radius: 8px;">
            <span style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Ministro de Fe</span>
            <p style="margin: 4px 0 0; font-weight: 600; color: #1e40af;">${original.name}</p>
          </div>
          <div style="background: white; padding: 12px; border-radius: 8px;">
            <span style="font-size: 11px; color: #6b7280; text-transform: uppercase;">RUT</span>
            <p style="margin: 4px 0 0; font-weight: 600; color: #1e40af;">${original.rut || '-'}</p>
          </div>
          <div style="background: white; padding: 12px; border-radius: 8px;">
            <span style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Fecha</span>
            <p style="margin: 4px 0 0; font-weight: 600; color: #1e40af;">${formatDate(original.scheduledDate)}</p>
          </div>
          <div style="background: white; padding: 12px; border-radius: 8px;">
            <span style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Hora</span>
            <p style="margin: 4px 0 0; font-weight: 600; color: #1e40af;">${original.scheduledTime}</p>
          </div>
          <div style="background: white; padding: 12px; border-radius: 8px; grid-column: 1 / -1;">
            <span style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Lugar</span>
            <p style="margin: 4px 0 0; font-weight: 600; color: #1e40af;">${original.location}</p>
          </div>
        </div>
      </div>
    `;
  }

  // HTML de la cita actual
  let currentHTML = '';
  if (current) {
    currentHTML = `
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="width: 40px; height: 40px; background: #10b981; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">✓</div>
          <div>
            <h4 style="margin: 0; color: #065f46; font-size: 16px; font-weight: 700;">Cita Actual (Vigente)</h4>
            <p style="margin: 2px 0 0; color: #10b981; font-size: 13px;">Esta es la cita confirmada</p>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
          <div style="background: white; padding: 12px; border-radius: 8px;">
            <span style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Ministro de Fe</span>
            <p style="margin: 4px 0 0; font-weight: 600; color: #065f46;">${current.name}</p>
          </div>
          <div style="background: white; padding: 12px; border-radius: 8px;">
            <span style="font-size: 11px; color: #6b7280; text-transform: uppercase;">RUT</span>
            <p style="margin: 4px 0 0; font-weight: 600; color: #065f46;">${current.rut || '-'}</p>
          </div>
          <div style="background: white; padding: 12px; border-radius: 8px;">
            <span style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Fecha</span>
            <p style="margin: 4px 0 0; font-weight: 600; color: #065f46;">${formatDate(current.scheduledDate)}</p>
          </div>
          <div style="background: white; padding: 12px; border-radius: 8px;">
            <span style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Hora</span>
            <p style="margin: 4px 0 0; font-weight: 600; color: #065f46;">${current.scheduledTime}</p>
          </div>
          <div style="background: white; padding: 12px; border-radius: 8px; grid-column: 1 / -1;">
            <span style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Lugar</span>
            <p style="margin: 4px 0 0; font-weight: 600; color: #065f46;">${current.location}</p>
          </div>
        </div>
      </div>
    `;
  }

  modal.innerHTML = `
    <div style="background: white; border-radius: 20px; max-width: 800px; width: 100%; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.25);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); padding: 24px; color: white;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px;">
              📜
            </div>
            <div>
              <h2 style="margin: 0; font-size: 22px; font-weight: 700;">Historial de Cambios</h2>
              <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">${org.organization?.name || 'Organización'}</p>
            </div>
          </div>
          <button id="close-history-modal" style="background: rgba(255,255,255,0.2); border: none; width: 40px; height: 40px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; transition: background 0.2s;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Body -->
      <div style="padding: 24px; overflow-y: auto; flex: 1;">
        <!-- Cita actual -->
        ${currentHTML}

        <!-- Historial de cambios -->
        ${changes.length > 0 ? `
          <h3 style="margin: 0 0 16px 0; color: #374151; font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Historial de Modificaciones (${changes.length})
          </h3>
          ${changesHTML}
        ` : ''}

        <!-- Cita original -->
        ${originalHTML}
      </div>

      <!-- Footer -->
      <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end;">
        <button id="close-history-btn" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: background 0.2s;">
          Cerrar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners para cerrar
  modal.querySelector('#close-history-modal').addEventListener('click', () => modal.remove());
  modal.querySelector('#close-history-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
};

// ========================================
// User Role UI Setup
// ========================================

function setupUserRoleUI() {
  const userData = localStorage.getItem('currentUser');
  if (!userData) {
    hideLoadingScreen();
    return;
  }

  try {
    const user = JSON.parse(userData);
    const isAdmin = user.role === 'MUNICIPALIDAD';

    if (isAdmin) {
      setupAdminUI();
    } else if (user.role === 'MIEMBRO' && sessionStorage.getItem('isDirectivoMiembro') === 'true') {
      // Directivo: misma UI que organizador
      setupUserUI();
    } else if (user.role !== 'MIEMBRO') {
      setupUserUI();
    }
  } catch (error) {
    console.error('Error setting up role UI:', error);
  }

  // Fallback: asegurar que loading screen se oculte si no se hizo antes
  hideLoadingScreen();
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById('app-loading');
  const app = document.getElementById('app');

  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
    setTimeout(() => loadingScreen.remove(), 300);
  }

  if (app) {
    app.classList.add('loaded');
  }
}

function setupAdminUI() {
  // Admin dashboard migrated to React - redirect immediately
  window.location.href = '/app/admin';
  return;

  // --- Legacy code below kept for reference but never reached ---
  console.log('🔑 Configurando UI de Administrador');

  // Ocultar hero section
  const heroSection = document.getElementById('hero-section');
  if (heroSection) heroSection.style.display = 'none';

  // Ocultar stats de usuario
  const statsSection = document.querySelector('.stats-modern');
  if (statsSection) statsSection.style.display = 'none';

  // Ocultar otras secciones de usuario en home
  const homePage = document.getElementById('page-home');
  if (homePage) {
    const sectionsToHide = [
      '.opportunities-section',
      '.search-section',
      '.quick-actions',
      '.events-section',
      '.poll-section',
      '.gallery-section',
      '.feed-section'
    ];
    sectionsToHide.forEach(selector => {
      const el = homePage.querySelector(selector);
      if (el) el.style.display = 'none';
    });
  }

  // Limpiar cualquier overlay activo antes de navegar
  const overlays = document.querySelectorAll('.overlay, .modal-overlay');
  overlays.forEach(overlay => overlay.remove());

  // Cerrar menú lateral si está abierto
  const sideNav = document.getElementById('side-nav');
  if (sideNav) sideNav.classList.remove('open');

  // Navegar automáticamente al dashboard de admin
  appState.navigateTo('admin');
  // Esperar a que el DOM se actualice antes de inicializar
  setTimeout(() => {
    adminDashboard.init();
    // Restaurar vista guardada al recargar
    const savedAdminView = sessionStorage.getItem('admin_current_view');
    if (savedAdminView) {
      adminDashboard.showView(savedAdminView);
    }
  }, 100);

  // Chevron SVG reutilizable
  const chevron = '<svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';

  // Actualizar navegación lateral para admin con secciones categorizadas
  const navList = document.querySelector('.nav-list');
  if (navList) {
    navList.innerHTML = `
      <!-- Principal -->
      <li class="nav-section-title">Principal</li>
      <li>
        <a href="#" data-admin-view="applications" class="nav-link active">
          <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span class="nav-text">Panel de Control</span>
        </a>
      </li>

      <!-- Organizaciones -->
      <li><div class="nav-section-collapsible" data-section="orgs"><span>Organizaciones</span>${chevron}</div></li>
      <li class="nav-section-items" data-section-items="orgs">
        <button class="nav-link-sub" data-admin-view="org-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/></svg>
          <span>Todas</span>
          <span class="nav-badge" id="badge-org-all">0</span>
        </button>
        <button class="nav-link-sub" data-admin-view="org-pending">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>Pendientes</span>
          <span class="nav-badge nav-badge-warning" id="badge-org-pending">0</span>
        </button>
        <button class="nav-link-sub" data-admin-view="org-process">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/></svg>
          <span>En Proceso</span>
          <span class="nav-badge nav-badge-info" id="badge-org-process">0</span>
        </button>
        <button class="nav-link-sub" data-admin-view="org-approved">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>Aprobadas</span>
          <span class="nav-badge nav-badge-success" id="badge-org-approved">0</span>
        </button>
        <button class="nav-link-sub" data-admin-view="org-rejected">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span>Rechazadas</span>
          <span class="nav-badge nav-badge-danger" id="badge-org-rejected">0</span>
        </button>
      </li>

      <!-- Gestion -->
      <li><div class="nav-section-collapsible" data-section="gestion"><span>Gestion</span>${chevron}</div></li>
      <li class="nav-section-items" data-section-items="gestion">
        <button class="nav-link-sub" data-admin-view="ministro">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>Ministros de Fe</span>
        </button>
        <button class="nav-link-sub" data-admin-view="uv">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>Unidades Vecinales</span>
        </button>
        <button class="nav-link-sub" data-admin-view="schedule">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Horarios</span>
        </button>
        <button class="nav-link-sub" data-admin-view="estatutos">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span>Estatutos</span>
        </button>
      </li>

      <!-- Configuracion -->
      <li><div class="nav-section-collapsible" data-section="config"><span>Configuracion</span>${chevron}</div></li>
      <li class="nav-section-items" data-section-items="config">
        <button class="nav-link-sub" data-admin-view="users">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          <span>Usuarios</span>
        </button>
        <button class="nav-link-sub" data-admin-view="timbre">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
          <span>Timbre y Firma</span>
        </button>
        <button class="nav-link-sub" data-admin-view="documentos">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.342a2 2 0 0 0-.602-1.43l-4.44-4.342A2 2 0 0 0 13.56 2H6a2 2 0 0 0-2 2z"/><path d="M9 13h6"/><path d="M9 17h3"/></svg>
          <span>Documentos</span>
        </button>
      </li>

      <!-- Reportes -->
      <li><div class="nav-section-collapsible" data-section="reportes"><span>Reportes</span>${chevron}</div></li>
      <li class="nav-section-items" data-section-items="reportes">
        <button class="nav-link-sub" data-admin-view="metrics">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
          <span>Metricas</span>
        </button>
        <button class="nav-link-sub" data-admin-view="calendar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Calendario</span>
        </button>
        <button class="nav-link-sub" data-admin-view="audit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span>Historial</span>
        </button>
        <button class="nav-link-sub" data-admin-view="export">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Exportar</span>
        </button>
      </li>

      <!-- Contenido -->
      <li><div class="nav-section-collapsible" data-section="contenido"><span>Contenido</span>${chevron}</div></li>
      <li class="nav-section-items" data-section-items="contenido">
        <button class="nav-link-sub" data-page="noticias">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/></svg>
          <span>Noticias</span>
        </button>
        <button class="nav-link-sub" data-page="biblioteca">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <span>Biblioteca</span>
        </button>
        <button class="nav-link-sub" data-page="guia-constitucion">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>Guia de Constitucion</span>
        </button>
      </li>

      <!-- Separador -->
      <li><div class="nav-separator"></div></li>

      <!-- Mi Perfil -->
      <li>
        <a href="#" data-page="profile" class="nav-link">
          <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span class="nav-text">Mi Perfil</span>
        </a>
      </li>
    `;

    // Click handlers para items con data-admin-view (se queda en page-admin)
    navList.querySelectorAll('[data-admin-view]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const viewName = link.dataset.adminView;
        // Asegurar que estamos en page-admin
        appState.navigateTo('admin');
        adminDashboard.showView(viewName);
        // Cerrar sidebar en movil
        const sideNavEl = document.getElementById('side-nav');
        if (sideNavEl && window.innerWidth < 1024) sideNavEl.classList.remove('open');
      });
    });

    // Click handlers para items con data-page (navega a otra pagina)
    navList.querySelectorAll('[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        if (page) {
          appState.navigateTo(page);
          if (page === 'admin') {
            adminDashboard.init();
          } else if (page === 'profile') {
            loadProfileData();
          } else if (page === 'guia-constitucion') {
            guiaConstitucionManager.init();
          } else if (page === 'biblioteca') {
            bibliotecaManager.init();
          } else if (page === 'noticias') {
            newsManager.init();
          }
          // Cerrar sidebar en movil
          const sideNavEl = document.getElementById('side-nav');
          if (sideNavEl && window.innerWidth < 1024) sideNavEl.classList.remove('open');
        }
      });
    });

    // Collapsible section handlers
    navList.querySelectorAll('.nav-section-collapsible').forEach(title => {
      title.addEventListener('click', () => {
        const sectionName = title.dataset.section;
        const items = navList.querySelector(`[data-section-items="${sectionName}"]`);
        if (items) {
          items.classList.toggle('collapsed');
          title.classList.toggle('collapsed');
        }
      });
    });
  }

  // Actualizar bottom nav para admin
  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) {
    bottomNav.innerHTML = `
      <button class="nav-item active" data-page="admin">
        <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        <span>Panel</span>
      </button>
      <button class="nav-item" data-page="profile">
        <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>Perfil</span>
      </button>
    `;

    // Re-agregar listeners
    bottomNav.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const page = item.dataset.page;
        if (page) {
          appState.navigateTo(page);
          if (page === 'admin') {
            adminDashboard.init();
          } else if (page === 'profile') {
            loadProfileData();
          }
          bottomNav.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');
        }
      });
    });
  }

  // Cambiar título del header
  const headerTitle = document.querySelector('.header-title');
  if (headerTitle) {
    headerTitle.textContent = 'Admin - Comunidad Renca';
  }
}

async function setupUserUI() {
  console.log('👤 Configurando UI de Usuario');

  // Personalizar saludo en Home
  const greeting = document.getElementById('home-greeting');
  if (greeting) {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        const firstName = user.firstName || user.profile?.firstName || '';
        if (firstName) {
          greeting.textContent = `Hola, ${firstName}`;
        }
      } catch (e) { /* ignore */ }
    }
  }

  // Pre-cargar organizaciones en la página Mis Organizaciones (non-blocking)
  // (Skip para directivos MIEMBRO: ya se cargaron desde /my-organization)
  const isDirectivoMiembro = sessionStorage.getItem('isDirectivoMiembro') === 'true';
  if (!isDirectivoMiembro) {
    renderOrganizations().catch(e => console.error('❌ Error pre-cargando organizaciones:', e));
  }

  // Inicializar menú de organizaciones aprobadas en sidebar (non-blocking)
  organizationMenuManager.init().catch(e => console.error('❌ Error inicializando menú organizaciones:', e));
}
