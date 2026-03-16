import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import Consent from '../models/Consent.js';
import Organization from '../models/Organization.js';
import { generateToken, generateRefreshToken, authenticate, COOKIE_OPTIONS, REFRESH_COOKIE_OPTIONS, EFFECTIVE_JWT_SECRET } from '../middleware/auth.js';
import { authLimiter, registerLimiter, sensitiveLimiter } from '../middleware/security.js';
import { validate, registerSchema, loginSchema, changePasswordSchema, loginSocioSchema } from '../middleware/validation.js';
import { emailService } from '../services/emailService.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Helper: generate email verification token
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper: get frontend base URL (strict — no fallbacks in production)
function getFrontendUrl() {
  const url = process.env.FRONTEND_URL;
  if (!url) {
    const isDeployed = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
    if (isDeployed) {
      throw new Error('FRONTEND_URL no está definida en las variables de entorno. No se puede generar enlaces para correos.');
    }
    return 'http://localhost:5173';
  }
  // Remove trailing slash to avoid double slashes
  return url.replace(/\/+$/, '');
}

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

    // Generate email verification token
    const verificationToken = generateVerificationToken();

    const user = new User({
      rut,
      firstName,
      lastName,
      email,
      password,
      phone,
      address,
      role: 'ORGANIZADOR',
      privacyAcceptedAt: new Date(),
      privacyPolicyVersion: '1.0',
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    await user.save();

    // Create essential consent record
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    await Consent.create({
      userId: user._id,
      purpose: 'essential',
      granted: true,
      grantedAt: new Date(),
      version: '1.0',
      ipAddress: clientIp
    });

    // Send verification email (non-blocking)
    const verifyUrl = `${getFrontendUrl()}/app/verify-email?token=${verificationToken}`;
    emailService.sendVerificationEmail({
      email, userName: firstName, verifyUrl
    }).catch(err => console.error('Verification email error:', err.message));

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('auth_token', token, COOKIE_OPTIONS);
    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        _id: user._id,
        rut: user.rut,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        address: user.address || '',
        role: user.role,
        emailVerified: false
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

    // Account lockout check
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
      return res.status(423).json({ error: `Cuenta bloqueada por demasiados intentos fallidos. Intente en ${minutesLeft} minutos.` });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Increment failed attempts
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const update = { failedLoginAttempts: attempts };
      if (attempts >= 5) {
        update.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min lockout
      }
      await User.findByIdAndUpdate(user._id, update);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0) {
      await User.findByIdAndUpdate(user._id, { failedLoginAttempts: 0, lockedUntil: null });
    }

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('auth_token', token, COOKIE_OPTIONS);
    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
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
        mustChangePassword: user.mustChangePassword,
        emailVerified: user.emailVerified
      },
      mustChangePassword: user.mustChangePassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Refresh token - get new access token using refresh token
router.post('/refresh', async (req, res) => {
  try {
    let refreshToken = null;

    if (req.cookies && req.cookies.refresh_token) {
      refreshToken = req.cookies.refresh_token;
    }

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token requerido' });
    }

    const decoded = jwt.verify(refreshToken, EFFECTIVE_JWT_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuario no válido' });
    }

    // Check token version (normalize undefined to 0 for older users)
    const tokenVer = decoded.tokenVersion ?? 0;
    const userVer = user.tokenVersion ?? 0;
    if (tokenVer !== userVer) {
      return res.status(401).json({ error: 'Sesión invalidada' });
    }

    // Issue new access token + rotate refresh token (F2.3 security)
    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);
    res.cookie('auth_token', newToken, COOKIE_OPTIONS);
    res.cookie('refresh_token', newRefreshToken, REFRESH_COOKIE_OPTIONS);

    res.json({ message: 'Token renovado', token: newToken });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expirado. Inicie sesión nuevamente.' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
});

// Verify email
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Token de verificación inválido o expirado' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    res.json({ message: 'Email verificado exitosamente', emailVerified: true });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Error al verificar email' });
  }
});

// Resend verification email
router.post('/resend-verification', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (user.emailVerified) {
      return res.json({ message: 'Email ya verificado' });
    }

    // Generate new token
    const verificationToken = generateVerificationToken();
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const verifyUrl = `${getFrontendUrl()}/app/verify-email?token=${verificationToken}`;
    await emailService.sendVerificationEmail({
      email: user.email, userName: user.firstName, verifyUrl
    });

    res.json({ message: 'Email de verificación reenviado' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Error al reenviar verificación' });
  }
});

