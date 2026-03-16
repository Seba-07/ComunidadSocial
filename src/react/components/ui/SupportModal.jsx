import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { apiService } from '@services/ApiService.js';
import Modal from './Modal';

export default function SupportModal({ open, onClose }) {
  const { user } = useAuthStore();
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSending(true);
    setError('');

    try {
      await apiService.createSupportTicket({ description: description.trim() });
      setSent(true);
      setDescription('');
    } catch (err) {
      setError(err.message || 'Error al enviar ticket');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    setError('');
    setDescription('');
    onClose();
  };

  if (sent) {
    return (
      <Modal open={open} onClose={handleClose} title="Ticket Enviado">
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#10004;</div>
          <p style={{ color: '#059669', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Tu solicitud fue enviada correctamente
          </p>
          <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
            Nuestro equipo de soporte la revisara y te contactara a la brevedad.
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
            marginTop: 16
          }}
        >
          Cerrar
        </button>
      </Modal>
    );
  }

  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

  return (
    <Modal open={open} onClose={handleClose} title="Ayuda / Soporte">
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
        Describe tu problema o consulta y nuestro equipo te contactara.
      </p>

      <form onSubmit={handleSubmit}>
        {/* Read-only user info */}
        <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Nombre</label>
            <input
              type="text"
              value={fullName}
              disabled
              style={disabledInputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>RUT</label>
              <input
                type="text"
                value={user?.rut || 'No registrado'}
                disabled
                style={disabledInputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Correo</label>
              <input
                type="text"
                value={user?.email || 'No registrado'}
                disabled
                style={disabledInputStyle}
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Descripcion del problema *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe con detalle que problema tienes o que necesitas..."
            maxLength={5000}
            rows={5}
            required
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '2px solid #e5e7eb',
              borderRadius: 10,
              fontSize: 14,
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#2563eb'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
          <div style={{ textAlign: 'right', fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
            {description.length}/5000
          </div>
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
          disabled={sending || !description.trim()}
          style={{
            width: '100%',
            padding: '12px',
            background: sending || !description.trim()
              ? '#94a3b8'
              : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: sending || !description.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {sending ? 'Enviando...' : 'Enviar Ticket de Soporte'}
        </button>
      </form>
    </Modal>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 4
};

const disabledInputStyle = {
  width: '100%',
  padding: '10px 14px',
  border: '2px solid #f3f4f6',
  borderRadius: 10,
  fontSize: 14,
  background: '#f9fafb',
  color: '#6b7280',
  boxSizing: 'border-box'
};
