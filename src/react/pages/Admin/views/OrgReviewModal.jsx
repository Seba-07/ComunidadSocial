import { useState, useEffect } from 'react';
import { useAdminStore } from '../../../stores/adminStore';
import { useMinistrosStore } from '../../../stores/ministrosStore';
import { useUiStore } from '../../../stores/uiStore';
import { apiService } from '@services/ApiService.js';
import Modal from '../../../components/ui/Modal';
import Tabs from '../../../components/ui/Tabs';
import StatusBadge from '../../../components/ui/StatusBadge';
import { formatDate } from '../../../utils/formatters';

const REVIEW_TABS = [
  { key: 'datos', label: 'Datos' },
  { key: 'miembros', label: 'Miembros' },
  { key: 'directorio', label: 'Directorio' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'historial', label: 'Historial' }
];

export default function OrgReviewModal({ org: initialOrg, onClose }) {
  const [tab, setTab] = useState('datos');
  const [org, setOrg] = useState(initialOrg);
  const [showReject, setShowReject] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [corrections, setCorrections] = useState({});
  const [scheduleData, setScheduleData] = useState({ ministroId: '', date: '', time: '' });
  const [isActioning, setIsActioning] = useState(false);

  const { updateOrgStatus, rejectOrg, scheduleMinistro, refreshOrganization } = useAdminStore();
  const { ministros, fetchMinistros } = useMinistrosStore();
  const addToast = useUiStore(s => s.addToast);

  useEffect(() => {
    fetchMinistros().catch(() => {});
    // Refresh org to get full data
    refreshOrganization(initialOrg._id).then(o => { if (o) setOrg(o); }).catch(() => {});
  }, [initialOrg._id]);

  const members = org.members || [];
  const directorio = org.provisionalDirectorio || org.directorio || {};
  const statusHistory = org.statusHistory || [];

  async function handleStatusChange(newStatus) {
    setIsActioning(true);
    try {
      await updateOrgStatus(org._id, newStatus);
      addToast(`Estado actualizado a ${newStatus}`, 'success');
      const updated = await refreshOrganization(org._id);
      if (updated) setOrg(updated);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsActioning(false);
    }
  }

  async function handleReject() {
    if (!rejectComment.trim()) {
      addToast('Ingresa un comentario de rechazo', 'error');
      return;
    }
    setIsActioning(true);
    try {
      await rejectOrg(org._id, corrections, rejectComment);
      addToast('Organización rechazada', 'success');
      setShowReject(false);
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsActioning(false);
    }
  }

  async function handleScheduleMinistro() {
    if (!scheduleData.ministroId || !scheduleData.date || !scheduleData.time) {
      addToast('Completa todos los campos', 'error');
      return;
    }
    setIsActioning(true);
    try {
      await scheduleMinistro(org._id, scheduleData);
      addToast('Ministro agendado', 'success');
      setShowSchedule(false);
      const updated = await refreshOrganization(org._id);
      if (updated) setOrg(updated);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsActioning(false);
    }
  }

  const activeMinistros = ministros.filter(m => m.isActive !== false);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'white', borderRadius: 16, width: '90%', maxWidth: 800,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>
              {org.name || 'Organización'}
            </h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
              <StatusBadge status={org.status} />
              <span style={{ fontSize: 13, color: '#6b7280' }}>{org.type}</span>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 28, color: '#6b7280',
            cursor: 'pointer', lineHeight: 1
          }}>&times;</button>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 24px' }}>
          <Tabs tabs={REVIEW_TABS} activeTab={tab} onChange={setTab} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {tab === 'datos' && (
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                ['Nombre', org.name],
                ['Tipo', org.type],
                ['Dirección', [org.street, org.streetNumber, org.commune].filter(Boolean).join(', ')],
                ['Email', org.email],
                ['Teléfono', org.phone],
                ['Creada', formatDate(org.createdAt)]
              ].map(([label, value]) => value && (
                <div key={label} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontWeight: 600, color: '#374151', minWidth: 120, fontSize: 14 }}>{label}:</span>
                  <span style={{ color: '#6b7280', fontSize: 14 }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'miembros' && (
            <div>
              <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>
                {members.length} miembros registrados
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Nombre', 'RUT', 'Email'].map(h => (
                      <th key={h} style={{
                        padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb',
                        fontSize: 13, fontWeight: 600, color: '#374151'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px', fontSize: 14 }}>
                        {m.firstName || m.primerNombre || ''} {m.lastName || m.apellidoPaterno || ''}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 14, color: '#6b7280' }}>{m.rut}</td>
                      <td style={{ padding: '8px 12px', fontSize: 14, color: '#6b7280' }}>{m.email || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'directorio' && (
            <div style={{ display: 'grid', gap: 12 }}>
              {directorio.members ? directorio.members.map((m, i) => (
                <div key={i} style={{
                  padding: 12, border: '1px solid #e5e7eb', borderRadius: 8,
                  display: 'flex', justifyContent: 'space-between'
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                      {m.cargo || m.role || 'Miembro'}
                    </span>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                      {m.firstName || m.name || ''} {m.lastName || ''} - {m.rut || ''}
                    </p>
                  </div>
                </div>
              )) : Object.entries(directorio).filter(([k]) => k !== 'type').map(([cargo, data]) => (
                <div key={cargo} style={{
                  padding: 12, border: '1px solid #e5e7eb', borderRadius: 8
                }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#111827', textTransform: 'capitalize' }}>
                    {cargo}
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                    {typeof data === 'object' ? `${data.firstName || data.name || ''} ${data.lastName || ''} - ${data.rut || ''}` : String(data)}
                  </p>
                </div>
              ))}
              {(!directorio.members && Object.keys(directorio).filter(k => k !== 'type').length === 0) && (
                <p style={{ color: '#6b7280', textAlign: 'center' }}>Sin directorio provisorio</p>
              )}
            </div>
          )}

          {tab === 'documentos' && (
            <div>
              {org.documents && org.documents.length > 0 ? org.documents.map((doc, i) => (
                <div key={i} style={{
                  padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span style={{ fontSize: 14 }}>{doc.name || doc.type || `Documento ${i + 1}`}</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(doc.uploadedAt)}</span>
                </div>
              )) : (
                <p style={{ color: '#6b7280', textAlign: 'center' }}>Sin documentos</p>
              )}
            </div>
          )}

          {tab === 'historial' && (
            <div>
              {statusHistory.length > 0 ? statusHistory.map((h, i) => (
                <div key={i} style={{
                  padding: 12, borderLeft: '3px solid #2563eb', marginBottom: 12,
                  background: '#f9fafb', borderRadius: '0 8px 8px 0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <StatusBadge status={h.status || h.newStatus} />
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(h.date || h.timestamp)}</span>
                  </div>
                  {h.comment && <p style={{ fontSize: 13, color: '#374151', margin: '4px 0 0' }}>{h.comment}</p>}
                  {h.user && <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>Por: {h.user}</p>}
                </div>
              )) : (
                <p style={{ color: '#6b7280', textAlign: 'center' }}>Sin historial</p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #e5e7eb',
          display: 'flex', gap: 8, flexWrap: 'wrap'
        }}>
          {(org.status === 'pending_review' || org.status === 'in_review') && (
            <>
              <button onClick={() => handleStatusChange('in_review')} disabled={isActioning || org.status === 'in_review'}
                style={actionBtn('#8b5cf6')}>Tomar Revisión</button>
              <button onClick={() => setShowSchedule(true)} disabled={isActioning}
                style={actionBtn('#2563eb')}>Agendar Ministro</button>
              <button onClick={() => setShowReject(true)} disabled={isActioning}
                style={actionBtn('#ef4444')}>Rechazar</button>
            </>
          )}
          {org.status === 'ministro_approved' && (
            <>
              <button onClick={() => handleStatusChange('sent_registry')} disabled={isActioning}
                style={actionBtn('#6366f1')}>Enviar al Registro</button>
              <button onClick={() => handleStatusChange('approved')} disabled={isActioning}
                style={actionBtn('#10b981')}>Aprobar</button>
            </>
          )}
          {org.status === 'sent_registry' && (
            <button onClick={() => handleStatusChange('approved')} disabled={isActioning}
              style={actionBtn('#10b981')}>Aprobar</button>
          )}
        </div>
      </div>

      {/* Reject sub-modal */}
      {showReject && (
        <Modal open onClose={() => setShowReject(false)} title="Rechazar Organización">
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6, color: '#374151' }}>
              Comentario general
            </label>
            <textarea
              value={rejectComment}
              onChange={e => setRejectComment(e.target.value)}
              rows={4}
              style={{
                width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 8,
                fontSize: 14, resize: 'vertical'
              }}
              placeholder="Motivo del rechazo..."
            />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowReject(false)} style={actionBtn('#6b7280')}>Cancelar</button>
            <button onClick={handleReject} disabled={isActioning} style={actionBtn('#ef4444')}>
              {isActioning ? 'Rechazando...' : 'Confirmar Rechazo'}
            </button>
          </div>
        </Modal>
      )}

      {/* Schedule Ministro sub-modal */}
      {showSchedule && (
        <Modal open onClose={() => setShowSchedule(false)} title="Agendar Ministro de Fe">
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Ministro</label>
              <select
                value={scheduleData.ministroId}
                onChange={e => setScheduleData(d => ({ ...d, ministroId: e.target.value }))}
                style={{
                  width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14
                }}
              >
                <option value="">Seleccionar ministro...</option>
                {activeMinistros.map(m => (
                  <option key={m._id} value={m._id}>{m.firstName} {m.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Fecha</label>
              <input type="date" value={scheduleData.date}
                onChange={e => setScheduleData(d => ({ ...d, date: e.target.value }))}
                style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Hora</label>
              <input type="time" value={scheduleData.time}
                onChange={e => setScheduleData(d => ({ ...d, time: e.target.value }))}
                style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setShowSchedule(false)} style={actionBtn('#6b7280')}>Cancelar</button>
            <button onClick={handleScheduleMinistro} disabled={isActioning} style={actionBtn('#2563eb')}>
              {isActioning ? 'Agendando...' : 'Agendar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function actionBtn(color) {
  return {
    padding: '8px 16px', border: 'none', borderRadius: 8,
    background: color, color: 'white', fontSize: 13, fontWeight: 600,
    cursor: 'pointer'
  };
}
