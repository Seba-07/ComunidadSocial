import express from 'express';
import puppeteer from 'puppeteer';
import Organization from '../models/Organization.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

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
const generateActaHTML = (org) => {
  const tipoOrg = getOrgTypeName(org.organizationType || org.type);
  const orgName = org.organizationName || org.name || '';
  const address = org.address || org.direccion || '';
  const unidadVecinal = org.unidadVecinal || org.neighborhood || '';
  const today = formatDate(new Date());

  // Obtener directorio
  const directorio = org.provisionalDirectorio || {};
  const presidentName = directorio.president ?
    `${directorio.president.firstName || ''} ${directorio.president.lastName || ''}`.trim() : '_______________';
  const secretaryName = directorio.secretary ?
    `${directorio.secretary.firstName || ''} ${directorio.secretary.lastName || ''}`.trim() : '_______________';
  const treasurerName = directorio.treasurer ?
    `${directorio.treasurer.firstName || ''} ${directorio.treasurer.lastName || ''}`.trim() : '_______________';

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
      En Renca, Región Metropolitana de Santiago, a ${today}, siendo las _______ horas,
      se reúnen en _____________________________________, los ciudadanos que al final suscriben,
      con el objeto de constituir una organización comunitaria de carácter ${tipoOrg === 'Junta de Vecinos' ? 'territorial' : 'funcional'},
      que se denominará "${orgName}".
    </p>

    <p class="section-title">PRIMERO: ASISTENCIA</p>
    <p>
      Asisten a esta Asamblea Constitutiva un total de ______ personas, mayores de 14 años,
      que residen en la comuna de Renca${unidadVecinal ? `, específicamente en la Unidad Vecinal ${unidadVecinal}` : ''},
      cuyos nombres, RUT, domicilios y firmas se encuentran en el registro de asistentes anexo a la presente acta.
    </p>

    <p class="section-title">SEGUNDO: DIRECTORIO PROVISORIO</p>
    <p>
      La Asamblea acuerda por unanimidad designar el siguiente Directorio Provisorio:
    </p>
    <p style="text-indent: 0; padding-left: 2cm;">
      <strong>Presidente/a:</strong> ${presidentName}<br>
      <strong>Secretario/a:</strong> ${secretaryName}<br>
      <strong>Tesorero/a:</strong> ${treasurerName}
    </p>

    <p class="section-title">TERCERO: ESTATUTOS</p>
    <p>
      La Asamblea aprueba por unanimidad los estatutos que regirán la organización,
      los cuales se adjuntan como anexo a la presente acta.
    </p>

    <p class="section-title">CUARTO: DOMICILIO</p>
    <p>
      Se fija como domicilio de la organización: ${address || '___________________________________'},
      comuna de Renca, Región Metropolitana.
    </p>

    <p class="section-title">QUINTO: CIERRE</p>
    <p>
      No habiendo más que tratar, se levanta la sesión siendo las _______ horas del mismo día.
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
    Documento generado por Sistema de Organizaciones Comunitarias - Municipalidad de Renca
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
    Documento generado por Sistema de Organizaciones Comunitarias - Municipalidad de Renca
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

    // Generar HTML
    const html = generateActaHTML(org);

    // Lanzar Puppeteer
    browser = await puppeteer.launch(PUPPETEER_OPTIONS);
    const page = await browser.newPage();

    // Configurar contenido
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Generar PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '2.5cm',
        right: '2cm',
        bottom: '2.5cm',
        left: '2cm'
      }
    });

    await browser.close();
    browser = null;

    // Enviar PDF
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
    const html = generateMembersListHTML(org);

    // Lanzar Puppeteer
    browser = await puppeteer.launch(PUPPETEER_OPTIONS);
    const page = await browser.newPage();

    // Configurar contenido
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Generar PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '2cm',
        right: '1.5cm',
        bottom: '2cm',
        left: '1.5cm'
      }
    });

    await browser.close();
    browser = null;

    // Enviar PDF
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

    const html = generateActaHTML(org);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    console.error('Error generating acta preview:', error);
    res.status(500).json({ error: 'Error al generar preview del acta' });
  }
});

export default router;
