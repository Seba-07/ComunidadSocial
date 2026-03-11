import { useUiStore } from '../../stores/uiStore';

const toastStyles = {
  container: {
    position: 'fixed',
    top: 24,
    right: 24,
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxWidth: 'min(420px, calc(100vw - 48px))'
  },
  toast: (type) => ({
    padding: '14px 40px 14px 18px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    color: 'white',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
    animation: 'slideInRight 0.3s ease',
    position: 'relative',
    userSelect: 'text',
    cursor: 'default',
    wordBreak: 'break-word',
    background:
      type === 'error' ? '#ef4444' :
      type === 'success' ? '#10b981' :
      '#3b82f6'
  }),
  closeBtn: {
    position: 'absolute',
    top: 8,
    right: 10,
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 18,
    cursor: 'pointer',
    padding: '2px 6px',
    lineHeight: 1
  }
};

export default function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts);
  const removeToast = useUiStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div style={toastStyles.container}>
      {toasts.map((toast) => (
        <div key={toast.id} style={toastStyles.toast(toast.type)}>
          {toast.message}
          <button
            style={toastStyles.closeBtn}
            onClick={() => removeToast(toast.id)}
            aria-label="Cerrar"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
