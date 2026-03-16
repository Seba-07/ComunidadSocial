import { useState } from 'react';
import { apiService } from '@services/ApiService.js';
import Modal from '../../components/ui/Modal';

export default function ForgotPasswordModal({ open, onClose }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setError('');

    try {
      await apiService.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || 'Error al procesar solicitud');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    setError('');
    setEmail('');
    onClose();
  };

  if (sent) {
    return (
      <Modal open={open} onClose={handleClose} title="Revisa tu correo">
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#9993;</div>
          <p style={{ color: '#059669', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Enlace de recuperacion enviado
          </p>
          <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, marginBottom: 4 }}>
            Si el correo <strong>{email}</strong> esta registrado en nuestro sistema, recibiras un enlace para restablecer tu contraseña.
          </p>
          <p style={{ color: '#9ca3af', fontSize: 13 }}>
            El enlace expira en 1 hora. Revisa tu bandeja de spam si no lo encuentras.
          </p>
        </div>
        <button
          onClick={handleClose}
          style={{
            width: '100%',
            padding: '12px',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: 20
          }}
        >
          Entendido
        </button>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Recuperar contraseña">
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
        Ingresa tu correo electronico y te enviaremos un enlace para restablecer tu contraseña.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Correo electronico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.cl"
            required
            autoFocus
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '2px solid #e5e7eb',
              borderRadius: 10,
              fontSize: 15,
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#2563eb'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#dc2626',
            fontSize: 13,
            marginBottom: 16
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={sending || !email.trim()}
          style={{
            width: '100%',
            padding: '12px',
            background: sending || !email.trim()
              ? '#94a3b8'
              : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: sending || !email.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {sending ? 'Enviando...' : 'Enviar enlace de recuperacion'}
        </button>
      </form>
    </Modal>
  );
}
