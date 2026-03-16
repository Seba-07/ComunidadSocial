import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiService } from '@services/ApiService.js';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validatePassword = () => {
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (!/[A-Z]/.test(password)) return 'Debe contener al menos una mayuscula';
    if (!/[a-z]/.test(password)) return 'Debe contener al menos una minuscula';
    if (!/[0-9]/.test(password)) return 'Debe contener al menos un numero';
    if (password !== confirmPassword) return 'Las contraseñas no coinciden';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await apiService.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      const msg = err.message || 'Error al restablecer contraseña';
      if (msg.includes('expirado') || msg.includes('invalido') || msg.includes('inválido')) {
        setError('El enlace de recuperacion ha expirado o es invalido. Solicita uno nuevo desde la pagina de inicio.');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <PageWrapper>
        <StatusCard
          icon="&#10007;"
          iconBg="#fef2f2"
          iconColor="#dc2626"
          title="Enlace invalido"
          message="No se encontro el token de recuperacion en la URL."
          buttonLabel="Ir al inicio"
          onAction={() => navigate('/login')}
          buttonColor="#6b7280"
        />
      </PageWrapper>
    );
  }

  if (success) {
    return (
      <PageWrapper>
        <StatusCard
          icon="&#10003;"
          iconBg="#dcfce7"
          iconColor="#059669"
          title="Contraseña actualizada"
          message="Tu contraseña fue restablecida exitosamente. Ya puedes iniciar sesion con tu nueva contraseña."
          buttonLabel="Iniciar sesion"
          onAction={() => navigate('/login')}
          buttonColor="#2563eb"
        />
      </PageWrapper>
    );
  }

  // Password strength indicator
  const checks = [
    { label: '8+ caracteres', pass: password.length >= 8 },
    { label: 'Una mayuscula', pass: /[A-Z]/.test(password) },
    { label: 'Una minuscula', pass: /[a-z]/.test(password) },
    { label: 'Un numero', pass: /[0-9]/.test(password) },
  ];

  return (
    <PageWrapper>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: 'clamp(28px, 5vw, 48px)',
        maxWidth: 440,
        width: '90%',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#128274;</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
            Nueva contraseña
          </h2>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            Ingresa tu nueva contraseña para restablecer el acceso a tu cuenta.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="••••••••"
              required
              autoFocus
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {/* Password strength checks */}
          {password.length > 0 && (
            <div style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
              {checks.map((c) => (
                <div key={c.label} style={{ fontSize: 12, color: c.pass ? '#059669' : '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>{c.pass ? '\u2713' : '\u2717'}</span> {c.label}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
              placeholder="••••••••"
              required
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
            {confirmPassword && password !== confirmPassword && (
              <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>Las contraseñas no coinciden</p>
            )}
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              color: '#dc2626',
              fontSize: 13,
              marginBottom: 16,
              lineHeight: 1.5
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !password || !confirmPassword}
            style={{
              width: '100%',
              padding: '12px',
              background: submitting || !password || !confirmPassword
                ? '#94a3b8'
                : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Restableciendo...' : 'Restablecer contraseña'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => navigate('/login')}
            style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </PageWrapper>
  );
}

function PageWrapper({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1e40af 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      {children}
    </div>
  );
}

function StatusCard({ icon, iconBg, iconColor, title, message, buttonLabel, onAction, buttonColor }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      padding: '40px 48px',
      maxWidth: 440,
      width: '90%',
      textAlign: 'center',
      border: '1px solid #e5e7eb',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px',
        fontSize: 28,
        color: iconColor
      }}>
        {icon}
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{title}</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
      <button
        onClick={onAction}
        style={{
          padding: '12px 32px',
          background: buttonColor,
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        {buttonLabel}
      </button>
    </div>
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
  padding: '12px 14px',
  border: '2px solid #e5e7eb',
  borderRadius: 10,
  fontSize: 15,
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.2s'
};
