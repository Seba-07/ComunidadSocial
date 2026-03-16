import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../stores/uiStore';
import { formatDate } from '../../utils/formatters';

const COMM_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'asamblea', label: 'Citación a Asamblea' },
  { value: 'actividad', label: 'Invitación a Actividad' },
  { value: 'informe', label: 'Informe de Gestión' },
  { value: 'urgente', label: 'Aviso Urgente' }
];

const TEMPLATES = [
  { icon: '📋', label: 'Citación a Asamblea', type: 'asamblea', subject: 'Citación a Asamblea', body: 'Estimados socios,\n\nSe les convoca a la asamblea que se realizará en [LUGAR] el día [FECHA] a las [HORA].\n\nTabla:\n1. [PUNTO 1]\n2. [PUNTO 2]\n\nSe ruega puntualidad.\n\nDirectorio' },
  { icon: '🎉', label: 'Invitación a Actividad', type: 'actividad', subject: 'Invitación a Actividad', body: 'Estimados socios,\n\nLos invitamos cordialmente a participar de [ACTIVIDAD] que se realizará el día [FECHA].\n\n¡Los esperamos!\n\nDirectorio' },
  { icon: '📊', label: 'Informe de Gestión', type: 'informe', subject: 'Informe de Gestión', body: 'Estimados socios,\n\nLes compartimos el informe de gestión del período [PERÍODO].\n\n[CONTENIDO DEL INFORME]\n\nDirectorio' },
  { icon: '🚨', label: 'Aviso Urgente', type: 'urgente', subject: 'Aviso Urgente', body: 'Estimados socios,\n\nSe les informa que [CONTENIDO URGENTE].\n\nPor favor tomar las medidas necesarias.\n\nDirectorio' }
];

