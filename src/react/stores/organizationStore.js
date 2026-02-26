import { create } from 'zustand';
import { apiService } from '@services/ApiService.js';

export const useOrganizationStore = create((set, get) => ({
  organizations: [],
  activeOrg: null,
  isLoading: false,
  error: null,

  async fetchMyOrganizations() {
    set({ isLoading: true, error: null });
    try {
      const data = await apiService.getMyOrganizations();
      const orgs = data.organizations || data || [];
      set({ organizations: orgs, isLoading: false });
      return orgs;
    } catch (error) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  async fetchMemberOrganization() {
    set({ isLoading: true, error: null });
    try {
      const data = await apiService.getMyOrganization();
      // API returns { organizations: [...] } array for members
      const orgs = data.organizations || (data.organization ? [data.organization] : (Array.isArray(data) ? data : [data]));
      const active = orgs[0] || null;
      set({ activeOrg: active, organizations: orgs, isLoading: false });
      return active;
    } catch (error) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  setActiveOrg(orgId) {
    const org = get().organizations.find((o) => o._id === orgId);
    if (org) set({ activeOrg: org });
  },

  async refreshActiveOrg() {
    const { activeOrg } = get();
    if (!activeOrg?._id) return;
    try {
      const data = await apiService.getOrganization(activeOrg._id);
      const org = data.organization || data;
      set({ activeOrg: org });
      // Update in the list too
      set((state) => ({
        organizations: state.organizations.map((o) =>
          o._id === org._id ? org : o
        )
      }));
      return org;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  clearError() {
    set({ error: null });
  }
}));
