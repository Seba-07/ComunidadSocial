/**
 * Logger Service
 * Solo muestra logs en desarrollo, silencia en producción
 */

const isDev = process.env.NODE_ENV !== 'production';

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
  }
};

export default logger;
