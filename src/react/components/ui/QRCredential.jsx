import { QRCodeSVG } from 'qrcode.react';

/**
 * QRCredential — Renders a QR code credential card for a member.
 * The QR encodes the user's qrToken (UUID) for scanning.
 */
export default function QRCredential({ qrToken, name, rut, size = 200 }) {
  if (!qrToken) return null;

  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      padding: 24, background: 'white', borderRadius: 16,
      border: '2px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
    }}>
      <QRCodeSVG value={qrToken} size={size} level="M" includeMargin />
      {name && (
        <div style={{ marginTop: 12, fontSize: 16, fontWeight: 600, color: '#1e3a8a', textAlign: 'center' }}>
          {name}
        </div>
      )}
      {rut && (
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          RUT: {rut}
        </div>
      )}
    </div>
  );
}
