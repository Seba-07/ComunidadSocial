import { useState, useEffect, lazy, Suspense } from 'react';
import { useWizardStore } from '../../../stores/wizardStore';
import { useUiStore } from '../../../stores/uiStore';
import { apiService } from '@services/ApiService.js';
import { jsPDF } from 'jspdf';
import FileUpload from '../../../components/ui/FileUpload';
import tenant from '../../../../config/tenant.js';
import { getMissingVariables } from './estatutoVariables';

const EstatutoEditor = lazy(() => import('../../../components/wizard/EstatutoEditor'));

export default function Step4_Estatutos({ onNext, onPrev }) {
  const { formData, setFormDataField, templateConfig } = useWizardStore();
  const addToast = useUiStore(s => s.addToast);
  const estatutos = formData.estatutos || { type: 'template', content: null };
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);

  const orgType = formData.organization?.type;

  // Load template snapshot when template/edit mode selected and org type exists
  useEffect(() => {
    if ((estatutos.type === 'template' || estatutos.type === 'edit_template') && orgType && !snapshot) {
      loadSnapshot();
    }
  }, [estatutos.type, orgType]);

  async function loadSnapshot() {
    setLoading(true);
    try {
      const data = await apiService.getEstatutoTemplateSnapshot(orgType);
      setSnapshot(data);
      // Store snapshot in formData for later use (preserve editedArticles if they exist)
      setFormDataField('estatutos', {
        ...estatutos,
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
    const base = { ...estatutos, type, content: null, customFile: null, snapshot: null };
    if (type !== 'edit_template') base.editedArticles = null;
    setFormDataField('estatutos', base);
    if (type === 'template' || type === 'edit_template') {
      setSnapshot(null); // Will reload via useEffect
    }
  }

  const CITACION_LABELS = {
    carta_certificada: 'carta certificada al domicilio registrado',
    correo_electronico: 'correo electrónico al correo registrado',
    mensajeria_instantanea: 'mensajería instantánea (ej: WhatsApp) al número registrado',
    entrega_personal: 'entrega personal por escrito a cada socio',
    aviso_sede: 'aviso publicado en la sede de la organización',
    comunicacion_directa: 'comunicación directa a cada socio'
  };

  function replacePlaceholders(text) {
    if (!text) return text;
    const config = formData.config || {};
    const org = formData.organization || {};

    // Build full address: street + number + UV
    const addrParts = [
      [org.street, org.streetNumber].filter(Boolean).join(' N° ') || org.address || '_______________'
    ];
    if (org.neighborhood) addrParts.push(`Unidad Vecinal ${org.neighborhood}`);
    const fullAddress = addrParts.filter(Boolean).join(', ');

    // Cuota: "entre Min y Max Moneda" (sin $ si UTM/UF)
    let cuotaStr = '_______________';
    if (config.cuotaMin != null && config.cuotaMax != null) {
      const moneda = config.monedaCuota || 'UTM';
      const prefix = moneda === 'CLP' ? '$' : '';
      const suffix = moneda !== 'CLP' ? ` ${moneda}` : '';
      cuotaStr = `entre ${prefix}${config.cuotaMin}${suffix} y ${prefix}${config.cuotaMax}${suffix}`;
    }

    // Duración with año/años
    const duracion = config.duracionMandato || 3;
    const duracionStr = `${duracion} ${duracion === 1 ? 'año' : 'años'}`;

    const values = {
      '{{NOMBRE_ORGANIZACION}}': org.name || '_______________',
      '{{TIPO_ORGANIZACION}}': templateConfig?.nombreTipo || org.type || '_______________',
      '{{DESCRIPCION}}': org.description || '_______________',
      '{{OBJETIVOS}}': org.objectives || 'promover la integración, participación y desarrollo de la comunidad',
      '{{COMUNA}}': org.commune || tenant.communeName,
      '{{REGION}}': org.region || 'Región Metropolitana',
      '{{DIRECCION}}': fullAddress,
      '{{MIEMBROS_MINIMOS}}': String(templateConfig?.miembrosMinimos || 15),
      '{{NUM_MIEMBROS}}': String(formData.members?.length || 0),
      '{{EDAD_MINIMA}}': String(templateConfig?.edadConfig?.edadMinima || 14),
      '{{N_MIEMBROS}}': String(templateConfig?.directorio?.cargos?.length || templateConfig?.directorio?.totalRequerido || 5),
      '{{MIEMBROS_COMISION_ELECTORAL}}': String(templateConfig?.comisionElectoral?.cantidad || 3),
      '{{CUOTA_MENSUAL}}': cuotaStr,
      '{{CUOTA_INCORPORACION}}': config.cuotaIncorporacion ? `${config.cuotaIncorporacion} ${config.monedaCuota || 'UTM'}` : '_______________',
      '{{CUOTA_INC}}': config.cuotaIncorporacion ? `${config.cuotaIncorporacion} ${config.monedaCuota || 'UTM'}` : '_______________',
      '{{DURACION_MANDATO}}': duracionStr,
      '{{MESES_ASAMBLEA}}': (config.asambleas || []).join(' y ') || '_______________',
      '{{METODO_CITACION}}': CITACION_LABELS[config.metodoCitacion] || 'carta certificada al domicilio registrado',
      '{{DIAS_ANTICIPACION}}': String(config.diasAnticipacion || 10),
      '{{ENTIDAD_DISOLUCION}}': config.beneficiarioDisolucion || tenant.dissolutionEntity,
      '{{RUT_DISOLUCION}}': config.rutDisolucion || '_______________',
      '{{MES_INFORME}}': config.accountReviewMonth || 'Marzo',
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

  function downloadDraftPDF() {
    const doc = new jsPDF();
    const orgName = formData.organization?.name || 'Organización';
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 20;
    const contentWidth = 170;

    function addWatermark(d) {
      const pages = d.internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        d.setPage(i);
        // Diagonal watermark
        d.saveGraphicsState();
        d.setGState(new d.GState({ opacity: 0.08 }));
        d.setFont('helvetica', 'bold');
        d.setFontSize(72);
        d.setTextColor(220, 38, 38);
        d.text('BORRADOR', pageWidth / 2, pageHeight / 2, {
          align: 'center', angle: 45
        });
        d.restoreGraphicsState();
        // Top banner
        d.setFillColor(254, 242, 242);
        d.rect(0, 0, pageWidth, 14, 'F');
        d.setFont('helvetica', 'bold');
        d.setFontSize(9);
        d.setTextColor(185, 28, 28);
        d.text('DOCUMENTO PROVISORIO \u2013 SIN VALIDEZ LEGAL', pageWidth / 2, 9, { align: 'center' });
        d.setTextColor(0, 0, 0);
      }
    }

    // Title
    let y = 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ESTATUTOS (BORRADOR)', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(11);
    doc.text(orgName, pageWidth / 2, y, { align: 'center' });
    y += 12;

    // Articles — use editedArticles if in edit mode, otherwise raw articles with placeholder replacement
    const useEdited = estatutos.type === 'edit_template' && estatutos.editedArticles?.length;
    const sourceArticles = useEdited ? estatutos.editedArticles : articles;
    const sorted = [...sourceArticles].sort((a, b) => (a.orden || a.numero) - (b.orden || b.numero));
    for (const art of sorted) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      const titleText = `Art\u00edculo ${art.numero}: ${art.titulo}`;
      const titleLines = doc.splitTextToSize(titleText, contentWidth);
      for (const line of titleLines) {
        if (y > pageHeight - 20) { doc.addPage(); y = 24; }
        doc.text(line, marginLeft, y);
        y += 6;
      }
      y += 2;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const content = useEdited ? (art.contenido || '') : replacePlaceholders(art.contenido || '');
      const lines = doc.splitTextToSize(content, contentWidth);
      for (const line of lines) {
        if (y > pageHeight - 20) { doc.addPage(); y = 24; }
        doc.text(line, marginLeft, y);
        y += 5;
      }
      y += 6;
    }

    addWatermark(doc);
    doc.save(`Estatutos_Borrador_${orgName.replace(/\s+/g, '_')}.pdf`);
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
          { key: 'edit_template', label: 'Editar plantilla automática', desc: 'Personaliza el texto generado con un editor y validación en tiempo real' },
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

          {/* Download draft button */}
          {hasArticles && (
            <button
              onClick={downloadDraftPDF}
              style={{
                marginTop: 16, width: '100%', padding: '12px 20px',
                border: '1px solid #d1d5db', borderRadius: 10, background: 'white',
                fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              <span style={{ fontSize: 16 }}>&#8681;</span>
              Descargar Borrador para Revisión
            </button>
          )}

          {/* Info banner */}
          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
            padding: 14, marginTop: 16, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <span style={{ fontSize: 16 }}>&#9432;</span>
            <p style={{ margin: 0, fontSize: 13, color: '#1e40af' }}>
              Este estatuto será validado en la asamblea constitutiva. El borrador descargado no tiene validez legal.
            </p>
          </div>
        </div>
      )}

      {estatutos.type === 'edit_template' && (
        <div>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
              Cargando plantilla para edición...
            </div>
          )}

          {!loading && hasArticles && (
            <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Cargando editor...</div>}>
              <EstatutoEditor
                articles={articles}
                replacePlaceholders={replacePlaceholders}
                formData={formData}
                templateConfig={templateConfig}
                onChange={(edited) => {
                  setFormDataField('estatutos', { ...estatutos, editedArticles: edited });
                }}
              />
            </Suspense>
          )}

          {!loading && !hasArticles && (
            <div style={{
              background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10,
              padding: 14, fontSize: 13, color: '#92400e'
            }}>
              Selecciona un tipo de organización en el Paso 1 para cargar la plantilla.
            </div>
          )}

          {/* Download draft button for edited version */}
          {hasArticles && estatutos.editedArticles?.length > 0 && (
            <button
              onClick={downloadDraftPDF}
              style={{
                marginTop: 16, width: '100%', padding: '12px 20px',
                border: '1px solid #d1d5db', borderRadius: 10, background: 'white',
                fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              <span style={{ fontSize: 16 }}>&#8681;</span>
              Descargar Borrador Editado
            </button>
          )}

          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
            padding: 14, marginTop: 16, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <span style={{ fontSize: 16 }}>&#9432;</span>
            <p style={{ margin: 0, fontSize: 13, color: '#1e40af' }}>
              Los cambios solo aplican a esta organización. La plantilla estándar del Secretario Municipal no se modifica.
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

      <div className="r-toolbar" style={{ marginTop: 32 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={() => {
          if (estatutos.type === 'custom' && !estatutos.customFile) {
            addToast('Sube tu archivo de estatutos personalizados antes de continuar', 'error');
            return;
          }
          if (estatutos.customFile?.data) {
            const sizeMB = (estatutos.customFile.data.length * 0.75) / 1024 / 1024;
            if (sizeMB > 10) {
              addToast(`El archivo de estatutos pesa ${sizeMB.toFixed(1)}MB (máx. 10MB). Reduce su tamaño.`, 'error');
              return;
            }
          }
          if (estatutos.type === 'edit_template') {
            if (!estatutos.editedArticles?.length) {
              addToast('Edita al menos un artículo antes de continuar', 'error');
              return;
            }
            const missing = getMissingVariables(estatutos.editedArticles, formData, templateConfig, CITACION_LABELS);
            if (missing.length > 0) {
              addToast(`Variables obligatorias faltantes en el texto: ${missing.map(v => v.label).join(', ')}`, 'error');
              return;
            }
          }
          onNext();
        }} style={nextBtnS}>Siguiente</button>
      </div>
    </div>
  );
}

const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
const nextBtnS = { padding: '12px 28px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
