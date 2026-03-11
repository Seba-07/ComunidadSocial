export default function OrgActividades({ org }) {
  const actividades = org?.activities || [];

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>
        Actividades
      </h2>

      {actividades.length > 0 ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {actividades.map((a, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ background: '#eff6ff', borderRadius: 8, padding: '8px 12px', textAlign: 'center', minWidth: 56 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1e40af' }}>
                  {new Date(a.date).getDate()}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>
                  {new Date(a.date).toLocaleString('es-CL', { month: 'short' })}
                </div>
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{a.title || a.nombre}</h3>
                {a.description && <p style={{ color: '#6b7280', fontSize: 14 }}>{a.description}</p>}
                {a.location && (
                  <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>📍 {a.location}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📅</p>
          <p style={{ color: '#6b7280', fontSize: 16 }}>No hay actividades programadas.</p>
          <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 8 }}>Las actividades de la organización aparecerán aquí.</p>
        </div>
      )}
    </div>
  );
}
