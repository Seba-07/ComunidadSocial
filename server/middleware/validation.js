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
  'JUNTA_VECINOS': 50,   // Art. 40 Ley 19.418 — quórum constitutivo
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
  birthDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Fecha de nacimiento inválida'
  }),
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
  birthDate: z.string().min(1, 'Fecha de nacimiento es requerida'),
  occupation: z.string().max(100).optional().or(z.literal('')),
  genero: z.enum(['masculino', 'femenino', 'otro', 'no_especifica', '']).optional(),
  role: z.enum(['president', 'secretary', 'treasurer', 'director', 'member', 'electoral_commission']).optional(),
  signature: z.string().optional(),
  certificate: z.string().optional(),
  inhabilityCertificate: z.string().optional()
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
  organizationType: z.string()
    .min(2, 'Tipo de organización requerido')
    .max(100, 'Tipo de organización demasiado largo'),
  address: z.string().min(5).max(200),
  comuna: z.string().max(50).optional(),
  region: z.string().max(50).optional(),
  unidadVecinal: z.string().max(100).optional().or(z.literal('')),
  territory: z.string().max(100).optional().or(z.literal('')),
  description: z.string().max(2000).optional().or(z.literal('')),
  objectives: z.string().max(2000).optional().or(z.literal('')),
  contactEmail: emailSchema.optional().or(z.literal('')),
  contactPhone: phoneSchema,
  contactPreference: z.enum(['phone', 'email', 'whatsapp']).optional(),
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
  estatutosEditados: z.array(z.object({
    numero: z.number(),
    titulo: z.string(),
    contenido: z.string(),
    orden: z.number().optional()
  })).optional().nullable(),
  config: z.object({
    monedaCuota: z.enum(['UTM', 'UF', 'CLP']).optional(),
    asambleas: z.array(z.string()).optional(),
    cuotaMin: z.number().min(0).optional(),
    cuotaMax: z.number().min(0).optional(),
    cuotaIncorporacion: z.number().min(0).optional(),
    duracionMandato: z.number().min(1).max(10).optional(),
    metodoCitacion: z.enum(['carta_certificada', 'correo_electronico', 'mensajeria_instantanea', 'entrega_personal', 'aviso_sede', 'comunicacion_directa']).optional(),
    diasAnticipacion: z.number().min(1).max(60).optional(),
    tipoEntidadDisolucion: z.enum(['municipalidad', 'bomberos', 'cruz_roja', 'otra', '']).optional(),
    beneficiarioDisolucion: z.string().max(200).optional(),
    rutDisolucion: z.string().max(20).optional(),
    accountReviewMonth: z.string().max(20).optional()
  }).optional(),
  // certificatesStep5 es un objeto con keys dinámicas (presidente, secretario, etc.)
  certificatesStep5: z.record(z.string(), certificateStep5Schema).optional(),
  edadConfig: z.object({
    permiteMenores: z.boolean().optional(),
    edadMinima: z.number().optional(),
    menoresEnDirectorio: z.boolean().optional(),
    menoresEnComisionElectoral: z.boolean().optional()
  }).optional()
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
  // Si la plantilla permite menores en directorio, no validar edad mínima 18
  if (data.edadConfig?.menoresEnDirectorio) return true;

  const directorio = data.provisionalDirectorio;
  if (!directorio) return true;

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
  // Si la plantilla permite menores en comisión electoral, no validar edad mínima 18
  if (data.edadConfig?.menoresEnComisionElectoral) return true;

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
    'pending_review', 'in_review', 'corrections_requested', 'rejected', 'sent_registry',
    'registry_observations',
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
  message: z.string().max(1000).default('Requiere corrección'),
  currentValue: z.string().optional(),
  tab: z.string().optional()
});

export const rejectWithCorrectionsSchema = z.object({
  corrections: z.array(correctionItemSchema).min(1),
  generalComment: z.string().max(1000).optional()
});

