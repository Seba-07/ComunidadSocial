import StatusBadge from '../../components/ui/StatusBadge';

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
      <div className="r-grid-auto" style={{ gap: 16, marginBottom: 32 }}>
        <StatCard label="Socios" value={memberCount} color="#3b82f6" />
        <StatCard label="Asambleas" value={assemblyCount} color="#8b5cf6" />
        <StatCard label="Directorio" value={dirType} color="#10b981" />
        <div style={statCardStyle}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Estado</span>
          <StatusBadge status={org.status} />
        </div>
      </div>

      {/* Org Info */}
      <div className="r-grid-auto" style={{ gap: 16 }}>
        <InfoRow label="Tipo" value={prettifyType(org.organizationType)} />
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
