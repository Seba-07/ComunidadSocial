import StatusBadge from '../../components/ui/StatusBadge';
import { formatDate } from '../../utils/formatters';

const STATUS_COLORS = {
  pending: '#f59e0b', in_progress: '#2563eb', validated: '#06b6d4',
  completed: '#10b981', cancelled: '#ef4444'
};

const STATUS_LABELS = {
  pending: 'Pendiente', in_progress: 'En Proceso', validated: 'Validada',
  completed: 'Completada', cancelled: 'Cancelada'
};

export default function AssignmentCard({ assignment, onValidate }) {
  const a = assignment;
  const status = a.status || 'pending';
  const canValidate = status === 'pending' || status === 'in_progress';

  return (
    <div style={{
      background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
      padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>
            {a.organizationName || a.organization?.name || 'Organización'}
          </span>
          <span style={{
            padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
            background: (STATUS_COLORS[status] || '#6b7280') + '20',
            color: STATUS_COLORS[status] || '#6b7280'
          }}>
            {STATUS_LABELS[status] || status}
          </span>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 16 }}>
          {(a.date || a.scheduledDate) && <span>{formatDate(a.date || a.scheduledDate)}</span>}
          {a.time && <span>{a.time}</span>}
          {a.address && <span>{a.address}</span>}
        </div>
      </div>

      {canValidate && onValidate && (
        <button onClick={onValidate} style={{
          padding: '10px 20px', border: 'none', borderRadius: 10,
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white',
          fontSize: 14, fontWeight: 600, cursor: 'pointer'
        }}>
          Validar
        </button>
      )}
    </div>
  );
}
