import { useState, useEffect, useRef } from 'react';
import { apiService } from '../../../../services/ApiService';
import { useUiStore } from '../../../stores/uiStore';
import DataTable from '../../../components/ui/DataTable';

const CATEGORIES = [
  { value: 'NOTICIAS', label: 'Noticias' },
  { value: 'COMUNICADOS', label: 'Comunicados' },
  { value: 'EVENTOS', label: 'Eventos' },
  { value: 'CONVOCATORIAS', label: 'Convocatorias' },
];

const categoryColors = {
  NOTICIAS: '#2563eb',
  COMUNICADOS: '#7c3aed',
  EVENTOS: '#059669',
  CONVOCATORIAS: '#d97706',
};

const STATUS_FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'published', label: 'Publicadas' },
  { key: 'draft', label: 'Borradores' },
];

export default function NewsManagerView() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [showEditor, setShowEditor] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const addToast = useUiStore(s => s.addToast);

  useEffect(() => { loadArticles(); }, [pagination.page, statusFilter]);

  async function loadArticles() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', pagination.page);
      params.set('limit', '20');
      params.set('includeUnpublished', 'true');
      if (searchTerm) params.set('search', searchTerm);
      const data = await apiService.get(`/news?${params}`);
      const list = data.news || [];
      // Client-side status filter (backend doesn't filter by status individually)
      const filtered = statusFilter === 'all' ? list
        : statusFilter === 'published' ? list.filter(a => a.isPublished)
        : list.filter(a => !a.isPublished);
      setArticles(filtered);
      if (data.pagination) setPagination(prev => ({ ...prev, ...data.pagination }));
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadArticles();
  }

  function openEditor(article = null) {
    setEditingArticle(article);
    setShowEditor(true);
  }

  async function handleTogglePublish(article) {
    try {
      const endpoint = article.isPublished ? `/news/${article._id}/unpublish` : `/news/${article._id}/publish`;
      await apiService.post(endpoint);
      addToast(article.isPublished ? 'Noticia despublicada' : 'Noticia publicada', 'success');
      loadArticles();
    } catch (err) {
      addToast(err.message || 'Error al cambiar estado', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiService.delete(`/news/${deleteTarget._id}`);
      addToast('Noticia eliminada', 'success');
      setDeleteTarget(null);
      loadArticles();
    } catch (err) {
      addToast(err.message || 'Error al eliminar', 'error');
    }
  }

  function handleSaved() {
    setShowEditor(false);
    setEditingArticle(null);
    loadArticles();
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  // Stats
  const publishedCount = articles.filter(a => a.isPublished).length;
  const draftCount = articles.filter(a => !a.isPublished).length;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>Gestión de Noticias</h2>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>
            Crear, editar y administrar noticias y comunicados
          </p>
        </div>
        <button
          onClick={() => openEditor()}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none', background: '#2563eb',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          + Nueva Noticia
        </button>
      </div>

      {/* Stats */}
      <div className="r-grid-auto" style={{ gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: pagination.total || articles.length, color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Publicadas', value: publishedCount, color: '#059669', bg: '#ecfdf5' },
          { label: 'Borradores', value: draftCount, color: '#d97706', bg: '#fffbeb' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '14px 18px', border: `1px solid ${s.color}20` }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => { setStatusFilter(f.key); setPagination(p => ({ ...p, page: 1 })); }}
            style={{
              padding: '6px 14px', borderRadius: 20, border: statusFilter === f.key ? '1px solid #2563eb' : '1px solid #e2e8f0',
              background: statusFilter === f.key ? '#2563eb' : '#fff', color: statusFilter === f.key ? '#fff' : '#475569',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Buscar noticias..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, minWidth: 200 }}
          />
          <button onClick={handleSearch} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 13 }}>
            Buscar
          </button>
        </div>
      </div>

      {/* Articles list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>Cargando noticias...</div>
      ) : articles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📰</div>
          No hay noticias
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {articles.map(article => (
            <div
              key={article._id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: '#fff',
                borderRadius: 10, border: `1px solid ${article.isPublished ? '#e5e7eb' : '#fbbf24'}`,
                opacity: article.isPublished ? 1 : 0.85,
              }}
            >
              {/* Thumbnail */}
              {article.featuredImage ? (
                <img src={article.featuredImage} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 22, opacity: 0.4 }}>📰</span>
                </div>
              )}

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                    background: (categoryColors[article.category] || '#64748b') + '18',
                    color: categoryColors[article.category] || '#64748b',
                  }}>
                    {article.category}
                  </span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                    background: article.isPublished ? '#dcfce7' : '#fef3c7',
                    color: article.isPublished ? '#16a34a' : '#d97706',
                  }}>
                    {article.isPublished ? 'Publicada' : 'Borrador'}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {formatDate(article.publishedAt || article.createdAt)}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {article.viewCount || 0} vistas
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {article.title}
                </div>
                {article.summary && (
                  <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {article.summary}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => openEditor(article)}
                  title="Editar"
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}
                >
                  Editar
                </button>
                <button
                  onClick={() => handleTogglePublish(article)}
                  title={article.isPublished ? 'Despublicar' : 'Publicar'}
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    background: article.isPublished ? '#fef3c7' : '#dcfce7',
                    color: article.isPublished ? '#d97706' : '#16a34a',
                  }}
                >
                  {article.isPublished ? 'Despublicar' : 'Publicar'}
                </button>
                <button
                  onClick={() => setDeleteTarget(article)}
                  title="Eliminar"
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 13 }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button
            disabled={pagination.page <= 1}
            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: pagination.page <= 1 ? 'default' : 'pointer', opacity: pagination.page <= 1 ? 0.5 : 1, fontSize: 13 }}
          >
            Anterior
          </button>
          <span style={{ padding: '6px 14px', fontSize: 13, color: '#64748b' }}>
            Página {pagination.page} de {pagination.pages}
          </span>
          <button
            disabled={pagination.page >= pagination.pages}
            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: pagination.page >= pagination.pages ? 'default' : 'pointer', opacity: pagination.page >= pagination.pages ? 0.5 : 1, fontSize: 13 }}
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <NewsEditorModal
          article={editingArticle}
          onClose={() => { setShowEditor(false); setEditingArticle(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div onClick={e => e.target === e.currentTarget && setDeleteTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#1e293b' }}>Eliminar Noticia</h3>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 16px' }}>
              ¿Estás seguro de eliminar "<strong>{deleteTarget.title}</strong>"? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={handleDelete} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Editor Modal ============

function NewsEditorModal({ article, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: article?.title || '',
    summary: article?.summary || '',
    contentHTML: article?.contentHTML || '',
    category: article?.category || 'NOTICIAS',
    tags: article?.tags?.join(', ') || '',
    isPublished: article?.isPublished || false,
    featuredImage: article?.featuredImage || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const fileRef = useRef(null);
  const addToast = useUiStore(s => s.addToast);

  function updateField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('image', file);
      const resp = await fetch(`${apiService.baseUrl}/news/upload-image`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest', ...(apiService._authToken && { Authorization: `Bearer ${apiService._authToken}` }) },
      });
      if (!resp.ok) throw new Error('Error al subir imagen');
      const data = await resp.json();
      updateField('featuredImage', data.url);
      addToast('Imagen subida', 'success');
    } catch (err) {
      addToast(err.message || 'Error al subir imagen', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.title.trim()) {
      addToast('El título es requerido', 'error');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        contentHTML: form.contentHTML,
        category: form.category,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        isPublished: form.isPublished,
        featuredImage: form.featuredImage,
      };
      if (article?._id) {
        await apiService.put(`/news/${article._id}`, payload);
        addToast('Noticia actualizada', 'success');
      } else {
        await apiService.post('/news', payload);
        addToast('Noticia creada', 'success');
      }
      onSaved();
    } catch (err) {
      addToast(err.message || 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto', padding: 0 }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '14px 14px 0 0' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
            {article ? 'Editar Noticia' : 'Nueva Noticia'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8', padding: 4 }}>x</button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Título *</label>
            <input value={form.title} onChange={e => updateField('title', e.target.value)} style={inputStyle} placeholder="Título de la noticia" />
          </div>

          {/* Summary */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Resumen</label>
            <textarea value={form.summary} onChange={e => updateField('summary', e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="Breve resumen (máx. 500 caracteres)" maxLength={500} />
          </div>

          {/* Category + Published */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Categoría</label>
              <select value={form.category} onChange={e => updateField('category', e.target.value)} style={inputStyle}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isPublished} onChange={e => updateField('isPublished', e.target.checked)} />
                Publicar inmediatamente
              </label>
            </div>
          </div>

          {/* Featured Image */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Imagen Destacada</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleImageUpload} style={{ display: 'none' }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 13 }}>
                {uploading ? 'Subiendo...' : 'Seleccionar imagen'}
              </button>
              {form.featuredImage && (
                <>
                  <img src={form.featuredImage} alt="preview" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                  <button onClick={() => updateField('featuredImage', '')} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>
                    Quitar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Content */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Contenido (HTML)</label>
              <button onClick={() => setPreview(!preview)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 12 }}>
                {preview ? 'Editar' : 'Vista Previa'}
              </button>
            </div>
            {preview ? (
              <div
                dangerouslySetInnerHTML={{ __html: form.contentHTML }}
                style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, minHeight: 200, fontSize: 14, lineHeight: 1.7, color: '#334155', background: '#fafafa' }}
              />
            ) : (
              <textarea
                value={form.contentHTML}
                onChange={e => updateField('contentHTML', e.target.value)}
                style={{ ...inputStyle, minHeight: 240, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
                placeholder="<p>Escribe el contenido aquí...</p>"
              />
            )}
          </div>

          {/* Tags */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Etiquetas</label>
            <input value={form.tags} onChange={e => updateField('tags', e.target.value)} style={inputStyle} placeholder="Separadas por coma: comunidad, evento, vecinos" />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8, position: 'sticky', bottom: 0, background: '#fff', borderRadius: '0 0 14px 14px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Guardando...' : article ? 'Guardar Cambios' : 'Crear Noticia'}
          </button>
        </div>
      </div>
    </div>
  );
}
