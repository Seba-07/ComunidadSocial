/**
 * Servicio de Notificaciones
 * Gestiona notificaciones del sistema para usuarios
 */

class NotificationService {
  constructor() {
    this.storageKey = 'system_notifications';
  }

  /**
   * Obtiene todas las notificaciones
   */
  getAll() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error al obtener notificaciones:', error);
      return [];
    }
  }

  /**
   * Obtiene notificaciones de un usuario específico
   */
  getByUserId(userId) {
    return this.getAll().filter(n => n.userId === userId);
  }

  /**
   * Obtiene notificaciones no leídas de un usuario
   */
  getUnreadByUserId(userId) {
    return this.getByUserId(userId).filter(n => !n.read);
  }

  /**
   * Crea una nueva notificación
   */
  create(notificationData) {
    const notifications = this.getAll();

    const newNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: notificationData.userId,
      type: notificationData.type, // 'schedule_change', 'ministro_assigned', 'status_update', etc.
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data || {}, // Datos adicionales
      read: false,
      createdAt: new Date().toISOString()
    };

    notifications.push(newNotification);
    this.saveAll(notifications);

    return newNotification;
  }

  /**
   * Marca una notificación como leída
   */
  markAsRead(notificationId) {
    const notifications = this.getAll();
    const notification = notifications.find(n => n.id === notificationId);

    if (notification) {
      notification.read = true;
      notification.readAt = new Date().toISOString();
      this.saveAll(notifications);
      return notification;
    }

    return null;
  }

  /**
   * Marca todas las notificaciones de un usuario como leídas
   */
  markAllAsRead(userId) {
    const notifications = this.getAll();
    let updated = 0;

    notifications.forEach(notification => {
      if (notification.userId === userId && !notification.read) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
        updated++;
      }
    });

    if (updated > 0) {
      this.saveAll(notifications);
    }

    return updated;
  }

  /**
   * Elimina una notificación
   */
  delete(notificationId) {
    const notifications = this.getAll();
    const filtered = notifications.filter(n => n.id !== notificationId);

    if (filtered.length < notifications.length) {
      this.saveAll(filtered);
      return true;
    }

    return false;
  }

  /**
   * Elimina todas las notificaciones de un usuario
   */
  deleteAllByUserId(userId) {
    const notifications = this.getAll();
    const filtered = notifications.filter(n => n.userId !== userId);

    const deletedCount = notifications.length - filtered.length;
    if (deletedCount > 0) {
      this.saveAll(filtered);
    }

    return deletedCount;
  }

  /**
   * Notifica cambio de horario de asamblea
   */
  notifyScheduleChange(userId, oldSchedule, newSchedule, organizationName) {
    const oldDate = new Date(oldSchedule.date);
    const newDate = new Date(newSchedule.date);

    return this.create({
      userId,
      type: 'schedule_change',
      title: '📅 Cambio de Horario de Asamblea',
      message: `La asamblea de ${organizationName} ha cambiado de horario.\n\n` +
        `❌ Anterior: ${oldDate.toLocaleDateString('es-CL')} a las ${oldSchedule.time}\n` +
        `✅ Nueva: ${newDate.toLocaleDateString('es-CL')} a las ${newSchedule.time}`,
      data: {
        organizationName,
        oldSchedule,
        newSchedule
      }
    });
  }

  /**
   * Notifica asignación de Ministro de Fe
   */
  notifyMinistroAssigned(userId, ministroData, organizationName) {
    const date = new Date(ministroData.scheduledDate);

    return this.create({
      userId,
      type: 'ministro_assigned',
      title: '⚖️ Ministro de Fe Asignado',
      message: `Se ha asignado un Ministro de Fe para la asamblea de ${organizationName}.\n\n` +
        `Ministro: ${ministroData.name}\n` +
        `Fecha: ${date.toLocaleDateString('es-CL')}\n` +
        `Hora: ${ministroData.scheduledTime}\n` +
        `Lugar: ${ministroData.location}`,
      data: {
        organizationName,
        ministro: ministroData
      }
    });
  }

  /**
   * Notifica cambio de estado de solicitud
   */
  notifyStatusUpdate(userId, organizationName, oldStatus, newStatus) {
    const statusLabels = {
      pending: 'Pendiente',
      approved: 'Aprobada',
      rejected: 'Rechazada',
      ministro_requested: 'Requiere Ministro de Fe',
      ministro_scheduled: 'Ministro Agendado',
      completed: 'Completada'
    };

    return this.create({
      userId,
      type: 'status_update',
      title: '🔔 Actualización de Solicitud',
      message: `La solicitud de ${organizationName} ha cambiado de estado.\n\n` +
        `Estado anterior: ${statusLabels[oldStatus] || oldStatus}\n` +
        `Nuevo estado: ${statusLabels[newStatus] || newStatus}`,
      data: {
        organizationName,
        oldStatus,
        newStatus
      }
    });
  }

  /**
   * Guarda todas las notificaciones
   */
  saveAll(notifications) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(notifications));
    } catch (error) {
      console.error('Error al guardar notificaciones:', error);
      throw new Error('No se pudo guardar las notificaciones');
    }
  }

  /**
   * Obtiene contador de notificaciones no leídas
   */
  getUnreadCount(userId) {
    return this.getUnreadByUserId(userId).length;
  }
}

// Exportar instancia singleton
export const notificationService = new NotificationService();
