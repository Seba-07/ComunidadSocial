import express from 'express';
import crypto from 'crypto';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import Organization from '../models/Organization.js';
import Assembly from '../models/Assembly.js';
import DocumentRegistry, { DOCUMENT_TYPE_LABELS } from '../models/DocumentRegistry.js';
import * as assemblyService from '../services/assemblyService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import tenant from '../config/tenant.js';

const router = express.Router();

// URL base para validación pública de documentos
function getValidationUrl() {
  const url = process.env.FRONTEND_URL;
  if (!url) {
    const isDeployed = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
    if (isDeployed) {
      throw new Error('FRONTEND_URL no está definida en las variables de entorno. No se puede generar enlaces de validación.');
    }
    return 'http://localhost:5173/app/validar';
  }
  return `${url.replace(/\/+$/, '')}/app/validar`;
}

/**
 * Registra un documento en DocumentRegistry y genera el bloque HTML del QR + folio
 * para inyectar en el pie de página del PDF.
 */
async function registerDocumentAndGetQR({ organizationId, documentType, documentTitle, issuedBy, assemblyId, pdfBuffer }) {
  // Crear registro
  const record = new DocumentRegistry({
    organizationId,
    documentType,
    documentTitle: documentTitle || DOCUMENT_TYPE_LABELS[documentType] || documentType,
    issuedBy: issuedBy || null,
    assemblyId: assemblyId || null,
    fileHash: pdfBuffer ? crypto.createHash('sha256').update(pdfBuffer).digest('hex') : null
  });
  await record.save();

  const folio = record.folio;
  const verifyUrl = `${getValidationUrl()}/${folio}`;

  // Generar QR en base64
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 100,
    margin: 1,
    color: { dark: '#1e293b', light: '#ffffff' }
  });

  return { folio, qrDataUrl, verifyUrl, record };
}

/**
 * Genera el bloque HTML del footer de verificación con QR
 */
function buildVerificationFooter(folio, qrDataUrl, verifyUrl) {
  return `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; align-items: center; gap: 16px; page-break-inside: avoid;">
      <img src="${qrDataUrl}" alt="QR Verificación" style="width: 80px; height: 80px; flex-shrink: 0;" />
      <div style="font-size: 9px; color: #64748b; line-height: 1.5;">
        <div style="font-weight: 700; color: #334155; font-size: 10px; margin-bottom: 2px;">Verificación de Autenticidad</div>
        Valide este documento escaneando el código QR o ingresando el folio
        <strong style="color: #1e40af; font-family: monospace; font-size: 10px;">${folio}</strong>
        en <span style="color: #1e40af;">${verifyUrl}</span><br>
        <span style="color: #94a3b8;">Emitido: ${new Date().toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })} · Sistema ComunidadSocial</span>
      </div>
    </div>`;
}

/**
 * Inyecta el footer de verificación QR antes del cierre </body> de un HTML
 */
function injectQRFooter(html, footerHtml) {
  return html.replace('</body>', `${footerHtml}</body>`);
}

// Puppeteer launch options for Railway/production
const PUPPETEER_OPTIONS = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu'
  ]
};

