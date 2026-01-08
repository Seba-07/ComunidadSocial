/**
 * Middleware de Validación con Zod
 * Esquemas de validación para endpoints críticos
 */

import { z } from 'zod';

// ============================================
// ESQUEMAS DE VALIDACIÓN
// ============================================

// RUT chileno (formato: XX.XXX.XXX-X o XXXXXXXX-X)
const rutSchema = z.string()
  .min(8, 'RUT debe tener al menos 8 caracteres')
  .max(12, 'RUT no puede tener más de 12 caracteres')
  .regex(/^[\d.]{7,10}-[\dkK]$/, 'Formato de RUT inválido');

// Email
const emailSchema = z.string()
  .email('Email inválido')
  .max(100, 'Email no puede tener más de 100 caracteres')
  .toLowerCase();

// Password
const passwordSchema = z.string()
  .min(6, 'La contraseña debe tener al menos 6 caracteres')
  .max(100, 'La contraseña no puede tener más de 100 caracteres');

// Nombre
const nameSchema = z.string()
  .min(2, 'Nombre debe tener al menos 2 caracteres')
  .max(50, 'Nombre no puede tener más de 50 caracteres')
  .trim();

// Teléfono chileno
const phoneSchema = z.string()
  .regex(/^(\+?56)?[\d\s-]{8,15}$/, 'Formato de teléfono inválido')
  .optional()
  .or(z.literal(''));

// ============================================
// ESQUEMAS COMPUESTOS
// ============================================

/**
 * Esquema para registro de usuario
 */
export const registerSchema = z.object({
  rut: rutSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  address: z.string().max(200).optional()
});

/**
 * Esquema para login
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Contraseña requerida')
});

/**
 * Esquema para cambio de contraseña
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: passwordSchema
});

/**
 * Esquema para crear ministro
 */
export const createMinistroSchema = z.object({
  rut: rutSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  address: z.string().max(200).optional(),
  specialty: z.string().max(100).optional(),
  availableHours: z.array(z.string()).optional()
});

/**
 * Esquema para miembro de organización
 */
const memberSchema = z.object({
  rut: rutSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  address: z.string().max(200).optional(),
  phone: phoneSchema,
  email: z.string().email().optional().or(z.literal('')),
  birthDate: z.string().optional(),
  occupation: z.string().max(100).optional(),
  role: z.enum(['president', 'secretary', 'treasurer', 'director', 'member', 'electoral_commission']).optional(),
  signature: z.string().optional(), // Base64
  certificate: z.string().optional() // Base64
});

/**
 * Esquema para crear organización
 */
export const createOrganizationSchema = z.object({
  organizationName: z.string()
    .min(3, 'Nombre de organización debe tener al menos 3 caracteres')
    .max(150, 'Nombre de organización no puede tener más de 150 caracteres')
    .trim(),
  organizationType: z.enum([
    'JUNTA_VECINOS', 'COMITE_VECINOS',
    'CLUB_DEPORTIVO', 'CLUB_ADULTO_MAYOR', 'CLUB_JUVENIL', 'CLUB_CULTURAL',
    'CENTRO_MADRES', 'CENTRO_PADRES', 'CENTRO_CULTURAL',
    'AGRUPACION_FOLCLORICA', 'AGRUPACION_CULTURAL', 'AGRUPACION_JUVENIL',
    'AGRUPACION_AMBIENTAL', 'AGRUPACION_EMPRENDEDORES',
    'COMITE_VIVIENDA', 'COMITE_ALLEGADOS', 'COMITE_APR',
    'COMITE_ADELANTO', 'COMITE_MEJORAMIENTO', 'COMITE_CONVIVENCIA',
    'ORG_SCOUT', 'ORG_MUJERES', 'ORG_INDIGENA', 'ORG_SALUD', 'ORG_SOCIAL', 'ORG_CULTURAL',
    'GRUPO_TEATRO', 'CORO', 'TALLER_ARTESANIA',
    'ORG_COMUNITARIA', 'ORG_FUNCIONAL', 'OTRA_FUNCIONAL'
  ]),
  address: z.string().min(5).max(200),
  comuna: z.string().max(50).optional(),
  region: z.string().max(50).optional(),
  unidadVecinal: z.string().max(100).optional(),
  territory: z.string().max(100).optional(),
  contactEmail: emailSchema.optional(),
  contactPhone: phoneSchema,
  contactPreference: z.enum(['phone', 'email']).optional(),
  members: z.array(memberSchema).min(1, 'Debe tener al menos 1 miembro'),
  electoralCommission: z.array(memberSchema).optional(),
  provisionalDirectorio: z.object({
    president: memberSchema.optional().nullable(),
    secretary: memberSchema.optional().nullable(),
    treasurer: memberSchema.optional().nullable(),
    additionalMembers: z.array(memberSchema).optional()
  }).optional(),
  electionDate: z.string().optional(),
  electionTime: z.string().optional(),
  assemblyAddress: z.string().max(200).optional(),
  comments: z.string().max(1000).optional(),
  estatutos: z.string().optional()
});

/**
 * Esquema para agendar ministro
 */
export const scheduleMinistroSchema = z.object({
  ministroId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de ministro inválido'),
  ministroName: z.string().min(2).max(100),
  ministroRut: rutSchema.optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM)'),
  location: z.string().max(200).optional()
});

/**
 * Esquema para cambio de estado
 */
export const statusChangeSchema = z.object({
  status: z.enum([
    'draft', 'waiting_ministro', 'ministro_scheduled', 'ministro_approved',
    'pending_review', 'in_review', 'rejected', 'sent_registry', 'approved', 'dissolved'
  ]),
  comment: z.string().max(500).optional()
});

/**
 * Esquema para rechazo con correcciones
 */
export const rejectWithCorrectionsSchema = z.object({
  corrections: z.object({
    fields: z.record(z.string()).optional(),
    documents: z.record(z.string()).optional(),
    certificates: z.record(z.string()).optional()
  }),
  generalComment: z.string().max(1000).optional()
});

/**
 * Esquema para notificación
 */
export const createNotificationSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  ministroId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  type: z.string(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  organizationId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  data: z.any().optional()
});

// ============================================
// MIDDLEWARE DE VALIDACIÓN
// ============================================

/**
 * Crea un middleware de validación para un esquema Zod
 * @param {z.ZodSchema} schema - Esquema Zod para validar
 * @returns {Function} Middleware de Express
 */
export const validate = (schema) => {
  return (req, res, next) => {
    try {
      // Validar y transformar los datos
      const validated = schema.parse(req.body);
      // Reemplazar body con datos validados y sanitizados
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Formatear errores de validación
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));

        return res.status(400).json({
          error: 'Datos inválidos',
          details: errors
        });
      }

      // Error inesperado
      console.error('Validation error:', error);
      return res.status(500).json({ error: 'Error de validación interno' });
    }
  };
};

/**
 * Validador de MongoDB ObjectId
 */
export const validateMongoId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (id && !/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        error: `ID inválido: ${paramName}`,
        details: 'El ID debe ser un ObjectId válido de MongoDB'
      });
    }
    next();
  };
};

export default {
  // Esquemas
  registerSchema,
  loginSchema,
  changePasswordSchema,
  createMinistroSchema,
  createOrganizationSchema,
  scheduleMinistroSchema,
  statusChangeSchema,
  rejectWithCorrectionsSchema,
  createNotificationSchema,
  // Middleware
  validate,
  validateMongoId
};
