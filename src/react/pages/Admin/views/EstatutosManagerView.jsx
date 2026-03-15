import { useState, useEffect, useRef } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import Modal from '../../../components/ui/Modal';
import Tabs from '../../../components/ui/Tabs';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import tenant from '../../../../config/tenant.js';

// Tipos de organización disponibles con sus nombres y categorías
const TIPOS_ORGANIZACION = {
  // Territoriales
  'JUNTA_VECINOS': { nombre: 'Junta de Vecinos', categoria: 'TERRITORIAL' },
  'COMITE_VECINOS': { nombre: 'Comite de Vecinos', categoria: 'TERRITORIAL' },
  'COMITE_ADELANTO': { nombre: 'Comite de Adelanto', categoria: 'TERRITORIAL' },
  'COMITE_MEJORAMIENTO': { nombre: 'Comite de Mejoramiento', categoria: 'TERRITORIAL' },
  'COMITE_CONVIVENCIA': { nombre: 'Comite de Convivencia Vecinal', categoria: 'TERRITORIAL' },
  'UNION_COMUNAL_JV': { nombre: 'Union Comunal de Juntas de Vecinos', categoria: 'TERRITORIAL' },
  // Funcional
  'CLUB_DEPORTIVO': { nombre: 'Club Deportivo', categoria: 'FUNCIONAL' },
  'AGRUPACION_AMBIENTAL': { nombre: 'Agrupacion Ambiental', categoria: 'FUNCIONAL' },
  'AGRUPACION_EMPRENDEDORES': { nombre: 'Agrupacion de Emprendedores', categoria: 'FUNCIONAL' },
  'COMITE_VIVIENDA': { nombre: 'Comite de Vivienda', categoria: 'FUNCIONAL' },
  'COMITE_ALLEGADOS': { nombre: 'Comite de Allegados', categoria: 'FUNCIONAL' },
  'COMITE_APR': { nombre: 'Comite de Agua Potable Rural', categoria: 'FUNCIONAL' },
  'COMITE_SEGURIDAD': { nombre: 'Comite de Seguridad Ciudadana', categoria: 'FUNCIONAL' },
  'ORG_COMUNITARIA': { nombre: 'Organizacion Comunitaria', categoria: 'FUNCIONAL' },
  'ORG_FUNCIONAL': { nombre: 'Organizacion Funcional', categoria: 'FUNCIONAL' },
  'OTRA_FUNCIONAL': { nombre: 'Otra Organizacion Funcional', categoria: 'FUNCIONAL' },
  // Social
  'CLUB_ADULTO_MAYOR': { nombre: 'Club de Adulto Mayor', categoria: 'SOCIAL' },
  'CLUB_JUVENIL': { nombre: 'Club Juvenil', categoria: 'SOCIAL' },
  'CENTRO_MADRES': { nombre: 'Centro de Madres', categoria: 'SOCIAL' },
  'AGRUPACION_JUVENIL': { nombre: 'Agrupacion Juvenil', categoria: 'SOCIAL' },
  'ORG_SCOUT': { nombre: 'Organizacion Scout', categoria: 'SOCIAL' },
  'ORG_MUJERES': { nombre: 'Organizacion de Mujeres', categoria: 'SOCIAL' },
  'ORG_SALUD': { nombre: 'Organizacion de Salud', categoria: 'SOCIAL' },
  'ORG_SOCIAL': { nombre: 'Organizacion Social', categoria: 'SOCIAL' },
  'AGRUPACION_INCLUSION': { nombre: 'Agrupacion de Inclusion / Discapacidad', categoria: 'SOCIAL' },
  // Cultural
  'CLUB_CULTURAL': { nombre: 'Club Cultural', categoria: 'CULTURAL' },
  'CENTRO_CULTURAL': { nombre: 'Centro Cultural', categoria: 'CULTURAL' },
  'AGRUPACION_FOLCLORICA': { nombre: 'Agrupacion Folclorica', categoria: 'CULTURAL' },
  'AGRUPACION_CULTURAL': { nombre: 'Agrupacion Cultural', categoria: 'CULTURAL' },
  'ORG_INDIGENA': { nombre: 'Organizacion Indigena', categoria: 'CULTURAL' },
  'ORG_CULTURAL': { nombre: 'Organizacion Cultural', categoria: 'CULTURAL' },
  'GRUPO_TEATRO': { nombre: 'Grupo de Teatro', categoria: 'CULTURAL' },
  'CORO': { nombre: 'Coro', categoria: 'CULTURAL' },
  'TALLER_ARTESANIA': { nombre: 'Taller de Artesania', categoria: 'CULTURAL' },
  // Educacional
  'CENTRO_PADRES': { nombre: 'Centro de Padres y Apoderados', categoria: 'EDUCACIONAL' },
  'CONSEJO_ESCOLAR': { nombre: 'Consejo Escolar', categoria: 'EDUCACIONAL' },
  'CENTRO_ESTUDIANTES': { nombre: 'Centro de Estudiantes', categoria: 'EDUCACIONAL' },
};

