import { formatDate } from '../../utils/formatters';

const AVATAR_COLORS = {
  presidente: '#1e40af',
  vicepresidente: '#7c3aed',
  secretario: '#059669',
  tesorero: '#d97706',
  director: '#6b7280'
};

const ROLE_DESCRIPTIONS = {
  president: 'Representante legal de la organización. Preside las reuniones y firma documentos oficiales.',
  vicePresident: 'Reemplaza al presidente en su ausencia y colabora en la gestión.',
  secretary: 'Lleva las actas, correspondencia y registro de socios.',
  treasurer: 'Administra los fondos, lleva la contabilidad y presenta el balance anual.',
  director1: 'Colabora en la gestión y participa en las decisiones del directorio.',
  director2: 'Colabora en la gestión y participa en las decisiones del directorio.',
  directorPrevencion: 'Encargado de coordinar acciones de prevención y seguridad.',
  directorConvivencia: 'Encargado de promover la buena convivencia entre vecinos.'
};

const POSITION_CONFIG = {
  JUNTA_VECINOS: [
    { key: 'president', label: 'Presidente', color: AVATAR_COLORS.presidente },
    { key: 'vicePresident', label: 'Vicepresidente', color: AVATAR_COLORS.vicepresidente },
    { key: 'secretary', label: 'Secretario', color: AVATAR_COLORS.secretario },
    { key: 'treasurer', label: 'Tesorero', color: AVATAR_COLORS.tesorero },
    { key: 'director1', label: 'Director', color: AVATAR_COLORS.director }
  ],
  COMITE_VIVIENDA: [
    { key: 'president', label: 'Presidente', color: AVATAR_COLORS.presidente },
    { key: 'secretary', label: 'Secretario', color: AVATAR_COLORS.secretario },
    { key: 'treasurer', label: 'Tesorero', color: AVATAR_COLORS.tesorero },
    { key: 'director1', label: 'Director 1', color: AVATAR_COLORS.director },
    { key: 'director2', label: 'Director 2', color: AVATAR_COLORS.director }
  ],
  COMITE_CONVIVENCIA: [
    { key: 'president', label: 'Presidente', color: AVATAR_COLORS.presidente },
    { key: 'vicePresident', label: 'Vicepresidente', color: AVATAR_COLORS.vicepresidente },
    { key: 'secretary', label: 'Secretario', color: AVATAR_COLORS.secretario },
    { key: 'treasurer', label: 'Tesorero', color: AVATAR_COLORS.tesorero },
    { key: 'directorPrevencion', label: 'Director de Prevención', color: AVATAR_COLORS.director },
    { key: 'directorConvivencia', label: 'Director de Convivencia', color: AVATAR_COLORS.director }
  ],
  CENTRO_PADRES: [
    { key: 'president', label: 'Presidente', color: AVATAR_COLORS.presidente },
    { key: 'secretary', label: 'Secretario', color: AVATAR_COLORS.secretario },
    { key: 'treasurer', label: 'Tesorero', color: AVATAR_COLORS.tesorero },
    { key: 'director1', label: 'Director', color: AVATAR_COLORS.director }
  ]
};

const DEFAULT_POSITIONS = [
  { key: 'president', label: 'Presidente', color: AVATAR_COLORS.presidente },
  { key: 'vicePresident', label: 'Vicepresidente', color: AVATAR_COLORS.vicepresidente },
  { key: 'secretary', label: 'Secretario', color: AVATAR_COLORS.secretario },
  { key: 'treasurer', label: 'Tesorero', color: AVATAR_COLORS.tesorero },
  { key: 'director1', label: 'Director', color: AVATAR_COLORS.director }
];

function getMemberName(member) {
  if (!member) return null;
  return `${member.firstName || member.name || ''} ${member.lastName || ''}`.trim() || null;
}

