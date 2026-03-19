import { useState } from 'react';
import SearchBar from '../../../components/ui/SearchBar';

export default function AttendeeCheckin({ wizardData, updateWizardData, org, onNext, onPrev }) {
  const [search, setSearch] = useState('');
  const attendees = wizardData.attendees || [];
  const presentCount = attendees.filter(a => a.present).length;

  // Dynamic quorum from template config or org type
  const quorumRequired = (() => {
    // Priority 1: templateConfig on the org (set by secretary when creating the type)
    if (org?.templateConfig?.miembrosMinimos) return org.templateConfig.miembrosMinimos;
    // Priority 2: estatutosSnapshot (stored at creation time)
    if (org?.estatutosSnapshot?.miembrosMinimos) return org.estatutosSnapshot.miembrosMinimos;
    // Priority 3: fallback by type
    const type = org?.organizationType || org?.type || '';
    if (type === 'JUNTA_VECINOS') return 50;
    return 15;
  })();

  const quorumMet = presentCount >= quorumRequired;
  const progressPercent = attendees.length > 0 ? Math.min(100, (presentCount / quorumRequired) * 100) : 0;

  const filtered = search
    ? attendees.filter(a =>
        (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.firstName || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.lastName || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.rut || '').includes(search)
      )
    : attendees;

  function togglePresent(idx) {
    const realIdx = attendees.indexOf(filtered[idx]);
    if (realIdx < 0) return;
    const updated = [...attendees];
    updated[realIdx] = { ...updated[realIdx], present: !updated[realIdx].present };
    updateWizardData({ attendees: updated });
  }

  function markAllPresent() {
    updateWizardData({ attendees: attendees.map(a => ({ ...a, present: true })) });
  }

  function handleNext() {
    // Save quorum data for later use
    updateWizardData({
      quorumRequired,
      quorumAchieved: quorumMet,
      attendanceCount: presentCount,
    });
    onNext();
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 'clamp(18px, 4vw, 20px)', fontWeight: 700, color: '#111827' }}>
        Control de Asistencia
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: '#6b7280' }}>
        Verifique la cedula de identidad de cada socio presente
      </p>

      {/* Quorum indicator */}
      <div style={{
        padding: 'clamp(12px, 3vw, 16px)', borderRadius: 10, marginBottom: 16,
        background: quorumMet ? '#f0fdf4' : '#fef2f2',
        border: `2px solid ${quorumMet ? '#10b981' : '#ef4444'}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
          <span style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 800, color: quorumMet ? '#059669' : '#dc2626' }}>
            {presentCount}/{quorumRequired}
          </span>
          <span style={{
            padding: '4px 12px', borderRadius: 8, fontSize: 'clamp(11px, 2.5vw, 13px)', fontWeight: 700,
            background: quorumMet ? '#10b981' : '#ef4444', color: 'white',
          }}>
            {quorumMet ? 'QUORUM ALCANZADO' : `Faltan ${quorumRequired - presentCount}`}
          </span>
        </div>
        <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4, transition: 'width 0.3s, background 0.3s',
            width: `${progressPercent}%`,
            background: quorumMet ? '#10b981' : progressPercent > 60 ? '#f59e0b' : '#ef4444',
          }} />
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, textAlign: 'center' }}>
          Quorum minimo legal: {quorumRequired} personas | Total socios: {attendees.length}
        </div>
      </div>

      {/* Search + actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre o RUT..." />
        </div>
        <button onClick={markAllPresent} style={{
          padding: 'clamp(10px, 2.5vw, 12px) clamp(14px, 3vw, 18px)',
          border: '1px solid #d1d5db', borderRadius: 8, background: 'white',
          fontSize: 'clamp(12px, 2.5vw, 14px)', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          Marcar Todos
        </button>
      </div>

      {/* Attendee list — touch-friendly */}
      <div style={{ maxHeight: 'calc(100vh - 420px)', overflow: 'auto', display: 'grid', gap: 6 }}>
        {filtered.map((a, i) => (
          <div
            key={a.rut || i}
            onClick={() => togglePresent(i)}
            style={{
              padding: 'clamp(12px, 3vw, 16px)', borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${a.present ? '#10b981' : '#e5e7eb'}`,
              background: a.present ? '#f0fdf4' : 'white',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: 8, minHeight: 52, touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'clamp(14px, 3vw, 15px)', fontWeight: a.present ? 700 : 400, color: '#111827' }}>
                {a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim()}
              </div>
              <div style={{ fontSize: 'clamp(11px, 2.5vw, 12px)', color: '#6b7280' }}>{a.rut || ''}</div>
            </div>
            <div style={{
              width: 'clamp(32px, 7vw, 40px)', height: 'clamp(32px, 7vw, 40px)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'clamp(16px, 4vw, 20px)', flexShrink: 0,
              background: a.present ? '#10b981' : '#f3f4f6',
              color: a.present ? 'white' : '#d1d5db',
              transition: 'background 0.15s',
            }}>
              {a.present ? '\u2713' : ''}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, flexWrap: 'wrap', gap: 8 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={handleNext} style={nextBtn}>Siguiente</button>
      </div>
    </div>
  );
}

const prevBtn = { padding: 'clamp(10px, 2.5vw, 12px) clamp(20px, 5vw, 28px)', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 'clamp(14px, 3vw, 15px)', cursor: 'pointer', color: '#374151' };
const nextBtn = { padding: 'clamp(10px, 2.5vw, 12px) clamp(20px, 5vw, 28px)', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 'clamp(14px, 3vw, 15px)', fontWeight: 600, cursor: 'pointer' };
