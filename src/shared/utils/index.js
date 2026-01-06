/**
 * Módulo de Utilidades Compartidas
 * Centraliza funciones duplicadas en el proyecto
 * @module shared/utils
 */

import { apiService } from '../../services/ApiService.js';

// ============================================
// TIPOS DE ORGANIZACIÓN DINÁMICOS
// ============================================

// Cache de tipos desde API
let cachedOrgTypes = null;
let orgTypesLoadPromise = null;

/**
 * Carga tipos de organización desde la API (con cache)
 * @returns {Promise<Object>} Mapa de tipo -> label
 */
export async function loadOrganizationTypes() {
  if (cachedOrgTypes) return cachedOrgTypes;
  if (orgTypesLoadPromise) return orgTypesLoadPromise;

  orgTypesLoadPromise = (async () => {
    try {
      const types = await apiService.getOrganizationTypes();
      cachedOrgTypes = {};
      types.forEach(t => { cachedOrgTypes[t.value] = t.label; });
      console.log('✅ [shared/utils] Tipos cargados desde API:', Object.keys(cachedOrgTypes).length);
      return cachedOrgTypes;
    } catch (error) {
      console.warn('⚠️ [shared/utils] Error cargando tipos, usando fallback:', error.message);
      return null;
    } finally {
      orgTypesLoadPromise = null;
    }
  })();

  return orgTypesLoadPromise;
}

/**
 * Inicializa los tipos de organización (precargar en cache)
 * Llamar esto al inicio de la aplicación para mejor rendimiento
 */
export function initOrganizationTypes() {
  loadOrganizationTypes().catch(() => {});
}

// ============================================
// FORMATEO DE FECHAS
// ============================================

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
];

/**
 * Formatea una fecha en formato legible en español
 * @param {Date|string|number} date - Fecha a formatear
 * @param {Object} options - Opciones de formato
 * @returns {string} Fecha formateada
 */
export function formatDate(date, options = {}) {
  if (!date) return options.fallback || '---';

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return options.fallback || '---';

    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();

    if (options.short) {
      return `${day} ${MESES_CORTOS[month]} ${year}`;
    }

    if (options.full) {
      return `${day} de ${MESES[month]} del ${year}`;
    }

    // Formato por defecto: DD/MM/YYYY
    return `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
  } catch (e) {
    return options.fallback || '---';
  }
}

/**
 * Formatea fecha y hora
 * @param {Date|string} date - Fecha a formatear
 * @returns {string} Fecha y hora formateadas
 */
export function formatDateTime(date) {
  if (!date) return '---';

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '---';

    const dateStr = formatDate(d);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${dateStr} ${hours}:${minutes}`;
  } catch (e) {
    return '---';
  }
}

/**
 * Formatea solo la hora
 * @param {Date|string} date - Fecha/hora a formatear
 * @returns {string} Hora formateada (HH:MM)
 */
export function formatTime(date) {
  if (!date) return '---';

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '---';

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${hours}:${minutes}`;
  } catch (e) {
    return '---';
  }
}

/**
 * Obtiene fecha relativa (hace X tiempo)
 * @param {Date|string} date - Fecha a comparar
 * @returns {string} Tiempo relativo
 */
export function getRelativeTime(date) {
  if (!date) return '';

  try {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ahora mismo';
    if (minutes < 60) return `Hace ${minutes} min`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days} días`;

    return formatDate(d, { short: true });
  } catch (e) {
    return '';
  }
}

// ============================================
// ACCESO A DATOS DE ORGANIZACIÓN
// ============================================

/**
 * Obtiene el nombre de la organización (soporta formato nuevo y legacy)
 * @param {Object} org - Objeto de organización
 * @returns {string} Nombre de la organización
 */
export function getOrgName(org) {
  if (!org) return '---';
  return org.organizationName || org.name || org.nombre || '---';
}

/**
 * Obtiene el tipo de organización formateado
 * Usa cache de API si está disponible, con fallback a tipos locales
 * @param {Object|string} org - Organización o tipo directo
 * @returns {string} Tipo legible
 */