const PLACEHOLDERS = [
  { key: '{{NOMBRE_ORGANIZACION}}', label: 'Nombre Org.' },
  { key: '{{TIPO_ORGANIZACION}}', label: 'Tipo Org.' },
  { key: '{{OBJETIVOS}}', label: 'Objetivos' },
  { key: '{{COMUNA}}', label: 'Comuna' },
  { key: '{{REGION}}', label: 'Región' },
  { key: '{{DIRECCION}}', label: 'Dirección' },
  { key: '{{MIEMBROS_MINIMOS}}', label: 'Mín. Socios' },
  { key: '{{NUM_MIEMBROS}}', label: 'N° Miembros' },
  { key: '{{EDAD_MINIMA}}', label: 'Edad Mínima' },
  { key: '{{N_MIEMBROS}}', label: 'N° Directorio' },
  { key: '{{MIEMBROS_COMISION_ELECTORAL}}', label: 'Miembros Com. Elect.' },
  { key: '{{CUOTA_MENSUAL}}', label: 'Cuota Mensual' },
  { key: '{{CUOTA_INCORPORACION}}', label: 'Cuota Incorporación' },
  { key: '{{DURACION_MANDATO}}', label: 'Duración Mandato' },
  { key: '{{MESES_ASAMBLEA}}', label: 'Meses Asamblea' },
  { key: '{{METODO_CITACION}}', label: 'Método Citación' },
  { key: '{{DIAS_ANTICIPACION}}', label: 'Días Anticipación' },
  { key: '{{ENTIDAD_DISOLUCION}}', label: 'Entidad Disolución' },
  { key: '{{RUT_DISOLUCION}}', label: 'RUT Disolución' },
  { key: '{{FECHA_DIA}}', label: 'Día' },
  { key: '{{FECHA_MES}}', label: 'Mes' },
  { key: '{{FECHA_ANIO}}', label: 'Año' },
];

