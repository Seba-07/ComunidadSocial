import { useState, useEffect, useMemo } from 'react';
import { apiService } from '@services/ApiService.js';
import { useAdminStore } from '../../../stores/adminStore';
import { useAssignmentsStore } from '../../../stores/assignmentsStore';
import { useUiStore } from '../../../stores/uiStore';
import { localeDateString } from '../../../utils/formatters';
import Calendar from '../../../components/ui/Calendar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

const EVENT_TYPES = {
  ASSIGNMENT: { color: '#2563eb', label: 'Asignación' },
  ASSEMBLY: { color: '#22c55e', label: 'Asamblea' }
};

export default function CalendarManagerView() {
  const addToast = useUiStore(s => s.addToast);
  const { organizations, fetchAllOrganizations } = useAdminStore();
  const { assignments, fetchAssignments } = useAssignmentsStore();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchAllOrganizations().catch(() => []),
      fetchAssignments().catch(() => [])
    ]).finally(() => setIsLoading(false));
  }, []);

  const events = useMemo(() => {
    const map = {};
    function addEvent(date, event) {
      if (!date) return;
      const key = date.split('T')[0];
      if (!map[key]) map[key] = [];
      map[key].push(event);
    }

    // Assignments
    assignments.forEach(a => {
      addEvent(a.date || a.scheduledDate, {
        type: 'ASSIGNMENT',
        color: EVENT_TYPES.ASSIGNMENT.color,
        title: a.organizationName || 'Asignación',
        subtitle: `${a.ministroName || 'Ministro'} - ${a.time || a.scheduledTime || ''}`,
        detail: a.status,
        source: a.source || 'manual',
        assemblyId: a.assemblyId || null,
        raw: a
      });
    });

    // Organization assemblies
    organizations.forEach(org => {
      (org.assemblies || []).forEach(asm => {
        addEvent(asm.date, {
          type: 'ASSEMBLY',
          color: EVENT_TYPES.ASSEMBLY.color,
          title: `${org.name}: ${asm.title || 'Asamblea'}`,
          subtitle: asm.location || '',
          detail: asm.status,
          raw: asm
        });
      });
    });

    return map;
  }, [assignments, organizations]);

  const dayEvents = selectedDate ? (events[selectedDate] || []) : [];

  if (isLoading) return <LoadingSpinner text="Cargando calendario..." />;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700, color: '#111827' }}>
        Calendario
      </h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(EVENT_TYPES).map(([key, { color, label }]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
            {label}
          </div>
        ))}
      </div>

      <div className="r-grid-2" style={{ display: 'grid', gridTemplateColumns: selectedDate ? '1fr 340px' : '1fr', gap: 24 }}>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <Calendar
            events={events}
            onDayClick={setSelectedDate}
            selectedDate={selectedDate}
          />
        </div>

        {selectedDate && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
              {localeDateString(selectedDate, {
                weekday: 'long', day: 'numeric', month: 'long'
              })}
              <span style={{
                marginLeft: 8, background: '#e5e7eb', padding: '2px 8px',
                borderRadius: 10, fontSize: 12, fontWeight: 500
              }}>
                {dayEvents.length} evento{dayEvents.length !== 1 ? 's' : ''}
              </span>
            </h3>

            {dayEvents.length === 0 ? (
              <p style={{ color: '#6b7280', textAlign: 'center', fontSize: 14 }}>Sin eventos</p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {dayEvents.map((ev, i) => (
                  <div key={i} style={{
                    padding: 12, borderRadius: 8,
                    borderLeft: `4px solid ${ev.color}`,
                    background: '#f9fafb'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#111827', flex: 1 }}>{ev.title}</span>
                      {ev.source && (
                        <span style={{
                          padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                          background: ev.source === 'auto' ? '#dbeafe' : '#f3f4f6',
                          color: ev.source === 'auto' ? '#1e40af' : '#6b7280'
                        }}>
                          {ev.source === 'auto' ? 'Auto' : 'Manual'}
                        </span>
                      )}
                    </div>
                    {ev.subtitle && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{ev.subtitle}</div>}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                      {ev.detail && (
                        <span style={{
                          display: 'inline-block', padding: '2px 8px',
                          borderRadius: 10, fontSize: 11, background: ev.color + '20', color: ev.color
                        }}>
                          {ev.detail}
                        </span>
                      )}
                      {ev.assemblyId && (
                        <span style={{ fontSize: 11, color: '#6b7280' }}>
                          Vinculada a asamblea
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
