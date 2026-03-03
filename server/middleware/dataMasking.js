/**
 * Middleware de Enmascaramiento de Datos Personales (Ley 21.719)
 *
 * Enmascara RUT, email y teléfono en respuestas API según el rol del usuario.
 * Excepciones: datos propios, MUNICIPALIDAD (admin), MINISTRO_FE en sus asignaciones.
 */

/**
 * Enmascara un RUT chileno.
 * Ejemplo: "17.405.314-6" → "17.***.**4-6"
 * @param {string} rut
 * @returns {string}
 */
export function maskRut(rut) {
  if (!rut || typeof rut !== 'string') return rut;
  // Remove formatting to work with raw digits
  const clean = rut.replace(/\./g, '').replace(/-/g, '');
  if (clean.length < 2) return '***';
  const dv = clean.slice(-1);
  const body = clean.slice(0, -1);
  if (body.length <= 2) return `**-${dv}`;
  // Show first 2 digits and last digit of body
  const first = body.slice(0, 2);
  const last = body.slice(-1);
  const middle = '*'.repeat(body.length - 3);
  // Reformat with dots
  const masked = `${first}.${middle}.${last}`;
  return `${masked}-${dv}`;
}

/**
 * Enmascara un email.
 * Ejemplo: "sa.aranguiz@gmail.com" → "sa***@gmail.com"
 * @param {string} email
 * @returns {string}
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return email;
  const atIdx = email.indexOf('@');
  if (atIdx < 0) return '***';
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  if (local.length <= 2) return `${local[0]}***${domain}`;
  return `${local.slice(0, 2)}***${domain}`;
}

/**
 * Enmascara un teléfono.
 * Ejemplo: "+56912345678" → "+56 9 **** 5678"
 * @param {string} phone
 * @returns {string}
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  const last4 = digits.slice(-4);
  return `**** ${last4}`;
}

/**
 * Enmascara campos PII en un objeto (mutates in place for performance).
 * @param {Object} obj - Objeto con campos PII
 * @param {Object} options
 * @param {boolean} options.maskRutField - Enmascarar campo rut
 * @param {boolean} options.maskEmailField - Enmascarar campo email
 * @param {boolean} options.maskPhoneField - Enmascarar campo phone
 */
export function maskPiiFields(obj, options = {}) {
  if (!obj || typeof obj !== 'object') return obj;
  const { maskRutField = true, maskEmailField = true, maskPhoneField = true } = options;

  if (maskRutField && obj.rut) obj.rut = maskRut(obj.rut);
  if (maskEmailField && obj.email) obj.email = maskEmail(obj.email);
  if (maskPhoneField && obj.phone) obj.phone = maskPhone(obj.phone);

  return obj;
}

/**
 * Enmascara un array de miembros (members) en un objeto organización.
 * @param {Array} members
 * @returns {Array}
 */
export function maskMembersArray(members) {
  if (!Array.isArray(members)) return members;
  return members.map(m => {
    const obj = m.toObject ? m.toObject() : { ...m };
    return maskPiiFields(obj);
  });
}

/**
 * Enmascara los datos PII en una organización completa.
 * @param {Object} org - Organización (plain object o Mongoose doc)
 * @returns {Object}
 */
export function maskOrganizationPii(org) {
  if (!org) return org;
  const obj = org.toObject ? org.toObject() : { ...org };

  if (obj.members) {
    obj.members = maskMembersArray(obj.members);
  }
  if (obj.provisionalDirectorio) {
    const dir = obj.provisionalDirectorio;
    if (dir.president) maskPiiFields(dir.president);
    if (dir.secretary) maskPiiFields(dir.secretary);
    if (dir.treasurer) maskPiiFields(dir.treasurer);
    if (Array.isArray(dir.additionalMembers)) {
      dir.additionalMembers.forEach(m => maskPiiFields(m));
    }
  }
  if (obj.electoralCommission) {
    obj.electoralCommission = obj.electoralCommission.map(m => {
      const member = m.toObject ? m.toObject() : { ...m };
      return maskPiiFields(member);
    });
  }

  return obj;
}

/**
 * Determina si el usuario actual debe ver datos sin enmascarar.
 * @param {Object} req - Express request con req.user
 * @param {string} [targetUserId] - ID del usuario cuyos datos se muestran
 * @returns {boolean}
 */
export function shouldShowFullPii(req, targetUserId) {
  if (!req.user) return false;
  // Admin always sees full data
  if (req.user.role === 'MUNICIPALIDAD') return true;
  // User sees their own data
  if (targetUserId && req.userId?.toString() === targetUserId?.toString()) return true;
  return false;
}

/**
 * Middleware que setea un flag en el request indicando si se debe enmascarar.
 * Se usa antes de las rutas para preparar el contexto.
 */
export function dataMaskingContext(req, res, next) {
  req.shouldMaskPii = req.user?.role !== 'MUNICIPALIDAD';
  next();
}
