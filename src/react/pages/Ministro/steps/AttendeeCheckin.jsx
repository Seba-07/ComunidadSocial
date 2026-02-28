import { useState } from 'react';
import SearchBar from '../../../components/ui/SearchBar';

export default function AttendeeCheckin({ wizardData, updateWizardData, onNext, onPrev }) {
  const [search, setSearch] = useState('');
  const attendees = wizardData.attendees || [];
  const presentCount = attendees.filter(a => a.present).length;

  const filtered = search
    ? attendees.filter(a =>
        (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
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

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Control de Asistencia
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
        {presentCount}/{attendees.length} presentes
      </p>

      <div style={{
        height: 6, background: '#e5e7eb', borderRadius: 3, marginBottom: 16, overflow: 'hidden'
      }}>
        <div style={{
          height: '100%', borderRadius: 3, transition: 'width 0.3s',
          width: attendees.length > 0 ? `${(presentCount / attendees.length) * 100}%` : '0%',
          background: '#2563eb'
        }} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ flex: 1, maxWidth: 300 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar miembro..." />
        </div>
        <button onClick={markAllPresent} style={{
          padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: 8,
          background: 'white', fontSize: 13, cursor: 'pointer'
        }}>Marcar Todos</button>
      </div>

      <div style={{ maxHeight: 400, overflow: 'auto', display: 'grid', gap: 6 }}>
        {filtered.map((a, i) => (
          <div
            key={a.rut || i}
            onClick={() => togglePresent(i)}
            style={{
              padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${a.present ? '#bbf7d0' : '#e5e7eb'}`,
              background: a.present ? '#f0fdf4' : 'white',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}
          >
            <div>
              <span style={{ fontSize: 14, fontWeight: a.present ? 600 : 400 }}>
                {a.name || `${a.firstName || ''} ${a.lastName || ''}`}
              </span>
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{a.rut}</span>
            </div>
            <span style={{
              width: 24, height: 24, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 14,
              background: a.present ? '#10b981' : '#e5e7eb',
              color: a.present ? 'white' : '#9ca3af'
            }}>
              {a.present ? '\u2713' : ''}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={onNext} style={nextBtn}>Siguiente</button>
      </div>
    </div>
  );
}

const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
const nextBtn = { padding: '12px 28px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