// Datos de ejemplo para la vista previa del estatuto
const SAMPLE_ESTATUTO_DATA = {
  '{{NOMBRE_ORGANIZACION}}': 'Club Deportivo Los Cóndores de ' + tenant.communeName,
  '{{TIPO_ORGANIZACION}}': 'Club Deportivo',
  '{{OBJETIVOS}}': 'Fomentar la práctica deportiva entre los vecinos de la comuna, promover la vida sana y la integración comunitaria a través del deporte',
  '{{COMUNA}}': tenant.communeName,
  '{{REGION}}': 'Metropolitana',
  '{{DIRECCION}}': tenant.address || 'Av. Ejemplo 1435, ' + tenant.communeName,
  '{{MIEMBROS_MINIMOS}}': '15',
  '{{NUM_MIEMBROS}}': '25',
  '{{EDAD_MINIMA}}': '14',
  '{{N_MIEMBROS}}': '5',
  '{{MIEMBROS_COMISION_ELECTORAL}}': '3',
  '{{CUOTA_MENSUAL}}': '2.000',
  '{{CUOTA_INCORPORACION}}': '0,5 UTM',
  '{{DURACION_MANDATO}}': '3',
  '{{MESES_ASAMBLEA}}': 'marzo y septiembre',
  '{{METODO_CITACION}}': 'carta certificada y publicación en diario mural',
  '{{DIAS_ANTICIPACION}}': '5',
  '{{ENTIDAD_DISOLUCION}}': tenant.municipalityFullName,
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
  const [searchFilter, setSearchFilter] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTypeFilter, setNewTypeFilter] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState({ nombre: '', key: '', categoria: 'FUNCIONAL' });
  const [docTemplateOptions, setDocTemplateOptions] = useState({ acta_constitutiva: [], lista_socios: [], nomina_directorio: [], carta_solicitud: [] });
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, nombre }
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

  function buildDefaultTemplate(tipoKey, nombre, categoria) {
    return {
      tipoOrganizacion: tipoKey,
      nombreTipo: nombre,
      descripcion: '',
      categoria: categoria,
      articulos: [],
      directorio: {
        cargos: [
          { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
          { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
          { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
          { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
          { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true, orden: 5 },
        ],
        totalRequerido: 5,
        duracionMandato: 3
      },
      miembrosMinimos: 15,
      comisionElectoral: { cantidad: 3 },
      edadConfig: { permiteMenores: true, edadMinima: 14, menoresEnDirectorio: false, menoresEnComisionElectoral: false },
      objetivosSugeridos: [],
      mandatoTipo: 'fijo',
      mandatoOpciones: [3],
      requiereDirectorioProvisorio: true,
      publicado: false
    };
  }

  function createNewTemplate(tipoKey) {
    const tipoInfo = TIPOS_ORGANIZACION[tipoKey] || { nombre: tipoKey, categoria: 'FUNCIONAL' };
    closeNewModal();
    setSelectedTemplate(buildDefaultTemplate(tipoKey, tipoInfo.nombre, tipoInfo.categoria));
    setEditTab('config');
  }

  function createCustomTemplate() {
    const nombre = customForm.nombre.trim();
    if (!nombre) { addToast('Ingresa un nombre para el tipo', 'error'); return; }

    // Generar key: CLUB_COSTURA, ORG_VOLUNTARIOS, etc.
    const key = customForm.key.trim() ||
      nombre.toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

    // Verificar que no exista
    const existing = templates.find(t => t.tipoOrganizacion === key);
    if (existing) { addToast(`Ya existe una plantilla con la clave "${key}"`, 'error'); return; }

    closeNewModal();
    setSelectedTemplate(buildDefaultTemplate(key, nombre, customForm.categoria));
    setEditTab('config');
  }

  function closeNewModal() {
    setShowNewModal(false);
    setNewTypeFilter('');
    setShowCustomForm(false);
    setCustomForm({ nombre: '', key: '', categoria: 'FUNCIONAL' });
  }

  async function deleteTemplate(id) {
    try {
      await apiService.delete(`/estatuto-templates/${id}`);
      addToast('Tipo de organización eliminado', 'success');
      setDeleteConfirm(null);
      loadTemplates();
    } catch (err) {
      addToast(err.message || 'Error al eliminar', 'error');
    }
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
        <div className="r-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToList} style={{
              padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 8,
              background: 'white', fontSize: 13, cursor: 'pointer'
            }}>Volver</button>
            <h1 className="r-page-title" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>
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
                  <div className="r-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                      Art. {art.numero}: {art.titulo}
                    </h4>
                    <div className="r-btn-row" style={{ display: 'flex', gap: 6 }}>
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
                <div className="r-form-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, minWidth: 180 }}>Mínimo miembros para constituir</label>
                  <input type="number" value={selectedTemplate.miembrosMinimos ?? ''}
                    onChange={e => setSelectedTemplate(t => ({ ...t, miembrosMinimos: parseInt(e.target.value) || 15 }))}
                    style={{ width: 80, padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                </div>
                <div className="r-form-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, minWidth: 180 }}>Miembros comisión electoral</label>
                  <input type="number" value={selectedTemplate.comisionElectoral?.cantidad ?? ''}
                    onChange={e => setSelectedTemplate(t => ({ ...t, comisionElectoral: { ...(t.comisionElectoral || {}), cantidad: parseInt(e.target.value) || 3 } }))}
                    style={{ width: 80, padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                </div>
              </div>

              {/* Configuración de Mandato */}
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: '20px 0 12px' }}>Configuración de Mandato</h3>
              <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                <div className="r-form-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, minWidth: 180 }}>Tipo de mandato</label>
                  <select value={selectedTemplate.mandatoTipo || 'fijo'}
                    onChange={e => setSelectedTemplate(t => ({ ...t, mandatoTipo: e.target.value }))}
                    style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                    <option value="fijo">Fijo (no editable por organizador)</option>
                    <option value="variable">Variable (organizador elige)</option>
                  </select>
                </div>
                <div className="r-form-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, minWidth: 180, marginTop: 8 }}>
                    {selectedTemplate.mandatoTipo === 'variable' ? 'Opciones de años permitidas' : 'Duración fija (años)'}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {(selectedTemplate.mandatoOpciones || [3]).map((yr, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '4px 8px'
                      }}>
                        <input
                          type="number" min="1" max="10" value={yr}
                          onChange={e => {
                            const val = parseInt(e.target.value);
                            if (!val || val < 1) return;
                            setSelectedTemplate(t => {
                              const opts = [...(t.mandatoOpciones || [3])];
                              opts[i] = val;
                              return { ...t, mandatoOpciones: opts, directorio: { ...(t.directorio || {}), duracionMandato: opts[0] } };
                            });
                          }}
                          style={{
                            width: 44, padding: '4px 2px', border: '1px solid #93c5fd', borderRadius: 6,
                            fontSize: 14, textAlign: 'center', background: '#fff'
                          }}
                        />
                        <span style={{ fontSize: 12, color: '#6b7280' }}>año{yr > 1 ? 's' : ''}</span>
                        {(selectedTemplate.mandatoOpciones || [3]).length > 1 && (
                          <button
                            onClick={() => setSelectedTemplate(t => {
                              const opts = (t.mandatoOpciones || [3]).filter((_, j) => j !== i);
                              return { ...t, mandatoOpciones: opts, directorio: { ...(t.directorio || {}), duracionMandato: opts[0] } };
                            })}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444',
                              fontSize: 16, lineHeight: 1, padding: '0 2px', fontWeight: 700
                            }}
                            title="Eliminar opción"
                          >&times;</button>
                        )}
                      </div>
                    ))}
                    {selectedTemplate.mandatoTipo === 'variable' && (
                      <button
                        onClick={() => setSelectedTemplate(t => {
                          const opts = [...(t.mandatoOpciones || [3])];
                          const next = Math.max(...opts) + 1;
                          return { ...t, mandatoOpciones: [...opts, next > 10 ? 1 : next] };
                        })}
                        style={{
                          padding: '4px 10px', background: '#2563eb', color: '#fff', border: 'none',
                          borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer'
                        }}
                        title="Agregar opción de años"
                      >+ Agregar</button>
                    )}
                  </div>
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
                    <div className="r-form-row" style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 24 }}>
                      <label style={{ fontSize: 14, fontWeight: 600, minWidth: 180 }}>Edad mínima para ser miembro</label>
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
              <div className="r-btn-row" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
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
                <div key={i} className="r-form-row" style={{
                  display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8,
                  padding: 10, background: '#f9fafb', borderRadius: 8, flexWrap: 'wrap',
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

              <div className="r-form-row" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
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
          <div className="r-btn-row" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
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

  // Filtrar templates por búsqueda
  const normalizeSearch = (str) => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const filterTerm = normalizeSearch(searchFilter);
  const filteredTemplates = filterTerm
    ? templates.filter(t => {
        const name = normalizeSearch(t.nombreTipo || t.orgType || '');
        const desc = normalizeSearch(t.descripcion || '');
        const cat = normalizeSearch(CATEGORY_LABELS[t.categoria] || t.categoria || '');
        return name.includes(filterTerm) || desc.includes(filterTerm) || cat.includes(filterTerm);
      })
    : templates;

  const grouped = {};
  filteredTemplates.forEach(t => {
    const cat = t.categoria || 'OTRO';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  });

  const sortedCategories = CATEGORY_ORDER.filter(c => grouped[c]?.length);
  Object.keys(grouped).forEach(c => { if (!sortedCategories.includes(c)) sortedCategories.push(c); });

  return (
    <div style={{ padding: 24 }}>
      <div className="r-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="r-page-title" style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' }}>
          Plantillas de Estatutos
        </h1>
        <button onClick={() => setShowNewModal(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', border: 'none', borderRadius: 10,
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(37,99,235,0.3)'
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          Nuevo Tipo de Organizacion
        </button>
      </div>

      {/* Buscador */}
      <div style={{
        position: 'relative', marginBottom: 20, maxWidth: 480
      }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          background: '#f8fafc', border: '1.5px solid #e2e8f0',
          borderRadius: 12, padding: '0 16px',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          ...(searchFilter ? { borderColor: '#3b82f6', boxShadow: '0 0 0 3px rgba(59,130,246,0.1)' } : {})
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            placeholder="Buscar tipo de organizacion..."
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              padding: '12px 12px', fontSize: 14, color: '#1e293b'
            }}
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: '50%',
                border: 'none', background: '#e2e8f0', cursor: 'pointer',
                color: '#64748b', fontSize: 16, fontWeight: 700, flexShrink: 0,
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
              onMouseLeave={e => e.currentTarget.style.background = '#e2e8f0'}
              title="Limpiar busqueda"
            >
              &times;
            </button>
          )}
        </div>
        {filterTerm && (
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, paddingLeft: 4 }}>
            {filteredTemplates.length} de {templates.length} plantillas
          </div>
        )}
      </div>

      <div className="r-stats" style={{ display: 'flex', gap: 12, marginBottom: 20, fontSize: 13, color: '#6b7280' }}>
        <span>Total: {templates.length}</span>
        <span>Publicadas: {templates.filter(t => t.publicado).length}</span>
      </div>

      {filterTerm && sortedCategories.length === 0 && (
        <div style={{
          padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 15,
          border: '2px dashed #e5e7eb', borderRadius: 12
        }}>
          No se encontraron plantillas para "<strong style={{ color: '#64748b' }}>{searchFilter}</strong>"
        </div>
      )}

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
              <div key={t._id} className="r-card" style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
                padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: 8,
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                      {t.nombreTipo || t.orgType || 'Sin nombre'}
                    </span>
                    {!TIPOS_ORGANIZACION[t.tipoOrganizacion] && (
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: '#ede9fe', color: '#6d28d9'
                      }}>Personalizado</span>
                    )}
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      background: t.publicado ? '#d1fae5' : '#fee2e2',
                      color: t.publicado ? '#065f46' : '#991b1b'
                    }}>
                      {t.publicado ? 'Publicada' : 'Borrador'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>{(t.articulos || []).length} artículos</span>
                    <span>{(t.directorio?.cargos || []).filter(c => c.required).length}/{(t.directorio?.cargos || []).length} cargos</span>
                    <span>{(t.objetivosSugeridos || []).length} objetivos</span>
                    {t.version && <span>v{t.version}</span>}
                  </div>
                </div>
                <div className="r-btn-row" style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => togglePublish(t)} style={smallBtn}>
                    {t.publicado ? 'Despublicar' : 'Publicar'}
                  </button>
                  <button onClick={() => openEditor(t)} style={{
                    padding: '6px 14px', border: 'none', borderRadius: 6,
                    background: '#2563eb', color: 'white', fontSize: 12, cursor: 'pointer'
                  }}>Editar</button>
                  {!TIPOS_ORGANIZACION[t.tipoOrganizacion] && (
                    <button onClick={() => setDeleteConfirm({ id: t._id, nombre: t.nombreTipo || t.tipoOrganizacion })} style={{
                      padding: '6px 14px', border: 'none', borderRadius: 6,
                      background: '#fee2e2', color: '#dc2626', fontSize: 12, cursor: 'pointer', fontWeight: 600
                    }}>Eliminar</button>
                  )}
                </div>
              </div>
            ))}
          </div>}
        </div>
        );
      })}

      {/* Modal confirmación eliminar tipo custom */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 32, maxWidth: 440, width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>&#9888;</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#111827', textAlign: 'center' }}>
              Eliminar tipo de organizacion
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 1.5 }}>
              Se eliminara permanentemente <strong style={{ color: '#111827' }}>{deleteConfirm.nombre}</strong> y su plantilla asociada. Esta accion no se puede deshacer.
            </p>
            <div className="r-btn-row" style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{
                padding: '10px 24px', border: '1px solid #d1d5db', borderRadius: 8,
                background: 'white', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}>Cancelar</button>
              <button onClick={() => deleteTemplate(deleteConfirm.id)} style={{
                padding: '10px 24px', border: 'none', borderRadius: 8,
                background: '#dc2626', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}>Eliminar permanentemente</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear nuevo tipo de organización */}
      {showNewModal && (() => {
        const existingTypes = new Set(templates.map(t => t.tipoOrganizacion || t.orgType));
        const availableTypes = Object.entries(TIPOS_ORGANIZACION)
          .filter(([key]) => !existingTypes.has(key));

        const normalizeStr = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const filterStr = normalizeStr(newTypeFilter);
        const filteredTypes = filterStr
          ? availableTypes.filter(([key, info]) =>
              normalizeStr(info.nombre).includes(filterStr) ||
              normalizeStr(info.categoria).includes(filterStr) ||
              normalizeStr(key).includes(filterStr)
            )
          : availableTypes;

        const catOrder = ['TERRITORIAL', 'FUNCIONAL', 'SOCIAL', 'CULTURAL', 'EDUCACIONAL', 'OTRO'];
        const catLabels = { TERRITORIAL: 'Territoriales', FUNCIONAL: 'Funcionales', SOCIAL: 'Social', CULTURAL: 'Arte y Cultura', EDUCACIONAL: 'Educacionales', OTRO: 'Otros' };
        const groupedAvail = {};
        filteredTypes.forEach(([key, info]) => {
          const c = info.categoria || 'OTRO';
          if (!groupedAvail[c]) groupedAvail[c] = [];
          groupedAvail[c].push({ key, ...info });
        });
        const sortedCats = catOrder.filter(c => groupedAvail[c]?.length);

        // Preview de la key generada
        const previewKey = customForm.nombre.trim()
          ? (customForm.key.trim() || customForm.nombre.trim().toUpperCase()
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              .replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''))
          : '';

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{
              background: 'white', borderRadius: 16, width: '90%', maxWidth: 620,
              height: '85vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}>
              {/* Header */}
              <div className="r-toolbar" style={{
                padding: '20px 24px', borderBottom: '1px solid #e5e7eb',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
              }}>
                <div>
                  <h2 className="r-page-title" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>
                    Nuevo Tipo de Organizacion
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                    Selecciona un tipo existente o crea uno personalizado
                  </p>
                </div>
                <button onClick={closeNewModal} style={{
                  background: 'none', border: 'none', fontSize: 28, color: '#6b7280',
                  cursor: 'pointer', lineHeight: 1
                }}>&times;</button>
              </div>

              {/* Tabs: Existente / Personalizado */}
              <div style={{
                display: 'flex', borderBottom: '1px solid #e5e7eb', flexShrink: 0
              }}>
                <button onClick={() => setShowCustomForm(false)} style={{
                  flex: 1, padding: '12px 16px', border: 'none', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer',
                  background: !showCustomForm ? 'white' : '#f8fafc',
                  color: !showCustomForm ? '#2563eb' : '#6b7280',
                  borderBottom: !showCustomForm ? '2px solid #2563eb' : '2px solid transparent'
                }}>
                  Tipo Existente ({availableTypes.length})
                </button>
                <button onClick={() => setShowCustomForm(true)} style={{
                  flex: 1, padding: '12px 16px', border: 'none', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer',
                  background: showCustomForm ? 'white' : '#f8fafc',
                  color: showCustomForm ? '#2563eb' : '#6b7280',
                  borderBottom: showCustomForm ? '2px solid #2563eb' : '2px solid transparent'
                }}>
                  Crear Personalizado
                </button>
              </div>

              {/* Contenido */}
              <div style={{ flex: 1, overflow: 'auto' }}>
                {!showCustomForm ? (
                  /* Lista de tipos existentes */
                  <div>
                    <div style={{ padding: '16px 24px 0' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center',
                        background: '#f8fafc', border: '1.5px solid #e2e8f0',
                        borderRadius: 10, padding: '0 14px',
                        ...(newTypeFilter ? { borderColor: '#3b82f6', boxShadow: '0 0 0 3px rgba(59,130,246,0.1)' } : {})
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                          type="text" value={newTypeFilter}
                          onChange={e => setNewTypeFilter(e.target.value)}
                          placeholder="Buscar tipo..."
                          autoFocus={!showCustomForm}
                          style={{
                            flex: 1, border: 'none', outline: 'none', background: 'transparent',
                            padding: '10px 10px', fontSize: 14, color: '#1e293b'
                          }}
                        />
                        {newTypeFilter && (
                          <button onClick={() => setNewTypeFilter('')} style={{
                            width: 24, height: 24, borderRadius: '50%', border: 'none',
                            background: '#e2e8f0', cursor: 'pointer', color: '#64748b',
                            fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>&times;</button>
                        )}
                      </div>
                    </div>
                    <div style={{ padding: '16px 24px 24px' }}>
                      {sortedCats.length === 0 && (
                        <div style={{
                          padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14,
                          border: '2px dashed #e5e7eb', borderRadius: 12
                        }}>
                          {availableTypes.length === 0
                            ? <>Todos los tipos predefinidos ya tienen plantilla. Usa la pestana <strong>"Crear Personalizado"</strong> para agregar uno nuevo.</>
                            : <>No se encontraron tipos para "<strong style={{ color: '#64748b' }}>{newTypeFilter}</strong>"</>
                          }
                        </div>
                      )}
                      {sortedCats.map(cat => (
                        <div key={cat} style={{ marginBottom: 16 }}>
                          <div style={{
                            fontSize: 11, fontWeight: 700, color: '#6b7280',
                            textTransform: 'uppercase', letterSpacing: 0.5,
                            padding: '0 0 6px', borderBottom: '1px solid #f1f5f9', marginBottom: 8
                          }}>
                            {catLabels[cat] || cat}
                          </div>
                          <div style={{ display: 'grid', gap: 6 }}>
                            {groupedAvail[cat].map(tipo => (
                              <button
                                key={tipo.key}
                                onClick={() => createNewTemplate(tipo.key)}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  width: '100%', textAlign: 'left',
                                  padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 10,
                                  background: 'white', cursor: 'pointer', fontSize: 14, color: '#1e293b',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = 'white'; }}
                              >
                                <span style={{ fontWeight: 500 }}>{tipo.nombre}</span>
                                <span style={{
                                  fontSize: 11, color: '#3b82f6', fontWeight: 600,
                                  padding: '2px 8px', background: '#eff6ff', borderRadius: 6
                                }}>Crear</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Formulario para tipo personalizado */
                  <div style={{ padding: 24 }}>
                    <div style={{
                      padding: 16, background: '#eff6ff', borderRadius: 12, marginBottom: 24,
                      fontSize: 13, color: '#1e40af', lineHeight: 1.5
                    }}>
                      Crea un tipo de organizacion que no existe en el sistema. Una vez publicada,
                      los organizadores podran seleccionarlo al crear una nueva organizacion.
                    </div>

                    <div style={{ display: 'grid', gap: 20 }}>
                      {/* Nombre */}
                      <div>
                        <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 6, color: '#374151' }}>
                          Nombre del tipo de organizacion *
                        </label>
                        <input
                          type="text"
                          value={customForm.nombre}
                          onChange={e => setCustomForm(f => ({ ...f, nombre: e.target.value }))}
                          placeholder="Ej: Club de Costura, Taller de Robotica..."
                          autoFocus={showCustomForm}
                          style={{
                            width: '100%', padding: '12px 14px', border: '1.5px solid #d1d5db',
                            borderRadius: 10, fontSize: 14, color: '#1e293b',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      {/* Categoría */}
                      <div>
                        <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 6, color: '#374151' }}>
                          Categoria
                        </label>
                        <select
                          value={customForm.categoria}
                          onChange={e => setCustomForm(f => ({ ...f, categoria: e.target.value }))}
                          style={{
                            width: '100%', padding: '12px 14px', border: '1.5px solid #d1d5db',
                            borderRadius: 10, fontSize: 14, color: '#1e293b', background: 'white',
                            boxSizing: 'border-box'
                          }}
                        >
                          {catOrder.map(cat => (
                            <option key={cat} value={cat}>{catLabels[cat] || cat}</option>
                          ))}
                        </select>
                      </div>

                      {/* Key (opcional) */}
                      <div>
                        <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 6, color: '#374151' }}>
                          Clave interna <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional, se genera automaticamente)</span>
                        </label>
                        <input
                          type="text"
                          value={customForm.key}
                          onChange={e => setCustomForm(f => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                          placeholder={previewKey || 'CLUB_COSTURA'}
                          style={{
                            width: '100%', padding: '12px 14px', border: '1.5px solid #d1d5db',
                            borderRadius: 10, fontSize: 14, color: '#1e293b', fontFamily: 'monospace',
                            boxSizing: 'border-box'
                          }}
                        />
                        {previewKey && (
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                            Se usara: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{previewKey}</code>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botón crear */}
                    <button
                      onClick={createCustomTemplate}
                      disabled={!customForm.nombre.trim()}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        width: '100%', marginTop: 28, padding: '14px 24px', border: 'none', borderRadius: 12,
                        background: customForm.nombre.trim() ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#e5e7eb',
                        color: customForm.nombre.trim() ? 'white' : '#9ca3af',
                        fontSize: 15, fontWeight: 600,
                        cursor: customForm.nombre.trim() ? 'pointer' : 'not-allowed',
                        boxShadow: customForm.nombre.trim() ? '0 2px 8px rgba(37,99,235,0.3)' : 'none'
                      }}
                    >
                      Crear Tipo de Organizacion
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const smallBtn = {
  padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6,
  background: 'white', fontSize: 12, cursor: 'pointer', color: '#374151'
};
