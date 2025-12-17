/**
 * Aplicación Principal
 * Punto de entrada de la aplicación con Clean Architecture
 */

import { container, getAuthService } from './infrastructure/config/container.js';
import { APP_CONFIG } from './infrastructure/config/app.config.js';

// Flag para saber si ya se inicializó
let isInitialized = false;

/**
 * Inicializa la aplicación
 */
export async function initializeApp() {
  if (isInitialized) return;

  console.log('🚀 Inicializando aplicación...');
  await container.init();

  // Actualizar UI inicial
  appState.updateUI();

  isInitialized = true;
  console.log('✅ Aplicación inicializada');
}

/**
 * Estado global de la aplicación
 */
class AppState {
  constructor() {
    this.currentPage = 'home';
    this.currentUser = null;
    this.authService = null;
  }

  /**
   * Inicializa el auth service (debe llamarse después de container.init())
   */
  initializeAuthService() {
    if (!this.authService) {
      this.authService = getAuthService();
      // Restaurar usuario si hay sesión
      this.currentUser = this.authService.getCurrentUser();
    }
  }

  /**
   * Verifica si el usuario está autenticado
   */
  isAuthenticated() {
    if (!this.authService) return false;
    return this.authService.isAuthenticated();
  }

  /**
   * Verifica si el usuario es admin
   */
  isAdmin() {
    if (!this.authService) return false;
    return this.authService.isAdmin();
  }

  /**
   * Obtiene el usuario actual
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Establece el usuario actual
   */
  setCurrentUser(user) {
    this.currentUser = user;
  }

  /**
   * Navega a una página
   */
  navigateTo(page) {
    this.currentPage = page;
    this.updateUI();
  }

  /**
   * Actualiza la UI según el estado
   */
  updateUI() {
    // Ocultar todas las páginas
    document.querySelectorAll('.page-view').forEach(view => {
      view.classList.remove('active');
    });

    // Mostrar página actual
    const activePage = document.getElementById(`page-${this.currentPage}`);
    if (activePage) {
      activePage.classList.add('active');
    }

    // Actualizar navegación
    document.querySelectorAll('.nav-link, .nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.page === this.currentPage) {
        item.classList.add('active');
      }
    });

    // Actualizar header según autenticación
    this.updateHeader();

    // Scroll to top
    window.scrollTo(0, 0);
  }

  /**
   * Actualiza el header según el estado de autenticación
   */
  updateHeader() {
    const userInfo = document.getElementById('user-info');
    if (!userInfo) return;

    const userName = document.getElementById('user-name');
    if (userName && this.currentUser) {
      userName.textContent = this.currentUser.profile?.firstName || this.currentUser.email;
    }

    // Actualizar mensaje de bienvenida
    const welcomeMessage = document.getElementById('welcome-message');
    if (welcomeMessage && this.currentUser) {
      const firstName = this.currentUser.profile?.firstName || 'Usuario';
      welcomeMessage.textContent = `Bienvenido/a, ${firstName}`;
    }
  }
}

// Instancia global del estado
export const appState = new AppState();

// Log para debugging
console.log('📦 app.js cargado - appState creado');

/**
 * Manejo de autenticación
 */
export async function handleLogin(email, password) {
  try {
    // Asegurar que authService está inicializado
    appState.initializeAuthService();

    const authService = getAuthService();
    const user = await authService.login(email, password);

    appState.setCurrentUser(user);
    appState.updateHeader();

    return {
      success: true,
      user
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function handleLogout() {
  try {
    // Asegurar que authService está inicializado
    appState.initializeAuthService();

    const authService = getAuthService();
    await authService.logout();

    appState.setCurrentUser(null);
    appState.navigateTo('home');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Muestra un mensaje toast
 */
export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: calc(var(--bottom-nav-height, 60px) + 20px);
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 100000;
    animation: slideUp 0.3s ease;
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideDown 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// NO inicializar aquí - se hará desde main.js
