/**
 * Utilidades de Sanitización HTML
 * Previene ataques XSS al renderizar contenido dinámico
 */

import DOMPurify from 'dompurify';

// Configuración estricta para la mayoría de casos
const STRICT_CONFIG = {
  ALLOWED_TAGS: [], // Sin HTML permitido
  ALLOWED_ATTR: []
};

// Configuración para contenido de noticias/estatutos (permite formateo básico)
const RICH_TEXT_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'span',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'blockquote', 'pre', 'code'
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'], // Agregar target="_blank" a links
  FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'button', 'object', 'embed'],
  FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur']
};

// Configuración mínima para nombres y textos simples
const TEXT_ONLY_CONFIG = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true
};

/**
 * Sanitiza texto simple - remueve todo HTML
 * Usar para: nombres, direcciones, comentarios simples
 * @param {string} dirty - Texto potencialmente peligroso
 * @returns {string} Texto limpio sin HTML
 */
export function sanitizeText(dirty) {
  if (!dirty || typeof dirty !== 'string') return '';
  return DOMPurify.sanitize(dirty, TEXT_ONLY_CONFIG);
}

/**
 * Sanitiza HTML permitiendo formateo básico
 * Usar para: contenido de noticias, estatutos, descripciones ricas
 * @param {string} dirty - HTML potencialmente peligroso
 * @returns {string} HTML sanitizado
 */
export function sanitizeRichText(dirty) {
  if (!dirty || typeof dirty !== 'string') return '';

  // Configurar hooks para links externos
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      // Agregar atributos de seguridad a links externos
      if (node.getAttribute('href')?.startsWith('http')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  });

  const clean = DOMPurify.sanitize(dirty, RICH_TEXT_CONFIG);

  // Remover hook después de usar
  DOMPurify.removeHook('afterSanitizeAttributes');

  return clean;
}

/**
 * Sanitiza estrictamente - remueve todo excepto texto
 * @param {string} dirty - Contenido potencialmente peligroso
 * @returns {string} Solo texto plano
 */
export function sanitizeStrict(dirty) {
  if (!dirty || typeof dirty !== 'string') return '';
  return DOMPurify.sanitize(dirty, STRICT_CONFIG);
}

/**
 * Escapa HTML para mostrar como texto (no renderizar)
 * Útil para mostrar código o ejemplos HTML
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado
 */
export function escapeHtml(text) {
  if (!text || typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitiza un objeto completo recursivamente
 * Útil para sanitizar datos recibidos de APIs
 * @param {Object} obj - Objeto a sanitizar
 * @param {string[]} richTextFields - Campos que permiten HTML formateado
 * @returns {Object} Objeto sanitizado
 */
export function sanitizeObject(obj, richTextFields = []) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, richTextFields));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = richTextFields.includes(key)
        ? sanitizeRichText(value)
        : sanitizeText(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, richTextFields);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Crea un elemento HTML seguro desde contenido sanitizado
 * @param {string} html - HTML a renderizar (será sanitizado)
 * @param {string} tag - Tag del elemento contenedor
 * @returns {HTMLElement} Elemento DOM seguro
 */
export function createSafeElement(html, tag = 'div') {
  const element = document.createElement(tag);
  element.innerHTML = sanitizeRichText(html);
  return element;
}

/**
 * Renderiza HTML sanitizado de forma segura usando innerHTML
 * @param {HTMLElement} container - Elemento contenedor
 * @param {string} html - HTML a renderizar
 * @param {boolean} richText - Si permite formateo rico
 */
export function renderSafeHtml(container, html, richText = false) {
  if (!container || !(container instanceof HTMLElement)) return;
  container.innerHTML = richText ? sanitizeRichText(html) : sanitizeText(html);
}

export default {
  sanitizeText,
  sanitizeRichText,
  sanitizeStrict,
  escapeHtml,
  sanitizeObject,
  createSafeElement,
  renderSafeHtml
};
