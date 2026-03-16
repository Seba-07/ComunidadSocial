import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizardStore } from '../../../stores/wizardStore';
import { useUiStore } from '../../../stores/uiStore';
import { apiService } from '@services/ApiService.js';
import Calendar from '../../../components/ui/Calendar';

const AVAILABLE_HOURS = [
  '09:00', '10:00', '11:00', '12:00',
  '14:00', '15:00', '16:00', '17:00', '18:00'
];

export default function Step7_Schedule({ onPrev }) {
  const navigate = useNavigate();
  const { formData, setFormDataField, submitOrganization, isSubmitting } = useWizardStore();
  const addToast = useUiStore(s => s.addToast);

  const schedule = formData.assemblySchedule || { date: null, time: null };
  const [monthData, setMonthData] = useState({}); // { "2026-03-05": { hasAvailability, isPartial } }
  const [hourlyData, setHourlyData] = useState(null); // { "09:00": { available, blocked } }
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Load current month on mount
  useEffect(() => {
    const now = new Date();
    loadMonth(now.getFullYear(), now.getMonth() + 1);
  }, []);

  async function loadMonth(year, month) {
    setLoadingMonth(true);
    try {
      const data = await apiService.getMinistroAvailabilityForMonth(year, month);
      setMonthData(data.days || {});
    } catch (err) {
      console.error('Error loading month availability:', err);
      setMonthData({});
    } finally {
      setLoadingMonth(false);
    }
  }

  async function loadDay(date) {
    setLoadingDay(true);
    try {
      const data = await apiService.getMinistroAvailabilityForDate(date);
      setHourlyData(data.availability || {});
    } catch (err) {
      console.error('Error loading day availability:', err);
      setHourlyData({});
    } finally {
      setLoadingDay(false);
    }
  }

  function handleDayClick(date) {
    const today = new Date().toISOString().split('T')[0];
    if (date <= today) return; // Can't select past or today

    const dayInfo = monthData[date];
    if (!dayInfo?.hasAvailability) {
      addToast('No hay disponibilidad para esta fecha', 'error');
      return;
    }

    setFormDataField('assemblySchedule', { date, time: null });
    setHourlyData(null);
    loadDay(date);
  }

  function handleTimeSelect(time) {
    setFormDataField('assemblySchedule', { ...schedule, time });
  }

  function handleMonthChange(year, month) {
    setHourlyData(null);
    loadMonth(year, month);
  }

  async function handleSubmit() {
    if (!schedule.date || !schedule.time) {
      addToast('Selecciona una fecha y hora para la asamblea', 'error');
      return;
    }
    try {
      await submitOrganization();
      addToast('Organización creada exitosamente', 'success');
      setSubmitted(true);
    } catch (err) {
      let msg = err.message || 'Error al crear organización';
      if (err.code === 'PAYLOAD_TOO_LARGE' || msg.includes('tamaño') || msg.includes('límite')) {
        msg = 'Los archivos adjuntos son demasiado grandes. Vuelve al paso 5 y reduce el tamaño de los certificados (máx. 5MB cada uno).';
      } else if (err.details?.length) {
        msg += ': ' + err.details.map(d => d.message || d).join(', ');
      }
      addToast(msg, 'error');
    }
  }

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#127881;</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
          Organización Creada
        </h2>
        <p style={{ fontSize: 15, color: '#6b7280', marginBottom: 8 }}>
          Tu organización ha sido enviada para revisión. Te notificaremos cuando sea procesada.
        </p>
        {schedule.date && schedule.time && (
          <p style={{ fontSize: 14, color: '#2563eb', fontWeight: 600, marginBottom: 24 }}>
            Asamblea agendada: {schedule.date} a las {schedule.time}
            {schedule.address && <><br />Lugar: {schedule.address}</>}
          </p>
        )}
        <button onClick={() => navigate('/org/auto')} style={{
          padding: '12px 28px', border: 'none', borderRadius: 10,
          background: '#2563eb', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer'
        }}>
          Ir a Mis Organizaciones
        </button>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Agendar Asamblea Constitutiva
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        Selecciona una fecha y hora disponible para la asamblea constitutiva de tu organización.
      </p>

      {/* Calendar */}
      <div style={{
        background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
        padding: 20, marginBottom: 20
      }}>
        {loadingMonth && (
          <div style={{ textAlign: 'center', padding: 8, fontSize: 13, color: '#6b7280' }}>
            Cargando disponibilidad...
          </div>
        )}
        <Calendar
          selectedDate={schedule.date}
          onDayClick={handleDayClick}
          onMonthChange={handleMonthChange}
          renderDayContent={(date) => {
            const info = monthData[date];
            const isPast = date <= todayStr;
            if (isPast || !info) return null;
            if (!info.hasAvailability) return (
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#d1d5db', margin: '2px auto 0'
              }} />
            );
            return (
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: info.isPartial ? '#f59e0b' : '#10b981',
                margin: '2px auto 0'
              }} />
            );
          }}
        />

        {/* Legend */}
        <div style={{
          display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12,
          fontSize: 12, color: '#6b7280', flexWrap: 'wrap'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
            Disponible
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
            Parcial
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d1d5db' }} />
            No disponible
          </span>
        </div>
      </div>

      {/* Time slots */}
      {schedule.date && (
        <div style={{
          background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
          padding: 20, marginBottom: 20
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: '#111827' }}>
            Horarios disponibles - {schedule.date}
          </h3>

          {loadingDay ? (
            <p style={{ fontSize: 13, color: '#6b7280' }}>Cargando horarios...</p>
          ) : hourlyData ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {AVAILABLE_HOURS.map(hour => {
                const info = hourlyData[hour];
                const isAvailable = info && info.available > 0;
                const isSelected = schedule.time === hour;

                return (
                  <button
                    key={hour}
                    onClick={() => isAvailable && handleTimeSelect(hour)}
                    disabled={!isAvailable}
                    style={{
                      padding: '10px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                      cursor: isAvailable ? 'pointer' : 'not-allowed',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #d1d5db',
                      background: isSelected ? '#2563eb' : isAvailable ? 'white' : '#f3f4f6',
                      color: isSelected ? 'white' : isAvailable ? '#374151' : '#9ca3af',
                      transition: 'all 0.15s'
                    }}
                  >
                    {hour}
                  </button>
                );
              })}
            </div>
          ) : null}

          {hourlyData && !Object.values(hourlyData).some(h => h.available > 0) && (
            <p style={{ fontSize: 13, color: '#ef4444', marginTop: 8 }}>
              No hay horarios disponibles para esta fecha. Selecciona otra fecha.
            </p>
          )}
        </div>
      )}

      {/* Assembly location */}
      {schedule.date && schedule.time && (
        <div style={{
          background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
          padding: 20, marginBottom: 20
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: '#111827' }}>
            Lugar de la Asamblea
          </h3>
          <input
            type="text"
            placeholder="Ej: Sede Junta de Vecinos, Av. Uno Norte 1234, Renca"
            value={schedule.address || ''}
            onChange={e => setFormDataField('assemblySchedule', { ...schedule, address: e.target.value })}
            style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
          />
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6, margin: '6px 0 0' }}>
            Dirección donde se realizará la asamblea constitutiva
          </p>
        </div>
      )}

      {/* Selected summary */}
      {schedule.date && schedule.time && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
          padding: 16, marginBottom: 20
        }}>
          <p style={{ margin: 0, fontSize: 14, color: '#166534', fontWeight: 600 }}>
            Asamblea programada: {schedule.date} a las {schedule.time}
            {schedule.address && <><br />Lugar: {schedule.address}</>}
          </p>
        </div>
      )}

      <div className="r-toolbar" style={{ marginTop: 24 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !schedule.date || !schedule.time}
          style={{
            padding: '14px 32px', border: 'none', borderRadius: 10,
            background: (isSubmitting || !schedule.date || !schedule.time)
              ? '#9ca3af'
              : 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white', fontSize: 16, fontWeight: 700,
            cursor: (isSubmitting || !schedule.date || !schedule.time) ? 'not-allowed' : 'pointer'
          }}
        >
          {isSubmitting ? 'Enviando...' : 'Enviar Organización'}
        </button>
      </div>
    </div>
  );
}

const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
