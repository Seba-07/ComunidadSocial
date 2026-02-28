import { create } from 'zustand';
import { apiService } from '@services/ApiService.js';

export const useMinistrosStore = create((set, get) => ({
  ministros: [],
  isLoading: false,
  error: null,

  async fetchMinistros() {
    set({ isLoading: true, error: null });
    try {
      const data = await apiService.getMinistros();
      const ministros = data.ministros || data || [];
      set({ ministros, isLoading: false });
      return ministros;
    } catch (error) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  async createMinistro(ministroData) {
    try {
      const data = await apiService.createMinistro(ministroData);
      const created = data.ministro || data;
      set(state => ({ ministros: [...state.ministros, created] }));
      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  async updateMinistro(id, updates) {
    try {
      const data = await apiService.updateMinistro(id, updates);
      const updated = data.ministro || data;
      set(state => ({
        ministros: state.ministros.map(m => m._id === id ? { ...m, ...updated } : m)
      }));
      return updated;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  async toggleActive(id) {
    try {
      const data = await apiService.toggleMinistroActive(id);
      const updated = data.ministro || data;
      set(state => ({
        ministros: state.ministros.map(m =>
          m._id === id ? { ...m, isActive: updated.isActive ?? !m.isActive } : m
        )
      }));
      return updated;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  async deleteMinistro(id) {
    try {
      await apiService.deleteMinistro(id);
      set(state => ({
        ministros: state.ministros.filter(m => m._id !== id)
      }));
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  clearError() {
    set({ error: null });
  }
}));
