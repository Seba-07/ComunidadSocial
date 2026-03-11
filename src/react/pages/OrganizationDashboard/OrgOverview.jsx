import StatusBadge from '../../components/ui/StatusBadge';
import { formatDate } from '../../utils/formatters';

const TYPE_LABELS = {
  // Territoriales
  JUNTA_VECINOS: 'Junta de Vecinos',
  COMITE_VECINOS: 'Comité de Vecinos',
  // Clubes
  CLUB_DEPORTIVO: 'Club Deportivo',
  CLUB_ADULTO_MAYOR: 'Club de Adulto Mayor',
  CLUB_JUVENIL: 'Club Juvenil',
  CLUB_CULTURAL: 'Club Cultural',
  // Centros
  CENTRO_MADRES: 'Centro de Madres',
  CENTRO_PADRES: 'Centro de Padres',
  CENTRO_CULTURAL: 'Centro Cultural',
  // Agrupaciones
  AGRUPACION_FOLCLORICA: 'Agrupación Folclórica',
  AGRUPACION_CULTURAL: 'Agrupación Cultural',
  AGRUPACION_JUVENIL: 'Agrupación Juvenil',
  AGRUPACION_AMBIENTAL: 'Agrupación Ambiental',
  AGRUPACION_EMPRENDEDORES: 'Agrupación de Emprendedores',
  // Comités
  COMITE_VIVIENDA: 'Comité de Vivienda',
  COMITE_ALLEGADOS: 'Comité de Allegados',
  COMITE_APR: 'Comité APR',
  COMITE_ADELANTO: 'Comité de Adelanto',
  COMITE_MEJORAMIENTO: 'Comité de Mejoramiento',
  COMITE_CONVIVENCIA: 'Comité de Convivencia',
  // Organizaciones específicas
  ORG_SCOUT: 'Organización Scout',
  ORG_MUJERES: 'Organización de Mujeres',
  ORG_INDIGENA: 'Organización Indígena',
  ORG_SALUD: 'Organización de Salud',
  ORG_SOCIAL: 'Organización Social',
  ORG_CULTURAL: 'Organización Cultural',
  // Arte y cultura
  GRUPO_TEATRO: 'Grupo de Teatro',
  CORO: 'Coro',
  TALLER_ARTESANIA: 'Taller de Artesanía',
  // Genéricos
  ORG_COMUNITARIA: 'Organización Comunitaria',
  ORG_FUNCIONAL: 'Organización Funcional',
  OTRA_FUNCIONAL: 'Otra Funcional'
};

function prettifyType(type) {
  if (!type) return '—';
  return TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bOrg\b/i, 'Organización').replace(/\bApr\b/i, 'APR');
}

export default function OrgOverview({ org, onNavigateTab }) {
  if (!org) return null;

  const memberCount = org.members?.length || 0;
  const assemblyCount = org.assemblies?.length || 0;

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
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap'
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontWeight: 600, color: a.status === 'en_curso' ? '#065f46' : '#1e40af', wordBreak: 'break-word' }}>
                  {a.title}
                </span>
                <span style={{ marginLeft: 8, fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
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
      <div className="r-grid-2" style={{ marginBottom: 32 }}>
        <StatCard label="Socios" value={memberCount} color="#3b82f6" onClick={() => onNavigateTab('members')} />
        <StatCard label="Asambleas" value={assemblyCount} color="#8b5cf6" onClick={() => onNavigateTab('asambleas')} />
      </div>

      {/* Organization Info */}
      <div className="r-card" style={{ background: 'white', border: '1px solid #e5e7eb', marginBottom: 24 }}>
        <h3 className="r-page-title" style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', marginBottom: 16 }}>Información de la Organización</h3>
        <div className="r-grid-2">
          <InfoRow label="Nombre" value={org.organizationName} />
          <InfoRow label="Tipo" value={prettifyType(org.organizationType)} />
          <InfoRow label="Estado"><StatusBadge status={org.status} /></InfoRow>
          <InfoRow label="Dirección" value={org.address} />
          <InfoRow label="Comuna" value={org.comuna} />
          <InfoRow label="Unidad Vecinal" value={org.unidadVecinal} />
          {org.description && <InfoRow label="Descripción" value={org.description} />}
        </div>
      </div>

      {/* Directorio Summary */}
      {org.provisionalDirectorio && (
        <div className="r-card" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
          <h3 className="r-page-title" style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', marginBottom: 16 }}>
            Directorio {org.provisionalDirectorio.type === 'ELECTO' ? 'Electo' : 'Provisorio'}
          </h3>
          <div className="r-grid-2">
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
