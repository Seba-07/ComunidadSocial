export default function ValidateCommission({ wizardData, updateWizardData, onNext, onPrev }) {
  const commission = wizardData.comisionElectoral || [];

  function toggleValidated(idx) {
    const updated = [...commission];
    updated[idx] = { ...updated[idx], validated: !updated[idx].validated };
    updateWizardData({ comisionElectoral: updated });
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Verificar Comisión Electoral
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        Verifica la identidad de los miembros de la comisión electoral.
      </p>

      <div style={{ display: 'grid', gap: 12 }}>
        {commission.map((m, i) => (
          <div key={i} style={{
            padding: 16, border: '1px solid #e5e7eb', borderRadius: 10,
            background: m.validated ? '#f0fdf4' : 'white',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 8
          }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                Miembro {i + 1}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                {m.firstName || m.name || ''} {m.lastName || ''} - {m.rut || ''}
              </p>
            </div>
            <button
              onClick={() => toggleValidated(i)}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: m.validated ? '1px solid #10b981' : '1px solid #d1d5db',
                background: m.validated ? '#10b981' : 'white',
                color: m.validated ? 'white' : '#374151'
              }}
            >
              {m.validated ? 'Verificado' : 'Verificar'}
            </button>
          </div>
        ))}
      </div>

      {commission.length === 0 && (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>
          Sin comisión electoral registrada
        </p>
      )}

      <div className="r-toolbar" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, flexWrap: 'wrap', gap: 8 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={onNext} style={nextBtn}>Siguiente</button>
      </div>
    </div>
  );
}

const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
const nextBtn = { padding: '12px 28px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
