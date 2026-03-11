import { useRef, useState, useCallback, useEffect } from 'react';

export default function SignatureCapture({ wizardData, updateWizardData, onNext, onPrev }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!wizardData.ministroSignature);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = 200;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Restore if existing
    if (wizardData.ministroSignature) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = wizardData.ministroSignature;
    }
  }, []);

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0];
    return {
      x: (touch?.clientX || e.clientX) - rect.left,
      y: (touch?.clientY || e.clientY) - rect.top
    };
  }, []);

  function startDraw(e) {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function endDraw(e) {
    e.preventDefault();
    setIsDrawing(false);
    setHasSignature(true);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    updateWizardData({ ministroSignature: null });
  }

  function saveAndNext() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    updateWizardData({ ministroSignature: dataUrl });
    onNext();
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Firma del Ministro de Fe
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        Firme en el recuadro a continuación para certificar la validación.
      </p>

      <div style={{
        border: '2px solid #d1d5db', borderRadius: 12, overflow: 'hidden',
        marginBottom: 12, background: 'white'
      }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: 200, cursor: 'crosshair', touchAction: 'none' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>

      <div className="r-btn-row" style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={clearSignature} style={{
          padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8,
          background: 'white', fontSize: 13, cursor: 'pointer'
        }}>Limpiar</button>
      </div>

      <div>
        <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
          Observaciones
        </label>
        <textarea
          value={wizardData.notes || ''}
          onChange={e => updateWizardData({ notes: e.target.value })}
          rows={3}
          placeholder="Notas adicionales..."
          style={{
            width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 8,
            fontSize: 14, resize: 'vertical'
          }}
        />
      </div>

      <div className="r-toolbar" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, flexWrap: 'wrap', gap: 8 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={saveAndNext} style={nextBtn}>Siguiente</button>
      </div>
    </div>
  );
}

const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
const nextBtn = { padding: '12px 28px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
