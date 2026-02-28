import { create } from 'zustand';
import { apiService } from '@services/ApiService.js';

export const useAssignmentsStore = create((set, get) => ({
  assignments: [],
  myPending: [],
  isLoading: false,
  error: null,

  async fetchAssignments() {
    set({ isLoading: true, error: null });
    try {
      const data = await apiService.getAssignments();
      const assignments = data.assignments || data || [];
      set({ assignments, isLoading: false });
      return assignments;
    } catch (error) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  async fetchMyPending() {
    set({ isLoading: true, error: null });
    try {
      const data = await apiService.getMyPendingAssignments();
      const myPending = data.assignments || data || [];
      set({ myPending, isLoading: false });
      return myPending;
    } catch (error) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  async fetchMinistroAssignments(ministroId) {
    set({ isLoading: true, error: null });
    try {
      const data = await apiService.getMinistroAssignments(ministroId);
      const assignments = data.assignments || data || [];
      set({ assignments, isLoading: false });
      return assignments;
    } catch (error) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  async validateSignatures(assignmentId, signatures, wizardData) {
    try {
      const data = await apiService.validateSignatures(assignmentId, signatures, wizardData);
      // Update the assignment in both lists
      const update = (list) => list.map(a =>
        a._id === assignmentId ? { ...a, status: 'validated', ...data } : a
      );
      set(state => ({
        assignments: update(state.assignments),
        myPending: state.myPending.filter(a => a._id !== assignmentId)
      }));
      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  async completeAssignment(assignmentId) {
    try {
      const data = await apiService.completeAssignment(assignmentId);
      set(state => ({
        assignments: state.assignments.map(a =>
          a._id === assignmentId ? { ...a, status: 'completed' } : a
        ),
        myPending: state.myPending.filter(a => a._id !== assignmentId)
      }));
      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  clearError() {
    set({ error: null });
  }
}));
