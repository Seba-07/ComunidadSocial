import { useState, useEffect, useRef } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import Modal from '../../../components/ui/Modal';
import Tabs from '../../../components/ui/Tabs';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export default function EstatutosManagerView() {
  const addToast = useUiStore(s => s.addToast);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editTab, setEditTab] = useState('articulos');
  const [showArticuloModal, setShowArticuloModal] = useState(false);
  const [articuloForm, setArticuloForm] = useState({ numero: '', titulo: '', contenido: '' });
  const [editArticuloIdx, setEditArticuloIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef(null);

  async function loadTemplates() {
    setIsLoading(true);
    try {
      const data = await apiService.get('/estatuto-templates');
      setTemplates(data.templates || data || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadTemplates(); }, []);

  function openEditor(template) {
    setSelectedTemplate(JSON.parse(JSON.stringify(template)));
    setEditTab('articulos');
  }

  function backToList() {
    setSelectedTemplate(null);
  }

  function openArticuloAdd() {
    const arts = selectedTemplate.articulos || [];
    setArticuloForm({ numero: String(arts.length + 1), titulo: '', contenido: '' });
    setEditArticuloIdx(null);
    setShowArticuloModal(true);
  }

  function openArticuloEdit(idx) {
    const art = selectedTemplate.articulos[idx];
    setArticuloForm({ numero: art.numero || '', titulo: art.titulo || '', contenido: art.contenido || '' });
    setEditArticuloIdx(idx);
    setShowArticuloModal(true);
  }

  function saveArticulo() {
    if (!articuloForm.titulo || !articuloForm.contenido) {
      addToast('Título y contenido son requeridos', 'error');
      return;
    }
    setSelectedTemplate(t => {
      const arts = [...(t.articulos || [])];
      if (editArticuloIdx !== null) {
        arts[editArticuloIdx] = { ...arts[editArticuloIdx], ...articuloForm };
      } else {
        arts.push({ ...articuloForm, orden: arts.length });
      }
      return { ...t, articulos: arts };
    });
    setShowArticuloModal(false);
  }

  function deleteArticulo(idx) {
    setSelectedTemplate(t => ({
      ...t,
      articulos: t.articulos.filter((_, i) => i !== idx)
    }));
  }

  function updateCargo(idx, field, value) {
    setSelectedTemplate(t => {
      const dir = t.directorio || { cargos: [], totalRequerido: 5 };
      const cargos = [...(dir.cargos || [])];
      cargos[idx] = { ...cargos[idx], [field]: value };
      return { ...t, directorio: { ...dir, cargos } };
    });
  }

  function addCargo() {
    setSelectedTemplate(t => {
      const dir = t.directorio || { cargos: [], totalRequerido: 5 };
      const cargos = dir.cargos || [];
      const newOrden = cargos.length + 1;
      return {
        ...t,
        directorio: {
          ...dir,
          cargos: [...cargos, { id: `director_${newOrden}`, nombre: 'Director/a', required: false, color: '#6366f1', orden: newOrden }]
        }
      };
    });
  }

  function deleteCargo(idx) {
    setSelectedTemplate(t => {
      const dir = t.directorio || { cargos: [] };
      return { ...t, directorio: { ...dir, cargos: dir.cargos.filter((_, i) => i !== idx) } };
    });
  }

  function addDefaultCargos() {
    setSelectedTemplate(t => ({
      ...t,
      directorio: {
        ...(t.directorio || {}),
        cargos: [
          { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
          { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
          { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
          { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
          { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true, orden: 5 }
        ],
        totalRequerido: 5
      }
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (selectedTemplate._id) {
        await apiService.put(`/estatuto-templates/${selectedTemplate._id}`, selectedTemplate);
      } else {
        await apiService.post('/estatuto-templates', selectedTemplate);
      }
      addToast('Plantilla guardada', 'success');
      loadTemplates();
      backToList();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(template) {
    try {
      await apiService.post(`/estatuto-templates/${template._id}/publicar`);
      addToast(template.publicado ? 'Despublicada' : 'Publicada', 'success');
      loadTemplates();
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  if (isLoading) return <LoadingSpinner text="Cargando estatutos..." />;

  // Editor view
  if (selectedTemplate) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToList} style={{
              padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 8,
              background: 'white', fontSize: 13, cursor: 'pointer'
            }}>Volver</button>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>
              {selectedTemplate.nombreTipo || selectedTemplate.orgType || 'Plantilla'}
            </h1>
          </div>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '10px 20px', border: 'none', borderRadius: 10, background: '#2563eb',
            color: 'white', fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer'
          }}>{saving ? 'Guardando...' : 'Guardar Cambios'}</button>
        </div>

        <Tabs
          tabs={[
            { key: 'articulos', label: 'Artículos' },
            { key: 'directorio', label: 'Directorio' },
            { key: 'config', label: 'Configuración' }
          ]}
          activeTab={editTab}
          onChange={setEditTab}
        />

        <div style={{ marginTop: 20 }}>
          {editTab === 'articulos' && (
            <div>
              <button onClick={openArticuloAdd} style={{
                padding: '8px 16px', border: 'none', borderRadius: 8, background: '#2563eb',
                color: 'white', fontSize: 13, cursor: 'pointer', marginBottom: 16
              }}>Agregar Artículo</button>

              {(selectedTemplate.articulos || []).map((art, i) => (
                <div key={i} style={{
                  background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
                  padding: 16, marginBottom: 8
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                      Art. {art.numero}: {art.titulo}
                    </h4>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openArticuloEdit(i)} style={smallBtn}>Editar</button>
                      <button onClick={() => deleteArticulo(i)} style={{ ...smallBtn, color: '#ef4444' }}>Eliminar</button>
                    </div>
                  </div>
                  <p style={{
                    fontSize: 13, color: '#6b7280', margin: '8px 0 0',
                    maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {art.contenido}
                  </p>
                </div>
              ))}
            </div>
          )}

          {editTab === 'directorio' && (
            <div>
              <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                {[
                  { key: 'minMiembros', label: 'Mínimo miembros para constituir' },
                  { key: 'miembrosComision', label: 'Miembros comisión electoral' },
                  { key: 'duracionMandato', label: 'Duración mandato (años)' }
                ].map(f => (
                  <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ fontSize: 14, fontWeight: 600, minWidth: 250 }}>{f.label}</label>
                    <input type="number" value={selectedTemplate[f.key] || ''}
                      onChange={e => setSelectedTemplate(t => ({ ...t, [f.key]: parseInt(e.target.value) || '' }))}
                      style={{ width: 80, padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Cargos del Directorio</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {!(selectedTemplate.directorio?.cargos?.length) && (
                  <button onClick={addDefaultCargos} style={{
                    padding: '6px 14px', border: 'none', borderRadius: 8, background: '#10b981',
                    color: 'white', fontSize: 13, cursor: 'pointer'
                  }}>Cargar cargos predefinidos</button>
                )}
                <button onClick={addCargo} style={{
                  padding: '6px 14px', border: 'none', borderRadius: 8, background: '#2563eb',
                  color: 'white', fontSize: 13, cursor: 'pointer'
                }}>+ Agregar Cargo</button>
              </div>

              {(selectedTemplate.directorio?.cargos || []).map((cargo, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8,
                  padding: 10, background: '#f9fafb', borderRadius: 8
                }}>
                  <input type="color" value={cargo.color || '#2563eb'}
                    onChange={e => updateCargo(i, 'color', e.target.value)}
                    style={{ width: 32, height: 32, border: 'none', cursor: 'pointer' }} />
                  <input value={cargo.nombre || ''} onChange={e => updateCargo(i, 'nombre', e.target.value)}
                    placeholder="Nombre del cargo"
                    style={{ flex: 1, padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }} />
                  <input value={cargo.id || ''} onChange={e => updateCargo(i, 'id', e.target.value)}
                    placeholder="ID" style={{ width: 100, padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    <input type="checkbox" checked={cargo.required !== false}
                      onChange={e => updateCargo(i, 'required', e.target.checked)} />
                    Req.
                  </label>
                  <button onClick={() => deleteCargo(i)} style={{ ...smallBtn, color: '#ef4444' }}>X</button>
                </div>
              ))}
            </div>
          )}

          {editTab === 'config' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 6 }}>Nombre tipo</label>
                <input value={selectedTemplate.nombreTipo || ''} onChange={e => setSelectedTemplate(t => ({ ...t, nombreTipo: e.target.value }))}
                  style={{ width: '100%', maxWidth: 400, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 6 }}>Descripción</label>
                <textarea value={selectedTemplate.descripcion || ''} onChange={e => setSelectedTemplate(t => ({ ...t, descripcion: e.target.value }))}
                  rows={3} style={{ width: '100%', maxWidth: 600, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, resize: 'vertical' }} />
              </div>
            </div>
          )}
        </div>

        {/* Articulo Modal */}
        <Modal open={showArticuloModal} onClose={() => setShowArticuloModal(false)}
          title={editArticuloIdx !== null ? 'Editar Artículo' : 'Nuevo Artículo'}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Número</label>
              <input value={articuloForm.numero} onChange={e => setArticuloForm(f => ({ ...f, numero: e.target.value }))}
                style={{ width: 100, padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
            </div>
            <div>
              <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Título</label>
              <input value={articuloForm.titulo} onChange={e => setArticuloForm(f => ({ ...f, titulo: e.target.value }))}
                style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
            </div>
            <div>
              <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Contenido</label>
              <textarea value={articuloForm.contenido} onChange={e => setArticuloForm(f => ({ ...f, contenido: e.target.value }))}
                rows={8} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setShowArticuloModal(false)} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={saveArticulo} style={{
              padding: '10px 20px', border: 'none', borderRadius: 10, background: '#2563eb',
              color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer'
            }}>Guardar</button>
          </div>
        </Modal>
      </div>
    );
  }

  // List view
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700, color: '#111827' }}>
        Plantillas de Estatutos
      </h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, fontSize: 13, color: '#6b7280' }}>
        <span>Total: {templates.length}</span>
        <span>Publicadas: {templates.filter(t => t.publicado).length}</span>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {templates.map(t => (
          <div key={t._id} style={{
            background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
            padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>
                  {t.nombreTipo || t.orgType || 'Sin nombre'}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                  background: t.publicado ? '#d1fae5' : '#fee2e2',
                  color: t.publicado ? '#065f46' : '#991b1b'
                }}>
                  {t.publicado ? 'Publicada' : 'Borrador'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 12 }}>
                <span>{(t.articulos || []).length} artículos</span>
                <span>{(t.directorio?.cargos || t.cargos || []).length} cargos</span>
                {t.version && <span>v{t.version}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => togglePublish(t)} style={smallBtn}>
                {t.publicado ? 'Despublicar' : 'Publicar'}
              </button>
              <button onClick={() => openEditor(t)} style={{
                padding: '6px 14px', border: 'none', borderRadius: 6,
                background: '#2563eb', color: 'white', fontSize: 12, cursor: 'pointer'
              }}>Editar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const smallBtn = {
  padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6,
  background: 'white', fontSize: 12, cursor: 'pointer', color: '#374151'
};
