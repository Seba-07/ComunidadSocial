import { formatDate } from '../../utils/formatters';

const STATUS_COLORS = {
  pending: '#f59e0b', in_progress: '#2563eb', validated: '#06b6d4',
  completed: '#10b981', cancelled: '#ef4444'
};

const STATUS_LABELS = {
  pending: 'Pendiente', in_progress: 'En Proceso', validated: 'Validada',
  completed: 'Completada', cancelled: 'Cancelada'
};

export default function AssignmentCard({ assignment, onSelect }) {
  const a = assignment;
  const status = a.status || 'pending';
  const org = a.organizationId || a.organization || {};
  // Extract YYYY-MM-DD from ISO string directly to avoid UTC→local timezone shift
  const schedDate = (() => {
    if (!a.scheduledDate) return '';
    const s = String(a.scheduledDate);
    return s.length >= 10 && s[4] === '-' ? s.substring(0, 10) : new Date(s).toLocaleDateString('en-CA');
  })();
  const todayDate = new Date().toLocaleDateString('en-CA');
  const isToday = schedDate === todayDate;
  const isOverdue = schedDate && schedDate < todayDate;

  const memberCount = org.members?.length || a.memberCount || 0;

  return (
    <div
      onClick={() => onSelect?.(a)}
      style={{
        background: 'white', borderRadius: 12, padding: 'clamp(14px, 3vw, 20px)',
        border: isToday ? '2px solid #2563eb' : isOverdue ? '2px solid #fca5a5' : '1px solid #e5e7eb',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
        boxShadow: isToday ? '0 2px 12px rgba(37,99,235,0.12)' : isOverdue ? '0 2px 12px rgba(220,38,38,0.1)' : 'none',
        background: isOverdue ? '#fef2f2' : 'white',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'clamp(15px, 3.5vw, 17px)', fontWeight: 700, color: '#111827' }}>
              {a.organizationName || org.organizationName || 'Organización'}
            </span>
            {isToday && (
              <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: '#2563eb', color: 'white' }}>
                HOY
              </span>
            )}
            {isOverdue && (
              <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: '#dc2626', color: 'white' }}>
                ATRASADA
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {org.organizationType?.replace(/_/g, ' ') || ''}
          </span>
        </div>
        <span style={{
          padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 600,
          background: (STATUS_COLORS[status] || '#6b7280') + '20',
          color: STATUS_COLORS[status] || '#6b7280'
        }}>
          {a.assemblyRejected ? 'Rechazada' : STATUS_LABELS[status] || status}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, fontSize: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#374151' }}>
          <span style={{ fontSize: 16 }}>&#128197;</span>
          <span>{a.scheduledDate ? formatDate(a.scheduledDate) : '—'}</span>
        </div>
        {a.scheduledTime && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#374151' }}>
            <span style={{ fontSize: 16 }}>&#128336;</span>
            <span>{a.scheduledTime}</span>
          </div>
        )}
        {a.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#374151' }}>
            <span style={{ fontSize: 16 }}>&#128205;</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.location}</span>
          </div>
        )}
        {memberCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#374151' }}>
            <span style={{ fontSize: 16 }}>&#128101;</span>
            <span>{memberCount} socios</span>
          </div>
        )}
      </div>

      {/* Contact info */}
      {(org.contactPhone || org.contactEmail) && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#6b7280' }}>
          {org.contactPhone && <span>Tel: {org.contactPhone}</span>}
          {org.contactEmail && <span>{org.contactEmail}</span>}
        </div>
      )}
    </div>
  );
}
