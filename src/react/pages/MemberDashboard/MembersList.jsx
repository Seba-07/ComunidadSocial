import DataTable from '../../components/ui/DataTable';

const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

function getColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

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
            background: getColor(members.indexOf(row)),
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
        const label = val === 'directivo' ? 'Directivo' : 'Socio';
        const bg = val === 'directivo' ? '#dbeafe' : '#f3f4f6';
        const color = val === 'directivo' ? '#1e40af' : '#374151';
        return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: bg, color }}>{label}</span>;
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
