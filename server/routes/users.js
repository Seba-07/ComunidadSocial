import express from 'express';
import User from '../models/User.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all users (Admin only)
router.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const users = await User.find({ role: 'USER' }).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Get user by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    // Only self or admin can view
    if (req.params.id !== req.userId.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// Update user profile
router.put('/:id', authenticate, async (req, res) => {
  try {
    // Only self or admin can update
    if (req.params.id !== req.userId.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Don't allow changing role unless admin
    if (req.body.role && req.user.role !== 'ADMIN') {
      delete req.body.role;
    }

    // Don't update password through this endpoint
    delete req.body.password;

    Object.assign(user, req.body);
    await user.save();

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// Toggle user active status (Admin only)
router.post('/:id/toggle-active', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.active = !user.active;
    await user.save();

    res.json(user);
  } catch (error) {
    console.error('Toggle active error:', error);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const result = await User.deleteOne({ _id: req.params.id, role: 'USER' });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// Get statistics (Admin only)
router.get('/stats/counts', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const total = await User.countDocuments({ role: 'USER' });
    const active = await User.countDocuments({ role: 'USER', active: true });

    res.json({
      total,
      active,
      inactive: total - active
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

export default router;
