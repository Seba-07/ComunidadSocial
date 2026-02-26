const AVATAR_COLORS = {
  presidente: '#1e40af',
  vicepresidente: '#7c3aed',
  secretario: '#059669',
  tesorero: '#d97706',
  director: '#6b7280'
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

export default function MemberDirectorio({ org }) {
  const dir = org?.provisionalDirectorio;
  if (!dir) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
        <p style={{ fontSize: 16 }}>No hay directorio configurado</p>
      </div>
    );
  }

  const dirType = dir.type === 'ELECTO' ? 'Electo' : 'Provisorio';
  const positions = POSITION_CONFIG[org.organizationType] || DEFAULT_POSITIONS;
  const additionalMembers = dir.additionalMembers || [];

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

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 16, marginBottom: 24, fontSize: 13, color: '#1e40af' }}>
        El directorio debe tener un mínimo de 5 miembros y se renueva cada 3 años.
        {dirType === 'Provisorio'
          ? ' El directorio provisorio será reemplazado por uno definitivo tras la primera elección.'
          : ' Los miembros pueden ser reelectos.'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {positions.map(({ key, label, color }) => {
          const member = dir[key];
          return <DirectorCard key={key} label={label} member={member} color={color} />;
        })}
        {additionalMembers.map((m, i) => (
          <DirectorCard key={`add-${i}`} label={m.cargo || `Director ${i + 1}`} member={m} color={AVATAR_COLORS.director} />
        ))}
      </div>
    </div>
  );
}

function DirectorCard({ label, member, color }) {
  const name = getMemberName(member);
  const rut = member?.rut;
  const initial = name ? name[0].toUpperCase() : '?';

  return (
    <div style={{
      background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
      padding: 20, display: 'flex', alignItems: 'center', gap: 16
    }}>
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
  );
}