export function getOrgType(org) {
  const type = typeof org === 'string' ? org : (org?.organizationType || org?.type || org?.tipo);

  // Primero intentar con cache de API
  if (cachedOrgTypes && cachedOrgTypes[type]) {
    return cachedOrgTypes[type];
  }

  // Fallback a tipos locales
  const TIPOS_FALLBACK = {
    'JUNTA_VECINOS': 'Junta de Vecinos',
    'COMITE_VECINOS': 'Comité de Vecinos',
    'CLUB_DEPORTIVO': 'Club Deportivo',
    'CLUB_ADULTO_MAYOR': 'Club de Adulto Mayor',
    'CLUB_JUVENIL': 'Club Juvenil',
    'CLUB_CULTURAL': 'Club Cultural',
    'CENTRO_MADRES': 'Centro de Madres',
    'CENTRO_PADRES': 'Centro de Padres y Apoderados',
    'CENTRO_CULTURAL': 'Centro Cultural',
    'AGRUPACION_FOLCLORICA': 'Agrupación Folclórica',
    'AGRUPACION_CULTURAL': 'Agrupación Cultural',
    'AGRUPACION_JUVENIL': 'Agrupación Juvenil',
    'AGRUPACION_AMBIENTAL': 'Agrupación Ambiental',
    'AGRUPACION_EMPRENDEDORES': 'Agrupación de Emprendedores',
    'COMITE_VIVIENDA': 'Comité de Vivienda',
    'COMITE_ALLEGADOS': 'Comité de Allegados',
    'COMITE_APR': 'Comité de Agua Potable Rural',
    'COMITE_ADELANTO': 'Comité de Adelanto',
    'COMITE_MEJORAMIENTO': 'Comité de Mejoramiento',
    'COMITE_CONVIVENCIA': 'Comité de Convivencia',
    'ORG_SCOUT': 'Organización Scout',
    'ORG_MUJERES': 'Organización de Mujeres',
    'ORG_INDIGENA': 'Organización Indígena',
    'ORG_SALUD': 'Organización de Salud',
    'ORG_SOCIAL': 'Organización Social',
    'ORG_CULTURAL': 'Organización Cultural',
    'GRUPO_TEATRO': 'Grupo de Teatro',
    'CORO': 'Coro o Agrupación Musical',
    'TALLER_ARTESANIA': 'Taller de Artesanía',
    'ORG_COMUNITARIA': 'Organización Comunitaria',
    'ORG_FUNCIONAL': 'Organización Funcional',
    'OTRA_FUNCIONAL': 'Otra Organización Funcional'
  };

  return TIPOS_FALLBACK[type] || type || 'Organización Comunitaria';
}

/**
 * Obtiene la dirección de la organización
 * @param {Object} org - Organización
 * @returns {string} Dirección
 */
export function getOrgAddress(org) {
  if (!org) return '---';
  return org.address || org.direccion || org.domicilio || '---';
}

/**
 * Obtiene la comuna de la organización
 * @param {Object} org - Organización
 * @returns {string} Comuna
 */
export function getOrgComuna(org) {
  if (!org) return 'Renca';
  return org.comuna || org.commune || 'Renca';
}

/**
 * Obtiene la unidad vecinal
 * @param {Object} org - Organización
 * @returns {string} Unidad vecinal
 */
export function getOrgUnidadVecinal(org) {
  if (!org) return '---';
  return org.unidadVecinal || org.neighborhood || org.unidad_vecinal || '---';
}

// ============================================
// ESTADOS DE ORGANIZACIÓN
// ============================================

const ESTADOS = {
  'draft': { label: 'Borrador', color: 'gray', icon: 'edit' },
  'waiting_ministro': { label: 'Esperando Ministro', color: 'yellow', icon: 'clock' },
  'ministro_scheduled': { label: 'Ministro Agendado', color: 'blue', icon: 'calendar' },
  'ministro_approved': { label: 'Aprobado por Ministro', color: 'green', icon: 'check' },
  'pending_review': { label: 'Pendiente Revisión', color: 'orange', icon: 'eye' },
  'in_review': { label: 'En Revisión', color: 'blue', icon: 'search' },
  'rejected': { label: 'Rechazado', color: 'red', icon: 'x' },
  'sent_registry': { label: 'Enviada al Registro Civil', color: 'cyan', icon: 'send' },
  'approved': { label: 'Aprobado', color: 'green', icon: 'check-circle' },
  'dissolved': { label: 'Disuelta', color: 'gray', icon: 'archive' }
};

