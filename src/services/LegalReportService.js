/**
 * LegalReportService - Generacion de informes legales requeridos por Ley 19.418
 * Para organizaciones comunitarias de la comuna de Renca
 */

import { jsPDF } from 'jspdf';
import { apiService } from './ApiService.js';
import { pdfService } from './PDFService.js';

// Constantes del documento (mismas que PDFService)
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// Colores institucionales de Renca
const COLORS = {
  primary: '#0891b2',
  secondary: '#065f46',
  accent: '#f59e0b',
  dark: '#1f2937',
  text: '#374151',
  lightGray: '#e5e7eb',
  white: '#ffffff'
};

// Meses en espanol
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

class LegalReportService {
  constructor() {
    this.currentY = 0;
  }

  // ===================== HELPERS =====================

  /**
   * Formatea una fecha como DD/MM/YYYY
   * @param {Date|string} date - Fecha a formatear
   * @returns {string} Fecha formateada
   */
  formatDateDDMMYYYY(date) {
    if (!date) return '___/___/______';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '___/___/______';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Formatea una fecha en texto largo en espanol
   * @param {Date|string} date - Fecha a formatear
   * @returns {string} Fecha formateada en texto
   */
  formatDateLong(date) {
    if (!date) return '_______________';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '_______________';
    return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  }

  /**
   * Obtiene el nombre completo de un miembro
   * @param {Object} member - Miembro
   * @returns {string} Nombre completo
   */
  getMemberFullName(member) {
    if (!member) return '______________________';
    if (member.name) return member.name;
    if (member.fullName) return member.fullName;
    if (member.firstName) {
      const parts = [member.firstName];
      if (member.segundoNombre) parts.push(member.segundoNombre);
      if (member.lastName) parts.push(member.lastName);
      if (member.apellidoMaterno) parts.push(member.apellidoMaterno);
      return parts.join(' ');
    }
    if (member.nombre) {
      return `${member.nombre} ${member.apellido || ''}`.trim();
    }
    return '______________________';
  }

  /**
   * Obtiene el nombre de la organizacion
   * @param {Object} organization - Organizacion
   * @returns {string} Nombre
   */
  getOrgName(organization) {
    const org = organization.organization || organization;
    return org.organizationName || org.name || 'Sin nombre';
  }

  /**
   * Obtiene los miembros de la organizacion
   * @param {Object} organization - Organizacion
   * @returns {Array} Lista de miembros
   */
  getMembers(organization) {
    return organization.members || [];
  }

  /**
   * Obtiene el directorio de la organizacion
   * @param {Object} organization - Organizacion
   * @returns {Object} Directorio
   */
  getDirectorio(organization) {
    return organization.provisionalDirectorio ||
           organization.definitiveDirectorio ||
           {};
  }

  /**
   * Calcula el rango semestral actual
   * @returns {Object} { start, end } con fechas del semestre
   */
  getCurrentSemester() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    let start, end;
    if (month < 6) {
      start = new Date(year, 0, 1);
      end = new Date(year, 5, 30);
    } else {
      start = new Date(year, 6, 1);
      end = new Date(year, 11, 31);
    }

    return { start, end };
  }

