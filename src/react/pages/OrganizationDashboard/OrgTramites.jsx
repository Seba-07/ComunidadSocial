import { useState, useEffect } from 'react';
import { apiService } from '@services/ApiService';
import { useUiStore } from '../../stores/uiStore';
import Modal from '../../components/ui/Modal';

const CATEGORIES = [
  { value: 'SUBVENCION', label: 'Subvención' },
  { value: 'CIERRE_CALLE', label: 'Cierre de Calle' },
  { value: 'CERTIFICADO', label: 'Certificado' },
  { value: 'OTRO', label: 'Otro' },
];

const STATUS_CONFIG = {
  PENDIENTE: { label: 'Pendiente', color: '#6b7280', bg: '#f3f4f6' },
  EN_REVISION: { label: 'En Revisión', color: '#d97706', bg: '#fef3c7' },
  RESUELTO: { label: 'Resuelto', color: '#059669', bg: '#d1fae5' },
  RECHAZADO: { label: 'Rechazado', color: '#dc2626', bg: '#fee2e2' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDIENTE;
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: 12,
      fontSize: 13,
      fontWeight: 600,
      color: cfg.color,
      background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

export default function OrgTramites({ org }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'OTRO' });
  const addToast = useUiStore(s => s.addToast);

  async function loadTickets() {
    try {
      setLoading(true);
      const res = await apiService.getOrgTickets(org._id);
      setTickets(res.data || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTickets(); }, [org._id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      addToast('Completa todos los campos', 'warning');
      return;
    }
    try {
      setSubmitting(true);
      await apiService.createTicket({ ...form, organizationId: org._id });
      addToast('Solicitud creada exitosamente', 'success');
      setShowModal(false);
      setForm({ title: '', description: '', category: 'OTRO' });
      loadTickets();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const catLabel = (cat) => CATEGORIES.find(c => c.value === cat)?.label || cat;

  return (
    <div>
      <div className="responsive-flex-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#111827' }}>Mis Solicitudes</h2>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>Solicitudes y trámites enviados a la municipalidad</p>
        </div>
        <button
          className="btn-auth"
          style={{ maxWidth: 200 }}
          onClick={() => setShowModal(true)}
        >
          + Nueva Solicitud
        </button>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>Cargando solicitudes...</p>
      ) : tickets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 16 }}>No hay solicitudes aún</p>
          <p style={{ fontSize: 14 }}>Crea tu primera solicitud para gestionar trámites con la municipalidad</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tickets.map(ticket => (
            <div
              key={ticket._id}
              onClick={() => setSelectedTicket(ticket)}
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                padding: 16,
                cursor: 'pointer',
                transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <div className="responsive-flex-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h4 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{ticket.title}</h4>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                    {catLabel(ticket.category)} — {new Date(ticket.createdAt).toLocaleDateString('es-CL')}
                  </p>
                </div>
                <StatusBadge status={ticket.status} />
              </div>
              {ticket.resolutionNote && (ticket.status === 'RESUELTO' || ticket.status === 'RECHAZADO') && (
                <div style={{ marginTop: 10, padding: 10, background: '#f9fafb', borderRadius: 6, fontSize: 13, color: '#374151' }}>
                  <strong>Nota de resolución:</strong> {ticket.resolutionNote}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal nueva solicitud */}
      {showModal && (
        <Modal title="Nueva Solicitud" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Categoría</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Título</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ej: Solicitud cierre de calle para aniversario"
                maxLength={200}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Descripción</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describa el detalle de su solicitud..."
                rows={5}
                maxLength={5000}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
                Cancelar
              </button>
              <button type="submit" className="btn-auth" disabled={submitting} style={{ maxWidth: 180, padding: '10px 20px' }}>
                {submitting ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal detalle ticket */}
      {selectedTicket && (
        <Modal title="Detalle de Solicitud" onClose={() => setSelectedTicket(null)}>
          <div>
            <div style={{ marginBottom: 16 }}>
              <StatusBadge status={selectedTicket.status} />
              <span style={{ marginLeft: 12, fontSize: 13, color: '#6b7280' }}>{catLabel(selectedTicket.category)}</span>
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{selectedTicket.title}</h3>
            <p style={{ color: '#374151', fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selectedTicket.description}</p>
            <div style={{ marginTop: 16, fontSize: 13, color: '#6b7280' }}>
              <p>Creada: {new Date(selectedTicket.createdAt).toLocaleString('es-CL')}</p>
              {selectedTicket.createdBy && <p>Por: {selectedTicket.createdBy.firstName} {selectedTicket.createdBy.lastName}</p>}
            </div>
            {selectedTicket.resolutionNote && (
              <div style={{ marginTop: 16, padding: 14, background: selectedTicket.status === 'RESUELTO' ? '#d1fae5' : '#fee2e2', borderRadius: 8, fontSize: 14 }}>
                <strong>Nota de resolución:</strong>
                <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{selectedTicket.resolutionNote}</p>
                {selectedTicket.resolvedBy && (
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7280' }}>
                    Resuelta por: {selectedTicket.resolvedBy.firstName} {selectedTicket.resolvedBy.lastName}
                    {selectedTicket.resolvedAt && ` — ${new Date(selectedTicket.resolvedAt).toLocaleString('es-CL')}`}
                  </p>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