export default function OrgDirectorio({ org }) {
  const dir = org?.provisionalDirectorio;
  if (!dir) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
        <p style={{ fontSize: 16 }}>No hay directorio configurado</p>
      </div>
    );
  }

  const dirType = dir.type === 'ELECTO' ? 'Electo' : 'Provisorio';

  // Use estatutosSnapshot config if available, otherwise org type config
  const positions = POSITION_CONFIG[org.organizationType] || DEFAULT_POSITIONS;
  const additionalMembers = dir.additionalMembers || [];

  // Deadline calculation (3 years renewal cycle)
  const elections = (org.assemblies || []).filter(
    (a) => a.status === 'finalizada' && a.agendaItems?.some((item) => item.type === 'eleccion_directorio')
  );
  let lastElectionDate = null;
  if (elections.length > 0) {
    lastElectionDate = elections.reduce((latest, e) => {
      const d = new Date(e.date);
      return d > latest ? d : latest;
    }, new Date(0));
  }
  const constitutionDate = org.statusHistory?.find((s) => s.status === 'constituida')?.date;
  const referenceDate = lastElectionDate || (constitutionDate ? new Date(constitutionDate) : (org.createdAt ? new Date(org.createdAt) : null));

  let deadline = null;
  let daysLeft = null;
  if (referenceDate) {
    deadline = new Date(referenceDate);
    deadline.setFullYear(deadline.getFullYear() + 3);
    daysLeft = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', margin: 0 }}>Directorio</h3>
        <span style={{
          padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
          background: dirType === 'Electo' ? '#d1fae5' : '#fef3c7',
          color: dirType === 'Electo' ? '#065f46' : '#92400e'
        }}>
          {dirType}
        </span>
      </div>

      {/* Info panel */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 16, marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
        {dirType === 'Provisorio'
          ? 'El directorio provisorio será reemplazado por uno definitivo tras la primera elección. Debe tener un mínimo de 5 miembros.'
          : 'El directorio electo se renueva cada 3 años. Los miembros pueden ser reelectos por períodos sucesivos.'}
        {lastElectionDate && (
          <span style={{ display: 'block', marginTop: 4 }}>
            Última elección: {formatDate(lastElectionDate.toISOString())}
          </span>
        )}
      </div>

      {/* Deadline alert */}
      {deadline && daysLeft !== null && (
        <div style={{
          background: daysLeft < 0 ? '#fee2e2' : daysLeft < 180 ? '#fef3c7' : '#d1fae5',
          border: `1px solid ${daysLeft < 0 ? '#fca5a5' : daysLeft < 180 ? '#fde68a' : '#bbf7d0'}`,
          borderRadius: 12, padding: 16, marginBottom: 24
        }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: daysLeft < 0 ? '#ef4444' : daysLeft < 180 ? '#d97706' : '#059669', marginBottom: 4 }}>
            {daysLeft < 0 ? 'Renovación Vencida' : daysLeft < 180 ? 'Renovación Próxima' : 'Renovación al Día'}
          </div>
          <div style={{ fontSize: 13, color: '#374151' }}>
            Fecha de renovación: {formatDate(deadline.toISOString())}
            {daysLeft < 0
              ? ` (Vencido hace ${Math.abs(daysLeft)} días)`
              : ` (${daysLeft} días restantes)`}
          </div>
        </div>
      )}

      {/* Director cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {positions.map(({ key, label, color }) => (
          <DirectorCard key={key} posKey={key} label={label} member={dir[key]} color={color} />
        ))}
        {additionalMembers.map((m, i) => (
          <DirectorCard key={`add-${i}`} posKey={`director${i + 1}`} label={m.cargo || `Director ${i + 1}`} member={m} color={AVATAR_COLORS.director} />
        ))}
      </div>
    </div>
  );
}

function DirectorCard({ posKey, label, member, color }) {
  const name = getMemberName(member);
  const rut = member?.rut;
  const initial = name ? name[0].toUpperCase() : '?';
  const description = ROLE_DESCRIPTIONS[posKey] || '';

  return (
    <div style={{
      background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: description ? 12 : 0 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: name ? color : '#d1d5db', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700, flexShrink: 0
        }}>
          {initial}
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: name ? '#1e3a8a' : '#9ca3af' }}>
            {name || 'Sin asignar'}
          </div>
          {rut && <div style={{ fontSize: 12, color: '#6b7280' }}>{rut}</div>}
        </div>
      </div>
      {description && (
        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
          {description}
        </div>
      )}
    </div>
  );
}
