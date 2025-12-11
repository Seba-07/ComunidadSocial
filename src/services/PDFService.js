/**
 * PDFService - Servicio de generación de documentos PDF oficiales
 * Basado en los documentos de la Municipalidad de Renca para la Ley Nº 19.418
 */

import { jsPDF } from 'jspdf';

// Colores institucionales de Renca
const COLORS = {
  primary: '#0891b2',      // Cyan/Turquesa
  secondary: '#065f46',    // Verde oscuro
  accent: '#f59e0b',       // Naranja/Ámbar
  dark: '#1f2937',         // Gris oscuro
  text: '#374151',         // Gris texto
  lightGray: '#e5e7eb',    // Gris claro
  white: '#ffffff'
};

// Constantes del documento
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// Helper: Obtener nombre legible del tipo de organización
function getOrgTypeName(type) {
  const types = {
    'JUNTA_VECINOS': 'Junta de Vecinos', 'COMITE_VECINOS': 'Comité de Vecinos',
    'CLUB_DEPORTIVO': 'Club Deportivo', 'CLUB_ADULTO_MAYOR': 'Club de Adulto Mayor',
    'CLUB_JUVENIL': 'Club Juvenil', 'CLUB_CULTURAL': 'Club Cultural',
    'CENTRO_MADRES': 'Centro de Madres', 'CENTRO_PADRES': 'Centro de Padres y Apoderados',
    'CENTRO_CULTURAL': 'Centro Cultural', 'AGRUPACION_FOLCLORICA': 'Agrupación Folclórica',
    'AGRUPACION_CULTURAL': 'Agrupación Cultural', 'AGRUPACION_JUVENIL': 'Agrupación Juvenil',
    'AGRUPACION_AMBIENTAL': 'Agrupación Ambiental', 'COMITE_VIVIENDA': 'Comité de Vivienda',
    'COMITE_ALLEGADOS': 'Comité de Allegados', 'COMITE_APR': 'Comité de Agua Potable Rural',
    'ORG_SCOUT': 'Organización Scout', 'ORG_MUJERES': 'Organización de Mujeres',
    'GRUPO_TEATRO': 'Grupo de Teatro', 'CORO': 'Coro o Agrupación Musical',
    'TALLER_ARTESANIA': 'Taller de Artesanía', 'OTRA_FUNCIONAL': 'Otra Organización Funcional'
  };
  return types[type] || type || 'Organización Comunitaria';
}

class PDFService {
  constructor() {
    this.currentY = 0;
  }

  /**
   * Helper para obtener el nombre de un miembro (puede venir en diferentes formatos)
   * @param {Object} member - El miembro del que obtener el nombre
   * @param {Array} membersList - Lista de miembros original para buscar por ID si es necesario
   */
  getMemberName(member, membersList = [], additionalList = []) {
    if (!member) return '______________________';
    // Primero verificar si tiene nombre directo (varios formatos posibles)
    if (member.name) return member.name;
    if (member.fullName) return member.fullName;
    if (member.nombreCompleto) return member.nombreCompleto;
    // Formato firstName + lastName
    if (member.firstName) {
      return `${member.firstName} ${member.lastName || ''}`.trim();
    }
    if (member.nombre) {
      return `${member.nombre} ${member.apellido || ''}`.trim();
    }

    // Si tiene _id o id, buscar en la lista de miembros
    const memberId = member._id || member.id;
    const allLists = [...membersList, ...additionalList];

    if (memberId && allLists.length > 0) {
      const found = allLists.find(m =>
        (m._id === memberId || m.id === memberId) ||
        (m._id?.toString() === memberId?.toString())
      );
      if (found) {
        if (found.name) return found.name;
        if (found.fullName) return found.fullName;
        if (found.firstName) return `${found.firstName} ${found.lastName || ''}`.trim();
      }
    }

    // Buscar por RUT como fallback (el RUT es único por persona)
    if (member.rut && allLists.length > 0) {
      const foundByRut = allLists.find(m => m.rut === member.rut);
      if (foundByRut) {
        if (foundByRut.name) return foundByRut.name;
        if (foundByRut.fullName) return foundByRut.fullName;
        if (foundByRut.firstName) return `${foundByRut.firstName} ${foundByRut.lastName || ''}`.trim();
      }
    }

    return '______________________';
  }

