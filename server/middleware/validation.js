/**
 * Middleware de Validación con Zod
 * Esquemas de validación para endpoints críticos
 */

import { z } from 'zod';
import { validateRut, cleanRut, formatRut } from '../utils/rutValidator.js';

// ============================================
// CONSTANTES LEY 19.418
// ============================================

// Mínimo de miembros según tipo de organización (Ley 19.418)
const MINIMUM_MEMBERS_BY_TYPE = {
  'JUNTA_VECINOS': 200,  // Art. 40 Ley 19.418
  'COMITE_VECINOS': 15,  // Organizaciones funcionales
  // Todas las demás organizaciones funcionales
  DEFAULT: 15
};

/**
 * Calcula la edad a partir de una fecha de nacimiento
 * @param {string} birthDate - Fecha en formato ISO
 * @returns {number|null} Edad en años o null si no es válida
 */
function calculateAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// ============================================
// ESQUEMAS DE VALIDACIÓN
// ============================================

// RUT chileno con validación de dígito verificador
const rutSchema = z.string()
  .min(8, 'RUT debe tener al menos 8 caracteres')
  .max(12, 'RUT no puede tener más de 12 caracteres')
  .refine((val) => {
    // Permitir formato con o sin puntos/guion
    const cleaned = cleanRut(val);
    return /^\d{7,8}[\dkK]$/i.test(cleaned);
  }, { message: 'Formato de RUT inválido' })
  .refine((val) => {
    const result = validateRut(val);
    return result.valid;
  }, { message: 'Dígito verificador de RUT inválido' })
  .transform((val) => formatRut(val)); // Normalizar formato

// Email
const emailSchema = z.string()
  .email('Email inválido')
  .max(100, 'Email no puede tener más de 100 caracteres')
  .toLowerCase();

// Password - mínimo 8 caracteres + mayúscula + minúscula + número
const passwordSchema = z.string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(100, 'La contraseña no puede tener más de 100 caracteres')
  .refine((val) => /[A-Z]/.test(val), { message: 'Debe contener al menos una mayúscula' })
  .refine((val) => /[a-z]/.test(val), { message: 'Debe contener al menos una minúscula' })
  .refine((val) => /[0-9]/.test(val), { message: 'Debe contener al menos un número' });

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
  address: z.string().max(200).optional(),
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Debe aceptar la política de privacidad' })
  })
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
}).passthrough();

/**
 * Esquema para miembro de organización
 */
const memberSchema = z.object({
  rut: rutSchema,
  firstName: nameSchema,
  segundoNombre: z.string().max(50).optional().or(z.literal('')),
  lastName: nameSchema,
  apellidoMaterno: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  phone: phoneSchema,
  email: z.string().optional().or(z.literal('')),
  birthDate: z.string().optional().or(z.literal('')),
  occupation: z.string().max(100).optional().or(z.literal('')),
  genero: z.enum(['masculino', 'femenino', 'otro', 'no_especifica', '']).optional(),
  role: z.enum(['president', 'secretary', 'treasurer', 'director', 'member', 'electoral_commission']).optional(),
  signature: z.string().optional(),
  certificate: z.string().optional()
}).passthrough();

/**
 * Esquema para crear organización
 */
/**
 * Esquema para certificado de miembro (Paso 5 del wizard)
 */
