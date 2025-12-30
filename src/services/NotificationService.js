/**
 * Servicio de Notificaciones
 * Conecta con el backend API con soporte de polling y toasts
 */

import { apiService } from './ApiService.js';

class NotificationService {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.listeners = [];
    this.loaded = false;
    this.pollInterval = null;
    this.isPolling = false;
    this.pollIntervalMs = 30000; // 30 segundos
  }

  /**
   * Inicia el polling de notificaciones
   */
  startPolling() {
    if (this.isPolling) return;

    const token = apiService.getToken();
    if (!token) return;

    this.isPolling = true;
    this.loadFromServer();

    this.pollInterval = setInterval(() => {
      this.loadFromServer();
    }, this.pollIntervalMs);
  }

  /**
   * Detiene el polling
   */
  stopPolling() {
    this.isPolling = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Carga las notificaciones desde el servidor
   */
  async loadFromServer() {
    try {
      const token = apiService.getToken();
      if (!token) {
        this.stopPolling();
        return;
      }

      const [notifications, countData] = await Promise.all([
        apiService.getNotifications(),
        apiService.getUnreadCount()
      ]);

      // Detectar nuevas notificaciones para mostrar toast
      const oldIds = new Set(this.notifications.map(n => n._id));
      const newNotifications = (notifications || []).filter(n => !oldIds.has(n._id) && !n.read);

      this.notifications = notifications || [];
      this.unreadCount = countData?.count || 0;
      this.loaded = true;

      localStorage.setItem('user_notifications', JSON.stringify(this.notifications));
      this.notifyListeners();

      // Mostrar toast para nuevas notificaciones
      newNotifications.forEach(n => {
        this.showToast(n.title, n.message, this.getToastType(n.type));
      });
    } catch (e) {
      console.error('Error loading notifications from server:', e);
      this.loadFromStorage();
    }
  }

  /**
   * Carga desde localStorage (fallback)
   */
  loadFromStorage() {
    try {
      const saved = localStorage.getItem('user_notifications');
      this.notifications = saved ? JSON.parse(saved) : [];
      this.unreadCount = this.notifications.filter(n => !n.read).length;
    } catch (e) {
      console.error('Error loading notifications:', e);
      this.notifications = [];
      this.unreadCount = 0;
    }
  }

  /**
   * Sincroniza con el servidor
   */
  async sync() {
    await this.loadFromServer();
  }

  /**
   * Suscribe un listener para cambios de notificaciones
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notifica a los listeners
   */
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener({
          notifications: this.notifications,
          unreadCount: this.unreadCount
        });
      } catch (e) {
        console.error('Error in notification listener:', e);
      }
    });
  }

  /**
   * Obtiene todas las notificaciones
   */
  getAll() {
    return this.notifications;
  }

  /**
   * Obtiene todas las notificaciones desde el servidor
   */
  async getAllAsync() {
    try {
      const notifications = await apiService.getNotifications();
      this.notifications = notifications;
      localStorage.setItem('user_notifications', JSON.stringify(notifications));
      return notifications;
    } catch (e) {
      console.error('Error fetching notifications:', e);
      return this.notifications;
    }
  }

  /**
   * Obtiene notificaciones no leídas
   */
  getUnread() {
    return this.notifications.filter(n => !n.read);
  }

  /**
   * Obtiene notificaciones no leídas desde el servidor
   */
  async getUnreadAsync() {
    try {
      return await apiService.getUnreadNotifications();
    } catch (e) {
      console.error('Error fetching unread notifications:', e);
      return this.getUnread();
    }
  }

  /**
   * Obtiene el conteo de no leídas
   */
  getUnreadCount() {
    return this.unreadCount;
  }

  /**
   * Obtiene el conteo desde el servidor
   */
  async getUnreadCountAsync() {
    try {
      const result = await apiService.getUnreadCount();
      this.unreadCount = result.count;
      return result.count;
    } catch (e) {
      console.error('Error fetching unread count:', e);
      return this.unreadCount;
    }
  }

  /**
   * Crea una nueva notificación
   */
  async create(notificationData) {
    try {
      const notification = await apiService.createNotification(notificationData);
      this.notifications.unshift(notification);
      this.unreadCount++;
      localStorage.setItem('user_notifications', JSON.stringify(this.notifications));
      this.notifyListeners();
      return notification;
    } catch (e) {
      console.error('Error creating notification:', e);
      throw e;
    }
  }

  /**
   * Marca una notificación como leída
   */
  async markAsRead(notificationId) {
    try {
      await apiService.markNotificationRead(notificationId);

      const notification = this.notifications.find(n => n._id === notificationId);
      if (notification && !notification.read) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
        this.unreadCount = Math.max(0, this.unreadCount - 1);
        localStorage.setItem('user_notifications', JSON.stringify(this.notifications));
        this.notifyListeners();
      }
      return notification;
    } catch (e) {
      console.error('Error marking notification as read:', e);
      throw e;
    }
  }

  /**
   * Marca todas las notificaciones como leídas
   */
  async markAllAsRead() {
    try {
      await apiService.markAllNotificationsRead();
      this.notifications = this.notifications.map(n => ({
        ...n,
        read: true,
        readAt: new Date().toISOString()
      }));
      this.unreadCount = 0;
      localStorage.setItem('user_notifications', JSON.stringify(this.notifications));
      this.notifyListeners();
      return this.notifications.length;
    } catch (e) {
      console.error('Error marking all as read:', e);
      throw e;
    }
  }

  /**
   * Elimina una notificación
   */
  async delete(notificationId) {
    try {
      await apiService.deleteNotification(notificationId);

      const notification = this.notifications.find(n => n._id === notificationId);
      if (notification && !notification.read) {
        this.unreadCount = Math.max(0, this.unreadCount - 1);
      }

      this.notifications = this.notifications.filter(n => n._id !== notificationId);
      localStorage.setItem('user_notifications', JSON.stringify(this.notifications));
      this.notifyListeners();
      return true;
    } catch (e) {
      console.error('Error deleting notification:', e);
      throw e;
    }
  }

  /**
   * Obtiene el tipo de toast según el tipo de notificación
   */
  getToastType(notificationType) {
    const successTypes = ['organization_approved', 'member_accounts_created', 'welcome_member'];
    const warningTypes = ['correction_required', 'assembly_reminder', 'election_reminder'];
    const errorTypes = ['organization_rejected', 'member_removed', 'assignment_removed'];

    if (successTypes.includes(notificationType)) return 'success';
    if (warningTypes.includes(notificationType)) return 'warning';
    if (errorTypes.includes(notificationType)) return 'error';
    return 'info';
  }

  /**
   * Muestra un toast de notificación
   */
  showToast(title, message, type = 'info') {
    this.ensureToastStyles();

    const toast = document.createElement('div');
    toast.className = `notification-toast notification-toast--${type}`;
    toast.innerHTML = `
      <div class="notification-toast__icon">${this.getIcon(type)}</div>
      <div class="notification-toast__content">
        <div class="notification-toast__title">${title}</div>
        <div class="notification-toast__message">${message}</div>
      </div>
      <button class="notification-toast__close">&times;</button>
    `;

    document.body.appendChild(toast);

    // Animar entrada
    requestAnimationFrame(() => {
      toast.classList.add('notification-toast--visible');
    });

    // Botón de cerrar
    toast.querySelector('.notification-toast__close').addEventListener('click', () => {
      this.removeToast(toast);
    });

    // Auto-remover después de 5 segundos
    setTimeout(() => {
      this.removeToast(toast);
    }, 5000);
  }

  /**
   * Remueve un toast con animación
   */
  removeToast(toast) {
    toast.classList.remove('notification-toast--visible');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  /**
   * Obtiene el icono SVG según el tipo
   */
  getIcon(type) {
    const icons = {
      info: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
      success: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'
    };
    return icons[type] || icons.info;
  }

  /**
   * Inyecta los estilos de toast si no existen
   */
  ensureToastStyles() {
    if (document.getElementById('notification-toast-styles')) return;

    const style = document.createElement('style');
    style.id = 'notification-toast-styles';
    style.textContent = `
      .notification-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        max-width: 400px;
        z-index: 10000;
        transform: translateX(120%);
        transition: transform 0.3s ease;
      }

      .notification-toast--visible {
        transform: translateX(0);
      }

      .notification-toast__icon {
        width: 24px;
        height: 24px;
        flex-shrink: 0;
      }

      .notification-toast__icon svg {
        width: 100%;
        height: 100%;
      }

      .notification-toast--info .notification-toast__icon { color: #2196F3; }
      .notification-toast--success .notification-toast__icon { color: #4CAF50; }
      .notification-toast--warning .notification-toast__icon { color: #FF9800; }
      .notification-toast--error .notification-toast__icon { color: #f44336; }

      .notification-toast__content {
        flex: 1;
      }

      .notification-toast__title {
        font-weight: 600;
        margin-bottom: 4px;
        color: #333;
      }

      .notification-toast__message {
        font-size: 14px;
        color: #666;
      }

      .notification-toast__close {
        background: none;
        border: none;
        font-size: 20px;
        color: #999;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }

      .notification-toast__close:hover {
        color: #333;
      }

      @media (max-width: 480px) {
        .notification-toast {
          left: 10px;
          right: 10px;
          max-width: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Formatea una fecha para mostrar
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes} min`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days} días`;

    return date.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'short'
    });
  }

  /**
   * Obtiene el icono emoji según el tipo de notificación
   */
  getNotificationIcon(type) {
    const icons = {
      // Notificaciones de organizaciones
      ministro_assigned: '👨‍⚖️',
      ministro_changed: '🔄',
      schedule_change: '📅',
      location_change: '📍',
      schedule_location_change: '📍',
      status_change: '📋',
      correction_required: '⚠️',
      organization_approved: '✅',
      organization_rejected: '❌',
      general: '📢',
      // Notificaciones de asignaciones
      new_assignment: '📋',
      assignment_removed: '🗑️',
      assignment_schedule_change: '📅',
      assignment_location_change: '📍',
      // Notificaciones de organizaciones activas
      member_accounts_created: '👥',
      new_assembly: '🏛️',
      assembly_reminder: '⏰',
      election_announced: '🗳️',
      election_reminder: '⏰',
      directorio_updated: '👔',
      new_communication: '💬',
      new_member_joined: '👋',
      member_removed: '👤',
      // Notificaciones de miembros
      welcome_member: '🎉',
      assembly_invitation: '📩',
      election_notification: '🗳️',
      organization_update: '📢'
    };
    return icons[type] || '🔔';
  }
}

// Exportar instancia singleton
export const notificationService = new NotificationService();