// Helper: Formatear fecha
const formatDate = (date) => {
  if (!date) return '---';
  const d = new Date(date);
  const day = d.getDate();
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} de ${month} del ${year}`;
};

// Helper: Obtener tipo de organización legible
const getOrgTypeName = (type) => {
  const TIPOS = {
    'JUNTA_VECINOS': 'Junta de Vecinos',
    'COMITE_VECINOS': 'Comité de Vecinos',
    'CLUB_DEPORTIVO': 'Club Deportivo',
    'CLUB_ADULTO_MAYOR': 'Club de Adulto Mayor',
    'CENTRO_PADRES': 'Centro de Padres y Apoderados',
    'COMITE_VIVIENDA': 'Comité de Vivienda',
    'COMITE_CONVIVENCIA': 'Comité Vecinal de Prevención y Convivencia Comunitaria',
    'ORG_CULTURAL': 'Organización Cultural',
    'ORG_MUJERES': 'Organización de Mujeres',
    'ORG_INDIGENA': 'Organización Indígena',
    'ORG_SALUD': 'Organización de Salud',
    'ORG_SOCIAL': 'Organización Social',
    'AGRUPACION_FOLCLORICA': 'Agrupación Folclórica',
    'AGRUPACION_EMPRENDEDORES': 'Agrupación de Emprendedores',
    'COMITE_ADELANTO': 'Comité de Adelanto',
    'COMITE_MEJORAMIENTO': 'Comité de Mejoramiento'
  };
  return TIPOS[type] || type || 'Organización Comunitaria';
};

// Helper: Generar HTML para Acta Constitutiva
const generateActaHTML = (org, assembly = null) => {
  const tipoOrg = getOrgTypeName(org.organizationType || org.type);
  const orgName = org.organizationName || org.name || '';
  const address = org.address || org.direccion || '';
  const unidadVecinal = org.unidadVecinal || org.neighborhood || '';
  const today = formatDate(new Date());

  // Obtener directorio — build unified list from both old and new format
  const directorio = org.provisionalDirectorio || {};
  const dirMembers = [];
  const getName = (m) => m ? `${m.firstName || ''} ${m.lastName || ''}`.trim() : null;

  // Fixed fields — soporta llaves en inglés (backend) y español (wizard)
  const president = directorio.president || directorio.presidente;
  const vicePresident = directorio.vicePresident || directorio.vicepresidente;
  const secretary = directorio.secretary || directorio.secretario;
  const treasurer = directorio.treasurer || directorio.tesorero;
  if (president) dirMembers.push({ cargo: 'Presidente/a', name: getName(president), rut: president.rut, orden: 1 });
  if (vicePresident) dirMembers.push({ cargo: 'Vicepresidente/a', name: getName(vicePresident), rut: vicePresident.rut, orden: 2 });
  if (secretary) dirMembers.push({ cargo: 'Secretario/a', name: getName(secretary), rut: secretary.rut, orden: 3 });
  if (treasurer) dirMembers.push({ cargo: 'Tesorero/a', name: getName(treasurer), rut: treasurer.rut, orden: 4 });
  // Additional members (directors, custom cargos)
  (directorio.additionalMembers || []).forEach((m, i) => {
    if (m) dirMembers.push({ cargo: m.cargoNombre || m.cargo || `Director/a ${i + 1}`, name: getName(m), rut: m.rut, orden: m.orden || 5 + i });
  });
  dirMembers.sort((a, b) => a.orden - b.orden);

  const directorioHTML = dirMembers.length > 0
    ? dirMembers.map(d => `<strong>${d.cargo}:</strong> ${d.name || '_______________'}${d.rut ? ` (RUT: ${d.rut})` : ''}`).join('<br>\n      ')
    : '<strong>Presidente/a:</strong> _______________<br>\n      <strong>Secretario/a:</strong> _______________<br>\n      <strong>Tesorero/a:</strong> _______________';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acta Constitutiva - ${orgName}</title>
  <style>
    @page {
      size: A4;
      margin: 2.5cm;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 16pt;
      font-weight: bold;
      margin: 0 0 10px;
      text-transform: uppercase;
    }
    .header h2 {
      font-size: 14pt;
      font-weight: normal;
      margin: 0;
    }
    .content {
      text-align: justify;
    }
    .content p {
      margin: 12px 0;
      text-indent: 1.5cm;
    }
    .section-title {
      font-weight: bold;
      margin-top: 20px;
      text-indent: 0 !important;
    }
    .signature-area {
      margin-top: 50px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .signature-box {
      width: 45%;
      text-align: center;
      margin-bottom: 40px;
    }
    .signature-line {
      border-top: 1px solid #000;
      margin-top: 60px;
      padding-top: 5px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 10pt;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>ACTA DE CONSTITUCIÓN</h1>
    <h2>${tipoOrg}</h2>
    <h2>"${orgName}"</h2>
  </div>

  <div class="content">
    <p>
      En ${tenant.communeName || 'la comuna'}, Región Metropolitana de Santiago, a ${today}, siendo las _______ horas,
      se reúnen en _____________________________________, los ciudadanos que al final suscriben,
      con el objeto de constituir una organización comunitaria de carácter ${tipoOrg === 'Junta de Vecinos' ? 'territorial' : 'funcional'},
      que se denominará "${orgName}".
    </p>

    <p class="section-title">PRIMERO: ASISTENCIA Y QUÓRUM</p>
    <p>
      ${assembly && assembly.attendees?.length
        ? `Asisten a esta Asamblea Constitutiva un total de <strong>${assembly.attendees.length}</strong> personas`
        : 'Asisten a esta Asamblea Constitutiva un total de ______ personas'}, mayores de 14 años,
      que residen en la comuna de ${tenant.communeName || 'la comuna'}${unidadVecinal ? `, específicamente en la Unidad Vecinal ${unidadVecinal}` : ''},
      cuyos nombres, RUT, domicilios y firmas se encuentran en el registro de asistentes anexo a la presente acta.
    </p>
    ${assembly ? `<p>
      ${(() => {
        const totalMembers = org.members?.length || 0;
        const attendeeCount = assembly.attendees?.length || 0;
        const qType = assembly.quorumType || 'percentage';
        const qValue = assembly.quorumValue ?? 50;
        const required = qType === 'percentage' ? Math.ceil(totalMembers * (qValue / 100)) : qValue;
        const met = attendeeCount >= required;
        return `Verificado el quórum reglamentario de ${qType === 'percentage' ? `${qValue}% (${required} socios requeridos de ${totalMembers} miembros hábiles)` : `${qValue} socios requeridos`}, con ${attendeeCount} socios presentes, se declara el quórum <strong>${met ? 'CUMPLIDO' : 'NO CUMPLIDO'}</strong>.`;
      })()}
    </p>` : ''}

    <p class="section-title">SEGUNDO: DIRECTORIO PROVISORIO</p>
    <p>
      La Asamblea acuerda por unanimidad designar el siguiente Directorio Provisorio:
    </p>
    <p style="text-indent: 0; padding-left: 2cm;">
      ${directorioHTML}
    </p>

    <p class="section-title">TERCERO: ESTATUTOS</p>
    ${(() => {
      if (!assembly) return `<p>La Asamblea aprueba por unanimidad los estatutos que regirán la organización, los cuales se adjuntan como anexo a la presente acta.</p>`;
      const estatutosItem = (assembly.agendaItems || []).find(item =>
        item.type === 'reforma_estatutos' || item.type === 'aprobacion_presupuesto' || item.type === 'custom'
      );
      if (estatutosItem?.result?.mode === 'mano_alzada') {
        const r = estatutosItem.result;
        return `<p>Sometidos a votación a mano alzada los estatutos que regirán la organización, se obtiene el siguiente resultado: <strong>${r.resolucion === 'aprobado' ? 'APROBADO' : 'RECHAZADO'}</strong>${r.votosAFavor != null ? ` con ${r.votosAFavor} votos a favor, ${r.votosEnContra || 0} en contra y ${r.abstenciones || 0} abstenciones` : ''}.${r.observaciones ? ` Observaciones: ${r.observaciones}` : ''} Los estatutos aprobados se adjuntan como anexo.</p>`;
      }
      return `<p>La Asamblea aprueba los estatutos que regirán la organización, los cuales se adjuntan como anexo a la presente acta.</p>`;
    })()}

    <p class="section-title">CUARTO: DOMICILIO</p>
    <p>
      Se fija como domicilio de la organización: ${address || '___________________________________'},
      comuna de ${tenant.communeName || 'la comuna'}, Región Metropolitana.
    </p>

    <p class="section-title">QUINTO: CIERRE</p>
    <p>
      No habiendo más que tratar, se levanta la sesión siendo las ${
        assembly?.finishedAt
          ? new Date(assembly.finishedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
          : '_______'
      } horas del mismo día.
    </p>
  </div>

  <div class="signature-area">
    <div class="signature-box">
      <div class="signature-line">Presidente/a Provisorio/a</div>
    </div>
    <div class="signature-box">
      <div class="signature-line">Secretario/a Provisorio/a</div>
    </div>
    <div class="signature-box">
      <div class="signature-line">Tesorero/a Provisorio/a</div>
    </div>
    <div class="signature-box">
      <div class="signature-line">Ministro de Fe</div>
    </div>
  </div>

  <div class="footer">
    Documento generado por Sistema de Organizaciones Comunitarias - ${tenant.municipalityName}
  </div>
</body>
</html>
  `;
};

