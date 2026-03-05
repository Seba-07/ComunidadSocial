import { useState, useEffect } from 'react';
import { useWizardStore } from '../../../stores/wizardStore';
import { useUiStore } from '../../../stores/uiStore';
import { apiService } from '@services/ApiService.js';
import FileUpload from '../../../components/ui/FileUpload';

export default function Step4_Estatutos({ onNext, onPrev }) {
  const { formData, setFormDataField, templateConfig } = useWizardStore();
  const addToast = useUiStore(s => s.addToast);
  const estatutos = formData.estatutos || { type: 'template', content: null };
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);

  const orgType = formData.organization?.type;

  // Load template snapshot when template mode selected and org type exists
  useEffect(() => {
    if (estatutos.type === 'template' && orgType && !snapshot) {
      loadSnapshot();
    }
  }, [estatutos.type, orgType]);

  async function loadSnapshot() {
    setLoading(true);
    try {
      const data = await apiService.getEstatutoTemplateSnapshot(orgType);
      setSnapshot(data);
      // Store snapshot in formData for later use
      setFormDataField('estatutos', {
        ...estatutos,
        type: 'template',
        snapshot: data,
        content: data.documentoCompleto || null
      });
    } catch (err) {
      console.error('Error loading template snapshot:', err);
      addToast('No se pudo cargar la plantilla de estatutos', 'error');
    } finally {
      setLoading(false);
    }
  }

  function setType(type) {
    setFormDataField('estatutos', { ...estatutos, type, content: null, customFile: null, snapshot: null });
    if (type === 'template') {
      setSnapshot(null); // Will reload via useEffect
    }
  }

  const CITACION_LABELS = {
    carta_certificada: 'carta certificada al domicilio registrado',
    correo_electronico: 'correo electrónico al correo registrado',
    aviso_sede: 'aviso publicado en la sede de la organización',
    comunicacion_directa: 'comunicación directa a cada socio'
  };

  function replacePlaceholders(text) {
    if (!text) return text;
    const config = formData.config || {};
    const values = {
      '{{NOMBRE_ORGANIZACION}}': formData.organization?.name || '_______________',
      '{{TIPO_ORGANIZACION}}': templateConfig?.nombreTipo || formData.organization?.type || '_______________',
      '{{OBJETIVOS}}': formData.organization?.objectives || 'promover la integración, participación y desarrollo de la comunidad',
      '{{COMUNA}}': formData.organization?.commune || 'Renca',
      '{{REGION}}': formData.organization?.region || 'Región Metropolitana',
      '{{DIRECCION}}': formData.organization?.street || '_______________',
      '{{MIEMBROS_MINIMOS}}': String(templateConfig?.miembrosMinimos || 15),
      '{{NUM_MIEMBROS}}': String(formData.members?.length || 0),
      '{{EDAD_MINIMA}}': String(templateConfig?.edadConfig?.edadMinima || 14),
      '{{N_MIEMBROS}}': String(templateConfig?.directorio?.totalRequerido || 5),
      '{{MIEMBROS_COMISION_ELECTORAL}}': String(templateConfig?.comisionElectoral?.cantidad || 3),
      '{{CUOTA_MENSUAL}}': config.cuotaMin && config.cuotaMax
        ? `mínima de ${config.cuotaMin} UTM y máxima de ${config.cuotaMax} UTM`
        : '_______________',
      '{{CUOTA_INCORPORACION}}': config.cuotaIncorporacion ? `${config.cuotaIncorporacion} UTM` : '_______________',
      '{{DURACION_MANDATO}}': String(config.duracionMandato || 3),
      '{{MESES_ASAMBLEA}}': (config.asambleas || []).join(' y ') || '_______________',
      '{{METODO_CITACION}}': CITACION_LABELS[config.metodoCitacion] || 'carta certificada al domicilio registrado',
      '{{DIAS_ANTICIPACION}}': String(config.diasAnticipacion || 10),
      '{{ENTIDAD_DISOLUCION}}': config.beneficiarioDisolucion || 'Corporación Municipal de Renca',
      '{{RUT_DISOLUCION}}': config.rutDisolucion || '_______________',
      '{{FECHA_DIA}}': '_______________',
      '{{FECHA_MES}}': '_______________',
      '{{FECHA_ANIO}}': '_______________',
    };
    let result = text;
    for (const [key, val] of Object.entries(values)) {
      result = result.replaceAll(key, val);
      // Backward compat: single-brace format
      result = result.replaceAll(key.replace('{{', '{').replace('}}', '}'), val);
    }
    return result;
  }

  function handleCustomFile(file) {
    if (!file) {
      setFormDataField('estatutos', { type: 'custom', content: null, customFile: null });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormDataField('estatutos', {
        type: 'custom',
        content: null,
        customFile: { name: file.name, data: reader.result, type: file.type }
      });
    };
    reader.readAsDataURL(file);
  }

  const articles = snapshot?.articulos || [];
  const hasArticles = articles.length > 0;

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Estatutos
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        Selecciona cómo configurar los estatutos de tu organización.
      </p>

      <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
        {[
          { key: 'template', label: 'Usar plantilla automática', desc: 'Generados según Ley 19.418 y tipo de organización' },
          { key: 'custom', label: 'Subir estatutos personalizados', desc: 'Sube tu propio archivo (PDF, DOC, DOCX)' }
        ].map(opt => (
          <div
            key={opt.key}
            onClick={() => setType(opt.key)}
            style={{
              padding: 16, borderRadius: 12, cursor: 'pointer',
              border: estatutos.type === opt.key ? '2px solid #2563eb' : '1px solid #d1d5db',
              background: estatutos.type === opt.key ? '#eff6ff' : 'white'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: estatutos.type === opt.key ? '6px solid #2563eb' : '2px solid #d1d5db'
              }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{opt.label}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{opt.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {estatutos.type === 'template' && (
        <div>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
              Cargando plantilla de estatutos...
            </div>
          )}

          {!loading && hasArticles && (
            <div style={{
              background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12,
              maxHeight: 400, overflowY: 'auto', padding: 20
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#111827' }}>
                Estatutos - {templateConfig?.nombreTipo || formData.organization?.type}
              </h3>
              {articles.map((art, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#1e40af' }}>
                    Artículo {art.numero}: {art.titulo}
                  </h4>
                  <p style={{
                    margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {replacePlaceholders(art.contenido)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {!loading && !hasArticles && (
            <div style={{
              background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20
            }}>
              <p style={{ margin: 0, fontSize: 14, color: '#374151' }}>
                Los estatutos serán generados automáticamente basados en la Ley 19.418 y el tipo de organización seleccionada.
              </p>
            </div>
          )}

          {/* Info banner */}
          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
            padding: 14, marginTop: 16, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <span style={{ fontSize: 16 }}>&#9432;</span>
            <p style={{ margin: 0, fontSize: 13, color: '#1e40af' }}>
              Este estatuto será validado en la asamblea constitutiva.
            </p>
          </div>
        </div>
      )}

      {estatutos.type === 'custom' && (
        <div>
          <FileUpload
            accept=".pdf,.doc,.docx"
            label="Arrastra o selecciona tus estatutos (PDF, DOC, DOCX)"
            maxSizeMB={10}
            onFile={handleCustomFile}
            value={estatutos.customFile}
          />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={onNext} style={nextBtnS}>Siguiente</button>
      </div>
    </div>
  );
}

const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
const nextBtnS = { padding: '12px 28px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
