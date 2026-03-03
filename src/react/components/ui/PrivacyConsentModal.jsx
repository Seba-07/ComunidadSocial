import { useState } from 'react';
import { apiService } from '../../../services/ApiService';

/**
 * Modal shown to MIEMBRO users on first login who haven't accepted privacy policy.
 * Cannot be dismissed without accepting.
 */
export default function PrivacyConsentModal({ onAccepted }) {
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleAccept() {
    if (!accepted) {
      setError('Debe aceptar la política de privacidad para continuar');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiService.acceptPrivacy();
      onAccepted();
    } catch (err) {
      setError(err.message || 'Error al aceptar. Intente nuevamente.');
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '32px 36px',
          maxWidth: 520,
          width: '92%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
          Política de Privacidad
        </h2>
        <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.6, marginBottom: 16 }}>
          Antes de continuar, necesitamos que revises y aceptes nuestra política de privacidad.
          Esta plataforma gestiona datos personales conforme a la <strong>Ley 21.719</strong> de
          Protección de Datos Personales.
        </p>

        <div style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: 16,
          marginBottom: 16,
          fontSize: 13,
          color: '#4b5563',
          lineHeight: 1.6,
          maxHeight: 200,
          overflow: 'auto'
        }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#111827' }}>Resumen de la política:</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Recopilamos sus datos de identificación (nombre, RUT, email) para la gestión de organizaciones comunitarias.</li>
            <li>Sus datos son tratados conforme a la Ley 19.418 y la Ley 21.719.</li>
            <li>Tiene derecho a acceder, rectificar, eliminar y exportar sus datos personales.</li>
            <li>Puede gestionar sus preferencias de privacidad desde la pestaña "Privacidad" en el menú.</li>
            <li>No compartimos sus datos con terceros sin su consentimiento explícito.</li>
          </ul>
        </div>

        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          cursor: 'pointer',
          fontSize: 14,
          color: '#374151',
          lineHeight: 1.5,
          marginBottom: 16
        }}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => { setAccepted(e.target.checked); setError(''); }}
            style={{ marginTop: 3, accentColor: '#2563eb', width: 18, height: 18 }}
          />
          <span>
            He leído y acepto la{' '}
            <a href="/app/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
              Política de Privacidad
            </a>{' '}
            y los{' '}
            <a href="/app/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
              Términos de Uso
            </a>
          </span>
        </label>

        {error && (
          <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}

        <button
          onClick={handleAccept}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '12px 24px',
            background: accepted ? '#2563eb' : '#93c5fd',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontSize: 15,
            fontWeight: 600,
            opacity: submitting ? 0.7 : 1,
            transition: 'background 0.2s'
          }}
        >
          {submitting ? 'Aceptando...' : 'Aceptar y Continuar'}
        </button>
      </div>
    </div>
  );
}
