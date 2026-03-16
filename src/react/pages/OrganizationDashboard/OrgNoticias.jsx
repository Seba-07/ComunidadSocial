import { useState, useEffect } from 'react';
import { apiService } from '../../../services/ApiService';
import { sanitizeRichText } from '@shared/utils/sanitize';
import { localeDateString } from '../../utils/formatters';

const CATEGORIES = [
  { key: 'TODAS', label: 'Todas' },
  { key: 'NOTICIAS', label: 'Noticias' },
  { key: 'COMUNICADOS', label: 'Comunicados' },
  { key: 'EVENTOS', label: 'Eventos' },
  { key: 'CONVOCATORIAS', label: 'Convocatorias' },
];

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

const categoryColors = {
  NOTICIAS: '#2563eb',
  COMUNICADOS: '#7c3aed',
  EVENTOS: '#059669',
  CONVOCATORIAS: '#d97706',
};

function getRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Hace un momento';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} horas`;
  if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} días`;
  return localeDateString(dateStr, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFullDate(dateStr) {
  if (!dateStr) return '';
  return localeDateString(dateStr, { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function OrgNoticias() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('TODAS');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loadingArticle, setLoadingArticle] = useState(false);

  useEffect(() => {
    loadArticles();
  }, []);

  async function loadArticles() {
    try {
      setLoading(true);
      const data = await apiService.get('/news');
      const list = data.news || data || [];
      setArticles(Array.isArray(list) ? list : []);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }

  async function openArticle(id) {
    try {
      setLoadingArticle(true);
      const article = await apiService.get(`/news/${id}`);
      setSelectedArticle(article.article || article);
    } catch {
      setSelectedArticle(null);
    } finally {
      setLoadingArticle(false);
    }
  }

  const filtered = articles.filter(a => {
    if (activeCategory === 'TODAS') return true;
    return (a.category || '').toUpperCase() === activeCategory;
  });

  // Detail view
  if (selectedArticle) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <button
          onClick={() => setSelectedArticle(null)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#475569',
            fontSize: 13, fontWeight: 500, cursor: 'pointer', marginBottom: 20,
          }}
        >
          ← Volver a Noticias
        </button>

        {selectedArticle.featuredImage && (
          <img
            src={selectedArticle.featuredImage}
            alt={selectedArticle.title}
            style={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 12, marginBottom: 20 }}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          {selectedArticle.category && (
            <span style={{
              padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: (categoryColors[selectedArticle.category.toUpperCase()] || '#64748b') + '18',
              color: categoryColors[selectedArticle.category.toUpperCase()] || '#64748b',
            }}>
              {selectedArticle.category}
            </span>
          )}
          <span style={{ fontSize: 13, color: '#94a3b8' }}>{formatFullDate(selectedArticle.publishedAt || selectedArticle.createdAt)}</span>
          {selectedArticle.views != null && (
            <span style={{ fontSize: 13, color: '#94a3b8' }}>{selectedArticle.views} lecturas</span>
          )}
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', margin: '0 0 8px', lineHeight: 1.3 }}>
          {selectedArticle.title}
        </h1>

        {selectedArticle.author && (
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>Por {selectedArticle.author}</p>
        )}

        <div
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(selectedArticle.contentHTML || selectedArticle.content || '') }}
          style={{ fontSize: 15, lineHeight: 1.8, color: '#334155' }}
        />

        {selectedArticle.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 24 }}>
            {selectedArticle.tags.map((tag, i) => (
              <span key={i} style={{ padding: '3px 10px', borderRadius: 10, background: '#f1f5f9', color: '#475569', fontSize: 12 }}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>Noticias e Información</h2>
        <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>
          Novedades, comunicados y eventos de interés comunitario
        </p>
      </div>

      {/* Category filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {CATEGORIES.map(c => (
          <button key={c.key} style={chipStyle(activeCategory === c.key)} onClick={() => setActiveCategory(c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      {loading || loadingArticle ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>Cargando noticias...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📰</div>
          No hay noticias{activeCategory !== 'TODAS' ? ' en esta categoría' : ''} por el momento
        </div>
      ) : (
        <div className="r-grid-auto" style={{ gap: 20 }}>
          {filtered.map(article => (
            <div
              key={article._id}
              onClick={() => openArticle(article._id)}
              style={{
                background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
                overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              {article.featuredImage ? (
                <img
                  src={article.featuredImage}
                  alt={article.title}
                  style={{ width: '100%', height: 180, objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', height: 140, background: 'linear-gradient(135deg, #e0e7ff, #dbeafe)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 40, opacity: 0.5 }}>📰</span>
                </div>
              )}

              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {article.category && (
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      background: (categoryColors[article.category.toUpperCase()] || '#64748b') + '18',
                      color: categoryColors[article.category.toUpperCase()] || '#64748b',
                    }}>
                      {article.category}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {getRelativeTime(article.publishedAt || article.createdAt)}
                  </span>
                </div>

                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: '0 0 6px', lineHeight: 1.4 }}>
                  {article.title}
                </h3>

                {article.summary && (
                  <p style={{
                    fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {article.summary}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
