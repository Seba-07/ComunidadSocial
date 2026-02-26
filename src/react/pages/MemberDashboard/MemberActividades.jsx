import { formatDate } from '../../utils/formatters';

export default function MemberActividades({ activities = [] }) {
  if (activities.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
        <p style={{ fontSize: 16, fontWeight: 500 }}>No hay actividades registradas</p>
        <p style={{ fontSize: 13, marginTop: 8 }}>Las actividades de la organización aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', marginBottom: 16 }}>
        Actividades ({activities.length})
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activities.map((act, i) => (
          <div
            key={act.id || act._id || i}
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderLeft: '4px solid #3b82f6',
              borderRadius: 12,
              padding: 16
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: '#1e3a8a' }}>{act.title || act.name}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(act.date)}</span>
            </div>
            {act.description && (
              <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{act.description}</p>
            )}
            {act.category && (
              <span style={{ display: 'inline-block', marginTop: 8, fontSize: 11, padding: '2px 10px', borderRadius: 12, background: '#dbeafe', color: '#1e40af', fontWeight: 500 }}>
                {act.category}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
