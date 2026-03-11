import { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { parseTemplateBlocks } from '@shared/utils/templateBlockParser.js';

async function compressImage(file, maxWidth = 800, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, 1);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    };
    img.src = URL.createObjectURL(file);
  });
}

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
  HORA_INICIO_ASAMBLEA: '10:00',
  HORA_TERMINO_ASAMBLEA: '12:30',
  VOTOS_FAVOR: '23',
  VOTOS_CONTRA: '1',
  ABSTENCIONES: '1',
  DURACION_MANDATO: '3',
  CUOTA_INCORPORACION: '0.5',
  FECHA_HOY: new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }),
  MINISTRO_FE: 'Carlos Ramírez Torres',
  RUT_MINISTRO_FE: '7.654.321-0',
  UBICACION_ASAMBLEA: 'Blanco Encalada 1335, Renca',
  FIRMA_PRESIDENTE: '________________________\nJuan Pérez González\nPresidente(a) Provisorio(a)\nRUT: 12.345.678-9',
  FIRMA_SECRETARIO: '________________________\nMaría López Soto\nSecretario(a) Provisorio(a)\nRUT: 11.234.567-K',
  FIRMA_TESORERO: '________________________\nCarmen Muñoz Díaz\nTesorero(a) Provisorio(a)\nRUT: 13.678.901-5',
  FIRMA_MINISTRO_FE: '________________________\nCarlos Ramírez Torres\nMinistro de Fe\nRUT: 7.654.321-0',
};

