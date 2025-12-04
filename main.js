/**
 * Main Entry Point
 * Integra la nueva arquitectura con la UI existente
 */

import { initializeApp, appState, showToast, handleLogout } from './src/app.js';
import { WizardController } from './src/presentation/components/wizard/WizardController.js';
import { CHILE_REGIONS, getComunasByRegion } from './src/data/chile-regions.js';
import { getUserRepository } from './src/infrastructure/config/container.js';
import { organizationsService, ORG_STATUS, ORG_STATUS_LABELS, ORG_STATUS_COLORS } from './src/services/OrganizationsService.js';
import { adminDashboard } from './src/presentation/admin/AdminDashboard.js';
import { organizationDashboard } from './src/presentation/organization/OrganizationDashboard.js';
import { notificationService } from './src/services/NotificationService.js';

console.log('📦 main.js cargado');

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

// PWA Install Prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallPromotion();
});

function showInstallPromotion() {
  const installPrompt = document.createElement('div');
  installPrompt.className = 'install-prompt show';
  installPrompt.innerHTML = `
    <p>Instala la aplicación para un acceso más rápido</p>
    <button id="install-btn">Instalar</button>
    <button id="dismiss-btn" style="background: transparent; color: var(--text-secondary);">Más tarde</button>
  `;
  document.body.appendChild(installPrompt);

  document.getElementById('install-btn').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response: ${outcome}`);
      deferredPrompt = null;
      installPrompt.remove();
    }
  });

  document.getElementById('dismiss-btn').addEventListener('click', () => {
    installPrompt.remove();
  });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎯 DOM Content Loaded - Inicializando eventos...');

  // Inicializar aplicación primero
  await initializeApp();

  // Cargar usuario desde localStorage
  const currentUserData = localStorage.getItem('currentUser');
  if (currentUserData) {
    try {
      const user = JSON.parse(currentUserData);
      appState.setCurrentUser(user);
      appState.initializeAuthService();

      // Actualizar nombre en header
      const userName = document.getElementById('user-name');
      if (userName) {
        userName.textContent = user.profile?.firstName || user.email;
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
          const initials = `${(user.profile?.firstName || 'U')[0]}${(user.profile?.lastName || 'S')[0]}`.toUpperCase();
          headerInitials.textContent = initials;
        }
      }

      console.log('✅ Usuario cargado:', user);

      // Pre-cargar datos del perfil por si el usuario navega allí
      loadProfileData();
    } catch (error) {
      console.error('Error al cargar usuario:', error);
    }
  }

  // Click en logo para volver al inicio
  const logoHomeLink = document.getElementById('logo-home-link');
  if (logoHomeLink) {
    logoHomeLink.addEventListener('click', (e) => {
      e.preventDefault();
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
      const wizard = new WizardController();
      wizard.open();
    });
    console.log('✅ Comenzar ahora event listener attached');
  }

  // Botón de logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      // Limpiar localStorage
      localStorage.removeItem('currentUser');
      localStorage.removeItem('isAuthenticated');

      const result = await handleLogout();
      if (result.success) {
        showToast('Sesión cerrada correctamente', 'success');

        // Redirigir a auth
        setTimeout(() => {
          window.location.href = '/auth.html';
        }, 500);
      }
    });
  }

  // Menú lateral
  const menuBtn = document.getElementById('menu-btn');
  const sideNav = document.getElementById('side-nav');
  const closeNavBtn = document.getElementById('close-nav-btn');

  if (menuBtn && sideNav) {
    menuBtn.addEventListener('click', () => {
      sideNav.classList.add('open');
      const overlay = document.createElement('div');
      overlay.id = 'overlay';
      overlay.className = 'overlay active';
      document.body.appendChild(overlay);

      overlay.addEventListener('click', () => {
        sideNav.classList.remove('open');
        overlay.remove();
      });
    });
  }

  if (closeNavBtn) {
    closeNavBtn.addEventListener('click', () => {
      sideNav.classList.remove('open');
      const overlay = document.getElementById('overlay');
      if (overlay) overlay.remove();
    });
  }

  // Notifications Panel
  const notificationsBtn = document.getElementById('notifications-btn');
  const notificationsPanel = document.getElementById('notifications-panel');
  const notificationsList = document.getElementById('notifications-list');
  const btnMarkAllRead = document.getElementById('btn-mark-all-read');

  function loadNotifications() {
    if (!appState.currentUser) return;

    const notifications = notificationService.getByUserId(appState.currentUser.id);
    const unreadCount = notificationService.getUnreadCount(appState.currentUser.id);

    // Update badge
    const badge = document.querySelector('.notification-badge');
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
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
                     notif.type === 'status_update' ? '🔔' : '📬';

        return `
          <div class="notification-item ${notif.read ? '' : 'unread'}" data-id="${notif.id}">
            <div class="notification-content">
              <div class="notification-icon">${icon}</div>
              <div class="notification-text">
                <p class="notification-title">${notif.title}</p>
                <p class="notification-message">${notif.message}</p>
                <span class="notification-time">${timeAgo}</span>
                <div class="notification-actions">
                  ${!notif.read ? `<button class="btn-notification btn-mark-read" data-id="${notif.id}">Marcar como leída</button>` : ''}
                  <button class="btn-notification btn-delete" data-id="${notif.id}">Eliminar</button>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Add event listeners to actions
      notificationsList.querySelectorAll('.btn-mark-read').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const notifId = btn.dataset.id;
          notificationService.markAsRead(notifId);
          loadNotifications();
        });
      });

      notificationsList.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const notifId = btn.dataset.id;
          notificationService.delete(notifId);
          loadNotifications();
        });
      });
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

  if (notificationsBtn && notificationsPanel) {
    notificationsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = notificationsPanel.classList.contains('open');

      if (isOpen) {
        notificationsPanel.classList.remove('open');
      } else {
        notificationsPanel.classList.add('open');
        loadNotifications();
      }
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (!notificationsPanel.contains(e.target) && !notificationsBtn.contains(e.target)) {
        notificationsPanel.classList.remove('open');
      }
    });
  }

  if (btnMarkAllRead) {
    btnMarkAllRead.addEventListener('click', () => {
      if (appState.currentUser) {
        notificationService.markAllAsRead(appState.currentUser.id);
        loadNotifications();
        showToast('Todas las notificaciones marcadas como leídas', 'success');
      }
    });
  }

  // Load notifications on init
  if (appState.currentUser) {
    loadNotifications();
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
// Profile Page Functions
// ========================================

function loadProfileData() {
  const userData = localStorage.getItem('currentUser');
  if (!userData) {
    console.log('loadProfileData: No user data found');
    return;
  }

  try {
    const user = JSON.parse(userData);
    const profile = user.profile || {};

    console.log('loadProfileData: Loading profile for', user.email, profile);

    // Header
    const initials = `${(profile.firstName || 'U')[0]}${(profile.lastName || 'S')[0]}`.toUpperCase();
    const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Usuario';

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
      if (profile.photo) {
        photoEl.src = profile.photo;
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
      if (user.role === 'ADMIN') {
        roleBadge.textContent = 'Administrador';
        roleBadge.classList.add('admin');
      } else {
        roleBadge.textContent = 'Usuario';
        roleBadge.classList.remove('admin');
      }
    }

    // Get region name
    const regionObj = CHILE_REGIONS.find(r => r.id === profile.region);
    const regionName = regionObj ? regionObj.name : '-';

    // Display values - con verificación de existencia
    const displayFullname = document.getElementById('display-fullname');
    const displayRut = document.getElementById('display-rut');
    const displayPhone = document.getElementById('display-phone');
    const displayAddress = document.getElementById('display-address');
    const displayRegion = document.getElementById('display-region');
    const displayCommune = document.getElementById('display-commune');
    const displayEmail = document.getElementById('display-email');

    if (displayFullname) displayFullname.textContent = fullName;
    if (displayRut) displayRut.textContent = profile.rut || '-';
    if (displayPhone) displayPhone.textContent = profile.phone || '-';
    if (displayAddress) displayAddress.textContent = profile.address || '-';
    if (displayRegion) displayRegion.textContent = regionName;
    if (displayCommune) displayCommune.textContent = profile.commune || '-';
    if (displayEmail) displayEmail.textContent = user.email || '-';

    // Form values - con verificación de existencia
    const profileFirstname = document.getElementById('profile-firstname');
    const profileLastname = document.getElementById('profile-lastname');
    const profileRut = document.getElementById('profile-rut');
    const profilePhone = document.getElementById('profile-phone');
    const profileAddress = document.getElementById('profile-address');

    if (profileFirstname) profileFirstname.value = profile.firstName || '';
    if (profileLastname) profileLastname.value = profile.lastName || '';
    if (profileRut) profileRut.value = profile.rut || '';
    if (profilePhone) profilePhone.value = profile.phone || '+56 ';
    if (profileAddress) profileAddress.value = profile.address || '';

    // Load regions dropdown
    const regionSelect = document.getElementById('profile-region');
    if (regionSelect) {
      regionSelect.innerHTML = '<option value="">Selecciona una región</option>';
      CHILE_REGIONS.forEach(region => {
        const option = document.createElement('option');
        option.value = region.id;
        option.textContent = region.name;
        if (region.id === profile.region) {
          option.selected = true;
        }
        regionSelect.appendChild(option);
      });
    }

    // Load comunas if region is selected
    if (profile.region) {
      loadComunas(profile.region, profile.commune);
    }

    // Account info
    const displayAccountType = document.getElementById('display-account-type');
    const displayCreated = document.getElementById('display-created');

    if (displayAccountType) {
      displayAccountType.textContent = user.role === 'ADMIN' ? 'Administrador' : 'Usuario';
    }

    if (user.createdAt && displayCreated) {
      const date = new Date(user.createdAt);
      displayCreated.textContent = date.toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

  } catch (error) {
    console.error('Error loading profile data:', error);
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

      // Update profile
      user.profile = {
        ...user.profile,
        firstName: document.getElementById('profile-firstname').value.trim(),
        lastName: document.getElementById('profile-lastname').value.trim(),
        phone: document.getElementById('profile-phone').value.trim(),
        address: document.getElementById('profile-address').value.trim(),
        region: document.getElementById('profile-region').value,
        commune: document.getElementById('profile-commune').value
      };

      // Save to localStorage
      localStorage.setItem('currentUser', JSON.stringify(user));

      // Persist to IndexedDB
      try {
        const userRepository = getUserRepository();
        await userRepository.update(user.id, { profile: user.profile });
      } catch (error) {
        console.error('Error saving profile to DB:', error);
      }

      // Update header name
      const userName = document.getElementById('user-name');
      if (userName) {
        userName.textContent = user.profile.firstName || user.email;
      }

      // Reset view
      formPersonal.style.display = 'none';
      displayPersonal.style.display = 'flex';
      btnEditPersonal.style.display = 'block';

      loadProfileData();
      showToast('Información actualizada correctamente', 'success');
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
      localStorage.removeItem('currentUser');
      localStorage.removeItem('isAuthenticated');

      await handleLogout();
      showToast('Sesión cerrada correctamente', 'success');

      setTimeout(() => {
        window.location.href = '/auth.html';
      }, 500);
    });
  }
}

