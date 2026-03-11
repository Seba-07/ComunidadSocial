import { useState, useEffect } from 'react';
import { apiService } from '../../../../services/ApiService';
import { useUiStore } from '../../../stores/uiStore';

const SEVERITY_COLORS = {
  low: '#10b981', medium: '#f59e0b', high: '#f97316', critical: '#dc2626'
};
const SEVERITY_LABELS = {
  low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica'
};
const TYPE_LABELS = {
  unauthorized_access: 'Acceso no autorizado',
  data_leak: 'Filtración de datos',
  system_compromise: 'Compromiso de sistema',
  phishing: 'Phishing',
  malware: 'Malware',
  denial_of_service: 'Denegación de servicio',
  other: 'Otro'
};
const STATUS_LABELS = {
  reported: 'Reportado', investigating: 'Investigando',
  contained: 'Contenido', resolved: 'Resuelto', closed: 'Cerrado'
};

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SecurityIncidentsView() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const addToast = useUiStore(s => s.addToast);

  const [form, setForm] = useState({
    type: 'other', severity: 'medium', title: '', description: '',
    dataAffected: '', usersAffectedCount: 0, measuresTaken: ''
  });

  useEffect(() => { loadIncidents(); }, []);

  async function loadIncidents() {
    try {
      const data = await apiService.getSecurityIncidents();
      setIncidents(data);
    } catch (err) {
      addToast('Error al cargar incidentes', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.description) {
      addToast('Título y descripción son obligatorios', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await apiService.reportSecurityIncident({
        ...form,
        dataAffected: form.dataAffected ? form.dataAffected.split(',').map(s => s.trim()) : [],
        usersAffectedCount: parseInt(form.usersAffectedCount) || 0
      });
      addToast('Incidente reportado', 'success');
      setShowForm(false);
      setForm({ type: 'other', severity: 'medium', title: '', description: '', dataAffected: '', usersAffectedCount: 0, measuresTaken: '' });
      loadIncidents();
    } catch (err) {
      addToast(err.message || 'Error al reportar', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id, status) {
    try {
      const updates = { status };
      if (status === 'resolved') updates.resolvedAt = new Date().toISOString();
      await apiService.updateSecurityIncident(id, updates);
      addToast('Estado actualizado', 'success');
      loadIncidents();
    } catch (err) {
      addToast('Error al actualizar', 'error');
    }
  }

  async function markNotified(id, field) {
    try {
      await apiService.updateSecurityIncident(id, {
        [field]: true,
        [`${field}At`]: new Date().toISOString()
      });
      addToast('Marcado como notificado', 'success');
      loadIncidents();
    } catch (err) {
      addToast('Error al actualizar', 'error');
    }
  }

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Cargando...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div className="r-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
          Incidentes de Seguridad
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '10px 20px', background: '#dc2626', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600
          }}
        >
          {showForm ? 'Cancelar' : 'Reportar Incidente'}
        </button>
      </div>

      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
        Ley 21.719: Las brechas de seguridad deben notificarse a la Agencia de Protección de Datos dentro de 72 horas.
      </p>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, border: '1px solid #fecaca', padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#dc2626' }}>Nuevo Incidente</h3>
          <div className="r-grid-2" style={{ gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Tipo *</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Severidad *</label>
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                {Object.entries(SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Título *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Breve descripción del incidente"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Descripción *</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={4} placeholder="Detalle completo del incidente, cómo fue detectado, alcance..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div className="r-grid-2" style={{ gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Datos afectados (separados por coma)</label>
              <input value={form.dataAffected} onChange={e => setForm(f => ({ ...f, dataAffected: e.target.value }))}
                placeholder="RUT, email, contraseñas..."
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Usuarios afectados (cantidad)</label>
              <input type="number" value={form.usersAffectedCount} onChange={e => setForm(f => ({ ...f, usersAffectedCount: e.target.value }))}
                min={0}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Medidas tomadas</label>
            <textarea value={form.measuresTaken} onChange={e => setForm(f => ({ ...f, measuresTaken: e.target.value }))}
              rows={2} placeholder="Acciones de mitigación realizadas..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <button type="submit" disabled={submitting}
            style={{ padding: '10px 24px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Reportando...' : 'Reportar Incidente'}
          </button>
        </form>
      )}

      {incidents.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 40, textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: 15 }}>No hay incidentes de seguridad registrados.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {incidents.map(inc => (
            <div key={inc._id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>{inc.title}</h3>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: SEVERITY_COLORS[inc.severity] + '20', color: SEVERITY_COLORS[inc.severity], fontWeight: 600 }}>
                      {SEVERITY_LABELS[inc.severity]}
                    </span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f3f4f6', color: '#374151' }}>
                      {TYPE_LABELS[inc.type]}
                    </span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#dbeafe', color: '#1d4ed8' }}>
                      {STATUS_LABELS[inc.status]}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>{formatDate(inc.createdAt)}</span>
              </div>
              <p style={{ fontSize: 13, color: '#4b5563', margin: '8px 0', lineHeight: 1.5 }}>{inc.description}</p>
              {inc.dataAffected?.length > 0 && (
                <p style={{ fontSize: 12, color: '#6b7280' }}>Datos afectados: {inc.dataAffected.join(', ')}</p>
              )}
              {inc.usersAffectedCount > 0 && (
                <p style={{ fontSize: 12, color: '#6b7280' }}>Usuarios afectados: {inc.usersAffectedCount}</p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {inc.status === 'reported' && (
                  <button onClick={() => updateStatus(inc._id, 'investigating')}
                    style={{ padding: '6px 14px', fontSize: 12, background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    Investigar
                  </button>
                )}
                {inc.status === 'investigating' && (
                  <button onClick={() => updateStatus(inc._id, 'contained')}
                    style={{ padding: '6px 14px', fontSize: 12, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    Marcar Contenido
                  </button>
                )}
                {['reported', 'investigating', 'contained'].includes(inc.status) && (
                  <button onClick={() => updateStatus(inc._id, 'resolved')}
                    style={{ padding: '6px 14px', fontSize: 12, background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    Resolver
                  </button>
                )}
                {!inc.notifiedAgency && (
                  <button onClick={() => markNotified(inc._id, 'notifiedAgency')}
                    style={{ padding: '6px 14px', fontSize: 12, background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}>
                    Marcar: Agencia Notificada
                  </button>
                )}
                {!inc.notifiedUsers && inc.usersAffectedCount > 0 && (
                  <button onClick={() => markNotified(inc._id, 'notifiedUsers')}
                    style={{ padding: '6px 14px', fontSize: 12, background: '#fff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 6, cursor: 'pointer' }}>
                    Marcar: Usuarios Notificados
                  </button>
                )}
              </div>
              {(inc.notifiedAgency || inc.notifiedUsers) && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                  {inc.notifiedAgency && <span>Agencia notificada: {formatDate(inc.notifiedAgencyAt)} | </span>}
                  {inc.notifiedUsers && <span>Usuarios notificados: {formatDate(inc.notifiedUsersAt)}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