export default function OrgComunicaciones({ org, onRefresh }) {
  const [showCreate, setShowCreate] = useState(false);
  const [templateData, setTemplateData] = useState(null);
  const addToast = useUiStore((s) => s.addToast);

  const communications = org?.communications || [];
  const members = org?.members || [];
  const membersWithEmail = members.filter((m) => m.email).length;

  function openTemplate(template) {
    setTemplateData(template);
    setShowCreate(true);
  }

  async function handleDelete(commId) {
    if (!confirm('¿Eliminar esta comunicación?')) return;
    try {
      await apiService.updateOrganization(org._id, { removeCommunication: commId });
      addToast('Comunicación eliminada', 'success');
      onRefresh();
    } catch (error) {
      addToast(error.message || 'Error al eliminar', 'error');
    }
  }

  return (
    <div>
      <div className="r-toolbar" style={{ marginBottom: 16 }}>
        <h3 className="r-page-title" style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', margin: 0 }}>Comunicaciones</h3>
        <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 14, whiteSpace: 'nowrap' }} onClick={() => { setTemplateData(null); setShowCreate(true); }}>
          + Nueva Comunicación
        </button>
      </div>

      {/* Stats */}
      <div className="r-grid-3" style={{ marginBottom: 24 }}>
        <StatCard label="Miembros registrados" value={members.length} color="#3b82f6" />
        <StatCard label="Con email" value={membersWithEmail} color="#10b981" />
        <StatCard label="Comunicaciones enviadas" value={communications.length} color="#8b5cf6" />
      </div>

      {/* Quick Templates */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Plantillas Rápidas</h4>
        <div className="r-grid-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.type}
              onClick={() => openTemplate(t)}
              style={{
                padding: 16, border: '1px solid #e5e7eb', borderRadius: 12,
                background: 'white', cursor: 'pointer', textAlign: 'left',
                transition: 'box-shadow 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{t.icon}</div>
              <div style={{ fontWeight: 600, color: '#1e3a8a', fontSize: 14 }}>{t.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Communications List */}
      <h4 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Historial</h4>
      {communications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
          <p style={{ fontSize: 16 }}>No hay comunicaciones registradas</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>Usa las plantillas rápidas o crea una nueva comunicación</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {communications.map((comm, i) => {
            const commId = comm.id || comm._id || i;
            return (
              <div key={commId} className="r-card" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                <div className="r-toolbar" style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: '#1e3a8a', wordBreak: 'break-word' }}>{comm.subject || 'Sin asunto'}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(comm.date)}</span>
                    <button onClick={() => handleDelete(commId)} style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #fca5a5', borderRadius: 4, background: 'white', color: '#ef4444', cursor: 'pointer' }}>
                      Eliminar
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {comm.type && (
                    <span style={{ padding: '1px 8px', borderRadius: 8, background: '#f3f4f6', fontSize: 11 }}>
                      {COMM_TYPES.find((t) => t.value === comm.type)?.label || comm.type}
                    </span>
                  )}
                  {comm.recipients && <span>{Array.isArray(comm.recipients) ? comm.recipients.length : comm.recipients} destinatarios</span>}
                  {comm.emailsSentCount > 0 && (
                    <span style={{ color: '#059669' }}>{comm.emailsSentCount} email{comm.emailsSentCount !== 1 ? 's' : ''} enviado{comm.emailsSentCount !== 1 ? 's' : ''}</span>
                  )}
                </div>
                {comm.message && (
                  <p style={{ fontSize: 13, color: '#374151', marginTop: 8, whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                    {comm.message.length > 200 ? comm.message.slice(0, 200) + '...' : comm.message}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateCommunicationModal
        open={showCreate}
        onClose={() => { setShowCreate(false); setTemplateData(null); }}
        orgId={org._id}
        template={templateData}
        membersWithEmail={membersWithEmail}
        onCreated={() => { setShowCreate(false); setTemplateData(null); onRefresh(); }}
        addToast={addToast}
      />
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
      <span style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function CreateCommunicationModal({ open, onClose, orgId, template, membersWithEmail, onCreated, addToast }) {
  const [subject, setSubject] = useState(template?.subject || '');
  const [type, setType] = useState(template?.type || 'general');
  const [message, setMessage] = useState(template?.body || '');
  const [submitting, setSubmitting] = useState(false);

  // Update fields when template changes
  useEffect(() => {
    if (template) {
      setSubject(template.subject || '');
      setType(template.type || 'general');
      setMessage(template.body || '');
    }
  }, [template]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!subject.trim()) { addToast('Ingresa un asunto', 'error'); return; }
    if (!message.trim()) { addToast('Ingresa un mensaje', 'error'); return; }

    setSubmitting(true);
    try {
      const result = await apiService.updateOrganization(orgId, {
        addCommunication: { subject, type, message, date: new Date().toISOString(), recipients: membersWithEmail }
      });
      // Find the newly added communication to get emailsSentCount
      const comms = result?.communications || [];
      const lastComm = comms[comms.length - 1];
      const sentCount = lastComm?.emailsSentCount || 0;
      const toastMsg = sentCount > 0
        ? `Comunicación guardada y notificada por correo a ${sentCount} socio${sentCount !== 1 ? 's' : ''}`
        : 'Comunicación guardada (sin emails enviados)';
      addToast(toastMsg, 'success');
      setSubject(''); setType('general'); setMessage('');
      onCreated();
    } catch (error) {
      addToast(error.message || 'Error', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva Comunicación">
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField label="Asunto *" id="comm-subject" type="text" placeholder="Asunto de la comunicación" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <FormField label="Tipo" id="comm-type">
          <select id="comm-type" value={type} onChange={(e) => setType(e.target.value)}
            style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 16 }}>
            {COMM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </FormField>
        <FormField label="Mensaje *" id="comm-msg">
          <textarea id="comm-msg" value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe el mensaje..." rows={6}
            style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 16, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
        </FormField>
        <div className="r-info-card" style={{ background: '#eff6ff', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
          Se enviará a {membersWithEmail} miembro(s) con email registrado.
        </div>
        <div className="r-form-row">
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, background: '#f3f4f6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Cancelar</button>
          <button type="submit" className="btn-auth" style={{ flex: 1 }} disabled={submitting}>{submitting ? 'Enviando...' : 'Enviar Comunicación'}</button>
        </div>
      </form>
    </Modal>
  );
}