export const requestCorrectionsSchema = z.object({
  corrections: z.array(correctionItemSchema).min(1, 'Debe seleccionar al menos un campo para corregir'),
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

// ============================================
// ESQUEMAS FASE 3 — Rutas sin validacion previa
// ============================================

const mongoIdString = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido');

/**
 * Esquema para login de socio
 */
export const loginSocioSchema = z.object({
  lastName: z.string().min(1, 'Apellido requerido').max(100).trim(),
  rut: rutSchema
});

/**
 * Esquema para noticias
 */
export const createNewsSchema = z.object({
  title: z.string().min(1, 'Título requerido').max(200).trim(),
  summary: z.string().max(500).optional().or(z.literal('')),
  contentHTML: z.string().max(51200, 'Contenido excede 50KB').optional().or(z.literal('')),
  category: z.string().max(50).optional().or(z.literal('')),
  tags: z.array(z.string().max(50)).max(20).optional(),
  isPublished: z.boolean().optional(),
  featuredImage: z.string().max(500).optional().or(z.literal(''))
}).passthrough();

export const updateNewsSchema = createNewsSchema.partial();

/**
 * Esquema para guia de constitucion
 */
export const updateGuiaSchema = z.object({
  contentHTML: z.string().max(102400, 'Contenido excede 100KB').optional(),
  isPublished: z.boolean().optional()
});

/**
 * Esquema para bloques de ministro
 */
export const createMinistroBlockSchema = z.object({
  ministroId: mongoIdString,
  ministroName: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido').optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  blockType: z.string().max(50).optional(),
  durationHours: z.number().min(0.5).max(24).optional(),
  fullDay: z.boolean().optional(),
  reason: z.string().max(500).optional().or(z.literal(''))
}).passthrough();

export const createMinistroBlockFromConfirmSchema = z.object({
  assignmentId: mongoIdString,
  ministroId: mongoIdString,
  ministroName: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationHours: z.number().min(0.5).max(24).optional(),
  fullDay: z.boolean().optional(),
  reason: z.string().max(500).optional().or(z.literal(''))
}).passthrough();

/**
 * Esquema para incidentes de seguridad
 */
export const createSecurityIncidentSchema = z.object({
  type: z.enum(['unauthorized_access', 'data_leak', 'system_compromise', 'phishing', 'malware', 'denial_of_service', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string().min(1, 'Título requerido').max(200).trim(),
  description: z.string().min(1, 'Descripción requerida').max(5000),
  dataAffected: z.array(z.string().max(200)).max(50).optional().default([]),
  usersAffectedCount: z.number().int().min(0).optional().default(0),
  measuresTaken: z.string().max(5000).optional().or(z.literal(''))
});

export const updateSecurityIncidentSchema = z.object({
  status: z.enum(['reported', 'investigating', 'contained', 'resolved', 'closed']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  measuresTaken: z.string().max(5000).optional().or(z.literal('')),
  notifiedAgency: z.boolean().optional(),
  notifiedAgencyAt: z.string().optional().nullable(),
  notifiedUsers: z.boolean().optional(),
  notifiedUsersAt: z.string().optional().nullable(),
  resolvedAt: z.string().optional().nullable()
}).passthrough();

/**
 * Esquema para estatuto templates
 */
export const createEstatutoTemplateSchema = z.object({
  tipoOrganizacion: z.string().min(1).max(100),
  nombreTipo: z.string().min(1).max(200).trim(),
  descripcion: z.string().max(2000).optional().or(z.literal('')),
  categoria: z.string().max(100).optional().or(z.literal(''))
}).passthrough();

export const updateEstatutoTemplateSchema = z.object({
  nombreTipo: z.string().max(200).trim().optional(),
  descripcion: z.string().max(2000).optional().or(z.literal('')),
  publicado: z.boolean().optional(),
  descripcionCambio: z.string().max(500).optional().or(z.literal(''))
}).passthrough();

/**
 * Esquema para document templates
 */
export const createDocumentTemplateSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200).trim(),
  documentType: z.string().min(1).max(100),
  content: z.string().max(204800, 'Contenido excede 200KB').optional().or(z.literal('')),
  isDefault: z.boolean().optional(),
  pageSize: z.string().max(20).optional()
}).passthrough();

export const updateDocumentTemplateSchema = z.object({
  name: z.string().max(200).trim().optional(),
  documentType: z.string().max(100).optional(),
  content: z.string().max(204800).optional(),
  isDefault: z.boolean().optional(),
  activo: z.boolean().optional(),
  pageSize: z.string().max(20).optional()
}).passthrough();

/**
 * Esquema para busqueda
 */
export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Término de búsqueda requerido').max(100, 'Búsqueda muy larga').trim(),
  type: z.string().max(50).optional()
});

