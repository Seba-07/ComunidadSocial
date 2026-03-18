import { useState, useEffect } from 'react';
import { useWizardStore } from '../../../stores/wizardStore';
import { useUiStore } from '../../../stores/uiStore';
import { pdfService } from '@services/PDFService.js';
import { apiService } from '@services/ApiService.js';
import { jsPDF } from 'jspdf';
import tenant from '../../../../config/tenant.js';

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function calculateAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function Step6_Review({ onNext, onPrev }) {
  const { formData, templateConfig } = useWizardStore();
  const addToast = useUiStore(s => s.addToast);
  const [docTemplates, setDocTemplates] = useState({});

  const org = formData.organization;
  const members = formData.members || [];
  const directorio = formData.directorioProvisorio || {};
  const comision = formData.comisionElectoral || {};
  const config = formData.config || {};
  const estatutos = formData.estatutos || {};
  const certs = formData.certificates || {};
  const inhCerts = formData.inhabilityCertificates || {};
  const comisionSize = templateConfig?.comisionElectoral?.cantidad || 3;
  const snapshot = estatutos.snapshot || {};

  // Load assigned document templates (content + header/footer config)
  useEffect(() => {
    async function loadDocTemplates() {
      const ids = {
        acta: templateConfig?.actaTemplateId,
        socios: templateConfig?.sociosTemplateId,
        nomina: templateConfig?.nominaTemplateId,
        carta: templateConfig?.cartaTemplateId,
      };
      const loaded = {};
      for (const [key, id] of Object.entries(ids)) {
        if (id) {
          try {
            const data = await apiService.getDocumentTemplatePublic(id);
            if (data.template?.content) {
              loaded[key] = {
                content: data.template.content,
                headerConfig: data.template.headerConfig || null,
                footerConfig: data.template.footerConfig || null,
                pageSize: data.template.pageSize || 'letter',
              };
            }
          } catch { /* ignore, will use hardcoded fallback */ }
        }
      }
      setDocTemplates(loaded);
    }
    loadDocTemplates();
  }, [templateConfig]);

  function buildListaSociosTable(membersList) {
    const header = 'N°|Nombre Completo|RUT|Edad|Domicilio|Firma';
    const rows = membersList.map((m, i) => {
      const nombre = `${m.firstName || ''} ${m.lastName || ''}`.trim();
      const rut = m.rut || '';
      let edad = '';
      if (m.birthDate) {
        const birth = new Date(m.birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
        edad = String(age);
      }
      const domicilio = m.address || '';
      return `${i + 1}|${nombre}|${rut}|${edad}|${domicilio}|`;
    });
    return `[TABLE]\n${header}\n${rows.join('\n')}\n[/TABLE]`;
  }

  // Build template replacement data from wizard steps
  function buildTemplateData() {
    const president = directorio.president || directorio.presidente || {};
    const secretary = directorio.secretary || directorio.secretario || {};
    const treasurer = directorio.treasurer || directorio.tesorero || {};
    const additionalMembers = directorio.additionalMembers || [];
    const comisionMembers = comision.members || [];

    const getName = (m) => m ? `${m.firstName || ''} ${m.lastName || ''}`.trim() || '___' : '___';

    return {
      NOMBRE_ORG: org.name || '',
      TIPO_ORG: templateConfig?.nombreTipo || org.type || '',
      DESCRIPCION: org.description || '',
      DIRECCION: org.address || [org.street, org.streetNumber].filter(Boolean).join(' ') || '',
      COMUNA: org.commune || tenant.communeName,
      REGION: org.region || 'Metropolitana',
      UNIDAD_VECINAL: org.neighborhood || '',
      EMAIL: org.email || '',
      TELEFONO: org.phone || '',
      OBJETIVOS: org.objectives || '',
      TOTAL_SOCIOS: String(members.length),
      LISTA_SOCIOS: buildListaSociosTable(members),
      PRESIDENTE: getName(president),
      RUT_PRESIDENTE: president.rut || '___',
      SECRETARIO: getName(secretary),
      RUT_SECRETARIO: secretary.rut || '___',
      TESORERO: getName(treasurer),
      RUT_TESORERO: treasurer.rut || '___',
      DIRECTORES: additionalMembers.map(m => `${getName(m)} (${m.rut || '___'})`).join(', ') || 'N/A',
      COMISION_ELECTORAL: comisionMembers.map(m => `${getName(m)} (${m.rut || '___'})`).join(', ') || 'N/A',
      FECHA_ASAMBLEA: '___',
      HORA_ASAMBLEA: '___',
      DURACION_MANDATO: String(config.duracionMandato || 3),
      CUOTA_INCORPORACION: config.cuotaIncorporacion ? `${config.cuotaIncorporacion} ${config.monedaCuota || 'UTM'}` : '0.5 UTM',
      CUOTA_MENSUAL: config.cuotaMin && config.cuotaMax
        ? `mínima de ${config.cuotaMin} ${config.monedaCuota || 'UTM'} y máxima de ${config.cuotaMax} ${config.monedaCuota || 'UTM'}`
        : '_______________',
      METODO_CITACION: ({
        carta_certificada: 'carta certificada al domicilio registrado',
        correo_electronico: 'correo electrónico al correo registrado',
        mensajeria_instantanea: 'mensajería instantánea (ej: WhatsApp) al número registrado',
        entrega_personal: 'entrega personal por escrito a cada socio',
        aviso_sede: 'aviso publicado en la sede de la organización',
        comunicacion_directa: 'comunicación directa a cada socio'
      })[config.metodoCitacion] || 'carta certificada al domicilio registrado',
      DIAS_ANTICIPACION: String(config.diasAnticipacion || 10),
      MESES_ASAMBLEA: (config.asambleas || []).join(' y ') || '_______________',
      ENTIDAD_DISOLUCION: config.beneficiarioDisolucion || tenant.dissolutionEntity || '_______________',
      RUT_DISOLUCION: config.rutDisolucion || '_______________',
      MES_INFORME: config.accountReviewMonth || 'Marzo',
      FECHA_HOY: new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }),
      MINISTRO_FE: '___',
      RUT_MINISTRO_FE: '___',
      UBICACION_ASAMBLEA: org.address || [org.street, org.streetNumber].filter(Boolean).join(' ') || '___',
      FIRMA_PRESIDENTE: `________________________\n${getName(president)}\nPresidente(a) Provisorio(a)\nRUT: ${president.rut || '___'}`,
      FIRMA_SECRETARIO: `________________________\n${getName(secretary)}\nSecretario(a) Provisorio(a)\nRUT: ${secretary.rut || '___'}`,
      FIRMA_TESORERO: `________________________\n${getName(treasurer)}\nTesorero(a) Provisorio(a)\nRUT: ${treasurer.rut || '___'}`,
      FIRMA_MINISTRO_FE: '________________________\n___\nMinistro de Fe\nRUT: ___',
    };
  }

  async function previewDocument(type) {
    try {
      const orgData = {
        organization: org,
        organizationName: org.name,
        organizationType: org.type,
        members,
        provisionalDirectorio: directorio,
        comisionElectoral: comision,
      };
      let doc;
      const tmpl = docTemplates[type] || null;
      const templateContent = tmpl?.content || null;
      const templateData = templateContent ? buildTemplateData() : null;

      // Prefetch header/footer images if template has them
      let config = {};
      if (tmpl?.headerConfig || tmpl?.footerConfig) {
        config = await pdfService.prefetchConfigImages(tmpl.headerConfig, tmpl.footerConfig);
      }
      // Pass page size from template
      if (tmpl?.pageSize) {
        config.pageSize = tmpl.pageSize;
      }

      if (type === 'acta') {
        doc = pdfService.generateActaAsamblea(orgData, templateContent, templateData, config);
      } else if (type === 'socios') {
        doc = pdfService.generateListaSocios(orgData, templateContent, templateData, config);
      } else if (type === 'declaraciones') {
        const docs = pdfService.generateAllDeclaracionesJuradas(orgData);
        if (docs.length > 0) doc = docs[0].doc;
        else {
          addToast('No hay directores para generar declaraciones', 'error');
          return;
        }
      }
      if (doc) {
        const url = pdfService.getPDFDataURL(doc);
        window.open(url, '_blank');
      }
    } catch (err) {
      addToast('Error al generar vista previa: ' + err.message, 'error');
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
    const addrParts = [
      [org.street, org.streetNumber].filter(Boolean).join(' N° ') || org.address || '___'
    ];
    if (org.neighborhood) addrParts.push(`Unidad Vecinal ${org.neighborhood}`);
    const fullAddress = addrParts.filter(Boolean).join(', ');
    const moneda = config.monedaCuota || 'UTM';
    const prefix = moneda === 'CLP' ? '$' : '';
    const suffix = moneda !== 'CLP' ? ` ${moneda}` : '';
    const cuotaStr = config.cuotaMin != null && config.cuotaMax != null
      ? `entre ${prefix}${config.cuotaMin}${suffix} y ${prefix}${config.cuotaMax}${suffix}`
      : '___';
    const dur = config.duracionMandato || 3;
    const values = {
      '{{NOMBRE_ORGANIZACION}}': org.name || '___',
      '{{TIPO_ORGANIZACION}}': templateConfig?.nombreTipo || org.type || '___',
      '{{DESCRIPCION}}': org.description || '___',
      '{{OBJETIVOS}}': org.objectives || '___',
      '{{COMUNA}}': org.commune || tenant.communeName,
      '{{REGION}}': org.region || 'Región Metropolitana',
      '{{DIRECCION}}': fullAddress,
      '{{MIEMBROS_MINIMOS}}': String(templateConfig?.miembrosMinimos || 15),
      '{{NUM_MIEMBROS}}': String(members.length),
      '{{EDAD_MINIMA}}': String(templateConfig?.edadConfig?.edadMinima || 14),
      '{{N_MIEMBROS}}': String(templateConfig?.directorio?.totalRequerido || 5),
      '{{MIEMBROS_COMISION_ELECTORAL}}': String(templateConfig?.comisionElectoral?.cantidad || 3),
      '{{CUOTA_MENSUAL}}': cuotaStr,
      '{{CUOTA_INCORPORACION}}': config.cuotaIncorporacion ? `${config.cuotaIncorporacion} ${moneda}` : '___',
      '{{CUOTA_INC}}': config.cuotaIncorporacion ? `${config.cuotaIncorporacion} ${moneda}` : '___',
      '{{DURACION_MANDATO}}': `${dur} ${dur === 1 ? 'año' : 'años'}`,
      '{{MESES_ASAMBLEA}}': (config.asambleas || []).join(' y ') || '___',
      '{{METODO_CITACION}}': CITACION_LABELS[config.metodoCitacion] || 'carta certificada al domicilio registrado',
      '{{DIAS_ANTICIPACION}}': String(config.diasAnticipacion || 10),
      '{{ENTIDAD_DISOLUCION}}': config.beneficiarioDisolucion || tenant.dissolutionEntity || '___',
      '{{RUT_DISOLUCION}}': config.rutDisolucion || '___',
      '{{MES_INFORME}}': config.accountReviewMonth || 'Marzo',
      '{{FECHA_DIA}}': '___', '{{FECHA_MES}}': '___', '{{FECHA_ANIO}}': '___',
    };
    let result = text;
    for (const [key, val] of Object.entries(values)) {
      result = result.replaceAll(key, val);
      result = result.replaceAll(key.replace('{{', '{').replace('}}', '}'), val);
    }
    return result;
  }

  function previewDraftEstatuto() {
    const useEdited = estatutos.type === 'edit_template' && estatutos.editedArticles?.length;
    const articles = useEdited ? estatutos.editedArticles : (snapshot?.articulos || []);
    if (!articles.length) { addToast('No hay artículos de estatuto para previsualizar', 'error'); return; }
    const doc = new jsPDF();
    const orgName = org.name || 'Organización';
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    function addWatermark(d) {
      const pages = d.internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        d.setPage(i);
        d.saveGraphicsState();
        d.setGState(new d.GState({ opacity: 0.08 }));
        d.setFont('helvetica', 'bold');
        d.setFontSize(72);
        d.setTextColor(220, 38, 38);
        d.text('BORRADOR', pw / 2, ph / 2, { align: 'center', angle: 45 });
        d.restoreGraphicsState();
        d.setFillColor(254, 242, 242);
        d.rect(0, 0, pw, 14, 'F');
        d.setFont('helvetica', 'bold');
        d.setFontSize(9);
        d.setTextColor(185, 28, 28);
        d.text('DOCUMENTO PROVISORIO \u2013 SIN VALIDEZ LEGAL', pw / 2, 9, { align: 'center' });
        d.setTextColor(0, 0, 0);
      }
    }

    let y = 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ESTATUTOS (BORRADOR)', pw / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(11);
    doc.text(orgName, pw / 2, y, { align: 'center' });
    y += 12;

    const sorted = [...articles].sort((a, b) => (a.orden || a.numero) - (b.orden || b.numero));
    for (const art of sorted) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      for (const line of doc.splitTextToSize(`Artículo ${art.numero}: ${art.titulo}`, 170)) {
        if (y > ph - 20) { doc.addPage(); y = 24; }
        doc.text(line, 20, y); y += 6;
      }
      y += 2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      for (const line of doc.splitTextToSize(useEdited ? (art.contenido || '') : replacePlaceholders(art.contenido || ''), 170)) {
        if (y > ph - 20) { doc.addPage(); y = 24; }
        doc.text(line, 20, y); y += 5;
      }
      y += 6;
    }
    addWatermark(doc);
    const url = doc.output('bloburl');
    window.open(url, '_blank');
  }

  // Build full address for display
  const displayAddress = [
    capitalize(org.street),
    org.streetNumber ? `N° ${org.streetNumber}` : '',
    org.neighborhood ? `UV ${org.neighborhood}` : '',
    org.commune
  ].filter(Boolean).join(', ');

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Revisión Final
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        Verifica toda la información antes de continuar.
      </p>

      {/* Org Data */}
      <Section title="Datos de la Organización">
        <Row label="Tipo" value={templateConfig?.nombreTipo || org.type} />
        <Row label="Nombre" value={org.name} />
        <Row label="Descripción" value={org.description} />
        <Row label="Dirección" value={displayAddress} />
        <Row label="Región" value={org.region} />
        <Row label="Email" value={org.email} />
        <Row label="Teléfono" value={org.phone} />
      </Section>

      {/* Objetivos */}
      {org.objectives && (
        <Section title="Objetivos de la Organización">
          <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {org.objectives}
          </p>
        </Section>
      )}

      {/* Members */}
      <Section title={`Miembros (${members.length})`}>
        <div style={{ maxHeight: 200, overflow: 'auto' }}>
          {members.slice(0, 10).map((m, i) => (
            <div key={i} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
              <span>{m.firstName} {m.lastName}</span>
              <span style={{ color: '#6b7280' }}>{m.rut}</span>
            </div>
          ))}
          {members.length > 10 && (
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
              ...y {members.length - 10} miembros más
            </p>
          )}
        </div>
      </Section>

      {/* Directorio */}
      <Section title="Directorio Provisorio">
        {(() => {
          const PERSON_KEYS = ['president', 'presidente', 'vicePresident', 'vicepresidente', 'secretary', 'secretario', 'treasurer', 'tesorero'];
          const SKIP_KEYS = new Set(['additionalMembers', 'designatedAt', 'type', '_id', '__v']);
          const entries = Object.entries(directorio).filter(([key, val]) =>
            !SKIP_KEYS.has(key) && val && typeof val === 'object' && !Array.isArray(val) && (val.firstName || val.rut)
          );
          const additional = directorio.additionalMembers || [];
          return (
            <>
              {entries.map(([cargo, data]) => (
                <div key={cargo} style={{ display: 'flex', gap: 12, padding: '4px 0', fontSize: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: '#374151', minWidth: 120 }}>{capitalize(data.cargo || data.cargoNombre || cargo)}:</span>
                  <span style={{ color: '#6b7280', flex: 1, minWidth: 150 }}>{data.firstName || ''} {data.lastName || ''} - {data.rut || '—'}</span>
                  {certs[cargo]
                    ? <span style={{ fontSize: 11, color: '#10b981' }}>Cert. OK</span>
                    : <span style={{ fontSize: 11, color: '#d97706' }}>Pendiente</span>}
                </div>
              ))}
              {additional.map((m, i) => (
                <div key={`add_${i}`} style={{ display: 'flex', gap: 12, padding: '4px 0', fontSize: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: '#374151', minWidth: 120 }}>{capitalize(m.cargoNombre || m.cargo || `Director/a ${i + 1}`)}:</span>
                  <span style={{ color: '#6b7280', flex: 1, minWidth: 150 }}>{m.firstName || ''} {m.lastName || ''} - {m.rut || '—'}</span>
                </div>
              ))}
              {(() => {
                const personKeys = entries.map(([k]) => k);
                const missing = personKeys.filter(c => !certs[c]);
                if (missing.length === 0) return null;
                return (
                  <div style={{ padding: 10, background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, marginTop: 8, fontSize: 12, color: '#92400e' }}>
                    <strong>Documentación Pendiente</strong> — Faltan certificados para: {missing.map(c => capitalize(directorio[c]?.cargo || directorio[c]?.cargoNombre || c)).join(', ')}.
                    Podrás subirlos desde el panel de tu organización.
                  </div>
                );
              })()}
            </>
          );
        })()}
      </Section>

      {/* Comisión */}
      <Section title={`Comisión Electoral (${(comision.members || []).length}/${comisionSize} miembros)`}>
        {(comision.members || []).map((m, i) => (
          <Row key={i} label={`Miembro ${i + 1}`} value={`${m.firstName} ${m.lastName} - ${m.rut}`} />
        ))}
      </Section>

      {/* Config */}
      <Section title="Configuración">
        <Row label="Asambleas ordinarias" value={(config.asambleas || []).join(', ')} />
        <Row label="Cuotas" value={(() => {
          const moneda = config.monedaCuota || 'UTM';
          const prefix = moneda === 'CLP' ? '$' : '';
          const suffix = moneda !== 'CLP' ? ` ${moneda}` : '';
          return `${prefix}${config.cuotaMin || 0}${suffix} — ${prefix}${config.cuotaMax || 0}${suffix}`;
        })()} />
        <Row label="Duración mandato" value={`${config.duracionMandato || 3} ${(config.duracionMandato || 3) === 1 ? 'año' : 'años'}`} />
        <Row label="Método de citación" value={CITACION_LABELS[config.metodoCitacion] || 'Carta certificada'} />
        <Row label="Mes de balance" value={config.accountReviewMonth || 'Marzo'} />
        <Row label="Institución de disolución" value={
          [config.beneficiarioDisolucion || tenant.dissolutionEntity || '—', config.rutDisolucion ? `RUT: ${config.rutDisolucion}` : ''].filter(Boolean).join(' — ')
        } />
      </Section>

      {/* Estatutos */}
      <Section title="Estatutos">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 14, color: '#374151' }}>
            {estatutos.type === 'template' ? 'Plantilla automática (Ley 19.418)'
              : estatutos.type === 'edit_template' ? 'Plantilla editada manualmente'
              : 'Documento personalizado'}
            {estatutos.type === 'custom' && estatutos.customFile?.name && (
              <span style={{ color: '#6b7280', marginLeft: 8 }}>— {estatutos.customFile.name}</span>
            )}
          </span>
          {(estatutos.type === 'template' || estatutos.type === 'edit_template') && snapshot?.articulos?.length > 0 && (
            <ViewButton onClick={previewDraftEstatuto} label="Ver Borrador" />
          )}
        </div>
      </Section>

      {/* Documents Preview */}
      <Section title="Documentos Generados">
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
          Los siguientes documentos se generarán automáticamente:
        </p>
        {[
          { key: 'acta', label: 'Acta de Asamblea Constitutiva' },
          { key: 'socios', label: 'Lista de Socios Fundadores' },
          { key: 'declaraciones', label: 'Declaraciones Juradas del Directorio' },
        ].map(doc => (
          <div key={doc.key} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap', gap: 8
          }}>
            <span style={{ fontSize: 14, color: '#374151' }}>{doc.label}</span>
            <ViewButton onClick={() => previewDocument(doc.key)} label="Ver" />
          </div>
        ))}
      </Section>

      {/* Documentos Adjuntos */}
      {(() => {
        const docs = [];
        for (const [cargoId, cert] of Object.entries(certs)) {
          const person = directorio[cargoId];
          if (person && cert?.name) {
            docs.push({ type: 'antecedentes', cargo: person.cargo || cargoId, name: `${person.firstName || ''} ${person.lastName || ''}`.trim(), file: cert.name, data: cert.data });
          }
        }
        for (const [cargoId, cert] of Object.entries(inhCerts)) {
          const person = directorio[cargoId];
          if (person && cert?.name) {
            docs.push({ type: 'inhabilidades', cargo: person.cargo || cargoId, name: `${person.firstName || ''} ${person.lastName || ''}`.trim(), file: cert.name, data: cert.data });
          }
        }
        // Identify minors in directorio who don't need inhability certs
        const minorExemptions = [];
        for (const [cargoId, person] of Object.entries(directorio)) {
          if (!person || !person.firstName) continue;
          const age = calculateAge(person.birthDate);
          if (age !== null && age < 18) {
            minorExemptions.push({
              cargo: capitalize(person.cargo || cargoId),
              name: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
              age
            });
          }
        }

        if (docs.length === 0 && minorExemptions.length === 0) return null;

        function viewDoc(d) {
          if (!d.data) {
            addToast('Archivo no disponible — vuelve al Paso 5 y sube el certificado nuevamente', 'error');
            return;
          }
          const w = window.open('');
          if (!w) return;
          if (d.data.startsWith('data:application/pdf') || d.file?.endsWith('.pdf')) {
            w.document.write(`<iframe src="${d.data}" style="width:100%;height:100%;border:none;position:fixed;top:0;left:0;"></iframe>`);
          } else {
            w.document.write(`<div style="display:flex;justify-content:center;padding:20px;background:#f1f5f9;min-height:100vh;"><img src="${d.data}" style="max-width:100%;max-height:95vh;object-fit:contain;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.15);"/></div>`);
          }
        }

        return (
          <Section title={`Documentos Adjuntos (${docs.length})`}>
            {docs.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <div style={{ position: 'absolute', bottom: -1, right: -3, width: 11, height: 11, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="7" height="7" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="2 6 5 9 10 3"/></svg>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    {d.type === 'inhabilidades' ? 'Cert. Inhabilidades' : 'Cert. Antecedentes'} — {d.file}
                  </div>
                </div>
                <ViewButton onClick={() => viewDoc(d)} label="Ver" />
              </div>
            ))}
            {minorExemptions.map((ex, i) => (
              <div key={`minor_${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < minorExemptions.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>{ex.name} ({ex.cargo})</div>
                  <div style={{ fontSize: 11, color: '#b0b7c3' }}>
                    Cert. Inhabilidades: No aplica (Menor de edad — {ex.age} años)
                  </div>
                </div>
              </div>
            ))}
          </Section>
        );
      })()}

      {/* Warning */}
      <div style={{
        background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10,
        padding: 16, marginTop: 20, marginBottom: 24
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
          Revisa que toda la información sea correcta antes de continuar al agendamiento de la asamblea.
        </p>
      </div>

      <div className="r-toolbar">
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={onNext} style={{
          padding: '12px 28px', border: 'none', borderRadius: 10,
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer'
        }}>Siguiente</button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: 16, marginBottom: 16
    }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#111827' }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '4px 0', fontSize: 14, flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 600, color: '#374151', minWidth: 120 }}>{label}:</span>
      <span style={{ color: '#6b7280' }}>{value}</span>
    </div>
  );
}

const eyeIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

function ViewButton({ onClick, label = 'Ver' }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px',
      border: 'none',
      borderRadius: 8,
      background: 'linear-gradient(135deg, #f0f5ff, #e8eeff)',
      color: '#2563eb',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      flexShrink: 0,
      transition: 'all 0.15s',
      boxShadow: '0 1px 2px rgba(37,99,235,0.08)',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)'; e.currentTarget.style.color = 'white'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #f0f5ff, #e8eeff)'; e.currentTarget.style.color = '#2563eb'; }}
    >
      {eyeIcon}
      {label}
    </button>
  );
}

const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
