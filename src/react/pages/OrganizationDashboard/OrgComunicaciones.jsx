import { formatDate } from '../../utils/formatters';

export default function OrgComunicaciones({ org }) {
  const communications = org?.communications || [];

  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', marginBottom: 16 }}>Comunicaciones</h3>

      {communications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
          <p style={{ fontSize: 16 }}>No hay comunicaciones registradas</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>Las comunicaciones enviadas aparecerán aquí</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {communications.map((comm, i) => (
            <div
              key={comm.id || comm._id || i}
              style={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 16
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: '#1e3a8a' }}>{comm.subject || 'Sin asunto'}</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(comm.date)}</span>
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 12 }}>
                {comm.type && <span>Tipo: {comm.type}</span>}
                {comm.recipients && <span>{comm.recipients.length || 0} destinatarios</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
