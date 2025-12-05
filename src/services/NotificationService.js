/**
 * Servicio de Notificaciones
 * Conecta con el backend API
 */

import { apiService } from './ApiService.js';

class NotificationService {
  constructor() {
    this.notifications = [];
    this.listeners = [];
    this.loaded = false;
  }

  /**
   * Carga las notificaciones desde el servidor
   */
  async loadFromServer() {
    try {
      this.notifications = await apiService.getNotifications();
      this.loaded = true;
      localStorage.setItem('user_notifications', JSON.stringify(this.notifications));
      this.notifyListeners();
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
    } catch (e) {
      console.error('Error loading notifications:', e);
      this.notifications = [];
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
        listener(this.notifications);
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
   * Obtiene notificaciones de un usuario específico
   */
  getByUserId(userId) {
    return this.notifications.filter(n => n.userId === userId);
  }

  /**
   * Obtiene notificaciones no leídas de un usuario
   */
  getUnreadByUserId(userId) {
    return this.notifications.filter(n => n.userId === userId && !n.read);
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
  getUnreadCount(userId) {
    if (userId) {
      return this.getUnreadByUserId(userId).length;
    }
    return this.getUnread().length;
  }

  /**
   * Obtiene el conteo desde el servidor
   */
  async getUnreadCountAsync() {
    try {
      const result = await apiService.getUnreadCount();
      return result.count;
    } catch (e) {
      console.error('Error fetching unread count:', e);
      return this.getUnreadCount();
    }
  }

  /**
   * Crea una nueva notificación
   */
  async create(notificationData) {
    try {
      const notification = await apiService.post('/notifications', notificationData);
      this.notifications.unshift(notification);
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
      const updated = await apiService.markNotificationRead(notificationId);
      const index = this.notifications.findIndex(n => n.id === notificationId || n._id === notificationId);
      if (index !== -1) {
        this.notifications[index] = updated;
        localStorage.setItem('user_notifications', JSON.stringify(this.notifications));
        this.notifyListeners();
      }
      return updated;
    } catch (e) {
      console.error('Error marking notification as read:', e);
      throw e;
    }
  }

  /**
   * Marca todas las notificaciones de un usuario como leídas
   */
  async markAllAsRead(userId) {
    try {
      await apiService.markAllNotificationsRead();
      this.notifications = this.notifications.map(n => ({
        ...n,
        read: true,
        readAt: new Date().toISOString()
      }));
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
      this.notifications = this.notifications.filter(n => n.id !== notificationId && n._id !== notificationId);
      localStorage.setItem('user_notifications', JSON.stringify(this.notifications));
      this.notifyListeners();
      return true;
    } catch (e) {
      console.error('Error deleting notification:', e);
      throw e;
    }
  }

  /**
   * Elimina todas las notificaciones de un usuario
   */
  async deleteAllByUserId(userId) {
    try {
      // This would need a backend endpoint
      const toDelete = this.notifications.filter(n => n.userId === userId);
      for (const n of toDelete) {
        await this.delete(n.id || n._id);
      }
      return toDelete.length;
    } catch (e) {
      console.error('Error deleting all notifications:', e);
      throw e;
    }
  }

  /**
   * Notifica cambio de horario de asamblea
   * Nota: Las notificaciones ahora se crean en el backend
   */
  notifyScheduleChange(userId, oldSchedule, newSchedule, organizationName) {
    console.log('Schedule change notification will be created by backend');
  }

  /**
   * Notifica asignación de Ministro de Fe
   * Nota: Las notificaciones ahora se crean en el backend
   */
  notifyMinistroAssigned(userId, ministroData, organizationName) {
    console.log('Ministro assigned notification will be created by backend');
  }

  /**
   * Notifica cambio de estado de solicitud
   * Nota: Las notificaciones ahora se crean en el backend
   */
  notifyStatusUpdate(userId, organizationName, oldStatus, newStatus) {
    console.log('Status update notification will be created by backend');
  }
}

// Exportar instancia singleton
export const notificationService = new NotificationService();
