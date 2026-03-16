import { useState, useEffect } from 'react';
import { apiService } from '@services/ApiService';
import { useUiStore } from '../../../stores/uiStore';
import { localeString } from '../../../utils/formatters';

const STATUS_LABELS = {
  open: 'Abierto', in_progress: 'En progreso', resolved: 'Resuelto', closed: 'Cerrado'
};
const STATUS_COLORS = {
  open: '#f59e0b', in_progress: '#3b82f6', resolved: '#10b981', closed: '#6b7280'
};
const ROLE_LABELS = {
  ORGANIZADOR: 'Dirigente Social', MUNICIPALIDAD: 'Secretario Municipal',
  MIEMBRO: 'Miembro', MIEMBRO_DIRECTIVO: 'Miembro Directivo', MINISTRO_FE: 'Ministro de Fe'
};

function formatDate(d) {
  if (!d) return '-';
  return localeString(d, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SupportTicketsView({ onEscalateToIncident }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const addToast = useUiStore(s => s.addToast);

  useEffect(() => { loadTickets(); }, []);

  async function loadTickets() {
    try {
      const data = await apiService.getSupportTickets();
      setTickets(data);
    } catch (err) {
      addToast('Error al cargar tickets', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(ticketId, status) {
    try {
      await apiService.updateSupportTicketStatus(ticketId, status);
      addToast('Estado actualizado', 'success');
      loadTickets();
    } catch (err) {
      addToast('Error al actualizar', 'error');
    }
  }

  function handleEscalate(ticket) {
    if (onEscalateToIncident) {
      onEscalateToIncident({
        title: `[Ticket #${ticket._id.slice(-6)}] ${ticket.description.slice(0, 100)}`,
        description: `Escalado desde ticket de soporte.\n\nUsuario: ${ticket.name} (${ticket.email})\nRol: ${ROLE_LABELS[ticket.role] || ticket.role || 'Anónimo'}\nFecha: ${formatDate(ticket.createdAt)}\n\nDescripción original:\n${ticket.description}`
      });
    }
  }

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Cargando...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div className="r-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
          Tickets de Soporte
        </h2>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
          <option value="all">Todos ({tickets.length})</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v} ({tickets.filter(t => t.status === k).length})</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 40, textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: 15 }}>No hay tickets de soporte.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(ticket => (
            <div key={ticket._id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>{ticket.name || 'Anónimo'}</span>
                    {ticket.role && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#dbeafe', color: '#1d4ed8' }}>
                        {ROLE_LABELS[ticket.role] || ticket.role}
                      </span>
                    )}
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                      background: STATUS_COLORS[ticket.status] + '20',
                      color: STATUS_COLORS[ticket.status]
                    }}>
                      {STATUS_LABELS[ticket.status]}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {ticket.email && <span>{ticket.email}</span>}
                    {ticket.rut && <span>RUT: {ticket.rut}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>{formatDate(ticket.createdAt)}</span>
              </div>

              <p style={{ fontSize: 13, color: '#4b5563', margin: '8px 0', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                {ticket.description}
              </p>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {ticket.status === 'open' && (
                  <button onClick={() => updateStatus(ticket._id, 'in_progress')}
                    style={{ padding: '6px 14px', fontSize: 12, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    En Progreso
                  </button>
                )}
                {['open', 'in_progress'].includes(ticket.status) && (
                  <button onClick={() => updateStatus(ticket._id, 'resolved')}
                    style={{ padding: '6px 14px', fontSize: 12, background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    Resolver
                  </button>
                )}
                {ticket.status === 'resolved' && (
                  <button onClick={() => updateStatus(ticket._id, 'closed')}
                    style={{ padding: '6px 14px', fontSize: 12, background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    Cerrar
                  </button>
                )}
                {ticket.status !== 'closed' && (
                  <button onClick={() => handleEscalate(ticket)}
                    style={{ padding: '6px 14px', fontSize: 12, background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                    Escalar a Incidente
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
