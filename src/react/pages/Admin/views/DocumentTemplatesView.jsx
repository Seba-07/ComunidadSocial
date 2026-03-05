import { useState, useEffect, useRef } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

const DOCUMENT_TYPES = [
  { key: 'all', label: 'Todas' },
  { key: 'acta_constitutiva', label: 'Acta Constitutiva' },
  { key: 'lista_socios', label: 'Lista de Socios' },
  { key: 'nomina_directorio', label: 'Nómina Directorio' },
  { key: 'carta_solicitud', label: 'Carta de Solicitud' },
];

const TYPE_LABELS = {
  acta_constitutiva: 'Acta Constitutiva',
  lista_socios: 'Lista de Socios',
  nomina_directorio: 'Nómina Directorio',
  carta_solicitud: 'Carta de Solicitud',
};

const TYPE_COLORS = {
  acta_constitutiva: '#2563eb',
  lista_socios: '#059669',
  nomina_directorio: '#7c3aed',
  carta_solicitud: '#d97706',
};

const SAMPLE_DATA = {
  NOMBRE_ORG: 'Club Deportivo Los Cóndores',
  TIPO_ORG: 'Club Deportivo',
  DIRECCION: 'Av. Principal 1234',
  COMUNA: 'Renca',
  REGION: 'Metropolitana',
  UNIDAD_VECINAL: 'UV 12 - Los Álamos',
  EMAIL: 'contacto@condores.cl',
  TELEFONO: '+56 9 1234 5678',
  OBJETIVOS: 'Promover el deporte y la vida sana en la comunidad',
  TOTAL_SOCIOS: '25',
  LISTA_SOCIOS: 'María González (12.456.789-0), Juan Pérez (11.234.567-1), ...',
  PRESIDENTE: 'María González Soto',
  RUT_PRESIDENTE: '12.456.789-0',
  SECRETARIO: 'Juan Pérez López',
  RUT_SECRETARIO: '11.234.567-1',
  TESORERO: 'Carmen Muñoz Díaz',
  RUT_TESORERO: '13.678.901-5',
  DIRECTORES: 'Roberto Silva (10.987.654-2), Patricia Rojas (14.321.098-7)',
  COMISION_ELECTORAL: 'Francisco Hernández (9.876.543-3), Andrea López (15.432.109-8), Miguel Torres (8.765.432-K)',
  FECHA_ASAMBLEA: '15 de marzo del 2026',
  HORA_ASAMBLEA: '10:00',
  DURACION_MANDATO: '3',
  CUOTA_INCORPORACION: '0.5',
  FECHA_HOY: new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }),
  MINISTRO_FE: 'Carlos Ramírez Torres',
  UBICACION_ASAMBLEA: 'Blanco Encalada 1335, Renca',
};

function replacePlaceholders(content, data) {
  if (!content) return '';
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || `{{${key}}}`);
}

