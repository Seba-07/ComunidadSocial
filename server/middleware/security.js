/**
 * Middleware de Seguridad
 * Incluye: Rate Limiting, Headers de Seguridad, Validación de Input
 */

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// ============================================
// RATE LIMITING
// ============================================

/**
 * Rate limiter general para todas las rutas API
 * 100 requests por minuto por IP
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // máximo 100 requests por ventana
  message: {
    error: 'Demasiadas solicitudes. Por favor espere un momento.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    // Usar X-Forwarded-For si está detrás de proxy (Railway, Vercel)
    return req.ip || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  }
});

/**
 * Rate limiter estricto para autenticación
 * Previene ataques de fuerza bruta
 * 5 intentos fallidos = bloqueo de 15 minutos
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos
  message: {
    error: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Solo contar intentos fallidos
  keyGenerator: (req) => {
    // Combinar IP + email para ser más específico
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
    const email = req.body?.email || '';
    return `${ip}-${email}`;
  }
});

/**
 * Rate limiter para registro de usuarios
 * 3 registros por hora por IP
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 registros por hora
  message: {
    error: 'Demasiados registros desde esta dirección. Intente más tarde.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  }
});

/**
 * Rate limiter para operaciones sensibles (cambio de contraseña, etc)
 * 3 intentos por hora
 */
export const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3,
  message: {
    error: 'Demasiados intentos. Por seguridad, espere una hora.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================
// HEADERS DE SEGURIDAD (Helmet)
// ============================================

/**
 * Configuración de Helmet para headers de seguridad
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.quilljs.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.quilljs.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://comunidadsocial-production.up.railway.app", "https://*.vercel.app"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  // Prevenir clickjacking
  frameguard: { action: 'deny' },
  // Prevenir sniffing de MIME type
  noSniff: true,
  // XSS Protection (legacy pero útil)
  xssFilter: true,
  // Ocultar X-Powered-By
  hidePoweredBy: true,
  // HSTS para HTTPS
  hsts: {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true
  },
  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// ============================================
// VALIDACIÓN DE INPUT
// ============================================

/**
 * Middleware para sanitizar inputs básicos
 * Remueve caracteres peligrosos de strings
 */
export const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Remover null bytes y caracteres de control
        sanitized[key] = value
          .replace(/\0/g, '')
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = Array.isArray(value)
          ? value.map(v => typeof v === 'object' ? sanitize(v) : v)
          : sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
};

/**
 * Middleware para validar ObjectIds de MongoDB
 */
export const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id) {
      return next();
    }

    // Patrón de ObjectId de MongoDB (24 caracteres hexadecimales)
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!objectIdPattern.test(id)) {
      return res.status(400).json({
        error: `ID inválido: ${paramName}`,
        details: 'El ID debe ser un ObjectId válido de MongoDB'
      });
    }

    next();
  };
};

// ============================================
// PROTECCIÓN CONTRA MASS ASSIGNMENT
// ============================================

/**
 * Crea un middleware que solo permite campos específicos en req.body
 * @param {string[]} allowedFields - Lista de campos permitidos
 * @returns {Function} Middleware de Express
 */
export const allowFields = (allowedFields) => {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return next();
    }

    const filteredBody = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        filteredBody[field] = req.body[field];
      }
    }

    // Guardar body original por si se necesita
    req.originalBody = req.body;
    req.body = filteredBody;

    next();
  };
};

/**
 * Campos permitidos por entidad para updates
 */
export const ALLOWED_FIELDS = {
  // Usuario puede actualizar estos campos de su perfil
  userProfile: [
    'firstName', 'lastName', 'phone', 'address',
    'region', 'commune', 'specialty', 'availableHours'
  ],

  // Admin puede actualizar estos campos de usuarios
  userAdmin: [
    'firstName', 'lastName', 'phone', 'address',
    'region', 'commune', 'role', 'active', 'specialty', 'availableHours'
  ],

  // Campos de organización que el organizador puede actualizar
  organization: [
    'organizationName', 'organizationType', 'address', 'comuna',
    'region', 'territory', 'unidadVecinal', 'contactEmail', 'contactPhone',
    'contactPreference', 'members', 'minMembers', 'electoralCommission',
    'provisionalDirectorio', 'electionDate', 'electionTime', 'assemblyAddress',
    'comments', 'estatutos', 'corrections'
  ],

  // Campos que solo admin puede modificar en organización
  organizationAdmin: [
    'status', 'certNumber', 'depositNumber', 'ministroData',
    'ministroSignature', 'validationData', 'statusHistory'
  ],

  // Campos de asignación
  assignment: [
    'scheduledDate', 'scheduledTime', 'location', 'status',
    'signaturesValidated', 'signatures', 'wizardData', 'notes'
  ],

  // Campos de noticia
  news: [
    'title', 'slug', 'excerpt', 'contentHTML', 'category',
    'tags', 'featuredImage', 'isPublished', 'publishedAt', 'isFeatured'
  ]
};

export default {
  generalLimiter,
  authLimiter,
  registerLimiter,
  sensitiveLimiter,
  securityHeaders,
  sanitizeInput,
  validateObjectId,
  allowFields,
  ALLOWED_FIELDS
};