// Get current user - devuelve datos completos del perfil (sin password)
router.get('/me', authenticate, async (req, res) => {
  const user = req.user;
  const responseUser = {
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
    mustChangePassword: user.mustChangePassword,
    emailVerified: user.emailVerified
  };
  // Incluir organizationIds para MIEMBRO
  if (user.role === 'MIEMBRO') {
    responseUser.organizationIds = user.getAllOrgIds();
  }
  res.json({ user: responseUser });
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

// Change password - Rate limited + invalidates all other sessions
router.post('/change-password', authenticate, sensitiveLimiter, validate(changePasswordSchema), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.userId);
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ error: 'Contraseña actual incorrecta' });
    }

    // Validación reforzada (complementa Zod schema)
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'La contraseña debe contener mayúscula, minúscula y número' });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    // Increment tokenVersion to invalidate all existing sessions
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Issue new tokens with updated tokenVersion
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    res.cookie('auth_token', token, COOKIE_OPTIONS);
    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);

    res.json({ message: 'Contraseña actualizada exitosamente. Otras sesiones han sido cerradas.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// Forgot password - solicitar enlace de recuperación
// Rate limited: 3 por hora (sensitiveLimiter)
router.post('/forgot-password', sensitiveLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El email es requerido' });
    }

    // Always return success to prevent email enumeration
    const successMessage = 'Si el correo existe en nuestro sistema, recibirás un enlace de recuperación.';

    const user = await User.findOne({ email: email.toLowerCase(), active: true });
    if (!user) {
      return res.json({ message: successMessage });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send email with reset link
    const resetUrl = `${getFrontendUrl()}/app/reset-password/${resetToken}`;
    emailService.sendPasswordResetEmail({
      email: user.email,
      userName: user.firstName,
      resetUrl
    }).catch(err => console.error('Password reset email error:', err.message));

    res.json({ message: successMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Error al procesar solicitud' });
  }
});

// Reset password - usar token para establecer nueva contraseña
router.post('/reset-password', sensitiveLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token y nueva contraseña son requeridos' });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'La contraseña debe contener mayúscula, minúscula y número' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'El enlace de recuperación es inválido o ha expirado' });
    }

    // Update password and clear reset token
    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.mustChangePassword = false;
    // Invalidate all existing sessions
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.json({ message: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Error al restablecer contraseña' });
  }
});

// Login de socio (miembro) - con apellido + RUT
router.post('/login-socio', authLimiter, validate(loginSocioSchema), async (req, res) => {
  try {
    const { lastName, rut } = req.body;

    if (!lastName || !rut) {
      return res.status(400).json({ error: 'Apellido y RUT son requeridos' });
    }

    // Limpiar RUT (sin puntos ni guión)
    const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();

    // Buscar usuario MIEMBRO por apellido (case-insensitive) y activo
    const escapedLastName = lastName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({
      role: 'MIEMBRO',
      lastName: { $regex: new RegExp(`^${escapedLastName}$`, 'i') },
      active: true
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu apellido paterno.' });
    }

    // Account lockout check
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
      return res.status(423).json({ error: `Cuenta bloqueada. Intente en ${minutesLeft} minutos.` });
    }

    // Comparar password con RUT limpio
    const isMatch = await user.comparePassword(cleanRut);
    if (!isMatch) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const update = { failedLoginAttempts: attempts };
      if (attempts >= 5) {
        update.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      }
      await User.findByIdAndUpdate(user._id, update);
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu RUT.' });
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0) {
      await User.findByIdAndUpdate(user._id, { failedLoginAttempts: 0, lockedUntil: null });
    }

    // Obtener todas las organizaciones del miembro
    const orgIds = user.getAllOrgIds();
    let organizations = [];
    if (orgIds.length > 0) {
      const orgs = await Organization.find({ _id: { $in: orgIds } }).select('organizationName').lean();
      organizations = orgs.map(o => ({ _id: o._id, name: o.organizationName }));
    }

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    res.cookie('auth_token', token, COOKIE_OPTIONS);
    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        _id: user._id,
        rut: user.rut,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        organizationIds: orgIds,
        organizations: organizations,
        mustChangePassword: user.mustChangePassword,
        privacyAcceptedAt: user.privacyAcceptedAt || null
      },
      mustChangePassword: user.mustChangePassword
    });
  } catch (error) {
    console.error('Login socio error:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Accept privacy policy (for members on first login)
router.post('/accept-privacy', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (user.privacyAcceptedAt) {
      return res.json({ message: 'Política ya aceptada', privacyAcceptedAt: user.privacyAcceptedAt });
    }

    user.privacyAcceptedAt = new Date();
    user.privacyPolicyVersion = '1.0';
    await user.save();

    // Ensure essential consent exists
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    await Consent.findOneAndUpdate(
      { userId: user._id, purpose: 'essential' },
      { $set: { granted: true, grantedAt: new Date(), version: '1.0', ipAddress: clientIp } },
      { upsert: true }
    );

    res.json({ message: 'Política de privacidad aceptada', privacyAcceptedAt: user.privacyAcceptedAt });
  } catch (error) {
    console.error('Accept privacy error:', error);
    res.status(500).json({ error: 'Error al aceptar política de privacidad' });
  }
});

// Logout - Eliminar cookies e invalidar sesiones
router.post('/logout', async (req, res) => {
  // Try to invalidate token version if authenticated
  try {
    let token = req.cookies?.auth_token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
      await User.findByIdAndUpdate(decoded.userId, { $inc: { tokenVersion: 1 } });
    }
  } catch {
    // Token may be expired/invalid, just clear cookies
  }

  // Limpiar cookies con los mismos atributos usados al setearlas
  res.clearCookie('auth_token', { path: '/', httpOnly: true, secure: COOKIE_OPTIONS.secure, sameSite: COOKIE_OPTIONS.sameSite });
  res.clearCookie('refresh_token', { path: '/', httpOnly: true, secure: REFRESH_COOKIE_OPTIONS.secure, sameSite: REFRESH_COOKIE_OPTIONS.sameSite });
  res.json({ message: 'Sesión cerrada exitosamente' });
});

export default router;
