import { useState, useEffect } from 'react';
import { apiService } from '../../../services/ApiService';

const CATEGORIES = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'FORMULARIOS', label: 'Formularios' },
  { key: 'LEYES', label: 'Leyes y Normativas' },
  { key: 'GUIAS', label: 'Guías y Manuales' },
  { key: 'PLANTILLAS', label: 'Plantillas' },
  { key: 'OTROS', label: 'Otros' },
];

const cardStyle = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  transition: 'box-shadow 0.2s',
};

const chipStyle = (active) => ({
  padding: '6px 14px',
  borderRadius: 20,
  border: active ? '1px solid #2563eb' : '1px solid #e2e8f0',
  background: active ? '#2563eb' : '#fff',
  color: active ? '#fff' : '#475569',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

const FILE_ICONS = {
  'application/pdf': '📕',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📘',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📗',
  'text/plain': '📄',
};

function getFileIcon(mimeType) {
  return FILE_ICONS[mimeType] || '📄';
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

const categoryColors = {
  FORMULARIOS: '#2563eb',
  LEYES: '#7c3aed',
  GUIAS: '#059669',
  PLANTILLAS: '#d97706',
  OTROS: '#64748b',
};

export default function OrgBiblioteca() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('TODOS');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      setLoading(true);
      const data = await apiService.get('/library-documents');
      setDocuments(Array.isArray(data) ? data : data.documents || []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = documents.filter(doc => {
    if (activeCategory !== 'TODOS' && doc.category !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (doc.name || '').toLowerCase().includes(q) || (doc.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  function getDownloadUrl(doc) {
    if (doc.externalUrl) return doc.externalUrl;
    return `${apiService.baseUrl || ''}/library-documents/${doc._id}/download`;
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>Biblioteca de Documentos</h2>
        <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>
          Documentos, formularios y normativas para organizaciones comunitarias
        </p>
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Buscar documentos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="r-search"
          style={{ outline: 'none' }}
        />
        {CATEGORIES.map(c => (
          <button key={c.key} style={chipStyle(activeCategory === c.key)} onClick={() => setActiveCategory(c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>Cargando documentos...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
          No se encontraron documentos{activeCategory !== 'TODOS' ? ' en esta categoría' : ''}
        </div>
      ) : (
        <div className="r-grid-auto">
          {filtered.map(doc => (
            <div key={doc._id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>{getFileIcon(doc.mimeType)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 4, wordBreak: 'break-word' }}>
                    {doc.name}
                  </div>
                  {doc.description && (
                    <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {doc.description}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                {doc.category && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                    background: (categoryColors[doc.category] || '#64748b') + '18',
                    color: categoryColors[doc.category] || '#64748b',
                  }}>
                    {doc.category}
                  </span>
                )}
                {doc.fileSize && <span style={{ color: '#94a3b8' }}>{formatFileSize(doc.fileSize)}</span>}
                {doc.createdAt && <span style={{ color: '#94a3b8' }}>{formatDate(doc.createdAt)}</span>}
                {doc.isPlaceholder && <span style={{ color: '#d97706', fontStyle: 'italic' }}>Próximamente</span>}
              </div>

              {!doc.isPlaceholder && (
                <a
                  href={getDownloadUrl(doc)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    borderRadius: 8, background: '#2563eb', color: '#fff', fontSize: 13,
                    fontWeight: 500, textDecoration: 'none', alignSelf: 'flex-start',
                  }}
                >
                  {doc.externalUrl ? '🔗 Abrir enlace' : '⬇️ Descargar'}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
