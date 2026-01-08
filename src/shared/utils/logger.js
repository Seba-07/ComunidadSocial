/**
 * Logger Service para Frontend
 * Solo muestra logs en desarrollo, silencia en producción
 */

const isDev = window.location.hostname === 'localhost' ||
              window.location.hostname === '127.0.0.1' ||
              window.location.search.includes('debug=true');

const logger = {
  /**
   * Log informativo (solo en desarrollo)
   */
  info(...args) {
    if (isDev) {
      console.log('[INFO]', ...args);
    }
  },

  /**
   * Log de debug (solo en desarrollo)
   */
  debug(...args) {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Warning (siempre se muestra)
   */
  warn(...args) {
    console.warn('[WARN]', ...args);
  },

  /**
   * Error (siempre se muestra)
   */
  error(...args) {
    console.error('[ERROR]', ...args);
  },

  /**
   * Log con emoji para desarrollo
   */
  emoji(emoji, ...args) {
    if (isDev) {
      console.log(emoji, ...args);
    }
  },

  /**
   * Log de API para desarrollo
   */
  api(method, url, data = null) {
    if (isDev) {
      console.log(`🌐 [API] ${method} ${url}`, data || '');
    }
  },

  /**
   * Log de grupo (para logs relacionados)
   */
  group(label, callback) {
    if (isDev) {
      console.group(label);
      callback();
      console.groupEnd();
    }
  }
};

export default logger;
