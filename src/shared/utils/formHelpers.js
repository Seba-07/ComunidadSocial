/**
 * formHelpers.js
 * Utilidades comunes para manejo de formularios
 *
 * Incluye:
 * - Validadores comunes
 * - Formateo de campos
 * - Serialización de formularios
 * - Manejo de errores de validación
 */

/**
 * Validadores comunes
 */
export const validators = {
  /**
   * Valida RUT chileno
   * @param {string} rut - RUT a validar
   * @returns {boolean}
   */
  rut(rut) {
    if (!rut) return false;

    // Limpiar RUT
    const cleanRut = rut.replace(/[.-]/g, '').toUpperCase();
    if (cleanRut.length < 2) return false;

    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1);

    // Calcular dígito verificador
    let sum = 0;
    let multiplier = 2;

    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const expectedDv = 11 - (sum % 11);
    const dvMap = { 11: '0', 10: 'K' };
    const calculatedDv = dvMap[expectedDv] || expectedDv.toString();

    return dv === calculatedDv;
  },

  /**
   * Valida email
   * @param {string} email
   * @returns {boolean}
   */
  email(email) {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Valida teléfono chileno
   * @param {string} phone
   * @returns {boolean}
   */
  phone(phone) {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, '');
    // 9 dígitos para celular, 8-9 para fijo
    return cleaned.length >= 8 && cleaned.length <= 12;
  },

  /**
   * Valida que un campo tenga contenido
   * @param {any} value
   * @returns {boolean}
   */
  required(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  },

  /**
   * Valida longitud mínima
   * @param {string} value
   * @param {number} min
   * @returns {boolean}
   */
  minLength(value, min) {
    if (!value) return false;
    return value.length >= min;
  },

  /**
   * Valida longitud máxima
   * @param {string} value
   * @param {number} max
   * @returns {boolean}
   */
  maxLength(value, max) {
    if (!value) return true;
    return value.length <= max;
  },

  /**
   * Valida que sea un número
   * @param {any} value
   * @returns {boolean}
   */
  numeric(value) {
    if (value === '' || value === null || value === undefined) return false;
    return !isNaN(parseFloat(value)) && isFinite(value);
  },

  /**
   * Valida rango numérico
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {boolean}
   */
  range(value, min, max) {
    const num = parseFloat(value);
    return !isNaN(num) && num >= min && num <= max;
  },

  /**
   * Valida fecha válida
   * @param {string} dateStr
   * @returns {boolean}
   */
  date(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
  },

  /**
   * Valida que la fecha sea mayor de edad (18+)
   * @param {string} dateStr - Fecha de nacimiento
   * @returns {boolean}
   */
  adult(dateStr) {
    if (!dateStr) return false;
    const birthDate = new Date(dateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age >= 18;
  }
};

/**
 * Formateadores de campos
 */
