import DataTable from '../../components/ui/DataTable';

const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

const ROLE_LABELS = {
  president: 'Presidente',
  secretary: 'Secretario',
  treasurer: 'Tesorero',
  director: 'Director',
  member: 'Socio',
  electoral_commission: 'Comisión Electoral'
};

const ROLE_COLORS = {
  president: { bg: '#fef3c7', color: '#92400e' },
  secretary: { bg: '#dbeafe', color: '#1e40af' },
  treasurer: { bg: '#d1fae5', color: '#065f46' },
  director: { bg: '#ede9fe', color: '#5b21b6' },
  electoral_commission: { bg: '#fce7f3', color: '#9d174d' },
  member: { bg: '#f3f4f6', color: '#374151' }
};


export default function MembersList({ members = [] }) {
  const columns = [
    {
      key: 'name',
      label: 'Nombre',
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: AVATAR_COLORS[((row.firstName || '?').charCodeAt(0) + (row.lastName || '?').charCodeAt(0)) % AVATAR_COLORS.length],
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 600
          }}>
            {(row.firstName || '?')[0].toUpperCase()}
          </div>
          <span style={{ fontWeight: 500 }}>{row.firstName} {row.lastName}</span>
        </div>
      )
    },
    { key: 'rut', label: 'RUT' },
    {
      key: 'role',
      label: 'Rol',
      render: (val) => {
        const label = ROLE_LABELS[val] || val || 'Socio';
        const colors = ROLE_COLORS[val] || ROLE_COLORS.member;
        return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: colors.bg, color: colors.color }}>{label}</span>;
      }
    }
  ];

  // Add a virtual 'name' field for sorting
  const data = members.map((m) => ({ ...m, name: `${m.firstName} ${m.lastName}` }));

  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', marginBottom: 16 }}>
        Miembros ({members.length})
      </h3>
      <DataTable columns={columns} data={data} emptyMessage="No hay miembros registrados" />
    </div>
  );
}