// ========================================
// Organizations Management
// ========================================

function initOrganizations() {
  // Renderizar organizaciones al cargar
  renderOrganizations();

  // Botones para crear nueva organización
  const btnNuevaOrg = document.getElementById('btn-nueva-organizacion');
  const btnCrearPrimeraOrg = document.getElementById('btn-crear-primera-org');
  const btnCrearOrg = document.getElementById('btn-crear-organizacion');

  const openWizard = () => {
    const wizard = new WizardController();
    wizard.open();
  };

  if (btnNuevaOrg) btnNuevaOrg.addEventListener('click', openWizard);
  if (btnCrearPrimeraOrg) btnCrearPrimeraOrg.addEventListener('click', openWizard);
  if (btnCrearOrg) btnCrearOrg.addEventListener('click', openWizard);
}

function renderOrganizations() {
  // Usar getCurrentUserOrganizations para mostrar solo las del usuario actual
  const organizations = organizationsService.getCurrentUserOrganizations();
  const hasOrgs = organizations.length > 0;

  const noOrgsSection = document.getElementById('no-organizations');
  const orgsList = document.getElementById('organizations-list');
  const heroSection = document.getElementById('hero-section');
  const btnNuevaOrg = document.getElementById('btn-nueva-organizacion');

  if (!orgsList) return;

  if (hasOrgs) {
    // Mostrar lista, ocultar mensaje vacío
    noOrgsSection.style.display = 'none';
    orgsList.style.display = 'grid';
    if (heroSection) heroSection.style.display = 'none';
    if (btnNuevaOrg) btnNuevaOrg.style.display = 'flex';

    // Renderizar cards de organizaciones
    orgsList.innerHTML = organizations.map(org => renderOrganizationCard(org)).join('');

    // Agregar event listeners a las cards
    orgsList.querySelectorAll('.org-card').forEach(card => {
      const orgId = card.dataset.orgId;

      card.querySelector('.btn-org-view')?.addEventListener('click', (e) => {
        e.stopPropagation();
        viewOrganization(orgId);
      });

      card.querySelector('.btn-org-dashboard')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openOrgDashboard(orgId);
      });
    });
  } else {
    // Mostrar mensaje vacío
    noOrgsSection.style.display = 'flex';
    orgsList.style.display = 'none';
    if (heroSection) heroSection.style.display = 'block';
    if (btnNuevaOrg) btnNuevaOrg.style.display = 'none';
  }
}

