import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../stores/uiStore';

const STATUS_LABELS = {
  draft: 'Borrador',
  waiting_ministro: 'Esperando Ministro de Fe',
  ministro_scheduled: 'Ministro Agendado',
  ministro_approved: 'Aprobada por Ministro',
  pending_review: 'Pendiente de Revisión',
  in_review: 'En Revisión',
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
  const [deleting, setDeleting] = useState(false);
  const fileInputRefs = useRef({});

  const dir = org.provisionalDirectorio || {};
  const members = org.members || [];
  const certs = org.certificatesStep5 || [];

  // Build cargo entries explicitly from known keys (English from DB, Spanish fallback)
  const cargoEntries = [];
  for (const { key, altKey, label } of CARGO_KEYS) {
    const person = dir[key] || dir[altKey];
    if (person && (person.rut || person.firstName)) {
      cargoEntries.push({ key, label, person });
    }
  }
  // Additional directors/custom cargos
  if (dir.additionalMembers?.length) {
    dir.additionalMembers.forEach((m, i) => {
      if (m && (m.rut || m.firstName)) {
        cargoEntries.push({ key: `additional_${i}`, label: m.cargoNombre || m.cargo || `Director/a ${i + 1}`, person: m });
      }
    });
  }
  // Also check for any non-standard cargo keys (e.g. director1, director2 from wizard)
  const knownKeys = new Set(['president', 'vicePresident', 'secretary', 'treasurer',
    'presidente', 'vicepresidente', 'secretario', 'tesorero',
    'additionalMembers', 'designatedAt', 'type', '_id', '__v']);
  for (const [key, value] of Object.entries(dir)) {
    if (knownKeys.has(key)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value) && (value.rut || value.firstName)) {
      cargoEntries.push({ key, label: value.cargoNombre || key, person: value });
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

      {/* 1. Datos Generales */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Datos Generales</h3>
        <div className="r-grid-2" style={{ gap: '12px 24px' }}>
          <div><span style={labelStyle}>Tipo de Organización</span><div style={valueStyle}>{(org.organizationType || '').replace(/_/g, ' ')}</div></div>
          <div><span style={labelStyle}>Fecha de Solicitud</span><div style={valueStyle}>{org.createdAt ? new Date(org.createdAt).toLocaleDateString('es-CL') : '—'}</div></div>
          <div><span style={labelStyle}>Dirección</span><div style={valueStyle}>{[org.street, org.streetNumber].filter(Boolean).join(' ') || org.address || '—'}</div></div>
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
            <div><span style={labelStyle}>Fecha Confirmada</span><div style={valueStyle}>{new Date(org.ministroData.scheduledDate).toLocaleDateString('es-CL')}</div></div>
            <div><span style={labelStyle}>Hora Confirmada</span><div style={valueStyle}>{org.ministroData.scheduledTime || '—'}</div></div>
            <div><span style={labelStyle}>Lugar</span><div style={valueStyle}>{org.ministroData.location || org.assemblyAddress || '—'}</div></div>
            <div><span style={labelStyle}>Ministro de Fe</span><div style={valueStyle}>{org.ministroData.name || '—'}</div></div>
          </div>
        </div>
      ) : (org.electionDate || org.assemblyAddress) ? (
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>Asamblea Solicitada</h3>
          <div className="r-grid-3" style={{ gap: '12px 24px' }}>
            {org.electionDate && <div><span style={labelStyle}>Fecha</span><div style={valueStyle}>{new Date(org.electionDate).toLocaleDateString('es-CL')}</div></div>}
            {org.electionTime && <div><span style={labelStyle}>Hora</span><div style={valueStyle}>{org.electionTime}</div></div>}
            {org.assemblyAddress && <div><span style={labelStyle}>Lugar</span><div style={valueStyle}>{org.assemblyAddress}</div></div>}
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
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Teléfono</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.rut || i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={tdStyle}>{formatName(m)}</td>
                    <td style={tdStyle}>{m.rut || '—'}</td>
                    <td style={tdStyle}>{m.email || '—'}</td>
                    <td style={tdStyle}>{m.phone || '—'}</td>
                  </tr>
                ))}
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
              {ce.map((m, i) => (
                <div key={m.rut || i} style={{
                  padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa',
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
            return (
              <div key={key} style={{
                padding: 14, border: '1px solid #e5e7eb', borderRadius: 10, background: '#fafafa',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>
                    {formatName(person)} — {person.rut || '—'}
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

                  {isEditing ? (
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
                  )}
                </div>
              </div>
            );
          }) : (
            <div>
              <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 8px' }}>No hay directorio asignado</p>
              {Object.keys(dir).length > 0 && (
                <details style={{ fontSize: 12, color: '#6b7280' }}>
                  <summary style={{ cursor: 'pointer' }}>Debug: claves en provisionalDirectorio</summary>
                  <pre style={{ fontSize: 11, background: '#f3f4f6', padding: 8, borderRadius: 6, marginTop: 4, overflow: 'auto' }}>
                    {JSON.stringify(dir, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

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
                    {entry.date ? new Date(entry.date).toLocaleString('es-CL') : ''}
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