/**
 * Esquema para library documents (campos no-archivo del upload)
 */
export const libraryDocumentSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional().or(z.literal('')),
  category: z.string().max(50).optional().or(z.literal('')),
  isPublished: z.union([z.boolean(), z.string()]).optional()
});

/**
 * Esquema para tickets de soporte
 */
export const createSupportTicketSchema = z.object({
  description: z.string().min(1, 'Descripcion requerida').max(5000),
  // Optional fields for anonymous users
  name: z.string().max(200).trim().optional(),
  rut: z.string().max(20).optional().or(z.literal('')),
  email: z.string().max(200).email().optional().or(z.literal(''))
}).passthrough();

/**
 * Esquemas para tickets de solicitudes (Mesa de Ayuda)
 */
export const createTicketSchema = z.object({
  title: z.string().min(1, 'Título requerido').max(200).trim(),
  description: z.string().min(1, 'Descripción requerida').max(5000),
  category: z.enum(['SUBVENCION', 'CIERRE_CALLE', 'CERTIFICADO', 'OTRO'], {
    errorMap: () => ({ message: 'Categoría inválida' })
  }),
  organizationId: z.string().min(1, 'Organización requerida')
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(['PENDIENTE', 'EN_REVISION', 'RESUELTO', 'RECHAZADO'], {
    errorMap: () => ({ message: 'Estado inválido' })
  }),
  resolutionNote: z.string().max(5000).optional().or(z.literal(''))
});

/**
 * Esquema para comunicados oficiales (Bulletins)
 */
export const createBulletinSchema = z.object({
  title: z.string().min(1, 'Título requerido').max(200).trim(),
  content: z.string().min(1, 'Contenido requerido').max(5000),
  targetAudience: z.string().min(1).max(50).optional()
});

export const directorioResignationSchema = z.object({
  rutOut: z.string().min(1, 'RUT del miembro saliente es requerido').max(20),
  reason: z.enum(['RENUNCIA', 'FALLECIMIENTO', 'EXCLUSION'], {
    errorMap: () => ({ message: 'Motivo debe ser RENUNCIA, FALLECIMIENTO o EXCLUSION' })
  }),
  exitDate: z.string().optional(),
  documentUrl: z.string().url('URL de documento no válida').max(2000).optional().or(z.literal('')),
  rutIn: z.string().max(20).optional().or(z.literal(''))
});

export default {
  // Esquemas
  registerSchema,
  loginSchema,
  loginSocioSchema,
  changePasswordSchema,
  createMinistroSchema,
  createOrganizationSchema,
  scheduleMinistroSchema,
  statusChangeSchema,
  rejectWithCorrectionsSchema,
  requestCorrectionsSchema,
  createNotificationSchema,
  createNewsSchema,
  updateNewsSchema,
  updateGuiaSchema,
  createMinistroBlockSchema,
  createMinistroBlockFromConfirmSchema,
  createSecurityIncidentSchema,
  updateSecurityIncidentSchema,
  createEstatutoTemplateSchema,
  updateEstatutoTemplateSchema,
  createDocumentTemplateSchema,
  updateDocumentTemplateSchema,
  searchQuerySchema,
  libraryDocumentSchema,
  createSupportTicketSchema,
  createTicketSchema,
  updateTicketStatusSchema,
  createBulletinSchema,
  directorioResignationSchema,
  // Middleware
  validate,
  validateMongoId
};
