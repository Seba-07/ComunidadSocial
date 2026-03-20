import { useState, useEffect, useRef } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../stores/uiStore';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { formatDate, localeDateString } from '../../utils/formatters';

const DOC_CATEGORIES = [
  { value: 'ACTA_ASAMBLEA', label: 'Acta de Asamblea' },
  { value: 'BALANCE', label: 'Balance' },
  { value: 'INFORME', label: 'Informe' },
  { value: 'CERTIFICADO', label: 'Certificado' },
  { value: 'CORRESPONDENCIA', label: 'Correspondencia' },
  { value: 'OTRO', label: 'Otro' }
];

const CATEGORY_LABELS = Object.fromEntries(DOC_CATEGORIES.map((c) => [c.value, c.label]));

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PREVIEWABLE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/jpg'];

function isPDF(mimeType) { return mimeType === 'application/pdf'; }
function isPreviewable(mimeType) { return PREVIEWABLE_TYPES.includes(mimeType); }

export default function OrgDocumentos({ org, onRefresh }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const addToast = useUiStore((s) => s.addToast);

  useEffect(() => {
    if (org?._id) loadDocuments();
  }, [org?._id]);

  async function loadDocuments() {
    setLoading(true);
    try {
      const data = await apiService.get(`/org-documents/${org._id}`);
      setDocs(data.documents || data || []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }

  const [generatedDocs, setGeneratedDocs] = useState([]);
  useEffect(() => {
    if (org?._id) {
      apiService.get(`/organizations/${org._id}/generated-documents`)
        .then(d => { if (Array.isArray(d)) setGeneratedDocs(d); })
        .catch(() => {});
    }
  }, [org?._id]);

  function openGeneratedPdf(docType) {
    const doc = generatedDocs.find(d => d.docType === docType);
    if (!doc?.content) {
      addToast('Documento no disponible', 'error');
      return;
    }
    if (doc.content.startsWith('data:application/pdf')) {
      try {
        const b64 = doc.content.split(',')[1] || doc.content.split('base64,')[1];
        const bytes = atob(b64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        window.open(URL.createObjectURL(new Blob([arr], { type: 'application/pdf' })), '_blank');
      } catch { window.open(doc.content, '_blank'); }
    } else {
      const w = window.open('', '_blank');
      if (w) { w.document.write(doc.content); w.document.close(); }
    }
  }

  async function handleDeleteDoc(docId) {
    if (!confirm('¿Eliminar este documento?')) return;
    try {
      await apiService.delete(`/org-documents/${org._id}/${docId}`);
      addToast('Documento eliminado', 'success');
      loadDocuments();
    } catch (error) {
      addToast(error.message || 'Error al eliminar', 'error');
    }
  }

  async function handleDownloadDoc(docId, docName) {
    try {
      const response = await fetch(`${apiService.baseUrl}/org-documents/${org._id}/${docId}/download`, {
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest', ...(apiService._authToken && { Authorization: `Bearer ${apiService._authToken}` }) }
      });
      if (!response.ok) throw new Error('Error al descargar');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = docName || 'documento';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      addToast(error.message || 'Error al descargar', 'error');
    }
  }

  async function openPreview(doc) {
    setPreviewDoc(doc);
    setPreviewUrl(null);
    setPreviewLoading(true);
    try {
      const response = await fetch(`${apiService.baseUrl}/org-documents/${org._id}/${doc._id}/preview`, {
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest', ...(apiService._authToken && { Authorization: `Bearer ${apiService._authToken}` }) }
      });
      if (!response.ok) throw new Error('Error al obtener preview');
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        // S3 mode: backend returns { url, mimeType }
        const data = await response.json();
        setPreviewUrl(data.url);
      } else {
        // Local mode: backend streams the file directly
        const blob = await response.blob();
        setPreviewUrl(URL.createObjectURL(blob));
      }
    } catch {
      addToast('Error al previsualizar documento', 'error');
      setPreviewDoc(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewDoc(null);
    setPreviewUrl(null);
  }

  // Assembly actas
  const assemblyActas = (org?.assemblies || []).filter((a) => a.status === 'finalizada');

  // Separate official vs user-uploaded docs
  const officialDocs = docs.filter(d => d.isOfficial);
  const userDocs = docs.filter(d => !d.isOfficial);

  return (
    <div>
      <div className="r-toolbar" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', margin: 0 }}>Archivo Histórico</h3>
        <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 14 }} onClick={() => setShowUpload(true)}>
          + Subir Documento
        </button>
      </div>

      {/* Official Documents from Municipality */}
      {officialDocs.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h4 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Documentos Oficiales de la Municipalidad</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {officialDocs.map((doc) => (
              <div key={doc._id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                flexWrap: 'wrap', gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}>📜</span>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#065f46' }}>{doc.name}</span>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 8, background: '#065f46', color: '#fff', fontWeight: 600 }}>
                        Documento Oficial
                      </span>
                      <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 8, background: '#dbeafe', color: '#1e40af' }}>
                        {CATEGORY_LABELS[doc.category] || doc.category}
                      </span>
                      {doc.fileSize && <span style={{ fontSize: 11, color: '#6b7280' }}>{formatFileSize(doc.fileSize)}</span>}
                      {doc.createdAt && <span style={{ fontSize: 11, color: '#6b7280' }}>{localeDateString(doc.createdAt)}</span>}
                    </div>
                    {doc.description && <p style={{ fontSize: 12, color: '#374151', margin: '4px 0 0' }}>{doc.description}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {isPreviewable(doc.mimeType) && (
                    <button onClick={() => openPreview(doc)} style={{ ...actionBtnStyle, color: '#2563eb', borderColor: '#93c5fd', fontWeight: 600 }}>
                      {isPDF(doc.mimeType) ? 'Ver PDF' : 'Ver'}
                    </button>
                  )}
                  <button onClick={() => handleDownloadDoc(doc._id, doc.originalName || doc.name)} style={{ ...actionBtnStyle, color: '#065f46', borderColor: '#bbf7d0', fontWeight: 600 }}>
                    Descargar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legal Documents */}
      <div style={{ marginBottom: 32 }}>
        <h4 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Documentos Legales</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <LegalDoc name="Acta Constitutiva" icon="\uD83D\uDCCB" onDownload={() => openGeneratedPdf('acta_constitutiva')} available={generatedDocs.some(d => d.docType === 'acta_constitutiva')} />
          <LegalDoc name="Lista de Socios Fundadores" icon="\uD83D\uDCCB" onDownload={() => openGeneratedPdf('lista_socios')} available={generatedDocs.some(d => d.docType === 'lista_socios')} />
          <LegalDoc name="Nomina del Directorio" icon="\uD83D\uDCCB" onDownload={() => openGeneratedPdf('nomina_directorio')} available={generatedDocs.some(d => d.docType === 'nomina_directorio')} />
          {org.estatutos && <LegalDoc name="Estatutos" icon="\uD83D\uDCDC" />}
        </div>
      </div>

      {/* Certificados de Directorio (post-wizard upload) */}
      <DirectorioCertificados org={org} onRefresh={onRefresh} addToast={addToast} />

      {/* Assembly Actas */}
      {assemblyActas.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h4 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Actas de Asamblea</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {assemblyActas.map((a) => (
              <div key={a.id || a._id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
                flexWrap: 'wrap', gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}>📝</span>
                  <div>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{a.title}</span>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(a.date)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User-Uploaded Documents */}
      <div>
        <h4 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Mis Documentos</h4>
        {loading ? (
          <LoadingSpinner text="Cargando documentos..." />
        ) : userDocs.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: 24 }}>No hay documentos subidos por la organización</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {userDocs.map((doc) => (
              <div key={doc._id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
                flexWrap: 'wrap', gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{doc.name}</span>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 8, background: '#dbeafe', color: '#1e40af' }}>
                        {CATEGORY_LABELS[doc.category] || doc.category}
                      </span>
                      {doc.fileSize && <span style={{ fontSize: 11, color: '#6b7280' }}>{formatFileSize(doc.fileSize)}</span>}
                      {doc.createdAt && <span style={{ fontSize: 11, color: '#6b7280' }}>{localeDateString(doc.createdAt)}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {isPreviewable(doc.mimeType) && (
                    <button onClick={() => openPreview(doc)} style={{ ...actionBtnStyle, color: '#2563eb', borderColor: '#93c5fd' }}>
                      {isPDF(doc.mimeType) ? 'Ver PDF' : 'Ver'}
                    </button>
                  )}
                  <button onClick={() => handleDownloadDoc(doc._id, doc.originalName || doc.name)} style={actionBtnStyle}>Descargar</button>
                  <button onClick={() => handleDeleteDoc(doc._id)} style={{ ...actionBtnStyle, color: '#ef4444', borderColor: '#fca5a5' }}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <UploadModal open={showUpload} onClose={() => setShowUpload(false)} orgId={org._id}
        onUploaded={() => { setShowUpload(false); loadDocuments(); }} addToast={addToast} />

      {/* Preview Modal */}
      {previewDoc && (
        <div onClick={(e) => { if (e.target === e.currentTarget) closePreview(); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>{previewDoc.name}</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleDownloadDoc(previewDoc._id, previewDoc.originalName || previewDoc.name)}
                  style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#374151' }}>
                  Descargar
                </button>
                <button onClick={closePreview}
                  style={{ padding: '4px 12px', fontSize: 14, border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', fontWeight: 700 }}>
                  X
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
              {previewLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                  <LoadingSpinner text="Cargando vista previa..." />
                </div>
              ) : previewUrl ? (
                isPDF(previewDoc.mimeType) ? (
                  <iframe src={previewUrl} style={{ width: '100%', height: '75vh', border: 'none' }} title="Preview" />
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                    <img src={previewUrl} alt={previewDoc.name} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#6b7280' }}>
                  Error al cargar vista previa
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const actionBtnStyle = { padding: '4px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#374151', fontWeight: 500 };
const certBtnStyle = { padding: '10px 20px', border: '1px solid #8b5cf6', borderRadius: 12, background: 'white', color: '#8b5cf6', cursor: 'pointer', fontWeight: 600, fontSize: 13 };

function LegalDoc({ name, icon = '\uD83D\uDCCB', onDownload, available = true }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
      flexWrap: 'wrap', gap: 8
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontWeight: 500, fontSize: 14 }}>{name}</span>
      </div>
      {onDownload && available && (
        <button onClick={onDownload} style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #2563eb', borderRadius: 6, background: 'white', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>
          Ver / Imprimir
        </button>
      )}
      {onDownload && !available && (
        <span style={{ fontSize: 11, color: '#9ca3af' }}>No disponible</span>
      )}
    </div>
  );
}

// ========== Certificados de Directorio (post-wizard upload) ==========
function DirectorioCertificados({ org, onRefresh, addToast }) {
  const directorio = org?.provisionalDirectorio || {};
  const certs = org?.certificatesStep5 || [];
  const SKIP = new Set(['_id', '__v', 'type', 'designatedAt', 'additionalMembers', 'createdAt', 'updatedAt']);
  const cargos = Object.entries(directorio).filter(([k, v]) => !SKIP.has(k) && v && typeof v === 'object' && !Array.isArray(v) && (v.rut || v.firstName));
  // Add additional members
  if (Array.isArray(directorio.additionalMembers)) {
    directorio.additionalMembers.forEach((m, i) => {
      if (m?.rut || m?.firstName) cargos.push([`additional_${i}`, { ...m, cargo: m.cargoNombre || m.cargo || `Director/a ${i+1}` }]);
    });
  }

  if (cargos.length === 0) return null;

  const CARGO_LABELS = { president: 'Presidente/a', presidente: 'Presidente/a', vicePresident: 'Vicepresidente/a', vicepresidente: 'Vicepresidente/a', secretary: 'Secretario/a', secretario: 'Secretario/a', treasurer: 'Tesorero/a', tesorero: 'Tesorero/a' };

  function getCert(cargoKey, data) {
    const normRut = (data?.rut || '').replace(/\./g, '').replace(/-/g, '');
    return certs.find(c => {
      if (!c.certificate) return false;
      const cId = (c.memberId || '').replace(/\./g, '').replace(/-/g, '');
      if (normRut && cId === normRut) return true;
      if (c.memberId === cargoKey) return true;
      return false;
    });
  }

  function viewCert(cert) {
    if (!cert?.certificate) return;
    try {
      let b64 = cert.certificate;
      if (b64.includes(',')) b64 = b64.split(',')[1];
      const bytes = atob(b64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const isPdf = bytes.startsWith('%PDF') || cert.certificate.includes('application/pdf');
      window.open(URL.createObjectURL(new Blob([arr], { type: isPdf ? 'application/pdf' : 'image/png' })), '_blank');
    } catch {
      // Try direct data URI
      window.open(cert.certificate.startsWith('data:') ? cert.certificate : `data:application/pdf;base64,${cert.certificate}`, '_blank');
    }
  }

  async function handleUploadCert(cargoKey, personRut, file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { addToast('Max 5MB', 'error'); return; }
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        await apiService.post(`/organizations/${org._id}/sync-certificates`, {
          certificates: { [personRut || cargoKey]: { name: file.name, data: reader.result } }
        });
        addToast('Certificado subido', 'success');
        if (onRefresh) onRefresh();
      };
      reader.readAsDataURL(file);
    } catch (error) {
      addToast(error.message || 'Error al subir', 'error');
    }
  }

  const pending = cargos.filter(([key, data]) => !getCert(key, data));

  return (
    <div style={{ marginBottom: 32 }}>
      <h4 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
        Certificados de Directorio ({certs.filter(c => c.certificate).length}/{cargos.length})
      </h4>
      {pending.length > 0 && (
        <div style={{ padding: 10, background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#92400e' }}>
          Faltan {pending.length} certificado(s) de antecedentes por subir.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cargos.map(([key, data]) => {
          const cert = getCert(key, data);
          return (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
              flexWrap: 'wrap', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>{cert ? '\uD83D\uDCCE' : '\uD83D\uDCCB'}</span>
                <div>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{CARGO_LABELS[key] || data.cargo || key}</span>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{data.firstName} {data.lastName} — {data.rut || ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {cert ? (
                  <>
                    <span style={{ fontSize: 11, color: '#059669', fontWeight: 600, background: '#d1fae5', padding: '3px 8px', borderRadius: 4 }}>Subido</span>
                    <button onClick={() => viewCert(cert)} style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #2563eb', borderRadius: 6, background: 'white', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>
                      Ver
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>Pendiente</span>
                    <label style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #2563eb', borderRadius: 6, background: 'white', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>
                      Subir
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                        onChange={(e) => handleUploadCert(key, data.rut, e.target.files[0])} />
                    </label>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========== Upload Modal ==========
function UploadModal({ open, onClose, orgId, onUploaded, addToast }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTRO');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) { addToast('Selecciona un archivo', 'error'); return; }
    if (!name.trim()) { addToast('Ingresa un nombre', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { addToast('El archivo no puede superar 10MB', 'error'); return; }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      formData.append('description', description);
      formData.append('category', category);

      await fetch(`${apiService.baseUrl}/org-documents/${orgId}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest', ...(apiService._authToken && { Authorization: `Bearer ${apiService._authToken}` }) }
      }).then((r) => { if (!r.ok) throw new Error('Error al subir'); return r.json(); });

      addToast('Documento subido exitosamente', 'success');
      setName(''); setDescription(''); setCategory('OTRO'); setFile(null);
      onUploaded();
    } catch (error) {
      addToast(error.message || 'Error al subir documento', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Subir Documento">
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField label="Nombre del documento *" id="doc-name" type="text" placeholder="Acta 2024" value={name} onChange={(e) => setName(e.target.value)} />
        <FormField label="Categoría" id="doc-cat">
          <select id="doc-cat" value={category} onChange={(e) => setCategory(e.target.value)}
            style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 16 }}>
            {DOC_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </FormField>
        <FormField label="Descripción" id="doc-desc">
          <textarea id="doc-desc" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción opcional..." rows={2}
            style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 16, resize: 'vertical', boxSizing: 'border-box' }} />
        </FormField>
        <div className="form-group">
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Archivo * (máx 10MB)</label>
          <input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files[0])}
            style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 14 }} />
        </div>
        <div className="r-btn-row" style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, background: '#f3f4f6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Cancelar</button>
          <button type="submit" className="btn-auth" style={{ flex: 1 }} disabled={submitting}>{submitting ? 'Subiendo...' : 'Subir Documento'}</button>
        </div>
      </form>
    </Modal>
  );
}
