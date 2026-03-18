import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../stores/uiStore';
import { formatDate } from '../../utils/formatters';

const COMM_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'asamblea', label: 'Citaci\u00f3n a Asamblea' },
  { value: 'actividad', label: 'Invitaci\u00f3n a Actividad' },
  { value: 'informe', label: 'Informe de Gesti\u00f3n' },
  { value: 'urgente', label: 'Aviso Urgente' }
];

const TEMPLATES = [
  { icon: '\uD83D\uDCCB', label: 'Citaci\u00f3n a Asamblea', type: 'asamblea', subject: 'Citaci\u00f3n a Asamblea', body: 'Estimados socios,\n\nSe les convoca a la asamblea que se realizar\u00e1 en [LUGAR] el d\u00eda [FECHA] a las [HORA].\n\nTabla:\n1. [PUNTO 1]\n2. [PUNTO 2]\n\nSe ruega puntualidad.\n\nDirectorio' },
  { icon: '\uD83C\uDF89', label: 'Invitaci\u00f3n a Actividad', type: 'actividad', subject: 'Invitaci\u00f3n a Actividad', body: 'Estimados socios,\n\nLos invitamos cordialmente a participar de [ACTIVIDAD] que se realizar\u00e1 el d\u00eda [FECHA].\n\n\u00a1Los esperamos!\n\nDirectorio' },
  { icon: '\uD83D\uDCCA', label: 'Informe de Gesti\u00f3n', type: 'informe', subject: 'Informe de Gesti\u00f3n', body: 'Estimados socios,\n\nLes compartimos el informe de gesti\u00f3n del per\u00edodo [PER\u00cdODO].\n\n[CONTENIDO DEL INFORME]\n\nDirectorio' },
  { icon: '\uD83D\uDEA8', label: 'Aviso Urgente', type: 'urgente', subject: 'Aviso Urgente', body: 'Estimados socios,\n\nSe les informa que [CONTENIDO URGENTE].\n\nPor favor tomar las medidas necesarias.\n\nDirectorio' }
];

