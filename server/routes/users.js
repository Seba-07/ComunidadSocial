import express from 'express';
import User from '../models/User.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all users (Admin only)
router.get('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const users = await User.find({ role: 'ORGANIZADOR' }).sort({ createdAt: -1 });
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
    if (req.params.id !== req.userId.toString() && req.user.role !== 'MUNICIPALIDAD') {
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
    if (req.params.id !== req.userId.toString() && req.user.role !== 'MUNICIPALIDAD') {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Don't allow changing role unless admin
    if (req.body.role && req.user.role !== 'MUNICIPALIDAD') {
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
router.post('/:id/toggle-active', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
router.delete('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const result = await User.deleteOne({ _id: req.params.id, role: 'ORGANIZADOR' });
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
router.get('/stats/counts', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const total = await User.countDocuments({ role: 'ORGANIZADOR' });
    const active = await User.countDocuments({ role: 'ORGANIZADOR', active: true });

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

// ============================================
// RUTAS PARA TIMBRE VIRTUAL Y FIRMA DIGITAL
// ============================================

// Obtener timbre y firma del usuario actual
router.get('/me/timbre-firma', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      timbreVirtual: user.timbreVirtual || { imagen: null, activo: false },
      firmaDigital: user.firmaDigital || { imagen: null, activo: false }
    });
  } catch (error) {
    console.error('Get timbre/firma error:', error);
    res.status(500).json({ error: 'Error al obtener timbre/firma' });
  }
});

// Subir timbre virtual
router.post('/me/timbre-virtual', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { imagen } = req.body;

    if (!imagen) {
      return res.status(400).json({ error: 'La imagen del timbre es requerida' });
    }

    // Validar que sea base64 de imagen
    if (!imagen.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Formato de imagen inválido' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.timbreVirtual = {
      imagen: imagen,
      fechaSubida: new Date(),
      activo: true
    };

    await user.save();

    res.json({
      message: 'Timbre virtual guardado correctamente',
      timbreVirtual: user.timbreVirtual
    });
  } catch (error) {
    console.error('Upload timbre error:', error);
    res.status(500).json({ error: 'Error al guardar timbre virtual' });
  }
});

// Subir firma digital
router.post('/me/firma-digital', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { imagen } = req.body;

    if (!imagen) {
      return res.status(400).json({ error: 'La imagen de la firma es requerida' });
    }

    if (!imagen.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Formato de imagen inválido' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.firmaDigital = {
      imagen: imagen,
      fechaSubida: new Date(),
      activo: true
    };

    await user.save();

    res.json({
      message: 'Firma digital guardada correctamente',
      firmaDigital: user.firmaDigital
    });
  } catch (error) {
    console.error('Upload firma error:', error);
    res.status(500).json({ error: 'Error al guardar firma digital' });
  }
});

// Eliminar timbre virtual
router.delete('/me/timbre-virtual', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.timbreVirtual = {
      imagen: null,
      fechaSubida: null,
      activo: false
    };

    await user.save();

    res.json({ message: 'Timbre virtual eliminado' });
  } catch (error) {
    console.error('Delete timbre error:', error);
    res.status(500).json({ error: 'Error al eliminar timbre' });
  }
});

// Eliminar firma digital
router.delete('/me/firma-digital', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.firmaDigital = {
      imagen: null,
      fechaSubida: null,
      activo: false
    };

    await user.save();

    res.json({ message: 'Firma digital eliminada' });
  } catch (error) {
    console.error('Delete firma error:', error);
    res.status(500).json({ error: 'Error al eliminar firma' });
  }
});

// Toggle activar/desactivar timbre
router.post('/me/timbre-virtual/toggle', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!user.timbreVirtual?.imagen) {
      return res.status(400).json({ error: 'No hay timbre configurado' });
    }

    user.timbreVirtual.activo = !user.timbreVirtual.activo;
    await user.save();

    res.json({
      message: user.timbreVirtual.activo ? 'Timbre activado' : 'Timbre desactivado',
      activo: user.timbreVirtual.activo
    });
  } catch (error) {
    console.error('Toggle timbre error:', error);
    res.status(500).json({ error: 'Error al cambiar estado del timbre' });
  }
});

export default router;
