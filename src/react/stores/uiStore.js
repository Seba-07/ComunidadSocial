import { create } from 'zustand';

let toastId = 0;

export const useUiStore = create((set) => ({
  toasts: [],
  sidebarOpen: false,

  addToast(message, type = 'info', duration) {
    const id = ++toastId;
    // Errores duran 8s por defecto para poder leerlos/copiarlos
    const ms = duration ?? (type === 'error' ? 8000 : 3000);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));
    if (ms > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id)
        }));
      }, ms);
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
