import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token de verificación no encontrado');
      return;
    }

    async function verify() {
      try {
        const response = await fetch(`/api/auth/verify-email/${token}`, {
          credentials: 'include'
        });
        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage('Tu correo electrónico ha sido verificado exitosamente.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Error al verificar email');
        }
      } catch {
        setStatus('error');
        setMessage('Error de conexión. Intenta nuevamente.');
      }
    }

    verify();
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 48px', maxWidth: 440, width: '90%', textAlign: 'center', border: '1px solid #e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        {status === 'loading' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>&#9203;</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Verificando...</h2>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Estamos verificando tu correo electrónico.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
              &#10003;
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Email Verificado</h2>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>{message}</p>
            <button
              onClick={() => navigate('/login')}
              style={{ padding: '12px 32px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              Ir al Inicio
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28, color: '#dc2626' }}>
              &#10007;
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Error de Verificación</h2>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>{message}</p>
            <button
              onClick={() => navigate('/login')}
              style={{ padding: '12px 32px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              Ir al Inicio
            </button>
          </>
        )}
      </div>
    </div>
  );
}
