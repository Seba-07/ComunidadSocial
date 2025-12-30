import express from 'express';
import User from '../models/User.js';
import { generateToken, authenticate } from '../middleware/auth.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { rut, firstName, lastName, email, password, phone, address } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { rut }] });
    if (existingUser) {
      return res.status(400).json({
        error: existingUser.email === email
          ? 'Este email ya está registrado'
          : 'Este RUT ya está registrado'
      });
    }

    const user = new User({
      rut,
      firstName,
      lastName,
      email,
      password,
      phone,
      address,
      role: 'ORGANIZADOR'
    });

    await user.save();
    const token = generateToken(user);

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user,
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!user.active) {
      return res.status(401).json({ error: 'Tu cuenta ha sido desactivada' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Inicio de sesión exitoso',
      user,
      token,
      mustChangePassword: user.mustChangePassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// Change password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.userId);
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ error: 'Contraseña actual incorrecta' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

export default router;
