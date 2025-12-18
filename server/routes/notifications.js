import express from 'express';
import Notification from '../models/Notification.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get user's notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// Get unread count
router.get('/unread/count', authenticate, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.userId,
      read: false
    });
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Error al contar notificaciones' });
  }
});

// Get unread notifications
router.get('/unread', authenticate, async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.userId,
      read: false
    }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error('Get unread notifications error:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// Mark notification as read
router.post('/:id/read', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    res.json(notification);
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Error al marcar como leída' });
  }
});

// Mark all as read
router.post('/read-all', authenticate, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.userId, read: false },
      { read: true, readAt: new Date() }
    );
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Error al marcar notificaciones' });
  }
});

// Delete notification
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await Notification.deleteOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    res.json({ message: 'Notificación eliminada' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Error al eliminar notificación' });
  }
});

// Delete all read notifications
router.delete('/read/all', authenticate, async (req, res) => {
  try {
    await Notification.deleteMany({
      userId: req.userId,
      read: true
    });
    res.json({ message: 'Notificaciones leídas eliminadas' });
  } catch (error) {
    console.error('Delete read notifications error:', error);
    res.status(500).json({ error: 'Error al eliminar notificaciones' });
  }
});

// Create notification (internal use, but exposed for testing)
router.post('/', authenticate, async (req, res) => {
  try {
    // Si viene ministroId, es una notificación para ministro
    // Si viene userId, es una notificación para usuario
    const notificationData = { ...req.body };

    // Solo asignar userId del token si no viene ningún ID específico
    if (!notificationData.userId && !notificationData.ministroId) {
      notificationData.userId = req.userId;
    }

    const notification = new Notification(notificationData);
    await notification.save();
    res.status(201).json(notification);
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Error al crear notificación' });
  }
});

// ==================== MINISTRO NOTIFICATIONS ====================

// Get ministro's notifications
router.get('/ministro/:ministroId', authenticate, async (req, res) => {
  try {
    const notifications = await Notification.find({ ministroId: req.params.ministroId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    console.error('Get ministro notifications error:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// Get ministro's unread count
router.get('/ministro/:ministroId/unread/count', authenticate, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      ministroId: req.params.ministroId,
      read: false
    });
    res.json({ count });
  } catch (error) {
    console.error('Get ministro unread count error:', error);
    res.status(500).json({ error: 'Error al contar notificaciones' });
  }
});

// Mark ministro notification as read
router.post('/ministro/:notificationId/read', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.notificationId,
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    res.json(notification);
  } catch (error) {
    console.error('Mark ministro notification read error:', error);
    res.status(500).json({ error: 'Error al marcar como leída' });
  }
});

// Mark all ministro notifications as read
router.post('/ministro/:ministroId/read-all', authenticate, async (req, res) => {
  try {
    await Notification.updateMany(
      { ministroId: req.params.ministroId, read: false },
      { read: true, readAt: new Date() }
    );
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    console.error('Mark all ministro read error:', error);
    res.status(500).json({ error: 'Error al marcar notificaciones' });
  }
});

// Delete ministro notification
router.delete('/ministro/:notificationId', authenticate, async (req, res) => {
  try {
    const result = await Notification.deleteOne({
      _id: req.params.notificationId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    res.json({ message: 'Notificación eliminada' });
  } catch (error) {
    console.error('Delete ministro notification error:', error);
    res.status(500).json({ error: 'Error al eliminar notificación' });
  }
});

export default router;
