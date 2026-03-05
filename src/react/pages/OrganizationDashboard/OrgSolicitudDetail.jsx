import { useState, useRef } from 'react';
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

const CARGO_MAP = {
  president: 'Presidente/a',
  presidente: 'Presidente/a',
  vicePresident: 'Vicepresidente/a',
  vicepresidente: 'Vicepresidente/a',
  secretary: 'Secretario/a',
  secretario: 'Secretario/a',
  treasurer: 'Tesorero/a',
  tesorero: 'Tesorero/a',
};

function formatName(person) {
  if (!person) return '—';
  const parts = [person.firstName, person.segundoNombre, person.lastName, person.apellidoMaterno].filter(Boolean);
  return parts.join(' ') || '—';
}

export default function OrgSolicitudDetail({ org, onBack, onRefresh }) {
  const addToast = useUiStore(s => s.addToast);
  const [saving, setSaving] = useState(false);
  const [editingCargo, setEditingCargo] = useState(null);
  const fileInputRefs = useRef({});

  const dir = org.provisionalDirectorio || {};
  const members = org.members || [];
  const certs = org.certificatesStep5 || [];

  // Get all cargo entries from provisionalDirectorio
  const cargoEntries = [];
  for (const [key, value] of Object.entries(dir)) {
    if (key === 'additionalMembers') continue;
    if (value && typeof value === 'object' && (value.rut || value.firstName)) {
      cargoEntries.push({ key, label: CARGO_MAP[key] || key, person: value });
    }
  }
  if (dir.additionalMembers?.length) {
    dir.additionalMembers.forEach((m, i) => {
      cargoEntries.push({ key: `additional_${i}`, label: m.cargo || `Director/a ${i + 1}`, person: m });
    });
  }

  function getCertForMember(rut) {
    if (!rut) return null;
    const norm = rut.replace(/\./g, '').replace(/-/g, '');
    return certs.find(c => {
      const cNorm = (c.memberId || '').replace(/\./g, '').replace(/-/g, '');
      return cNorm === norm && c.certificate;
    });
  }

  async function handleChangeCargo(cargoKey, memberIdx) {
    const member = members[memberIdx];
    if (!member) return;
    setSaving(true);
    try {
      const newDir = { ...dir };
      if (cargoKey.startsWith('additional_')) {
        const idx = parseInt(cargoKey.split('_')[1]);
        const updated = [...(newDir.additionalMembers || [])];
        updated[idx] = { ...updated[idx], ...member };
        newDir.additionalMembers = updated;
      } else {
        newDir[cargoKey] = {
          rut: member.rut,
          firstName: member.firstName,
          segundoNombre: member.segundoNombre || '',
          lastName: member.lastName,
          apellidoMaterno: member.apellidoMaterno || '',
        };
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

  function downloadEstatutos() {
    if (!org.estatutos) {
      addToast('No hay estatutos disponibles', 'error');
      return;
    }
    try {
      let base64 = org.estatutos;
      if (base64.includes(',')) base64 = base64.split(',')[1];
      const byteChars = atob(base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Estatutos_${org.organizationName || 'org'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast('Error al descargar estatutos', 'error');
    }
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
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
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
          Detalle de la solicitud de constitución
        </p>
      </div>

      {/* 1. Datos Generales */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Datos Generales</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
          <div><span style={labelStyle}>Tipo de Organización</span><div style={valueStyle}>{(org.organizationType || '').replace(/_/g, ' ')}</div></div>
          <div><span style={labelStyle}>Fecha de Solicitud</span><div style={valueStyle}>{org.createdAt ? new Date(org.createdAt).toLocaleDateString('es-CL') : '—'}</div></div>
          <div><span style={labelStyle}>Dirección</span><div style={valueStyle}>{[org.street, org.streetNumber].filter(Boolean).join(' ') || org.address || '—'}</div></div>
          <div><span style={labelStyle}>Comuna / Región</span><div style={valueStyle}>{[org.comuna, org.region].filter(Boolean).join(', ') || '—'}</div></div>
          <div><span style={labelStyle}>Email de Contacto</span><div style={valueStyle}>{org.contactEmail || '—'}</div></div>
          <div><span style={labelStyle}>Teléfono</span><div style={valueStyle}>{org.contactPhone || '—'}</div></div>
          {org.unidadVecinal && <div><span style={labelStyle}>Unidad Vecinal</span><div style={valueStyle}>{org.unidadVecinal}</div></div>}
          {org.territory && <div><span style={labelStyle}>Territorio</span><div style={valueStyle}>{org.territory}</div></div>}
        </div>
        {org.objectives && (
          <div style={{ marginTop: 12 }}>
            <span style={labelStyle}>Objetivos</span>
            <div style={{ ...valueStyle, fontSize: 13, whiteSpace: 'pre-line', marginTop: 4 }}>{org.objectives}</div>
          </div>
        )}
      </div>

      {/* 2. Asamblea Programada */}
      {(org.electionDate || org.assemblyAddress) && (
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>Asamblea Constitutiva Programada</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 24px' }}>
            {org.electionDate && <div><span style={labelStyle}>Fecha</span><div style={valueStyle}>{new Date(org.electionDate).toLocaleDateString('es-CL')}</div></div>}
            {org.electionTime && <div><span style={labelStyle}>Hora</span><div style={valueStyle}>{org.electionTime}</div></div>}
            {org.assemblyAddress && <div><span style={labelStyle}>Lugar</span><div style={valueStyle}>{org.assemblyAddress}</div></div>}
          </div>
        </div>
      )}

      {/* 3. Miembros */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Miembros ({members.length})</h3>
        {members.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
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

      {/* 4. Directorio Provisorio */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Directorio Provisorio</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {cargoEntries.length > 0 ? cargoEntries.map(({ key, label, person }) => {
            const isEditing = editingCargo === key;
            const cert = getCertForMember(person.rut);
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
            <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>No hay directorio asignado</p>
          )}
        </div>
      </div>

      {/* 5. Estatutos */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Estatutos</h3>
        {org.estatutosSnapshot?.nombreTipo && (
          <div style={{ marginBottom: 10 }}>
            <span style={labelStyle}>Plantilla utilizada</span>
            <div style={valueStyle}>{org.estatutosSnapshot.nombreTipo}</div>
          </div>
        )}
        {org.estatutosSnapshot?.articulos?.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <span style={labelStyle}>Artículos</span>
            <div style={valueStyle}>{org.estatutosSnapshot.articulos.length} artículos</div>
          </div>
        )}
        {org.estatutos ? (
          <button onClick={downloadEstatutos}
            style={{
              padding: '8px 16px', fontSize: 13, borderRadius: 8,
              border: '1px solid #d1d5db', background: 'white', color: '#374151',
              cursor: 'pointer', fontWeight: 500,
            }}>
            Descargar Estatutos (PDF)
          </button>
        ) : (
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Estatutos no disponibles para descarga</p>
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
    </div>
  );
}

const thStyle = { textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' };
const tdStyle = { padding: '8px 10px', color: '#374151' };
