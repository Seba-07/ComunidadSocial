import express from 'express';
import User from '../models/User.js';
import { authenticate, requireRole, generateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all ministros (Admin only)
router.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const ministros = await User.find({ role: 'MINISTRO' }).sort({ createdAt: -1 });
    res.json(ministros);
  } catch (error) {
    console.error('Get ministros error:', error);
    res.status(500).json({ error: 'Error al obtener ministros' });
  }
});

// Get active ministros
router.get('/active', authenticate, async (req, res) => {
  try {
    const ministros = await User.find({ role: 'MINISTRO', active: true })
      .select('firstName lastName rut email phone specialty availableHours');
    res.json(ministros);
  } catch (error) {
    console.error('Get active ministros error:', error);
    res.status(500).json({ error: 'Error al obtener ministros' });
  }
});

// Get ministro by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const ministro = await User.findOne({ _id: req.params.id, role: 'MINISTRO' });
    if (!ministro) {
      return res.status(404).json({ error: 'Ministro no encontrado' });
    }
    res.json(ministro);
  } catch (error) {
    console.error('Get ministro error:', error);
    res.status(500).json({ error: 'Error al obtener ministro' });
  }
});

// Create ministro (Admin only)
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { rut, firstName, lastName, email, phone, address, specialty, password, availableHours } = req.body;

    // Validar contraseña
    if (!password || password.length < 6) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Validar horarios disponibles
    if (!availableHours || !Array.isArray(availableHours) || availableHours.length === 0) {
      return res.status(400).json({
        error: 'Debe seleccionar al menos un horario disponible'
      });
    }

    // Check if exists
    const existing = await User.findOne({ $or: [{ email }, { rut }] });
    if (existing) {
      return res.status(400).json({
        error: existing.email === email
          ? 'Ya existe un usuario con este email'
          : 'Ya existe un usuario con este RUT'
      });
    }

    const ministro = new User({
      rut,
      firstName,
      lastName,
      email,
      password: password, // Will be hashed by pre-save hook
      phone,
      address,
      specialty,
      availableHours,
      role: 'MINISTRO',
      mustChangePassword: true // El ministro deberá cambiar la contraseña
    });

    await ministro.save();

    res.status(201).json({
      ministro,
      message: 'Ministro creado exitosamente'
    });
  } catch (error) {
    console.error('Create ministro error:', error);
    res.status(500).json({ error: 'Error al crear ministro' });
  }
});

// Update ministro (Admin only)
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const ministro = await User.findOne({ _id: req.params.id, role: 'MINISTRO' });
    if (!ministro) {
      return res.status(404).json({ error: 'Ministro no encontrado' });
    }

    // Check for duplicate email/rut if changing
    if (req.body.email && req.body.email !== ministro.email) {
      const existing = await User.findOne({ email: req.body.email });
      if (existing) {
        return res.status(400).json({ error: 'Este email ya está en uso' });
      }
    }

    if (req.body.rut && req.body.rut !== ministro.rut) {
      const existing = await User.findOne({ rut: req.body.rut });
      if (existing) {
        return res.status(400).json({ error: 'Este RUT ya está registrado' });
      }
    }

    Object.assign(ministro, req.body);
    await ministro.save();

    res.json(ministro);
  } catch (error) {
    console.error('Update ministro error:', error);
    res.status(500).json({ error: 'Error al actualizar ministro' });
  }
});

// Toggle active status (Admin only)
router.post('/:id/toggle-active', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const ministro = await User.findOne({ _id: req.params.id, role: 'MINISTRO' });
    if (!ministro) {
      return res.status(404).json({ error: 'Ministro no encontrado' });
    }

    ministro.active = !ministro.active;
    await ministro.save();

    res.json(ministro);
  } catch (error) {
    console.error('Toggle active error:', error);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

// Reset password (Admin only)
router.post('/:id/reset-password', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const ministro = await User.findOne({ _id: req.params.id, role: 'MINISTRO' });
    if (!ministro) {
      return res.status(404).json({ error: 'Ministro no encontrado' });
    }

    const tempPassword = generateTempPassword();
    ministro.password = tempPassword;
    ministro.mustChangePassword = true;
    await ministro.save();

    res.json({
      success: true,
      temporaryPassword: tempPassword
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Error al reiniciar contraseña' });
  }
});

// Delete ministro (Admin only)
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const result = await User.deleteOne({ _id: req.params.id, role: 'MINISTRO' });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Ministro no encontrado' });
    }
    res.json({ message: 'Ministro eliminado' });
  } catch (error) {
    console.error('Delete ministro error:', error);
    res.status(500).json({ error: 'Error al eliminar ministro' });
  }
});

// Ministro login (specific endpoint)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const ministro = await User.findOne({ email: email.toLowerCase(), role: 'MINISTRO' });
    if (!ministro) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!ministro.active) {
      return res.status(401).json({ error: 'Tu cuenta ha sido desactivada' });
    }

    const isMatch = await ministro.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generateToken(ministro);

    res.json({
      ministro,
      token,
      mustChangePassword: ministro.mustChangePassword
    });
  } catch (error) {
    console.error('Ministro login error:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Get statistics
router.get('/stats/counts', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const total = await User.countDocuments({ role: 'MINISTRO' });
    const active = await User.countDocuments({ role: 'MINISTRO', active: true });

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

// Helper function
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export default router;
