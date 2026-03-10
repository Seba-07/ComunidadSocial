/**
 * SessionManager - Gestión de inactividad y expiración de sesión
 * Compartido entre React y Vanilla JS
 *
 * Emite eventos en window:
 * - 'session-warning': faltan 60s para cerrar (detail: { secondsLeft })
 * - 'session-expired-inactivity': sesión cerrada por inactividad
 */

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const WARNING_COUNTDOWN = 60 * 1000;       // 60 segundos de aviso

class SessionManager {
  constructor() {
    this._inactivityTimer = null;
    this._warningTimer = null;
    this._countdownInterval = null;
    this._isActive = false;
    this._isWarning = false;
    this._secondsLeft = 0;
    this._boundResetTimer = this._resetTimer.bind(this);
    this._activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  }

  start() {
    if (this._isActive) return;
    this._isActive = true;
    this._isWarning = false;

    this._activityEvents.forEach(event => {
      window.addEventListener(event, this._boundResetTimer, { passive: true });
    });

    document.addEventListener('visibilitychange', this._onVisibility = () => {
      if (document.visibilityState === 'visible' && this._isActive && !this._isWarning) {
        this._resetTimer();
      }
    });

    this._startInactivityTimer();
  }

  stop() {
    this._isActive = false;
    this._isWarning = false;
    this._activityEvents.forEach(event => {
      window.removeEventListener(event, this._boundResetTimer);
    });
    if (this._onVisibility) {
      document.removeEventListener('visibilitychange', this._onVisibility);
    }
    this._clearAllTimers();
  }

  keepAlive() {
    if (!this._isActive) return;
    this._isWarning = false;
    this._clearAllTimers();
    this._startInactivityTimer();
  }

  get isWarning() {
    return this._isWarning;
  }

  get secondsLeft() {
    return this._secondsLeft;
  }

  _resetTimer() {
    if (!this._isActive || this._isWarning) return;
    this._clearAllTimers();
    this._startInactivityTimer();
  }

  _startInactivityTimer() {
    this._inactivityTimer = setTimeout(() => {
      this._showWarning();
    }, INACTIVITY_TIMEOUT);
  }

  _showWarning() {
    this._isWarning = true;
    this._secondsLeft = Math.floor(WARNING_COUNTDOWN / 1000);

    window.dispatchEvent(new CustomEvent('session-warning', {
      detail: { secondsLeft: this._secondsLeft }
    }));

    this._countdownInterval = setInterval(() => {
      this._secondsLeft--;
      window.dispatchEvent(new CustomEvent('session-warning', {
        detail: { secondsLeft: this._secondsLeft }
      }));
      if (this._secondsLeft <= 0) {
        this._expireSession();
      }
    }, 1000);

    this._warningTimer = setTimeout(() => {
      this._expireSession();
    }, WARNING_COUNTDOWN);
  }

  _expireSession() {
    this._clearAllTimers();
    this._isWarning = false;
    this._isActive = false;
    this._activityEvents.forEach(event => {
      window.removeEventListener(event, this._boundResetTimer);
    });
    window.dispatchEvent(new CustomEvent('session-expired-inactivity'));
  }

  _clearAllTimers() {
    if (this._inactivityTimer) { clearTimeout(this._inactivityTimer); this._inactivityTimer = null; }
    if (this._warningTimer) { clearTimeout(this._warningTimer); this._warningTimer = null; }
    if (this._countdownInterval) { clearInterval(this._countdownInterval); this._countdownInterval = null; }
  }
}

export const sessionManager = new SessionManager();
