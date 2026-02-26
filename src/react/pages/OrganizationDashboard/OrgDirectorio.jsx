const AVATAR_COLORS = {
  presidente: '#1e40af',
  vicepresidente: '#7c3aed',
  secretario: '#059669',
  tesorero: '#d97706',
  director: '#6b7280'
};

const POSITION_LABELS = {
  president: 'Presidente',
  vicePresident: 'Vicepresidente',
  secretary: 'Secretario',
  treasurer: 'Tesorero'
};

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
  const positions = [
    { key: 'president', label: 'Presidente', color: AVATAR_COLORS.presidente },
    { key: 'vicePresident', label: 'Vicepresidente', color: AVATAR_COLORS.vicepresidente },
    { key: 'secretary', label: 'Secretario', color: AVATAR_COLORS.secretario },
    { key: 'treasurer', label: 'Tesorero', color: AVATAR_COLORS.tesorero }
  ];

  // Additional directors
  const additionalMembers = dir.additionalMembers || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', margin: 0 }}>Directorio</h3>
        <span style={{
          padding: '4px 14px',
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 600,
          background: dirType === 'Electo' ? '#d1fae5' : '#fef3c7',
          color: dirType === 'Electo' ? '#065f46' : '#92400e'
        }}>
          {dirType}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {positions.map(({ key, label, color }) => (
          <DirectorCard key={key} label={label} member={dir[key]} color={color} />
        ))}
        {additionalMembers.map((m, i) => (
          <DirectorCard key={`dir-${i}`} label={m.cargo || `Director ${i + 1}`} member={m} color={AVATAR_COLORS.director} />
        ))}
      </div>
    </div>
  );
}

function DirectorCard({ label, member, color }) {
  const name = member
    ? `${member.firstName || member.name || ''} ${member.lastName || ''}`.trim()
    : null;
  const rut = member?.rut;
  const initial = name ? name[0].toUpperCase() : '?';

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: name ? color : '#d1d5db',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        fontWeight: 700,
        flexShrink: 0
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