/**
 * Obtiene información del estado
 * @param {string} status - Estado de la organización
 * @returns {Object} Información del estado
 */
export function getStatusInfo(status) {
  return ESTADOS[status] || { label: status, color: 'gray', icon: 'help' };
}

/**
 * Obtiene el badge HTML para un estado
 * @param {string} status - Estado
 * @returns {string} HTML del badge
 */
export function getStatusBadge(status) {
  const info = getStatusInfo(status);
  return `<span class="badge badge--${info.color}">${info.label}</span>`;
}

// ============================================
// VALIDACIÓN
// ============================================

/**
 * Valida un RUT chileno
 * @param {string} rut - RUT a validar
 * @returns {boolean} Es válido
 */
export function validateRut(rut) {
  if (!rut || typeof rut !== 'string') return false;

  // Limpiar RUT
  const cleanRut = rut.replace(/[.-]/g, '').toUpperCase();
  if (cleanRut.length < 2) return false;

  const body = cleanRut.slice(0, -1);
  const verifier = cleanRut.slice(-1);

  // Calcular dígito verificador
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expectedVerifier = 11 - (sum % 11);
  let expected;

  if (expectedVerifier === 11) expected = '0';
  else if (expectedVerifier === 10) expected = 'K';
  else expected = String(expectedVerifier);

  return verifier === expected;
}

/**
 * Formatea un RUT
 * @param {string} rut - RUT a formatear
 * @returns {string} RUT formateado (XX.XXX.XXX-X)
 */
