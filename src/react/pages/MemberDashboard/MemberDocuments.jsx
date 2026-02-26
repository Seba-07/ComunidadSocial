import { useState, useEffect } from 'react';
import { apiService } from '@services/ApiService.js';
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

export default function MemberDocuments({ org }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?._id) return;
    loadDocuments();
  }, [org?._id]);

  async function loadDocuments() {
    setLoading(true);
    try {
      // Try to load uploaded documents if the endpoint exists
      const data = await apiService.get(`/org-documents/${org._id}`);
      setDocs(data.documents || data || []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', marginBottom: 16 }}>Documentos</h3>

      {/* Legal Documents */}
      <div style={{ marginBottom: 32 }}>
        <h4 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Documentos Legales</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {org.estatutos && (
            <DocRow name="Estatutos" category="Legal" />
          )}
          <DocRow name="Acta Constitutiva" category="Legal" />
          <DocRow name="Certificación Municipal" category="Legal" />
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
              <DocRow
                key={doc._id}
                name={doc.name}
                category={CATEGORY_LABELS[doc.category] || doc.category}
                size={formatFileSize(doc.fileSize)}
                date={doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('es-CL') : ''}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocRow({ name, category, size, date }) {
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
        <span style={{ fontSize: 20 }}>📄</span>
        <div>
          <span style={{ fontWeight: 500, fontSize: 14 }}>{name}</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 8, background: '#dbeafe', color: '#1e40af' }}>{category}</span>
            {size && <span style={{ fontSize: 11, color: '#6b7280' }}>{size}</span>}
            {date && <span style={{ fontSize: 11, color: '#6b7280' }}>{date}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