function formatBulletinDate(d) {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function OrgComunicaciones({ org, onRefresh }) {
  const [showCreate, setShowCreate] = useState(false);
  const [templateData, setTemplateData] = useState(null);
  const [bulletins, setBulletins] = useState([]);
  const [loadingBulletins, setLoadingBulletins] = useState(true);
  const [expandedBulletin, setExpandedBulletin] = useState(null);
  const [activeTab, setActiveTab] = useState('bulletins');
  const addToast = useUiStore((s) => s.addToast);

  const communications = org?.communications || [];
  const members = org?.members || [];
  const membersWithEmail = members.filter((m) => m.email).length;

  useEffect(() => {
    if (org?._id) loadBulletins();
  }, [org?._id]);

  async function loadBulletins() {
    setLoadingBulletins(true);
    try {
      const res = await apiService.get(`/organizations/${org._id}/bulletins`);
      setBulletins(res.data || []);
    } catch {
      setBulletins([]);
    } finally {
      setLoadingBulletins(false);
    }
  }

  function openTemplate(template) {
    setTemplateData(template);
    setShowCreate(true);
  }

  async function handleDelete(commId) {
    if (!confirm('\u00bfEliminar esta comunicaci\u00f3n?')) return;
    try {
      await apiService.updateOrganization(org._id, { removeCommunication: commId });
      addToast('Comunicaci\u00f3n eliminada', 'success');
      onRefresh();
    } catch (error) {
      addToast(error.message || 'Error al eliminar', 'error');
    }
  }

  const tabs = [
    { key: 'bulletins', label: 'Comunicados Municipales', count: bulletins.length },
    { key: 'internal', label: 'Comunicaciones Internas', count: communications.length }
  ];

  return (
    <div>
      <h3 className="r-page-title" style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', margin: '0 0 16px' }}>Comunicaciones</h3>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            flex: 1, padding: '10px 16px', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === t.key ? 'white' : 'transparent',
            color: activeTab === t.key ? '#1e40af' : '#6b7280',
            boxShadow: activeTab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}>
            {t.label} {t.count > 0 && <span style={{ marginLeft: 6, fontSize: 12, padding: '1px 8px', borderRadius: 10, background: activeTab === t.key ? '#dbeafe' : '#e5e7eb' }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {activeTab === 'bulletins' ? (
        <BulletinsInbox bulletins={bulletins} loading={loadingBulletins} expandedId={expandedBulletin} onToggle={id => setExpandedBulletin(expandedBulletin === id ? null : id)} />
      ) : (
        <InternalComms
          communications={communications}
          members={members}
          membersWithEmail={membersWithEmail}
          onOpenCreate={() => { setTemplateData(null); setShowCreate(true); }}
          onOpenTemplate={openTemplate}
          onDelete={handleDelete}
        />
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

// ========== Bulletins Inbox ==========
function BulletinsInbox({ bulletins, loading, expandedId, onToggle }) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
        <p style={{ fontSize: 14 }}>Cargando comunicados...</p>
      </div>
    );
  }

  if (bulletins.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
        <p style={{ fontSize: 40, margin: '0 0 12px' }}>{'\uD83D\uDCEC'}</p>
        <p style={{ fontSize: 16 }}>No hay comunicados municipales</p>
        <p style={{ fontSize: 13, marginTop: 8 }}>Los comunicados oficiales de la municipalidad aparecer\u00e1n aqu\u00ed</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {bulletins.map(b => {
        const isExpanded = expandedId === b._id;
        return (
          <div key={b._id} style={{
            background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
            overflow: 'hidden', transition: 'box-shadow 0.15s',
            borderLeft: '4px solid #1e40af'
          }}>
            <div
              onClick={() => onToggle(b._id)}
              style={{ padding: 20, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 6 }}>
                    {b.title}
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 12, padding: '2px 10px', borderRadius: 10, fontWeight: 600,
                      background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe'
                    }}>
                      Secretar\u00eda Municipal
                    </span>
                    <span>{formatBulletinDate(b.createdAt)}</span>
                  </div>
                </div>
                <span style={{ fontSize: 18, color: '#9ca3af', flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                  {'\u25BC'}
                </span>
              </div>
              {!isExpanded && b.content && (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                  {b.content.length > 180 ? b.content.slice(0, 180) + '...' : b.content}
                </p>
              )}
            </div>
            {isExpanded && (
              <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f3f4f6' }}>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: '#374151', lineHeight: 1.7, paddingTop: 16 }}>
                  {b.content}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ========== Internal Communications ==========
function InternalComms({ communications, members, membersWithEmail, onOpenCreate, onOpenTemplate, onDelete }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 14, whiteSpace: 'nowrap' }} onClick={onOpenCreate}>
          + Nueva Comunicaci\u00f3n
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
        <h4 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Plantillas R\u00e1pidas</h4>
        <div className="r-grid-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.type}
              onClick={() => onOpenTemplate(t)}
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
          <p style={{ fontSize: 13, marginTop: 8 }}>Usa las plantillas r\u00e1pidas o crea una nueva comunicaci\u00f3n</p>
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
                    <button onClick={() => onDelete(commId)} style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #fca5a5', borderRadius: 4, background: 'white', color: '#ef4444', cursor: 'pointer' }}>
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
    </>
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
      const comms = result?.communications || [];
      const lastComm = comms[comms.length - 1];
      const sentCount = lastComm?.emailsSentCount || 0;
      const toastMsg = sentCount > 0
        ? `Comunicaci\u00f3n guardada y notificada por correo a ${sentCount} socio${sentCount !== 1 ? 's' : ''}`
        : 'Comunicaci\u00f3n guardada (sin emails enviados)';
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
    <Modal open={open} onClose={onClose} title="Nueva Comunicaci\u00f3n">
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField label="Asunto *" id="comm-subject" type="text" placeholder="Asunto de la comunicaci\u00f3n" value={subject} onChange={(e) => setSubject(e.target.value)} />
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
          Se enviar\u00e1 a {membersWithEmail} miembro(s) con email registrado.
        </div>
        <div className="r-form-row">
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, background: '#f3f4f6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Cancelar</button>
          <button type="submit" className="btn-auth" style={{ flex: 1 }} disabled={submitting}>{submitting ? 'Enviando...' : 'Enviar Comunicaci\u00f3n'}</button>
        </div>
      </form>
    </Modal>
  );
}
