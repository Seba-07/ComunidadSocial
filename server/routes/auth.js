import express from 'express';
import User from '../models/User.js';
import { generateToken, authenticate, COOKIE_OPTIONS } from '../middleware/auth.js';
import { authLimiter, registerLimiter, sensitiveLimiter } from '../middleware/security.js';
import { validate, registerSchema, loginSchema, changePasswordSchema } from '../middleware/validation.js';

const router = express.Router();

// Register - Rate limited: 3 registros por hora por IP + validación Zod
router.post('/register', registerLimiter, validate(registerSchema), async (req, res) => {
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

    // Enviar token SOLO en cookie HttpOnly (seguro)
    // SEGURIDAD: NO enviar token en body para prevenir exposición
    res.cookie('auth_token', token, COOKIE_OPTIONS);

    // Respuesta sin token - solo datos de usuario necesarios para UI
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        _id: user._id,
        rut: user.rut,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        address: user.address || '',
        role: user.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Login - Rate limited: 5 intentos por 15 minutos (previene fuerza bruta) + validación Zod
router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
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

    // Enviar token SOLO en cookie HttpOnly (seguro)
    // SEGURIDAD: NO enviar token en body para prevenir exposición
    res.cookie('auth_token', token, COOKIE_OPTIONS);

    // Respuesta sin token - solo datos de usuario necesarios para UI
    res.json({
      message: 'Inicio de sesión exitoso',
      user: {
        _id: user._id,
        rut: user.rut,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        address: user.address || '',
        region: user.region || '',
        commune: user.commune || '',
        role: user.role,
        mustChangePassword: user.mustChangePassword
      },
      mustChangePassword: user.mustChangePassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Get current user - devuelve datos completos del perfil (sin password)
router.get('/me', authenticate, async (req, res) => {
  const user = req.user;
  res.json({
    user: {
      _id: user._id,
      rut: user.rut || '',
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      address: user.address || '',
      region: user.region || '',
      commune: user.commune || '',
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
      mustChangePassword: user.mustChangePassword
    }
  });
});

// Update profile - actualizar datos personales del usuario autenticado
router.post('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Solo permitir campos de perfil (no role, password, etc.)
    const allowedFields = ['firstName', 'lastName', 'phone', 'address', 'region', 'commune'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    }

    await user.save();

    res.json({
      user: {
        _id: user._id,
        rut: user.rut || '',
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        address: user.address || '',
        region: user.region || '',
        commune: user.commune || '',
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// Change password - Rate limited: 3 intentos por hora (operación sensible) + validación Zod
router.post('/change-password', authenticate, sensitiveLimiter, validate(changePasswordSchema), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.userId);
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ error: 'Contraseña actual incorrecta' });
    }

    // Validar nueva contraseña (mínimo 6 caracteres + una mayúscula)
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({ error: 'La contraseña debe contener al menos una mayúscula' });
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

// Login de socio (miembro) - con apellido + RUT
router.post('/login-socio', authLimiter, async (req, res) => {
  try {
    const { lastName, rut } = req.body;

    if (!lastName || !rut) {
      return res.status(400).json({ error: 'Apellido y RUT son requeridos' });
    }

    // Limpiar RUT (sin puntos ni guión)
    const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();

    // Buscar usuario MIEMBRO por apellido (case-insensitive) y activo
    const user = await User.findOne({
      role: 'MIEMBRO',
      lastName: { $regex: new RegExp(`^${lastName.trim()}$`, 'i') },
      active: true
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu apellido paterno.' });
    }

    // Comparar password con RUT limpio
    const isMatch = await user.comparePassword(cleanRut);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu RUT.' });
    }

    const token = generateToken(user);
    res.cookie('auth_token', token, COOKIE_OPTIONS);

    res.json({
      message: 'Inicio de sesión exitoso',
      user: {
        _id: user._id,
        rut: user.rut,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        mustChangePassword: user.mustChangePassword
      },
      mustChangePassword: user.mustChangePassword
    });
  } catch (error) {
    console.error('Login socio error:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Logout - Eliminar cookie de autenticación
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token', { path: '/' });
  res.json({ message: 'Sesión cerrada exitosamente' });
});

export default router;