function renderOrganizationCard(org) {
  const statusLabel = ORG_STATUS_LABELS[org.status] || org.status;
  const statusColor = ORG_STATUS_COLORS[org.status] || '#6b7280';
  const isApproved = org.status === ORG_STATUS.APPROVED;
  const isPending = [ORG_STATUS.PENDING_REVIEW, ORG_STATUS.IN_REVIEW, ORG_STATUS.SENT_TO_REGISTRY].includes(org.status);
  const isRejected = org.status === ORG_STATUS.REJECTED;

  // Iconos según tipo
  const typeIcon = getOrgIcon(org.organization?.type);
  const typeName = getOrgTypeName(org.organization?.type);

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

  return `
    <div class="org-card ${isApproved ? 'org-approved' : ''} ${isRejected ? 'org-rejected' : ''}" data-org-id="${org.id}">
      <div class="org-card-header">
        <div class="org-type-icon">${typeIcon}</div>
        <div class="org-status-badge" style="background: ${statusColor}20; color: ${statusColor}">
          ${statusLabel}
        </div>
      </div>

      <div class="org-card-body">
        <h3 class="org-name">${org.organization?.name || 'Sin nombre'}</h3>
        <p class="org-type">${typeName}</p>
        <p class="org-location">📍 ${org.organization?.commune || 'Sin ubicación'}, ${org.organization?.region || ''}</p>
        <p class="org-date">Creada el ${createdDate}</p>

        ${progressBar}

        ${isRejected ? `
          <div class="org-rejection-notice">
            <span class="rejection-icon">⚠️</span>
            <span>Requiere correcciones. Revisa los comentarios.</span>
          </div>
        ` : ''}
      </div>

      <div class="org-card-actions">
        <button class="btn-org-view">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Ver detalles
        </button>
        ${isApproved ? `
          <button class="btn-org-dashboard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Gestionar
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function viewOrganization(orgId) {
  const org = organizationsService.getById(orgId);
  if (!org) return;

  const statusLabel = ORG_STATUS_LABELS[org.status] || org.status;
  const statusColor = ORG_STATUS_COLORS[org.status] || '#6b7280';
  const isRejected = org.status === ORG_STATUS.REJECTED;
  const corrections = org.corrections;

  // Generar HTML de correcciones si existen
  let correctionsHTML = '';
  if (isRejected && corrections && !corrections.resolved) {
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

    // Campos ya corregidos por el usuario
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

        ${Object.keys(corrections.fields).length > 0 ? `
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
                  ${val.comment ? `
                    <div class="correction-item-reviewer-comment">
                      <span class="label">${isCorrected ? 'Observación atendida:' : 'Observación del revisor:'}</span>
                      <p>${val.comment}</p>
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

        ${Object.keys(corrections.documents).length > 0 ? `
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
                  ${val.comment ? `
                    <div class="correction-item-reviewer-comment">
                      <span class="label">${isCorrected ? 'Observación atendida:' : 'Observación del revisor:'}</span>
                      <p>${val.comment}</p>
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

        ${Object.keys(corrections.certificates).length > 0 ? `
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
                    ${val.comment ? `
                      <div class="correction-item-reviewer-comment">
                        <span class="label">${isCorrected ? 'Observación atendida:' : 'Observación del revisor:'}</span>
                        <p>${val.comment}</p>
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
                    ${val.comment ? `
                      <div class="correction-item-reviewer-comment">
                        <span class="label">${isCorrected ? 'Observación atendida:' : 'Observación del revisor:'}</span>
                        <p>${val.comment}</p>
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
                    ${val.comment ? `
                      <div class="correction-item-reviewer-comment">
                        <span class="label">${isCorrected ? 'Observación atendida:' : 'Observación del revisor:'}</span>
                        <p>${val.comment}</p>
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

        ${correctionsHTML}

        <div class="org-detail-section">
          <h4>Información General</h4>
          <div class="detail-row ${corrections?.fields?.name ? 'needs-correction' : ''}">
            <span class="detail-label">Tipo:</span>
            <span class="detail-value">${getOrgTypeName(org.organization?.type)}</span>
          </div>
          <div class="detail-row ${corrections?.fields?.address ? 'needs-correction' : ''}">
            <span class="detail-label">Dirección:</span>
            <span class="detail-value">${org.organization?.address || '-'}</span>
          </div>
          <div class="detail-row ${corrections?.fields?.commune ? 'needs-correction' : ''}">
            <span class="detail-label">Comuna:</span>
            <span class="detail-value">${org.organization?.commune || '-'}</span>
          </div>
          <div class="detail-row ${corrections?.fields?.region ? 'needs-correction' : ''}">
            <span class="detail-label">Región:</span>
            <span class="detail-value">${org.organization?.region || '-'}</span>
          </div>
          <div class="detail-row ${corrections?.fields?.email ? 'needs-correction' : ''}">
            <span class="detail-label">Email:</span>
            <span class="detail-value">${org.organization?.email || '-'}</span>
          </div>
          <div class="detail-row ${corrections?.fields?.phone ? 'needs-correction' : ''}">
            <span class="detail-label">Teléfono:</span>
            <span class="detail-value">${org.organization?.phone || '-'}</span>
          </div>
        </div>

        <div class="org-detail-section">
          <h4>Miembros</h4>
          <div class="detail-row">
            <span class="detail-label">Total fundadores:</span>
            <span class="detail-value">${org.members?.length || 0} miembros</span>
          </div>
        </div>

        <div class="org-detail-section">
          <h4>Comisión Electoral</h4>
          ${org.commission?.members?.map((m, i) => `
            <div class="detail-row">
              <span class="detail-label">${['Presidente', 'Secretario', 'Vocal'][i]}:</span>
              <span class="detail-value">${m.firstName} ${m.lastName}</span>
            </div>
          `).join('') || '<p>Sin información</p>'}
        </div>

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

  // Event listeners para edición de correcciones
  if (isRejected && corrections) {
    modal.querySelectorAll('.btn-edit-correction').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const key = btn.dataset.key;
        openCorrectionEditor(org, type, key, modal);
      });
    });

    // Botón de reenvío
    const resubmitBtn = modal.querySelector('.btn-resubmit-org');
    if (resubmitBtn) {
      resubmitBtn.addEventListener('click', () => {
        if (confirm('¿Está seguro de reenviar la solicitud para revisión?')) {
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
          const result = organizationsService.resubmitForReview(org.id, generalComment, fieldResponses);
          if (result) {
            showToast('Solicitud reenviada correctamente', 'success');
            modal.remove();
            renderOrganizations();
          } else {
            showToast('Error al reenviar la solicitud', 'error');
          }
        }
      });
    }
  }
}

// Función para abrir el editor de correcciones
function openCorrectionEditor(org, type, key, parentModal) {
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

  if (type === 'field') {
    // Editor de campo
    const currentValue = org.organization?.[key] || '';
    const label = fieldLabels[key] || key;

    const editModal = document.createElement('div');
    editModal.className = 'correction-edit-modal-overlay';
    editModal.innerHTML = `
      <div class="correction-edit-modal">
        <div class="correction-edit-header">
          <h3>Editar: ${label}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="correction-edit-body">
          <label class="correction-edit-label">Valor actual:</label>
          <p class="correction-current">${currentValue || '(vacío)'}</p>

          <label class="correction-edit-label">Nuevo valor:</label>
          ${key === 'description' ?
            `<textarea id="correction-new-value" class="correction-input-textarea">${currentValue}</textarea>` :
            `<input type="text" id="correction-new-value" class="correction-input" value="${currentValue}">`
          }
        </div>
        <div class="correction-edit-footer">
          <button class="btn-cancel-edit">Cancelar</button>
          <button class="btn-save-edit">Guardar Cambio</button>
        </div>
      </div>
    `;

    document.body.appendChild(editModal);

    editModal.querySelector('.modal-close-btn').addEventListener('click', () => editModal.remove());
    editModal.querySelector('.btn-cancel-edit').addEventListener('click', () => editModal.remove());
    editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.remove(); });

    editModal.querySelector('.btn-save-edit').addEventListener('click', () => {
      const newValue = document.getElementById('correction-new-value').value.trim();
      if (!newValue) {
        showToast('El valor no puede estar vacío', 'error');
        return;
      }

      // Actualizar el campo en la organización
      if (!org.organization) org.organization = {};
      org.organization[key] = newValue;

      // Marcar este campo como corregido por el usuario
      if (!org.userCorrectedFields) org.userCorrectedFields = {};
      if (!org.userCorrectedFields[type]) org.userCorrectedFields[type] = {};
      org.userCorrectedFields[type][key] = {
        correctedAt: new Date().toISOString(),
        newValue: newValue
      };

      organizationsService.update(org.id, {
        organization: org.organization,
        userCorrectedFields: org.userCorrectedFields
      });

      showToast('Campo actualizado correctamente', 'success');
      editModal.remove();
      parentModal.remove();
      viewOrganization(org.id);
    });

  } else if (type === 'document' || type === 'certificate') {
    // Para documentos y certificados mostrar mensaje por ahora
    showToast('Para resubir documentos, contacte al administrador', 'info');
  } else if (type === 'member') {
    // Editor de miembro
    const member = org.members?.find(m => m.id === key);
    if (!member) {
      showToast('Miembro no encontrado', 'error');
      return;
    }

    const editModal = document.createElement('div');
    editModal.className = 'correction-edit-modal-overlay';
    editModal.innerHTML = `
      <div class="correction-edit-modal">
        <div class="correction-edit-header">
          <h3>Editar Miembro: ${member.firstName} ${member.lastName}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="correction-edit-body">
          <div class="member-edit-fields">
            <div class="edit-field-group">
              <label>Nombre:</label>
              <input type="text" id="edit-member-firstname" value="${member.firstName || ''}">
            </div>
            <div class="edit-field-group">
              <label>Apellido:</label>
              <input type="text" id="edit-member-lastname" value="${member.lastName || ''}">
            </div>
            <div class="edit-field-group">
              <label>RUT:</label>
              <input type="text" id="edit-member-rut" value="${member.rut || ''}">
            </div>
          </div>
        </div>
        <div class="correction-edit-footer">
          <button class="btn-cancel-edit">Cancelar</button>
          <button class="btn-save-edit">Guardar Cambios</button>
        </div>
      </div>
    `;

    document.body.appendChild(editModal);

    editModal.querySelector('.modal-close-btn').addEventListener('click', () => editModal.remove());
    editModal.querySelector('.btn-cancel-edit').addEventListener('click', () => editModal.remove());
    editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.remove(); });

    editModal.querySelector('.btn-save-edit').addEventListener('click', () => {
      const newFirstName = document.getElementById('edit-member-firstname').value.trim();
      const newLastName = document.getElementById('edit-member-lastname').value.trim();
      const newRut = document.getElementById('edit-member-rut').value.trim();

      if (!newFirstName || !newLastName) {
        showToast('Nombre y apellido son requeridos', 'error');
        return;
      }

      // Actualizar miembro
      const memberIndex = org.members.findIndex(m => m.id === key);
      if (memberIndex !== -1) {
        org.members[memberIndex] = {
          ...org.members[memberIndex],
          firstName: newFirstName,
          lastName: newLastName,
          rut: newRut
        };
      }

      // Marcar como corregido
      if (!org.userCorrectedFields) org.userCorrectedFields = {};
      if (!org.userCorrectedFields.member) org.userCorrectedFields.member = {};
      org.userCorrectedFields.member[key] = {
        correctedAt: new Date().toISOString()
      };

      organizationsService.update(org.id, {
        members: org.members,
        userCorrectedFields: org.userCorrectedFields
      });

      showToast('Miembro actualizado correctamente', 'success');
      editModal.remove();
      parentModal.remove();
      viewOrganization(org.id);
    });

  } else if (type === 'commission') {
    // Editor de comisión
    if (key === 'electionDate') {
      // Editar fecha de elección
      const currentDate = org.commission?.electionDate || '';

      const editModal = document.createElement('div');
      editModal.className = 'correction-edit-modal-overlay';
      editModal.innerHTML = `
        <div class="correction-edit-modal">
          <div class="correction-edit-header">
            <h3>Editar: Fecha de Elección</h3>
            <button class="modal-close-btn">&times;</button>
          </div>
          <div class="correction-edit-body">
            <label class="correction-edit-label">Nueva fecha:</label>
            <input type="date" id="edit-election-date" class="correction-input" value="${currentDate}">
          </div>
          <div class="correction-edit-footer">
            <button class="btn-cancel-edit">Cancelar</button>
            <button class="btn-save-edit">Guardar</button>
          </div>
        </div>
      `;

      document.body.appendChild(editModal);

      editModal.querySelector('.modal-close-btn').addEventListener('click', () => editModal.remove());
      editModal.querySelector('.btn-cancel-edit').addEventListener('click', () => editModal.remove());
      editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.remove(); });

      editModal.querySelector('.btn-save-edit').addEventListener('click', () => {
        const newDate = document.getElementById('edit-election-date').value;

        if (!newDate) {
          showToast('La fecha es requerida', 'error');
          return;
        }

        if (!org.commission) org.commission = {};
        org.commission.electionDate = newDate;

        // Marcar como corregido
        if (!org.userCorrectedFields) org.userCorrectedFields = {};
        if (!org.userCorrectedFields.commission) org.userCorrectedFields.commission = {};
        org.userCorrectedFields.commission[key] = {
          correctedAt: new Date().toISOString()
        };

        organizationsService.update(org.id, {
          commission: org.commission,
          userCorrectedFields: org.userCorrectedFields
        });

        showToast('Fecha actualizada correctamente', 'success');
        editModal.remove();
        parentModal.remove();
        viewOrganization(org.id);
      });
    } else {
      // Editar miembro de comisión
      const memberIndex = org.commission?.members?.findIndex(m => m.id === key) ?? -1;
      const member = org.commission?.members?.[memberIndex];
      const role = ['Presidente', 'Secretario', 'Vocal'][memberIndex] || 'Miembro';

      if (!member) {
        showToast('Miembro de comisión no encontrado', 'error');
        return;
      }

      const editModal = document.createElement('div');
      editModal.className = 'correction-edit-modal-overlay';
      editModal.innerHTML = `
        <div class="correction-edit-modal">
          <div class="correction-edit-header">
            <h3>Editar ${role}</h3>
            <button class="modal-close-btn">&times;</button>
          </div>
          <div class="correction-edit-body">
            <div class="member-edit-fields">
              <div class="edit-field-group">
                <label>Nombre:</label>
                <input type="text" id="edit-comm-firstname" value="${member.firstName || ''}">
              </div>
              <div class="edit-field-group">
                <label>Apellido:</label>
                <input type="text" id="edit-comm-lastname" value="${member.lastName || ''}">
              </div>
              <div class="edit-field-group">
                <label>RUT:</label>
                <input type="text" id="edit-comm-rut" value="${member.rut || ''}">
              </div>
            </div>
          </div>
          <div class="correction-edit-footer">
            <button class="btn-cancel-edit">Cancelar</button>
            <button class="btn-save-edit">Guardar</button>
          </div>
        </div>
      `;

      document.body.appendChild(editModal);

      editModal.querySelector('.modal-close-btn').addEventListener('click', () => editModal.remove());
      editModal.querySelector('.btn-cancel-edit').addEventListener('click', () => editModal.remove());
      editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.remove(); });

      editModal.querySelector('.btn-save-edit').addEventListener('click', () => {
        const newFirstName = document.getElementById('edit-comm-firstname').value.trim();
        const newLastName = document.getElementById('edit-comm-lastname').value.trim();
        const newRut = document.getElementById('edit-comm-rut').value.trim();

        if (!newFirstName || !newLastName) {
          showToast('Nombre y apellido son requeridos', 'error');
          return;
        }

        // Actualizar miembro de comisión
        org.commission.members[memberIndex] = {
          ...org.commission.members[memberIndex],
          firstName: newFirstName,
          lastName: newLastName,
          rut: newRut
        };

        // Marcar como corregido
        if (!org.userCorrectedFields) org.userCorrectedFields = {};
        if (!org.userCorrectedFields.commission) org.userCorrectedFields.commission = {};
        org.userCorrectedFields.commission[key] = {
          correctedAt: new Date().toISOString()
        };

        organizationsService.update(org.id, {
          commission: org.commission,
          userCorrectedFields: org.userCorrectedFields
        });

        showToast('Miembro de comisión actualizado correctamente', 'success');
        editModal.remove();
        parentModal.remove();
        viewOrganization(org.id);
      });
    }
  }
}