  /**
   * Calcula el ano fiscal actual
   * @returns {Object} { start, end, year }
   */
  getCurrentFiscalYear() {
    const now = new Date();
    const year = now.getFullYear();
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31),
      year
    };
  }

  // ===================== DIBUJO DE ENCABEZADO Y PIE =====================

  /**
   * Dibuja el encabezado institucional (mismo estilo que PDFService)
   * @param {jsPDF} doc - Documento PDF
   * @param {string} title - Titulo principal
   * @param {string} subtitle - Subtitulo opcional
   */
  drawHeader(doc, title, subtitle = null) {
    // Barra superior de colores (cyan, verde, azul, naranja)
    const barHeight = 8;
    const barColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];
    const barWidth = PAGE_WIDTH / 4;

    barColors.forEach((color, i) => {
      doc.setFillColor(color);
      doc.rect(i * barWidth, 0, barWidth + 1, barHeight, 'F');
    });

    this.currentY = barHeight + 10;

    // Texto institucional
    doc.setFontSize(11);
    doc.setTextColor(COLORS.primary);
    doc.setFont('helvetica', 'bold');
    doc.text('REPUBLICA DE CHILE - I. MUNICIPALIDAD DE RENCA', PAGE_WIDTH / 2, this.currentY, { align: 'center' });

    this.currentY += 5;
    doc.setFontSize(9);
    doc.setTextColor(COLORS.dark);
    doc.text('SECRETARIA MUNICIPAL', PAGE_WIDTH / 2, this.currentY, { align: 'center' });

    if (subtitle) {
      this.currentY += 4;
      doc.setFontSize(8);
      doc.text(subtitle, PAGE_WIDTH / 2, this.currentY, { align: 'center' });
    }

    this.currentY += 10;

    // Titulo del documento
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);

    // Dividir titulo largo en lineas
    const titleLines = doc.splitTextToSize(title, CONTENT_WIDTH);
    titleLines.forEach((line) => {
      doc.text(line, PAGE_WIDTH / 2, this.currentY, { align: 'center' });
      this.currentY += 6;
    });

    this.currentY += 6;
  }

  /**
   * Dibuja el pie de pagina (mismo estilo que PDFService)
   * @param {jsPDF} doc - Documento PDF
   * @param {number} pageNum - Numero de pagina
   */
  drawFooter(doc, pageNum = 1) {
    const footerY = PAGE_HEIGHT - 15;

    // Barra inferior de colores
    const barHeight = 8;
    const barColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];
    const barWidth = PAGE_WIDTH / 4;

    barColors.forEach((color, i) => {
      doc.setFillColor(color);
      doc.rect(i * barWidth, PAGE_HEIGHT - barHeight, barWidth + 1, barHeight, 'F');
    });

    // Informacion de contacto
    doc.setFontSize(8);
    doc.setTextColor(COLORS.text);
    doc.setFont('helvetica', 'normal');

    const contactY = footerY - 5;
    doc.text('Blanco Encalada 1335, Renca', 40, contactY, { align: 'center' });
    doc.text('+562 2685 6600', PAGE_WIDTH / 2, contactY, { align: 'center' });
    doc.text('www.renca.cl', PAGE_WIDTH - 40, contactY, { align: 'center' });

    // Numero de pagina
    doc.text(String(pageNum), PAGE_WIDTH - MARGIN_RIGHT, footerY - 12, { align: 'right' });
  }

  /**
   * Agrega texto con salto de linea automatico
   * @param {jsPDF} doc - Documento PDF
   * @param {string} text - Texto a agregar
   * @param {number} x - Posicion X
   * @param {number} y - Posicion Y
   * @param {number} maxWidth - Ancho maximo
   * @param {number} lineHeight - Altura de linea
   * @returns {number} Nueva posicion Y
   */
  addWrappedText(doc, text, x, y, maxWidth, lineHeight = 5) {
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line, i) => {
      doc.text(line, x, y + (i * lineHeight));
    });
    return y + (lines.length * lineHeight);
  }

  /**
   * Verifica si necesita nueva pagina y la crea si es necesario
   * @param {jsPDF} doc - Documento PDF
   * @param {number} neededSpace - Espacio necesario en mm
   * @param {number} pageNum - Numero de pagina actual
   * @returns {number} Numero de pagina actualizado
   */
  checkPageBreak(doc, neededSpace, pageNum) {
    const maxY = PAGE_HEIGHT - 35; // Espacio reservado para footer
    if (this.currentY + neededSpace > maxY) {
      this.drawFooter(doc, pageNum);
      doc.addPage();
      pageNum++;
      this.currentY = 20;
    }
    return pageNum;
  }

  /**
   * Dibuja una linea separadora horizontal
   * @param {jsPDF} doc - Documento PDF
   */
  drawSeparator(doc) {
    doc.setDrawColor(COLORS.lightGray);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_LEFT, this.currentY, PAGE_WIDTH - MARGIN_RIGHT, this.currentY);
    this.currentY += 5;
  }

  // ===================== INFORMES =====================

  /**
   * Genera el Informe Semestral de Registro de Socios
   * Requerido por Ley 19.418 Art. 8
   * @param {Object} organization - Datos de la organizacion
   * @returns {jsPDF} Documento PDF
   */
  generateSemestralReport(organization) {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const org = organization.organization || organization;
    const members = this.getMembers(organization);
    const directorio = this.getDirectorio(organization);
    const semester = this.getCurrentSemester();

    this.drawHeader(doc, 'INFORME SEMESTRAL DE REGISTRO DE SOCIOS', 'Ley 19.418 - Art. 8');

    // Datos de la organizacion
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('DATOS DE LA ORGANIZACION', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);

    doc.text(`Nombre: ${this.getOrgName(organization)}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text(`Tipo: ${org.organizationType || 'No especificado'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text(`Direccion: ${org.address || 'No especificada'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text(`Comuna: ${org.comuna || 'Renca'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text(`Unidad Vecinal: ${org.unidadVecinal || 'No especificada'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 8;

    this.drawSeparator(doc);

    // Periodo del informe
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('PERIODO DEL INFORME', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);
    doc.text(`Desde: ${this.formatDateDDMMYYYY(semester.start)}`, MARGIN_LEFT, this.currentY);
    doc.text(`Hasta: ${this.formatDateDDMMYYYY(semester.end)}`, MARGIN_LEFT + 80, this.currentY);
    this.currentY += 5;
    doc.text(`Fecha de emision: ${this.formatDateDDMMYYYY(new Date())}`, MARGIN_LEFT, this.currentY);
    this.currentY += 8;

    this.drawSeparator(doc);

    // Resumen
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('RESUMEN', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);
    doc.text(`Total de socios registrados: ${members.length}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;

    // Intentar identificar socios nuevos (los que tienen fecha reciente)
    const semesterStart = semester.start.getTime();
    const newMembers = members.filter(m => {
      if (m.joinDate || m.createdAt) {
        const joinDate = new Date(m.joinDate || m.createdAt).getTime();
        return joinDate >= semesterStart;
      }
      return false;
    });
    doc.text(`Nuevas incorporaciones en el periodo: ${newMembers.length > 0 ? newMembers.length : 'Sin registro de fecha de ingreso'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 10;

    this.drawSeparator(doc);

    // Tabla de socios
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('REGISTRO DE SOCIOS', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    // Encabezados de la tabla
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor('#f3f4f6');
    doc.rect(MARGIN_LEFT, this.currentY - 4, CONTENT_WIDTH, 7, 'F');

    doc.setTextColor(COLORS.dark);
    doc.text('N', MARGIN_LEFT + 2, this.currentY);
    doc.text('NOMBRE COMPLETO', MARGIN_LEFT + 12, this.currentY);
    doc.text('RUT', MARGIN_LEFT + 95, this.currentY);
    doc.text('FECHA INGRESO', MARGIN_LEFT + 130, this.currentY);
    this.currentY += 7;

    // Filas de la tabla
    let pageNum = 1;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);

    members.forEach((member, index) => {
      pageNum = this.checkPageBreak(doc, 7, pageNum);

      // Fondo alterno
      if (index % 2 === 0) {
        doc.setFillColor('#f9fafb');
        doc.rect(MARGIN_LEFT, this.currentY - 4, CONTENT_WIDTH, 6, 'F');
      }

      doc.setTextColor(COLORS.text);
      doc.text(String(index + 1), MARGIN_LEFT + 2, this.currentY);

      const name = this.getMemberFullName(member);
      const truncatedName = name.length > 45 ? name.substring(0, 42) + '...' : name;
      doc.text(truncatedName, MARGIN_LEFT + 12, this.currentY);
      doc.text(member.rut || '____________', MARGIN_LEFT + 95, this.currentY);

      const joinDate = member.joinDate || member.createdAt || member.birthDate;
      doc.text(joinDate ? this.formatDateDDMMYYYY(joinDate) : 'Sin registro', MARGIN_LEFT + 130, this.currentY);

      this.currentY += 6;
    });

    if (members.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.text('No se encontraron socios registrados.', MARGIN_LEFT, this.currentY);
      this.currentY += 6;
    }

    this.currentY += 15;
    pageNum = this.checkPageBreak(doc, 30, pageNum);

    // Firma del presidente
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);

    const president = directorio.president || {};
    const presidentName = this.getMemberFullName(president);

    doc.text('_________________________________', PAGE_WIDTH / 2, this.currentY, { align: 'center' });
    this.currentY += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(presidentName, PAGE_WIDTH / 2, this.currentY, { align: 'center' });
    this.currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Presidente/a', PAGE_WIDTH / 2, this.currentY, { align: 'center' });
    this.currentY += 5;
    doc.text(this.getOrgName(organization), PAGE_WIDTH / 2, this.currentY, { align: 'center' });

    this.drawFooter(doc, pageNum);

    return doc;
  }

  /**
   * Genera el Informe Anual de la Comision Revisora de Cuentas
   * @param {Object} organization - Datos de la organizacion
   * @returns {jsPDF} Documento PDF
   */
  generateAnnualReport(organization) {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const org = organization.organization || organization;
    const directorio = this.getDirectorio(organization);
    const fiscalYear = this.getCurrentFiscalYear();

    this.drawHeader(doc, 'INFORME ANUAL COMISION REVISORA DE CUENTAS', 'Ley 19.418');

    // Datos de la organizacion
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('DATOS DE LA ORGANIZACION', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);
    doc.text(`Nombre: ${this.getOrgName(organization)}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text(`Tipo: ${org.organizationType || 'No especificado'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text(`Direccion: ${org.address || 'No especificada'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 8;

    this.drawSeparator(doc);

    // Periodo fiscal
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('PERIODO FISCAL', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);
    doc.text(`Ano fiscal: ${fiscalYear.year}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text(`Desde: ${this.formatDateDDMMYYYY(fiscalYear.start)}`, MARGIN_LEFT, this.currentY);
    doc.text(`Hasta: ${this.formatDateDDMMYYYY(fiscalYear.end)}`, MARGIN_LEFT + 80, this.currentY);
    this.currentY += 5;
    doc.text(`Fecha de emision: ${this.formatDateDDMMYYYY(new Date())}`, MARGIN_LEFT, this.currentY);
    this.currentY += 8;

    this.drawSeparator(doc);

    // Miembros de la comision revisora
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('MIEMBROS DE LA COMISION REVISORA DE CUENTAS', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);

    const comisionRevisora = org.comisionRevisora || organization.comisionRevisora;
    if (comisionRevisora && Array.isArray(comisionRevisora) && comisionRevisora.length > 0) {
      comisionRevisora.forEach((member, i) => {
        doc.text(`${i + 1}. ${this.getMemberFullName(member)} - RUT: ${member.rut || '____________'}`, MARGIN_LEFT + 5, this.currentY);
        this.currentY += 6;
      });
    } else {
      doc.text('1. ______________________________ - RUT: ____________', MARGIN_LEFT + 5, this.currentY);
      this.currentY += 6;
      doc.text('2. ______________________________ - RUT: ____________', MARGIN_LEFT + 5, this.currentY);
      this.currentY += 6;
      doc.text('3. ______________________________ - RUT: ____________', MARGIN_LEFT + 5, this.currentY);
      this.currentY += 6;
    }
    this.currentY += 5;

    this.drawSeparator(doc);

    // Resumen financiero (placeholder)
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('RESUMEN FINANCIERO', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);

    const financialItems = [
      { label: 'Saldo inicial del periodo', value: '$ _______________' },
      { label: 'Total ingresos del periodo', value: '$ _______________' },
      { label: 'Total egresos del periodo', value: '$ _______________' },
      { label: 'Saldo final del periodo', value: '$ _______________' }
    ];

    financialItems.forEach(item => {
      doc.text(item.label + ':', MARGIN_LEFT + 5, this.currentY);
      doc.text(item.value, MARGIN_LEFT + 100, this.currentY);
      this.currentY += 6;
    });
    this.currentY += 5;

    this.drawSeparator(doc);

    // Observaciones
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('OBSERVACIONES DE LA COMISION', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);

    // Lineas para observaciones
    for (let i = 0; i < 6; i++) {
      doc.text('_'.repeat(90), MARGIN_LEFT, this.currentY);
      this.currentY += 6;
    }
    this.currentY += 5;

    this.drawSeparator(doc);

    // Conclusion
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('CONCLUSION', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);

    const conclusionText = `La Comision Revisora de Cuentas de la organizacion ${this.getOrgName(organization)}, habiendo revisado la documentacion contable y financiera correspondiente al ano fiscal ${fiscalYear.year}, emite el presente informe conforme a lo establecido en la Ley 19.418.`;
    this.currentY = this.addWrappedText(doc, conclusionText, MARGIN_LEFT, this.currentY, CONTENT_WIDTH, 5);
    this.currentY += 15;

    // Firmas de la comision
    doc.setFontSize(9);
    const signatureSpacing = CONTENT_WIDTH / 3;

    for (let i = 0; i < 3; i++) {
      const xPos = MARGIN_LEFT + (i * signatureSpacing) + (signatureSpacing / 2);
      doc.text('_____________________', xPos, this.currentY, { align: 'center' });
      doc.text(`Miembro ${i + 1}`, xPos, this.currentY + 5, { align: 'center' });
      doc.text('Comision Revisora', xPos, this.currentY + 10, { align: 'center' });
    }

    this.drawFooter(doc, 1);

    return doc;
  }

  /**
   * Genera el Acta de Eleccion de Directorio
   * @param {Object} organization - Datos de la organizacion
   * @returns {jsPDF} Documento PDF
   */
  generateDirectorioReport(organization) {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const org = organization.organization || organization;
    const members = this.getMembers(organization);
    const directorio = this.getDirectorio(organization);

    this.drawHeader(doc, 'ACTA DE ELECCION DE DIRECTORIO', 'Ley 19.418');

    // Datos de la organizacion
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('DATOS DE LA ORGANIZACION', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);
    doc.text(`Nombre: ${this.getOrgName(organization)}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text(`Direccion: ${org.address || 'No especificada'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text(`Fecha de eleccion: ${this.formatDateDDMMYYYY(org.electionDate || new Date())}`, MARGIN_LEFT, this.currentY);
    this.currentY += 8;

    this.drawSeparator(doc);

    // Directorio saliente
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('DIRECTORIO SALIENTE', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);

    doc.text('Presidente/a: ______________________________     RUT: ____________', MARGIN_LEFT + 5, this.currentY);
    this.currentY += 6;
    doc.text('Secretario/a: ______________________________     RUT: ____________', MARGIN_LEFT + 5, this.currentY);
    this.currentY += 6;
    doc.text('Tesorero/a:   ______________________________     RUT: ____________', MARGIN_LEFT + 5, this.currentY);
    this.currentY += 8;

    this.drawSeparator(doc);

    // Nuevo directorio
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('NUEVO DIRECTORIO ELECTO', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);

    const president = directorio.president || {};
    const secretary = directorio.secretary || {};
    const treasurer = directorio.treasurer || {};

    doc.text(`Presidente/a: ${this.getMemberFullName(president)}`, MARGIN_LEFT + 5, this.currentY);
    doc.text(`RUT: ${president.rut || '____________'}`, MARGIN_LEFT + 120, this.currentY);
    this.currentY += 6;

    doc.text(`Secretario/a: ${this.getMemberFullName(secretary)}`, MARGIN_LEFT + 5, this.currentY);
    doc.text(`RUT: ${secretary.rut || '____________'}`, MARGIN_LEFT + 120, this.currentY);
    this.currentY += 6;

    doc.text(`Tesorero/a:   ${this.getMemberFullName(treasurer)}`, MARGIN_LEFT + 5, this.currentY);
    doc.text(`RUT: ${treasurer.rut || '____________'}`, MARGIN_LEFT + 120, this.currentY);
    this.currentY += 6;

    // Miembros adicionales del directorio
    if (directorio.additionalMembers && directorio.additionalMembers.length > 0) {
      directorio.additionalMembers.forEach((member) => {
        const cargo = (member.cargo || 'Director/a').toUpperCase();
        doc.text(`${cargo}: ${this.getMemberFullName(member)}`, MARGIN_LEFT + 5, this.currentY);
        doc.text(`RUT: ${member.rut || '____________'}`, MARGIN_LEFT + 120, this.currentY);
        this.currentY += 6;
      });
    }
    this.currentY += 5;

    this.drawSeparator(doc);

    // Resultado de la votacion (placeholder)
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('RESULTADO DE LA VOTACION', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);

    doc.text(`Total socios habilitados para votar: ${members.length > 0 ? members.length : '______'}`, MARGIN_LEFT + 5, this.currentY);
    this.currentY += 6;
    doc.text('Total votos emitidos: ______', MARGIN_LEFT + 5, this.currentY);
    this.currentY += 6;
    doc.text('Votos validos: ______', MARGIN_LEFT + 5, this.currentY);
    this.currentY += 6;
    doc.text('Votos nulos o en blanco: ______', MARGIN_LEFT + 5, this.currentY);
    this.currentY += 8;

    this.drawSeparator(doc);

    // Testigos
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('TESTIGOS DE LA ELECCION', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);

    for (let i = 1; i <= 3; i++) {
      doc.text(`Testigo ${i}: ______________________________     RUT: ____________     Firma: __________`, MARGIN_LEFT + 5, this.currentY);
      this.currentY += 7;
    }
    this.currentY += 10;

    // Firmas del directorio electo
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);

    // Presidente y Secretario
    doc.text('_________________________________', MARGIN_LEFT + 30, this.currentY, { align: 'center' });
    doc.text('_________________________________', PAGE_WIDTH - MARGIN_RIGHT - 30, this.currentY, { align: 'center' });
    this.currentY += 5;

    doc.setFont('helvetica', 'bold');
    doc.text(this.getMemberFullName(president), MARGIN_LEFT + 30, this.currentY, { align: 'center' });
    doc.text(this.getMemberFullName(secretary), PAGE_WIDTH - MARGIN_RIGHT - 30, this.currentY, { align: 'center' });
    this.currentY += 4;

    doc.setFont('helvetica', 'normal');
    doc.text('Presidente/a', MARGIN_LEFT + 30, this.currentY, { align: 'center' });
    doc.text('Secretario/a', PAGE_WIDTH - MARGIN_RIGHT - 30, this.currentY, { align: 'center' });

    this.drawFooter(doc, 1);

    return doc;
  }

  /**
   * Genera el Informe de Cumplimiento Ley 19.418
   * @param {Object} organization - Datos de la organizacion
   * @param {Array} alerts - Alertas de la organizacion (desde alertsService.getOrganizationAlerts())
   * @returns {jsPDF} Documento PDF
   */
  generateComplianceReport(organization, alerts = []) {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const org = organization.organization || organization;

    this.drawHeader(doc, 'INFORME DE CUMPLIMIENTO LEY 19.418', 'Departamento de Registro y Certificacion');

    // Datos de la organizacion
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('DATOS DE LA ORGANIZACION', MARGIN_LEFT, this.currentY);
    this.currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);
    doc.text(`Nombre: ${this.getOrgName(organization)}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text(`Tipo: ${org.organizationType || 'No especificado'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text(`Direccion: ${org.address || 'No especificada'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text(`Comuna: ${org.comuna || 'Renca'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text(`Unidad Vecinal: ${org.unidadVecinal || 'No especificada'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text(`Estado actual: ${org.status || 'No especificado'}`, MARGIN_LEFT, this.currentY);
    this.currentY += 5;
    doc.text(`Fecha de emision: ${this.formatDateDDMMYYYY(new Date())}`, MARGIN_LEFT, this.currentY);
    this.currentY += 8;

    this.drawSeparator(doc);

    // Estado de obligaciones legales
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.dark);
    doc.text('ESTADO DE OBLIGACIONES LEGALES', MARGIN_LEFT, this.currentY);
    this.currentY += 8;

    // Definir obligaciones legales con estado basado en alertas
    const obligations = [
      {
        name: 'Constitucion legal de la organizacion',
        article: 'Art. 5-7',
        status: org.status === 'approved' ? 'CUMPLIDO' : 'PENDIENTE',
        date: org.createdAt ? this.formatDateDDMMYYYY(org.createdAt) : '---'
      },
      {
        name: 'Deposito de acta constitutiva en Secretaria Municipal',
        article: 'Art. 8',
        status: org.status === 'approved' ? 'CUMPLIDO' : 'PENDIENTE',
        date: org.approvalDate ? this.formatDateDDMMYYYY(org.approvalDate) : '---'
      },
      {
        name: 'Eleccion de Directorio Definitivo (60 dias)',
        article: 'Art. 12',
        status: this._getAlertStatus(alerts, 'directorio_definitivo', org.definitiveDirectorio),
        date: org.definitiveDirectorio?.electedAt ? this.formatDateDDMMYYYY(org.definitiveDirectorio.electedAt) : '---'
      },
      {
        name: 'Registro semestral de socios actualizado',
        article: 'Art. 8',
        status: this._getAlertStatus(alerts, 'registro_socios'),
        date: org.lastSociosUpdate ? this.formatDateDDMMYYYY(org.lastSociosUpdate) : '---'
      },
      {
        name: 'Eleccion anual de Comision Revisora de Cuentas',
        article: 'Art. 25',
        status: this._getAlertStatus(alerts, 'comision_revisora'),
        date: org.lastComisionRevisoraElection ? this.formatDateDDMMYYYY(org.lastComisionRevisoraElection) : '---'
      },
      {
        name: 'Designacion de TRICEL (2 meses antes de vencimiento)',
        article: 'Art. 24',
        status: this._getAlertStatus(alerts, 'tricel_designation', org.tricelDesignated),
        date: org.tricelData?.designatedAt ? this.formatDateDDMMYYYY(org.tricelData.designatedAt) : '---'
      },
      {
        name: 'Renovacion de Directorio (cada 3 anos)',
        article: 'Art. 22',
        status: this._getAlertStatus(alerts, 'directorio_renewal'),
        date: org.definitiveDirectorio?.electedAt ? this.formatDateDDMMYYYY(org.definitiveDirectorio.electedAt) : '---'
      }
    ];

    // Encabezado de la tabla
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor('#f3f4f6');
    doc.rect(MARGIN_LEFT, this.currentY - 4, CONTENT_WIDTH, 7, 'F');

    doc.setTextColor(COLORS.dark);
    doc.text('OBLIGACION', MARGIN_LEFT + 2, this.currentY);
    doc.text('ART.', MARGIN_LEFT + 95, this.currentY);
    doc.text('ESTADO', MARGIN_LEFT + 115, this.currentY);
    doc.text('FECHA', MARGIN_LEFT + 145, this.currentY);
    this.currentY += 7;

    // Filas de obligaciones
    doc.setFont('helvetica', 'normal');
    let pageNum = 1;

    obligations.forEach((obligation, index) => {
      pageNum = this.checkPageBreak(doc, 10, pageNum);

      // Fondo alterno
      if (index % 2 === 0) {
        doc.setFillColor('#f9fafb');
        doc.rect(MARGIN_LEFT, this.currentY - 4, CONTENT_WIDTH, 8, 'F');
      }

      // Nombre de la obligacion (puede necesitar wrap)
      doc.setTextColor(COLORS.text);
      const nameLines = doc.splitTextToSize(obligation.name, 88);
      nameLines.forEach((line, i) => {
        doc.text(line, MARGIN_LEFT + 2, this.currentY + (i * 4));
      });

      doc.text(obligation.article, MARGIN_LEFT + 95, this.currentY);

      // Estado con color
      const statusColor = this._getStatusColor(obligation.status);
      doc.setTextColor(statusColor);
      doc.setFont('helvetica', 'bold');
      doc.text(obligation.status, MARGIN_LEFT + 115, this.currentY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(COLORS.text);
      doc.text(obligation.date, MARGIN_LEFT + 145, this.currentY);

      this.currentY += Math.max(8, nameLines.length * 4 + 2);
    });

    this.currentY += 8;
    this.drawSeparator(doc);

    // Alertas activas
    if (alerts.length > 0) {
      pageNum = this.checkPageBreak(doc, 20, pageNum);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(COLORS.dark);
      doc.text('ALERTAS ACTIVAS', MARGIN_LEFT, this.currentY);
      this.currentY += 7;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');

      alerts.forEach((alert) => {
        pageNum = this.checkPageBreak(doc, 15, pageNum);

        const priorityLabel = this._getPriorityLabel(alert.priority);
        const priorityColor = this._getPriorityColor(alert.priority);

        doc.setTextColor(priorityColor);
        doc.setFont('helvetica', 'bold');
        doc.text(`[${priorityLabel}]`, MARGIN_LEFT + 2, this.currentY);

        doc.setTextColor(COLORS.text);
        doc.setFont('helvetica', 'normal');
        doc.text(alert.title, MARGIN_LEFT + 30, this.currentY);
        this.currentY += 4;

        doc.setFontSize(7);
        doc.text(`Fecha limite: ${this.formatDateDDMMYYYY(alert.dueDate)}`, MARGIN_LEFT + 30, this.currentY);
        doc.text(`Dias restantes: ${alert.daysRemaining}`, MARGIN_LEFT + 90, this.currentY);
        this.currentY += 4;

        const descLines = doc.splitTextToSize(alert.description, CONTENT_WIDTH - 30);
        descLines.forEach((line) => {
          doc.text(line, MARGIN_LEFT + 30, this.currentY);
          this.currentY += 3.5;
        });

        doc.setFontSize(8);
        this.currentY += 3;
      });
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(COLORS.text);
      doc.text('No hay alertas activas para esta organizacion.', MARGIN_LEFT, this.currentY);
      this.currentY += 7;
    }

    this.currentY += 5;
    this.drawSeparator(doc);

    // Acciones requeridas
    const pendingActions = alerts.filter(a => a.actionRequired && !a.completed);
    if (pendingActions.length > 0) {
      pageNum = this.checkPageBreak(doc, 20, pageNum);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(COLORS.dark);
      doc.text('ACCIONES REQUERIDAS', MARGIN_LEFT, this.currentY);
      this.currentY += 7;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(COLORS.text);

      pendingActions.forEach((action, i) => {
        pageNum = this.checkPageBreak(doc, 8, pageNum);
        doc.text(`${i + 1}. ${action.actionLabel} - Plazo: ${this.formatDateDDMMYYYY(action.dueDate)}`, MARGIN_LEFT + 5, this.currentY);
        this.currentY += 6;
      });
    }

    this.currentY += 10;
    pageNum = this.checkPageBreak(doc, 20, pageNum);

    // Firma
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);

    doc.text(`Renca, ${this.formatDateLong(new Date())}`, MARGIN_LEFT, this.currentY);
    this.currentY += 15;

    doc.text('_________________________________', PAGE_WIDTH / 2, this.currentY, { align: 'center' });
    this.currentY += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Secretaria Municipal', PAGE_WIDTH / 2, this.currentY, { align: 'center' });

    this.drawFooter(doc, pageNum);

    return doc;
  }

  // ===================== HELPERS INTERNOS PARA COMPLIANCE =====================

  /**
   * Obtiene el estado de una alerta especifica
   * @param {Array} alerts - Lista de alertas
   * @param {string} alertType - Tipo de alerta
   * @param {*} completedFlag - Flag de completado (si existe)
   * @returns {string} Estado: CUMPLIDO, PENDIENTE o VENCIDO
   */
  _getAlertStatus(alerts, alertType, completedFlag = undefined) {
    if (completedFlag) return 'CUMPLIDO';

    const alert = alerts.find(a => a.type === alertType);
    if (!alert) return 'CUMPLIDO';
    if (alert.completed) return 'CUMPLIDO';
    if (alert.daysRemaining < 0) return 'VENCIDO';
    return 'PENDIENTE';
  }

  /**
   * Obtiene el color segun el estado de la obligacion
   * @param {string} status - Estado
   * @returns {string} Color hex
   */
  _getStatusColor(status) {
    switch (status) {
      case 'CUMPLIDO': return '#10b981';
      case 'PENDIENTE': return '#f59e0b';
      case 'VENCIDO': return '#dc2626';
      default: return COLORS.text;
    }
  }

  /**
   * Obtiene la etiqueta de prioridad
   * @param {string} priority - Prioridad
   * @returns {string} Etiqueta
   */
  _getPriorityLabel(priority) {
    const labels = {
      'critical': 'CRITICO',
      'high': 'ALTO',
      'medium': 'MEDIO',
      'low': 'BAJO'
    };
    return labels[priority] || 'INFO';
  }

  /**
   * Obtiene el color segun la prioridad
   * @param {string} priority - Prioridad
   * @returns {string} Color hex
   */
  _getPriorityColor(priority) {
    const colors = {
      'critical': '#dc2626',
      'high': '#ea580c',
      'medium': '#f59e0b',
      'low': '#3b82f6'
    };
    return colors[priority] || COLORS.text;
  }

  // ===================== DESCARGA =====================

  /**
   * Descarga un documento PDF usando pdfService
   * @param {jsPDF} doc - Documento PDF
   * @param {string} filename - Nombre del archivo
   */
  downloadReport(doc, filename) {
    pdfService.downloadPDF(doc, filename);
  }

  // ===================== GENERACION MASIVA =====================

  /**
   * Genera todos los informes legales y los descarga
   * Intenta usar JSZip si esta disponible, sino descarga individualmente
   * @param {Object} organization - Datos de la organizacion
   * @param {Array} alerts - Alertas de la organizacion
   */
  async generateAllReports(organization, alerts = []) {
    const orgName = this.getOrgName(organization).replace(/\s+/g, '_');

    const reports = [
      {
        name: `Informe_Semestral_Socios_${orgName}.pdf`,
        doc: this.generateSemestralReport(organization)
      },
      {
        name: `Informe_Anual_Comision_Revisora_${orgName}.pdf`,
        doc: this.generateAnnualReport(organization)
      },
      {
        name: `Acta_Eleccion_Directorio_${orgName}.pdf`,
        doc: this.generateDirectorioReport(organization)
      },
      {
        name: `Informe_Cumplimiento_Ley19418_${orgName}.pdf`,
        doc: this.generateComplianceReport(organization, alerts)
      }
    ];

    // Intentar usar JSZip si esta disponible
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      reports.forEach(report => {
        const pdfBlob = report.doc.output('arraybuffer');
        zip.file(report.name, pdfBlob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Informes_Legales_${orgName}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      return { success: true, method: 'zip', count: reports.length };
    } catch (zipError) {
      // JSZip no disponible, descargar individualmente
      console.warn('JSZip no disponible, descargando informes individualmente:', zipError.message);

      reports.forEach(report => {
        this.downloadReport(report.doc, report.name);
      });

      return { success: true, method: 'individual', count: reports.length };
    }
  }
}

// Exportar instancia singleton
export const legalReportService = new LegalReportService();
