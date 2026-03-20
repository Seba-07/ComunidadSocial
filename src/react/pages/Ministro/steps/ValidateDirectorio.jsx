const SKIP_KEYS = new Set([
  'type', '_id', '__v', 'additionalMembers', 'designatedAt',
  'members', 'createdAt', 'updatedAt'
]);

const CARGO_LABELS = {
  president: 'Presidente/a', presidente: 'Presidente/a',
  vicePresident: 'Vicepresidente/a', vicepresidente: 'Vicepresidente/a',
  secretary: 'Secretario/a', secretario: 'Secretario/a',
  treasurer: 'Tesorero/a', tesorero: 'Tesorero/a',
};

function formatName(p) {
  if (!p || typeof p !== 'object') return String(p || '');
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || '';
}

function calculateAge(bd) {
  if (!bd) return null;
  const birth = new Date(bd);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function ValidateDirectorio({ wizardData, updateWizardData, org, onNext, onPrev }) {
  const directorio = wizardData.directorio || {};

  // Build flat list of directors from the nested object structure
  const members = (() => {
    const list = [];
    // Standard cargo keys
    for (const [key, value] of Object.entries(directorio)) {
      if (SKIP_KEYS.has(key)) continue;
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      if (!value.rut && !value.firstName) continue;
      list.push({
        key,
        cargo: CARGO_LABELS[key] || value.cargoNombre || value.cargo || key,
        ...value,
        name: formatName(value),
        validated: value.validated || false,
      });
    }
    // Additional members
    if (Array.isArray(directorio.additionalMembers)) {
      directorio.additionalMembers.forEach((m, i) => {
        if (!m || typeof m !== 'object' || (!m.rut && !m.firstName)) return;
        list.push({
          key: `additional_${i}`,
          cargo: m.cargoNombre || m.cargo || `Director/a ${i + 1}`,
          ...m,
          name: formatName(m),
          validated: m.validated || false,
        });
      });
    }
    return list;
  })();

  function toggleValidated(idx) {
    const member = members[idx];
    if (!member) return;

    // Update the validated flag in the original directorio structure
    const updatedDir = { ...directorio };
    if (member.key.startsWith('additional_')) {
      const addIdx = parseInt(member.key.split('_')[1]);
      const updatedAdd = [...(updatedDir.additionalMembers || [])];
      updatedAdd[addIdx] = { ...updatedAdd[addIdx], validated: !member.validated };
      updatedDir.additionalMembers = updatedAdd;
    } else {
      updatedDir[member.key] = { ...updatedDir[member.key], validated: !member.validated };
    }
    updateWizardData({ directorio: updatedDir });
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 'clamp(18px, 4vw, 20px)', fontWeight: 700, color: '#111827' }}>
        Verificar Directorio Provisorio
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
        Verifique la cedula de identidad de cada miembro del directorio.
      </p>

      <div style={{ display: 'grid', gap: 10 }}>
        {members.map((m, i) => (
          <div
            key={m.key}
            onClick={() => toggleValidated(i)}
            style={{
              padding: 'clamp(12px, 3vw, 16px)', borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${m.validated ? '#10b981' : '#e5e7eb'}`,
              background: m.validated ? '#f0fdf4' : 'white',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: 8, minHeight: 52,
              touchAction: 'manipulation', transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            {(() => {
              const orgMembers = org?.members || [];
              const bd = m.birthDate || (m.rut && orgMembers.find(mb => mb.rut === m.rut)?.birthDate);
              const age = calculateAge(bd);
              const isMinor = age !== null && age < 18;
              return (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 'clamp(13px, 3vw, 14px)', color: '#2563eb', display: 'block', marginBottom: 2 }}>
                    {m.cargo}
                  </span>
                  <span style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#111827' }}>
                    {m.name} — {m.rut || '—'}
                  </span>
                  {age !== null && (
                    <span style={{
                      fontSize: 12, marginLeft: 8,
                      color: isMinor ? '#d97706' : '#6b7280',
                      fontWeight: isMinor ? 600 : 400,
                    }}>
                      ({age} anos)
                    </span>
                  )}
                  {isMinor && (
                    <span style={{
                      fontSize: 10, marginLeft: 6, padding: '2px 6px', borderRadius: 4,
                      background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}>
                      Menor de edad
                    </span>
                  )}
                </div>
              );
            })()}
            <div style={{
              width: 'clamp(32px, 7vw, 40px)', height: 'clamp(32px, 7vw, 40px)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'clamp(16px, 4vw, 20px)', flexShrink: 0,
              background: m.validated ? '#10b981' : '#f3f4f6',
              color: m.validated ? 'white' : '#d1d5db',
              transition: 'background 0.15s',
            }}>
              {m.validated ? '\u2713' : ''}
            </div>
          </div>
        ))}
      </div>

      {members.length === 0 && (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>Sin directorio provisorio</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, flexWrap: 'wrap', gap: 8 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={onNext} style={nextBtn}>Siguiente</button>
      </div>
    </div>
  );
}

const prevBtn = { padding: 'clamp(10px, 2.5vw, 12px) clamp(20px, 5vw, 28px)', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 'clamp(14px, 3vw, 15px)', cursor: 'pointer', color: '#374151' };
const nextBtn = { padding: 'clamp(10px, 2.5vw, 12px) clamp(20px, 5vw, 28px)', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 'clamp(14px, 3vw, 15px)', fontWeight: 600, cursor: 'pointer' };
