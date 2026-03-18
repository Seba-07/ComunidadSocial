import { useState, useRef, useEffect, useCallback } from 'react';
import { ESTATUTO_VARIABLES, resolveVariable } from '../../pages/Wizard/steps/estatutoVariables';

const CITACION_LABELS = {
  carta_certificada: 'carta certificada al domicilio registrado',
  correo_electronico: 'correo electrónico al correo registrado',
  mensajeria_instantanea: 'mensajería instantánea (ej: WhatsApp) al número registrado',
  entrega_personal: 'entrega personal por escrito a cada socio',
  aviso_sede: 'aviso publicado en la sede de la organización',
  comunicacion_directa: 'comunicación directa a cada socio'
};

export default function EstatutoEditor({ articles, replacePlaceholders, formData, templateConfig, onChange }) {
  // Initialize edited articles from pre-filled template
  const [editedArticles, setEditedArticles] = useState(() =>
    articles.map(art => ({
      numero: art.numero,
      titulo: art.titulo,
      orden: art.orden || art.numero,
      contenido: replacePlaceholders(art.contenido || '')
    }))
  );

  const [expandedArt, setExpandedArt] = useState(0); // First article expanded
  const textareaRefs = useRef({});
  const lastFocusedRef = useRef(null);

  // Notify parent on every edit
  useEffect(() => {
    onChange(editedArticles);
  }, [editedArticles]);

  const handleContentChange = useCallback((index, value) => {
    setEditedArticles(prev => prev.map((a, i) => i === index ? { ...a, contenido: value } : a));
  }, []);

  function insertAtCursor(text) {
    const idx = lastFocusedRef.current;
    if (idx == null) {
      // No focused textarea, expand and focus the first one
      setExpandedArt(0);
      lastFocusedRef.current = 0;
      setEditedArticles(prev => prev.map((a, i) => i === 0 ? { ...a, contenido: a.contenido + text } : a));
      return;
    }

    const textarea = textareaRefs.current[idx];
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = editedArticles[idx].contenido;
    const newContent = current.substring(0, start) + text + current.substring(end);

    handleContentChange(idx, newContent);

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + text.length;
      textarea.setSelectionRange(pos, pos);
    });
  }

  // Build variable status: present/missing in full text
  const fullText = editedArticles.map(a => a.contenido).join('\n');
  const variableStatus = ESTATUTO_VARIABLES.map(v => {
    const resolved = resolveVariable(v.key, formData, templateConfig, CITACION_LABELS);
    const isUnfilled = resolved === '_______________';
    const present = !isUnfilled && fullText.includes(resolved);
    return { ...v, resolved, present, isUnfilled };
  });

  const missingRequired = variableStatus.filter(v => v.required && !v.present && !v.isUnfilled);

  return (
    <div className="r-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
      {/* Left: Article Editor */}
      <div style={{
        background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
        maxHeight: 600, overflowY: 'auto'
      }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 1, background: 'white',
          padding: '14px 20px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>
            Editor de Estatutos
          </h3>
          {missingRequired.length > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 600, color: '#dc2626',
              background: '#fef2f2', padding: '4px 10px', borderRadius: 6
            }}>
              {missingRequired.length} variable{missingRequired.length !== 1 ? 's' : ''} faltante{missingRequired.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div style={{ padding: '12px 20px' }}>
          {editedArticles.map((art, i) => {
            const isExpanded = expandedArt === i;
            return (
              <div key={art.numero} style={{
                marginBottom: 8, border: '1px solid #e5e7eb', borderRadius: 10,
                overflow: 'hidden'
              }}>
                {/* Article header - clickable to expand/collapse */}
                <div
                  onClick={() => setExpandedArt(isExpanded ? -1 : i)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center',
                    background: isExpanded ? '#f0f5ff' : '#f9fafb'
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: isExpanded ? '#1e40af' : '#374151' }}>
                    Artículo {art.numero}: {art.titulo}
                  </span>
                  <span style={{ fontSize: 18, color: '#6b7280', lineHeight: 1 }}>
                    {isExpanded ? '\u2212' : '+'}
                  </span>
                </div>

                {/* Textarea */}
                {isExpanded && (
                  <div style={{ padding: '0 14px 14px' }}>
                    <textarea
                      ref={el => { textareaRefs.current[i] = el; }}
                      value={art.contenido}
                      onChange={e => handleContentChange(i, e.target.value)}
                      onFocus={() => { lastFocusedRef.current = i; }}
                      style={{
                        width: '100%', minHeight: 150, padding: 12, border: '1px solid #d1d5db',
                        borderRadius: 8, fontSize: 13, lineHeight: 1.7, color: '#374151',
                        resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit'
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Variable Panel */}
      <div style={{
        background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
        maxHeight: 600, overflowY: 'auto', position: 'sticky', top: 0
      }}>
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid #e5e7eb',
          position: 'sticky', top: 0, background: 'white', zIndex: 1
        }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>
            Variables del Estatuto
          </h4>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>
            Clic en una variable para insertarla en el editor
          </p>
        </div>

        <div style={{ padding: '8px 12px' }}>
          {variableStatus.map(v => (
            <div
              key={v.key}
              onClick={() => !v.isUnfilled && insertAtCursor(v.resolved)}
              style={{
                padding: '8px 10px', marginBottom: 4, borderRadius: 8,
                cursor: v.isUnfilled ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                background: v.isUnfilled ? '#f9fafb' : v.present ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${v.isUnfilled ? '#e5e7eb' : v.present ? '#bbf7d0' : '#fecaca'}`,
                transition: 'all 0.15s',
                opacity: v.isUnfilled ? 0.6 : 1
              }}
              title={v.isUnfilled ? 'Sin valor configurado' : v.present ? 'Presente en el texto' : 'Clic para insertar'}
            >
              {/* Status icon */}
              <span style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                background: v.isUnfilled ? '#e5e7eb' : v.present ? '#10b981' : '#ef4444',
                color: 'white'
              }}>
                {v.isUnfilled ? '—' : v.present ? '✓' : '✗'}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600,
                  color: v.isUnfilled ? '#9ca3af' : v.present ? '#065f46' : '#991b1b'
                }}>
                  {v.label}
                  {v.required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
                </div>
                <div style={{
                  fontSize: 11, color: '#6b7280',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {v.isUnfilled ? 'Sin valor' : v.resolved}
                </div>
              </div>

              {/* Insert hint */}
              {!v.isUnfilled && !v.present && (
                <span style={{ fontSize: 11, color: '#dc2626', flexShrink: 0 }}>+ Insertar</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
