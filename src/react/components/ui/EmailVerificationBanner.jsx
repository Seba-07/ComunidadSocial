import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { apiService } from '../../../services/ApiService';

export default function EmailVerificationBanner() {
  const user = useAuthStore(s => s.user);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Listen for EMAIL_NOT_VERIFIED errors from ApiService
  useEffect(() => {
    function handleError() { setDismissed(false); }
    window.addEventListener('email-not-verified', handleError);
    return () => window.removeEventListener('email-not-verified', handleError);
  }, []);

  if (!user || user.emailVerified || dismissed) return null;

  async function handleResend() {
    setSending(true);
    try {
      await apiService.resendVerificationEmail();
      setSent(true);
    } catch { /* ignore */ }
    finally { setSending(false); }
  }

  return (
    <div style={{
      background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 10,
      padding: '10px 16px', marginBottom: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      fontSize: 13
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>&#9888;</span>
        <span style={{ color: '#92400e' }}>
          {sent
            ? 'Email de verificación enviado. Revisa tu bandeja de entrada.'
            : 'Tu email no está verificado. Verifica tu correo para acceder a todas las funciones.'
          }
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {!sent && (
          <button onClick={handleResend} disabled={sending} style={{
            padding: '5px 14px', background: '#f59e0b', color: '#fff', border: 'none',
            borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            opacity: sending ? 0.6 : 1
          }}>
            {sending ? 'Enviando...' : 'Reenviar'}
          </button>
        )}
        <button onClick={() => setDismissed(true)} style={{
          background: 'none', border: 'none', color: '#a16207', cursor: 'pointer',
          fontSize: 16, padding: '0 4px', lineHeight: 1
        }}>&times;</button>
      </div>
    </div>
  );
}