const DEFAULT_CONTENT = {
  acta_constitutiva: `ACTA DE ASAMBLEA GENERAL CONSTITUTIVA DE ESTATUTO
Y ELECCIÓN DE DIRECTIVA PROVISIONAL

TIPO DE ORGANIZACIÓN: {{TIPO_ORG}}
NOMBRE INSTITUCIÓN: {{NOMBRE_ORG}}

ACTA DE ASAMBLEA

En {{COMUNA}}, a {{FECHA_ASAMBLEA}}, siendo las {{HORA_INICIO_ASAMBLEA}} horas, en el local ubicado en {{UBICACION_ASAMBLEA}}, ante la presencia del funcionario municipal Sr.(a) {{MINISTRO_FE}} como Ministro de Fe y la concurrencia de los futuros miembros de la Organización que en el listado adjunto se individualizan y firman, tuvo lugar la Asamblea General destinada a aprobar el Estatuto por el que se regirá la Organización y la elección del Directorio Provisional, todo conforme a lo que establece la Ley Nº 19.418 del 09 de octubre de 1995.

Antes de iniciar la sesión, se verificó que existen a lo menos {{TOTAL_SOCIOS}} socios, los cuales cumplen con los requisitos establecidos en la referida Ley y cuyo listado e individualización adjunto, forma parte integrante de la presente Acta de Constitución para todos los efectos legales. Además, se dio lectura al Proyecto de Estatuto propuesto por los Organizadores, el cual, sometido a la consideración de la Asamblea, fue aprobado por {{VOTOS_FAVOR}} votos a favor, {{VOTOS_CONTRA}} en contra y {{ABSTENCIONES}} abstenciones, en la forma de que da cuenta el texto que se inserta al final de la presente Acta y que forma parte integrante para todos los efectos legales.

A continuación, se procedió a elegir a la Directiva Provisional mediante voto nominativo, resultando elegido(a) Presidente(a) quien obtuvo la más alta mayoría y como directores, aquellos que obtuvieron las dos (2) siguientes más altas mayorías de votos, quienes desempeñarán los cargos de Secretario y Tesorero. También, se procedió a elegir a las tres (3) personas que integrarán la Comisión Electoral.

Producida la votación, resultaron elegidos como miembros del Directorio Provisional y Comisión Electoral, los siguientes socios:

DIRECTIVA PROVISIONAL
PRESIDENTE(A): {{PRESIDENTE}} — RUT: {{RUT_PRESIDENTE}}
SECRETARIO(A): {{SECRETARIO}} — RUT: {{RUT_SECRETARIO}}
TESORERO(A): {{TESORERO}} — RUT: {{RUT_TESORERO}}
{{DIRECTORES}}

COMISIÓN ELECTORAL
{{COMISION_ELECTORAL}}

La Comisión Organizadora delega la facultad de tramitar la aprobación de los presentes Estatutos y acepta a nombre de los socios constituyentes, las modificaciones que el Secretario Municipal pueda hacer a tales Estatutos, de acuerdo con el Artículo 7º, inciso final, de la Ley Nº 19.418, a Don(ña) {{PRESIDENTE}}, Presidente(a) de la Organización, quien para estos efectos y para cualquier notificación a la Organización señala el siguiente domicilio: {{DIRECCION}}.

Se levanta la sesión siendo las {{HORA_TERMINO_ASAMBLEA}} horas. Suscriben la presente Acta en señal de ratificación de lo contenido en ella, la Directiva Provisional electa y el Ministro de fe que asistió a la asamblea.

[COLS:2]
{{FIRMA_PRESIDENTE}}
[COL]
{{FIRMA_SECRETARIO}}
[/COLS]

[COLS:2]
{{FIRMA_TESORERO}}
[COL]
{{FIRMA_MINISTRO_FE}}
[/COLS]`,

  lista_socios: `LISTADO DE SOCIOS ASISTENTES A LA CONSTITUCIÓN DE LA ORGANIZACIÓN

NOMBRE ORGANIZACIÓN: {{NOMBRE_ORG}}
TIPO DE ORGANIZACIÓN: {{TIPO_ORG}}
COMUNA: {{COMUNA}}
UNIDAD VECINAL: {{UNIDAD_VECINAL}}

SOCIOS FUNDADORES ({{TOTAL_SOCIOS}} miembros):

{{LISTA_SOCIOS}}

FECHA CONSTITUCIÓN: {{FECHA_ASAMBLEA}}
NOMBRE DE LA ORGANIZACIÓN: {{NOMBRE_ORG}}

Los socios arriba individualizados declaran cumplir con los requisitos establecidos en la Ley Nº 19.418 para integrar una Organización Comunitaria, y suscriben el presente listado en la Asamblea General Constitutiva celebrada en {{UBICACION_ASAMBLEA}}, ante la presencia del Ministro de Fe Sr. (a) {{MINISTRO_FE}}.`,

  nomina_directorio: `CERTIFICACIÓN

En {{COMUNA}}, a {{FECHA_HOY}}, en cumplimiento a lo que establece el Artículo 8º de la Ley Nº 19.418 de 1995, el Secretario Municipal que suscribe certifica que, la Organización Denominada {{NOMBRE_ORG}} de la Unidad Vecinal Nº {{UNIDAD_VECINAL}} depositó en esta Secretaría Municipal, copia autorizada del Acta de Asamblea Constitutiva.

La citada Asamblea Constitutiva se efectuó el día {{FECHA_ASAMBLEA}} ante el Ministro de Fe Don (ña) {{MINISTRO_FE}} Funcionario (a) municipal, en el local ubicado en {{UBICACION_ASAMBLEA}}.

En dicha sesión, se aprobaron los Estatutos de la Organización y fueron elegidos como integrantes de la Directiva Provisoria y Comisión Electoral, los siguientes socios:

DIRECTIVA PROVISORIA
PRESIDENTE (A): {{PRESIDENTE}} — C.I. Nº {{RUT_PRESIDENTE}}
SECRETARIO (A): {{SECRETARIO}} — C.I. Nº {{RUT_SECRETARIO}}
TESORERO (A): {{TESORERO}} — C.I. Nº {{RUT_TESORERO}}
{{DIRECTORES}}

COMISIÓN ELECTORAL
{{COMISION_ELECTORAL}}

Dicha Organización gozará de Personalidad Jurídica conforme a la Ley Nº 19.418 de 1995, a contar de la fecha del depósito del Acta de Asamblea Constitutiva, la cual fue depositada en la Secretaría Municipal por Don (ña) {{PRESIDENTE}} presidenta (e) de la organización y Don (ña) {{MINISTRO_FE}} en su calidad de Ministro de Fe, con domicilio en Blanco Encalada Nº 1335.

Se entrega este certificado al (a la) Presidente (a) de la Organización para todos los efectos legales derivados de la Ley Nº 19.418. En ausencia del Titular, en el acto de retiro, envíese la presente certificación, por cédula al domicilio fijado por el (la) Presidente (a), en la Asamblea Constitutiva.`,

  carta_solicitud: `DEPÓSITO DE ANTECEDENTES

TIPO DE ORGANIZACIÓN: {{TIPO_ORG}}
NOMBRE DE LA ORGANIZACIÓN: {{NOMBRE_ORG}}
UNIDAD VECINAL: {{UNIDAD_VECINAL}}

En {{COMUNA}}, a {{FECHA_HOY}} de conformidad a lo que establece la Ley Nº 19.418 del 09 de octubre de 1995, procedo a inscribir en el presente Libro de Registro a la Organización Comunitaria antes señalada.

Los documentos relativos al Acta de Constitución, Aprobación de Estatutos, Listado de Socios, Asistentes y Elección de Directorio Provisional, se encuentran archivados en Carpeta Digital en el Departamento de Registro y Certificación.

DATOS DE LA ORGANIZACIÓN:
Dirección: {{DIRECCION}}
Comuna: {{COMUNA}}, Región {{REGION}}
Email: {{EMAIL}}
Teléfono: {{TELEFONO}}

DIRECTIVA PROVISIONAL:
PRESIDENTE (A): {{PRESIDENTE}} — RUT: {{RUT_PRESIDENTE}}
SECRETARIO (A): {{SECRETARIO}} — RUT: {{RUT_SECRETARIO}}
TESORERO (A): {{TESORERO}} — RUT: {{RUT_TESORERO}}
{{DIRECTORES}}

Duración del mandato: {{DURACION_MANDATO}} año(s)

Objetivos:
{{OBJETIVOS}}`,
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
  const [uploading, setUploading] = useState(null); // 'header' | 'footer' | null
  const contentRef = useRef(null);
  const headerFileRef = useRef(null);
  const footerFileRef = useRef(null);

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
      content: DEFAULT_CONTENT['acta_constitutiva'] || '',
      pageSize: 'letter',
      isDefault: false
    });
    setEditTab('general');
  }

  function changeDocumentType(newType) {
    setSelected(s => {
      const hasCustomContent = s.content && s.content.trim() !== '' && !Object.values(DEFAULT_CONTENT).includes(s.content);
      return {
        ...s,
        documentType: newType,
        content: hasCustomContent ? s.content : (DEFAULT_CONTENT[newType] || '')
      };
    });
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

  function insertAtCursor(text) {
    const ta = contentRef.current;
    if (!ta) {
      setSelected(s => ({ ...s, content: (s.content || '') + text }));
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const current = selected.content || '';
    const newText = current.substring(0, start) + text + current.substring(end);
    setSelected(s => ({ ...s, content: newText }));
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + text.length;
      ta.focus();
    }, 0);
  }

  function insertColumns(count) {
    const parts = count === 2
      ? 'Contenido columna 1\n[COL]\nContenido columna 2'
      : 'Contenido columna 1\n[COL]\nContenido columna 2\n[COL]\nContenido columna 3';
    insertAtCursor(`\n[COLS:${count}]\n${parts}\n[/COLS]\n`);
  }

  function insertTable() {
    insertAtCursor('\n[TABLE]\nNombre | RUT | Cargo\nJuan Pérez | 12.345.678-9 | Presidente\n[/TABLE]\n');
  }

  const uploadImage = useCallback(async (tipo, file) => {
    if (!selected?._id || !file) {
      addToast('Guarda la plantilla primero antes de subir imágenes', 'error');
      return;
    }
    setUploading(tipo);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append('image', compressed, file.name);
      formData.append('tipo', tipo);
      const resp = await fetch(`${apiService.baseUrl || '/api'}/document-templates/${selected._id}/upload-image`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest', ...(apiService._authToken && { Authorization: `Bearer ${apiService._authToken}` }) },
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error al subir imagen');
      setSelected(data.template);
      addToast(`Imagen de ${tipo} subida`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setUploading(null);
    }
  }, [selected?._id, addToast]);

  const deleteImage = useCallback(async (tipo) => {
    if (!selected?._id) return;
    try {
      const data = await apiService.delete(`/document-templates/${selected._id}/image/${tipo}`);
      setSelected(data.template);
      addToast(`Imagen de ${tipo} eliminada`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }, [selected?._id, addToast]);

  const filtered = templates.filter(t => filterType === 'all' || t.documentType === filterType);

  // ============================================
  // EDITOR VIEW
  // ============================================
  if (selected) {
    const tabs = [
      { key: 'general', label: 'General' },
      { key: 'contenido', label: 'Contenido' },
      { key: 'diseno', label: 'Diseño' },
      { key: 'preview', label: 'Vista Previa' },
    ];

    return (
      <div style={{ padding: 24, maxWidth: '100%' }}>
        <div className="r-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
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
                onChange={e => changeDocumentType(e.target.value)}
                style={inputStyle}
              >
                {DOCUMENT_TYPES.filter(t => t.key !== 'all').map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Tamaño de página</label>
              <select
                value={selected.pageSize || 'letter'}
                onChange={e => setSelected(s => ({ ...s, pageSize: e.target.value }))}
                style={inputStyle}
              >
                <option value="letter">Carta (Letter) — 216 x 279 mm</option>
                <option value="legal">Oficio (Legal) — 216 x 356 mm</option>
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
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={cardStyle}>
                <label style={labelStyle}>Contenido (texto con placeholders)</label>
                <div style={{
                  display: 'flex', gap: 6, marginBottom: 8,
                  padding: '6px 8px', background: '#f8fafc',
                  border: '1px solid #e2e8f0', borderRadius: 8,
                  flexWrap: 'wrap', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 11, color: '#64748b', marginRight: 4 }}>Insertar:</span>
                  <button onClick={() => insertColumns(2)} title="Insertar 2 columnas lado a lado" style={{
                    padding: '3px 10px', fontSize: 11, border: '1px solid #cbd5e1', borderRadius: 6,
                    background: '#fff', cursor: 'pointer', color: '#334155',
                  }}>
                    Columnas (2)
                  </button>
                  <button onClick={() => insertColumns(3)} title="Insertar 3 columnas lado a lado" style={{
                    padding: '3px 10px', fontSize: 11, border: '1px solid #cbd5e1', borderRadius: 6,
                    background: '#fff', cursor: 'pointer', color: '#334155',
                  }}>
                    Columnas (3)
                  </button>
                  <button onClick={() => insertTable()} title="Insertar tabla con encabezado" style={{
                    padding: '3px 10px', fontSize: 11, border: '1px solid #cbd5e1', borderRadius: 6,
                    background: '#fff', cursor: 'pointer', color: '#334155',
                  }}>
                    Tabla
                  </button>
                </div>
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
            <div style={{ width: 240 }}>
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

        {/* Tab: Diseño */}
        {editTab === 'diseno' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {!selected._id && (
              <div style={{ padding: 16, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, fontSize: 13, color: '#92400e' }}>
                Guarda la plantilla primero para poder subir imágenes.
              </div>
            )}

            {/* Header Section */}
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Encabezado (Header)</h3>

              {/* Image upload */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Imagen de encabezado</label>
                {selected.headerConfig?.imageUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <img src={selected.headerConfig.imageUrl} alt="Header" style={{ maxWidth: 400, maxHeight: 100, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <button onClick={() => deleteImage('header')} style={{ ...btnSmallOutline, color: '#ef4444', borderColor: '#fecaca' }}>Eliminar</button>
                  </div>
                ) : (
                  <div
                    onClick={() => selected._id && headerFileRef.current?.click()}
                    style={{
                      border: '2px dashed #d1d5db', borderRadius: 10, padding: 24, textAlign: 'center',
                      cursor: selected._id ? 'pointer' : 'not-allowed', background: '#f9fafb',
                      color: '#9ca3af', fontSize: 13, marginBottom: 10,
                    }}
                  >
                    {uploading === 'header' ? 'Subiendo...' : 'Click para subir imagen de encabezado (JPG, PNG, WebP, max 2MB)'}
                  </div>
                )}
                <input ref={headerFileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
                  onChange={e => { if (e.target.files[0]) uploadImage('header', e.target.files[0]); e.target.value = ''; }} />
              </div>

              {/* Text fields */}
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Texto principal</label>
                <input type="text" style={inputStyle}
                  value={selected.headerConfig?.text || ''}
                  onChange={e => setSelected(s => ({ ...s, headerConfig: { ...s.headerConfig, text: e.target.value } }))}
                  placeholder="REPÚBLICA DE CHILE – I. MUNICIPALIDAD DE RENCA"
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Subtítulo</label>
                <input type="text" style={inputStyle}
                  value={selected.headerConfig?.subtitle || ''}
                  onChange={e => setSelected(s => ({ ...s, headerConfig: { ...s.headerConfig, subtitle: e.target.value } }))}
                  placeholder="SECRETARÍA MUNICIPAL"
                />
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div>
                  <label style={labelStyle}>Altura (mm)</label>
                  <input type="number" min={20} max={80} style={{ ...inputStyle, width: 80 }}
                    value={selected.headerConfig?.height || 40}
                    onChange={e => setSelected(s => ({ ...s, headerConfig: { ...s.headerConfig, height: Number(e.target.value) } }))}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
                  <input type="checkbox" id="headerColorBar"
                    checked={selected.headerConfig?.showColorBar !== false}
                    onChange={e => setSelected(s => ({ ...s, headerConfig: { ...s.headerConfig, showColorBar: e.target.checked } }))}
                  />
                  <label htmlFor="headerColorBar" style={{ fontSize: 13, color: '#334155' }}>Mostrar barra de colores</label>
                </div>
              </div>
            </div>

            {/* Footer Section */}
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Pie de página (Footer)</h3>

              {/* Image upload */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Imagen de pie de página</label>
                {selected.footerConfig?.imageUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <img src={selected.footerConfig.imageUrl} alt="Footer" style={{ maxWidth: 400, maxHeight: 100, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <button onClick={() => deleteImage('footer')} style={{ ...btnSmallOutline, color: '#ef4444', borderColor: '#fecaca' }}>Eliminar</button>
                  </div>
                ) : (
                  <div
                    onClick={() => selected._id && footerFileRef.current?.click()}
                    style={{
                      border: '2px dashed #d1d5db', borderRadius: 10, padding: 24, textAlign: 'center',
                      cursor: selected._id ? 'pointer' : 'not-allowed', background: '#f9fafb',
                      color: '#9ca3af', fontSize: 13, marginBottom: 10,
                    }}
                  >
                    {uploading === 'footer' ? 'Subiendo...' : 'Click para subir imagen de pie de página (JPG, PNG, WebP, max 2MB)'}
                  </div>
                )}
                <input ref={footerFileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
                  onChange={e => { if (e.target.files[0]) uploadImage('footer', e.target.files[0]); e.target.value = ''; }} />
              </div>

              {/* Text fields */}
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Texto principal</label>
                <input type="text" style={inputStyle}
                  value={selected.footerConfig?.text || ''}
                  onChange={e => setSelected(s => ({ ...s, footerConfig: { ...s.footerConfig, text: e.target.value } }))}
                  placeholder="Blanco Encalada 1335, Renca"
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Subtítulo</label>
                <input type="text" style={inputStyle}
                  value={selected.footerConfig?.subtitle || ''}
                  onChange={e => setSelected(s => ({ ...s, footerConfig: { ...s.footerConfig, subtitle: e.target.value } }))}
                  placeholder="+562 2685 6600"
                />
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div>
                  <label style={labelStyle}>Altura (mm)</label>
                  <input type="number" min={15} max={60} style={{ ...inputStyle, width: 80 }}
                    value={selected.footerConfig?.height || 30}
                    onChange={e => setSelected(s => ({ ...s, footerConfig: { ...s.footerConfig, height: Number(e.target.value) } }))}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
                  <input type="checkbox" id="footerColorBar"
                    checked={selected.footerConfig?.showColorBar !== false}
                    onChange={e => setSelected(s => ({ ...s, footerConfig: { ...s.footerConfig, showColorBar: e.target.checked } }))}
                  />
                  <label htmlFor="footerColorBar" style={{ fontSize: 13, color: '#334155' }}>Mostrar barra de colores</label>
                </div>
              </div>
            </div>

            {/* Mini Preview */}
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Vista previa del diseño</h3>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff', maxWidth: 420 }}>
                {/* Header preview */}
                <div style={{ minHeight: 50, background: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                  {selected.headerConfig?.imageUrl ? (
                    <img src={selected.headerConfig.imageUrl} alt="Header" style={{ maxWidth: '100%', maxHeight: 60 }} />
                  ) : (
                    <>
                      {selected.headerConfig?.showColorBar !== false && (
                        <div style={{ display: 'flex', width: '100%', height: 6 }}>
                          {['#2563eb', '#10b981', '#8b5cf6', '#f59e0b'].map(c => (
                            <div key={c} style={{ flex: 1, background: c }} />
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#0891b2', marginTop: 4 }}>
                        {selected.headerConfig?.text || 'REPÚBLICA DE CHILE – I. MUNICIPALIDAD DE RENCA'}
                      </div>
                      <div style={{ fontSize: 8, color: '#64748b' }}>
                        {selected.headerConfig?.subtitle || 'SECRETARÍA MUNICIPAL'}
                      </div>
                    </>
                  )}
                </div>
                {/* Body placeholder */}
                <div style={{ padding: '16px 12px', minHeight: 80 }}>
                  <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, marginBottom: 6, width: '80%' }} />
                  <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, marginBottom: 6, width: '60%' }} />
                  <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, width: '90%' }} />
                </div>
                {/* Footer preview */}
                <div style={{ minHeight: 30, background: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                  {selected.footerConfig?.imageUrl ? (
                    <img src={selected.footerConfig.imageUrl} alt="Footer" style={{ maxWidth: '100%', maxHeight: 40 }} />
                  ) : (
                    <>
                      <div style={{ fontSize: 8, color: '#64748b' }}>
                        {selected.footerConfig?.text || 'Blanco Encalada 1335, Renca'} | {selected.footerConfig?.subtitle || '+562 2685 6600'}
                      </div>
                      {selected.footerConfig?.showColorBar !== false && (
                        <div style={{ display: 'flex', width: '100%', height: 6, marginTop: 4 }}>
                          {['#2563eb', '#10b981', '#8b5cf6', '#f59e0b'].map(c => (
                            <div key={c} style={{ flex: 1, background: c }} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Vista Previa — simula documento final multi-página con header + contenido + footer */}
        {editTab === 'preview' && (() => {
          // Split content into pages based on estimated line capacity
          const resolvedContent = replacePlaceholders(selected.content, SAMPLE_DATA) || '(Sin contenido)';
          const isLegal = selected.pageSize === 'legal';
          const pageAspect = isLegal ? (356 / 216) : (279 / 216);
          const pageWidthPx = 750;
          const pageHeightPx = Math.round(pageWidthPx * pageAspect);
          const headerH = 80; // estimated header height px
          const footerH = 50; // estimated footer height px
          const paddingV = 40; // top+bottom padding
          const contentAreaH = pageHeightPx - headerH - footerH - paddingV;
          // ~24px per line at font 13 with lineHeight 1.8
          const lineH = 24;
          const linesPerPage = Math.floor(contentAreaH / lineH);
          const allLines = resolvedContent.split('\n');

          // Split lines into pages
          const pages = [];
          let currentPage = [];
          let lineCount = 0;
          for (const line of allLines) {
            // Estimate wrapped lines (roughly 90 chars per visual line at this width)
            const wrappedLines = Math.max(1, Math.ceil(line.length / 90));
            if (lineCount + wrappedLines > linesPerPage && currentPage.length > 0) {
              pages.push(currentPage.join('\n'));
              currentPage = [];
              lineCount = 0;
            }
            currentPage.push(line);
            lineCount += wrappedLines;
          }
          if (currentPage.length > 0) pages.push(currentPage.join('\n'));
          if (pages.length === 0) pages.push('(Sin contenido)');

          const renderHeader = (showTitle) => (
            <div style={{ background: '#f8fafc' }}>
              {selected.headerConfig?.imageUrl ? (
                <img src={selected.headerConfig.imageUrl} alt="Header" style={{ width: '100%', display: 'block' }} />
              ) : (
                <div style={{ textAlign: 'center', padding: '12px 20px' }}>
                  {selected.headerConfig?.showColorBar !== false && (
                    <div style={{ display: 'flex', height: 8, marginBottom: 10 }}>
                      {['#2563eb', '#10b981', '#8b5cf6', '#f59e0b'].map(c => (
                        <div key={c} style={{ flex: 1, background: c }} />
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0891b2', letterSpacing: 0.5 }}>
                    {selected.headerConfig?.text || 'REPÚBLICA DE CHILE – I. MUNICIPALIDAD DE RENCA'}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                    {selected.headerConfig?.subtitle || 'SECRETARÍA MUNICIPAL'}
                  </div>
                </div>
              )}
              {showTitle && (
                <div style={{ textAlign: 'center', padding: '8px 20px 12px', fontWeight: 700, fontSize: 15, color: '#1e293b', letterSpacing: 0.3 }}>
                  {TYPE_LABELS[selected.documentType] || 'DOCUMENTO'}
                </div>
              )}
            </div>
          );

          const renderFooter = (pageNum, totalPages) => (
            <div style={{ background: '#f8fafc', marginTop: 'auto' }}>
              {selected.footerConfig?.imageUrl ? (
                <img src={selected.footerConfig.imageUrl} alt="Footer" style={{ width: '100%', display: 'block' }} />
              ) : (
                <div style={{ textAlign: 'center', padding: '8px 20px' }}>
                  <div style={{ fontSize: 9, color: '#64748b', marginBottom: 4 }}>
                    {selected.footerConfig?.text || 'Blanco Encalada 1335, Renca'}
                    {' | '}
                    {selected.footerConfig?.subtitle || '+562 2685 6600'}
                    {!selected.footerConfig?.text && ' | www.renca.cl'}
                  </div>
                  {selected.footerConfig?.showColorBar !== false && (
                    <div style={{ display: 'flex', height: 8, marginTop: 4 }}>
                      {['#2563eb', '#10b981', '#8b5cf6', '#f59e0b'].map(c => (
                        <div key={c} style={{ flex: 1, background: c }} />
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4 }}>
                    Página {pageNum} de {totalPages}
                  </div>
                </div>
              )}
            </div>
          );

          return (
            <div style={cardStyle}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, padding: '8px 12px', background: '#eff6ff', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Vista previa del documento final con datos de ejemplo.</span>
                <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#3b82f6' }}>
                  {isLegal ? 'Oficio (216×356mm)' : 'Carta (216×279mm)'} — {pages.length} {pages.length === 1 ? 'página' : 'páginas'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
                {pages.map((pageContent, i) => (
                  <div key={i} style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: 4,
                    background: '#fff',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    width: pageWidthPx,
                    maxWidth: '100%',
                    minHeight: pageHeightPx,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}>
                    {renderHeader(i === 0)}
                    <div style={{
                      fontFamily: 'serif',
                      fontSize: 13,
                      lineHeight: 1.8,
                      color: '#1e293b',
                      padding: '20px 28px',
                      flex: 1,
                    }}>
                      {parseTemplateBlocks(pageContent).map((block, bi) => {
                        if (block.type === 'cols') {
                          return (
                            <div key={bi} style={{ display: 'flex', gap: 16, margin: '12px 0' }}>
                              {block.columns.map((col, ci) => (
                                <div key={ci} style={{ flex: 1, whiteSpace: 'pre-wrap', textAlign: 'center' }}>
                                  {col}
                                </div>
                              ))}
                            </div>
                          );
                        }
                        if (block.type === 'table') {
                          return (
                            <table key={bi} style={{ width: '100%', borderCollapse: 'collapse', margin: '12px 0', fontSize: 12 }}>
                              <thead>
                                <tr>
                                  {block.headers.map((h, hi) => (
                                    <th key={hi} style={{
                                      border: '1px solid #cbd5e1', padding: '4px 8px',
                                      background: '#f1f5f9', fontWeight: 600, textAlign: 'left', fontSize: 11,
                                    }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {block.rows.map((row, ri) => (
                                  <tr key={ri}>
                                    {row.map((cell, ci) => (
                                      <td key={ci} style={{
                                        border: '1px solid #e5e7eb', padding: '3px 8px', fontSize: 11,
                                      }}>{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          );
                        }
                        return <div key={bi} style={{ whiteSpace: 'pre-wrap' }}>{block.content}</div>;
                      })}
                    </div>
                    {renderFooter(i + 1, pages.length)}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // ============================================
  // LIST VIEW
  // ============================================
  return (
    <div style={{ padding: 24, maxWidth: '100%' }}>
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
        <div className="r-grid-auto" style={{ gap: 16 }}>
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