export default function DocumentTemplatesView() {
  const addToast = useUiStore(s => s.addToast);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editTab, setEditTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [placeholders, setPlaceholders] = useState([]);
  const contentRef = useRef(null);

  async function loadTemplates() {
    setIsLoading(true);
    try {
      const data = await apiService.get('/document-templates');
      setTemplates(data.templates || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPlaceholders() {
    try {
      const data = await apiService.get('/document-templates/placeholders');
      setPlaceholders(data.placeholders || []);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadTemplates();
    loadPlaceholders();
  }, []);

  function openEditor(tmpl) {
    setSelected(JSON.parse(JSON.stringify(tmpl)));
    setEditTab('general');
  }

  function createNew() {
    setSelected({
      _id: null,
      name: '',
      documentType: 'acta_constitutiva',
      content: '',
      isDefault: false
    });
    setEditTab('general');
  }

  async function handleSave() {
    if (!selected.name?.trim()) {
      addToast('El nombre es requerido', 'error');
      return;
    }
    setSaving(true);
    try {
      if (selected._id) {
        const data = await apiService.put(`/document-templates/${selected._id}`, selected);
        addToast('Plantilla actualizada', 'success');
        setSelected(data.template);
      } else {
        const data = await apiService.post('/document-templates', selected);
        addToast('Plantilla creada', 'success');
        setSelected(data.template);
      }
      loadTemplates();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(tmpl) {
    try {
      await apiService.post(`/document-templates/${tmpl._id}/duplicate`);
      addToast('Plantilla duplicada', 'success');
      loadTemplates();
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function handleDelete(tmpl) {
    if (!confirm(`¿Eliminar "${tmpl.name}"?`)) return;
    try {
      await apiService.delete(`/document-templates/${tmpl._id}`);
      addToast('Plantilla eliminada', 'success');
      if (selected?._id === tmpl._id) setSelected(null);
      loadTemplates();
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  function insertPlaceholder(key) {
    const ta = contentRef.current;
    const placeholder = `{{${key}}}`;
    if (!ta) {
      setSelected(s => ({ ...s, content: (s.content || '') + placeholder }));
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = selected.content || '';
    const newText = text.substring(0, start) + placeholder + text.substring(end);
    setSelected(s => ({ ...s, content: newText }));
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + placeholder.length;
      ta.focus();
    }, 0);
  }

  const filtered = templates.filter(t => filterType === 'all' || t.documentType === filterType);

  // ============================================
  // EDITOR VIEW
  // ============================================
  if (selected) {
    const tabs = [
      { key: 'general', label: 'General' },
      { key: 'contenido', label: 'Contenido' },
      { key: 'preview', label: 'Vista Previa' },
    ];

    return (
      <div style={{ padding: 24, maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => setSelected(null)} style={btnOutline}>
            ← Volver
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>
            {selected._id ? 'Editar Plantilla' : 'Nueva Plantilla'}
          </h2>
          <div style={{ flex: 1 }} />
          <button onClick={handleSave} disabled={saving} style={btnPrimary}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 0 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setEditTab(t.key)}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                border: 'none', background: 'none',
                borderBottom: editTab === t.key ? '2px solid #2563eb' : '2px solid transparent',
                color: editTab === t.key ? '#2563eb' : '#64748b',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: General */}
        {editTab === 'general' && (
          <div style={cardStyle}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nombre</label>
              <input
                type="text"
                value={selected.name || ''}
                onChange={e => setSelected(s => ({ ...s, name: e.target.value }))}
                style={inputStyle}
                placeholder="Ej: Acta Constitutiva - Estándar 19.418"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Tipo de documento</label>
              <select
                value={selected.documentType || 'acta_constitutiva'}
                onChange={e => setSelected(s => ({ ...s, documentType: e.target.value }))}
                style={inputStyle}
              >
                {DOCUMENT_TYPES.filter(t => t.key !== 'all').map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={selected.isDefault || false}
                onChange={e => setSelected(s => ({ ...s, isDefault: e.target.checked }))}
                id="isDefault"
              />
              <label htmlFor="isDefault" style={{ fontSize: 14, color: '#334155' }}>
                Plantilla por defecto para este tipo
              </label>
            </div>
          </div>
        )}

        {/* Tab: Contenido */}
        {editTab === 'contenido' && (
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={cardStyle}>
                <label style={labelStyle}>Contenido (texto con placeholders)</label>
                <textarea
                  ref={contentRef}
                  value={selected.content || ''}
                  onChange={e => setSelected(s => ({ ...s, content: e.target.value }))}
                  style={{
                    ...inputStyle,
                    fontFamily: 'monospace',
                    fontSize: 13,
                    minHeight: 500,
                    resize: 'vertical',
                    lineHeight: 1.6,
                  }}
                  placeholder="Escribe el contenido de la plantilla usando {{VARIABLE}} para datos dinámicos..."
                />
              </div>
            </div>
            <div style={{ width: 240, flexShrink: 0 }}>
              <div style={{ ...cardStyle, position: 'sticky', top: 80 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>
                  Variables disponibles
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                  Click para insertar en el cursor
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 500, overflowY: 'auto' }}>
                  {placeholders.map(p => (
                    <button
                      key={p.key}
                      onClick={() => insertPlaceholder(p.key)}
                      title={p.description}
                      style={{
                        padding: '4px 8px', fontSize: 12, textAlign: 'left',
                        border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc',
                        cursor: 'pointer', color: '#334155', fontFamily: 'monospace',
                      }}
                    >
                      {`{{${p.key}}}`}
                      <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', fontFamily: 'inherit' }}>
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Vista Previa */}
        {editTab === 'preview' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, padding: '8px 12px', background: '#eff6ff', borderRadius: 8 }}>
              Vista previa con datos de ejemplo. Los placeholders sin datos se muestran en su forma original.
            </div>
            <div style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'serif',
              fontSize: 14,
              lineHeight: 1.8,
              color: '#1e293b',
              padding: 20,
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              background: '#fff',
              minHeight: 400,
            }}>
              {replacePlaceholders(selected.content, SAMPLE_DATA) || '(Sin contenido)'}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // LIST VIEW
  // ============================================
  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>
          Plantillas de Documentos
        </h2>
        <div style={{ flex: 1 }} />
        <button onClick={createNew} style={btnPrimary}>
          + Nueva Plantilla
        </button>
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {DOCUMENT_TYPES.map(t => (
          <button
            key={t.key}
            onClick={() => setFilterType(t.key)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              border: filterType === t.key ? '1px solid #2563eb' : '1px solid #e2e8f0',
              background: filterType === t.key ? '#2563eb' : '#fff',
              color: filterType === t.key ? '#fff' : '#475569',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner text="Cargando plantillas..." />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          No hay plantillas{filterType !== 'all' ? ' de este tipo' : ''}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map(tmpl => (
            <div key={tmpl._id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>
                    {tmpl.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      background: (TYPE_COLORS[tmpl.documentType] || '#64748b') + '18',
                      color: TYPE_COLORS[tmpl.documentType] || '#64748b',
                    }}>
                      {TYPE_LABELS[tmpl.documentType] || tmpl.documentType}
                    </span>
                    {tmpl.isDefault && (
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: '#dcfce7', color: '#16a34a',
                      }}>
                        Por defecto
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {tmpl.content && (
                <div style={{
                  fontSize: 12, color: '#64748b', lineHeight: 1.4, marginBottom: 10,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {tmpl.content.substring(0, 200)}...
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                <button onClick={() => openEditor(tmpl)} style={btnSmall}>Editar</button>
                <button onClick={() => handleDuplicate(tmpl)} style={btnSmallOutline}>Duplicar</button>
                <button onClick={() => handleDelete(tmpl)} style={{ ...btnSmallOutline, color: '#ef4444', borderColor: '#fecaca' }}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// STYLES
// ============================================

const cardStyle = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
};

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 6,
};

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const btnPrimary = {
  padding: '8px 18px',
  borderRadius: 8,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnOutline = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#374151',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
};

const btnSmall = {
  padding: '5px 12px',
  borderRadius: 6,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
};

const btnSmallOutline = {
  padding: '5px 12px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#374151',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
};
