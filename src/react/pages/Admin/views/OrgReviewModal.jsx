import { useState, useEffect } from 'react';
import { useAdminStore } from '../../../stores/adminStore';
import { useMinistrosStore } from '../../../stores/ministrosStore';
import { useUiStore } from '../../../stores/uiStore';
import { apiService } from '@services/ApiService.js';
import Modal from '../../../components/ui/Modal';
import Tabs from '../../../components/ui/Tabs';
import StatusBadge from '../../../components/ui/StatusBadge';
import { formatDate, localeDateString } from '../../../utils/formatters';

const BASE_TABS = [
  { key: 'datos', label: 'Datos' },
  { key: 'asamblea', label: 'Asamblea' },
  { key: 'miembros', label: 'Miembros' },
  { key: 'directorio', label: 'Directorio' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'archivo', label: 'Archivo' },
  { key: 'historial', label: 'Historial' },
];

// Estados post-asamblea donde el flujo FEA es accesible
const FEA_ELIGIBLE_STATUSES = new Set(['ministro_approved', 'sent_registry', 'registry_observations', 'approved']);

const ADMIN_DOC_CATEGORIES = [
  { value: 'CERTIFICADO', label: 'Certificado' },
  { value: 'ACTA_ASAMBLEA', label: 'Acta de Asamblea' },
  { value: 'BALANCE', label: 'Balance' },
  { value: 'INFORME', label: 'Informe' },
  { value: 'CORRESPONDENCIA', label: 'Correspondencia' },
  { value: 'OTRO', label: 'Otro' }
];
const CATEGORY_LABELS = Object.fromEntries(ADMIN_DOC_CATEGORIES.map(c => [c.value, c.label]));

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
  // Corrections basket
  const [correctionItems, setCorrectionItems] = useState([]);
  const [showCorrectionsModal, setShowCorrectionsModal] = useState(false);
  const [correctionsGeneralComment, setCorrectionsGeneralComment] = useState('');
  const [flaggingField, setFlaggingField] = useState(null); // { field, label, tab, currentValue }
  const [flagComment, setFlagComment] = useState('');
  const [scheduleData, setScheduleData] = useState({ ministroId: '', date: '', time: '', location: '' });
  const [isActioning, setIsActioning] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '', reason: '' });
  const [signedPdf, setSignedPdf] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDissolve, setShowDissolve] = useState(false);
  const [dissolveReason, setDissolveReason] = useState('');
  const [orgDocs, setOrgDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showAdminUpload, setShowAdminUpload] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [electionActioning, setElectionActioning] = useState(false);
  const [rejectElectionReason, setRejectElectionReason] = useState('');
  const [showRejectElection, setShowRejectElection] = useState(false);
  const [generatedDocs, setGeneratedDocs] = useState([]);

  const { updateOrgStatus, rejectOrg, requestCorrections, scheduleMinistro, refreshOrganization, approveWithDocument } = useAdminStore();
  const { ministros, fetchMinistros } = useMinistrosStore();
  const addToast = useUiStore(s => s.addToast);

  useEffect(() => {
    fetchMinistros().catch(() => {});
    // Refresh org to get full data (list endpoint excludes members/docs)
    refreshOrganization(initialOrg._id).then(o => { if (o) setOrg(o); }).catch(() => {});
    // Load generated documents (PDFs from wizard Step6)
    apiService.get(`/organizations/${initialOrg._id}/generated-documents`)
      .then(docs => { if (Array.isArray(docs)) setGeneratedDocs(docs); })
      .catch(() => {});
  }, [initialOrg._id]);

  async function loadOrgDocs() {
    setDocsLoading(true);
    try {
      const data = await apiService.get(`/org-documents/${org._id}`);
      setOrgDocs(data.documents || data || []);
    } catch { setOrgDocs([]); }
    finally { setDocsLoading(false); }
  }

  useEffect(() => {
    if (tab === 'archivo') loadOrgDocs();
  }, [tab, org._id]);

  const members = org.members || [];
  const directorio = org.provisionalDirectorio || org.directorio || {};
  const statusHistory = org.statusHistory || [];
  const cargoEntries = buildCargoEntries(directorio);
  const electoralCommission = org.electoralCommission || org.comisionElectoral || [];
  const certs = org.certificatesStep5 || [];

  // Tab "Aprobar" solo visible en estados post-asamblea
  const reviewTabs = FEA_ELIGIBLE_STATUSES.has(org.status)
    ? [...BASE_TABS, { key: 'aprobar', label: 'Aprobar' }]
    : BASE_TABS;

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

  function openEstatutosPreview(snapshot, name, type) {
    const articulos = [...(snapshot.articulos || [])].sort((a, b) => (a.orden || a.numero || 0) - (b.orden || b.numero || 0));
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

  async function handleDissolve() {
    if (!dissolveReason.trim() || dissolveReason.trim().length < 10) {
      addToast('Debe proporcionar una razón de disolución (mínimo 10 caracteres)', 'error');
      return;
    }
    setIsActioning(true);
    try {
      await apiService.dissolveOrganization(org._id, dissolveReason);
      addToast('Organización disuelta', 'success');
      setShowDissolve(false);
      const updated = await refreshOrganization(org._id);
      if (updated) setOrg(updated);
    } catch (err) {
      addToast(err.message || 'Error al disolver', 'error');
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

  function openScheduleModal() {
    setScheduleData({
      ministroId: org.ministroData?.ministroId || '',
      date: org.electionDate ? new Date(org.electionDate).toISOString().split('T')[0] : '',
      time: org.electionTime || '',
      location: org.assemblyAddress || org.ministroData?.location || '',
    });
    setShowSchedule(true);
  }

  async function handleScheduleMinistro() {
    if (!scheduleData.ministroId || !scheduleData.date || !scheduleData.time) {
      addToast('Completa ministro, fecha y hora', 'error');
      return;
    }
    const selectedMinistro = activeMinistros.find(m => m._id === scheduleData.ministroId);
    setIsActioning(true);
    try {
      await scheduleMinistro(org._id, {
        ministroId: scheduleData.ministroId,
        ministroName: selectedMinistro ? `${selectedMinistro.firstName} ${selectedMinistro.lastName}` : '',
        ministroRut: selectedMinistro?.rut || '',
        scheduledDate: scheduleData.date,
        scheduledTime: scheduleData.time,
        location: scheduleData.location || '',
      });
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

  // Corrections basket helpers
  const isFieldFlagged = (field) => correctionItems.some(c => c.field === field);
  function flagField(field, label, tab, currentValue) {
    if (isFieldFlagged(field)) return;
    setFlaggingField({ field, label, tab, currentValue: String(currentValue || '') });
    setFlagComment('');
  }
  function confirmFlag() {
    if (!flaggingField) return;
    setCorrectionItems(prev => [...prev, {
      field: flaggingField.field,
      label: flaggingField.label,
      tab: flaggingField.tab,
      currentValue: flaggingField.currentValue,
      category: flaggingField.tab === 'miembros' ? 'miembros' : flaggingField.tab === 'directorio' ? 'directorio' : 'datos_generales',
      message: flagComment.trim() || 'Requiere corrección',
    }]);
    setFlaggingField(null);
    setFlagComment('');
  }
  function removeFlagItem(field) {
    setCorrectionItems(prev => prev.filter(c => c.field !== field));
  }

  async function submitCorrections() {
    if (correctionItems.length === 0) {
      addToast('Selecciona al menos un campo para corregir', 'error');
      return;
    }
    setIsActioning(true);
    try {
      await requestCorrections(org._id, correctionItems, correctionsGeneralComment);
      addToast(`Correcciones enviadas (${correctionItems.length} campos)`, 'success');
      setShowCorrectionsModal(false);
      setCorrectionItems([]);
      setCorrectionsGeneralComment('');
      onClose();
    } catch (err) {
      addToast(err.message || 'Error al enviar correcciones', 'error');
    } finally {
      setIsActioning(false);
    }
  }

  // Reusable flag button for clickable fields
  const canRequestCorrections = ['waiting_ministro', 'pending_review', 'in_review'].includes(org.status);
  function FlagBtn({ field, label, tab, value }) {
    if (!canRequestCorrections) return null;
    const flagged = isFieldFlagged(field);
    return (
      <button
        onClick={(e) => { e.stopPropagation(); flagged ? removeFlagItem(field) : flagField(field, label, tab, value); }}
        title={flagged ? 'Quitar de correcciones' : 'Marcar para corregir'}
        style={{
          padding: '2px 6px', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer',
          background: flagged ? '#fecaca' : 'transparent', color: flagged ? '#dc2626' : '#9ca3af',
          marginLeft: 4, flexShrink: 0, transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!flagged) { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.color = '#f59e0b'; } }}
        onMouseLeave={e => { if (!flagged) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; } }}
      >{flagged ? '- Quitar' : '+ Observar'}</button>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="r-section" style={{
        background: 'white', borderRadius: 16, width: '95%', maxWidth: 900,
        maxHeight: '95vh', height: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div className="r-toolbar" style={{
          padding: '20px 24px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <h2 className="r-page-title" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>
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
          <Tabs tabs={reviewTabs} activeTab={tab} onChange={setTab} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {/* Electoral Validation Alert */}
          {org.boardStatus === 'PENDIENTE_VALIDACION' && org.pendingElectoralBoard && (
            <div style={{ background: '#f5f3ff', border: '2px solid #c4b5fd', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 24 }}>🗳️</span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#5b21b6' }}>
                  Nueva Directiva Pendiente de Validación
                </h3>
              </div>
              <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Presidente/a', data: org.pendingElectoralBoard.president },
                  { label: 'Secretario/a', data: org.pendingElectoralBoard.secretary },
                  { label: 'Tesorero/a', data: org.pendingElectoralBoard.treasurer },
                ].filter(c => c.data?.rut).map(({ label, data }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'white', borderRadius: 8, flexWrap: 'wrap', gap: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#5b21b6' }}>{label}</span>
                    <span style={{ fontSize: 13, color: '#374151' }}>{data.firstName} {data.lastName} — {data.rut}</span>
                  </div>
                ))}
              </div>
              {org.electionActDocument?.fileName && (
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                  Acta de elección: <strong>{org.electionActDocument.fileName}</strong>
                  {org.electionActDocument.uploadedAt && ` (${new Date(org.electionActDocument.uploadedAt).toLocaleDateString('es-CL')})`}
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  disabled={electionActioning}
                  onClick={async () => {
                    setElectionActioning(true);
                    try {
                      await apiService.post(`/organizations/${org._id}/elections/approve`);
                      addToast('Directiva aprobada. Mandato vigente por 3 años.', 'success');
                      const updated = await refreshOrganization(org._id);
                      if (updated) setOrg(updated);
                    } catch (err) { addToast(err.message || 'Error al aprobar', 'error'); }
                    finally { setElectionActioning(false); }
                  }}
                  style={{
                    padding: '10px 24px', border: 'none', borderRadius: 8,
                    background: '#059669', color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: electionActioning ? 'not-allowed' : 'pointer',
                    opacity: electionActioning ? 0.6 : 1
                  }}
                >
                  {electionActioning ? 'Procesando...' : 'Aprobar Nueva Directiva'}
                </button>
                <button
                  onClick={() => setShowRejectElection(true)}
                  style={{
                    padding: '10px 24px', border: '1px solid #ef4444', borderRadius: 8,
                    background: 'white', color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Rechazar
                </button>
              </div>
              {showRejectElection && (
                <div style={{ marginTop: 12, padding: 16, background: '#fef2f2', borderRadius: 8, border: '1px solid #fca5a5' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#991b1b', marginBottom: 6 }}>Motivo del rechazo (opcional):</label>
                  <textarea value={rejectElectionReason} onChange={(e) => setRejectElectionReason(e.target.value)}
                    placeholder="Indique el motivo..." rows={2}
                    style={{ width: '100%', padding: 10, border: '1px solid #fca5a5', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => setShowRejectElection(false)}
                      style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
                      Cancelar
                    </button>
                    <button
                      disabled={electionActioning}
                      onClick={async () => {
                        setElectionActioning(true);
                        try {
                          await apiService.post(`/organizations/${org._id}/elections/reject`, { reason: rejectElectionReason });
                          addToast('Directiva rechazada. La organización vuelve a proceso electoral.', 'success');
                          setShowRejectElection(false);
                          setRejectElectionReason('');
                          const updated = await refreshOrganization(org._id);
                          if (updated) setOrg(updated);
                        } catch (err) { addToast(err.message || 'Error al rechazar', 'error'); }
                        finally { setElectionActioning(false); }
                      }}
                      style={{
                        padding: '6px 14px', border: 'none', borderRadius: 6,
                        background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      Confirmar Rechazo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'datos' && (
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                ['Nombre', orgName, 'organizationName'],
                ['Tipo', orgType, 'organizationType'],
                ['Dirección', [org.street, org.streetNumber].filter(Boolean).join(' ') || org.address, 'address'],
                ['Comuna / Región', [org.comuna, org.region].filter(Boolean).join(', '), null],
                ['Email de Contacto', org.contactEmail || org.email, 'contactEmail'],
                ['Teléfono', org.contactPhone || org.phone, 'contactPhone'],
                ['Unidad Vecinal', org.unidadVecinal, 'unidadVecinal'],
                ['Territorio', org.territory, 'territory'],
                ['Creada', formatDate(org.createdAt), null],
              ].filter(([, value]) => value).map(([label, value, field]) => (
                <div key={label} style={{
                  display: 'flex', gap: 12, alignItems: 'center',
                  background: field && isFieldFlagged(field) ? '#fef2f2' : 'transparent',
                  padding: field && isFieldFlagged(field) ? '4px 8px' : 0, borderRadius: 6,
                }}>
                  <span style={{ fontWeight: 600, color: '#374151', minWidth: 140, fontSize: 14 }}>{label}:</span>
                  <span style={{ color: '#6b7280', fontSize: 14, flex: 1 }}>{value}</span>
                  {field && <FlagBtn field={field} label={label} tab="datos" value={value} />}
                </div>
              ))}
              {org.objectives && (
                <div style={{
                  marginTop: 8, padding: isFieldFlagged('objectives') ? '8px 12px' : 0,
                  background: isFieldFlagged('objectives') ? '#fef2f2' : 'transparent', borderRadius: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: '#374151', fontSize: 14 }}>Objetivos:</span>
                    <FlagBtn field="objectives" label="Objetivos de la organización" tab="datos" value={org.objectives} />
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, color: '#6b7280', fontSize: 13, lineHeight: 1.8 }}>
                    {org.objectives.split('\n').filter(Boolean).map((obj, i) => (
                      <li key={i}>{obj}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Configuración Administrativa */}
              {org.config && (
                <div style={{ marginTop: 16, padding: 16, background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#111827' }}>Configuración Administrativa</h4>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {(() => {
                      const c = org.config;
                      const moneda = c.monedaCuota || 'UTM';
                      const prefix = moneda === 'CLP' ? '$' : '';
                      const suffix = moneda !== 'CLP' ? ` ${moneda}` : '';
                      const CITACION = {
                        carta_certificada: 'Carta certificada',
                        correo_electronico: 'Correo electrónico',
                        mensajeria_instantanea: 'Mensajería instantánea',
                        entrega_personal: 'Entrega personal',
                      };
                      const rows = [
                        ['Cuota mensual', c.cuotaMin != null && c.cuotaMax != null ? `${prefix}${c.cuotaMin}${suffix} — ${prefix}${c.cuotaMax}${suffix}` : null, 'config.cuotaMin'],
                        ['Cuota incorporación', c.cuotaIncorporacion != null ? `${prefix}${c.cuotaIncorporacion}${suffix}` : null, 'config.cuotaIncorporacion'],
                        ['Duración mandato', c.duracionMandato ? `${c.duracionMandato} ${c.duracionMandato === 1 ? 'año' : 'años'}` : null, 'config.duracionMandato'],
                        ['Método de citación', CITACION[c.metodoCitacion] || c.metodoCitacion, 'config.metodoCitacion'],
                        ['Días de anticipación', c.diasAnticipacion ? `${c.diasAnticipacion} días` : null, 'config.diasAnticipacion'],
                        ['Asambleas ordinarias', (c.asambleas || []).length > 0 ? c.asambleas.join(', ') : null, 'config.asambleas'],
                        ['Mes balance anual', c.accountReviewMonth, 'config.accountReviewMonth'],
                        ['Entidad disolución', c.beneficiarioDisolucion ? `${c.beneficiarioDisolucion}${c.rutDisolucion ? ` (RUT: ${c.rutDisolucion})` : ''}` : null, 'config.beneficiarioDisolucion'],
                      ].filter(([, v]) => v);
                      return rows.map(([label, value, field]) => (
                        <div key={label} style={{
                          display: 'flex', gap: 12, alignItems: 'center',
                          background: field && isFieldFlagged(field) ? '#fef2f2' : 'transparent',
                          padding: field && isFieldFlagged(field) ? '4px 8px' : 0, borderRadius: 6,
                        }}>
                          <span style={{ fontWeight: 600, color: '#374151', minWidth: 160, fontSize: 13 }}>{label}:</span>
                          <span style={{ color: '#6b7280', fontSize: 13, flex: 1 }}>{value}</span>
                          {field && <FlagBtn field={field} label={label} tab="datos" value={value} />}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'asamblea' && (
            <div style={{ display: 'grid', gap: 20 }}>
              {/* Sección 1: Solicitud del dirigente social */}
              <div style={{ padding: 16, background: '#f0f9ff', borderRadius: 10, border: '1px solid #bae6fd' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#0369a1' }}>
                  Solicitud del Dirigente Social
                </h4>
                {(org.electionDate || org.electionTime || org.assemblyAddress) ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {org.electionDate && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ fontWeight: 600, color: '#374151', minWidth: 120, fontSize: 13 }}>Fecha solicitada:</span>
                        <span style={{ fontSize: 13, color: '#111827' }}>{localeDateString(org.electionDate)}</span>
                      </div>
                    )}
                    {org.electionTime && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ fontWeight: 600, color: '#374151', minWidth: 120, fontSize: 13 }}>Hora solicitada:</span>
                        <span style={{ fontSize: 13, color: '#111827' }}>{org.electionTime}</span>
                      </div>
                    )}
                    {org.assemblyAddress && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ fontWeight: 600, color: '#374151', minWidth: 120, fontSize: 13 }}>Lugar solicitado:</span>
                        <span style={{ fontSize: 13, color: '#111827' }}>{org.assemblyAddress}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                    El dirigente social no especificó fecha, hora o lugar para la asamblea.
                  </p>
                )}
              </div>

              {/* Sección 2: Agenda confirmada */}
              {org.ministroData?.scheduledDate ? (
                <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                  <div className="r-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#166534' }}>
                      Agenda Confirmada
                    </h4>
                    {org.appointmentWasModified && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: '#d97706', background: '#fef3c7',
                        padding: '3px 10px', borderRadius: 6,
                      }}>
                        Modificado
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span style={{ fontWeight: 600, color: '#374151', minWidth: 120, fontSize: 13 }}>Ministro:</span>
                      <span style={{ fontSize: 13, color: '#111827' }}>{org.ministroData.name || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span style={{ fontWeight: 600, color: '#374151', minWidth: 120, fontSize: 13 }}>Fecha:</span>
                      <span style={{ fontSize: 13, color: '#111827' }}>
                        {localeDateString(org.ministroData.scheduledDate)}
                        {(() => {
                          const reqDate = org.electionDate ? new Date(org.electionDate).toISOString().split('T')[0] : null;
                          const confDate = new Date(org.ministroData.scheduledDate).toISOString().split('T')[0];
                          return reqDate && reqDate !== confDate
                            ? <span style={{ color: '#d97706', fontSize: 11, marginLeft: 6 }}>(distinta a solicitud)</span>
                            : null;
                        })()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span style={{ fontWeight: 600, color: '#374151', minWidth: 120, fontSize: 13 }}>Hora:</span>
                      <span style={{ fontSize: 13, color: '#111827' }}>
                        {org.ministroData.scheduledTime || '—'}
                        {org.electionTime && org.ministroData.scheduledTime !== org.electionTime
                          ? <span style={{ color: '#d97706', fontSize: 11, marginLeft: 6 }}>(distinta a solicitud)</span>
                          : null}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span style={{ fontWeight: 600, color: '#374151', minWidth: 120, fontSize: 13 }}>Lugar:</span>
                      <span style={{ fontSize: 13, color: '#111827' }}>
                        {org.ministroData.location || org.assemblyAddress || '—'}
                      </span>
                    </div>
                  </div>
                  {(org.status === 'ministro_scheduled' || org.status === 'waiting_ministro') && (
                    <button onClick={() => {
                      const d = org.ministroData.scheduledDate ? new Date(org.ministroData.scheduledDate).toISOString().split('T')[0] : '';
                      setRescheduleData({ date: d, time: org.ministroData.scheduledTime || '', reason: '' });
                      setShowReschedule(true);
                    }} style={{
                      marginTop: 12, padding: '8px 16px', border: '1px solid #f59e0b', borderRadius: 8,
                      background: '#fffbeb', color: '#92400e', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {'\uD83D\uDCC5'} Reprogramar Fecha/Hora
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ padding: 16, background: '#fafafa', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#374151' }}>
                    Agenda Confirmada
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
                    Aún no se ha agendado un Ministro de Fe.
                  </p>
                </div>
              )}

              {/* Sección 3: Historial de cambios */}
              {org.appointmentChanges?.length > 0 && (
                <div style={{ padding: 16, background: '#fefce8', borderRadius: 10, border: '1px solid #fde68a' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#92400e' }}>
                    Historial de Cambios ({org.appointmentChanges.length})
                  </h4>
                  {org.appointmentChanges.map((change, i) => (
                    <div key={i} style={{
                      padding: 10, borderLeft: '3px solid #f59e0b', marginBottom: 8,
                      background: 'white', borderRadius: '0 8px 8px 0',
                    }}>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                        {formatDate(change.changedAt)}
                      </div>
                      <div style={{ fontSize: 12, color: '#374151' }}>
                        {change.previousData?.scheduledDate && (
                          <div>Fecha anterior: {localeDateString(change.previousData.scheduledDate)} {change.previousData.scheduledTime || ''}</div>
                        )}
                        {change.newData?.scheduledDate && (
                          <div>Nueva fecha: {localeDateString(change.newData.scheduledDate)} {change.newData.scheduledTime || ''}</div>
                        )}
                        {change.previousData?.location !== change.newData?.location && change.newData?.location && (
                          <div>Nuevo lugar: {change.newData.location}</div>
                        )}
                      </div>
                    </div>
                  ))}
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
              <div className="r-table-wrap" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['N°', 'Nombre', 'RUT', 'F. Nacimiento', 'Edad', 'Domicilio', 'Email', 'Teléfono', ...(canRequestCorrections ? [''] : [])].map((h, hi) => (
                        <th key={hi} className={h === 'Email' || h === 'Teléfono' || h === 'F. Nacimiento' ? 'r-hide-mobile' : undefined} style={{
                          padding: '8px 10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb',
                          fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap'
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
                          <td style={{ padding: '8px 10px', fontSize: 13 }}>{formatName(m)}</td>
                          <td style={{ padding: '8px 10px', fontSize: 13, color: '#6b7280' }}>{m.rut || '—'}</td>
                          <td className="r-hide-mobile" style={{ padding: '8px 10px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
                            {m.birthDate ? new Date(m.birthDate).toLocaleDateString('es-CL') : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: 13 }}>
                            {age !== null ? (
                              <span style={{
                                color: isMinor ? '#d97706' : '#374151',
                                fontWeight: isMinor ? 600 : 400, whiteSpace: 'nowrap',
                              }}>
                                {age}{isMinor ? ' (menor)' : ''}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#6b7280', maxWidth: 180 }}>{m.address || '—'}</td>
                          <td className="r-hide-mobile" style={{ padding: '8px 10px', fontSize: 13, color: '#6b7280' }}>{m.email || '—'}</td>
                          <td className="r-hide-mobile" style={{ padding: '8px 10px', fontSize: 13, color: '#6b7280' }}>{m.phone || '—'}</td>
                          {canRequestCorrections && (
                            <td style={{ padding: '4px 6px' }}>
                              <FlagBtn field={`members.${i}`} label={`Miembro: ${formatName(m)} (${m.rut})`} tab="miembros" value={formatName(m)} />
                            </td>
                          )}
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
                // Cross-reference birthDate from members array if not on person directly
                const birthDate = person.birthDate || (() => {
                  if (!person.rut) return null;
                  const normRut = person.rut.replace(/\./g, '').replace(/-/g, '');
                  const match = members.find(m => m.rut && m.rut.replace(/\./g, '').replace(/-/g, '') === normRut);
                  return match?.birthDate || null;
                })();
                const age = calculateAge(birthDate);
                const isMinor = age !== null && age < 18;
                return (
                  <div key={key} style={{
                    padding: 14, borderRadius: 10, gap: 8,
                    border: isFieldFlagged(`provisionalDirectorio.${key}`) ? '2px solid #fca5a5' : '1px solid #e5e7eb',
                    background: isFieldFlagged(`provisionalDirectorio.${key}`) ? '#fef2f2' : '#fafafa',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', marginBottom: 2, display: 'flex', alignItems: 'center' }}>
                        {label}
                        <FlagBtn field={`provisionalDirectorio.${key}`} label={`${label}: ${formatName(person)}`} tab="directorio" value={`${formatName(person)} — ${person.rut}`} />
                      </div>
                      <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>
                        {formatName(person)} — {person.rut || '—'}
                      </div>
                      {age !== null && (
                        <div style={{ fontSize: 12, color: isMinor ? '#d97706' : '#6b7280', fontWeight: isMinor ? 600 : 400, marginTop: 2 }}>
                          Edad: {age} años{isMinor ? ' (menor de edad)' : ''}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                      {person.inhabilityCertificate ? (
                        <button
                          onClick={() => downloadBase64(person.inhabilityCertificate, `Inhabilidades_${formatName(person)}.pdf`)}
                          style={{
                            fontSize: 11, fontWeight: 600, color: '#7c3aed', background: '#ede9fe',
                            padding: '4px 10px', borderRadius: 6, border: '1px solid #c4b5fd',
                            cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                          Ver Inhabilidades
                        </button>
                      ) : null}
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
                  {electoralCommission.map((m, i) => {
                    const bd = m.birthDate || (() => {
                      if (!m.rut) return null;
                      const normRut = m.rut.replace(/\./g, '').replace(/-/g, '');
                      const match = members.find(mb => mb.rut && mb.rut.replace(/\./g, '').replace(/-/g, '') === normRut);
                      return match?.birthDate || null;
                    })();
                    const comAge = calculateAge(bd);
                    const comMinor = comAge !== null && comAge < 18;
                    const comField = `electoralCommission.${i}`;
                    return (
                      <div key={m.rut || i} style={{
                        padding: 12, borderRadius: 8,
                        border: isFieldFlagged(comField) ? '2px solid #fca5a5' : '1px solid #e5e7eb',
                        background: isFieldFlagged(comField) ? '#fef2f2' : comMinor ? '#fef3c7' : '#f0f9ff',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                      }}>
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{formatName(m)}</span>
                          <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 8 }}>{m.rut || ''}</span>
                          {comAge !== null && (
                            <span style={{ fontSize: 12, color: comMinor ? '#d97706' : '#6b7280', marginLeft: 8, fontWeight: comMinor ? 600 : 400 }}>
                              ({comAge} años{comMinor ? ' - menor' : ''})
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, background: '#dbeafe', padding: '3px 8px', borderRadius: 4 }}>
                            Miembro {i + 1}
                          </span>
                          <FlagBtn field={comField} label={`Comisión Electoral: ${formatName(m)} (${m.rut})`} tab="directorio" value={`${formatName(m)} — ${m.rut}`} />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {tab === 'documentos' && (
            <div>
              {/* Documentos Generados (PDFs del wizard) */}
              <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#111827' }}>
                Documentos Generados ({generatedDocs.length})
              </h4>
              {generatedDocs.length > 0 ? (
                <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
                  {(() => {
                    const DOC_LABELS = {
                      acta_constitutiva: 'Acta Constitutiva',
                      lista_socios: 'Lista de Socios Fundadores',
                      nomina_directorio: 'Nómina del Directorio',
                      carta_solicitud: 'Carta de Solicitud',
                      declaracion_jurada: 'Declaración Jurada',
                    };
                    return generatedDocs.map((doc, i) => {
                      const docField = `generatedDoc.${doc.docType || i}`;
                      const docLabel = DOC_LABELS[doc.docType] || doc.docType?.replace(/_/g, ' ') || 'Documento';
                      return (
                        <div key={i} style={{
                          padding: 12, borderRadius: 8,
                          border: isFieldFlagged(docField) ? '2px solid #fca5a5' : '1px solid #e5e7eb',
                          background: isFieldFlagged(docField) ? '#fef2f2' : '#f9fafb',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{docLabel}</div>
                              {doc.generatedAt && (
                                <div style={{ fontSize: 11, color: '#9ca3af' }}>Generado: {localeDateString(doc.generatedAt)}</div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button onClick={() => {
                              if (!doc.content) return;
                              if (doc.content.startsWith('data:application/pdf')) {
                                try {
                                  const base64 = doc.content.split(',')[1] || doc.content.split('base64,')[1];
                                  const byteChars = atob(base64);
                                  const byteArray = new Uint8Array(byteChars.length);
                                  for (let j = 0; j < byteChars.length; j++) byteArray[j] = byteChars.charCodeAt(j);
                                  const blob = new Blob([byteArray], { type: 'application/pdf' });
                                  window.open(URL.createObjectURL(blob), '_blank');
                                } catch { window.open(doc.content, '_blank'); }
                              } else {
                                const w = window.open('', '_blank');
                                if (w) { w.document.write(doc.content); w.document.close(); }
                              }
                            }} style={{
                              padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                              border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', cursor: 'pointer',
                            }}>Ver</button>
                            {doc.content?.startsWith('data:application/pdf') && (
                              <button onClick={() => downloadBase64(doc.content, `${docLabel}_${orgName.replace(/\s+/g, '_')}.pdf`)} style={{
                                padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                                border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: 'pointer',
                              }}>Descargar</button>
                            )}
                            <FlagBtn field={docField} label={`Documento: ${docLabel}`} tab="documentos" value="PDF generado" />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div style={{ padding: 12, background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 20, fontSize: 13, color: '#92400e' }}>
                  No se encontraron documentos generados. Es posible que la organización fue creada antes de la implementación del sistema de plantillas.
                </div>
              )}

              {/* Estatutos (compilados — leer desde estatutosGeneratedText si existe, sino snapshot) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 0 10px' }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>Estatutos</h4>
                <FlagBtn field="estatutos" label="Estatutos de la organización" tab="documentos" value="Documento de estatutos" />
              </div>
              {org.estatutosGeneratedText ? (
                <div style={{
                  marginBottom: 16,
                  border: isFieldFlagged('estatutos') ? '2px solid #fca5a5' : 'none',
                  borderRadius: 8,
                }}>
                  <div style={{
                    padding: 14, border: isFieldFlagged('estatutos') ? 'none' : '1px solid #e5e7eb', borderRadius: 8,
                    background: isFieldFlagged('estatutos') ? '#fef2f2' : '#fafafa',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Estatutos compilados (con datos reales)</span>
                    <button onClick={() => {
                      const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Estatutos - ${orgName}</title>
<style>body{font-family:Georgia,serif;max-width:750px;margin:40px auto;padding:0 20px;color:#1a1a1a;line-height:1.7}
h1{text-align:center;font-size:22px;margin-bottom:4px}h2{text-align:center;font-size:15px;color:#555;font-weight:400;margin-top:0}
@media print{body{margin:20px}}</style></head><body>
<h1>ESTATUTOS</h1><h2>${orgName} — ${orgType}</h2><hr style="margin:20px 0">
<div style="white-space:pre-line;font-size:13px">${org.estatutosGeneratedText}</div></body></html>`], { type: 'text/html;charset=utf-8' });
                      window.open(URL.createObjectURL(blob), '_blank');
                    }} style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                      border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', cursor: 'pointer',
                    }}>Ver / Imprimir</button>
                  </div>
                </div>
              ) : org.estatutosSnapshot?.articulos?.length > 0 ? (
                <div style={{ marginBottom: 16 }}>
                  <div className="r-toolbar" style={{
                    padding: 14, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 10,
                    background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Plantilla: </span>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>{org.estatutosSnapshot.nombreTipo || 'Sin nombre'}</span>
                      <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>({org.estatutosSnapshot.articulos.length} artículos)</span>
                    </div>
                    <button
                      onClick={() => openEstatutosPreview(org.estatutosSnapshot, orgName, orgType)}
                      style={{
                        padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                        border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb',
                        cursor: 'pointer',
                      }}
                    >
                      Ver / Imprimir
                    </button>
                  </div>
                  <div style={{
                    maxHeight: 300, overflowY: 'auto', border: '1px solid #e5e7eb',
                    borderRadius: 8, padding: 16, background: 'white',
                  }}>
                    {[...org.estatutosSnapshot.articulos]
                      .sort((a, b) => (a.orden || a.numero || 0) - (b.orden || b.numero || 0))
                      .map((art, i) => (
                        <div key={i} style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 3 }}>
                            Artículo {art.numero}: {art.titulo}
                          </div>
                          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                            {art.contenido}
                          </div>
                        </div>
                      ))}
                  </div>
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
                const certField = `cert.${(person.rut || key).replace(/\./g, '').replace(/-/g, '')}.antecedentes`;
                return (
                  <div key={key} style={{
                    padding: 12, borderRadius: 8, marginBottom: 8,
                    border: isFieldFlagged(certField) ? '2px solid #fca5a5' : '1px solid #e5e7eb',
                    background: isFieldFlagged(certField) ? '#fef2f2' : 'white',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                  }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}: </span>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>{formatName(person)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                      <FlagBtn
                        field={certField}
                        label={`Certificado Antecedentes: ${formatName(person)} (${label})`}
                        tab="documentos"
                        value={cert ? 'Archivo cargado' : 'No cargado'}
                      />
                    </div>
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
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                    }}>
                      <span style={{ fontSize: 14 }}>{doc.name || doc.type || `Documento ${i + 1}`}</span>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(doc.uploadedAt)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {tab === 'aprobar' && (
            <div style={{ display: 'grid', gap: 20 }}>
              {/* Info banner */}
              <div style={{
                padding: 16, background: '#eff6ff', borderRadius: 10,
                border: '1px solid #bfdbfe', display: 'flex', gap: 12, alignItems: 'flex-start'
              }}>
                <span style={{ fontSize: 20 }}>&#x1f512;</span>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#1e40af' }}>
                    Flujo de Firma Electrónica Avanzada (Ley 19.799)
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                    1. Descarga el borrador del certificado.<br />
                    2. Firma el PDF con tu Firma Electrónica Avanzada (FEA) usando tu software de firma.<br />
                    3. Sube el PDF firmado y aprueba la organizacion.
                  </p>
                </div>
              </div>

              {/* Step A: Download draft */}
              <div style={{
                padding: 20, background: 'white', border: '1px solid #e5e7eb',
                borderRadius: 12
              }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: '#111827' }}>
                  Paso 1: Descargar Borrador de Certificado
                </h4>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
                  Genera el PDF con los datos de la organizacion, sin firma. Firmalo con tu FEA antes de subirlo.
                </p>
                <button
                  onClick={async () => {
                    try {
                      const resp = await fetch(
                        `${apiService.baseUrl}/documents/${org._id}/generate-certificado-borrador`,
                        { headers: apiService.getHeaders(), credentials: 'include' }
                      );
                      if (!resp.ok) {
                        const errData = await resp.json().catch(() => ({}));
                        throw new Error(errData.error || 'Error al generar borrador');
                      }
                      const blob = await resp.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Borrador_Certificado_${orgName.replace(/\s+/g, '_')}.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                      addToast('Borrador descargado', 'success');
                    } catch (err) {
                      addToast(err.message, 'error');
                    }
                  }}
                  style={{
                    padding: '10px 20px', border: '1px solid #2563eb', borderRadius: 8,
                    background: '#eff6ff', color: '#2563eb', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Descargar Borrador PDF
                </button>
              </div>

              {/* Step B: Upload signed PDF */}
              <div
                style={{
                  padding: 20, background: isDragging ? '#f0fdf4' : 'white',
                  border: `2px dashed ${isDragging ? '#22c55e' : signedPdf ? '#10b981' : '#d1d5db'}`,
                  borderRadius: 12, textAlign: 'center', transition: 'all 0.2s'
                }}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file?.type === 'application/pdf') {
                    setSignedPdf(file);
                    addToast('PDF cargado', 'success');
                  } else {
                    addToast('Solo se permiten archivos PDF', 'error');
                  }
                }}
              >
                <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: '#111827' }}>
                  Paso 2: Subir Certificado Firmado con FEA
                </h4>
                {signedPdf ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                    <span style={{ fontSize: 14, color: '#059669', fontWeight: 600 }}>
                      {signedPdf.name} ({(signedPdf.size / 1024).toFixed(0)} KB)
                    </span>
                    <button
                      onClick={() => setSignedPdf(null)}
                      style={{
                        padding: '4px 12px', border: '1px solid #ef4444', borderRadius: 6,
                        background: 'white', color: '#ef4444', fontSize: 12, cursor: 'pointer'
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <>
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
                      Arrastra el PDF firmado aqui o haz clic para seleccionarlo
                    </p>
                    <label style={{
                      display: 'inline-block', padding: '10px 24px', border: '1px solid #d1d5db',
                      borderRadius: 8, background: '#f9fafb', color: '#374151', fontSize: 14,
                      fontWeight: 500, cursor: 'pointer'
                    }}>
                      Seleccionar PDF
                      <input
                        type="file"
                        accept=".pdf"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files[0];
                          if (file) {
                            setSignedPdf(file);
                            addToast('PDF cargado', 'success');
                          }
                        }}
                      />
                    </label>
                  </>
                )}
              </div>

              {/* Step C: Approve */}
              <div style={{
                padding: 20, background: signedPdf ? '#f0fdf4' : '#f9fafb',
                border: `1px solid ${signedPdf ? '#bbf7d0' : '#e5e7eb'}`,
                borderRadius: 12
              }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: '#111827' }}>
                  Paso 3: Aprobar Organizacion
                </h4>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
                  Al aprobar se realizara automaticamente:
                </p>
                <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
                  <li>Se guardara el certificado FEA firmado</li>
                  <li>Se crearan cuentas para los socios con email de activacion</li>
                  <li>Se enviara al dirigente el certificado firmado por correo</li>
                  <li>El estado pasara a <strong>Aprobada</strong></li>
                </ul>
                <button
                  disabled={!signedPdf || isActioning}
                  onClick={async () => {
                    if (!signedPdf) return;
                    setIsActioning(true);
                    try {
                      const result = await approveWithDocument(org._id, signedPdf);
                      const data = result?.data || {};
                      const created = data.accountsCreated || 0;
                      const sent = data.activationsSent || 0;
                      addToast(
                        `Organizacion aprobada. ${created} cuentas creadas${sent > 0 ? `, ${sent} emails de activacion enviados` : ''}. Certificado enviado al dirigente.`,
                        'success'
                      );
                      onClose();
                    } catch (err) {
                      addToast(err.message, 'error');
                    } finally {
                      setIsActioning(false);
                    }
                  }}
                  style={{
                    padding: '12px 28px', border: 'none', borderRadius: 8,
                    background: signedPdf ? '#10b981' : '#d1d5db',
                    color: 'white', fontSize: 15, fontWeight: 700,
                    cursor: signedPdf ? 'pointer' : 'not-allowed',
                    opacity: isActioning ? 0.6 : 1
                  }}
                >
                  {isActioning ? 'Aprobando...' : 'Confirmar Aprobacion con FEA'}
                </button>
              </div>

              {/* Already approved */}
              {org.certificadoPersonalidadJuridica?.fileName && (
                <div style={{
                  padding: 16, background: '#f0fdf4', borderRadius: 10,
                  border: '1px solid #bbf7d0'
                }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#166534' }}>
                    Certificado ya cargado
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>
                    {org.certificadoPersonalidadJuridica.fileName} — subido el{' '}
                    {formatDate(org.certificadoPersonalidadJuridica.uploadedAt)}
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === 'archivo' && (
            <div>
              <div className="r-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>
                  Archivo Documental
                </h4>
                <button onClick={() => setShowAdminUpload(true)} style={actionBtn('#065f46')}>
                  Subir Documento Oficial
                </button>
              </div>

              {docsLoading ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: 24 }}>Cargando documentos...</p>
              ) : orgDocs.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: 24 }}>No hay documentos en el archivo</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {orgDocs.map(doc => (
                    <div key={doc._id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', background: doc.isOfficial ? '#f0fdf4' : '#fff',
                      border: `1px solid ${doc.isOfficial ? '#bbf7d0' : '#e5e7eb'}`, borderRadius: 8,
                      flexWrap: 'wrap', gap: 8
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: 18 }}>{doc.isOfficial ? '📜' : '📄'}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: 14, color: '#111827' }}>{doc.name}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                            {doc.isOfficial && (
                              <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 8, background: '#065f46', color: '#fff', fontWeight: 600 }}>Oficial</span>
                            )}
                            <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 8, background: '#f3f4f6', color: '#374151' }}>
                              {CATEGORY_LABELS[doc.category] || doc.category}
                            </span>
                            {doc.uploadedBy && (
                              <span style={{ fontSize: 10, color: '#6b7280' }}>
                                por {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                              </span>
                            )}
                            {doc.createdAt && <span style={{ fontSize: 10, color: '#9ca3af' }}>{localeDateString(doc.createdAt)}</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {doc.mimeType && ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/jpg'].includes(doc.mimeType) && (
                          <button onClick={async () => {
                            setPreviewDoc(doc);
                            setPreviewUrl(null);
                            setPreviewLoading(true);
                            try {
                              const resp = await fetch(`${apiService.baseUrl}/org-documents/${org._id}/${doc._id}/preview`, {
                                credentials: 'include',
                                headers: { 'X-Requested-With': 'XMLHttpRequest', ...(apiService._authToken && { Authorization: `Bearer ${apiService._authToken}` }) }
                              });
                              if (!resp.ok) throw new Error('Error');
                              const ct = resp.headers.get('content-type') || '';
                              if (ct.includes('application/json')) {
                                const data = await resp.json();
                                setPreviewUrl(data.url);
                              } else {
                                const blob = await resp.blob();
                                setPreviewUrl(URL.createObjectURL(blob));
                              }
                            } catch { addToast('Error al previsualizar', 'error'); setPreviewDoc(null); }
                            finally { setPreviewLoading(false); }
                          }}
                            style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #93c5fd', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#2563eb', fontWeight: 500 }}>
                            {doc.mimeType === 'application/pdf' ? 'Ver PDF' : 'Ver'}
                          </button>
                        )}
                        <button onClick={async () => {
                          try {
                            const response = await fetch(`${apiService.baseUrl}/org-documents/${org._id}/${doc._id}/download`, {
                              credentials: 'include',
                              headers: { 'X-Requested-With': 'XMLHttpRequest', ...(apiService._authToken && { Authorization: `Bearer ${apiService._authToken}` }) }
                            });
                            if (!response.ok) throw new Error('Error');
                            const blob = await response.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a'); a.href = url; a.download = doc.originalName || doc.name; a.click();
                            URL.revokeObjectURL(url);
                          } catch { addToast('Error al descargar', 'error'); }
                        }} style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#374151' }}>
                          Descargar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Admin Upload Modal */}
              {showAdminUpload && (
                <AdminUploadModal
                  orgId={org._id}
                  onClose={() => setShowAdminUpload(false)}
                  onUploaded={() => { setShowAdminUpload(false); loadOrgDocs(); }}
                  addToast={addToast}
                />
              )}

              {/* Preview Modal */}
              {previewDoc && (
                <div onClick={(e) => { if (e.target === e.currentTarget) { if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl); setPreviewDoc(null); setPreviewUrl(null); } }}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
                  <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>{previewDoc.name}</h4>
                      <button onClick={() => { if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl); setPreviewDoc(null); setPreviewUrl(null); }}
                        style={{ padding: '4px 12px', fontSize: 14, border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', fontWeight: 700 }}>
                        X
                      </button>
                    </div>
                    <div style={{ flex: 1, overflow: 'auto' }}>
                      {previewLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#6b7280' }}>Cargando vista previa...</div>
                      ) : previewUrl ? (
                        previewDoc.mimeType === 'application/pdf' ? (
                          <iframe src={previewUrl} style={{ width: '100%', height: '75vh', border: 'none' }} title="Preview" />
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                            <img src={previewUrl} alt={previewDoc.name} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
                          </div>
                        )
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#6b7280' }}>Error al cargar</div>
                      )}
                    </div>
                  </div>
                </div>
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
                  <div className="r-toolbar" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
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
        <div className="r-btn-row" style={{
          padding: '16px 24px', borderTop: '1px solid #e5e7eb',
          display: 'flex', gap: 8, flexWrap: 'wrap'
        }}>
          {/* Pre-asamblea: revisión y agendamiento */}
          {(org.status === 'waiting_ministro' || org.status === 'pending_review' || org.status === 'in_review') && (
            <>
              {org.status === 'pending_review' && (
                <button onClick={() => handleStatusChange('in_review')} disabled={isActioning}
                  style={actionBtn('#8b5cf6')}>Tomar Revisión</button>
              )}
              {(org.status === 'waiting_ministro' || org.status === 'in_review') && (
                <button onClick={openScheduleModal} disabled={isActioning}
                  style={actionBtn('#2563eb')}>Agendar Ministro</button>
              )}
              <button onClick={() => {
                if (correctionItems.length === 0) {
                  addToast('Primero marca campos haciendo clic en "+ Observar" junto a cada dato', 'error');
                  return;
                }
                setShowCorrectionsModal(true);
              }} disabled={isActioning}
                style={{
                  ...actionBtn('#f59e0b'),
                  position: 'relative',
                }}>
                Solicitar Correcciones
                {correctionItems.length > 0 && (
                  <span style={{
                    position: 'absolute', top: -6, right: -6,
                    background: '#dc2626', color: 'white', borderRadius: '50%',
                    width: 20, height: 20, fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{correctionItems.length}</span>
                )}
              </button>
              <button onClick={() => setShowReject(true)} disabled={isActioning}
                style={actionBtn('#ef4444')}>Rechazar</button>
            </>
          )}
          {/* Post-asamblea: dirigir al flujo FEA en la pestaña Aprobar */}
          {org.status === 'ministro_approved' && (
            <button onClick={() => setTab('aprobar')} style={{
              ...actionBtn('#10b981'),
              padding: '10px 24px', fontSize: 14,
            }}>
              Ir a Firmar y Aprobar
            </button>
          )}
          {/* Post-FEA: enviar al registro (solo si nunca se ha enviado) */}
          {org.status === 'approved' && !(statusHistory || []).some(h => h.status === 'sent_registry') && (
            <button onClick={() => handleStatusChange('sent_registry')} disabled={isActioning}
              style={actionBtn('#6366f1')}>Enviar al Registro Civil</button>
          )}
          {/* En Registro Civil: confirmar inscripcion o marcar observaciones */}
          {org.status === 'sent_registry' && (
            <>
              <button onClick={async () => {
                setIsActioning(true);
                try {
                  await updateOrgStatus(org._id, 'approved');
                  addToast('Organizacion inscrita en Registro Civil. Cuentas de socios activadas.', 'success');
                  const updated = await refreshOrganization(org._id);
                  if (updated) setOrg(updated);
                } catch (err) { addToast(err.message, 'error'); }
                finally { setIsActioning(false); }
              }} disabled={isActioning} style={{
                ...actionBtn('#10b981'),
                padding: '10px 24px', fontSize: 14,
              }}>
                Confirmar Inscripcion en Registro Civil
              </button>
              <button onClick={() => handleStatusChange('registry_observations')} disabled={isActioning}
                style={actionBtn('#f59e0b')}>Observaciones del Registro</button>
            </>
          )}
          {/* Observaciones del Registro: corregir y reenviar o confirmar */}
          {org.status === 'registry_observations' && (
            <>
              <button onClick={async () => {
                setIsActioning(true);
                try {
                  await updateOrgStatus(org._id, 'approved');
                  addToast('Organizacion inscrita en Registro Civil. Cuentas de socios activadas.', 'success');
                  const updated = await refreshOrganization(org._id);
                  if (updated) setOrg(updated);
                } catch (err) { addToast(err.message, 'error'); }
                finally { setIsActioning(false); }
              }} disabled={isActioning} style={{
                ...actionBtn('#10b981'),
                padding: '10px 24px', fontSize: 14,
              }}>
                Confirmar Inscripcion en Registro Civil
              </button>
              <button onClick={() => handleStatusChange('sent_registry')} disabled={isActioning}
                style={actionBtn('#6366f1')}>Reenviar al Registro</button>
            </>
          )}
          {/* Org ya completamente aprobada */}
          {org.status === 'approved' && (
            <button onClick={() => setShowDissolve(true)} disabled={isActioning}
              style={actionBtn('#dc2626')}>Disolver Organizacion</button>
          )}
          {/* DEV ONLY: revert dissolved to approved */}
          {org.status === 'dissolved' && (
            <button onClick={async () => {
              if (!confirm('DEV: Revertir disolucion? La organizacion volvera a estado Aprobada.')) return;
              setIsActioning(true);
              try {
                await apiService.post(`/organizations/${org._id}/dev-revert-dissolved`);
                addToast('DEV: Organizacion revertida a approved', 'success');
                const updated = await refreshOrganization(org._id);
                if (updated) setOrg(updated);
              } catch (err) { addToast(err.message, 'error'); }
              finally { setIsActioning(false); }
            }} disabled={isActioning} style={{
              ...actionBtn('#9ca3af'),
              fontSize: 11, padding: '4px 10px', opacity: 0.7,
            }}>
              DEV: Revertir disolucion
            </button>
          )}
          {/* DEV ONLY: revert to ministro_approved for testing */}
          {(org.status === 'approved' || org.status === 'sent_registry' || org.status === 'registry_observations') && (
            <button onClick={async () => {
              if (!confirm('DEV: Revertir a ministro_approved? Esto limpiara el certificado FEA y las cuentas de socios creadas.')) return;
              setIsActioning(true);
              try {
                await apiService.post(`/organizations/${org._id}/dev-revert-to-ministro-approved`);
                addToast('DEV: Organización revertida a ministro_approved', 'success');
                const updated = await refreshOrganization(org._id);
                if (updated) setOrg(updated);
              } catch (err) { addToast(err.message, 'error'); }
              finally { setIsActioning(false); }
            }} disabled={isActioning} style={{
              ...actionBtn('#9ca3af'),
              fontSize: 11, padding: '4px 10px', opacity: 0.7,
            }}>
              DEV: Revertir a ministro_approved
            </button>
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
          <div className="r-btn-row" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowReject(false)} style={actionBtn('#6b7280')}>Cancelar</button>
            <button onClick={handleReject} disabled={isActioning} style={actionBtn('#ef4444')}>
              {isActioning ? 'Rechazando...' : 'Confirmar Rechazo'}
            </button>
          </div>
        </Modal>
      )}

      {/* Dissolution sub-modal */}
      {showDissolve && (
        <Modal open onClose={() => setShowDissolve(false)} title="Disolver Organización">
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#991b1b' }}>
            <strong>Atención:</strong> Esta acción es irreversible. La organización pasará a estado "Disuelta" y no podrá reactivarse.
          </div>
          {org.config?.beneficiarioDisolucion && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
              <strong>Beneficiario de bienes:</strong> {org.config.beneficiarioDisolucion}
              {org.config.rutDisolucion && ` (RUT: ${org.config.rutDisolucion})`}
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6, color: '#374151' }}>
              Razón de disolución *
            </label>
            <textarea value={dissolveReason} onChange={e => setDissolveReason(e.target.value)} rows={4}
              style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
              placeholder="Ej: Quórum insuficiente, inactividad prolongada, solicitud de la directiva..." />
          </div>
          <div className="r-btn-row" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowDissolve(false)} style={actionBtn('#6b7280')}>Cancelar</button>
            <button onClick={handleDissolve} disabled={isActioning} style={actionBtn('#dc2626')}>
              {isActioning ? 'Disolviendo...' : 'Confirmar Disolución'}
            </button>
          </div>
        </Modal>
      )}

      {/* Schedule Ministro sub-modal */}
      {showSchedule && (
        <Modal open onClose={() => setShowSchedule(false)} title="Agendar Ministro de Fe">
          {/* Reference: organizer's request */}
          {(org.electionDate || org.electionTime || org.assemblyAddress) && (
            <div style={{
              padding: 12, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', marginBottom: 16,
            }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#0369a1', display: 'block', marginBottom: 4 }}>
                Solicitado por dirigente social:
              </span>
              <div style={{ fontSize: 13, color: '#374151' }}>
                {org.electionDate && <div>Fecha: {localeDateString(org.electionDate)}</div>}
                {org.electionTime && <div>Hora: {org.electionTime}</div>}
                {org.assemblyAddress && <div>Lugar: {org.assemblyAddress}</div>}
              </div>
            </div>
          )}
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
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Lugar</label>
              <input type="text" value={scheduleData.location}
                onChange={e => setScheduleData(d => ({ ...d, location: e.target.value }))}
                placeholder="Dirección de la asamblea"
                style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
              />
            </div>
          </div>
          <div className="r-btn-row" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setShowSchedule(false)} style={actionBtn('#6b7280')}>Cancelar</button>
            <button onClick={handleScheduleMinistro} disabled={isActioning} style={actionBtn('#2563eb')}>
              {isActioning ? 'Agendando...' : 'Agendar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Reschedule modal */}
      {showReschedule && (
        <Modal open onClose={() => setShowReschedule(false)} title="Reprogramar Asamblea">
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Nueva fecha</label>
              <input type="date" value={rescheduleData.date}
                onChange={e => setRescheduleData(d => ({ ...d, date: e.target.value }))}
                style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Nueva hora</label>
              <input type="time" value={rescheduleData.time}
                onChange={e => setRescheduleData(d => ({ ...d, time: e.target.value }))}
                style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Motivo (opcional)</label>
              <input type="text" value={rescheduleData.reason}
                onChange={e => setRescheduleData(d => ({ ...d, reason: e.target.value }))}
                placeholder="Ej: Solicitud del dirigente, emergencia climática..."
                style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setShowReschedule(false)} style={actionBtn('#6b7280')}>Cancelar</button>
            <button
              disabled={!rescheduleData.date || !rescheduleData.time || isActioning}
              onClick={async () => {
                setIsActioning(true);
                try {
                  await apiService.rescheduleByOrg(org._id, rescheduleData.date, rescheduleData.time, rescheduleData.reason);
                  addToast('Asamblea reprogramada. Se notificó al Ministro y al dirigente.', 'success');
                  setShowReschedule(false);
                  const updated = await refreshOrganization(org._id);
                  if (updated) setOrg(updated);
                } catch (err) {
                  addToast(err.message || 'Error al reprogramar', 'error');
                } finally {
                  setIsActioning(false);
                }
              }}
              style={actionBtn('#f59e0b')}
            >
              {isActioning ? 'Reprogramando...' : 'Confirmar Reprogramacion'}
            </button>
          </div>
        </Modal>
      )}

      {/* Flagging popover — appears when clicking "+ Observar" */}
      {flaggingField && (
        <div onClick={e => { if (e.target === e.currentTarget) setFlaggingField(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 20, width: '90%', maxWidth: 420, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#111827' }}>Observar campo</h4>
            <div style={{ padding: 10, background: '#f9fafb', borderRadius: 8, marginBottom: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>{flaggingField.label}</div>
              <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{flaggingField.currentValue || '—'}</div>
            </div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Comentario de corrección:</label>
            <textarea value={flagComment} onChange={e => setFlagComment(e.target.value)}
              placeholder="Ej: El RUT tiene un dígito incorrecto..."
              rows={3} style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setFlaggingField(null)} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: 'white', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={confirmFlag} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#f59e0b', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Agregar a observaciones</button>
            </div>
          </div>
        </div>
      )}

      {/* Corrections send modal */}
      {showCorrectionsModal && (
        <Modal open onClose={() => setShowCorrectionsModal(false)} title={`Enviar Correcciones (${correctionItems.length})`}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
              Los siguientes campos serán marcados para corrección. El dirigente social solo podrá modificar estos datos.
            </p>
            <div style={{ display: 'grid', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {correctionItems.map((item, i) => (
                <div key={i} style={{ padding: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Valor actual: {item.currentValue || '—'}</div>
                    <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{item.message}</div>
                  </div>
                  <button onClick={() => removeFlagItem(item.field)} style={{ padding: '2px 8px', border: 'none', borderRadius: 4, background: '#fecaca', color: '#dc2626', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>Quitar</button>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Observación general (opcional):</label>
            <textarea value={correctionsGeneralComment} onChange={e => setCorrectionsGeneralComment(e.target.value)}
              placeholder="Comentario general para el dirigente social..."
              rows={3} style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowCorrectionsModal(false)} style={actionBtn('#6b7280')}>Cancelar</button>
            <button onClick={submitCorrections} disabled={isActioning} style={actionBtn('#f59e0b')}>
              {isActioning ? 'Enviando...' : `Enviar ${correctionItems.length} correcciones`}
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

function AdminUploadModal({ orgId, onClose, onUploaded, addToast }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('CERTIFICADO');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) { addToast('Selecciona un archivo', 'error'); return; }
    if (!name.trim()) { addToast('Ingresa un nombre', 'error'); return; }
    if (file.size > 20 * 1024 * 1024) { addToast('El archivo no puede superar 20MB', 'error'); return; }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('isOfficial', 'true');

      const resp = await fetch(`${apiService.baseUrl}/org-documents/${orgId}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest', ...(apiService._authToken && { Authorization: `Bearer ${apiService._authToken}` }) }
      });
      if (!resp.ok) throw new Error('Error al subir');
      addToast('Documento oficial subido', 'success');
      onUploaded();
    } catch (error) {
      addToast(error.message || 'Error al subir', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Subir Documento Oficial">
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
        Este documento quedará visible para la organización como "Documento Oficial de la Municipalidad".
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Nombre del documento *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Certificado de Personalidad Jurídica"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Categoría</label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
            {ADMIN_DOC_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Descripción</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            placeholder="Descripción opcional..."
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Archivo * (máx 20MB)</label>
          <input type="file" onChange={e => setFile(e.target.files[0])}
            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 20px', fontSize: 13, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button type="submit" disabled={submitting} style={{ padding: '8px 20px', fontSize: 13, background: '#065f46', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Subiendo...' : 'Subir Documento Oficial'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
