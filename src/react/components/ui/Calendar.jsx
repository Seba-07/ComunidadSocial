import { useState, useMemo } from 'react';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function Calendar({ events = {}, onDayClick, selectedDate, renderDayContent }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = (first.getDay() + 6) % 7; // Monday = 0
    const result = [];

    // Previous month padding
    for (let i = 0; i < startDay; i++) {
      result.push({ day: null, date: null });
    }
    // Current month
    for (let d = 1; d <= last.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      result.push({ day: d, date: dateStr });
    }
    return result;
  }, [year, month]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  function goToday() {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  }

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16
      }}>
        <button onClick={prevMonth} style={navBtn}>&lsaquo;</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#111827' }}>
            {MONTHS[month]} {year}
          </h3>
          <button onClick={goToday} style={{
            padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db',
            background: 'white', fontSize: 12, cursor: 'pointer', color: '#374151'
          }}>
            Hoy
          </button>
        </div>
        <button onClick={nextMonth} style={navBtn}>&rsaquo;</button>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1,
        background: '#e5e7eb', borderRadius: 12, overflow: 'hidden'
      }}>
        {DAYS.map(d => (
          <div key={d} style={{
            padding: '8px 4px', textAlign: 'center', fontSize: 12,
            fontWeight: 600, color: '#6b7280', background: '#f9fafb'
          }}>
            {d}
          </div>
        ))}
        {days.map((cell, i) => {
          if (!cell.date) {
            return <div key={`empty-${i}`} style={{ background: '#f9fafb', padding: 8 }} />;
          }
          const isToday = cell.date === todayStr;
          const isSelected = cell.date === selectedDate;
          const dayEvents = events[cell.date] || [];
          const isPast = cell.date < todayStr;

          return (
            <div
              key={cell.date}
              onClick={() => onDayClick?.(cell.date)}
              style={{
                background: isSelected ? '#eff6ff' : 'white',
                padding: 8,
                minHeight: 72,
                cursor: 'pointer',
                opacity: isPast ? 0.6 : 1,
                borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent',
                transition: 'background 0.1s'
              }}
            >
              <div style={{
                fontSize: 13, fontWeight: isToday ? 700 : 400,
                color: isToday ? '#2563eb' : '#374151',
                marginBottom: 4
              }}>
                {isToday ? (
                  <span style={{
                    background: '#2563eb', color: 'white', borderRadius: '50%',
                    width: 24, height: 24, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 12
                  }}>
                    {cell.day}
                  </span>
                ) : cell.day}
              </div>
              {renderDayContent ? renderDayContent(cell.date, dayEvents) : (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {dayEvents.slice(0, 3).map((ev, j) => (
                    <span key={j} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: ev.color || '#2563eb'
                    }} />
                  ))}
                  {dayEvents.length > 3 && (
                    <span style={{ fontSize: 9, color: '#6b7280' }}>+{dayEvents.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const navBtn = {
  width: 36, height: 36, borderRadius: '50%', border: '1px solid #d1d5db',
  background: 'white', fontSize: 20, cursor: 'pointer', color: '#374151',
  display: 'flex', alignItems: 'center', justifyContent: 'center'
};
