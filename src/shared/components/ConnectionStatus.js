/**
 * ConnectionStatus - Componente para mostrar estado de conexión y cola offline
 * Se integra automáticamente con ApiService para mostrar estado en tiempo real
 */

import { apiService } from '../../services/ApiService.js';
import { indexedDBService } from '../../infrastructure/database/IndexedDBService.js';

class ConnectionStatus {
  constructor() {
    this.container = null;
    this.isOnline = navigator.onLine;
    this.pendingCount = 0;
    this._initialized = false;
    this._syncingTimeout = null;
    this._syncingStartTime = null;
  }

  /**
   * Inicializa el componente y lo agrega al DOM
   */
  init() {
    if (this._initialized) return;

    this._createContainer();
    this._setupEventListeners();
    this._updateStatus();
    this._initialized = true;
  }

  /**
   * Crea el contenedor del indicador
   */
  _createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'connection-status';
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 25px;
      font-size: 13px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.3s ease;
      opacity: 0;
      transform: translateY(20px);
      pointer-events: none;
    `;
    document.body.appendChild(this.container);
  }

  /**
   * Configura los event listeners
   */
  _setupEventListeners() {
    // Cambios de conexión
    window.addEventListener('connection-change', (e) => {
      this.isOnline = e.detail.isOnline;
      this._updateStatus();
      this._showTemporarily();
    });

    // Sincronización completada
    window.addEventListener('offline-sync-completed', async () => {
      this.pendingCount = await apiService.getPendingRequestsCount();
      this._updateStatus();
      if (this.pendingCount === 0) {
        this._showSuccess('Sincronizado');
      }
    });

    // Cola sincronizada
    window.addEventListener('offline-queue-synced', async () => {
      this.pendingCount = await apiService.getPendingRequestsCount();
      this._updateStatus();
      if (this.pendingCount === 0) {
        this._showSuccess('Todo sincronizado');
      }
    });

    // Sync fallido
    window.addEventListener('offline-sync-failed', () => {
      this._showError('Error de sincronización');
    });

    // Verificar estado inicial
    window.addEventListener('online', () => {
      this.isOnline = true;
      this._updateStatus();
      this._showTemporarily();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this._updateStatus();
      this._show();
    });
  }

  /**
   * Actualiza el estado visual del indicador
   */
  async _updateStatus() {
    if (!this.container) return;

    try {
      this.pendingCount = await apiService.getPendingRequestsCount();
    } catch (e) {
      console.warn('Error getting pending requests count:', e);
      this.pendingCount = 0;
    }

    // Auto-limpieza: si estamos online y hay pendientes, limpiar requests viejas (>1h)
    if (this.isOnline && this.pendingCount > 0) {
      try {
        const cleaned = await indexedDBService.clearOldPendingRequests(3600000);
        if (cleaned > 0) {
          this.pendingCount = Math.max(0, this.pendingCount - cleaned);
        }
      } catch (e) {
        console.warn('Error cleaning old pending requests:', e);
      }
    }

    // Timeout: si lleva >30s mostrando "Sincronizando", mostrar botón "Limpiar cola"
    if (this.isOnline && this.pendingCount > 0) {
      if (!this._syncingStartTime) {
        this._syncingStartTime = Date.now();
      }
      if (!this._syncingTimeout) {
        this._syncingTimeout = setTimeout(() => {
          this._showClearQueueButton();
        }, 30000);
      }
    } else {
      this._syncingStartTime = null;
      if (this._syncingTimeout) {
        clearTimeout(this._syncingTimeout);
        this._syncingTimeout = null;
      }
    }

    if (!this.isOnline) {
      // Offline
      this.container.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      this.container.style.color = 'white';
      this.container.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="1" y1="1" x2="23" y2="23"></line>
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
          <line x1="12" y1="20" x2="12.01" y2="20"></line>
        </svg>
        <span>Sin conexión${this.pendingCount > 0 ? ` (${this.pendingCount} pendientes)` : ''}</span>
      `;
      this._show();
    } else if (this.pendingCount > 0) {
      // Online con peticiones pendientes
      this.container.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      this.container.style.color = 'white';
      this.container.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
        <span>Sincronizando (${this.pendingCount})</span>
      `;
      this._show();
    } else {
      // Online y sincronizado
      this.container.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      this.container.style.color = 'white';
      this.container.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
          <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
          <line x1="12" y1="20" x2="12.01" y2="20"></line>
        </svg>
        <span>Conectado</span>
      `;
    }

    // Agregar estilo de animación si no existe
    if (!document.getElementById('connection-status-styles')) {
      const style = document.createElement('style');
      style.id = 'connection-status-styles';
      style.textContent = `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        #connection-status .spin {
          animation: spin 1s linear infinite;
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Muestra el indicador
   */
  _show() {
    if (!this.container) return;
    this.container.style.opacity = '1';
    this.container.style.transform = 'translateY(0)';
    this.container.style.pointerEvents = 'auto';
  }

  /**
   * Oculta el indicador
   */
  _hide() {
    if (!this.container) return;
    this.container.style.opacity = '0';
    this.container.style.transform = 'translateY(20px)';
    this.container.style.pointerEvents = 'none';
  }

  /**
   * Muestra temporalmente y luego oculta
   */
  _showTemporarily(duration = 3000) {
    this._show();
    setTimeout(() => {
      if (this.isOnline && this.pendingCount === 0) {
        this._hide();
      }
    }, duration);
  }

  /**
   * Muestra mensaje de éxito
   */
  _showSuccess(message) {
    if (!this.container) return;
    this.container.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    this.container.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>${message}</span>
    `;
    this._showTemporarily(2000);
  }

  /**
   * Muestra mensaje de error
   */
  _showError(message) {
    if (!this.container) return;
    this.container.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    this.container.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      <span>${message}</span>
    `;
    this._showTemporarily(4000);
  }

  /**
   * Muestra botón para limpiar la cola de sincronización atascada
   */
  _showClearQueueButton() {
    if (!this.container || !this.isOnline || this.pendingCount === 0) return;

    this.container.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    this.container.style.color = 'white';
    this.container.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>${this.pendingCount} pendientes atascados</span>
      <button id="clear-offline-queue-btn" style="background:rgba(255,255,255,0.25);color:white;border:1px solid rgba(255,255,255,0.4);border-radius:12px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;margin-left:4px;">Limpiar</button>
    `;
    this._show();

    document.getElementById('clear-offline-queue-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._clearQueue();
    });
  }

  /**
   * Limpia toda la cola offline y actualiza el estado
   */
  async _clearQueue() {
    try {
      await indexedDBService.clear('offline_queue');
      this.pendingCount = 0;
      this._syncingStartTime = null;
      if (this._syncingTimeout) {
        clearTimeout(this._syncingTimeout);
        this._syncingTimeout = null;
      }
      this._showSuccess('Cola limpiada');
    } catch (e) {
      console.error('Error clearing offline queue:', e);
      this._showError('Error al limpiar');
    }
  }

  /**
   * Destruye el componente
   */
  destroy() {
    if (this._syncingTimeout) {
      clearTimeout(this._syncingTimeout);
      this._syncingTimeout = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this._initialized = false;
  }
}

// Singleton
export const connectionStatus = new ConnectionStatus();

// Auto-inicializar cuando el DOM esté listo
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => connectionStatus.init());
  } else {
    connectionStatus.init();
  }
}
