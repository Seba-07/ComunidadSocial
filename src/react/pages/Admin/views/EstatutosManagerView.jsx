import { useState, useEffect, useRef } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import Modal from '../../../components/ui/Modal';
import Tabs from '../../../components/ui/Tabs';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

const PLACEHOLDERS = [
  { key: '{{NOMBRE_ORGANIZACION}}', label: 'Nombre Org.' },
  { key: '{{TIPO_ORGANIZACION}}', label: 'Tipo Org.' },
  { key: '{{OBJETIVOS}}', label: 'Objetivos' },
  { key: '{{COMUNA}}', label: 'Comuna' },
  { key: '{{REGION}}', label: 'Región' },
  { key: '{{DIRECCION}}', label: 'Dirección' },
  { key: '{{MIEMBROS_MINIMOS}}', label: 'Mín. Socios' },
  { key: '{{NUM_MIEMBROS}}', label: 'N° Miembros' },
  { key: '{{CUOTA_MENSUAL}}', label: 'Cuota Mensual' },
  { key: '{{DURACION_MANDATO}}', label: 'Duración Mandato' },
  { key: '{{MESES_ASAMBLEA}}', label: 'Meses Asamblea' },
  { key: '{{METODO_CITACION}}', label: 'Método Citación' },
  { key: '{{DIAS_ANTICIPACION}}', label: 'Días Anticipación' },
  { key: '{{CUOTA_INC}}', label: 'Cuota Incorporación' },
  { key: '{{ENTIDAD_DISOLUCION}}', label: 'Entidad Disolución' },
  { key: '{{RUT_DISOLUCION}}', label: 'RUT Disolución' },
  { key: '{{FECHA_DIA}}', label: 'Día' },
  { key: '{{FECHA_MES}}', label: 'Mes' },
  { key: '{{FECHA_ANIO}}', label: 'Año' },
];

// Datos de ejemplo para la vista previa del estatuto
const SAMPLE_ESTATUTO_DATA = {
  '{{NOMBRE_ORGANIZACION}}': 'Club Deportivo Los Cóndores de Renca',
  '{{TIPO_ORGANIZACION}}': 'Club Deportivo',
  '{{OBJETIVOS}}': 'Fomentar la práctica deportiva entre los vecinos de la comuna, promover la vida sana y la integración comunitaria a través del deporte',
  '{{COMUNA}}': 'Renca',
  '{{REGION}}': 'Metropolitana',
  '{{DIRECCION}}': 'Av. Domingo Santa María 1435, Renca',
  '{{MIEMBROS_MINIMOS}}': '15',
  '{{NUM_MIEMBROS}}': '25',
  '{{CUOTA_MENSUAL}}': '2.000',
  '{{DURACION_MANDATO}}': '3',
  '{{MESES_ASAMBLEA}}': 'marzo y septiembre',
  '{{METODO_CITACION}}': 'carta certificada y publicación en diario mural',
  '{{DIAS_ANTICIPACION}}': '5',
  '{{CUOTA_INC}}': '0,5 UTM',
  '{{ENTIDAD_DISOLUCION}}': 'I. Municipalidad de Renca',
  '{{RUT_DISOLUCION}}': '69.254.100-0',
  '{{FECHA_DIA}}': new Date().getDate().toString(),
  '{{FECHA_MES}}': ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][new Date().getMonth()],
  '{{FECHA_ANIO}}': new Date().getFullYear().toString(),
};

