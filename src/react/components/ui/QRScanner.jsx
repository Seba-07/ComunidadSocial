import { useEffect, useRef, useState } from 'react';

/**
 * QRScanner — Camera-based QR code scanner using html5-qrcode.
 * Props:
 *  - onScan(decodedText): called when a QR code is successfully scanned
 *  - onError(errorMessage): optional error callback
 *  - paused: if true, scanning is paused (useful for cooldown between scans)
 *  - width/height: scanner dimensions
 */
export default function QRScanner({ onScan, onError, paused = false, width = 320, height = 320 }) {
  const containerRef = useRef(null);
  const scannerRef = useRef(null);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted || !containerRef.current) return;

        const scanner = new Html5Qrcode(containerRef.current.id);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (!paused && onScan) onScan(decodedText);
          },
          () => {}
        );
        if (mounted) setStarted(true);
      } catch (err) {
        const msg = err?.message || 'No se pudo acceder a la cámara';
        if (mounted) setError(msg);
        if (onError) onError(msg);
      }
    }

    startScanner();

    return () => {
      mounted = false;
      if (scannerRef.current && started) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <div
        id="qr-scanner-container"
        ref={containerRef}
        style={{ width: '100%', maxWidth: width, height, margin: '0 auto', borderRadius: 12, overflow: 'hidden' }}
      />
      {paused && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', borderRadius: 12, color: 'white', fontSize: 14, fontWeight: 600
        }}>
          Procesando...
        </div>
      )}
      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, marginTop: 12, textAlign: 'center' }}>
          {error}
        </div>
      )}
    </div>
  );
}
