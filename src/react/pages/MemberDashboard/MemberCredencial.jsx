import { useState, useEffect } from 'react';
import { apiService } from '@services/ApiService.js';
import QRCredential from '../../components/ui/QRCredential';

export default function MemberCredencial({ user }) {
  const [qrToken, setQrToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    apiService.get('/users/me/qr-token')
      .then(data => setQrToken(data.qrToken))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate(regenerate = false) {
    setGenerating(true);
    try {
      const data = await apiService.post('/users/me/generate-qr-token', { regenerate });
      setQrToken(data.qrToken);
    } catch (err) {
      console.error('Error generating QR:', err);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>Cargando credencial...</div>;
  }

  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', marginBottom: 8 }}>Mi Credencial QR</h3>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
        Presenta este código QR al organizador para registrar tu asistencia en asambleas.
      </p>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {qrToken ? (
          <>
            <QRCredential
              qrToken={qrToken}
              name={`${user.firstName} ${user.lastName}`}
              rut={user.rut}
              size={220}
            />
            <div style={{ marginTop: 16 }}>
              <button onClick={() => handleGenerate(true)} disabled={generating} style={{
                padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8,
                background: 'white', fontSize: 12, cursor: 'pointer', color: '#6b7280'
              }}>
                {generating ? 'Regenerando...' : 'Regenerar Credencial'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ padding: 32, background: '#f9fafb', borderRadius: 16, border: '1px dashed #d1d5db' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🪪</div>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
              Genera tu credencial QR para poder registrar tu asistencia en asambleas de forma rápida.
            </p>
            <button onClick={() => handleGenerate(false)} disabled={generating} style={{
              padding: '12px 28px', border: 'none', borderRadius: 10,
              background: '#2563eb', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer'
            }}>
              {generating ? 'Generando...' : 'Generar Credencial QR'}
            </button>
          </div>
        )}
      </div>

      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, fontSize: 13, color: '#166534' }}>
        <strong>Cómo funciona:</strong> El organizador de la asamblea escaneará tu código QR con la cámara del celular para registrar tu asistencia. No necesitas hacer nada más — solo muestra tu credencial.
      </div>
    </div>
  );
}
