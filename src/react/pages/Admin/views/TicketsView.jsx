import { useState, useEffect } from 'react';
import { apiService } from '@services/ApiService';
import { useUiStore } from '../../../stores/uiStore';
import Modal from '../../../components/ui/Modal';

const STATUSES = [
  { key: 'PENDIENTE', label: 'Pendiente', color: '#6b7280', bg: '#f3f4f6', headerBg: '#e5e7eb' },
  { key: 'EN_REVISION', label: 'En Revisión', color: '#d97706', bg: '#fef3c7', headerBg: '#fde68a' },
  { key: 'RESUELTO', label: 'Resuelto', color: '#059669', bg: '#d1fae5', headerBg: '#6ee7b7' },
  { key: 'RECHAZADO', label: 'Rechazado', color: '#dc2626', bg: '#fee2e2', headerBg: '#fca5a5' },
];

const CATEGORIES = {
  SUBVENCION: 'Subvención',
  CIERRE_CALLE: 'Cierre de Calle',
  CERTIFICADO: 'Certificado',
  OTRO: 'Otro',
};

function KanbanCard({ ticket, onClick }) {
  const orgName = ticket.organizationId?.organizationName || 'Organización';
  return (
    <div
      onClick={() => onClick(ticket)}
      style={{
        background: '#fff',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        cursor: 'pointer',
        border: '1px solid #e5e7eb',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      <h4 style={{ margin: 0, fontSize: 14, color: '#111827', lineHeight: 1.3 }}>{ticket.title}</h4>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6b7280' }}>{orgName}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 10,
          background: '#f3f4f6',
          color: '#374151',
          fontWeight: 500,
        }}>
          {CATEGORIES[ticket.category] || ticket.category}
        </span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          {new Date(ticket.createdAt).toLocaleDateString('es-CL')}
        </span>
      </div>
    </div>
  );
}

export default function TicketsView() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const addToast = useUiStore(s => s.addToast);

  async function loadTickets() {
    try {
      setLoading(true);
      const res = await apiService.getAllTickets();
      setTickets(res.data || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTickets(); }, []);

  function openDetail(ticket) {
    setSelected(ticket);
    setNewStatus(ticket.status);
    setResolutionNote(ticket.resolutionNote || '');
  }

  async function handleUpdateStatus() {
    if (!selected) return;
    try {
      setUpdating(true);
      const res = await apiService.updateTicketStatus(selected._id, newStatus, resolutionNote);
      addToast('Estado actualizado', 'success');
      setTickets(prev => prev.map(t => t._id === selected._id ? res.data : t));
      setSelected(null);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setUpdating(false);
    }
  }

  const grouped = {};
  STATUSES.forEach(s => grouped[s.key] = []);
  tickets.forEach(t => {
    if (grouped[t.status]) grouped[t.status].push(t);
  });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, color: '#111827' }}>Mesa de Ayuda</h2>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
          Gestión de solicitudes y trámites de organizaciones — {tickets.length} solicitud{tickets.length !== 1 ? 'es' : ''}
        </p>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>Cargando solicitudes...</p>
      ) : tickets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 16 }}>No hay solicitudes registradas</p>
        </div>
      ) : (
        <div className="responsive-grid-4" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          overflowX: 'auto',
        }}>
          {STATUSES.map(status => (
            <div key={status.key} style={{ minWidth: 220 }}>
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px 8px 0 0',
                background: status.headerBg,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: status.color }}>{status.label}</span>
                <span style={{
                  background: '#fff',
                  borderRadius: 10,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: status.color,
                }}>
                  {grouped[status.key].length}
                </span>
              </div>
              <div style={{
                background: status.bg,
                borderRadius: '0 0 8px 8px',
                padding: 8,
                minHeight: 120,
              }}>
                {grouped[status.key].map(ticket => (
                  <KanbanCard key={ticket._id} ticket={ticket} onClick={openDetail} />
                ))}
                {grouped[status.key].length === 0 && (
                  <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', padding: 20 }}>Sin solicitudes</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal detalle + gestión */}
      {selected && (
        <Modal title="Gestionar Solicitud" onClose={() => setSelected(null)}>
          <div>
            <div style={{ marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Organización</p>
              <p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: 15 }}>
                {selected.organizationId?.organizationName || 'Sin nombre'}
              </p>
            </div>

            <div style={{ marginBottom: 12 }}>
              <span style={{
                display: 'inline-block',
                fontSize: 12,
                padding: '3px 10px',
                borderRadius: 10,
                background: '#f3f4f6',
                color: '#374151',
                fontWeight: 500,
              }}>
                {CATEGORIES[selected.category] || selected.category}
              </span>
              <span style={{ marginLeft: 10, fontSize: 12, color: '#9ca3af' }}>
                {new Date(selected.createdAt).toLocaleString('es-CL')}
              </span>
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{selected.title}</h3>
            <p style={{ color: '#374151', fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 20 }}>
              {selected.description}
            </p>

            {selected.createdBy && (
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
                Solicitante: {selected.createdBy.firstName} {selected.createdBy.lastName}
              </p>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Estado</label>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
              >
                {STATUSES.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Nota de Resolución</label>
              <textarea
                value={resolutionNote}
                onChange={e => setResolutionNote(e.target.value)}
                placeholder="Escribe una nota al cerrar o cambiar estado..."
                rows={4}
                maxLength={5000}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelected(null)}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 14 }}
              >
                Cerrar
              </button>
              <button
                onClick={handleUpdateStatus}
                className="btn-auth"
                disabled={updating || newStatus === selected.status}
                style={{ maxWidth: 200, padding: '10px 20px' }}
              >
                {updating ? 'Guardando...' : 'Actualizar Estado'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