function openOrgDashboard(orgId) {
  const org = organizationsService.getById(orgId);
  if (!org || org.status !== ORG_STATUS.APPROVED) {
    showToast('Esta organización aún no está aprobada', 'error');
    return;
  }

  // Abrir el dashboard de administración de la organización
  organizationDashboard.open(orgId);
}

// Exportar para uso desde el wizard
window.refreshOrganizations = renderOrganizations;
window.organizationsService = organizationsService;

// ========================================
// User Role UI Setup
// ========================================

function setupUserRoleUI() {
  const userData = localStorage.getItem('currentUser');
  if (!userData) return;

  try {
    const user = JSON.parse(userData);
    const isAdmin = user.role === 'ADMIN';

    if (isAdmin) {
      setupAdminUI();
    } else {
      setupUserUI();
    }
  } catch (error) {
    console.error('Error setting up role UI:', error);
  }
}

function setupAdminUI() {
  console.log('🔑 Configurando UI de Administrador');

  // Ocultar sección de "Mis Organizaciones" para admin
  const myOrgsSection = document.getElementById('my-organizations-section');
  if (myOrgsSection) myOrgsSection.style.display = 'none';

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
  }, 100);

  // Actualizar navegación lateral para admin
  const navList = document.querySelector('.nav-list');
  if (navList) {
    navList.innerHTML = `
      <li><a href="#" data-page="admin" class="nav-link active">📊 Panel de Control</a></li>
      <li><a href="#" data-page="profile" class="nav-link">👤 Mi Perfil</a></li>
    `;

    // Re-agregar listeners
    navList.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        if (page) {
          appState.navigateTo(page);
          if (page === 'admin') {
            adminDashboard.init();
          } else if (page === 'profile') {
            loadProfileData();
          }
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
          // Actualizar active state
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

function setupUserUI() {
  console.log('👤 Configurando UI de Usuario');
  // La UI de usuario ya está configurada por defecto
  // Solo asegurarnos de que las secciones correctas estén visibles
  const myOrgsSection = document.getElementById('my-organizations-section');
  if (myOrgsSection) myOrgsSection.style.display = 'block';

  renderOrganizations();
}
