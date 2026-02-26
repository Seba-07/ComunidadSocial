import { useState, useEffect } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../stores/uiStore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const CATEGORY_LABELS = {
  ACTA_ASAMBLEA: 'Acta Asamblea',
  BALANCE: 'Balance',
  INFORME: 'Informe',
  CERTIFICADO: 'Certificado',
  CORRESPONDENCIA: 'Correspondencia',
  OTRO: 'Otro'
};

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function OrgDocumentos({ org }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const addToast = useUiStore((s) => s.addToast);

  useEffect(() => {
    if (!org?._id) return;
    loadDocuments();
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
      addToast('Acta descargada', 'success');
    } catch (error) {
      addToast(error.message || 'Error al descargar', 'error');
    }
  }

  async function handleDownloadMembers() {
    try {
      await apiService.downloadMembersPDF(org._id);
      addToast('Lista de miembros descargada', 'success');
    } catch (error) {
      addToast(error.message || 'Error al descargar', 'error');
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', marginBottom: 24 }}>Documentos</h3>

      {/* Legal Documents */}
      <div style={{ marginBottom: 32 }}>
        <h4 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Documentos Legales</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <LegalDoc name="Acta Constitutiva" onDownload={handleDownloadActa} />
          <LegalDoc name="Lista de Miembros" onDownload={handleDownloadMembers} />
          {org.estatutos && <LegalDoc name="Estatutos" />}
          <LegalDoc name="Certificación Municipal" />
        </div>
      </div>

      {/* Uploaded Documents */}
      <div>
        <h4 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Documentos Subidos</h4>
        {loading ? (
          <LoadingSpinner text="Cargando documentos..." />
        ) : docs.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: 24 }}>No hay documentos subidos</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map((doc) => (
              <div
                key={doc._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{doc.name}</span>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 8, background: '#dbeafe', color: '#1e40af' }}>
                        {CATEGORY_LABELS[doc.category] || doc.category}
                      </span>
                      {doc.fileSize && <span style={{ fontSize: 11, color: '#6b7280' }}>{formatFileSize(doc.fileSize)}</span>}
                      {doc.createdAt && <span style={{ fontSize: 11, color: '#6b7280' }}>{new Date(doc.createdAt).toLocaleDateString('es-CL')}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LegalDoc({ name, onDownload }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: 8
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>📋</span>
        <span style={{ fontWeight: 500, fontSize: 14 }}>{name}</span>
      </div>
      {onDownload && (
        <button
          onClick={onDownload}
          style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #2563eb', borderRadius: 6, background: 'white', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}
        >
          Descargar PDF
        </button>
      )}
    </div>
  );
}