const certificateStep5Schema = z.object({
  memberId: z.string().optional(),
  memberName: z.string().optional(),
  rut: z.string().optional(),
  name: z.string().optional(),
  fileName: z.string().optional(),
  type: z.string().optional(),
  base64: z.string().optional(),
  certificate: z.string().optional(), // Base64
  data: z.string().optional() // Alias para certificate
}).passthrough();

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
    'ORG_COMUNITARIA', 'ORG_FUNCIONAL', 'OTRA_FUNCIONAL',
    'CONSEJO_ESCOLAR', 'CENTRO_ESTUDIANTES',
    'COMITE_SEGURIDAD', 'UNION_COMUNAL_JV', 'AGRUPACION_INCLUSION'
  ]),
  address: z.string().min(5).max(200),
  comuna: z.string().max(50).optional(),
  region: z.string().max(50).optional(),
  unidadVecinal: z.string().max(100).optional().or(z.literal('')),
  territory: z.string().max(100).optional().or(z.literal('')),
  description: z.string().max(2000).optional().or(z.literal('')),
  objectives: z.string().max(2000).optional().or(z.literal('')),
  contactEmail: emailSchema.optional().or(z.literal('')),
  contactPhone: phoneSchema,
  contactPreference: z.enum(['phone', 'email']).optional(),
  members: z.array(memberSchema).min(1, 'Debe tener al menos 1 miembro'),
  electoralCommission: z.array(memberSchema).optional(),
  provisionalDirectorio: z.object({
    president: memberSchema.optional().nullable(),
    vicePresident: memberSchema.optional().nullable(),
    secretary: memberSchema.optional().nullable(),
    treasurer: memberSchema.optional().nullable(),
    additionalMembers: z.array(memberSchema).optional()
  }).passthrough().optional(),
  electionDate: z.string().optional().nullable(),
  electionTime: z.string().optional().nullable(),
  assemblyAddress: z.string().max(200).optional().nullable(),
  comments: z.string().max(1000).optional().nullable(),
  estatutos: z.string().optional().or(z.literal('')),
  // certificatesStep5 es un objeto con keys dinámicas (presidente, secretario, etc.)
  certificatesStep5: z.record(z.string(), certificateStep5Schema).optional()
}).passthrough()
// ============================================
// VALIDACIONES LEY 19.418
// ============================================
.refine((data) => {
  // Validar mínimo de miembros según tipo de organización
  const minMembers = MINIMUM_MEMBERS_BY_TYPE[data.organizationType] || MINIMUM_MEMBERS_BY_TYPE.DEFAULT;
  return data.members.length >= minMembers;
}, {
  message: 'Cantidad de miembros insuficiente según Ley 19.418',
  path: ['members']
})
.refine((data) => {
  // Validar que todos los miembros tengan al menos 14 años
  for (const member of data.members) {
    if (member.birthDate) {
      const age = calculateAge(member.birthDate);
      if (age !== null && age < 14) {
        return false;
      }
    }
  }
  return true;
}, {
  message: 'Todos los miembros deben tener al menos 14 años según Ley 19.418',
  path: ['members']
})
.refine((data) => {
  // Validar que los directivos (presidente, secretario, tesorero) tengan 18+ años
  const directorio = data.provisionalDirectorio;
  if (!directorio) return true; // Si no hay directorio, no validar

  const directivos = [
    directorio.president,
    directorio.secretary,
    directorio.treasurer,
    ...(directorio.additionalMembers || [])
  ].filter(Boolean);

  for (const directivo of directivos) {
    if (directivo.birthDate) {
      const age = calculateAge(directivo.birthDate);
      if (age !== null && age < 18) {
        return false;
      }
    }
  }
  return true;
}, {
  message: 'Los miembros del Directorio deben tener al menos 18 años según Ley 19.418',
  path: ['provisionalDirectorio']
})
.refine((data) => {
  // Validar que la comisión electoral tenga miembros mayores de 18 años
  const comision = data.electoralCommission || [];
  for (const miembro of comision) {
    if (miembro.birthDate) {
      const age = calculateAge(miembro.birthDate);
      if (age !== null && age < 18) {
        return false;
      }
    }
  }
  return true;
}, {
  message: 'Los miembros de la Comisión Electoral deben tener al menos 18 años según Ley 19.418',
  path: ['electoralCommission']
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
    'pending_review', 'in_review', 'rejected', 'sent_registry',
    'registry_observations', // Estado cuando Registro Civil tiene observaciones
    'approved', 'dissolved'
  ]),
  comment: z.string().max(500).optional()
});

/**
 * Esquema para rechazo con correcciones (v2 – ítems específicos)
 */
const correctionItemSchema = z.object({
  category: z.enum(['datos_generales', 'directorio', 'comision_electoral', 'miembros', 'documentos', 'certificados']),
  field: z.string().optional(),
  memberId: z.string().optional(),
  memberName: z.string().optional(),
  role: z.string().optional(),
  docType: z.string().optional(),
  label: z.string().min(1),
  message: z.string().max(1000).default('Requiere corrección')
});

export const rejectWithCorrectionsSchema = z.object({
  corrections: z.array(correctionItemSchema).min(1),
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
        // Formatear errores de validación (Zod v4 usa .issues en vez de .errors)
        const zodErrors = error.issues || error.errors || [];
        const errors = zodErrors.map(err => ({
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
