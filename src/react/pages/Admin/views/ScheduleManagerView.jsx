import { useState, useEffect, useMemo } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import Calendar from '../../../components/ui/Calendar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import Modal from '../../../components/ui/Modal';

export default function ScheduleManagerView() {
  const addToast = useUiStore(s => s.addToast);
  const [availability, setAvailability] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayDetail, setDayDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  async function loadMonth(y, m) {
    setIsLoading(true);
    try {
      const data = await apiService.getMinistroAvailabilityForMonth(y, m);
      const avail = data.availability || data || {};
      setAvailability(avail);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadMonth(year, month); }, [year, month]);

  const calendarEvents = useMemo(() => {
    const events = {};
    Object.entries(availability).forEach(([date, info]) => {
      const slots = info.slots || [];
      const bookedCount = slots.filter(s => s.booked).length;
      const availableCount = slots.filter(s => !s.booked).length;
      let color = '#6b7280'; // gray - no slots
      if (slots.length > 0) {
        if (bookedCount === slots.length) color = '#ef4444'; // red - fully booked
        else if (bookedCount > 0) color = '#f59e0b'; // yellow - partially
        else color = '#10b981'; // green - all available
      }
      events[date] = [{ color, title: `${availableCount} disponibles, ${bookedCount} reservados` }];
    });
    return events;
  }, [availability]);

  function handleDayClick(date) {
    setSelectedDate(date);
    const info = availability[date];
    setDayDetail(info || null);
  }

  function renderDayContent(date, events) {
    const info = availability[date];
    if (!info || !info.slots?.length) return null;
    const booked = info.slots.filter(s => s.booked).length;
    const total = info.slots.length;
    return (
      <div style={{ fontSize: 10, marginTop: 2 }}>
        <span style={{
          display: 'inline-block', padding: '1px 4px', borderRadius: 4, fontSize: 9,
          background: booked === total ? '#fee2e2' : booked > 0 ? '#fef3c7' : '#d1fae5',
          color: booked === total ? '#991b1b' : booked > 0 ? '#92400e' : '#065f46'
        }}>
          {total - booked}/{total}
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700, color: '#111827' }}>
        Gestión de Horarios
      </h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { color: '#10b981', label: 'Disponible' },
          { color: '#f59e0b', label: 'Parcial' },
          { color: '#ef4444', label: 'Completo' },
          { color: '#6b7280', label: 'Sin horarios' }
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
            {item.label}
          </div>
        ))}
      </div>

      {isLoading ? <LoadingSpinner text="Cargando horarios..." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedDate ? '1fr 320px' : '1fr', gap: 24 }}>
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <Calendar
              events={calendarEvents}
              onDayClick={handleDayClick}
              selectedDate={selectedDate}
              renderDayContent={renderDayContent}
            />
          </div>

          {selectedDate && (
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#111827' }}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>

              {dayDetail?.slots?.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {dayDetail.slots.map((slot, i) => (
                    <div key={i} style={{
                      padding: 12, borderRadius: 8,
                      border: `1px solid ${slot.booked ? '#fecaca' : '#d1fae5'}`,
                      background: slot.booked ? '#fef2f2' : '#f0fdf4'
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {slot.startTime || slot.time} {slot.endTime ? `- ${slot.endTime}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        {slot.booked ? `Reservado: ${slot.organizationName || 'Org'}` : 'Disponible'}
                      </div>
                      {slot.ministroName && (
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Ministro: {slot.ministroName}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center' }}>
                  Sin horarios configurados para este día
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
