/**
 * Validador de RUT Chileno
 * Verifica formato y dígito verificador usando algoritmo módulo 11
 */

/**
 * Limpia un RUT quitando puntos y guiones
 * @param {string} rut - RUT con o sin formato
 * @returns {string} RUT limpio (solo números y K)
 */
export function cleanRut(rut) {
  if (!rut) return '';
  return rut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
}

/**
 * Formatea un RUT al formato XX.XXX.XXX-X
 * @param {string} rut - RUT sin formato
 * @returns {string} RUT formateado
 */
export function formatRut(rut) {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return cleaned;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  // Agregar puntos cada 3 dígitos desde la derecha
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted}-${dv}`;
}

/**
 * Calcula el dígito verificador de un RUT
 * @param {string|number} rutBody - Cuerpo del RUT (sin dígito verificador)
 * @returns {string} Dígito verificador (0-9 o K)
 */
export function calculateDV(rutBody) {
  const rutNumber = typeof rutBody === 'string'
    ? parseInt(rutBody.replace(/\D/g, ''), 10)
    : rutBody;

  if (isNaN(rutNumber) || rutNumber <= 0) return '';

  let sum = 0;
  let multiplier = 2;
  let rutStr = rutNumber.toString();

  // Sumar de derecha a izquierda multiplicando por 2,3,4,5,6,7,2,3...
  for (let i = rutStr.length - 1; i >= 0; i--) {
    sum += parseInt(rutStr[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);

  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return remainder.toString();
}

/**
 * Valida un RUT chileno completo
 * @param {string} rut - RUT a validar (con o sin formato)
 * @returns {{valid: boolean, message: string, formatted: string}} Resultado de validación
 */
export function validateRut(rut) {
  if (!rut) {
    return { valid: false, message: 'RUT es requerido', formatted: '' };
  }

  const cleaned = cleanRut(rut);

  // Verificar longitud mínima y máxima (7-9 dígitos + DV)
  if (cleaned.length < 8 || cleaned.length > 9) {
    return { valid: false, message: 'RUT debe tener entre 8 y 9 caracteres', formatted: '' };
  }

  // Verificar formato: solo números y K al final
  if (!/^\d{7,8}[0-9K]$/.test(cleaned)) {
    return { valid: false, message: 'Formato de RUT inválido', formatted: '' };
  }

  const body = cleaned.slice(0, -1);
  const providedDV = cleaned.slice(-1);
  const calculatedDV = calculateDV(body);

  if (providedDV !== calculatedDV) {
    return {
      valid: false,
      message: `Dígito verificador inválido. Debería ser ${calculatedDV}`,
      formatted: formatRut(cleaned)
    };
  }

  return { valid: true, message: 'RUT válido', formatted: formatRut(cleaned) };
}

/**
 * Middleware de Express para validar RUT en el body
 * @param {string} field - Nombre del campo que contiene el RUT
 * @returns {Function} Middleware de Express
 */
export function validateRutMiddleware(field = 'rut') {
  return (req, res, next) => {
    const rut = req.body[field];
    if (!rut) {
      return next(); // Si no hay RUT, dejar que otras validaciones lo manejen
    }

    const result = validateRut(rut);
    if (!result.valid) {
      return res.status(400).json({
        error: 'RUT inválido',
        details: [{ field, message: result.message }]
      });
    }

    // Normalizar el RUT en el body
    req.body[field] = result.formatted;
    next();
  };
}

/**
 * Valida un array de miembros, verificando sus RUTs
 * @param {Array} members - Array de miembros con campo rut
 * @returns {{valid: boolean, errors: Array}} Resultado de validación
 */
export function validateMembersRuts(members) {
  if (!Array.isArray(members)) {
    return { valid: false, errors: ['members debe ser un array'] };
  }

  const errors = [];
  const seenRuts = new Set();

  members.forEach((member, index) => {
    if (!member.rut) {
      errors.push({ index, message: `Miembro ${index + 1}: RUT es requerido` });
      return;
    }

    const result = validateRut(member.rut);
    if (!result.valid) {
      errors.push({ index, rut: member.rut, message: `Miembro ${index + 1}: ${result.message}` });
      return;
    }

    // Verificar duplicados
    const cleanedRut = cleanRut(member.rut);
    if (seenRuts.has(cleanedRut)) {
      errors.push({ index, rut: member.rut, message: `Miembro ${index + 1}: RUT duplicado` });
    } else {
      seenRuts.add(cleanedRut);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  cleanRut,
  formatRut,
  calculateDV,
  validateRut,
  validateRutMiddleware,
  validateMembersRuts
};