function replaceEstatutoPlaceholders(text) {
  if (!text) return '';
  return text.replace(/\{\{[A-Z_]+\}\}/g, match => SAMPLE_ESTATUTO_DATA[match] || match);
}

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
  const [editingObjIdx, setEditingObjIdx] = useState(null);
  const [objInput, setObjInput] = useState('');
  const [collapsedCats, setCollapsedCats] = useState({});
  const [docTemplateOptions, setDocTemplateOptions] = useState({ acta_constitutiva: [], lista_socios: [], nomina_directorio: [], carta_solicitud: [] });
  const contenidoRef = useRef(null);

  function insertPlaceholder(key) {
    const ta = contenidoRef.current;
    if (!ta) {
      setArticuloForm(f => ({ ...f, contenido: (f.contenido || '') + key }));
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = articuloForm.contenido || '';
    const newText = text.substring(0, start) + key + text.substring(end);
    setArticuloForm(f => ({ ...f, contenido: newText }));
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + key.length;
      ta.focus();
    }, 0);
  }
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

  async function loadDocTemplateOptions() {
    try {
      const types = ['acta_constitutiva', 'lista_socios', 'nomina_directorio', 'carta_solicitud'];
      const results = {};
      for (const type of types) {
        const data = await apiService.getDocumentTemplatesByType(type);
        results[type] = data.templates || [];
      }
      setDocTemplateOptions(results);
    } catch { /* ignore */ }
  }

  useEffect(() => { loadTemplates(); loadDocTemplateOptions(); }, []);

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

  function addObjetivo() {
    if (!objInput.trim()) return;
    setSelectedTemplate(t => ({
      ...t,
      objetivosSugeridos: [...(t.objetivosSugeridos || []), objInput.trim()]
    }));
    setObjInput('');
  }

  function updateObjetivo(idx, value) {
    setSelectedTemplate(t => ({
      ...t,
      objetivosSugeridos: (t.objetivosSugeridos || []).map((o, i) => i === idx ? value : o)
    }));
  }

  function deleteObjetivo(idx) {
    setSelectedTemplate(t => ({
      ...t,
      objetivosSugeridos: (t.objetivosSugeridos || []).filter((_, i) => i !== idx)
    }));
  }

  function moveObjetivo(idx, direction) {
    setSelectedTemplate(t => {
      const objs = [...(t.objetivosSugeridos || [])];
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= objs.length) return t;
      [objs[idx], objs[newIdx]] = [objs[newIdx], objs[idx]];
      return { ...t, objetivosSugeridos: objs };
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
            { key: 'objetivos', label: 'Objetivos' },
            { key: 'config', label: 'Configuración' },
            { key: 'documentos', label: 'Documentos' },
            { key: 'preview', label: 'Vista Previa' }
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, minWidth: 250 }}>Mínimo miembros para constituir</label>
                  <input type="number" value={selectedTemplate.miembrosMinimos ?? ''}
                    onChange={e => setSelectedTemplate(t => ({ ...t, miembrosMinimos: parseInt(e.target.value) || 15 }))}
                    style={{ width: 80, padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, minWidth: 250 }}>Miembros comisión electoral</label>
                  <input type="number" value={selectedTemplate.comisionElectoral?.cantidad ?? ''}
                    onChange={e => setSelectedTemplate(t => ({ ...t, comisionElectoral: { ...(t.comisionElectoral || {}), cantidad: parseInt(e.target.value) || 3 } }))}
                    style={{ width: 80, padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                </div>
              </div>

              {/* Configuración de Mandato */}
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: '20px 0 12px' }}>Configuración de Mandato</h3>
              <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, minWidth: 250 }}>Tipo de mandato</label>
                  <select value={selectedTemplate.mandatoTipo || 'fijo'}
                    onChange={e => setSelectedTemplate(t => ({ ...t, mandatoTipo: e.target.value }))}
                    style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                    <option value="fijo">Fijo (no editable por organizador)</option>
                    <option value="variable">Variable (organizador elige)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, minWidth: 250 }}>
                    {selectedTemplate.mandatoTipo === 'variable' ? 'Opciones de años permitidas' : 'Duración fija (años)'}
                  </label>
                  <input value={(selectedTemplate.mandatoOpciones || [3]).join(', ')}
                    onChange={e => {
                      const nums = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => n > 0 && !isNaN(n));
                      setSelectedTemplate(t => ({
                        ...t,
                        mandatoOpciones: nums.length ? nums : [3],
                        directorio: { ...(t.directorio || {}), duracionMandato: nums[0] || 3 }
                      }));
                    }}
                    placeholder="ej: 1, 2, 3"
                    style={{ width: 160, padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {selectedTemplate.mandatoTipo === 'variable' ? 'separar con comas' : ''}
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input type="checkbox"
                    checked={selectedTemplate.requiereDirectorioProvisorio !== false}
                    onChange={e => setSelectedTemplate(t => ({ ...t, requiereDirectorioProvisorio: e.target.checked }))} />
                  <span style={{ fontWeight: 600 }}>Requiere Directorio Provisorio</span>
                  <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>
                    (si no, el wizard asigna Directorio Definitivo)
                  </span>
                </label>
              </div>

              {/* Configuración de Edad */}
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: '20px 0 12px' }}>Configuración de Edad</h3>
              <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input type="checkbox"
                    checked={selectedTemplate.edadConfig?.permiteMenores !== false}
                    onChange={e => setSelectedTemplate(t => ({
                      ...t,
                      edadConfig: { ...(t.edadConfig || {}), permiteMenores: e.target.checked }
                    }))} />
                  <span style={{ fontWeight: 600 }}>Permite menores de edad</span>
                </label>

                {selectedTemplate.edadConfig?.permiteMenores !== false && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 24 }}>
                      <label style={{ fontSize: 14, fontWeight: 600, minWidth: 250 }}>Edad mínima para ser miembro</label>
                      <input type="number" min={10} max={18}
                        value={selectedTemplate.edadConfig?.edadMinima ?? 14}
                        onChange={e => setSelectedTemplate(t => ({
                          ...t,
                          edadConfig: { ...(t.edadConfig || {}), edadMinima: parseInt(e.target.value) || 14 }
                        }))}
                        style={{ width: 80, padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                      <span style={{ fontSize: 12, color: '#6b7280' }}>años</span>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginLeft: 24 }}>
                      <input type="checkbox"
                        checked={selectedTemplate.edadConfig?.menoresEnDirectorio === true}
                        onChange={e => setSelectedTemplate(t => ({
                          ...t,
                          edadConfig: { ...(t.edadConfig || {}), menoresEnDirectorio: e.target.checked }
                        }))} />
                      Menores pueden integrar el directorio
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginLeft: 24 }}>
                      <input type="checkbox"
                        checked={selectedTemplate.edadConfig?.menoresEnComisionElectoral === true}
                        onChange={e => setSelectedTemplate(t => ({
                          ...t,
                          edadConfig: { ...(t.edadConfig || {}), menoresEnComisionElectoral: e.target.checked }
                        }))} />
                      Menores pueden integrar la comisión electoral
                    </label>
                  </>
                )}
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

          {editTab === 'objetivos' && (
            <div>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                Objetivos sugeridos que aparecen como opciones seleccionables en el wizard de creaci&oacute;n.
                Los usuarios tambi&eacute;n pueden agregar objetivos personalizados.
              </p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  value={objInput}
                  onChange={e => setObjInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addObjetivo(); } }}
                  placeholder="Escribir nuevo objetivo sugerido..."
                  style={{ flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
                />
                <button onClick={addObjetivo} disabled={!objInput.trim()} style={{
                  padding: '10px 18px', border: 'none', borderRadius: 8, background: '#2563eb',
                  color: 'white', fontSize: 13, fontWeight: 600,
                  cursor: objInput.trim() ? 'pointer' : 'not-allowed',
                  opacity: objInput.trim() ? 1 : 0.5
                }}>Agregar</button>
              </div>

              {(selectedTemplate.objetivosSugeridos || []).length === 0 && (
                <div style={{
                  padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14,
                  border: '2px dashed #e5e7eb', borderRadius: 12
                }}>
                  No hay objetivos configurados. Los usuarios ver&aacute;n los objetivos gen&eacute;ricos por defecto.
                </div>
              )}

              {(selectedTemplate.objetivosSugeridos || []).map((obj, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8,
                  padding: '10px 14px', background: '#f9fafb', borderRadius: 8,
                  border: '1px solid #e5e7eb'
                }}>
                  <span style={{ color: '#9ca3af', fontSize: 12, minWidth: 24 }}>{i + 1}.</span>
                  {editingObjIdx === i ? (
                    <input
                      autoFocus
                      value={obj}
                      onChange={e => updateObjetivo(i, e.target.value)}
                      onBlur={() => setEditingObjIdx(null)}
                      onKeyDown={e => { if (e.key === 'Enter') setEditingObjIdx(null); }}
                      style={{ flex: 1, padding: 8, border: '1px solid #93c5fd', borderRadius: 6, fontSize: 13 }}
                    />
                  ) : (
                    <span
                      onClick={() => setEditingObjIdx(i)}
                      style={{ flex: 1, fontSize: 13, color: '#374151', cursor: 'text', lineHeight: 1.4 }}
                    >{obj}</span>
                  )}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => moveObjetivo(i, -1)} disabled={i === 0}
                      style={{ ...smallBtn, opacity: i === 0 ? 0.3 : 1, padding: '4px 8px' }}
                      title="Mover arriba">&#9650;</button>
                    <button onClick={() => moveObjetivo(i, 1)}
                      disabled={i === (selectedTemplate.objetivosSugeridos || []).length - 1}
                      style={{ ...smallBtn, opacity: i === (selectedTemplate.objetivosSugeridos || []).length - 1 ? 0.3 : 1, padding: '4px 8px' }}
                      title="Mover abajo">&#9660;</button>
                    <button onClick={() => deleteObjetivo(i)} style={{ ...smallBtn, color: '#ef4444' }}>X</button>
                  </div>
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

          {editTab === 'preview' && (
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16, padding: '8px 12px', background: '#eff6ff', borderRadius: 8 }}>
                Vista previa del estatuto con datos de ejemplo. Así se vería el documento final con los campos dinámicos reemplazados.
              </div>
              <div style={{
                maxWidth: 800, margin: '0 auto', background: '#fff',
                border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                padding: '40px 48px',
              }}>
                {/* Title */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                  <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 1, marginBottom: 8 }}>
                    ESTATUTO
                  </div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
                    {replaceEstatutoPlaceholders('{{NOMBRE_ORGANIZACION}}')}
                  </h2>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    {replaceEstatutoPlaceholders('{{TIPO_ORGANIZACION}}')} — {replaceEstatutoPlaceholders('{{COMUNA}}')}
                  </div>
                </div>

                {/* Articles */}
                {(selectedTemplate.articulos || []).length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14, border: '2px dashed #e5e7eb', borderRadius: 12 }}>
                    No hay artículos configurados. Agrega artículos en la pestaña "Artículos" para verlos aquí.
                  </div>
                ) : (
                  (selectedTemplate.articulos || [])
                    .sort((a, b) => (Number(a.numero) || a.orden || 0) - (Number(b.numero) || b.orden || 0))
                    .map((art, i) => (
                    <div key={i} style={{ marginBottom: 24 }}>
                      <h3 style={{
                        fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 8px',
                        borderBottom: '1px solid #f1f5f9', paddingBottom: 6,
                      }}>
                        Artículo {art.numero}° — {art.titulo}
                      </h3>
                      <div style={{
                        fontSize: 13, color: '#374151', lineHeight: 1.8,
                        whiteSpace: 'pre-wrap', textAlign: 'justify',
                      }}>
                        {replaceEstatutoPlaceholders(art.contenido)}
                      </div>
                    </div>
                  ))
                )}

                {/* Footer */}
                <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {replaceEstatutoPlaceholders('{{COMUNA}}')}, {replaceEstatutoPlaceholders('{{FECHA_DIA}}')} de {replaceEstatutoPlaceholders('{{FECHA_MES}}')} del {replaceEstatutoPlaceholders('{{FECHA_ANIO}}')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {editTab === 'documentos' && (
            <div style={{ display: 'grid', gap: 16, maxWidth: 600 }}>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                Asigna qué plantilla de documento PDF se usará para cada tipo de documento al crear organizaciones de este tipo.
              </p>
              {[
                { key: 'actaTemplateId', label: 'Acta Constitutiva', type: 'acta_constitutiva' },
                { key: 'sociosTemplateId', label: 'Lista de Socios', type: 'lista_socios' },
                { key: 'nominaTemplateId', label: 'Nómina del Directorio', type: 'nomina_directorio' },
                { key: 'cartaTemplateId', label: 'Carta de Solicitud', type: 'carta_solicitud' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 6 }}>{field.label}</label>
                  <select
                    value={selectedTemplate[field.key] || ''}
                    onChange={e => setSelectedTemplate(t => ({ ...t, [field.key]: e.target.value || null }))}
                    style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
                  >
                    <option value="">— Sin asignar (usa texto por defecto) —</option>
                    {(docTemplateOptions[field.type] || []).map(dt => (
                      <option key={dt._id} value={dt._id}>
                        {dt.name}{dt.isDefault ? ' (por defecto)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
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
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>Insertar campo dinámico:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {PLACEHOLDERS.map(p => (
                    <button key={p.key} type="button" title={p.key}
                      onClick={() => insertPlaceholder(p.key)}
                      style={{
                        padding: '3px 8px', fontSize: 11, borderRadius: 4,
                        border: '1px solid #bfdbfe', background: '#eff6ff',
                        color: '#1d4ed8', cursor: 'pointer', fontWeight: 500
                      }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea ref={contenidoRef} value={articuloForm.contenido} onChange={e => setArticuloForm(f => ({ ...f, contenido: e.target.value }))}
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

  // List view — group templates by category
  const CATEGORY_LABELS = {
    TERRITORIAL: 'Organizaciones Territoriales',
    FUNCIONAL: 'Organizaciones Funcionales',
    SOCIAL: 'Social',
    CULTURAL: 'Arte y Cultura',
    EDUCACIONAL: 'Educacionales',
    OTRO: 'Otros'
  };

  const CATEGORY_ORDER = ['TERRITORIAL', 'FUNCIONAL', 'SOCIAL', 'CULTURAL', 'EDUCACIONAL', 'OTRO'];

  const grouped = {};
  templates.forEach(t => {
    const cat = t.categoria || 'OTRO';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  });

  const sortedCategories = CATEGORY_ORDER.filter(c => grouped[c]?.length);
  // Add any unlisted categories
  Object.keys(grouped).forEach(c => { if (!sortedCategories.includes(c)) sortedCategories.push(c); });

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700, color: '#111827' }}>
        Plantillas de Estatutos
      </h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, fontSize: 13, color: '#6b7280' }}>
        <span>Total: {templates.length}</span>
        <span>Publicadas: {templates.filter(t => t.publicado).length}</span>
      </div>

      {sortedCategories.map(cat => {
        const collapsed = collapsedCats[cat];
        return (
        <div key={cat} style={{ marginBottom: 16 }}>
          <button onClick={() => setCollapsedCats(s => ({ ...s, [cat]: !s[cat] }))} style={{
            width: '100%', textAlign: 'left', fontSize: 15, fontWeight: 700, color: '#374151',
            margin: 0, padding: '10px 14px', background: '#f3f4f6', borderRadius: 8,
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
          }}>
            <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>&#9660;</span>
            {CATEGORY_LABELS[cat] || cat}
            <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 13 }}>
              ({grouped[cat].length})
            </span>
          </button>
          {!collapsed && <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {grouped[cat].map(t => (
              <div key={t._id} style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
                padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
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
                  <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 12 }}>
                    <span>{(t.articulos || []).length} artículos</span>
                    <span>{(t.directorio?.cargos || []).filter(c => c.required).length}/{(t.directorio?.cargos || []).length} cargos</span>
                    <span>{(t.objetivosSugeridos || []).length} objetivos</span>
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
          </div>}
        </div>
        );
      })}
    </div>
  );
}

const smallBtn = {
  padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6,
  background: 'white', fontSize: 12, cursor: 'pointer', color: '#374151'
};