// Helper: Generar HTML para Lista de Socios
const generateMembersListHTML = (org) => {
  const orgName = org.organizationName || org.name || '';
  const members = org.members || [];
  const today = formatDate(new Date());

  const memberRows = members.map((m, index) => {
    const name = m.primerNombre ?
      `${m.primerNombre} ${m.segundoNombre || ''} ${m.apellidoPaterno || ''} ${m.apellidoMaterno || ''}`.trim() :
      `${m.firstName || ''} ${m.lastName || ''}`.trim();
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${name || 'Sin nombre'}</td>
        <td>${m.rut || '---'}</td>
        <td>${m.address || m.direccion || '---'}</td>
        <td></td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Lista de Socios - ${orgName}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      color: #000;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 14pt;
      font-weight: bold;
      margin: 0 0 5px;
    }
    .header h2 {
      font-size: 12pt;
      font-weight: normal;
      margin: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th, td {
      border: 1px solid #333;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #1e40af;
      color: white;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f3f4f6;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 9pt;
      color: #666;
    }
    .total {
      margin-top: 15px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>LISTA DE SOCIOS FUNDADORES</h1>
    <h2>${orgName}</h2>
    <p>Fecha: ${today}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 5%">N°</th>
        <th style="width: 30%">Nombre Completo</th>
        <th style="width: 15%">RUT</th>
        <th style="width: 30%">Domicilio</th>
        <th style="width: 20%">Firma</th>
      </tr>
    </thead>
    <tbody>
      ${memberRows}
    </tbody>
  </table>

  <div class="total">
    Total de socios: ${members.length}
  </div>

  <div class="footer">
    Documento generado por Sistema de Organizaciones Comunitarias - ${tenant.municipalityName}
  </div>
</body>
</html>
  `;
};

/**
 * GET /api/documents/:orgId/generate-acta
 * Genera el PDF del Acta Constitutiva
 */
router.get('/:orgId/generate-acta', authenticate, async (req, res) => {
  let browser = null;

  try {
    const { orgId } = req.params;
    const org = await Organization.findById(orgId);

    if (!org) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Buscar asamblea finalizada más reciente para enriquecer el acta
    const assembly = await Assembly.findOne({ organizationId: orgId, status: 'finalizada' })
      .sort({ finishedAt: -1 })
      .lean();

    // Generar HTML (con datos de asamblea si existe)
    let html = generateActaHTML(org, assembly);

    // Registrar documento y generar QR
    const { folio, qrDataUrl, verifyUrl } = await registerDocumentAndGetQR({
      organizationId: org._id,
      documentType: 'acta_constitutiva',
      documentTitle: `Acta Constitutiva - ${org.organizationName || ''}`,
      issuedBy: req.user?._id,
      assemblyId: assembly?._id || null
    });
    html = injectQRFooter(html, buildVerificationFooter(folio, qrDataUrl, verifyUrl));

    // Lanzar Puppeteer
    browser = await puppeteer.launch(PUPPETEER_OPTIONS);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '2.5cm', right: '2cm', bottom: '2.5cm', left: '2cm' }
    });

    await browser.close();
    browser = null;

    // Actualizar hash del PDF generado
    await DocumentRegistry.updateOne({ folio }, { fileHash: crypto.createHash('sha256').update(pdf).digest('hex') });

    const fileName = `Acta_Constitutiva_${org.organizationName || org.name || 'Organizacion'}.pdf`.replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);

  } catch (error) {
    console.error('Error generating acta PDF:', error);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Error al generar PDF del acta' });
  }
});

/**
 * GET /api/documents/:orgId/generate-members
 * Genera el PDF de la Lista de Socios
 */
router.get('/:orgId/generate-members', authenticate, async (req, res) => {
  let browser = null;

  try {
    const { orgId } = req.params;
    const org = await Organization.findById(orgId);

    if (!org) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Generar HTML
    let html = generateMembersListHTML(org);

    // Registrar documento y generar QR
    const { folio, qrDataUrl, verifyUrl } = await registerDocumentAndGetQR({
      organizationId: org._id,
      documentType: 'lista_socios',
      documentTitle: `Lista de Socios - ${org.organizationName || ''}`,
      issuedBy: req.user?._id
    });
    html = injectQRFooter(html, buildVerificationFooter(folio, qrDataUrl, verifyUrl));

    browser = await puppeteer.launch(PUPPETEER_OPTIONS);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '2cm', right: '1.5cm', bottom: '2cm', left: '1.5cm' }
    });

    await browser.close();
    browser = null;

    await DocumentRegistry.updateOne({ folio }, { fileHash: crypto.createHash('sha256').update(pdf).digest('hex') });

    const fileName = `Lista_Socios_${org.organizationName || org.name || 'Organizacion'}.pdf`.replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);

  } catch (error) {
    console.error('Error generating members PDF:', error);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Error al generar PDF de socios' });
  }
});

/**
 * GET /api/documents/:orgId/preview-acta
 * Retorna el HTML del Acta para preview (sin generar PDF)
 */
router.get('/:orgId/preview-acta', authenticate, async (req, res) => {
  try {
    const { orgId } = req.params;
    const org = await Organization.findById(orgId);

    if (!org) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    const assembly = await Assembly.findOne({ organizationId: orgId, status: 'finalizada' })
      .sort({ finishedAt: -1 })
      .lean();

    const html = generateActaHTML(org, assembly);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    console.error('Error generating acta preview:', error);
    res.status(500).json({ error: 'Error al generar preview del acta' });
  }
});

// ============================================================
// ACTA DE ESCRUTINIO — Resultados detallados de votación
// ============================================================

const generateActaEscrutinioHTML = (org, assembly) => {
  const tipoOrg = getOrgTypeName(org.organizationType || org.type);
  const orgName = org.organizationName || org.name || '';
  const totalMembers = org.members?.length || 0;
  const attendeeCount = assembly.attendees?.length || 0;
  const qType = assembly.quorumType || 'percentage';
  const qValue = assembly.quorumValue ?? 50;
  const required = qType === 'percentage' ? Math.ceil(totalMembers * (qValue / 100)) : qValue;
  const quorumMet = attendeeCount >= required;

  // Métodos de check-in
  const qrCount = (assembly.attendees || []).filter(a => a.method === 'qr').length;
  const manualCount = attendeeCount - qrCount;

  // Generar secciones por punto de agenda con resultado
  const agendaSections = (assembly.agendaItems || []).filter(item => item.result).map(item => {
    const r = item.result;
    if (r.mode === 'per_cargo') {
      const rows = [];
      const votesByCargo = r.votesByCargo || {};
      for (const [cargo, candidates] of Object.entries(votesByCargo)) {
        const winnerRut = r.winners?.[cargo]?.rut;
        for (const [candidateRut, voteCount] of Object.entries(candidates)) {
          const candidate = (item.candidates || []).find(c => c.rut === candidateRut);
          const name = candidate ? `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() : candidateRut;
          rows.push(`<tr${candidateRut === winnerRut ? ' style="background:#d1fae5;font-weight:bold"' : ''}>
            <td>${name}</td><td>${cargo}</td><td style="text-align:center">${voteCount}</td>
            <td style="text-align:center">${candidateRut === winnerRut ? 'ELECTO' : ''}</td></tr>`);
        }
      }
      return `<h3>${item.title || 'Elección de Directorio'}</h3>
        <p>Modo de votación: <strong>Voto secreto por cargo</strong></p>
        <p>Total votos emitidos: ${item.anonymousVotes?.length || item.votes?.length || 0}</p>
        <table><thead><tr><th>Candidato</th><th>Cargo</th><th>Votos</th><th>Resultado</th></tr></thead>
        <tbody>${rows.join('')}</tbody></table>`;
    } else if (r.mode === 'per_lista') {
      const listaRows = Object.entries(r.votesByLista || {})
        .sort((a, b) => b[1] - a[1])
        .map(([lista, votes]) => `<tr${lista === r.winningLista ? ' style="background:#d1fae5;font-weight:bold"' : ''}>
          <td>${lista}</td><td style="text-align:center">${votes}</td>
          <td style="text-align:center">${lista === r.winningLista ? 'GANADORA' : ''}</td></tr>`);
      const candidateRows = (r.winningCandidates || []).map(c =>
        `<tr><td>${c.firstName || ''} ${c.lastName || ''}</td><td>${c.cargo || ''}</td><td>${c.rut || ''}</td></tr>`);
      return `<h3>${item.title || 'Elección de Directorio'}</h3>
        <p>Modo de votación: <strong>Voto secreto por lista</strong></p>
        <table><thead><tr><th>Lista</th><th>Votos</th><th>Resultado</th></tr></thead>
        <tbody>${listaRows.join('')}</tbody></table>
        ${candidateRows.length ? `<p style="margin-top:12px"><strong>Candidatos de la lista ganadora (${r.winningLista}):</strong></p>
        <table><thead><tr><th>Nombre</th><th>Cargo</th><th>RUT</th></tr></thead>
        <tbody>${candidateRows.join('')}</tbody></table>` : ''}`;
    } else if (r.mode === 'mano_alzada') {
      return `<h3>${item.title || 'Punto de Agenda'}</h3>
        <p>Modo de votación: <strong>Mano alzada</strong></p>
        <table><thead><tr><th>Resolución</th><th>A Favor</th><th>En Contra</th><th>Abstenciones</th></tr></thead>
        <tbody><tr style="background:${r.resolucion === 'aprobado' ? '#d1fae5' : '#fee2e2'}">
          <td><strong>${r.resolucion === 'aprobado' ? 'APROBADO' : 'RECHAZADO'}</strong></td>
          <td style="text-align:center">${r.votosAFavor ?? '-'}</td>
          <td style="text-align:center">${r.votosEnContra ?? '-'}</td>
          <td style="text-align:center">${r.abstenciones ?? '-'}</td>
        </tr></tbody></table>
        ${r.observaciones ? `<p><em>Observaciones: ${r.observaciones}</em></p>` : ''}`;
    }
    return `<h3>${item.title || 'Punto de Agenda'}</h3><p>Resultado registrado.</p>`;
  }).join('\n');

  // Directorio electo
  const dir = org.provisionalDirectorio || {};
  const president = dir.president || dir.presidente;
  const secretary = dir.secretary || dir.secretario;
  const treasurer = dir.treasurer || dir.tesorero;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Acta de Escrutinio - ${orgName}</title>
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000; }
  h1 { font-size: 16pt; text-align: center; margin-bottom: 5px; }
  h2 { font-size: 13pt; text-align: center; font-weight: normal; color: #333; margin-top: 0; }
  h3 { font-size: 12pt; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  th { background: #1e40af; color: #fff; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin: 10px 0; font-size: 10pt; }
  .info-grid span { padding: 2px 0; }
  .label { font-weight: bold; }
  .quorum-badge { display: inline-block; padding: 2px 10px; border-radius: 4px; font-weight: bold; font-size: 10pt; }
  .met { background: #d1fae5; color: #065f46; }
  .not-met { background: #fee2e2; color: #991b1b; }
  .signature-area { margin-top: 50px; display: flex; justify-content: space-between; flex-wrap: wrap; }
  .signature-box { width: 30%; text-align: center; margin-bottom: 40px; }
  .signature-line { border-top: 1px solid #000; margin-top: 50px; padding-top: 5px; font-size: 10pt; }
  .footer { margin-top: 30px; text-align: center; font-size: 9pt; color: #666; }
</style></head>
<body>
  <h1>ACTA DE ESCRUTINIO</h1>
  <h2>${tipoOrg} "${orgName}"</h2>

  <div class="info-grid">
    <span><span class="label">Tipo de Asamblea:</span> ${assembly.type === 'extraordinaria' ? 'Extraordinaria' : 'Ordinaria'}</span>
    <span><span class="label">Fecha:</span> ${assembly.date || 'N/A'}</span>
    <span><span class="label">Título:</span> ${assembly.title || 'Sin título'}</span>
    <span><span class="label">Estado:</span> ${assembly.status}</span>
    <span><span class="label">Inicio:</span> ${assembly.startedAt ? new Date(assembly.startedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
    <span><span class="label">Cierre:</span> ${assembly.finishedAt ? new Date(assembly.finishedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
  </div>

  <h3>Quórum</h3>
  <div class="info-grid">
    <span><span class="label">Miembros hábiles:</span> ${totalMembers}</span>
    <span><span class="label">Asistentes:</span> ${attendeeCount}</span>
    <span><span class="label">Quórum requerido:</span> ${qType === 'percentage' ? `${qValue}% (${required} socios)` : `${qValue} socios`}</span>
    <span><span class="label">Verificación:</span> ${manualCount > 0 ? `${manualCount} manual` : ''}${manualCount > 0 && qrCount > 0 ? ' / ' : ''}${qrCount > 0 ? `${qrCount} por QR` : ''}</span>
  </div>
  <p>Quórum: <span class="quorum-badge ${quorumMet ? 'met' : 'not-met'}">${quorumMet ? 'CUMPLIDO' : 'NO CUMPLIDO'}</span></p>

  <h3>Resultados por Punto de Agenda</h3>
  ${agendaSections || '<p>No se registraron resultados de votación.</p>'}

  ${president || secretary || treasurer ? `<h3>Directorio Resultante</h3>
  <table><thead><tr><th>Cargo</th><th>Nombre</th><th>RUT</th></tr></thead><tbody>
    ${president ? `<tr><td>Presidente/a</td><td>${president.firstName || ''} ${president.lastName || ''}</td><td>${president.rut || ''}</td></tr>` : ''}
    ${secretary ? `<tr><td>Secretario/a</td><td>${secretary.firstName || ''} ${secretary.lastName || ''}</td><td>${secretary.rut || ''}</td></tr>` : ''}
    ${treasurer ? `<tr><td>Tesorero/a</td><td>${treasurer.firstName || ''} ${treasurer.lastName || ''}</td><td>${treasurer.rut || ''}</td></tr>` : ''}
    ${(dir.additionalMembers || []).map(m => `<tr><td>${m.cargoNombre || m.cargo || 'Director/a'}</td><td>${m.firstName || ''} ${m.lastName || ''}</td><td>${m.rut || ''}</td></tr>`).join('')}
  </tbody></table>` : ''}

  <div class="signature-area">
    <div class="signature-box"><div class="signature-line">Presidente/a de Mesa</div></div>
    <div class="signature-box"><div class="signature-line">Secretario/a</div></div>
    <div class="signature-box"><div class="signature-line">Ministro de Fe</div></div>
  </div>

  <div class="footer">
    Documento generado por Sistema de Organizaciones Comunitarias - ${tenant.municipalityName}<br>
    Generado el ${formatDate(new Date())} — Este documento constituye acta oficial de escrutinio conforme al Art. 24, Ley 19.418
  </div>
</body></html>`;
};

// ============================================================
// LISTA DE ASISTENCIA — Nómina de presentes con check-in
// ============================================================

const generateListaAsistenciaHTML = (org, assembly) => {
  const orgName = org.organizationName || org.name || '';
  const tipoOrg = getOrgTypeName(org.organizationType || org.type);
  const attendees = assembly.attendees || [];
  const totalMembers = org.members?.length || 0;
  const qType = assembly.quorumType || 'percentage';
  const qValue = assembly.quorumValue ?? 50;
  const required = qType === 'percentage' ? Math.ceil(totalMembers * (qValue / 100)) : qValue;
  const quorumMet = attendees.length >= required;

  const rows = attendees.map((a, i) => {
    const time = a.checkedInAt ? new Date(a.checkedInAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '';
    const method = a.method === 'qr' ? 'QR' : a.method === 'self' ? 'Digital' : 'Manual';
    return `<tr${i % 2 === 1 ? ' style="background:#f8fafc"' : ''}>
      <td style="text-align:center">${i + 1}</td>
      <td>${(a.firstName || '')} ${(a.lastName || '')}</td>
      <td>${a.rut || ''}</td>
      <td style="text-align:center">${time}</td>
      <td style="text-align:center">${method}</td>
      <td></td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Lista de Asistencia - ${orgName}</title>
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; }
  h1 { font-size: 14pt; text-align: center; margin-bottom: 3px; }
  h2 { font-size: 11pt; text-align: center; font-weight: normal; color: #333; margin-top: 0; }
  .info { font-size: 10pt; margin: 10px 0; }
  .info span { margin-right: 20px; }
  .label { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #999; padding: 5px 8px; }
  th { background: #1e40af; color: #fff; font-size: 9pt; }
  td { font-size: 9pt; }
  .quorum-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
  .met { background: #d1fae5; color: #065f46; }
  .not-met { background: #fee2e2; color: #991b1b; }
  .footer { margin-top: 20px; text-align: center; font-size: 9pt; color: #666; }
  .summary { margin-top: 15px; padding: 10px; background: #f1f5f9; border-radius: 4px; font-size: 10pt; }
</style></head>
<body>
  <h1>LISTA DE ASISTENCIA</h1>
  <h2>${tipoOrg} "${orgName}"</h2>

  <div class="info">
    <span><span class="label">Asamblea:</span> ${assembly.title || 'Sin título'}</span>
    <span><span class="label">Tipo:</span> ${assembly.type === 'extraordinaria' ? 'Extraordinaria' : 'Ordinaria'}</span>
    <span><span class="label">Fecha:</span> ${assembly.date || 'N/A'}</span>
  </div>

  <table>
    <thead><tr>
      <th style="width:5%">N°</th>
      <th style="width:30%">Nombre Completo</th>
      <th style="width:15%">RUT</th>
      <th style="width:12%">Hora Check-in</th>
      <th style="width:10%">Método</th>
      <th style="width:18%">Firma</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="summary">
    <span class="label">Total asistentes:</span> ${attendees.length} de ${totalMembers} miembros hábiles |
    <span class="label">Quórum (${qType === 'percentage' ? `${qValue}%` : qValue}):</span> ${required} requeridos →
    <span class="quorum-badge ${quorumMet ? 'met' : 'not-met'}">${quorumMet ? 'CUMPLIDO' : 'NO CUMPLIDO'}</span>
  </div>

  <div class="footer">
    Documento generado por Sistema de Organizaciones Comunitarias - ${tenant.municipalityName}<br>
    ${formatDate(new Date())}
  </div>
</body></html>`;
};

/**
 * GET /api/documents/:orgId/generate-acta-escrutinio/:assemblyId
 * Genera el PDF del Acta de Escrutinio (resultados de votación)
 */
router.get('/:orgId/generate-acta-escrutinio/:assemblyId', authenticate, async (req, res) => {
  let browser = null;
  try {
    const { orgId, assemblyId } = req.params;
    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const assembly = await Assembly.findOne({
      organizationId: orgId,
      $or: [{ _id: assemblyId }, { legacyId: assemblyId }]
    }).lean();
    if (!assembly) return res.status(404).json({ error: 'Asamblea no encontrada' });
    if (assembly.status !== 'finalizada') return res.status(400).json({ error: 'La asamblea debe estar finalizada para generar el acta de escrutinio' });

    let html = generateActaEscrutinioHTML(org, assembly);

    // Registrar documento y generar QR
    const { folio, qrDataUrl, verifyUrl } = await registerDocumentAndGetQR({
      organizationId: org._id,
      documentType: 'acta_escrutinio',
      documentTitle: `Acta de Escrutinio - ${org.organizationName || ''}`,
      issuedBy: req.user?._id,
      assemblyId: assembly._id
    });
    html = injectQRFooter(html, buildVerificationFooter(folio, qrDataUrl, verifyUrl));

    browser = await puppeteer.launch(PUPPETEER_OPTIONS);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '2cm', right: '1.5cm', bottom: '2cm', left: '1.5cm' } });
    await browser.close();
    browser = null;

    await DocumentRegistry.updateOne({ folio }, { fileHash: crypto.createHash('sha256').update(pdf).digest('hex') });

    const fileName = `Acta_Escrutinio_${(org.organizationName || 'Org').replace(/\s+/g, '_')}_${assemblyId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (error) {
    console.error('Error generating acta escrutinio PDF:', error);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Error al generar acta de escrutinio' });
  }
});

/**
 * GET /api/documents/:orgId/preview-acta-escrutinio/:assemblyId
 * Preview HTML del Acta de Escrutinio (sin PDF)
 */
router.get('/:orgId/preview-acta-escrutinio/:assemblyId', authenticate, async (req, res) => {
  try {
    const { orgId, assemblyId } = req.params;
    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const assembly = await Assembly.findOne({
      organizationId: orgId,
      $or: [{ _id: assemblyId }, { legacyId: assemblyId }]
    }).lean();
    if (!assembly) return res.status(404).json({ error: 'Asamblea no encontrada' });

    const html = generateActaEscrutinioHTML(org, assembly);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error generating acta escrutinio preview:', error);
    res.status(500).json({ error: 'Error al generar preview' });
  }
});

/**
 * GET /api/documents/:orgId/generate-lista-asistencia/:assemblyId
 * Genera el PDF de la Lista de Asistencia
 */
router.get('/:orgId/generate-lista-asistencia/:assemblyId', authenticate, async (req, res) => {
  let browser = null;
  try {
    const { orgId, assemblyId } = req.params;
    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const assembly = await Assembly.findOne({
      organizationId: orgId,
      $or: [{ _id: assemblyId }, { legacyId: assemblyId }]
    }).lean();
    if (!assembly) return res.status(404).json({ error: 'Asamblea no encontrada' });

    let html = generateListaAsistenciaHTML(org, assembly);

    // Registrar documento y generar QR
    const { folio, qrDataUrl, verifyUrl } = await registerDocumentAndGetQR({
      organizationId: org._id,
      documentType: 'lista_asistencia',
      documentTitle: `Lista de Asistencia - ${org.organizationName || ''}`,
      issuedBy: req.user?._id,
      assemblyId: assembly._id
    });
    html = injectQRFooter(html, buildVerificationFooter(folio, qrDataUrl, verifyUrl));

    browser = await puppeteer.launch(PUPPETEER_OPTIONS);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '2cm', right: '1.5cm', bottom: '2cm', left: '1.5cm' } });
    await browser.close();
    browser = null;

    await DocumentRegistry.updateOne({ folio }, { fileHash: crypto.createHash('sha256').update(pdf).digest('hex') });

    const fileName = `Lista_Asistencia_${(org.organizationName || 'Org').replace(/\s+/g, '_')}_${assemblyId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (error) {
    console.error('Error generating attendance list PDF:', error);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Error al generar lista de asistencia' });
  }
});

/**
 * GET /api/documents/:orgId/preview-lista-asistencia/:assemblyId
 * Preview HTML de la Lista de Asistencia
 */
router.get('/:orgId/preview-lista-asistencia/:assemblyId', authenticate, async (req, res) => {
  try {
    const { orgId, assemblyId } = req.params;
    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const assembly = await Assembly.findOne({
      organizationId: orgId,
      $or: [{ _id: assemblyId }, { legacyId: assemblyId }]
    }).lean();
    if (!assembly) return res.status(404).json({ error: 'Asamblea no encontrada' });

    const html = generateListaAsistenciaHTML(org, assembly);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error generating attendance list preview:', error);
    res.status(500).json({ error: 'Error al generar preview' });
  }
});

/**
 * Genera HTML del Certificado de Personalidad Jurídica (borrador sin firma)
 */
function generateCertificadoBorradorHTML(org) {
  const name = org.organizationName || org.name || '';
  const type = (org.organizationType || org.type || '').replace(/_/g, ' ');
  const address = [org.street, org.streetNumber].filter(Boolean).join(' ') || org.address || '';
  const comuna = org.comuna || org.commune || '';
  const region = org.region || '';

  const directorio = org.provisionalDirectorio || org.directorio || {};
  const president = directorio.president || directorio.presidente;
  const secretary = directorio.secretary || directorio.secretario;
  const treasurer = directorio.treasurer || directorio.tesorero;

  const presidentName = president ? [president.firstName, president.lastName].filter(Boolean).join(' ') : '---';
  const presidentRut = president?.rut || '---';
  const secretaryName = secretary ? [secretary.firstName, secretary.lastName].filter(Boolean).join(' ') : '---';
  const treasurerName = treasurer ? [treasurer.firstName, treasurer.lastName].filter(Boolean).join(' ') : '---';

  // Fecha legal de constitución: fecha de la asamblea ejecutada por el MF, no la fecha actual
  const assemblyDate = org.ministroData?.scheduledDate
    || org.validationData?.validatedAt
    || org.createdAt
    || new Date();
  const dateStr = formatDate(assemblyDate);
  const membersCount = (org.members || []).length;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Certificado de Personalidad Jurídica</title>
<style>
  body { font-family: Georgia, serif; max-width: 700px; margin: 60px auto; padding: 0 30px; color: #1a1a1a; line-height: 1.8; font-size: 14px; }
  h1 { text-align: center; font-size: 20px; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 2px; }
  .subtitle { text-align: center; font-size: 14px; color: #555; margin-bottom: 40px; }
  p { text-align: justify; margin-bottom: 16px; }
  .firma-block { margin-top: 60px; text-align: center; }
  .firma-line { border-top: 1px solid #333; width: 300px; margin: 60px auto 5px; }
  .firma-label { font-size: 12px; color: #555; }
  .watermark { text-align: center; color: #d1d5db; font-size: 11px; margin-top: 40px; font-style: italic; }
  .legal-ref { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 20px; }
  @media print { body { margin: 20mm; } }
</style></head><body>
<h1>Certificado de Personalidad Juridica</h1>
<div class="subtitle">Municipalidad de ${comuna || tenant.communeName || 'la comuna'}</div>

<p>Certifico que con fecha ${dateStr}, se ha constituido legalmente la organizacion comunitaria denominada
<strong>"${name}"</strong>, de tipo <strong>${type}</strong>, con domicilio en
${address}${comuna ? ', comuna de ' + comuna : ''}${region ? ', Region ' + region : ''},
de conformidad con lo dispuesto en la Ley N° 19.418 sobre Juntas de Vecinos y demas Organizaciones Comunitarias.</p>

<p>La organizacion cuenta con <strong>${membersCount} miembros fundadores</strong> y su directorio provisorio
quedo conformado por:</p>

<p style="padding-left: 40px;">
  <strong>Presidente/a:</strong> ${presidentName} (RUT: ${presidentRut})<br>
  <strong>Secretario/a:</strong> ${secretaryName}<br>
  <strong>Tesorero/a:</strong> ${treasurerName}
</p>

<p>Se deja constancia que la organizacion ha cumplido con todos los requisitos legales establecidos
en el Titulo I de la Ley N° 19.418 para su constitucion, incluyendo la celebracion de la asamblea constitutiva
ante Ministro de Fe y la aprobacion de sus estatutos.</p>

<p>Se extiende el presente certificado para los fines legales que correspondan.</p>

<div class="firma-block">
  <div class="firma-line"></div>
  <div class="firma-label">Secretario/a Municipal</div>
  <div class="firma-label">${comuna ? 'Municipalidad de ' + comuna : 'Municipalidad'}</div>
</div>

<div class="watermark">BORRADOR — Este documento requiere firma electronica avanzada (FEA) para tener validez legal (Ley 19.799)</div>
<div class="legal-ref">Ley 19.418 · Ley 19.799 sobre Documentos Electronicos y Firma Electronica</div>
</body></html>`;
}

/**
 * GET /api/documents/:orgId/generate-certificado-borrador
 * Genera PDF borrador del Certificado de Personalidad Jurídica (sin firma)
 */
router.get('/:orgId/generate-certificado-borrador', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  let browser = null;
  try {
    const org = await Organization.findById(req.params.orgId);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    let pdf;
    const fileName = `Borrador_Certificado_${(org.organizationName || 'Org').replace(/\s+/g, '_')}.pdf`;

    // Try Puppeteer first (better quality), fallback to jsPDF
    try {
      let html = generateCertificadoBorradorHTML(org);
      const { folio, qrDataUrl, verifyUrl } = await registerDocumentAndGetQR({
        organizationId: org._id,
        documentType: 'certificado_borrador',
        documentTitle: `Certificado Personalidad Jurídica (Borrador) - ${org.organizationName || ''}`,
        issuedBy: req.user?._id
      });
      html = injectQRFooter(html, buildVerificationFooter(folio, qrDataUrl, verifyUrl));

      browser = await puppeteer.launch(PUPPETEER_OPTIONS);
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '2.5cm', right: '2cm', bottom: '2.5cm', left: '2cm' } });
      await browser.close();
      browser = null;

      await DocumentRegistry.updateOne({ folio }, { fileHash: crypto.createHash('sha256').update(pdf).digest('hex') });
    } catch (puppeteerErr) {
      console.warn('Puppeteer failed, falling back to jsPDF:', puppeteerErr.message);
      if (browser) await browser.close().catch(() => {});

      // jsPDF fallback
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const pw = doc.internal.pageSize.getWidth();
      const margin = 20;
      const cw = pw - margin * 2;
      let y = 30;

      const name = org.organizationName || '';
      const type = (org.organizationType || '').replace(/_/g, ' ');
      const address = [org.street, org.streetNumber].filter(Boolean).join(' ') || org.address || '';
      const comuna = org.comuna || '';
      const region = org.region || '';
      const dir = org.provisionalDirectorio || {};
      const president = dir.president || dir.presidente || {};
      const secretary = dir.secretary || dir.secretario || {};
      const treasurer = dir.treasurer || dir.tesorero || {};
      const getName = (p) => p ? [p.firstName, p.lastName].filter(Boolean).join(' ') || '---' : '---';
      const assemblyDate = org.ministroData?.scheduledDate || org.validationData?.validatedAt || org.createdAt || new Date();
      const dateStr = formatDate(assemblyDate);
      const membersCount = (org.members || []).length;

      doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
      doc.text('CERTIFICADO DE PERSONALIDAD JURIDICA', pw / 2, y, { align: 'center' }); y += 10;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      doc.text(`Municipalidad de ${comuna || 'la comuna'}`, pw / 2, y, { align: 'center' }); y += 16;

      doc.setFontSize(11); doc.setFont('helvetica', 'normal');
      const paragraphs = [
        `Certifico que con fecha ${dateStr}, se ha constituido legalmente la organizacion comunitaria denominada "${name}", de tipo ${type}, con domicilio en ${address}${comuna ? ', comuna de ' + comuna : ''}${region ? ', Region ' + region : ''}, de conformidad con lo dispuesto en la Ley N 19.418 sobre Juntas de Vecinos y demas Organizaciones Comunitarias.`,
        `La organizacion cuenta con ${membersCount} miembros fundadores y su directorio provisorio quedo conformado por:`,
      ];
      for (const p of paragraphs) {
        const lines = doc.splitTextToSize(p, cw);
        for (const l of lines) { doc.text(l, margin, y); y += 5.5; }
        y += 4;
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`Presidente/a: ${getName(president)} (RUT: ${president.rut || '---'})`, margin + 10, y); y += 6;
      doc.text(`Secretario/a: ${getName(secretary)}`, margin + 10, y); y += 6;
      doc.text(`Tesorero/a: ${getName(treasurer)}`, margin + 10, y); y += 10;
      doc.setFont('helvetica', 'normal');

      const closing = [
        'Se deja constancia que la organizacion ha cumplido con todos los requisitos legales establecidos en el Titulo I de la Ley N 19.418 para su constitucion, incluyendo la celebracion de la asamblea constitutiva ante Ministro de Fe y la aprobacion de sus estatutos.',
        'Se extiende el presente certificado para los fines legales que correspondan.',
      ];
      for (const p of closing) {
        const lines = doc.splitTextToSize(p, cw);
        for (const l of lines) { doc.text(l, margin, y); y += 5.5; }
        y += 4;
      }

      y += 20;
      doc.setDrawColor(50); doc.line(pw / 2 - 50, y, pw / 2 + 50, y); y += 5;
      doc.setFontSize(10);
      doc.text('Secretario/a Municipal', pw / 2, y, { align: 'center' }); y += 5;
      doc.text(comuna ? `Municipalidad de ${comuna}` : 'Municipalidad', pw / 2, y, { align: 'center' }); y += 12;

      doc.setTextColor(200, 200, 200); doc.setFontSize(9);
      doc.text('BORRADOR — Requiere firma electronica avanzada (FEA) Ley 19.799', pw / 2, y, { align: 'center' });

      pdf = Buffer.from(doc.output('arraybuffer'));
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (error) {
    console.error('Error generating certificado borrador:', error);
    if (browser) await browser.close().catch(() => {});
    res.status(500).json({ error: `Error al generar borrador: ${error.message}` });
  }
});

export default router;
