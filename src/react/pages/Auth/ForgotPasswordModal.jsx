import Modal from '../../components/ui/Modal';

export default function ForgotPasswordModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="¿Olvidaste tu contraseña?">
      <p style={{ color: '#374151', marginBottom: 20, fontSize: 15, lineHeight: 1.6 }}>
        Para restablecer tu contraseña, contacta al administrador de tu organización o al equipo de soporte.
      </p>
      <div style={{
        padding: 20,
        background: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: 12,
        marginBottom: 24
      }}>
        <p style={{ margin: '0 0 12px 0', color: '#0c4a6e', fontWeight: 600, fontSize: 15 }}>
          Información de contacto
        </p>
        <p style={{ margin: 0, color: '#374151', fontSize: 14, lineHeight: 1.8 }}>
          <strong>Email:</strong> admin@renca.cl<br />
          <strong>Teléfono:</strong> +56 2 2345 6789
        </p>
      </div>
      <button
        onClick={onClose}
        className="btn-auth"
        style={{ width: '100%' }}
      >
        Entendido
      </button>
    </Modal>
  );
}
