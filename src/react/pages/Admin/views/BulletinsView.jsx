import { useState, useEffect } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import SearchBar from '../../../components/ui/SearchBar';

const AUDIENCE_OPTIONS = [
  { value: 'TODAS', label: 'Todas las Organizaciones' },
  { value: 'JUNTA_VECINOS', label: 'Juntas de Vecinos' },
  { value: 'CLUB_DEPORTIVO', label: 'Clubes Deportivos' },
  { value: 'CLUB_ADULTO_MAYOR', label: 'Clubes de Adulto Mayor' },
  { value: 'CLUB_JUVENIL', label: 'Clubes Juveniles' },
  { value: 'CLUB_CULTURAL', label: 'Clubes Culturales' },
  { value: 'CENTRO_MADRES', label: 'Centros de Madres' },
  { value: 'CENTRO_PADRES', label: 'Centros de Padres' },
  { value: 'COMITE_VIVIENDA', label: 'Comités de Vivienda' },
  { value: 'COMITE_ALLEGADOS', label: 'Comités de Allegados' },
  { value: 'COMITE_APR', label: 'Comités APR' },
  { value: 'ORG_COMUNITARIA', label: 'Organizaciones Comunitarias' },
  { value: 'ORG_FUNCIONAL', label: 'Organizaciones Funcionales' },
  { value: 'DIRECTIVAS_VENCIDAS', label: 'Directivas Vencidas' }
];

const AUDIENCE_LABELS = Object.fromEntries(AUDIENCE_OPTIONS.map(o => [o.value, o.label]));

function formatDateShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function BulletinsView() {
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const addToast = useUiStore(s => s.addToast);

  useEffect(() => { loadBulletins(); }, []);

  async function loadBulletins() {
    setLoading(true);
    try {
      const res = await apiService.get('/bulletins/admin');
      setBulletins(res.data || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este comunicado?')) return;
    try {
      await apiService.delete(`/bulletins/${id}`);
      setBulletins(prev => prev.filter(b => b._id !== id));
      addToast('Comunicado eliminado', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  const filtered = searchQuery.trim()
    ? bulletins.filter(b =>
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : bulletins;

  if (loading) return <LoadingSpinner text="Cargando comunicados..." />;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' }}>Comunicados Oficiales</h1>
        <button onClick={() => setShowCreate(true)} style={{
          padding: '10px 20px', border: 'none', borderRadius: 10, background: '#1e40af',
          color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
        }}>
          + Redactar Nuevo Comunicado
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <span style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Total</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: '#2563eb' }}>{bulletins.length}</span>
        </div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <span style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Este mes</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: '#059669' }}>
            {bulletins.filter(b => {
              const d = new Date(b.createdAt);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Buscar comunicados..." />
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
          <p style={{ fontSize: 40, margin: '0 0 12px' }}>{'\uD83D\uDCE2'}</p>
          <p style={{ fontSize: 16 }}>{bulletins.length === 0 ? 'No hay comunicados enviados' : 'Sin resultados'}</p>
          {bulletins.length === 0 && (
            <p style={{ fontSize: 13, marginTop: 8 }}>Redacta el primer comunicado oficial para las organizaciones</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(b => {
            const isExpanded = expandedId === b._id;
            return (
              <div key={b._id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : b._id)}
                  style={{ padding: 20, cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{b.title}</span>
                        <span style={{
                          fontSize: 11, padding: '2px 10px', borderRadius: 10, fontWeight: 600,
                          background: b.targetAudience === 'TODAS' ? '#dbeafe' : b.targetAudience === 'DIRECTIVAS_VENCIDAS' ? '#fef2f2' : '#f0fdf4',
                          color: b.targetAudience === 'TODAS' ? '#1e40af' : b.targetAudience === 'DIRECTIVAS_VENCIDAS' ? '#991b1b' : '#065f46',
                          border: `1px solid ${b.targetAudience === 'TODAS' ? '#bfdbfe' : b.targetAudience === 'DIRECTIVAS_VENCIDAS' ? '#fecaca' : '#bbf7d0'}`
                        }}>
                          {AUDIENCE_LABELS[b.targetAudience] || b.targetAudience}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span>{formatDateShort(b.createdAt)}</span>
                        {b.author && <span>por {b.author.firstName} {b.author.lastName}</span>}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(b._id); }}
                      style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #fca5a5', borderRadius: 6, background: 'white', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}
                    >
                      Eliminar
                    </button>
                  </div>
                  {!isExpanded && b.content && (
                    <p style={{ margin: '8px 0 0', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                      {b.content.length > 150 ? b.content.slice(0, 150) + '...' : b.content}
                    </p>
                  )}
                </div>
                {isExpanded && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f3f4f6' }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: '#374151', lineHeight: 1.7, paddingTop: 16 }}>
                      {b.content}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateBulletinModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadBulletins(); }}
          addToast={addToast}
        />
      )}
    </div>
  );
}

function CreateBulletinModal({ onClose, onCreated, addToast }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetAudience, setTargetAudience] = useState('TODAS');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { addToast('Ingresa un título', 'error'); return; }
    if (!content.trim()) { addToast('Ingresa el contenido del comunicado', 'error'); return; }

    setSubmitting(true);
    try {
      await apiService.post('/bulletins', { title: title.trim(), content: content.trim(), targetAudience });
      addToast('Comunicado enviado exitosamente', 'success');
      onCreated();
    } catch (err) {
      addToast(err.message || 'Error al enviar', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Redactar Comunicado Oficial</h3>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#6b7280' }}>
            Este comunicado será visible para las organizaciones que coincidan con la audiencia seleccionada.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Título *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Convocatoria a Capacitación de Dirigentes"
              style={{ width: '100%', padding: '12px 14px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 15, boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Dirigido a *</label>
            <select value={targetAudience} onChange={e => setTargetAudience(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 15, boxSizing: 'border-box', background: 'white' }}>
              {AUDIENCE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Contenido del Comunicado *</label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder="Escriba el contenido del comunicado oficial..."
              rows={10}
              style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 15, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }} />
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13, color: '#1e40af', lineHeight: 1.5 }}>
            {targetAudience === 'TODAS'
              ? 'Este comunicado será visible para todas las organizaciones aprobadas.'
              : targetAudience === 'DIRECTIVAS_VENCIDAS'
              ? 'Este comunicado será visible solo para organizaciones cuya directiva haya vencido.'
              : `Este comunicado será visible para organizaciones de tipo "${AUDIENCE_LABELS[targetAudience]}".`}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: 14, background: '#f3f4f6', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
              Cancelar
            </button>
            <button type="submit" disabled={submitting}
              style={{ flex: 1, padding: 14, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff', background: '#1e40af', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Enviando...' : 'Enviar Comunicado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
