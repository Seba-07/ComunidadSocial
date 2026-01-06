/**
 * StateManager
 * Clase base para manejo de estado reactivo en componentes
 * Permite crear componentes con estado persistible y suscripciones a cambios
 *
 * @example
 * class MyWizard extends StateManager {
 *   constructor() {
 *     super({
 *       currentStep: 1,
 *       formData: {}
 *     });
 *   }
 *
 *   nextStep() {
 *     this.setState({ currentStep: this.state.currentStep + 1 });
 *   }
 * }
 */

import { indexedDBService } from '../../infrastructure/database/IndexedDBService.js';

export class StateManager {
  /**
   * @param {Object} initialState - Estado inicial
   * @param {Object} options - Opciones de configuración
   * @param {string} options.persistKey - Clave para persistencia en IndexedDB
   * @param {boolean} options.autoPersist - Auto-guardar en cada cambio de estado
   */
  constructor(initialState = {}, options = {}) {
    this._state = { ...initialState };
    this._listeners = new Set();
    this._persistKey = options.persistKey || null;
    this._autoPersist = options.autoPersist || false;
    this._isInitialized = false;
  }

  /**
   * Obtiene el estado actual (copia inmutable)
   */
  get state() {
    return { ...this._state };
  }

  /**
   * Actualiza el estado y notifica a los suscriptores
   * @param {Object|Function} updates - Nuevos valores o función que recibe estado actual
   */
  setState(updates) {
    const prevState = this._state;

    if (typeof updates === 'function') {
      updates = updates(prevState);
    }

    this._state = {
      ...prevState,
      ...updates
    };

    // Notificar suscriptores
    this._notifyListeners(this._state, prevState);

    // Auto-persistir si está habilitado
    if (this._autoPersist && this._persistKey) {
      this.persistState().catch(err => {
        console.warn('Error auto-persisting state:', err);
      });
    }
  }

  /**
   * Suscribe un listener a cambios de estado
   * @param {Function} listener - Función a llamar cuando cambie el estado
   * @returns {Function} Función para cancelar suscripción
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Notifica a todos los listeners
   * @private
   */
  _notifyListeners(newState, prevState) {
    this._listeners.forEach(listener => {
      try {
        listener(newState, prevState);
      } catch (err) {
        console.error('Error in state listener:', err);
      }
    });
  }

  /**
   * Persiste el estado actual en IndexedDB
   */
  async persistState() {
    if (!this._persistKey) {
      throw new Error('No persist key configured');
    }

    try {
      await indexedDBService.saveValidationWizardState(this._persistKey, {
        ...this._state,
        _persistedAt: new Date().toISOString()
      });
      console.log('💾 State persisted:', this._persistKey);
    } catch (error) {
      console.error('Error persisting state:', error);
      throw error;
    }
  }

  /**
   * Restaura el estado desde IndexedDB
   * @returns {boolean} True si se restauró estado
   */
  async restoreState() {
    if (!this._persistKey) {
      return false;
    }

    try {
      const savedState = await indexedDBService.getValidationWizardState(this._persistKey);
      if (savedState) {
        const { _persistedAt, assignmentId, lastUpdated, ...state } = savedState;
        this._state = { ...this._state, ...state };
        console.log('🔄 State restored:', this._persistKey);
        return true;
      }
    } catch (error) {
      console.warn('Error restoring state:', error);
    }

    return false;
  }

  /**
   * Limpia el estado persistido
   */
  async clearPersistedState() {
    if (!this._persistKey) return;

    try {
      await indexedDBService.deleteValidationWizardState(this._persistKey);
      console.log('🗑️ Persisted state cleared:', this._persistKey);
    } catch (error) {
      console.warn('Error clearing persisted state:', error);
    }
  }

  /**
   * Reinicia el estado al valor inicial
   * @param {Object} initialState - Estado inicial (opcional)
   */
  reset(initialState = {}) {
    this._state = { ...initialState };
    this._notifyListeners(this._state, {});
  }

  /**
   * Destruye el manager y limpia recursos
   */
  destroy() {
    this._listeners.clear();
    this._state = {};
  }
}

/**
 * Hook para crear estado reactivo simple (sin clase)
 * @param {Object} initialState - Estado inicial
 * @returns {Array} [state, setState, subscribe]
 */
export function createState(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Set();

  const getState = () => ({ ...state });

  const setState = (updates) => {
    const prevState = state;
    if (typeof updates === 'function') {
      updates = updates(prevState);
    }
    state = { ...prevState, ...updates };
    listeners.forEach(fn => fn(state, prevState));
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return [getState, setState, subscribe];
}

/**
 * Crea un store simple con acciones tipadas
 * @param {Object} config - Configuración del store
 * @param {Object} config.initialState - Estado inicial
 * @param {Object} config.actions - Acciones que modifican el estado
 * @returns {Object} Store con getState, dispatch y subscribe
 */
export function createStore({ initialState = {}, actions = {} }) {
  const [getState, setState, subscribe] = createState(initialState);

  const dispatch = (actionName, payload) => {
    const action = actions[actionName];
    if (!action) {
      console.warn(`Action '${actionName}' not found`);
      return;
    }

    const newState = action(getState(), payload);
    if (newState !== undefined) {
      setState(newState);
    }
  };

  return {
    getState,
    dispatch,
    subscribe
  };
}

export default StateManager;
