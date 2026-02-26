import { useUiStore } from '../../stores/uiStore';

const toastStyles = {
  container: {
    position: 'fixed',
    top: 24,
    right: 24,
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  toast: (type) => ({
    padding: '16px 24px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    color: 'white',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
    animation: 'slideInRight 0.3s ease',
    cursor: 'pointer',
    background:
      type === 'error' ? '#ef4444' :
      type === 'success' ? '#10b981' :
      '#3b82f6'
  })
};

export default function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts);
  const removeToast = useUiStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div style={toastStyles.container}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={toastStyles.toast(toast.type)}
          onClick={() => removeToast(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
