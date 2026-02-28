import Modal from './Modal';

export default function ConfirmDialog({
  open, onClose, onConfirm, title = 'Confirmar',
  message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  variant = 'danger', isLoading = false
}) {
  const colors = {
    danger: { bg: '#ef4444', hover: '#dc2626' },
    warning: { bg: '#f59e0b', hover: '#d97706' },
    primary: { bg: '#2563eb', hover: '#1d4ed8' }
  };
  const c = colors[variant] || colors.primary;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p style={{ color: '#374151', fontSize: 15, lineHeight: 1.6, margin: '0 0 24px' }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          disabled={isLoading}
          style={{
            padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 10,
            background: 'white', color: '#374151', fontSize: 14, fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          style={{
            padding: '10px 20px', border: 'none', borderRadius: 10,
            background: c.bg, color: 'white', fontSize: 14, fontWeight: 600,
            cursor: isLoading ? 'wait' : 'pointer', opacity: isLoading ? 0.7 : 1
          }}
        >
          {isLoading ? 'Procesando...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
