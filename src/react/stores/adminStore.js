import { create } from 'zustand';
import { apiService } from '@services/ApiService.js';

export const useAdminStore = create((set, get) => ({
  organizations: [],
  stats: null,
  currentFilter: 'all',
  searchQuery: '',
  selectedOrg: null,
  isLoading: false,
  error: null,

  async fetchAllOrganizations() {
    set({ isLoading: true, error: null });
    try {
      const data = await apiService.getOrganizations();
      const orgs = data.organizations || data || [];
      set({ organizations: orgs, isLoading: false });
      return orgs;
    } catch (error) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  async fetchStats() {
    try {
      const data = await apiService.getOrganizationStats();
      set({ stats: data.stats || data });
      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  setFilter(filter) {
    set({ currentFilter: filter });
  },

  setSearchQuery(query) {
    set({ searchQuery: query });
  },

  setSelectedOrg(org) {
    set({ selectedOrg: org });
  },

  async updateOrgStatus(orgId, status, comment) {
    try {
      await apiService.updateOrgStatus(orgId, status, comment);
      // Refresh the org in the list
      const { organizations } = get();
      const updated = organizations.map(o =>
        o._id === orgId ? { ...o, status } : o
      );
      set({ organizations: updated });
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  async rejectOrg(orgId, corrections, generalComment) {
    try {
      await apiService.rejectOrganization(orgId, corrections, generalComment);
      const { organizations } = get();
      const updated = organizations.map(o =>
        o._id === orgId ? { ...o, status: 'rejected' } : o
      );
      set({ organizations: updated });
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  async scheduleMinistro(orgId, ministroData) {
    try {
      await apiService.scheduleMinistro(orgId, ministroData);
      const { organizations } = get();
      const updated = organizations.map(o =>
        o._id === orgId ? { ...o, status: 'ministro_scheduled' } : o
      );
      set({ organizations: updated });
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  async refreshOrganization(orgId) {
    try {
      const data = await apiService.getOrganization(orgId);
      const org = data.organization || data;
      const { organizations } = get();
      set({
        organizations: organizations.map(o => o._id === orgId ? org : o),
        selectedOrg: get().selectedOrg?._id === orgId ? org : get().selectedOrg
      });
      return org;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  getFilteredOrganizations() {
    const { organizations, currentFilter, searchQuery } = get();
    let filtered = organizations;

    if (currentFilter === 'all') {
      // Exclude drafts from default view — drafts are private to the user
      filtered = filtered.filter(o => o.status !== 'draft');
    } else {
      filtered = filtered.filter(o => o.status === currentFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        (o.name || '').toLowerCase().includes(q) ||
        (o.type || '').toLowerCase().includes(q) ||
        (o.commune || '').toLowerCase().includes(q)
      );
    }

    return filtered;
  },

  clearError() {
    set({ error: null });
  }
}));
