import { useState } from 'react';
import { apiService } from '@services/ApiService.js';
import Modal from '../../components/ui/Modal';

export default function ContactSupportModal({ open, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !description.trim()) return;

    setSending(true);
    setError('');

    try {
      await apiService.createSupportTicket({
        name: name.trim(),
        email: email.trim(),
        description: description.trim()
      });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Error al enviar mensaje');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    setError('');
    setName('');
    setEmail('');
    setDescription('');
    onClose();
  };

  if (sent) {
    return (
      <Modal open={open} onClose={handleClose} title="Mensaje Enviado">
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#10004;</div>
          <p style={{ color: '#059669', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Tu mensaje fue enviado correctamente
          </p>
          <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
            Nuestro equipo lo revisara y te contactara al correo que proporcionaste.
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

  return (
    <Modal open={open} onClose={handleClose} title="Escribenos">
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
        ¿Tienes un problema o consulta? Dejanos tu mensaje y te responderemos a la brevedad.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre completo"
              maxLength={200}
              required
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <div>
            <label style={labelStyle}>Correo electronico *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.cl"
              maxLength={200}
              required
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <div>
            <label style={labelStyle}>Mensaje *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe tu problema o consulta..."
              maxLength={5000}
              rows={4}
              required
              style={{
                ...inputStyle,
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: 1.5
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
            <div style={{ textAlign: 'right', fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
              {description.length}/5000
            </div>
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
          disabled={sending || !name.trim() || !email.trim() || !description.trim()}
          style={{
            width: '100%',
            padding: '12px',
            background: sending || !name.trim() || !email.trim() || !description.trim()
              ? '#94a3b8'
              : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: sending ? 'not-allowed' : 'pointer'
          }}
        >
          {sending ? 'Enviando...' : 'Enviar Mensaje'}
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

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  border: '2px solid #e5e7eb',
  borderRadius: 10,
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.2s'
};