  /**
   * Formatea una fecha en español
   */
  formatDate(dateString) {
    if (!dateString) return '_______________';
    const date = new Date(dateString);
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${date.getDate()} de ${months[date.getMonth()]} del ${date.getFullYear()}`;
  }

  /**
   * Formatea hora
   */
  formatTime(dateString) {
    if (!dateString) return '________';
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Dibuja el encabezado institucional
   */
  drawHeader(doc, title, subtitle = null) {
    // Barra superior de colores (cyan, verde, azul, naranja)
    const barHeight = 8;
    const barColors = ['#00a0b0', '#6eb43f', '#00579b', '#f5a623'];
    const barWidth = PAGE_WIDTH / 4;

    barColors.forEach((color, i) => {
      doc.setFillColor(color);
      doc.rect(i * barWidth, 0, barWidth + 1, barHeight, 'F');
    });

    this.currentY = barHeight + 10;

    // Logo y texto institucional
    doc.setFontSize(11);
    doc.setTextColor(COLORS.primary);
    doc.setFont('helvetica', 'bold');
    doc.text('REPÚBLICA DE CHILE – I. MUNICIPALIDAD DE RENCA', PAGE_WIDTH / 2, this.currentY, { align: 'center' });

    this.currentY += 5;
    doc.setFontSize(9);
    doc.setTextColor(COLORS.dark);
    doc.text('SECRETARÍA MUNICIPAL', PAGE_WIDTH / 2, this.currentY, { align: 'center' });

    if (subtitle) {
      this.currentY += 4;
      doc.setFontSize(8);
      doc.text(subtitle, PAGE_WIDTH / 2, this.currentY, { align: 'center' });
    }

    this.currentY += 10;

    // Título del documento
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text(title, PAGE_WIDTH / 2, this.currentY, { align: 'center' });

    this.currentY += 12;
  }

  /**
   * Dibuja el pie de página
   */
  drawFooter(doc, pageNum = 1) {
    const footerY = PAGE_HEIGHT - 15;

    // Barra inferior de colores
    const barHeight = 8;
    const barColors = ['#00a0b0', '#6eb43f', '#00579b', '#f5a623'];
    const barWidth = PAGE_WIDTH / 4;

    barColors.forEach((color, i) => {
      doc.setFillColor(color);
      doc.rect(i * barWidth, PAGE_HEIGHT - barHeight, barWidth + 1, barHeight, 'F');
    });

    // Información de contacto
    doc.setFontSize(8);
    doc.setTextColor(COLORS.text);
    doc.setFont('helvetica', 'normal');

    const contactY = footerY - 5;
    doc.text('Blanco Encalada 1335, Renca', 40, contactY, { align: 'center' });
    doc.text('+562 2685 6600', PAGE_WIDTH / 2, contactY, { align: 'center' });
    doc.text('www.renca.cl', PAGE_WIDTH - 40, contactY, { align: 'center' });

    // Número de página
    doc.text(String(pageNum), PAGE_WIDTH - MARGIN_RIGHT, footerY - 12, { align: 'right' });
  }

  /**
   * Agrega texto con salto de línea automático
   */
  addWrappedText(doc, text, x, y, maxWidth, lineHeight = 5) {
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line, i) => {
      doc.text(line, x, y + (i * lineHeight));
    });
    return y + (lines.length * lineHeight);
  }

  /**
   * Genera el Acta de Asamblea General Constitutiva
   */
  generateActaAsamblea(organization) {
    const doc = new jsPDF();
    const org = organization.organization || organization;
    const members = organization.members || [];
    const directorio = organization.provisionalDirectorio || {};
    // comisionElectoral puede ser un array directo o tener .members
    const comision = Array.isArray(organization.comisionElectoral)
      ? organization.comisionElectoral
      : (organization.comisionElectoral?.members || []);
    // ministroData puede venir en diferentes campos
    const ministroData = organization.ministroData || organization.ministroAssignment || {};

    // Guardar referencia a members para usar en getMemberName
    this._currentMembers = members;

    // DEBUG: Ver qué datos llegan
    console.log('🔍 PDFService.generateActaAsamblea - organization:', organization);
    console.log('🔍 PDFService - provisionalDirectorio:', directorio);
    console.log('🔍 PDFService - president:', directorio.president);
    console.log('🔍 PDFService - president RUT:', directorio.president?.rut);
    console.log('🔍 PDFService - members count:', members.length);
    console.log('🔍 PDFService - members[0]:', members[0]);
    console.log('🔍 PDFService - comisionElectoral:', comision);

    this.drawHeader(doc, 'ACTA DE ASAMBLEA GENERAL CONSTITUTIVA DE ESTATUTO', 'Departamento de Registro y Certificación');
    this.drawHeader(doc, 'Y ELECCIÓN DE DIRECTIVA PROVISIONAL');

    // Reiniciar posición
    this.currentY = 55;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);

    // Tipo de organización - buscar en múltiples campos
    doc.setFont('helvetica', 'bold');
    doc.text('TIPO DE ORGANIZACIÓN', MARGIN_LEFT, this.currentY);
    doc.setFont('helvetica', 'normal');
    const orgType = getOrgTypeName(org.organizationType || org.type || organization.type || organization.organizationType);
    doc.text(orgType, MARGIN_LEFT + 55, this.currentY);
    this.currentY += 8;

    // Nombre institución
    doc.setFont('helvetica', 'bold');
    doc.text('NOMBRE INSTITUCIÓN', MARGIN_LEFT, this.currentY);
    doc.setFont('helvetica', 'normal');
    const orgName = org.organizationName || org.name || '_________________________________';
    doc.text(orgName, MARGIN_LEFT + 55, this.currentY);
    this.currentY += 15;

    // Título Acta
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('ACTA DE ASAMBLEA', PAGE_WIDTH / 2, this.currentY, { align: 'center' });
    this.currentY += 10;

    // Texto del acta
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const assemblyDate = ministroData.scheduledDate || organization.createdAt;
    const dateFormatted = this.formatDate(assemblyDate);
    const timeFormatted = ministroData.scheduledTime || this.formatTime(assemblyDate);
    const location = ministroData.location || org.address || organization.address || '___________________________________';
    // Obtener nombre del ministro de varias fuentes posibles
    const ministroName = organization.validationData?.validatorName ||
                         ministroData.name ||
                         ministroData.ministroName ||
                         ministroData.ministro?.name ||
                         '___________________________________';
    const minMembers = members.length || 15;

    const actaText = `En Renca, a ${dateFormatted}, siendo las ${timeFormatted} horas, en el local ubicado en ${location}, ante la presencia del funcionario municipal Sr. (a) ${ministroName} como Ministro de Fe y la concurrencia de los futuros miembros de la Organización que en el listado adjunto se individualizan y firman, tuvo lugar la Asamblea General destinar a aprobar el Estatuto por el que se regirá la Organización y la elección del Directorio Provisional, todo conforme a lo que establece la Ley Nº 19.418 del 09 de octubre de 1995.`;

    this.currentY = this.addWrappedText(doc, actaText, MARGIN_LEFT, this.currentY, CONTENT_WIDTH, 5);
    this.currentY += 5;

    const actaText2 = `Antes de iniciar la sesión, se verificó que existen a lo menos ${minMembers} socios, los cuales cumplen con los requisitos establecidos en la referida Ley y cuyo listado e individualización adjunto, forma parte integrante de la presente Acta de Constitución para todos los efectos legales. Además, se dio lectura al Proyecto de Estatuto propuesto por los Organizadores, el cual, sometido a la consideración de la Asamblea, fue aprobado en la forma de que da cuenta el texto que se inserta al final de la presente Acta y que forma parte integrante para todos los efectos legales. A continuación, se procedió a elegir a la Directiva Provisional mediante voto nominativo, resultando elegido (a) Presidente (a) quien obtuvo la más alta mayoría y como directores, aquellos que obtuvieron las dos (2) siguientes más altas mayorías de votos, quienes desempeñarán los cargos de Secretario y Tesorero.`;

    this.currentY = this.addWrappedText(doc, actaText2, MARGIN_LEFT, this.currentY, CONTENT_WIDTH, 5);
    this.currentY += 5;

    doc.text('También, se procedió a elegir a las tres (3) personas que integrarán la Comisión Electoral.', MARGIN_LEFT, this.currentY);

    this.drawFooter(doc, 1);

    // Segunda página
    doc.addPage();
    this.drawHeader(doc, '');
    this.currentY = 35;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Producida la votación, resultaron elegidos como miembros del Directorio Provisional, los siguientes socios:', MARGIN_LEFT, this.currentY);
    this.currentY += 12;

    // Directiva Provisional
    doc.setFont('helvetica', 'bold');
    doc.text('DIRECTIVA PROVISIONAL', MARGIN_LEFT, this.currentY);
    doc.text('CED. IDENTIDAD', PAGE_WIDTH - 50, this.currentY);
    this.currentY += 8;

    doc.setFont('helvetica', 'normal');
    const president = directorio.president || {};
    const secretary = directorio.secretary || {};
    const treasurer = directorio.treasurer || {};

    doc.text(`PRESIDENTE (A): ${this.getMemberName(president, members)}`, MARGIN_LEFT, this.currentY);
    doc.text(president.rut || '________________', PAGE_WIDTH - 50, this.currentY);
    this.currentY += 7;

    doc.text(`SECRETARIO (A): ${this.getMemberName(secretary, members)}`, MARGIN_LEFT, this.currentY);
    doc.text(secretary.rut || '________________', PAGE_WIDTH - 50, this.currentY);
    this.currentY += 7;

    doc.text(`TESORERO (A): ${this.getMemberName(treasurer, members)}`, MARGIN_LEFT, this.currentY);
    doc.text(treasurer.rut || '________________', PAGE_WIDTH - 50, this.currentY);
    this.currentY += 7;

    // Directores adicionales
    if (directorio.additionalMembers && directorio.additionalMembers.length > 0) {
      directorio.additionalMembers.forEach((member) => {
        doc.text(`${(member.cargo || 'DIRECTOR').toUpperCase()}: ${this.getMemberName(member, members)}`, MARGIN_LEFT, this.currentY);
        doc.text(member.rut || '________________', PAGE_WIDTH - 50, this.currentY);
        this.currentY += 7;
      });
    }
    this.currentY += 8;

    // Comisión Electoral
    doc.setFont('helvetica', 'bold');
    doc.text('COMISIÓN ELECTORAL', MARGIN_LEFT, this.currentY);
    doc.text('CED. IDENTIDAD', PAGE_WIDTH - 50, this.currentY);
    this.currentY += 8;

    doc.setFont('helvetica', 'normal');
    comision.forEach((member, i) => {
      doc.text(`DON (ÑA): ${this.getMemberName(member, members)}`, MARGIN_LEFT, this.currentY);
      doc.text(member.rut || '________________', PAGE_WIDTH - 50, this.currentY);
      this.currentY += 7;
    });

    // Si no hay comisión, mostrar líneas vacías
    if (comision.length === 0) {
      for (let i = 0; i < 3; i++) {
        doc.text('DON (ÑA): ______________________', MARGIN_LEFT, this.currentY);
        doc.text('________________', PAGE_WIDTH - 50, this.currentY);
        this.currentY += 7;
      }
    }

    this.currentY += 10;

    // Texto de delegación
    const presidentName = this.getMemberName(president, members);
    const orgAddress = org.address || organization.address || '______________________';
    const delegacionText = `La Comisión Organizadora delega la facultad de tramitar la aprobación de los presentes Estatutos y acepta a nombre de los socios constituyentes, las modificaciones que el Secretario Municipal pueda hacer a tales Estatutos, de acuerdo con el Artículo 7º, inciso final, de la Ley Nº 19.418, a Don (ña) ${presidentName} Presidente (a) de la Organización, quien para estos efectos y para cualquier notificación a la Organización señala el siguiente domicilio: ${orgAddress}`;

    this.currentY = this.addWrappedText(doc, delegacionText, MARGIN_LEFT, this.currentY, CONTENT_WIDTH, 5);
    this.currentY += 10;

    doc.text('Suscriben la presente Acta en señal de ratificación de lo contenido en ella, la Directiva Provisional', MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text('electa y el Ministro de fe que asistió a la asamblea.', MARGIN_LEFT, this.currentY);
    this.currentY += 15;

    // Firmas
    doc.setFont('helvetica', 'bold');
    doc.text('Firmas:', MARGIN_LEFT, this.currentY);
    this.currentY += 10;

    doc.setFont('helvetica', 'normal');

    // Insertar firmas como imágenes si existen
    const signatureWidth = 45;
    const signatureHeight = 18;
    const signatureLineY = this.currentY + signatureHeight + 8;

    // Primera fila: Presidente y Tesorero
    doc.text('PRESIDENTE (A):', MARGIN_LEFT, this.currentY);
    doc.text('__________________', MARGIN_LEFT + 35, this.currentY);
    if (directorio.president?.signature) {
      try {
        doc.addImage(directorio.president.signature, 'PNG', MARGIN_LEFT + 35, this.currentY - signatureHeight + 2, signatureWidth, signatureHeight);
      } catch (e) {}
    }

    doc.text('TESORERO (A):', PAGE_WIDTH / 2 + 10, this.currentY);
    doc.text('__________________', PAGE_WIDTH / 2 + 45, this.currentY);
    if (directorio.treasurer?.signature) {
      try {
        doc.addImage(directorio.treasurer.signature, 'PNG', PAGE_WIDTH / 2 + 45, this.currentY - signatureHeight + 2, signatureWidth, signatureHeight);
      } catch (e) {}
    }

    this.currentY += 25;

    // Segunda fila: Secretario y Ministro de Fe
    doc.text('SECRETARIO (A):', MARGIN_LEFT, this.currentY);
    doc.text('__________________', MARGIN_LEFT + 35, this.currentY);
    if (directorio.secretary?.signature) {
      try {
        doc.addImage(directorio.secretary.signature, 'PNG', MARGIN_LEFT + 35, this.currentY - signatureHeight + 2, signatureWidth, signatureHeight);
      } catch (e) {}
    }

    doc.text('MINISTRO DE FE:', PAGE_WIDTH / 2 + 10, this.currentY);
    doc.text('__________________', PAGE_WIDTH / 2 + 45, this.currentY);
    const ministroSignature = organization.validationData?.ministroSignature || organization.ministroSignature;
    if (ministroSignature) {
      try {
        doc.addImage(ministroSignature, 'PNG', PAGE_WIDTH / 2 + 45, this.currentY - signatureHeight + 2, signatureWidth, signatureHeight);
      } catch (e) {}
    }

    this.drawFooter(doc, 2);

    return doc;
  }

  /**
   * Genera Lista de Socios Constitución
   */
  generateListaSocios(organization) {
    const doc = new jsPDF();
    const org = organization.organization || organization;
    const members = organization.members || [];
    // Usar asistentes de la asamblea si existen, sino usar miembros
    const attendees = organization.validatedAttendees || organization.assemblyAttendees || members;
    const ministroData = organization.ministroData || organization.ministroAssignment || {};
    const assemblyDate = ministroData.scheduledDate || organization.createdAt;

    this.drawHeader(doc, 'LISTADO DE SOCIOS ASISTENTES A LA CONSTITUCIÓN DE LA ORGANIZACIÓN', 'DEPARTAMENTO DE REGISTRO Y CERTIFICACIÓN');

    this.currentY = 55;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const attendeesPerPage = 12;
    let pageNum = 1;

    attendees.forEach((attendee, index) => {
      if (index > 0 && index % attendeesPerPage === 0) {
        this.drawFooter(doc, pageNum);
        doc.addPage();
        pageNum++;
        this.drawHeader(doc, 'LISTADO DE SOCIOS ASISTENTES A LA CONSTITUCIÓN DE LA ORGANIZACIÓN', 'DEPARTAMENTO DE REGISTRO Y CERTIFICACIÓN');
        this.currentY = 55;
      }

      // Nombre - buscar en miembros y también en la lista de asistentes
      doc.text(`Nombre: ${this.getMemberName(attendee, members, attendees)}`, MARGIN_LEFT, this.currentY);
      // RUT
      doc.text(`Rut: ${attendee.rut || '____________'}`, MARGIN_LEFT + 80, this.currentY);
      // Firma
      doc.text('Firma:', MARGIN_LEFT + 130, this.currentY);

      // Si hay firma, insertarla
      if (attendee.signature) {
        try {
          doc.addImage(attendee.signature, 'PNG', MARGIN_LEFT + 145, this.currentY - 5, 30, 12);
        } catch (e) {
          doc.text('______________', MARGIN_LEFT + 145, this.currentY);
        }
      } else {
        doc.text('______________', MARGIN_LEFT + 145, this.currentY);
      }

      this.currentY += 12;
    });

    // Si no hay asistentes, mostrar líneas vacías
    if (attendees.length === 0) {
      for (let i = 0; i < 12; i++) {
        doc.text('Nombre: ________________________', MARGIN_LEFT, this.currentY);
        doc.text('Rut: ____________', MARGIN_LEFT + 80, this.currentY);
        doc.text('Firma: ______________', MARGIN_LEFT + 130, this.currentY);
        this.currentY += 12;
      }
    }

    // Información final
    this.currentY += 10;
    doc.setFont('helvetica', 'bold');
    doc.text(`FECHA CONSTITUCIÓN: ${this.formatDate(assemblyDate)}`, MARGIN_LEFT, this.currentY);
    this.currentY += 7;
    doc.text('NOMBRE DE LA ORGANIZACIÓN:', MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(org.organizationName || org.name || '_______________________________________________', MARGIN_LEFT, this.currentY);

    this.drawFooter(doc, pageNum);

    return doc;
  }

  /**
   * Genera Certificado del Ministro de Fe
   */
  generateCertificado(organization) {
    const doc = new jsPDF();
    const org = organization.organization || organization;
    const members = organization.members || [];
    const directorio = organization.provisionalDirectorio || {};
    const ministroData = organization.ministroData || organization.ministroAssignment || {};
    // Obtener nombre del ministro de varias fuentes posibles
    const ministroName = organization.validationData?.validatorName ||
                         ministroData.name ||
                         ministroData.ministroName ||
                         ministroData.ministro?.name ||
                         '';

    this.drawHeader(doc, 'C E R T I F I C A D O');

    this.currentY = 60;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    const text1 = `${ministroName || '___________________________________________________'}, funcionario (a) municipal que suscribe en calidad de Ministro de Fe, certifica que asistió a la Asamblea Constitutiva de la Organización Comunitaria denominada:`;
    this.currentY = this.addWrappedText(doc, text1, MARGIN_LEFT, this.currentY, CONTENT_WIDTH, 6);
    this.currentY += 5;

    // Nombre de la organización
    doc.setFont('helvetica', 'bold');
    const orgName = org.organizationName || org.name || '_________________________________________________________________________';
    this.currentY = this.addWrappedText(doc, orgName, MARGIN_LEFT, this.currentY, CONTENT_WIDTH, 6);
    this.currentY += 5;
    doc.setFont('helvetica', 'normal');

    doc.text('que precede, la que se celebró en el lugar, día y hora indicados en ella.', MARGIN_LEFT, this.currentY);
    this.currentY += 12;

    // Puntos
    doc.text('• Que, asistieron a la Asamblea los socios que se señalan en el Acta que se adjunta.', MARGIN_LEFT, this.currentY);
    this.currentY += 8;

    const text2 = '• Que, todas las proposiciones de acuerdo que se contienen en el Acta precedente, fueron leídas, puestas en discusión y aprobadas en la forma expresa en el Acta.';
    this.currentY = this.addWrappedText(doc, text2, MARGIN_LEFT, this.currentY, CONTENT_WIDTH, 6);
    this.currentY += 5;

    const president = directorio.president || {};
    const presidentName = this.getMemberName(president, members);
    const orgAddress = org.address || organization.address || '________________________________________';
    const text3 = `• Que, para todos los efectos legales, el (la) Presidente (a) de la institución es Don (ña) ${presidentName} y su domicilio es ${orgAddress}`;
    this.currentY = this.addWrappedText(doc, text3, MARGIN_LEFT, this.currentY, CONTENT_WIDTH, 6);
    this.currentY += 3;

    doc.text(`teléfono: ${org.phone || '__________________________'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 12;

    // Documentos adjuntos
    doc.text('Se adjunta el presente:', MARGIN_LEFT, this.currentY);
    this.currentY += 8;

    const adjuntos = [
      'Depósito de Antecedentes.',
      'Certificación.',
      'Acta de Asamblea General Constitutiva.',
      'Certificado.',
      'Declaración Jurada Simple de los Directores Provisionales.',
      'Estatutos',
      'Listado de Socios asistentes.'
    ];

    adjuntos.forEach(item => {
      doc.text(`• ${item}`, MARGIN_LEFT + 10, this.currentY);
      this.currentY += 6;
    });

    this.currentY += 20;

    // Firma del ministro (puede venir en diferentes campos)
    const ministroSignature = organization.validationData?.ministroSignature || organization.ministroSignature;
    if (ministroSignature) {
      try {
        doc.addImage(ministroSignature, 'PNG', PAGE_WIDTH / 2 - 25, this.currentY, 50, 20);
        this.currentY += 25;
      } catch (e) {}
    }
    doc.text('___________________________________', PAGE_WIDTH / 2, this.currentY, { align: 'center' });
    this.currentY += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('FIRMA', PAGE_WIDTH / 2, this.currentY, { align: 'center' });
    this.currentY += 10;

    doc.setFont('helvetica', 'normal');
    doc.text(`Renca, ${this.formatDate(organization.validationData?.validatedAt || new Date())}`, MARGIN_LEFT, this.currentY);

    this.drawFooter(doc, 1);

    return doc;
  }

  /**
   * Genera Certificación Municipal
   */
  generateCertificacion(organization, certNumber = '') {
    const doc = new jsPDF();
    const org = organization.organization || organization;
    const members = organization.members || [];
    const directorio = organization.provisionalDirectorio || {};
    // comisionElectoral puede ser un array directo o tener .members
    const comision = Array.isArray(organization.comisionElectoral)
      ? organization.comisionElectoral
      : (organization.comisionElectoral?.members || []);
    const ministroData = organization.ministroData || organization.ministroAssignment || {};
    const assemblyDate = ministroData.scheduledDate || organization.createdAt;

    this.drawHeader(doc, `CERTIFICACIÓN N.º ${certNumber || '________'}/ `);

    this.currentY = 55;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const orgName = org.organizationName || org.name || '_______________________________________________';
    const dateFormatted = this.formatDate(new Date());
    const unidadVecinal = org.unidadVecinal || org.neighborhood || organization.unidadVecinal || organization.neighborhood || '______';
    const text1 = `En Renca, a ${dateFormatted}, en cumplimiento a lo que establece el Artículo 8º de la Ley Nº 19.418 de 1995, el Secretario Municipal que suscribe certifica que, la Organización Denominada ${orgName} de la Unidad Vecinal Nº ${unidadVecinal} depositó en esta Secretaría Municipal, copia autorizada del Acta de Asamblea Constitutiva.`;

    this.currentY = this.addWrappedText(doc, text1, MARGIN_LEFT, this.currentY, CONTENT_WIDTH, 5);
    this.currentY += 8;

    const location = ministroData.location || org.address || organization.address || '';

    // Obtener nombre del ministro de varias fuentes posibles
    const ministroNameCert = organization.validationData?.validatorName ||
                             ministroData.name ||
                             ministroData.ministroName ||
                             ministroData.ministro?.name ||
                             '________________________';

    const text2 = `La citada Asamblea Constitutiva se efectuó el día ${this.formatDate(assemblyDate)} ante el Ministro de Fe Don (ña) ${ministroNameCert} Funcionario (a) municipal, en el local ubicado en ${location}`;
    this.currentY = this.addWrappedText(doc, text2, MARGIN_LEFT, this.currentY, CONTENT_WIDTH, 5);
    this.currentY += 8;

    doc.text('En dicha sesión, se aprobaron los Estatutos de la Organización y fueron elegidos como integrantes de la', MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text('Directiva Provisoria y Comisión Electoral, los siguientes socios.', MARGIN_LEFT, this.currentY);
    this.currentY += 10;

    // Directiva Provisoria
    doc.setFont('helvetica', 'bold');
    doc.text('DIRECTIVA PROVISORIA', MARGIN_LEFT, this.currentY);
    this.currentY += 8;

    doc.setFont('helvetica', 'normal');
    const president = directorio.president || {};
    const secretary = directorio.secretary || {};
    const treasurer = directorio.treasurer || {};

    doc.text(`PRESIDENTE: ${this.getMemberName(president, members)}`, MARGIN_LEFT, this.currentY);
    doc.text(`C.I. Nº ${president.rut || '________________'}`, PAGE_WIDTH - 60, this.currentY);
    this.currentY += 6;

    doc.text(`SECRETARIO: ${this.getMemberName(secretary, members)}`, MARGIN_LEFT, this.currentY);
    doc.text(`C.I. Nº ${secretary.rut || '________________'}`, PAGE_WIDTH - 60, this.currentY);
    this.currentY += 6;

    doc.text(`TESORERO: ${this.getMemberName(treasurer, members)}`, MARGIN_LEFT, this.currentY);
    doc.text(`C.I. Nº ${treasurer.rut || '________________'}`, PAGE_WIDTH - 60, this.currentY);
    this.currentY += 6;

    // Directores adicionales
    if (directorio.additionalMembers && directorio.additionalMembers.length > 0) {
      directorio.additionalMembers.forEach((member) => {
        doc.text(`${(member.cargo || 'DIRECTOR').toUpperCase()}: ${this.getMemberName(member, members)}`, MARGIN_LEFT, this.currentY);
        doc.text(`C.I. Nº ${member.rut || '________________'}`, PAGE_WIDTH - 60, this.currentY);
        this.currentY += 6;
      });
    }
    this.currentY += 4;

    // Comisión Electoral
    doc.setFont('helvetica', 'bold');
    doc.text('COMISIÓN ELECTORAL', MARGIN_LEFT, this.currentY);
    this.currentY += 8;

    doc.setFont('helvetica', 'normal');
    for (let i = 0; i < 3; i++) {
      const member = comision[i] || {};
      doc.text(`DON (ÑA): ${this.getMemberName(member, members)}`, MARGIN_LEFT, this.currentY);
      doc.text(`C.I. Nº ${member.rut || '________________'}`, PAGE_WIDTH - 60, this.currentY);
      this.currentY += 6;
    }
    this.currentY += 5;

    const text3 = `Dicha Organización gozará de Personalidad Jurídica conforme a la Ley Nº 19.418 de 1995, a contar de la fecha del depósito del Acta de Asamblea Constitutiva, la cual fue depositada en la Secretaría Municipal por Don (ña) ${this.getMemberName(president, members)} presidenta (e) de la organización y Don (ña) ${ministroNameCert} en su calidad de Ministro de Fe, con domicilio en Blanco Encalada Nº 1335.`;
    this.currentY = this.addWrappedText(doc, text3, MARGIN_LEFT, this.currentY, CONTENT_WIDTH, 5);
    this.currentY += 5;

    const text4 = 'Se entrega este certificado al (a la) Presidente (a) de la Organización para todos los efectos legales derivados de la Ley Nº 19.418. En ausencia del Titular, en el acto de retiro, envíese la presente certificación, por cédula al domicilio fijado por el (la) Presidente (a), en la Asamblea Constitutiva.';
    this.currentY = this.addWrappedText(doc, text4, MARGIN_LEFT, this.currentY, CONTENT_WIDTH, 5);
    this.currentY += 20;

    // Firma Secretaria Municipal
    doc.setFont('helvetica', 'bold');
    doc.text('Secretaria Municipal', PAGE_WIDTH - 50, this.currentY, { align: 'center' });

    this.drawFooter(doc, 1);

    return doc;
  }

  /**
   * Genera Declaración Jurada Simple (una por cada director)
   */
  generateDeclaracionJurada(organization, director) {
    const doc = new jsPDF();
    const org = organization.organization || organization;
    const members = organization.members || [];

    this.drawHeader(doc, 'DECLARACIÓN JURADA SIMPLE');

    this.currentY = 65;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    doc.text(`YO, ${this.getMemberName(director, members)}`, MARGIN_LEFT, this.currentY);
    this.currentY += 10;

    doc.text(`CÉDULA DE IDENTIDAD: ${director.rut || '______________________________________________'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 10;

    const orgAddress = org.address || organization.address || '__________________________________________________';
    doc.text(`CON DOMICILIO EN: ${director.address || orgAddress}`, MARGIN_LEFT, this.currentY);
    this.currentY += 15;

    // Declaraciones
    doc.text('• Declaro bajo juramento:', MARGIN_LEFT, this.currentY);
    this.currentY += 8;

    doc.text('• Estar afiliado a la Organización Comunitaria.', MARGIN_LEFT + 5, this.currentY);
    this.currentY += 7;

    doc.text('• No tener menos de 18 años.', MARGIN_LEFT + 5, this.currentY);
    this.currentY += 7;

    doc.text('• Ser Chileno.', MARGIN_LEFT + 5, this.currentY);
    this.currentY += 7;

    doc.text('• No ser procesado o cumpliendo condena por delito que merezca pena aflictiva.', MARGIN_LEFT + 5, this.currentY);
    this.currentY += 7;

    doc.text('• No ser miembro de la Comisión Electoral de la Organización.', MARGIN_LEFT + 5, this.currentY);
    this.currentY += 7;

    const text1 = '• No tener ninguna incompatibilidad o inhabilidad para pertenecer a una Organización Comunitaria, conforme a la Ley N° 19.418.';
    this.currentY = this.addWrappedText(doc, text1, MARGIN_LEFT + 5, this.currentY, CONTENT_WIDTH - 5, 5);
    this.currentY += 10;

    const text2 = `Formulo la presente declaración para acreditar que cumplo con los requisitos Establecidos en el artículo 20° de la Ley N° 19.418, para ser Director de la Organización denominada:`;
    this.currentY = this.addWrappedText(doc, text2, MARGIN_LEFT, this.currentY, CONTENT_WIDTH, 5);
    this.currentY += 5;

    doc.setFont('helvetica', 'bold');
    doc.text(org.organizationName || org.name || '_______________________________________________', MARGIN_LEFT, this.currentY);
    this.currentY += 10;

    doc.setFont('helvetica', 'normal');
    doc.text(`Correo electrónico: ${director.email || org.email || '_____________________________________________________'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 25;

    // Firma
    if (director.signature) {
      try {
        doc.addImage(director.signature, 'PNG', PAGE_WIDTH / 2 - 25, this.currentY, 50, 20);
        this.currentY += 25;
      } catch (e) {}
    }
    doc.text('_________________', PAGE_WIDTH / 2, this.currentY, { align: 'center' });
    this.currentY += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('FIRMA', PAGE_WIDTH / 2, this.currentY, { align: 'center' });

    this.drawFooter(doc, 1);

    return doc;
  }

  /**
   * Genera todas las declaraciones juradas de los directores
   */
  generateAllDeclaracionesJuradas(organization) {
    const directorio = organization.provisionalDirectorio || {};
    const members = organization.members || [];
    const docs = [];

    // Presidente
    if (directorio.president) {
      const presName = this.getMemberName(directorio.president, members).replace(/\s+/g, '_');
      docs.push({
        name: `Declaracion_Jurada_Presidente_${presName || 'Presidente'}.pdf`,
        doc: this.generateDeclaracionJurada(organization, directorio.president)
      });
    }

    // Secretario
    if (directorio.secretary) {
      const secName = this.getMemberName(directorio.secretary, members).replace(/\s+/g, '_');
      docs.push({
        name: `Declaracion_Jurada_Secretario_${secName || 'Secretario'}.pdf`,
        doc: this.generateDeclaracionJurada(organization, directorio.secretary)
      });
    }

    // Tesorero
    if (directorio.treasurer) {
      const tresName = this.getMemberName(directorio.treasurer, members).replace(/\s+/g, '_');
      docs.push({
        name: `Declaracion_Jurada_Tesorero_${tresName || 'Tesorero'}.pdf`,
        doc: this.generateDeclaracionJurada(organization, directorio.treasurer)
      });
    }

    // Miembros adicionales
    if (directorio.additionalMembers) {
      directorio.additionalMembers.forEach((member, i) => {
        const memberName = this.getMemberName(member, members).replace(/\s+/g, '_');
        docs.push({
          name: `Declaracion_Jurada_${member.cargo || 'Director'}_${memberName || i}.pdf`,
          doc: this.generateDeclaracionJurada(organization, member)
        });
      });
    }

    return docs;
  }

  /**
   * Genera Depósito de Antecedentes
   */
  generateDepositoAntecedentes(organization, depositNumber = '') {
    const doc = new jsPDF();
    const org = organization.organization || organization;

    this.drawHeader(doc, `DEPOSITO DE ANTECEDENTES N° ${depositNumber || '________'}/`, 'DEPARTAMENTO DE REGISTRO Y CERTIFICACIÓN');

    this.currentY = 60;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    doc.text(`TIPO DE ORGANIZACIÓN: ${getOrgTypeName(org.organizationType || org.type)}`, MARGIN_LEFT, this.currentY);
    this.currentY += 10;

    doc.text(`NOMBRE DE LA ORGANIZACIÓN: ${org.organizationName || org.name || '_____________________________________'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 10;

    const unidadVecinalDep = org.unidadVecinal || org.neighborhood || organization.unidadVecinal || organization.neighborhood || '___________';
    doc.text(`UNIDAD VECINAL: ${unidadVecinalDep}/`, MARGIN_LEFT, this.currentY);
    this.currentY += 15;

    const dateFormatted = this.formatDate(new Date());
    const text1 = `En Renca, a ${dateFormatted} de conformidad a lo que establece la Ley Nº 19.418 del 09 de octubre de 1995, procedo a inscribir en el presente Libro de Registro a la Organización Comunitaria antes señalada.`;
    this.currentY = this.addWrappedText(doc, text1, MARGIN_LEFT, this.currentY, CONTENT_WIDTH, 6);
    this.currentY += 15;

    doc.setFont('helvetica', 'bold');
    const text2 = 'Los documentos relativos al Acta de Constitución, Aprobación de Estatutos, Listado de Socios, Asistentes y Elección de Directorio Provisional, se encuentran archivados en Carpeta Digital en el Departamento de Registro y Certificación.';
    this.currentY = this.addWrappedText(doc, text2, MARGIN_LEFT, this.currentY, CONTENT_WIDTH, 6);
    this.currentY += 40;

    // Firma
    doc.setFont('helvetica', 'bold');
    doc.text('Secretaria Municipal', PAGE_WIDTH - 50, this.currentY, { align: 'center' });

    this.drawFooter(doc, 1);

    return doc;
  }

  /**
   * Genera todos los documentos de una organización
   */
  generateAllDocuments(organization) {
    const org = organization.organization || organization;
    const orgName = (org.organizationName || org.name || 'Organizacion').replace(/\s+/g, '_');

    const documents = [];

    // Acta de Asamblea
    documents.push({
      name: `Acta_Asamblea_${orgName}.pdf`,
      type: 'acta_asamblea',
      doc: this.generateActaAsamblea(organization)
    });

    // Lista de Socios
    documents.push({
      name: `Lista_Socios_${orgName}.pdf`,
      type: 'lista_socios',
      doc: this.generateListaSocios(organization)
    });

    // Certificado
    documents.push({
      name: `Certificado_${orgName}.pdf`,
      type: 'certificado',
      doc: this.generateCertificado(organization)
    });

    // Certificación
    documents.push({
      name: `Certificacion_${orgName}.pdf`,
      type: 'certificacion',
      doc: this.generateCertificacion(organization)
    });

    // Depósito de Antecedentes
    documents.push({
      name: `Deposito_Antecedentes_${orgName}.pdf`,
      type: 'deposito',
      doc: this.generateDepositoAntecedentes(organization)
    });

    // Declaraciones Juradas
    const declaraciones = this.generateAllDeclaracionesJuradas(organization);
    declaraciones.forEach(decl => {
      documents.push({
        name: decl.name,
        type: 'declaracion_jurada',
        doc: decl.doc
      });
    });

    return documents;
  }

  /**
   * Descarga un documento PDF
   */
  downloadPDF(doc, filename) {
    doc.save(filename);
  }

  /**
   * Obtiene el PDF como blob para previsualización
   */
  getPDFBlob(doc) {
    return doc.output('blob');
  }

  /**
   * Obtiene el PDF como Data URL para previsualización en iframe
   */
  getPDFDataURL(doc) {
    return doc.output('datauristring');
  }
}

// Exportar instancia singleton
export const pdfService = new PDFService();
export default pdfService;