export const formatters = {
  /**
   * Formatea RUT chileno (XX.XXX.XXX-X)
   * @param {string} rut
   * @returns {string}
   */
  rut(rut) {
    if (!rut) return '';
    let value = rut.replace(/[^\dkK]/g, '').toUpperCase();
    if (value.length <= 1) return value;

    const dv = value.slice(-1);
    let body = value.slice(0, -1);

    // Agregar puntos cada 3 dígitos
    body = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `${body}-${dv}`;
  },

  /**
   * Formatea teléfono chileno
   * @param {string} phone
   * @returns {string}
   */
  phone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');

    // Celular: +56 9 XXXX XXXX
    if (cleaned.length === 9 && cleaned.startsWith('9')) {
      return `+56 ${cleaned.slice(0, 1)} ${cleaned.slice(1, 5)} ${cleaned.slice(5)}`;
    }

    // Con código país
    if (cleaned.length === 11 && cleaned.startsWith('56')) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
    }

    return phone;
  },

  /**
   * Capitaliza primera letra de cada palabra
   * @param {string} str
   * @returns {string}
   */
  capitalize(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  },

  /**
   * Formatea fecha a formato chileno (DD/MM/YYYY)
   * @param {string|Date} date
   * @returns {string}
   */
  date(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d)) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}/${month}/${year}`;
  },

  /**
   * Formatea moneda chilena
   * @param {number} amount
   * @returns {string}
   */
  currency(amount) {
    if (amount === null || amount === undefined) return '';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
  }
};

/**
 * Serializa un formulario a objeto
 * @param {HTMLFormElement|HTMLElement} container - Formulario o contenedor
 * @returns {Object} Datos del formulario
 */
export function serializeForm(container) {
  const data = {};
  const inputs = container.querySelectorAll('input, textarea, select');

  inputs.forEach(input => {
    if (!input.name) return;

    if (input.type === 'checkbox') {
      // Checkboxes múltiples con mismo nombre
      if (data[input.name] !== undefined) {
        if (!Array.isArray(data[input.name])) {
          data[input.name] = [data[input.name]];
        }
        if (input.checked) {
          data[input.name].push(input.value);
        }
      } else {
        data[input.name] = input.checked ? input.value || true : false;
      }
    } else if (input.type === 'radio') {
      if (input.checked) {
        data[input.name] = input.value;
      }
    } else if (input.type === 'file') {
      data[input.name] = input.files;
    } else if (input.type === 'number') {
      data[input.name] = input.value ? parseFloat(input.value) : null;
    } else {
      data[input.name] = input.value;
    }
  });

  return data;
}

/**
 * Rellena un formulario con datos
 * @param {HTMLElement} container - Contenedor del formulario
 * @param {Object} data - Datos a cargar
 */
export function populateForm(container, data) {
  if (!data) return;

  Object.entries(data).forEach(([name, value]) => {
    const inputs = container.querySelectorAll(`[name="${name}"]`);

    inputs.forEach(input => {
      if (input.type === 'checkbox') {
        input.checked = Array.isArray(value)
          ? value.includes(input.value)
          : Boolean(value);
      } else if (input.type === 'radio') {
        input.checked = input.value === value;
      } else if (input.tagName === 'SELECT') {
        input.value = value || '';
      } else {
        input.value = value || '';
      }
    });
  });
}

/**
 * Valida un formulario y retorna errores
 * @param {Object} data - Datos a validar
 * @param {Object} rules - Reglas de validación
 * @returns {Object} { isValid: boolean, errors: Object }
 *
 * @example
 * const result = validateForm(data, {
 *   nombre: { required: true, minLength: 3 },
 *   email: { required: true, email: true },
 *   rut: { required: true, rut: true }
 * });
 */
export function validateForm(data, rules) {
  const errors = {};

  Object.entries(rules).forEach(([field, fieldRules]) => {
    const value = data[field];
    const fieldErrors = [];

    Object.entries(fieldRules).forEach(([rule, ruleValue]) => {
      if (ruleValue === false) return; // Regla deshabilitada

      let isValid = true;
      let message = '';

      switch (rule) {
        case 'required':
          isValid = validators.required(value);
          message = 'Este campo es requerido';
          break;

        case 'email':
          if (value) {
            isValid = validators.email(value);
            message = 'Email inválido';
          }
          break;

        case 'rut':
          if (value) {
            isValid = validators.rut(value);
            message = 'RUT inválido';
          }
          break;

        case 'phone':
          if (value) {
            isValid = validators.phone(value);
            message = 'Teléfono inválido';
          }
          break;

        case 'minLength':
          if (value) {
            isValid = validators.minLength(value, ruleValue);
            message = `Mínimo ${ruleValue} caracteres`;
          }
          break;

        case 'maxLength':
          if (value) {
            isValid = validators.maxLength(value, ruleValue);
            message = `Máximo ${ruleValue} caracteres`;
          }
          break;

        case 'numeric':
          if (value) {
            isValid = validators.numeric(value);
            message = 'Debe ser un número';
          }
          break;

        case 'date':
          if (value) {
            isValid = validators.date(value);
            message = 'Fecha inválida';
          }
          break;

        case 'adult':
          if (value) {
            isValid = validators.adult(value);
            message = 'Debe ser mayor de 18 años';
          }
          break;

        case 'custom':
          if (typeof ruleValue === 'function') {
            const result = ruleValue(value, data);
            if (typeof result === 'string') {
              isValid = false;
              message = result;
            } else {
              isValid = result;
              message = 'Valor inválido';
            }
          }
          break;
      }

      if (!isValid) {
        fieldErrors.push(message);
      }
    });

    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Muestra errores de validación en el formulario
 * @param {HTMLElement} container - Contenedor del formulario
 * @param {Object} errors - Errores de validación
 */
export function showFormErrors(container, errors) {
  // Limpiar errores previos
  container.querySelectorAll('.field-error').forEach(el => el.remove());
  container.querySelectorAll('.input-error').forEach(el => {
    el.classList.remove('input-error');
  });

  // Mostrar nuevos errores
  Object.entries(errors).forEach(([field, messages]) => {
    const input = container.querySelector(`[name="${field}"]`);
    if (!input) return;

    input.classList.add('input-error');

    const errorEl = document.createElement('div');
    errorEl.className = 'field-error';
    errorEl.innerHTML = messages.map(m => `<span>${m}</span>`).join('');

    // Insertar después del input o su contenedor
    const parent = input.closest('.form-group') || input.parentElement;
    parent.appendChild(errorEl);
  });
}

/**
 * Limpia errores de validación del formulario
 * @param {HTMLElement} container
 */
export function clearFormErrors(container) {
  container.querySelectorAll('.field-error').forEach(el => el.remove());
  container.querySelectorAll('.input-error').forEach(el => {
    el.classList.remove('input-error');
  });
}

/**
 * Agrega formateo automático a inputs
 * @param {HTMLElement} container
 */
export function setupAutoFormatting(container) {
  // RUT auto-formato
  container.querySelectorAll('[data-format="rut"]').forEach(input => {
    input.addEventListener('input', (e) => {
      const cursorPos = e.target.selectionStart;
      const oldLength = e.target.value.length;
      e.target.value = formatters.rut(e.target.value);
      const newLength = e.target.value.length;

      // Ajustar posición del cursor
      const newPos = cursorPos + (newLength - oldLength);
      e.target.setSelectionRange(newPos, newPos);
    });
  });

  // Teléfono auto-formato
  container.querySelectorAll('[data-format="phone"]').forEach(input => {
    input.addEventListener('blur', (e) => {
      e.target.value = formatters.phone(e.target.value);
    });
  });

  // Capitalizar nombres
  container.querySelectorAll('[data-format="capitalize"]').forEach(input => {
    input.addEventListener('blur', (e) => {
      e.target.value = formatters.capitalize(e.target.value);
    });
  });
}

/**
 * CSS para errores de formulario (inyectado automáticamente)
 */
const FORM_HELPERS_STYLES = `
  .input-error {
    border-color: #ef4444 !important;
  }

  .input-error:focus {
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
  }

  .field-error {
    margin-top: 4px;
    font-size: 14px;
    color: #ef4444;
  }

  .field-error span {
    display: block;
  }

  .field-error span::before {
    content: '• ';
  }
`;

// Inyectar estilos
if (typeof document !== 'undefined' && !document.getElementById('form-helpers-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'form-helpers-styles';
  styleEl.textContent = FORM_HELPERS_STYLES;
  document.head.appendChild(styleEl);
}

export default {
  validators,
  formatters,
  serializeForm,
  populateForm,
  validateForm,
  showFormErrors,
  clearFormErrors,
  setupAutoFormatting
};
