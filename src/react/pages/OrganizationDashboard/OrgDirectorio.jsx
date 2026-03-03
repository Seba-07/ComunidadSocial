import { formatDate } from '../../utils/formatters';

const CARGO_COLORS = {
  presidente: '#1e40af', president: '#1e40af',
  vicepresidente: '#7c3aed', vicePresident: '#7c3aed',
  secretario: '#059669', secretary: '#059669',
  tesorero: '#d97706', treasurer: '#d97706'
};
const DEFAULT_COLOR = '#6b7280';

const CARGO_LABELS = {
  president: 'Presidente/a', presidente: 'Presidente/a',
  vicePresident: 'Vicepresidente/a', vicepresidente: 'Vicepresidente/a',
  secretary: 'Secretario/a', secretario: 'Secretario/a',
  treasurer: 'Tesorero/a', tesorero: 'Tesorero/a'
};

function getMemberName(member) {
  if (!member) return null;
  return `${member.firstName || member.name || ''} ${member.lastName || ''}`.trim() || null;
}

/**
 * Builds a unified list of directorio members from the org's provisionalDirectorio.
 * Handles both old format (president/secretary/treasurer fixed fields) and
 * new format (additionalMembers with cargo field).
 */
function buildDirectorioList(dir) {
  if (!dir) return [];

  const list = [];

  // Fixed fields (old format, always check)
  const fixedCargos = [
    { key: 'president', cargoId: 'presidente', orden: 1 },
    { key: 'vicePresident', cargoId: 'vicepresidente', orden: 2 },
    { key: 'secretary', cargoId: 'secretario', orden: 3 },
    { key: 'treasurer', cargoId: 'tesorero', orden: 4 }
  ];

  fixedCargos.forEach(({ key, cargoId, orden }) => {
    if (dir[key]) {
      list.push({
        ...dir[key],
        cargoId,
        cargoNombre: CARGO_LABELS[cargoId] || cargoId,
        color: CARGO_COLORS[cargoId] || DEFAULT_COLOR,
        orden
      });
    }
  });

  // Additional members (directors, custom cargos)
  (dir.additionalMembers || []).forEach((m, i) => {
    if (m) {
      const cargoId = m.cargo || m.cargoId || `director_${i + 1}`;
      list.push({
        ...m,
        cargoId,
        cargoNombre: m.cargoNombre || CARGO_LABELS[cargoId] || m.cargo || `Director/a ${i + 1}`,
        color: CARGO_COLORS[cargoId] || DEFAULT_COLOR,
        orden: m.orden || 5 + i
      });
    }
  });

  return list.sort((a, b) => (a.orden || 99) - (b.orden || 99));
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
  const members = buildDirectorioList(dir);

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
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0 }}>Directorio</h3>
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
          ? 'El directorio provisorio será reemplazado por uno definitivo tras la primera elección.'
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

      {/* Director cards - dynamic from data */}
      {members.length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 24 }}>No hay miembros asignados al directorio</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {members.map((m, i) => (
            <DirectorCard key={m.cargoId || i} member={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function DirectorCard({ member }) {
  const name = getMemberName(member);
  const initial = name ? name[0].toUpperCase() : '?';
  const color = member.color || DEFAULT_COLOR;

  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: name ? color : '#d1d5db', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700, flexShrink: 0
        }}>
          {initial}
        </div>
        <div>
          <div style={{ fontSize: 12, color: color, fontWeight: 600, marginBottom: 2 }}>
            {member.cargoNombre}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: name ? '#111827' : '#9ca3af' }}>
            {name || 'Sin asignar'}
          </div>
          {member.rut && <div style={{ fontSize: 12, color: '#6b7280' }}>{member.rut}</div>}
        </div>
      </div>
    </div>
  );
}
