export default function ValidateDirectorio({ wizardData, updateWizardData, org, onNext }) {
  const directorio = wizardData.directorio || {};
  const members = directorio.members || Object.entries(directorio)
    .filter(([k]) => !['type', '_id'].includes(k))
    .map(([cargo, data]) => ({
      cargo,
      ...(typeof data === 'object' ? data : {}),
      name: typeof data === 'object'
        ? `${data.firstName || data.name || ''} ${data.lastName || ''}`.trim()
        : String(data)
    }));

  function toggleValidated(idx) {
    const updated = [...members];
    updated[idx] = { ...updated[idx], validated: !updated[idx].validated };
    updateWizardData({ directorio: { ...directorio, members: updated } });
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Verificar Directorio Provisorio
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        Verifica la identidad de cada miembro del directorio.
      </p>

      <div style={{ display: 'grid', gap: 12 }}>
        {members.map((m, i) => (
          <div key={i} style={{
            padding: 16, border: '1px solid #e5e7eb', borderRadius: 10,
            background: m.validated ? '#f0fdf4' : 'white',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#111827', textTransform: 'capitalize' }}>
                {m.cargo || 'Miembro'}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                {m.name || m.firstName || ''} {m.lastName || ''} - {m.rut || ''}
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

      {members.length === 0 && (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>Sin directorio provisorio</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <button onClick={onNext} style={nextBtn}>Siguiente</button>
      </div>
    </div>
  );
}

const nextBtn = { padding: '12px 28px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
