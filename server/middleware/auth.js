import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';

// Asegurar que las variables de entorno estén cargadas (ESM hoists imports antes de dotenv.config())
dotenv.config();

// SEGURIDAD: JWT_SECRET es OBLIGATORIO
const JWT_SECRET = process.env.JWT_SECRET;
const isDeployed = process.env.NODE_ENV === 'production' ||
                   !!process.env.RAILWAY_ENVIRONMENT ||
                   !!process.env.RAILWAY_PROJECT_ID;

if (!JWT_SECRET && isDeployed) {
  console.error('FATAL: JWT_SECRET no está configurado en entorno desplegado. Abortando.');
  process.exit(1);
}
if (!JWT_SECRET) {
  console.warn('ADVERTENCIA: JWT_SECRET no configurado. Usando secret temporal solo para desarrollo local.');
}
export const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-secret-do-not-use-in-production';

// Opciones para cookies HttpOnly - access token (4 horas)
// Cross-origin (Vercel → Railway): sameSite='none' + secure=true obligatorio
// Desarrollo local (localhost sin HTTPS): sameSite='lax' + secure=false
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isDeployed,
  sameSite: isDeployed ? 'none' : 'lax',
  maxAge: 4 * 60 * 60 * 1000, // 4 horas
  path: '/'
};

// Opciones para refresh token cookie (30 días)
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isDeployed,
  sameSite: isDeployed ? 'none' : 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
  path: '/'
};

console.log(`Cookie config: secure=${isDeployed}, sameSite=${isDeployed ? 'none' : 'lax'} (NODE_ENV=${process.env.NODE_ENV}, RAILWAY=${!!process.env.RAILWAY_ENVIRONMENT})`);

export const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // Prioridad 1: Cookie HttpOnly (método seguro)
    if (req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    }
    // Prioridad 2: Header Authorization (compatibilidad durante transición)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuario no válido o inactivo' });
    }

    // Verify token version (session invalidation on password change)
    const tokenVer = decoded.tokenVersion ?? 0;
    const userVer = user.tokenVersion ?? 0;
    if (tokenVer !== userVer) {
      return res.status(401).json({ error: 'Sesión invalidada. Por favor inicie sesión nuevamente.' });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    res.status(500).json({ error: 'Error de autenticación' });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }

    next();
  };
};

/**
 * Middleware: require verified email after 7 days of registration.
 * Skips for MIEMBRO (created by system) and MUNICIPALIDAD (admin).
 */
export const requireVerifiedEmail = (req, res, next) => {
  // Disabled until SMTP is configured — always allow
  return next();
};

export const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion || 0
    },
    EFFECTIVE_JWT_SECRET,
    { expiresIn: '4h' }
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      type: 'refresh',
      tokenVersion: user.tokenVersion || 0
    },
    EFFECTIVE_JWT_SECRET,
    { expiresIn: '30d' }
  );
};
