import { create } from 'zustand';

let toastId = 0;

export const useUiStore = create((set) => ({
  toasts: [],
  sidebarOpen: false,

  addToast(message, type = 'info', duration = 3000) {
    const id = ++toastId;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }]
    }));
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id)
        }));
      }, duration);
    }
    return id;
  },

  removeToast(id) {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  },

  toggleSidebar() {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  closeSidebar() {
    set({ sidebarOpen: false });
  }
}));
