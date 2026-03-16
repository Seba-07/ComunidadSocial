import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { apiService } from '../../../services/ApiService';
import { localeDateString } from '../../utils/formatters';

const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const MORNING_HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00'];
const AFTERNOON_HOURS = ['14:00', '15:00', '16:00', '17:00', '18:00'];
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

function formatDateStr(d) {
  return d.toISOString().split('T')[0];
}

function getWeekDates(offset = 0) {
  const today = new Date();
  const day = today.getDay() || 7; // Mon=1..Sun=7
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + 1 + offset * 7);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function MiHorario() {
  const user = useAuthStore(s => s.user);
  const addToast = useUiStore(s => s.addToast);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(null); // { date, time } or { date } for full day
  const [blockReason, setBlockReason] = useState('');

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  async function loadBlocks() {
    if (!user?._id) return;
    try {
      const data = await apiService.getMinistroBlocks(user._id);
      setBlocks(data.blocks || data || []);
    } catch {
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadBlocks(); }, [user?._id]);

  function isBlocked(dateStr, time) {
    return blocks.some(b => {
      if (!b.active) return false;
      if (b.date !== dateStr) return false;
      if (b.blockType === 'full_day') return true;
      if (b.time === time) return true;
      if (b.blockType === 'duration' && b.time && b.endTime) {
        return time >= b.time && time < b.endTime;
      }
      return false;
    });
  }

  function isPending(dateStr, time) {
    return blocks.some(b => {
      if (!b.active || b.status !== 'pending') return false;
      if (b.date !== dateStr) return false;
      if (b.blockType === 'full_day') return true;
      if (b.time === time) return true;
      return false;
    });
  }

  function isDayFullyBlocked(dateStr) {
    return blocks.some(b => b.active && b.date === dateStr && b.blockType === 'full_day');
  }

  function getBlockForSlot(dateStr, time) {
    return blocks.find(b => b.active && b.date === dateStr && (b.blockType === 'full_day' || b.time === time));
  }

  async function handleCreateBlock() {
    if (!showBlockModal) return;
    setSaving(true);
    try {
      // If blocking morning/afternoon, create multiple blocks
      const hoursToBlock = showBlockModal.period === 'morning' ? MORNING_HOURS
        : showBlockModal.period === 'afternoon' ? AFTERNOON_HOURS
        : null;

      if (hoursToBlock) {
        for (const hour of hoursToBlock) {
          if (!isBlocked(showBlockModal.date, hour)) {
            await apiService.createMinistroBlock({
              ministroId: user._id,
              ministroName: `${user.firstName} ${user.lastName}`,
              date: showBlockModal.date,
              time: hour,
              blockType: 'manual',
              reason: blockReason || (showBlockModal.period === 'morning' ? 'Bloqueo mañana' : 'Bloqueo tarde'),
              createdBy: user._id
            });
          }
        }
        addToast(showBlockModal.period === 'morning' ? 'Mañana bloqueada' : 'Tarde bloqueada', 'success');
      } else {
        const blockData = {
          ministroId: user._id,
          ministroName: `${user.firstName} ${user.lastName}`,
          date: showBlockModal.date,
          reason: blockReason || 'Bloqueo manual',
          createdBy: user._id
        };

        if (showBlockModal.time) {
          blockData.time = showBlockModal.time;
          blockData.blockType = 'manual';
        } else {
          blockData.blockType = 'full_day';
        }

        await apiService.createMinistroBlock(blockData);
        addToast(showBlockModal.time ? `${showBlockModal.time} bloqueado` : 'Día bloqueado', 'success');
      }

      setShowBlockModal(null);
      setBlockReason('');
      loadBlocks();
    } catch (err) {
      addToast(err.message || 'Error al bloquear', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBlock(blockId) {
    try {
      await apiService.deleteMinistroBlock(blockId);
      addToast('Bloqueo eliminado', 'success');
      loadBlocks();
    } catch (err) {
      addToast(err.message || 'Error', 'error');
    }
  }

  function handleSlotClick(dateStr, time) {
    const block = getBlockForSlot(dateStr, time);
    if (block) {
      handleDeleteBlock(block._id);
    } else {
      setShowBlockModal({ date: dateStr, time });
      setBlockReason('');
    }
  }

  if (loading) return <div style={{ padding: 24, color: '#6b7280' }}>Cargando horario...</div>;

  const today = formatDateStr(new Date());

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Mi Horario</h2>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
        Gestiona tu disponibilidad. Haz clic en un horario para bloquearlo o desbloquearlo.
      </p>

      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setWeekOffset(w => w - 1)}
          style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
          &larr; Anterior
        </button>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
            {weekDates[0].toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} — {weekDates[4].toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} style={{ marginLeft: 8, fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Hoy
            </button>
          )}
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)}
          style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
          Siguiente &rarr;
        </button>
      </div>

      {/* Schedule grid */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', minWidth: 500 }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '70px repeat(5, 1fr)', borderBottom: '2px solid #e5e7eb' }}>
          <div style={{ padding: '12px 8px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'center' }}>Hora</div>
          {weekDates.map((date, i) => {
            const dateStr = formatDateStr(date);
            const isToday = dateStr === today;
            const fullyBlocked = isDayFullyBlocked(dateStr);
            return (
              <div key={i} style={{
                padding: '10px 8px', textAlign: 'center',
                background: isToday ? '#eff6ff' : fullyBlocked ? '#fef2f2' : 'transparent',
                borderLeft: '1px solid #f3f4f6'
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: isToday ? '#2563eb' : '#374151' }}>{DAYS[i]}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: isToday ? '#2563eb' : '#111827' }}>{date.getDate()}</div>
                {!fullyBlocked && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
                    <button onClick={() => { setShowBlockModal({ date: dateStr }); setBlockReason(''); }}
                      style={{ fontSize: 10, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      Bloquear día
                    </button>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button onClick={() => { setShowBlockModal({ date: dateStr, period: 'morning' }); setBlockReason(''); }}
                        style={{ fontSize: 9, color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer' }}>
                        AM
                      </button>
                      <button onClick={() => { setShowBlockModal({ date: dateStr, period: 'afternoon' }); setBlockReason(''); }}
                        style={{ fontSize: 9, color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer' }}>
                        PM
                      </button>
                    </div>
                  </div>
                )}
                {fullyBlocked && (
                  <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>Día bloqueado</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Time slots */}
        {HOURS.map(hour => (
          <div key={hour} style={{ display: 'grid', gridTemplateColumns: '70px repeat(5, 1fr)', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ padding: '10px 8px', fontSize: 13, fontWeight: 500, color: '#6b7280', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {hour}
            </div>
            {weekDates.map((date, i) => {
              const dateStr = formatDateStr(date);
              const blocked = isBlocked(dateStr, hour);
              const pending = blocked && isPending(dateStr, hour);
              const isPast = dateStr < today || (dateStr === today && parseInt(hour) <= new Date().getHours());
              return (
                <div
                  key={i}
                  onClick={() => !isPast && handleSlotClick(dateStr, hour)}
                  style={{
                    padding: '10px 8px', textAlign: 'center',
                    borderLeft: '1px solid #f3f4f6',
                    background: pending ? '#fffbeb' : blocked ? '#fef2f2' : isPast ? '#f9fafb' : '#f0fdf4',
                    cursor: isPast ? 'default' : 'pointer',
                    transition: 'background 0.1s',
                    fontSize: 12,
                    color: pending ? '#92400e' : blocked ? '#dc2626' : isPast ? '#d1d5db' : '#16a34a',
                    fontWeight: blocked ? 600 : 400
                  }}
                  onMouseEnter={e => { if (!isPast) e.currentTarget.style.background = pending ? '#fef3c7' : blocked ? '#fee2e2' : '#dcfce7'; }}
                  onMouseLeave={e => { if (!isPast) e.currentTarget.style.background = pending ? '#fffbeb' : blocked ? '#fef2f2' : '#f0fdf4'; }}
                >
                  {pending ? 'Pendiente' : blocked ? 'Bloqueado' : isPast ? '—' : 'Disponible'}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      </div>

      {/* Block summary */}
      <div style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Bloqueos activos</h3>
        {blocks.filter(b => b.active && b.date >= today).length === 0 ? (
          <p style={{ fontSize: 13, color: '#9ca3af' }}>No tienes bloqueos futuros</p>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {blocks.filter(b => b.active && b.date >= today).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')).map(b => (
              <div key={b._id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: '#fff', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13
              }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#111827' }}>
                    {localeDateString(b.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  {b.blockType === 'full_day' ? (
                    <span style={{ color: '#dc2626', marginLeft: 8 }}>Día completo</span>
                  ) : (
                    <span style={{ color: '#dc2626', marginLeft: 8 }}>{b.time}</span>
                  )}
                  {b.status === 'pending' && (
                    <span style={{ marginLeft: 8, padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>
                      Pendiente
                    </span>
                  )}
                  {b.reason && <span style={{ color: '#6b7280', marginLeft: 8 }}>— {b.reason}</span>}
                </div>
                <button onClick={() => handleDeleteBlock(b._id)}
                  style={{ padding: '4px 10px', fontSize: 11, color: '#dc2626', background: '#fff', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}>
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Block modal */}
      {showBlockModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              {showBlockModal.time ? `Bloquear ${showBlockModal.time}`
                : showBlockModal.period === 'morning' ? 'Bloquear mañana (09:00–13:00)'
                : showBlockModal.period === 'afternoon' ? 'Bloquear tarde (14:00–18:00)'
                : 'Bloquear día completo'}
            </h3>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              {localeDateString(showBlockModal.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Motivo (opcional)</label>
              <input value={blockReason} onChange={e => setBlockReason(e.target.value)}
                placeholder="Ej: Reunión personal, vacaciones..."
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowBlockModal(null)} disabled={saving}
                style={{ padding: '8px 18px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleCreateBlock} disabled={saving}
                style={{ padding: '8px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Bloqueando...' : 'Confirmar Bloqueo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
