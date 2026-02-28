import { create } from 'zustand';
import { apiService } from '@services/ApiService.js';

export const useUsersStore = create((set, get) => ({
  users: [],
  stats: null,
  isLoading: false,
  error: null,

  async fetchUsers() {
    set({ isLoading: true, error: null });
    try {
      const [usersData, ministrosData] = await Promise.all([
        apiService.getUsers(),
        apiService.getMinistros()
      ]);
      const users = usersData.users || usersData || [];
      const ministros = (ministrosData.ministros || ministrosData || []).map(m => ({
        ...m,
        _isMinistro: true,
        role: m.role || 'MINISTRO_FE'
      }));
      const allUsers = [...users, ...ministros];

      // Calculate stats
      const stats = {
        total: allUsers.length,
        active: allUsers.filter(u => u.isActive !== false).length,
        inactive: allUsers.filter(u => u.isActive === false).length,
        byRole: {
          ORGANIZADOR: allUsers.filter(u => u.role === 'ORGANIZADOR').length,
          MUNICIPALIDAD: allUsers.filter(u => u.role === 'MUNICIPALIDAD').length,
          MINISTRO_FE: allUsers.filter(u => u.role === 'MINISTRO_FE').length,
          MIEMBRO: allUsers.filter(u => u.role === 'MIEMBRO').length
        }
      };

      set({ users: allUsers, stats, isLoading: false });
      return allUsers;
    } catch (error) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  async updateUser(id, updates, isMinistro) {
    try {
      const data = isMinistro
        ? await apiService.updateMinistro(id, updates)
        : await apiService.updateUser(id, updates);
      const updated = data.user || data.ministro || data;
      set(state => ({
        users: state.users.map(u => u._id === id ? { ...u, ...updated } : u)
      }));
      return updated;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  async toggleActive(id, isMinistro) {
    try {
      const data = isMinistro
        ? await apiService.toggleMinistroActive(id)
        : await apiService.toggleUserActive(id);
      const updated = data.user || data.ministro || data;
      set(state => ({
        users: state.users.map(u =>
          u._id === id ? { ...u, isActive: updated.isActive ?? !u.isActive } : u
        )
      }));
      return updated;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  async deleteUser(id, isMinistro) {
    try {
      if (isMinistro) {
        await apiService.deleteMinistro(id);
      } else {
        await apiService.deleteUser(id);
      }
      set(state => ({
        users: state.users.filter(u => u._id !== id)
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
