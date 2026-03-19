import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../stores/uiStore';
import { localeDateString, localeString } from '../../utils/formatters';
import { templateToHtml } from '@shared/utils/templateBlockParser.js';

const STATUS_LABELS = {
  draft: 'Borrador',
  waiting_ministro: 'Esperando Ministro de Fe',
  ministro_scheduled: 'Ministro Agendado',
  ministro_approved: 'Aprobada por Ministro',
  pending_review: 'Pendiente de Revisión',
  in_review: 'En Revisión',
  corrections_requested: 'Correcciones Solicitadas',
  sent_registry: 'Registro Civil',
  registry_observations: 'Observaciones Registro',
  rejected: 'Rechazada',
  approved: 'Aprobada',
};

// Explicit cargo keys in display order (English keys from DB + Spanish fallback)
const CARGO_KEYS = [
  { key: 'president', altKey: 'presidente', label: 'Presidente/a' },
  { key: 'vicePresident', altKey: 'vicepresidente', label: 'Vicepresidente/a' },
  { key: 'secretary', altKey: 'secretario', label: 'Secretario/a' },
  { key: 'treasurer', altKey: 'tesorero', label: 'Tesorero/a' },
];

function formatName(person) {
  if (!person) return '—';
  const parts = [person.firstName, person.segundoNombre, person.lastName, person.apellidoMaterno].filter(Boolean);
  return parts.join(' ') || '—';
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
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

const minorBadge = { fontSize: 10, color: '#dc2626', fontWeight: 600, background: '#fef2f2', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' };

const RETRACTABLE_STATUSES = new Set(['waiting_ministro', 'ministro_scheduled', 'pending_review', 'in_review']);

export default function OrgSolicitudDetail({ org, onBack, onRefresh }) {
  const navigate = useNavigate();
  const addToast = useUiStore(s => s.addToast);
  const [saving, setSaving] = useState(false);
  const [editingCargo, setEditingCargo] = useState(null);
  const [showRetractModal, setShowRetractModal] = useState(false);
  const [retractReason, setRetractReason] = useState('');
  const [retracting, setRetracting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [correctedFields, setCorrectedFields] = useState({});
  const [resubmitComment, setResubmitComment] = useState('');
  const [resubmitting, setResubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRefs = useRef({});
  const [generatedDocs, setGeneratedDocs] = useState([]);

  useEffect(() => {
    if (org._id) {
      apiService.get(`/organizations/${org._id}/generated-documents`)
        .then(docs => { if (Array.isArray(docs)) setGeneratedDocs(docs); })
        .catch(() => {});
    }
  }, [org._id]);

  const dir = org.provisionalDirectorio || {};
  const members = org.members || [];
  const certs = org.certificatesStep5 || [];

  // Build cargo entries: extract person data from ALL possible structures
  const cargoEntries = [];
  const usedKeys = new Set();

  // Helper: check if value looks like a person object
  const isPerson = (v) => v && typeof v === 'object' && !Array.isArray(v) && (v.rut || v.firstName);

  // Label lookup for known cargo keys
  const CARGO_LABELS = {
    president: 'Presidente/a', presidente: 'Presidente/a',
    vicePresident: 'Vicepresidente/a', vicepresidente: 'Vicepresidente/a',
    secretary: 'Secretario/a', secretario: 'Secretario/a',
    treasurer: 'Tesorero/a', tesorero: 'Tesorero/a',
  };

  // 1) Check known cargo keys (English from DB schema + Spanish from wizard)
  for (const { key, altKey, label } of CARGO_KEYS) {
    const person = dir[key] || dir[altKey];
    if (isPerson(person)) {
      cargoEntries.push({ key, label, person });
      usedKeys.add(key);
      usedKeys.add(altKey);
    }
  }

  // 2) Additional directors array
  if (dir.additionalMembers?.length) {
    dir.additionalMembers.forEach((m, i) => {
      if (isPerson(m)) {
        cargoEntries.push({ key: `additional_${i}`, label: m.cargoNombre || m.cargo || `Director/a ${i + 1}`, person: m });
      }
    });
  }

  // 3) Scan ALL remaining keys for person-like objects (handles any format)
  const metaKeys = new Set([...usedKeys, 'additionalMembers', 'designatedAt', 'type', 'expiresAt', '_id', '__v', '$__', '$isNew', '_doc']);
  for (const [key, value] of Object.entries(dir)) {
    if (metaKeys.has(key)) continue;
    if (isPerson(value)) {
      const label = CARGO_LABELS[key] || capitalize(value.cargoNombre || value.cargo || key);
      cargoEntries.push({ key, label, person: value });
      usedKeys.add(key);
    }
  }

  function getCertForMember(rut, name) {
    if (!rut && !name) return null;
    const norm = rut ? rut.replace(/\./g, '').replace(/-/g, '') : '';
    return certs.find(c => {
      if (c.certificate) {
        const cId = (c.memberId || '').replace(/\./g, '').replace(/-/g, '');
        if (norm && cId === norm) return true;
        if (name && c.memberName && c.memberName.toLowerCase().includes(name.toLowerCase())) return true;
      }
      return false;
    });
  }

  async function handleChangeCargo(cargoKey, memberIdx) {
    const member = members[memberIdx];
    if (!member) return;
    setSaving(true);
    try {
      // Build clean directorio for PUT (only person fields + metadata)
      const newDir = {
        president: dir.president || dir.presidente || null,
        vicePresident: dir.vicePresident || dir.vicepresidente || null,
        secretary: dir.secretary || dir.secretario || null,
        treasurer: dir.treasurer || dir.tesorero || null,
        additionalMembers: dir.additionalMembers || [],
      };
      const newMember = {
        rut: member.rut,
        firstName: member.firstName,
        segundoNombre: member.segundoNombre || '',
        lastName: member.lastName,
        apellidoMaterno: member.apellidoMaterno || '',
      };
      if (cargoKey.startsWith('additional_')) {
        const idx = parseInt(cargoKey.split('_')[1]);
        const updated = [...newDir.additionalMembers];
        updated[idx] = { ...updated[idx], ...newMember };
        newDir.additionalMembers = updated;
      } else {
        newDir[cargoKey] = newMember;
      }
      await apiService.updateOrganization(org._id, { provisionalDirectorio: newDir });
      addToast('Directorio actualizado', 'success');
      setEditingCargo(null);
      onRefresh();
    } catch (err) {
      addToast('Error al actualizar directorio: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadCert(memberId, file) {
    if (!file) return;
    setSaving(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await apiService.syncCertificates(org._id, {
            [memberId]: { certificate: reader.result }
          });
          addToast('Certificado subido correctamente', 'success');
          onRefresh();
        } catch (err) {
          addToast('Error al subir certificado: ' + err.message, 'error');
        } finally {
          setSaving(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setSaving(false);
    }
  }

  function openEstatutosPreview() {
    const snapshot = org.estatutosSnapshot;
    if (!snapshot?.articulos?.length) {
      addToast('No hay estatutos disponibles', 'error');
      return;
    }
    const articulos = [...snapshot.articulos].sort((a, b) => (a.orden || a.numero || 0) - (b.orden || b.numero || 0));
    const name = org.organizationName || 'Organización';
    const type = (org.organizationType || '').replace(/_/g, ' ');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Estatutos - ${name}</title>
<style>body{font-family:Georgia,serif;max-width:750px;margin:40px auto;padding:0 20px;color:#1a1a1a;line-height:1.7}
h1{text-align:center;font-size:22px;margin-bottom:4px}h2{text-align:center;font-size:15px;color:#555;font-weight:400;margin-top:0}
.art{margin-bottom:18px}.art-title{font-weight:700;font-size:14px;margin-bottom:4px}.art-content{font-size:13px;white-space:pre-line}
@media print{body{margin:20px}}</style></head><body>
<h1>ESTATUTOS</h1><h2>${name} — ${type}</h2><hr style="margin:20px 0">
${articulos.map(a => `<div class="art"><div class="art-title">Artículo ${a.numero}: ${a.titulo}</div><div class="art-content">${a.contenido}</div></div>`).join('')}
</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  async function handleRetract() {
    if (!retractReason.trim()) {
      addToast('Debes indicar el motivo de la retractación', 'error');
      return;
    }
    setRetracting(true);
    try {
      await apiService.retractOrganization(org._id, retractReason.trim());
      addToast('Solicitud retractada exitosamente. La organización volvió a estado Borrador.', 'success');
      setShowRetractModal(false);
      setRetractReason('');
      onBack();
      onRefresh();
    } catch (err) {
      addToast('Error al retractar: ' + (err.message || 'Error desconocido'), 'error');
    } finally {
      setRetracting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiService.deleteOrganization(org._id);
      addToast('Organización eliminada exitosamente', 'success');
      setShowDeleteModal(false);
      onBack();
      onRefresh();
    } catch (err) {
      addToast('Error al eliminar: ' + (err.message || 'Error desconocido'), 'error');
    } finally {
      setDeleting(false);
    }
  }

  const canRetract = RETRACTABLE_STATUSES.has(org.status);
  const canDelete = org.status === 'draft';

  const sectionStyle = {
    background: 'white', borderRadius: 12, border: '1px solid #e5e7eb',
    padding: 20, marginBottom: 16,
  };
  const sectionTitle = { margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: '#111827' };
  const labelStyle = { fontSize: 12, color: '#6b7280', fontWeight: 500 };
  const valueStyle = { fontSize: 14, color: '#111827', fontWeight: 500 };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: '#2563eb', fontSize: 14,
          cursor: 'pointer', padding: 0, marginBottom: 12, fontWeight: 500,
        }}>
          ← Volver a Mis Organizaciones
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>
              {org.organizationName || 'Sin nombre'}
            </h2>
            <span style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              color: '#f59e0b', background: '#fef3c7',
            }}>
              {STATUS_LABELS[org.status] || org.status}
            </span>
          </div>
          {canRetract && (
            <button
              onClick={() => { setRetractReason(''); setShowRetractModal(true); }}
              style={{
                padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                border: '1px solid #dc2626', background: '#fef2f2', color: '#dc2626',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.target.style.background = '#dc2626'; e.target.style.color = 'white'; }}
              onMouseLeave={e => { e.target.style.background = '#fef2f2'; e.target.style.color = '#dc2626'; }}
            >
              Retractar Solicitud
            </button>
          )}
          {canDelete && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => navigate(`/wizard?edit=${org._id}`)}
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                  border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.target.style.background = '#2563eb'; e.target.style.color = 'white'; }}
                onMouseLeave={e => { e.target.style.background = '#eff6ff'; e.target.style.color = '#2563eb'; }}
              >
                Editar en Wizard
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                  border: '1px solid #dc2626', background: '#fef2f2', color: '#dc2626',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.target.style.background = '#dc2626'; e.target.style.color = 'white'; }}
                onMouseLeave={e => { e.target.style.background = '#fef2f2'; e.target.style.color = '#dc2626'; }}
              >
                Eliminar Organización
              </button>
            </div>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
          Detalle de la solicitud de constitución
        </p>
      </div>

      {/* Corrections Banner */}
      {org.status === 'corrections_requested' && org.corrections?.items?.length > 0 && (
        <div style={{ marginBottom: 20, padding: 20, background: '#fff7ed', border: '2px solid #f59e0b', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>&#9888;</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#92400e' }}>
              Correcciones Solicitadas ({org.corrections.items.length})
            </h3>
          </div>
          {org.corrections.generalComment && (
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#92400e', fontStyle: 'italic' }}>
              "{org.corrections.generalComment}"
            </p>
          )}
          <div style={{ display: 'grid', gap: 10 }}>
            {org.corrections.items.map((item, i) => {
              const f = item.field || '';
              // Classify field type for appropriate correction control
              const isCertField = f.startsWith('cert.');
              const isDirectorioField = f.startsWith('provisionalDirectorio.');
              const isComisionField = f.startsWith('electoralCommission.');
              const isMemberField = f.startsWith('members.');
              const isGeneratedDoc = f.startsWith('generatedDoc.');
              const isEstatutos = f === 'estatutos';
              const isObjectives = f === 'objectives';
              // These are auto-regenerated — no manual input needed
              const isAutoRegenerated = isGeneratedDoc || isEstatutos;
              // These need member selection from dropdown
              const needsMemberSelect = isDirectorioField || isComisionField || isMemberField;

              const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #f59e0b', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', background: '#fffbeb' };
              const doneStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6 };

              return (
                <div key={i} style={{ padding: 12, background: 'white', border: '1px solid #fed7aa', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Observacion: {item.message}</div>
                  {item.currentValue && <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>Valor actual: {item.currentValue}</div>}

                  {/* Auto-regenerated docs — just acknowledge, will be regenerated on resubmit */}
                  {isAutoRegenerated && (
                    <div style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, color: '#1e40af' }}>
                      {correctedFields[f] === '_acknowledged' ? (
                        <span style={{ fontWeight: 600 }}>Marcado para regeneración al reenviar</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span>Este documento se regenerará automáticamente al corregir los datos y reenviar la solicitud.</span>
                          <button onClick={() => setCorrectedFields(prev => ({ ...prev, [f]: '_acknowledged' }))}
                            style={{ padding: '4px 12px', border: 'none', borderRadius: 6, background: '#2563eb', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Entendido
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Certificate upload */}
                  {isCertField && (
                    <div>
                      {correctedFields[f] ? (
                        <div style={doneStyle}>
                          <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>Nuevo archivo: {correctedFields[f].name}</span>
                          <button onClick={() => setCorrectedFields(prev => { const c = { ...prev }; delete c[f]; return c; })}
                            style={{ padding: '2px 8px', border: '1px solid #ef4444', borderRadius: 4, background: 'white', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>Quitar</button>
                        </div>
                      ) : (
                        <label style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                          border: '2px dashed #f59e0b', borderRadius: 8, background: '#fffbeb',
                          cursor: 'pointer', fontSize: 13, color: '#92400e', fontWeight: 600,
                        }}>
                          Seleccionar nuevo archivo (PDF, JPG, PNG)
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                            onChange={e => {
                              const file = e.target.files[0];
                              if (!file) return;
                              if (file.size > 5 * 1024 * 1024) { addToast('Max 5MB', 'error'); return; }
                              const reader = new FileReader();
                              reader.onload = () => setCorrectedFields(prev => ({ ...prev, [f]: { name: file.name, data: reader.result, _isFile: true } }));
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {/* Directorio / Comisión — select from existing members */}
                  {needsMemberSelect && (
                    <div>
                      {correctedFields[f] ? (
                        <div style={doneStyle}>
                          <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>
                            Nuevo: {typeof correctedFields[f] === 'object' ? `${correctedFields[f].firstName} ${correctedFields[f].lastName} — ${correctedFields[f].rut}` : correctedFields[f]}
                          </span>
                          <button onClick={() => setCorrectedFields(prev => { const c = { ...prev }; delete c[f]; return c; })}
                            style={{ padding: '2px 8px', border: '1px solid #ef4444', borderRadius: 4, background: 'white', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>Quitar</button>
                        </div>
                      ) : (
                        <select
                          value=""
                          onChange={e => {
                            const idx = parseInt(e.target.value);
                            if (isNaN(idx)) return;
                            const m = members[idx];
                            if (m) setCorrectedFields(prev => ({ ...prev, [f]: { ...m, _isMember: true } }));
                          }}
                          style={inputStyle}
                        >
                          <option value="">Seleccionar miembro de reemplazo...</option>
                          {members.map((m, mi) => (
                            <option key={m.rut || mi} value={mi}>
                              {m.firstName} {m.lastName} — {m.rut}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Objectives — textarea */}
                  {isObjectives && (
                    <textarea
                      placeholder="Corrige los objetivos (uno por línea)..."
                      value={correctedFields[f] || ''}
                      onChange={e => setCorrectedFields(prev => ({ ...prev, [f]: e.target.value }))}
                      rows={4}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  )}

                  {/* Regular text fields */}
                  {!isCertField && !needsMemberSelect && !isAutoRegenerated && !isObjectives && (
                    <input
                      type="text"
                      placeholder="Ingresa el valor corregido..."
                      value={correctedFields[f] || ''}
                      onChange={e => setCorrectedFields(prev => ({ ...prev, [f]: e.target.value }))}
                      style={inputStyle}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Comentario (opcional):</label>
            <textarea value={resubmitComment} onChange={e => setResubmitComment(e.target.value)}
              placeholder="Explica las correcciones realizadas..."
              rows={2} style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <button
            disabled={resubmitting || Object.keys(correctedFields).length === 0}
            onClick={async () => {
              const pendingCount = org.corrections.items.length;
              const filledCount = Object.values(correctedFields).filter(v => {
                if (v === '_acknowledged') return true;
                if (typeof v === 'object' && v._isFile) return !!v.data;
                if (typeof v === 'object' && v._isMember) return !!v.rut;
                return typeof v === 'string' && v.trim();
              }).length;
              if (filledCount < pendingCount) {
                addToast(`Completa todas las correcciones (${filledCount}/${pendingCount})`, 'error');
                return;
              }
              setResubmitting(true);
              try {
                // Classify corrections by type
                const textFields = {};
                const fileFields = {};
                const memberFields = {};
                for (const [key, val] of Object.entries(correctedFields)) {
                  if (val === '_acknowledged') continue; // auto-regenerated, skip
                  if (typeof val === 'object' && val._isFile) {
                    fileFields[key] = val.data;
                  } else if (typeof val === 'object' && val._isMember) {
                    // Store the full member object for directorio/comision replacement
                    memberFields[key] = val;
                  } else {
                    textFields[key] = val;
                  }
                }
                // Merge member selections into textFields as serialized objects
                for (const [key, member] of Object.entries(memberFields)) {
                  const { _isMember, ...memberData } = member;
                  textFields[key] = memberData;
                }
                // Submit corrections
                await apiService.resubmitOrganization(org._id, resubmitComment, textFields);
                // Upload corrected certificate files separately
                for (const [field, base64Data] of Object.entries(fileFields)) {
                  const parts = field.split('.');
                  if (parts.length >= 2) {
                    const memberId = parts[1];
                    await apiService.syncCertificates(org._id, {
                      [memberId]: { certificate: base64Data }
                    });
                  }
                }
                addToast('Correcciones enviadas exitosamente', 'success');
                onRefresh();
              } catch (err) {
                addToast(err.message || 'Error al reenviar', 'error');
              } finally {
                setResubmitting(false);
              }
            }}
            style={{
              marginTop: 12, padding: '12px 28px', border: 'none', borderRadius: 10,
              background: Object.keys(correctedFields).length > 0 ? '#f59e0b' : '#d1d5db',
              color: 'white', fontSize: 15, fontWeight: 700,
              cursor: Object.keys(correctedFields).length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            {resubmitting ? 'Reenviando...' : 'Reenviar con Correcciones'}
          </button>
        </div>
      )}

      {/* 1. Datos Generales */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Datos Generales</h3>
        <div className="r-grid-2" style={{ gap: '12px 24px' }}>
          <div><span style={labelStyle}>Tipo de Organización</span><div style={valueStyle}>{(org.organizationType || '').replace(/_/g, ' ')}</div></div>
          <div><span style={labelStyle}>Fecha de Solicitud</span><div style={valueStyle}>{(() => {
            const submitEntry = [...(org.statusHistory || [])].reverse().find(h => h.status === 'waiting_ministro');
            return localeDateString(submitEntry?.date || org.createdAt);
          })()}</div></div>
          <div><span style={labelStyle}>Dirección</span><div style={valueStyle}>{capitalize([org.street, org.streetNumber].filter(Boolean).join(' ') || org.address || '—')}</div></div>
          <div><span style={labelStyle}>Comuna / Región</span><div style={valueStyle}>{[org.comuna, org.region].filter(Boolean).join(', ') || '—'}</div></div>
          <div><span style={labelStyle}>Email de Contacto</span><div style={valueStyle}>{org.contactEmail || '—'}</div></div>
          <div><span style={labelStyle}>Teléfono</span><div style={valueStyle}>{org.contactPhone || '—'}</div></div>
          {org.unidadVecinal && <div><span style={labelStyle}>Unidad Vecinal</span><div style={valueStyle}>{org.unidadVecinal}</div></div>}
          {org.territory && <div><span style={labelStyle}>Territorio</span><div style={valueStyle}>{org.territory}</div></div>}
        </div>
        {org.description && (
          <div style={{ marginTop: 12 }}>
            <span style={labelStyle}>Descripción</span>
            <div style={{ ...valueStyle, fontSize: 13, whiteSpace: 'pre-line', marginTop: 4 }}>{org.description}</div>
          </div>
        )}
        {org.objectives && (
          <div style={{ marginTop: 12 }}>
            <span style={labelStyle}>Objetivos</span>
            <div style={{ ...valueStyle, fontSize: 13, whiteSpace: 'pre-line', marginTop: 4 }}>{org.objectives}</div>
          </div>
        )}
      </div>

      {/* 2. Appointment modification alert */}
      {org.appointmentWasModified && (
        <div style={{
          padding: 14, background: '#fef3c7', borderRadius: 10, border: '1px solid #fbbf24', marginBottom: 16,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginBottom: 4 }}>
            La cita de tu asamblea fue modificada
          </div>
          <div style={{ fontSize: 13, color: '#78350f' }}>
            El municipio cambió la fecha, hora o lugar de tu asamblea constitutiva.
            Revisa los datos confirmados a continuación.
          </div>
        </div>
      )}

      {/* 2a. Confirmed assembly (ministro assigned) */}
      {org.ministroData?.scheduledDate ? (
        <div style={{ ...sectionStyle, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <h3 style={{ ...sectionTitle, color: '#166534' }}>Asamblea Confirmada</h3>
          <div className="r-grid-2" style={{ gap: '12px 24px' }}>
            <div><span style={labelStyle}>Fecha Confirmada</span><div style={valueStyle}>{localeDateString(org.ministroData.scheduledDate)}</div></div>
            <div><span style={labelStyle}>Hora Confirmada</span><div style={valueStyle}>{org.ministroData.scheduledTime || '—'}</div></div>
            <div><span style={labelStyle}>Lugar</span><div style={valueStyle}>{capitalize(org.ministroData.location || org.assemblyAddress || '—')}</div></div>
            <div><span style={labelStyle}>Ministro de Fe</span><div style={valueStyle}>{org.ministroData.name || '—'}</div></div>
          </div>
        </div>
      ) : (org.electionDate || org.assemblyAddress) ? (
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>Asamblea Solicitada</h3>
          <div className="r-grid-3" style={{ gap: '12px 24px' }}>
            {org.electionDate && <div><span style={labelStyle}>Fecha</span><div style={valueStyle}>{localeDateString(org.electionDate)}</div></div>}
            {org.electionTime && <div><span style={labelStyle}>Hora</span><div style={valueStyle}>{org.electionTime}</div></div>}
            {org.assemblyAddress && <div><span style={labelStyle}>Lugar</span><div style={valueStyle}>{capitalize(org.assemblyAddress)}</div></div>}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7280' }}>
            Pendiente de confirmación por el municipio.
          </p>
        </div>
      ) : null}

      {/* 3. Miembros */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Miembros ({members.length})</h3>
        {members.length > 0 ? (
          <div className="r-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={thStyle}>N°</th>
                  <th style={thStyle}>Nombre</th>
                  <th style={thStyle}>RUT</th>
                  <th style={thStyle}>Edad</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Teléfono</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => {
                  const age = calculateAge(m.birthDate);
                  const isMinor = age !== null && age < 18;
                  return (
                    <tr key={m.rut || i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={tdStyle}>{formatName(m)}</td>
                      <td style={tdStyle}>{m.rut || '—'}</td>
                      <td style={tdStyle}>
                        {age !== null ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {age}
                            {isMinor && <span style={minorBadge}>Menor de edad</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={tdStyle}>{m.email || '—'}</td>
                      <td style={tdStyle}>{m.phone || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>No hay miembros registrados</p>
        )}
      </div>

      {/* 3b. Comisión Electoral */}
      {(() => {
        const ce = org.electoralCommission || org.comisionElectoral || [];
        if (!ce.length) return null;
        return (
          <div style={sectionStyle}>
            <h3 style={sectionTitle}>Comisión Electoral ({ce.length})</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {ce.map((m, i) => {
                // Fallback: if birthDate missing, look it up from members list by RUT
                const birthDate = m.birthDate || (m.rut && members.find(mb => mb.rut === m.rut)?.birthDate) || null;
                const age = calculateAge(birthDate);
                const isMinor = age !== null && age < 18;
                return (
                  <div key={m.rut || i} style={{
                    padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6,
                  }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{formatName(m)}</span>
                      <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 8 }}>{m.rut || ''}</span>
                      {isMinor && <span style={{ ...minorBadge, marginLeft: 8 }}>Menor de edad</span>}
                    </div>
                    <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, background: '#dbeafe', padding: '3px 8px', borderRadius: 4 }}>
                      Miembro {i + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 4. Directorio Provisorio */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Directorio Provisorio</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {cargoEntries.length > 0 ? cargoEntries.map(({ key, label, person }) => {
            const isEditing = editingCargo === key;
            const cert = getCertForMember(person.rut, person.firstName);
            const birthDate = person.birthDate || (person.rut && members.find(mb => mb.rut === person.rut)?.birthDate) || null;
            const age = calculateAge(birthDate);
            const isMinor = age !== null && age < 18;
            return (
              <div key={key} style={{
                padding: 14, border: '1px solid #e5e7eb', borderRadius: 10, background: '#fafafa',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, color: '#111827', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {formatName(person)} — {person.rut || '—'}
                    {isMinor && <span style={minorBadge}>Menor de edad</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {cert ? (
                    <span style={{ fontSize: 11, color: '#059669', fontWeight: 600, background: '#d1fae5', padding: '3px 8px', borderRadius: 4 }}>
                      Certificado subido
                    </span>
                  ) : (
                    <>
                      <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600, background: '#fef3c7', padding: '3px 8px', borderRadius: 4 }}>
                        Certificado pendiente
                      </span>
                      {org.status === 'draft' && (
                        <>
                          <input
                            ref={el => fileInputRefs.current[key] = el}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            style={{ display: 'none' }}
                            onChange={e => {
                              if (e.target.files[0]) handleUploadCert(person.rut || key, e.target.files[0]);
                            }}
                          />
                          <button
                            onClick={() => fileInputRefs.current[key]?.click()}
                            disabled={saving}
                            style={{
                              padding: '4px 10px', fontSize: 11, borderRadius: 6,
                              border: '1px solid #d1d5db', background: 'white', color: '#374151',
                              cursor: saving ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Subir
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {org.status === 'draft' && (
                    isEditing ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select
                          onChange={e => { if (e.target.value) handleChangeCargo(key, parseInt(e.target.value)); }}
                          defaultValue=""
                          style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db' }}
                        >
                          <option value="">Seleccionar...</option>
                          {members.map((m, i) => (
                            <option key={m.rut || i} value={i}>{formatName(m)} — {m.rut}</option>
                          ))}
                        </select>
                        <button onClick={() => setEditingCargo(null)}
                          style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingCargo(key)}
                        style={{
                          padding: '4px 10px', fontSize: 11, borderRadius: 6,
                          border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8',
                          cursor: 'pointer',
                        }}>
                        Cambiar
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          }) : (
            <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>No hay directorio asignado</p>
          )}
        </div>
      </div>

      {/* 4b. Documentos Adjuntos */}
      {(() => {
        const validCerts = certs.filter(c => c.certificate);
        // Match each cert to a cargo by RUT
        const enrichedCerts = validCerts.map(cert => {
          const certRut = (cert.memberId || '').replace(/\./g, '').replace(/-/g, '');
          let cargoLabel = '';
          for (const { label, person } of cargoEntries) {
            const pRut = (person.rut || '').replace(/\./g, '').replace(/-/g, '');
            if (pRut && pRut === certRut) { cargoLabel = label; break; }
          }
          // Also try matching by memberId as cargo key
          if (!cargoLabel && CARGO_LABELS[cert.memberId]) cargoLabel = CARGO_LABELS[cert.memberId];
          return { ...cert, cargoLabel };
        });

        // Build inhability certs (adults) and minor exemptions from directorio
        const inhCerts = [];
        const minorExemptions = [];
        for (const { person, label } of cargoEntries) {
          const bd = person.birthDate || (person.rut && members.find(mb => mb.rut === person.rut)?.birthDate) || null;
          const age = calculateAge(bd);
          if (age !== null && age < 18) {
            minorExemptions.push({ name: formatName(person), cargo: label, age });
          } else if (person.inhabilityCertificate) {
            inhCerts.push({ name: formatName(person), cargo: label, certificate: person.inhabilityCertificate });
          }
        }

        if (enrichedCerts.length === 0 && inhCerts.length === 0 && minorExemptions.length === 0) return null;

        function viewCertDoc(cert) {
          if (!cert.certificate) return;
          try {
            // Convert base64 to Blob URL for reliable viewing (data URIs fail for large PDFs)
            const raw = cert.certificate.includes(',') ? cert.certificate.split(',')[1] : cert.certificate;
            const byteChars = atob(raw);
            const byteArray = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
            const isPdf = cert.memberName?.endsWith('.pdf') || cert.certificate.includes('application/pdf') || byteChars.startsWith('%PDF');
            const blob = new Blob([byteArray], { type: isPdf ? 'application/pdf' : 'image/png' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
          } catch (err) {
            console.error('Error viewing cert:', err);
            // Fallback: try data URI
            const data = cert.certificate.startsWith('data:') ? cert.certificate : `data:application/pdf;base64,${cert.certificate}`;
            window.open(data, '_blank');
          }
        }

        const viewBtnStyle = {
          padding: '5px 14px', border: 'none', borderRadius: 8,
          background: 'linear-gradient(135deg, #f0f5ff, #e8eeff)', color: '#2563eb',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          transition: 'all 0.15s', boxShadow: '0 1px 2px rgba(37,99,235,0.08)', flexShrink: 0,
        };
        const subTitleStyle = { fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '12px 0 6px', paddingBottom: 4, borderBottom: '1px solid #e5e7eb' };
        const eyeIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;

        return (
          <div style={sectionStyle}>
            <h3 style={sectionTitle}>Documentos Adjuntos ({enrichedCerts.length + inhCerts.length})</h3>

            <div style={subTitleStyle}>Certificados de Antecedentes</div>
            {enrichedCerts.map((cert, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <div style={{ position: 'absolute', bottom: -1, right: -3, width: 11, height: 11, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="7" height="7" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="2 6 5 9 10 3"/></svg>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                    {cert.memberName || '—'}
                    {cert.cargoLabel && <span style={{ color: '#6b7280', fontWeight: 400 }}> — {cert.cargoLabel}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Cert. Antecedentes — RUT: {cert.memberId || '—'}</div>
                </div>
                <button onClick={() => viewCertDoc(cert)} style={viewBtnStyle}
                  onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #f0f5ff, #e8eeff)'; e.currentTarget.style.color = '#2563eb'; }}
                >{eyeIcon} Ver</button>
              </div>
            ))}

            {(inhCerts.length > 0 || minorExemptions.length > 0) && (
              <>
                <div style={{ ...subTitleStyle, marginTop: 16 }}>Certificados de Inhabilidades</div>
                {inhCerts.map((ic, i) => (
                  <div key={`inh_${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div style={{ position: 'absolute', bottom: -1, right: -3, width: 11, height: 11, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="7" height="7" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="2 6 5 9 10 3"/></svg>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                        {ic.name}
                        <span style={{ color: '#6b7280', fontWeight: 400 }}> — {ic.cargo}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>Cert. Inhabilidades</div>
                    </div>
                    <button onClick={() => viewCertDoc({ certificate: ic.certificate, memberName: 'inhabilidad.pdf' })} style={viewBtnStyle}
                      onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)'; e.currentTarget.style.color = 'white'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #f0f5ff, #e8eeff)'; e.currentTarget.style.color = '#2563eb'; }}
                    >{eyeIcon} Ver</button>
                  </div>
                ))}
                {minorExemptions.map((ex, i) => (
                  <div key={`minor_${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < minorExemptions.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>{ex.name} ({ex.cargo})</div>
                      <div style={{ fontSize: 11, color: '#b0b7c3' }}>No aplica (Menor de edad — {ex.age} años)</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })()}

      {/* 4c. Documentos Generados (from DB) */}
      {generatedDocs.length > 0 && (() => {
        const DOC_LABELS = {
          acta_constitutiva: 'Acta Constitutiva',
          lista_socios: 'Lista de Socios Fundadores',
          nomina_directorio: 'Nómina del Directorio',
          carta_solicitud: 'Carta de Solicitud',
          declaracion_jurada: 'Declaración Jurada',
        };
        function viewGenDoc(doc) {
          if (!doc.content) return;
          // PDF stored as base64 data URL — convert to Blob URL for reliable viewing
          if (doc.content.startsWith('data:application/pdf')) {
            try {
              const base64 = doc.content.split(',')[1] || doc.content.split('base64,')[1];
              const byteChars = atob(base64);
              const byteArray = new Uint8Array(byteChars.length);
              for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
              const blob = new Blob([byteArray], { type: 'application/pdf' });
              const blobUrl = URL.createObjectURL(blob);
              window.open(blobUrl, '_blank');
            } catch (err) {
              console.error('Error opening PDF:', err);
              // Fallback: try data URL directly
              window.open(doc.content, '_blank');
            }
            return;
          }
          // Fallback for legacy HTML or raw text documents
          const w = window.open('', '_blank');
          if (!w) return;
          if (doc.content.trim().startsWith('<!DOCTYPE')) {
            w.document.write(doc.content);
          } else {
            const html = templateToHtml(doc.content || '');
            w.document.write(html);
          }
          w.document.close();
        }
        const eyeIconGen = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
        const viewBtnGen = {
          padding: '5px 14px', border: 'none', borderRadius: 8,
          background: 'linear-gradient(135deg, #f0f5ff, #e8eeff)', color: '#2563eb',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          transition: 'all 0.15s', boxShadow: '0 1px 2px rgba(37,99,235,0.08)', flexShrink: 0,
        };
        return (
          <div style={sectionStyle}>
            <h3 style={sectionTitle}>Documentos Generados ({generatedDocs.length})</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {generatedDocs.map((doc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  <div style={{ flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                      {DOC_LABELS[doc.docType] || capitalize(doc.docType?.replace(/_/g, ' ') || 'Documento')}
                      {doc.cargoNombre && <span style={{ color: '#6b7280', fontWeight: 400 }}> — {doc.cargoNombre}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      {doc.generatedAt ? `Generado: ${localeDateString(doc.generatedAt)}` : ''}
                    </div>
                  </div>
                  <button onClick={() => viewGenDoc(doc)} style={viewBtnGen}
                    onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #f0f5ff, #e8eeff)'; e.currentTarget.style.color = '#2563eb'; }}
                  >{eyeIconGen} Ver</button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 5. Estatutos */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Estatutos</h3>
        {org.estatutosSnapshot?.articulos?.length > 0 ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <span style={labelStyle}>Plantilla: </span>
                <span style={valueStyle}>{org.estatutosSnapshot.nombreTipo || '—'}</span>
                <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>({org.estatutosSnapshot.articulos.length} artículos)</span>
              </div>
              <button onClick={openEstatutosPreview}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                  border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb',
                  cursor: 'pointer',
                }}>
                Ver / Imprimir
              </button>
            </div>
            <div style={{
              maxHeight: 250, overflowY: 'auto', border: '1px solid #e5e7eb',
              borderRadius: 8, padding: 14, background: '#fafafa',
            }}>
              {[...org.estatutosSnapshot.articulos]
                .sort((a, b) => (a.orden || a.numero || 0) - (b.orden || b.numero || 0))
                .map((art, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2 }}>
                      Artículo {art.numero}: {art.titulo}
                    </div>
                    <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {art.contenido}
                    </div>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Estatutos no disponibles</p>
        )}
      </div>

      {/* 6. Historial de Estado */}
      {org.statusHistory?.length > 0 && (
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>Historial de Estado</h3>
          <div style={{ display: 'grid', gap: 0 }}>
            {org.statusHistory.map((entry, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '10px 0',
                borderBottom: i < org.statusHistory.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                  background: i === 0 ? '#2563eb' : '#d1d5db',
                }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                    {STATUS_LABELS[entry.status] || entry.status}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {entry.date ? localeString(entry.date) : ''}
                    {entry.comment && ` — ${entry.comment}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminar (solo draft) */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 28, maxWidth: 480, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: '#fef2f2',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
              }}>
                🗑️
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
                Eliminar Organización
              </h3>
            </div>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: '0 0 20px' }}>
              ¿Estás seguro de que deseas eliminar <strong>{org.organizationName}</strong>? Esta acción es <strong>permanente</strong> y
              no se puede deshacer. Se eliminarán todos los datos, miembros y documentos asociados.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  padding: '10px 20px', fontSize: 14, fontWeight: 500, borderRadius: 8,
                  border: '1px solid #d1d5db', background: 'white', color: '#374151',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '10px 20px', fontSize: 14, fontWeight: 600, borderRadius: 8,
                  border: 'none', background: '#dc2626', color: 'white',
                  cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de retractar */}
      {showRetractModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 28, maxWidth: 480, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: '#fef2f2',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
              }}>
                ⚠️
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
                Retractar Solicitud
              </h3>
            </div>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: '0 0 16px' }}>
              ¿Estás seguro de que deseas retractar esta solicitud? La organización volverá a estado <strong>Borrador</strong>,
              se cancelará la revisión del Secretario Municipal y se anulará cualquier fecha agendada con el Ministro de Fe.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Motivo de la retractación <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                value={retractReason}
                onChange={e => setRetractReason(e.target.value)}
                placeholder="Explica por qué retractas la solicitud (ej: error en datos de miembros, cambio de directorio, etc.)"
                rows={3}
                style={{
                  width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8,
                  fontSize: 14, resize: 'vertical', boxSizing: 'border-box',
                }}
              />
              <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
                Este motivo será visible para el Secretario Municipal.
              </p>
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px', fontStyle: 'italic' }}>
              Podrás editar la organización y volver a enviar la solicitud desde el wizard.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowRetractModal(false)}
                disabled={retracting}
                style={{
                  padding: '10px 20px', fontSize: 14, fontWeight: 500, borderRadius: 8,
                  border: '1px solid #d1d5db', background: 'white', color: '#374151',
                  cursor: retracting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleRetract}
                disabled={retracting}
                style={{
                  padding: '10px 20px', fontSize: 14, fontWeight: 600, borderRadius: 8,
                  border: 'none', background: '#dc2626', color: 'white',
                  cursor: retracting ? 'not-allowed' : 'pointer', opacity: retracting ? 0.7 : 1,
                }}
              >
                {retracting ? 'Retractando...' : 'Sí, Retractar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = { textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' };
const tdStyle = { padding: '8px 10px', color: '#374151' };
