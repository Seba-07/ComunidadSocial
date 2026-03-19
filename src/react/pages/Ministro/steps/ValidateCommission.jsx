export default function ValidateCommission({ wizardData, updateWizardData, onNext, onPrev }) {
  // Handle both array and {members: [...]} formats
  const raw = wizardData.comisionElectoral || [];
  const commission = Array.isArray(raw) ? raw : (raw.members || []);

  function toggleValidated(idx) {
    const updated = [...commission];
    updated[idx] = { ...updated[idx], validated: !updated[idx].validated };
    updateWizardData({ comisionElectoral: updated });
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 'clamp(18px, 4vw, 20px)', fontWeight: 700, color: '#111827' }}>
        Verificar Comision Electoral
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
        Verifique la cedula de identidad de cada miembro de la comision electoral.
      </p>

      <div style={{ display: 'grid', gap: 10 }}>
        {commission.map((m, i) => (
          <div
            key={m.rut || i}
            onClick={() => toggleValidated(i)}
            style={{
              padding: 'clamp(12px, 3vw, 16px)', borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${m.validated ? '#10b981' : '#e5e7eb'}`,
              background: m.validated ? '#f0fdf4' : 'white',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: 8, minHeight: 52,
              touchAction: 'manipulation', transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <div>
              <span style={{ fontWeight: 600, fontSize: 'clamp(13px, 3vw, 14px)', color: '#2563eb', display: 'block', marginBottom: 2 }}>
                Miembro {i + 1}
              </span>
              <span style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#111827' }}>
                {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.name || ''} — {m.rut || '—'}
              </span>
            </div>
            <div style={{
              width: 'clamp(32px, 7vw, 40px)', height: 'clamp(32px, 7vw, 40px)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'clamp(16px, 4vw, 20px)', flexShrink: 0,
              background: m.validated ? '#10b981' : '#f3f4f6',
              color: m.validated ? 'white' : '#d1d5db',
              transition: 'background 0.15s',
            }}>
              {m.validated ? '\u2713' : ''}
            </div>
          </div>
        ))}
      </div>

      {commission.length === 0 && (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>
          Sin comision electoral registrada
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, flexWrap: 'wrap', gap: 8 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={onNext} style={nextBtn}>Siguiente</button>
      </div>
    </div>
  );
}

const prevBtn = { padding: 'clamp(10px, 2.5vw, 12px) clamp(20px, 5vw, 28px)', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 'clamp(14px, 3vw, 15px)', cursor: 'pointer', color: '#374151' };
const nextBtn = { padding: 'clamp(10px, 2.5vw, 12px) clamp(20px, 5vw, 28px)', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 'clamp(14px, 3vw, 15px)', fontWeight: 600, cursor: 'pointer' };
