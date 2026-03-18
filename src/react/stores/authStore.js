import { create } from 'zustand';
import { apiService } from '@services/ApiService.js';

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  hydrate() {
    const userJson = localStorage.getItem('currentUser');
    const isAuth = localStorage.getItem('isAuthenticated') === 'true';

    // Legacy migration: if currentMinistro exists but no currentUser, migrate
    if (!userJson) {
      const ministroJson = localStorage.getItem('currentMinistro');
      if (ministroJson) {
        try {
          const ministro = JSON.parse(ministroJson);
          localStorage.setItem('currentUser', ministroJson);
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.removeItem('currentMinistro');
          localStorage.removeItem('isMinistroAuthenticated');
          set({ user: ministro, isAuthenticated: true });
          return;
        } catch { /* ignore parse errors */ }
      }
    }

    if (userJson && isAuth) {
      try {
        set({ user: JSON.parse(userJson), isAuthenticated: true });
      } catch { /* ignore parse errors */ }
    } else {
      set({ user: null, isAuthenticated: false });
    }
  },

  /**
   * Verifica la sesión contra el servidor después de hydrate.
   * Intenta refresh del token; si falla, limpia la sesión.
   * @returns {boolean} true si la sesión es válida
   */
  async verifySession() {
    const { isAuthenticated } = get();
    if (!isAuthenticated) return false;

    try {
      // Intentar obtener datos del usuario (valida token/cookie) con timeout de 8s
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session verify timeout')), 8000)
      );
      await Promise.race([apiService.getCurrentUser(), timeout]);
      return true;
    } catch {
      // Token inválido, timeout, o refresh falló → limpiar sesión
      try { await apiService.logout(); } catch { /* ignore */ }
      set({ user: null, isAuthenticated: false, error: null });
      return false;
    }
  },

  async login(email, password) {
    set({ isLoading: true, error: null });
    try {
      const result = await apiService.login(email, password);
      const user = result.user;
      if (!user) throw new Error('Error de autenticación');

      // ApiService already saves to localStorage
      set({ user, isAuthenticated: true, isLoading: false });
      return user;
    } catch (error) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  async loginSocio(lastName, rut) {
    set({ isLoading: true, error: null });
    try {
      const result = await apiService.loginSocio(lastName, rut);
      const user = result.user;
      if (!user) throw new Error('Error de autenticación');

      set({ user, isAuthenticated: true, isLoading: false });
      return user;
    } catch (error) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  async register(userData) {
    set({ isLoading: true, error: null });
    try {
      const result = await apiService.register(userData);
      const user = result.user;

      set({ user, isAuthenticated: true, isLoading: false });
      return user;
    } catch (error) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  async logout() {
    try {
      await apiService.logout();
    } catch { /* ignore */ }
    set({ user: null, isAuthenticated: false, error: null });
  },

  clearError() {
    set({ error: null });
  }
}));
