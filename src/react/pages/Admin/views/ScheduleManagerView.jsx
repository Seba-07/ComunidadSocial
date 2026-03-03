import { useState, useEffect, useMemo } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import Calendar from '../../../components/ui/Calendar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

const HOURS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

export default function ScheduleManagerView() {
  const addToast = useUiStore(s => s.addToast);
  const [monthData, setMonthData] = useState({ days: {}, totalMinistros: 0 });
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayDetail, setDayDetail] = useState(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  async function loadMonth(y, m) {
    setIsLoading(true);
    try {
      const data = await apiService.getMinistroAvailabilityForMonth(y, m);
      setMonthData({ days: data.days || {}, totalMinistros: data.totalMinistros || 0 });
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadMonth(year, month); }, [year, month]);

  async function loadDayDetail(date) {
    setDayLoading(true);
    try {
      const data = await apiService.getMinistroAvailabilityForDate(date);
      setDayDetail(data);
    } catch {
      setDayDetail(null);
    } finally {
      setDayLoading(false);
    }
  }

  const calendarEvents = useMemo(() => {
    const events = {};
    Object.entries(monthData.days).forEach(([date, info]) => {
      const hourly = info.hourly || {};
      const total = HOURS.length;
      const availableHours = HOURS.filter(h => (hourly[h] || 0) > 0).length;
      const fullHours = HOURS.filter(h => (hourly[h] || 0) >= monthData.totalMinistros).length;

      let color = '#6b7280';
      if (monthData.totalMinistros > 0) {
        if (availableHours === 0) color = '#ef4444';
        else if (availableHours < total || fullHours < total) color = '#f59e0b';
        else color = '#10b981';
      }
      events[date] = [{ color, title: `${availableHours}/${total} horas disponibles` }];
    });
    return events;
  }, [monthData]);

  function handleDayClick(date) {
    setSelectedDate(date);
    loadDayDetail(date);
  }

  function renderDayContent(date) {
    const info = monthData.days[date];
    if (!info?.hourly) return null;
    const available = HOURS.filter(h => (info.hourly[h] || 0) > 0).length;
    const total = HOURS.length;
    const allBlocked = available === 0;
    return (
      <div style={{ fontSize: 9, marginTop: 2 }}>
        <span style={{
          display: 'inline-block', padding: '1px 4px', borderRadius: 4,
          background: allBlocked ? '#fee2e2' : available < total ? '#fef3c7' : '#d1fae5',
          color: allBlocked ? '#991b1b' : available < total ? '#92400e' : '#065f46',
          fontWeight: 600
        }}>
          {available}/{total}
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Gestión de Horarios</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            {monthData.totalMinistros} Ministro{monthData.totalMinistros !== 1 ? 's' : ''} de Fe activo{monthData.totalMinistros !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { color: '#10b981', label: 'Todo disponible' },
            { color: '#f59e0b', label: 'Parcial' },
            { color: '#ef4444', label: 'Sin disponibilidad' }
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {isLoading ? <LoadingSpinner text="Cargando horarios..." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedDate ? '1fr 360px' : '1fr', gap: 20 }}>
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
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#111827' }}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6b7280' }}>
                {monthData.totalMinistros} MF total &middot; Haz clic en una hora para ver detalle
              </p>

              {dayLoading ? (
                <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: 20 }}>Cargando...</p>
              ) : dayDetail ? (
                <div style={{ display: 'grid', gap: 6 }}>
                  {HOURS.map(hour => {
                    const info = dayDetail.availability?.[hour] || { available: 0, blocked: 0 };
                    const total = dayDetail.totalMinistros || 0;
                    const pct = total > 0 ? (info.available / total) * 100 : 0;
                    const isUnavailable = info.available === 0;
                    const isPartial = info.available > 0 && info.available < total;

                    return (
                      <div key={hour} style={{
                        padding: '10px 12px', borderRadius: 10,
                        border: `1px solid ${isUnavailable ? '#fecaca' : isPartial ? '#fde68a' : '#bbf7d0'}`,
                        background: isUnavailable ? '#fef2f2' : isPartial ? '#fffbeb' : '#f0fdf4'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{hour}</span>
                          <span style={{
                            fontSize: 12, fontWeight: 600,
                            color: isUnavailable ? '#dc2626' : isPartial ? '#d97706' : '#16a34a'
                          }}>
                            {info.available} MF disponible{info.available !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', marginTop: 6 }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            width: `${pct}%`,
                            background: isUnavailable ? '#ef4444' : isPartial ? '#f59e0b' : '#10b981',
                            transition: 'width 0.2s'
                          }} />
                        </div>
                        {info.blocked > 0 && (
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                            {info.blocked} bloqueado{info.blocked !== 1 ? 's' : ''} / asignado{info.blocked !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: 20 }}>
                  Sin datos para este día
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
