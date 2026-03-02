export default function OrgElecciones({ org }) {
  const directorio = org?.directpivaBoard || org?.directorio || [];

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>
        Elecciones y Directorio
      </h2>

      {directorio.length > 0 ? (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Directorio Actual</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {directorio.map((member, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontWeight: 500 }}>{member.role || member.cargo}</span>
                <span style={{ color: '#6b7280' }}>{member.name || member.nombre || `${member.firstName || ''} ${member.lastName || ''}`}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🗳️</p>
          <p style={{ color: '#6b7280', fontSize: 16 }}>No hay información de elecciones disponible.</p>
          <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 8 }}>Las elecciones de directorio se configuran desde la plataforma.</p>
        </div>
      )}
    </div>
  );
}
