import StatusBadge from '../../components/ui/StatusBadge';
import { formatDate } from '../../utils/formatters';

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

export default function OrgOverview({ org, onNavigateTab }) {
  if (!org) return null;

  const memberCount = org.members?.length || 0;
  const assemblyCount = org.assemblies?.length || 0;
  const projectCount = org.projects?.length || 0;
  const activityCount = org.activities?.length || 0;

  // Active assemblies alert
  const activeAssemblies = (org.assemblies || []).filter(
    (a) => a.status === 'convocada' || a.status === 'en_curso'
  );

  return (
    <div>
      {/* Alerts */}
      {activeAssemblies.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {activeAssemblies.map((a) => (
            <div
              key={a.id || a._id}
              style={{
                background: a.status === 'en_curso' ? '#d1fae5' : '#dbeafe',
                border: `1px solid ${a.status === 'en_curso' ? '#10b981' : '#3b82f6'}`,
                borderRadius: 12,
                padding: 16,
                marginBottom: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <span style={{ fontWeight: 600, color: a.status === 'en_curso' ? '#065f46' : '#1e40af' }}>
                  {a.title}
                </span>
                <span style={{ marginLeft: 8, fontSize: 13, color: '#6b7280' }}>
                  {formatDate(a.date)}
                </span>
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: 20,
                color: 'white',
                background: a.status === 'en_curso' ? '#10b981' : '#3b82f6'
              }}>
                {a.status === 'en_curso' ? 'En Curso' : 'Convocada'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Socios" value={memberCount} color="#3b82f6" onClick={() => onNavigateTab('members')} />
        <StatCard label="Asambleas" value={assemblyCount} color="#8b5cf6" onClick={() => onNavigateTab('asambleas')} />
        <StatCard label="Proyectos" value={projectCount} color="#f59e0b" />
        <StatCard label="Actividades" value={activityCount} color="#10b981" />
      </div>

      {/* Organization Info */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', marginBottom: 16 }}>Información de la Organización</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          <InfoRow label="Nombre" value={org.organizationName} />
          <InfoRow label="Tipo" value={TYPE_LABELS[org.organizationType] || org.organizationType} />
          <InfoRow label="Estado"><StatusBadge status={org.status} /></InfoRow>
          <InfoRow label="Dirección" value={org.address} />
          <InfoRow label="Comuna" value={org.comuna} />
          <InfoRow label="Unidad Vecinal" value={org.unidadVecinal} />
          {org.description && <InfoRow label="Descripción" value={org.description} />}
        </div>
      </div>

      {/* Directorio Summary */}
      {org.provisionalDirectorio && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', marginBottom: 16 }}>
            Directorio {org.provisionalDirectorio.type === 'ELECTO' ? 'Electo' : 'Provisorio'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <DirMember label="Presidente" member={org.provisionalDirectorio.president} />
            <DirMember label="Vicepresidente" member={org.provisionalDirectorio.vicePresident} />
            <DirMember label="Secretario" member={org.provisionalDirectorio.secretary} />
            <DirMember label="Tesorero" member={org.provisionalDirectorio.treasurer} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s'
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <span style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 4 }}>{label}</span>
      <span style={{ fontSize: 28, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function InfoRow({ label, value, children }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <span style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 2 }}>{label}</span>
      {children || <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{value || '—'}</span>}
    </div>
  );
}

function DirMember({ label, member }) {
  const name = member
    ? `${member.firstName || member.name || ''} ${member.lastName || ''}`.trim()
    : 'Sin asignar';
  const initial = name[0]?.toUpperCase() || '?';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8 }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', background: member ? '#3b82f6' : '#d1d5db',
        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 600
      }}>
        {initial}
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: member ? '#374151' : '#9ca3af' }}>{name}</div>
      </div>
    </div>
  );
}
