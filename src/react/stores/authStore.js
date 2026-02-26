import { create } from 'zustand';
import { apiService } from '@services/ApiService.js';

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  hydrate() {
    const userJson = localStorage.getItem('currentUser');
    const ministroJson = localStorage.getItem('currentMinistro');
    const isAuth = localStorage.getItem('isAuthenticated') === 'true';
    const isMinistroAuth = localStorage.getItem('isMinistroAuthenticated') === 'true';

    if (ministroJson && isMinistroAuth) {
      try {
        set({ user: JSON.parse(ministroJson), isAuthenticated: true });
      } catch { /* ignore parse errors */ }
    } else if (userJson && isAuth) {
      try {
        set({ user: JSON.parse(userJson), isAuthenticated: true });
      } catch { /* ignore parse errors */ }
    } else {
      set({ user: null, isAuthenticated: false });
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