export function formatRut(rut) {
  if (!rut) return '';

  const clean = rut.replace(/[.-]/g, '');
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const verifier = clean.slice(-1);

  // Agregar puntos
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${formatted}-${verifier}`;
}

/**
 * Valida un email
 * @param {string} email - Email a validar
 * @returns {boolean} Es válido
 */
export function validateEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Valida un teléfono chileno
 * @param {string} phone - Teléfono a validar
 * @returns {boolean} Es válido
 */
export function validatePhone(phone) {
  if (!phone) return false;
  const clean = phone.replace(/\D/g, '');
  return clean.length >= 8 && clean.length <= 12;
}

// ============================================
// MANIPULACIÓN DE STRINGS
// ============================================

/**
 * Capitaliza la primera letra
 * @param {string} str - String a capitalizar
 * @returns {string} String capitalizado
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Trunca un texto
 * @param {string} str - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @returns {string} Texto truncado
 */
export function truncate(str, maxLength = 50) {
  if (!str || str.length <= maxLength) return str || '';
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Genera un slug desde un texto
 * @param {string} str - Texto
 * @returns {string} Slug
 */
export function slugify(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ============================================
// NÚMEROS Y MONEDA
// ============================================

/**
 * Formatea un número con separadores de miles
 * @param {number} num - Número a formatear
 * @returns {string} Número formateado
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return num.toLocaleString('es-CL');
}

/**
 * Formatea un valor como moneda chilena
 * @param {number} amount - Monto
 * @returns {string} Monto formateado
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '$0';
  return '$' + formatNumber(Math.round(amount));
}

// ============================================
// DOM HELPERS
// ============================================

/**
 * Crea un elemento HTML con atributos
 * @param {string} tag - Tag del elemento
 * @param {Object} attrs - Atributos
 * @param {string|HTMLElement|Array} children - Contenido hijo
 * @returns {HTMLElement} Elemento creado
 */
export function createElement(tag, attrs = {}, children = null) {
  const el = document.createElement(tag);

  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => {
        el.dataset[k] = v;
      });
    } else {
      el.setAttribute(key, value);
    }
  });

  if (children) {
    if (typeof children === 'string') {
      el.innerHTML = children;
    } else if (children instanceof HTMLElement) {
      el.appendChild(children);
    } else if (Array.isArray(children)) {
      children.forEach(child => {
        if (typeof child === 'string') {
          el.insertAdjacentHTML('beforeend', child);
        } else if (child instanceof HTMLElement) {
          el.appendChild(child);
        }
      });
    }
  }

  return el;
}

/**
 * Selecciona un elemento de forma segura
 * @param {string} selector - Selector CSS
 * @param {HTMLElement} parent - Elemento padre
 * @returns {HTMLElement|null} Elemento encontrado
 */
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Selecciona múltiples elementos
 * @param {string} selector - Selector CSS
 * @param {HTMLElement} parent - Elemento padre
 * @returns {HTMLElement[]} Elementos encontrados
 */
export function $$(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

// ============================================
// DEBOUNCE Y THROTTLE
// ============================================

/**
 * Debounce de una función
 * @param {Function} func - Función a debounce
 * @param {number} wait - Tiempo de espera en ms
 * @returns {Function} Función con debounce
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle de una función
 * @param {Function} func - Función a throttle
 * @param {number} limit - Límite de tiempo en ms
 * @returns {Function} Función con throttle
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ============================================
// ALMACENAMIENTO
// ============================================

/**
 * Guarda en localStorage con JSON
 * @param {string} key - Clave
 * @param {any} value - Valor
 */
export function setStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Error saving to localStorage:', e);
  }
}

/**
 * Lee de localStorage con JSON
 * @param {string} key - Clave
 * @param {any} defaultValue - Valor por defecto
 * @returns {any} Valor guardado
 */
export function getStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.warn('Error reading from localStorage:', e);
    return defaultValue;
  }
}

/**
 * Elimina de localStorage
 * @param {string} key - Clave
 */
export function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('Error removing from localStorage:', e);
  }
}

// ============================================
// EXPORTACIONES AGRUPADAS
// ============================================

export const dateUtils = {
  formatDate,
  formatDateTime,
  formatTime,
  getRelativeTime,
  MESES,
  MESES_CORTOS
};

/**
 * Obtiene icono según tipo de organización
 * @param {string} type - Tipo de organización
 * @returns {string} Emoji del icono
 */
export function getOrgIcon(type) {
  if (type === 'JUNTA_VECINOS' || type === 'COMITE_VECINOS') return '🏘️';
  if (type?.startsWith('CLUB_')) return '⚽';
  if (type?.startsWith('CENTRO_')) return '🏢';
  if (type?.startsWith('AGRUPACION_')) return '👥';
  if (type?.startsWith('COMITE_')) return '📋';
  if (type?.startsWith('ORG_')) return '🎯';
  if (type === 'GRUPO_TEATRO') return '🎭';
  if (type === 'CORO') return '🎵';
  if (type === 'TALLER_ARTESANIA') return '🎨';
  return '👥';
}

/**
 * Parsea fecha + hora de forma segura (evita Invalid Date)
 * @param {string} dateStr - Fecha en string
 * @param {string} timeStr - Hora en string
 * @returns {Date|null} Fecha parseada
 */
export function parseDateTimeSafe(dateStr, timeStr) {
  if (!dateStr) return null;
  try {
    const datePart = dateStr.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);

    let hours = 12, minutes = 0;
    if (timeStr) {
      const timeParts = timeStr.split(':');
      hours = parseInt(timeParts[0]) || 12;
      minutes = parseInt(timeParts[1]) || 0;
    }

    if (year && month && day) {
      return new Date(year, month - 1, day, hours, minutes, 0);
    }

    const date = new Date(dateStr + (timeStr ? ' ' + timeStr : ''));
    if (isNaN(date.getTime())) return null;
    return date;
  } catch (e) {
    console.error('Error parseando fecha/hora:', e);
    return null;
  }
}

export const orgUtils = {
  getOrgName,
  getOrgType,
  getOrgAddress,
  getOrgComuna,
  getOrgUnidadVecinal,
  getOrgIcon,
  getStatusInfo,
  getStatusBadge,
  loadOrganizationTypes,
  initOrganizationTypes
};

export const validationUtils = {
  validateRut,
  formatRut,
  validateEmail,
  validatePhone
};

export const stringUtils = {
  capitalize,
  truncate,
  slugify
};

export const numberUtils = {
  formatNumber,
  formatCurrency
};

export const domUtils = {
  createElement,
  $,
  $$,
  debounce,
  throttle
};

export const storageUtils = {
  setStorage,
  getStorage,
  removeStorage
};
