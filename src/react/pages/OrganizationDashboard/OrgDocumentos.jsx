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

export default function OrgDocumentos({ org, onRefresh }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
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

  async function handleDownloadActa() {
    try {
      await apiService.downloadActaPDF(org._id);
    } catch (error) {
      addToast(error.message || 'Error al descargar acta', 'error');
    }
  }

  async function handleDownloadMembers() {
    try {
      await apiService.downloadMembersPDF(org._id);
    } catch (error) {
      addToast(error.message || 'Error al descargar lista', 'error');
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
                <button onClick={() => handleDownloadDoc(doc._id, doc.originalName || doc.name)} style={{ ...actionBtnStyle, color: '#065f46', borderColor: '#bbf7d0', fontWeight: 600 }}>
                  Descargar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legal Documents */}
      <div style={{ marginBottom: 32 }}>
        <h4 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Documentos Legales</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <LegalDoc name="Acta Constitutiva" icon="📋" onDownload={handleDownloadActa} />
          <LegalDoc name="Lista de Miembros" icon="📋" onDownload={handleDownloadMembers} />
          {org.estatutos && <LegalDoc name="Estatutos" icon="📜" />}
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
    </div>
  );
}

const actionBtnStyle = { padding: '4px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#374151', fontWeight: 500 };
const certBtnStyle = { padding: '10px 20px', border: '1px solid #8b5cf6', borderRadius: 12, background: 'white', color: '#8b5cf6', cursor: 'pointer', fontWeight: 600, fontSize: 13 };

function LegalDoc({ name, icon = '📋', onDownload }) {
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
      {onDownload && (
        <button onClick={onDownload} style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #2563eb', borderRadius: 6, background: 'white', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>
          Descargar PDF
        </button>
      )}
    </div>
  );
}

// ========== Certificados de Directorio (post-wizard upload) ==========
function DirectorioCertificados({ org, onRefresh, addToast }) {
  const directorio = org?.provisionalDirectorio || {};
  const certs = org?.certificatesStep5 || [];
  const cargos = Object.entries(directorio).filter(([, data]) => data?.rut);

  if (cargos.length === 0) return null;

  // Check which cargos have certificates
  function hasCert(cargoKey, data) {
    return certs.some(c =>
      (c.memberId && c.memberId === cargoKey) ||
      (c.memberName && data && c.memberName === `${data.firstName} ${data.lastName}`)
    );
  }

  const pending = cargos.filter(([key, data]) => !hasCert(key, data));
  if (pending.length === 0 && !org.certificatesPending) return null;

  async function handleUploadCert(cargoKey, file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { addToast('El archivo no puede superar 5MB', 'error'); return; }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        await apiService.post(`/organizations/${org._id}/sync-certificates`, {
          certificates: { [cargoKey]: { name: file.name, data: reader.result } }
        });
        addToast('Certificado subido exitosamente', 'success');
        if (onRefresh) onRefresh();
      };
      reader.readAsDataURL(file);
    } catch (error) {
      addToast(error.message || 'Error al subir certificado', 'error');
    }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <h4 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Certificados de Directorio</h4>
      {pending.length > 0 && (
        <div style={{ padding: 10, background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#92400e' }}>
          Faltan {pending.length} certificado(s) de antecedentes por subir.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cargos.map(([key, data]) => {
          const uploaded = hasCert(key, data);
          return (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>📋</span>
                <div>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{data.cargo || key}</span>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{data.firstName} {data.lastName}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {uploaded ? (
                  <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>Subido</span>
                ) : (
                  <>
                    <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>Pendiente</span>
                    <label style={{
                      padding: '4px 12px', fontSize: 12, border: '1px solid #2563eb', borderRadius: 6,
                      background: 'white', color: '#2563eb', cursor: 'pointer', fontWeight: 600
                    }}>
                      Subir
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                        onChange={(e) => handleUploadCert(key, e.target.files[0])} />
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
