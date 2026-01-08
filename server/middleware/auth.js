import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// SEGURIDAD: JWT_SECRET es OBLIGATORIO - no hay fallback
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET no está configurado en variables de entorno');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  } else {
    console.warn('ADVERTENCIA: Usando secret temporal solo para desarrollo');
  }
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-secret-do-not-use-in-production';

// Opciones para cookies HttpOnly
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días (mismo que JWT)
  path: '/'
};

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

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
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

export const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role
    },
    EFFECTIVE_JWT_SECRET,
    { expiresIn: '7d' }
  );
};
