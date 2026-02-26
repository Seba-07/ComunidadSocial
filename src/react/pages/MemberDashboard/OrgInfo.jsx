import StatusBadge from '../../components/ui/StatusBadge';

const TYPE_LABELS = {
  JUNTA_VECINOS: 'Junta de Vecinos',
  CLUB_DEPORTIVO: 'Club Deportivo',
  CENTRO_MADRES: 'Centro de Madres',
  COMITE_VIVIENDA: 'Comité de Vivienda',
  COMITE_CONVIVENCIA: 'Comité de Convivencia',
  CENTRO_CULTURAL: 'Centro Cultural',
  ORGANIZACION_JUVENIL: 'Organización Juvenil',
  CLUB_ADULTO_MAYOR: 'Club de Adulto Mayor',
  OTRA: 'Otra'
};

export default function OrgInfo({ org }) {
  if (!org) return null;

  const memberCount = org.members?.length || 0;
  const assemblyCount = org.assemblies?.length || 0;
  const dirType = org.provisionalDirectorio?.type === 'ELECTO' ? 'Electo' : 'Provisorio';

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1e3a8a', marginBottom: 24 }}>
        {org.organizationName}
      </h2>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Socios" value={memberCount} color="#3b82f6" />
        <StatCard label="Asambleas" value={assemblyCount} color="#8b5cf6" />
        <StatCard label="Directorio" value={dirType} color="#10b981" />
        <div style={statCardStyle}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Estado</span>
          <StatusBadge status={org.status} />
        </div>
      </div>

      {/* Org Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <InfoRow label="Tipo" value={TYPE_LABELS[org.organizationType] || org.organizationType} />
        <InfoRow label="Dirección" value={org.address} />
        <InfoRow label="Comuna" value={org.comuna} />
        <InfoRow label="Unidad Vecinal" value={org.unidadVecinal} />
        {org.description && <InfoRow label="Descripción" value={org.description} />}
      </div>
    </div>
  );
}

const statCardStyle = {
  background: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 8
};

function StatCard({ label, value, color }) {
  return (
    <div style={statCardStyle}>
      <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px' }}>
      <span style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>{label}</span>
      <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{value || '—'}</span>
    </div>
  );
}
