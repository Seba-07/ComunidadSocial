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

// Cargo keys used in provisionalDirectorio (EN keys from DB + ES fallback)
const CARGO_KEYS = [
  { key: 'president', altKey: 'presidente', label: 'Presidente/a' },
  { key: 'vicePresident', altKey: 'vicepresidente', label: 'Vicepresidente/a' },
  { key: 'secretary', altKey: 'secretario', label: 'Secretario/a' },
  { key: 'treasurer', altKey: 'tesorero', label: 'Tesorero/a' },
];

const SKIP_DIR_KEYS = new Set([
  'president', 'vicePresident', 'secretary', 'treasurer',
  'presidente', 'vicepresidente', 'secretario', 'tesorero',
  'additionalMembers', 'designatedAt', 'type', '_id', '__v'
]);

function formatName(person) {
  if (!person) return '—';
  const parts = [person.firstName, person.segundoNombre, person.lastName, person.apellidoMaterno].filter(Boolean);
  return parts.join(' ') || '—';
}

function calculateAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function buildCargoEntries(dir) {
  const entries = [];
  for (const { key, altKey, label } of CARGO_KEYS) {
    const person = dir[key] || dir[altKey];
    if (person && typeof person === 'object' && (person.rut || person.firstName)) {
      entries.push({ key, label, person });
    }
  }
  if (Array.isArray(dir.additionalMembers)) {
    dir.additionalMembers.forEach((m, i) => {
      if (m && typeof m === 'object' && (m.rut || m.firstName)) {
        entries.push({ key: `additional_${i}`, label: m.cargoNombre || m.cargo || `Director/a ${i + 1}`, person: m });
      }
    });
  }
  // Non-standard keys (custom cargos from wizard)
  for (const [k, v] of Object.entries(dir)) {
    if (SKIP_DIR_KEYS.has(k)) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && (v.rut || v.firstName)) {
      entries.push({ key: k, label: v.cargoNombre || k, person: v });
    }
  }
  return entries;
}

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
    // Refresh org to get full data (list endpoint excludes members/docs)
    refreshOrganization(initialOrg._id).then(o => { if (o) setOrg(o); }).catch(() => {});
  }, [initialOrg._id]);

  const members = org.members || [];
  const directorio = org.provisionalDirectorio || org.directorio || {};
  const statusHistory = org.statusHistory || [];
  const cargoEntries = buildCargoEntries(directorio);
  const electoralCommission = org.electoralCommission || org.comisionElectoral || [];
  const certs = org.certificatesStep5 || [];

  // Org name/type with fallbacks for both old and new field names
  const orgName = org.organizationName || org.name || 'Organización';
  const orgType = (org.organizationType || org.type || '').replace(/_/g, ' ');

  function getCertForMember(rut, name) {
    if (!rut && !name) return null;
    const norm = rut ? rut.replace(/\./g, '').replace(/-/g, '') : '';
    return certs.find(c => {
      if (!c.certificate) return false;
      const cId = (c.memberId || '').replace(/\./g, '').replace(/-/g, '');
      if (norm && cId === norm) return true;
      if (name && c.memberName && c.memberName.toLowerCase().includes(name.toLowerCase())) return true;
      return false;
    });
  }

  function downloadBase64(base64Data, filename, mimeType = 'application/pdf') {
    try {
      let b64 = base64Data;
      if (b64.includes(',')) b64 = b64.split(',')[1];
      const byteChars = atob(b64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArray], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast('Error al descargar archivo', 'error');
    }
  }

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
              {orgName}
            </h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
              <StatusBadge status={org.status} />
              <span style={{ fontSize: 13, color: '#6b7280' }}>{orgType}</span>
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
                ['Nombre', orgName],
                ['Tipo', orgType],
                ['Dirección', [org.street, org.streetNumber].filter(Boolean).join(' ') || org.address],
                ['Comuna / Región', [org.comuna, org.region].filter(Boolean).join(', ')],
                ['Email de Contacto', org.contactEmail || org.email],
                ['Teléfono', org.contactPhone || org.phone],
                ['Unidad Vecinal', org.unidadVecinal],
                ['Territorio', org.territory],
                ['Creada', formatDate(org.createdAt)],
              ].filter(([, value]) => value).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontWeight: 600, color: '#374151', minWidth: 140, fontSize: 14 }}>{label}:</span>
                  <span style={{ color: '#6b7280', fontSize: 14 }}>{value}</span>
                </div>
              ))}
              {org.objectives && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontWeight: 600, color: '#374151', fontSize: 14, display: 'block', marginBottom: 4 }}>Objetivos:</span>
                  <p style={{ color: '#6b7280', fontSize: 13, whiteSpace: 'pre-line', margin: 0 }}>{org.objectives}</p>
                </div>
              )}
              {(org.electionDate || org.assemblyAddress) && (
                <div style={{ marginTop: 12, padding: 14, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                  <span style={{ fontWeight: 600, color: '#0369a1', fontSize: 13, display: 'block', marginBottom: 6 }}>Asamblea Constitutiva Programada</span>
                  <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#374151' }}>
                    {org.electionDate && <span>Fecha: {new Date(org.electionDate).toLocaleDateString('es-CL')}</span>}
                    {org.electionTime && <span>Hora: {org.electionTime}</span>}
                    {org.assemblyAddress && <span>Lugar: {org.assemblyAddress}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'miembros' && (
            <div>
              <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>
                {members.length} miembros registrados
                {(() => {
                  const minors = members.filter(m => {
                    const age = calculateAge(m.birthDate);
                    return age !== null && age < 18;
                  });
                  return minors.length > 0
                    ? <span style={{ color: '#d97706', fontWeight: 600 }}> ({minors.length} menores de edad)</span>
                    : null;
                })()}
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['N°', 'Nombre', 'RUT', 'Edad', 'Email', 'Teléfono'].map(h => (
                        <th key={h} style={{
                          padding: '8px 10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb',
                          fontSize: 12, fontWeight: 600, color: '#374151'
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m, i) => {
                      const age = calculateAge(m.birthDate);
                      const isMinor = age !== null && age < 18;
                      return (
                        <tr key={i} style={{
                          borderBottom: '1px solid #f3f4f6',
                          background: isMinor ? '#fef3c7' : 'transparent',
                        }}>
                          <td style={{ padding: '8px 10px', fontSize: 13, color: '#6b7280' }}>{i + 1}</td>
                          <td style={{ padding: '8px 10px', fontSize: 13 }}>
                            {formatName(m)}
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: 13, color: '#6b7280' }}>{m.rut || '—'}</td>
                          <td style={{ padding: '8px 10px', fontSize: 13 }}>
                            {age !== null ? (
                              <span style={{
                                color: isMinor ? '#d97706' : '#374151',
                                fontWeight: isMinor ? 600 : 400,
                              }}>
                                {age} años{isMinor ? ' (menor)' : ''}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: 13, color: '#6b7280' }}>{m.email || '—'}</td>
                          <td style={{ padding: '8px 10px', fontSize: 13, color: '#6b7280' }}>{m.phone || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'directorio' && (
            <div style={{ display: 'grid', gap: 12 }}>
              {cargoEntries.length > 0 ? cargoEntries.map(({ key, label, person }) => {
                const cert = getCertForMember(person.rut, person.firstName);
                return (
                  <div key={key} style={{
                    padding: 14, border: '1px solid #e5e7eb', borderRadius: 10, background: '#fafafa',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>
                        {formatName(person)} — {person.rut || '—'}
                      </div>
                      {person.birthDate && (() => {
                        const age = calculateAge(person.birthDate);
                        return age !== null ? (
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Edad: {age} años</div>
                        ) : null;
                      })()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {cert ? (
                        <button
                          onClick={() => downloadBase64(cert.certificate, `Certificado_${formatName(person)}.pdf`)}
                          style={{
                            fontSize: 11, fontWeight: 600, color: '#059669', background: '#d1fae5',
                            padding: '4px 10px', borderRadius: 6, border: '1px solid #a7f3d0',
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          Certificado cargado
                        </button>
                      ) : (
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: '#d97706', background: '#fef3c7',
                          padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap',
                        }}>
                          Sin certificado
                        </span>
                      )}
                    </div>
                  </div>
                );
              }) : (
                <p style={{ color: '#6b7280', textAlign: 'center' }}>Sin directorio provisorio</p>
              )}

              {electoralCommission.length > 0 && (
                <>
                  <h4 style={{ margin: '16px 0 4px', fontSize: 14, fontWeight: 600, color: '#111827' }}>
                    Comisión Electoral ({electoralCommission.length})
                  </h4>
                  {electoralCommission.map((m, i) => (
                    <div key={m.rut || i} style={{
                      padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f0f9ff',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{formatName(m)}</span>
                        <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 8 }}>{m.rut || ''}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, background: '#dbeafe', padding: '3px 8px', borderRadius: 4 }}>
                        Miembro {i + 1}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {tab === 'documentos' && (
            <div>
              {/* Estatutos */}
              <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#111827' }}>Estatutos</h4>
              {org.estatutosSnapshot?.nombreTipo && (
                <div style={{
                  padding: 14, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 12,
                  background: '#fafafa',
                }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Plantilla:</span>
                  <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 8 }}>{org.estatutosSnapshot.nombreTipo}</span>
                  {org.estatutosSnapshot.articulos?.length > 0 && (
                    <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>({org.estatutosSnapshot.articulos.length} artículos)</span>
                  )}
                </div>
              )}
              {org.estatutos ? (
                <div style={{
                  padding: 12, border: '1px solid #d1fae5', borderRadius: 8, marginBottom: 16,
                  background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 14, color: '#059669', fontWeight: 500 }}>Estatutos PDF</span>
                  <button
                    onClick={() => downloadBase64(org.estatutos, `Estatutos_${orgName}.pdf`)}
                    style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                      border: '1px solid #059669', background: 'white', color: '#059669',
                      cursor: 'pointer',
                    }}
                  >
                    Descargar
                  </button>
                </div>
              ) : (
                <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>Estatutos no disponibles</p>
              )}

              {/* Certificados de Antecedentes */}
              <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#111827' }}>
                Certificados de Antecedentes ({certs.filter(c => c.certificate).length}/{cargoEntries.length})
              </h4>
              {cargoEntries.length > 0 ? cargoEntries.map(({ key, label, person }) => {
                const cert = getCertForMember(person.rut, person.firstName);
                return (
                  <div key={key} style={{
                    padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}: </span>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>{formatName(person)}</span>
                    </div>
                    {cert ? (
                      <button
                        onClick={() => downloadBase64(cert.certificate, `Certificado_${formatName(person)}.pdf`)}
                        style={{
                          padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                          border: '1px solid #a7f3d0', background: '#d1fae5', color: '#059669',
                          cursor: 'pointer',
                        }}
                      >
                        Descargar
                      </button>
                    ) : (
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: '#d97706', background: '#fef3c7',
                        padding: '4px 10px', borderRadius: 6,
                      }}>
                        No cargado
                      </span>
                    )}
                  </div>
                );
              }) : (
                <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin directorio — no aplican certificados</p>
              )}

              {/* Otros documentos */}
              {org.documents && org.documents.length > 0 && (
                <>
                  <h4 style={{ margin: '20px 0 10px', fontSize: 14, fontWeight: 600, color: '#111827' }}>Otros Documentos</h4>
                  {org.documents.map((doc, i) => (
                    <div key={i} style={{
                      padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <span style={{ fontSize: 14 }}>{doc.name || doc.type || `Documento ${i + 1}`}</span>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(doc.uploadedAt)}</span>
                    </div>
                  ))}
                </>
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
          {(org.status === 'waiting_ministro' || org.status === 'pending_review' || org.status === 'in_review') && (
            <>
              {org.status !== 'in_review' && (
                <button onClick={() => handleStatusChange('in_review')} disabled={isActioning}
                  style={actionBtn('#8b5cf6')}>Tomar Revisión</button>
              )}
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
