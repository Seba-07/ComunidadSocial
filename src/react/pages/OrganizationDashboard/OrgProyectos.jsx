export default function OrgProyectos({ org }) {
  const proyectos = org?.projects || [];

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>
        Proyectos
      </h2>

      {proyectos.length > 0 ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {proyectos.map((p, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>{p.title || p.nombre}</h3>
                <span style={{
                  padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500,
                  background: p.status === 'completed' ? '#d1fae5' : p.status === 'active' ? '#dbeafe' : '#fef3c7',
                  color: p.status === 'completed' ? '#065f46' : p.status === 'active' ? '#1e40af' : '#92400e'
                }}>
                  {p.status === 'completed' ? 'Completado' : p.status === 'active' ? 'Activo' : 'Pendiente'}
                </span>
              </div>
              {p.description && <p style={{ color: '#6b7280', fontSize: 14 }}>{p.description}</p>}
              {p.budget != null && (
                <p style={{ color: '#374151', fontSize: 14, marginTop: 8 }}>
                  Presupuesto: ${p.budget?.toLocaleString('es-CL')} CLP
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📁</p>
          <p style={{ color: '#6b7280', fontSize: 16 }}>No hay proyectos registrados.</p>
          <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 8 }}>Los proyectos comunitarios aparecerán aquí.</p>
        </div>
      )}
    </div>
  );
}
