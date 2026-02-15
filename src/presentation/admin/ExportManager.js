/**
 * ExportManager - Funcionalidad de exportacion de datos del admin
 * No es un manager visual - provee funciones de exportacion que otros managers pueden llamar
 */

import { apiService } from '../../services/ApiService.js';
import { organizationsService } from '../../services/OrganizationsService.js';
import { showToast } from '../../app.js';

// Etiquetas de estado en espanol
const STATUS_LABELS = {
  'draft': 'Borrador',
  'waiting_ministro': 'Esperando Ministro de Fe',
  'ministro_scheduled': 'Ministro Agendado',
  'ministro_approved': 'Aprobado por Ministro',
  'pending_review': 'Pendiente de Revision',
  'in_review': 'En Revision',
  'rejected': 'Requiere Correcciones',
  'sent_registry': 'Enviada al Registro Civil',
  'registry_observations': 'Observaciones del Registro Civil',
  'approved': 'Aprobada',
  'dissolved': 'Disuelta'
};

// Etiquetas de tipo de organizacion en espanol
const ORG_TYPE_LABELS = {
  'JUNTA_VECINOS': 'Junta de Vecinos',
  'COMITE_VECINOS': 'Comite de Vecinos',
  'CLUB_DEPORTIVO': 'Club Deportivo',
  'CLUB_ADULTO_MAYOR': 'Club Adulto Mayor',
  'CLUB_JUVENIL': 'Club Juvenil',
  'CLUB_CULTURAL': 'Club Cultural',
  'CENTRO_MADRES': 'Centro de Madres',
  'CENTRO_PADRES': 'Centro de Padres',
  'CENTRO_CULTURAL': 'Centro Cultural',
  'AGRUPACION_FOLCLORICA': 'Agrupacion Folclorica',
  'AGRUPACION_CULTURAL': 'Agrupacion Cultural',
  'AGRUPACION_JUVENIL': 'Agrupacion Juvenil',
  'AGRUPACION_AMBIENTAL': 'Agrupacion Ambiental',
  'AGRUPACION_EMPRENDEDORES': 'Agrupacion de Emprendedores',
  'COMITE_VIVIENDA': 'Comite de Vivienda',
  'COMITE_ALLEGADOS': 'Comite de Allegados',
  'COMITE_APR': 'Comite de Agua Potable Rural',
  'COMITE_ADELANTO': 'Comite de Adelanto',
  'COMITE_MEJORAMIENTO': 'Comite de Mejoramiento',
  'COMITE_CONVIVENCIA': 'Comite de Convivencia',
  'ORG_SCOUT': 'Organizacion Scout',
  'ORG_MUJERES': 'Organizacion de Mujeres',
  'ORG_INDIGENA': 'Organizacion Indigena',
  'ORG_SALUD': 'Organizacion de Salud',
  'ORG_SOCIAL': 'Organizacion Social',
  'ORG_CULTURAL': 'Organizacion Cultural',
  'GRUPO_TEATRO': 'Grupo de Teatro',
  'CORO': 'Coro',
  'TALLER_ARTESANIA': 'Taller de Artesania',
  'OTRA_FUNCIONAL': 'Otra Organizacion Funcional'
};

export class ExportManager {
  constructor() {
    // No requiere inicializacion visual
  }

  /**
   * Exporta organizaciones a CSV
   * @param {Array} organizations - Array de organizaciones
   */
  exportOrganizationsCSV(organizations) {
    if (!organizations || organizations.length === 0) {
      showToast('No hay organizaciones para exportar', 'warning');
      return;
    }

    const headers = [
      'Nombre',
      'Tipo',
      'Estado',
      'Comuna',
      'Fecha Creacion',
      'N Miembros',
      'Presidente',
      'RUT Presidente',
      'Email Contacto'
    ];

    const rows = organizations.map(org => [
      this._getOrgName(org),
      this._getOrgTypeLabel(org),
      this._getStatusLabel(org.status),
      org.comuna || org.commune || '',
      this.formatDateForExport(org.createdAt || org.created_at || org.fechaCreacion),
      this._getMemberCount(org),
      this._getPresidentName(org),
      this._getPresidentRut(org),
      org.contactEmail || org.email || ''
    ]);

    const csv = this.generateCSV(headers, rows);
    const date = this._getCurrentDateString();
    this.downloadFile(csv, `organizaciones_${date}.csv`, 'text/csv;charset=utf-8');
    showToast(`${organizations.length} organizaciones exportadas a CSV`, 'success');
  }

  /**
   * Exporta organizaciones a formato Excel (HTML table que Excel puede abrir)
   * @param {Array} organizations - Array de organizaciones
   */
  exportOrganizationsExcel(organizations) {
    if (!organizations || organizations.length === 0) {
      showToast('No hay organizaciones para exportar', 'warning');
      return;
    }

    const headers = [
      'Nombre',
      'Tipo',
      'Estado',
      'Comuna',
      'Fecha Creacion',
      'N Miembros',
      'Presidente',
      'RUT Presidente',
      'Email Contacto'
    ];

    const rows = organizations.map(org => [
      this._getOrgName(org),
      this._getOrgTypeLabel(org),
      this._getStatusLabel(org.status),
      org.comuna || org.commune || '',
      this.formatDateForExport(org.createdAt || org.created_at || org.fechaCreacion),
      this._getMemberCount(org),
      this._getPresidentName(org),
      this._getPresidentRut(org),
      org.contactEmail || org.email || ''
    ]);

    const html = this._generateExcelHTML(headers, rows, 'Organizaciones');
    const date = this._getCurrentDateString();
    this.downloadFile(html, `organizaciones_${date}.xls`, 'application/vnd.ms-excel;charset=utf-8');
    showToast(`${organizations.length} organizaciones exportadas a Excel`, 'success');
  }

  /**
   * Exporta los miembros de una organizacion a CSV
   * @param {Object} organization - Organizacion con sus miembros
   */
  exportMembersCSV(organization) {
    if (!organization) {
      showToast('No se encontro la organizacion', 'warning');
      return;
    }

    const members = organization.members || [];
    if (members.length === 0) {
      showToast('La organizacion no tiene miembros registrados', 'warning');
      return;
    }

    const headers = [
      'Nombre',
      'Apellido',
      'RUT',
      'Rol',
      'Email',
      'Telefono'
    ];

    const roleLabels = {
      'president': 'Presidente',
      'secretary': 'Secretario',
      'treasurer': 'Tesorero',
      'director': 'Director',
      'member': 'Miembro',
      'vocal': 'Vocal'
    };

    const rows = members.map(member => [
      member.firstName || member.primerNombre || member.nombre || '',
      member.lastName || member.apellidoPaterno || member.apellido || '',
      member.rut || '',
      roleLabels[member.role] || member.role || 'Miembro',
      member.email || '',
      member.phone || member.telefono || ''
    ]);

    const orgName = this._getOrgName(organization).replace(/[^a-zA-Z0-9_-]/g, '_');
    const date = this._getCurrentDateString();
    const csv = this.generateCSV(headers, rows);
    this.downloadFile(csv, `miembros_${orgName}_${date}.csv`, 'text/csv;charset=utf-8');
    showToast(`${members.length} miembros exportados a CSV`, 'success');
  }

  /**
   * Exporta estadisticas del dashboard a CSV
   * @param {Object} stats - Objeto con estadisticas
   */
  exportStatsCSV(stats) {
    if (!stats) {
      showToast('No hay estadisticas para exportar', 'warning');
      return;
    }

    let csvContent = '';

    // Seccion 1: Resumen
    csvContent += this.generateCSV(
      ['Metrica', 'Valor'],
      [
        ['Total Organizaciones', stats.total || 0],
        ['Pendientes', stats.pending || stats.pendientes || 0],
        ['Aprobadas', stats.approved || stats.aprobadas || 0],
        ['Rechazadas', stats.rejected || stats.rechazadas || 0],
        ['En Revision', stats.inReview || stats.enRevision || 0]
      ]
    );

    // Separador de seccion
    csvContent += '\n\n';

    // Seccion 2: Por Estado
    if (stats.byStatus || stats.porEstado) {
      const statusData = stats.byStatus || stats.porEstado || {};
      const statusHeaders = ['Estado', 'Cantidad'];
      const statusRows = Object.entries(statusData).map(([status, count]) => [
        STATUS_LABELS[status] || status,
        count
      ]);

      csvContent += '"Por Estado"\n';
      csvContent += this.generateCSV(statusHeaders, statusRows);
    }

    // Separador de seccion
    csvContent += '\n\n';

    // Seccion 3: Timeline mensual
    if (stats.monthly || stats.timeline || stats.mensual) {
      const timelineData = stats.monthly || stats.timeline || stats.mensual || [];
      if (Array.isArray(timelineData) && timelineData.length > 0) {
        const timelineHeaders = ['Mes', 'Cantidad'];
        const timelineRows = timelineData.map(item => [
          item.month || item.mes || item.label || '',
          item.count || item.cantidad || item.value || 0
        ]);

        csvContent += '"Timeline Mensual"\n';
        csvContent += this.generateCSV(timelineHeaders, timelineRows);
      }
    }

    const date = this._getCurrentDateString();
    this.downloadFile(csvContent, `estadisticas_${date}.csv`, 'text/csv;charset=utf-8');
    showToast('Estadisticas exportadas a CSV', 'success');
  }

  // ===================== Metodos helper =====================

  /**
   * Genera un string CSV con escape correcto de valores
   * @param {Array<string>} headers - Encabezados de columnas
   * @param {Array<Array>} rows - Filas de datos
   * @returns {string} Contenido CSV
   */
  generateCSV(headers, rows) {
    const escapeCSVValue = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // Si contiene comas, comillas, saltos de linea o punto y coma, envolver en comillas
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes(';')) {
        // Escapar comillas dobles duplicandolas
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const headerLine = headers.map(escapeCSVValue).join(',');
    const dataLines = rows.map(row =>
      row.map(escapeCSVValue).join(',')
    );

    // BOM para que Excel reconozca UTF-8
    return '\uFEFF' + [headerLine, ...dataLines].join('\n');
  }

  /**
   * Crea un blob y dispara la descarga de un archivo
   * @param {string} content - Contenido del archivo
   * @param {string} filename - Nombre del archivo
   * @param {string} mimeType - Tipo MIME del archivo
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Limpiar
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Formatea una fecha para exportacion (DD/MM/YYYY)
   * @param {string} dateStr - Fecha en formato ISO o similar
   * @returns {string} Fecha formateada DD/MM/YYYY
   */
  formatDateForExport(dateStr) {
    if (!dateStr) return '';

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  }

  // ===================== Metodos internos =====================

  /**
   * Genera HTML con formato de tabla que Excel puede abrir
   * @param {Array<string>} headers
   * @param {Array<Array>} rows
   * @param {string} title
   * @returns {string} HTML formateado
   */
  _generateExcelHTML(headers, rows, title) {
    const escapeHTML = (str) => {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    let html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <style>
    table { border-collapse: collapse; width: 100%; }
    th { background-color: #2563eb; color: #ffffff; font-weight: bold; padding: 8px 12px; border: 1px solid #1d4ed8; text-align: left; }
    td { padding: 6px 12px; border: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .title { font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #1e293b; }
  </style>
</head>
<body>
  <div class="title">${escapeHTML(title)} - Exportado el ${this._getCurrentDateString()}</div>
  <table>
    <thead>
      <tr>
        ${headers.map(h => `<th>${escapeHTML(h)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
`;

    for (const row of rows) {
      html += '      <tr>';
      for (const cell of row) {
        html += `<td>${escapeHTML(cell)}</td>`;
      }
      html += '</tr>\n';
    }

    html += `
    </tbody>
  </table>
</body>
</html>`;

    return html;
  }

  /**
   * Obtiene el nombre de una organizacion de forma segura
   */
  _getOrgName(org) {
    return org.organizationName || org.name || org.nombre || 'Sin nombre';
  }

  /**
   * Obtiene la etiqueta legible del tipo de organizacion
   */
  _getOrgTypeLabel(org) {
    const type = org.organizationType || org.type || org.tipo || '';
    return ORG_TYPE_LABELS[type] || type || '';
  }

  /**
   * Obtiene la etiqueta legible de un estado
   */
  _getStatusLabel(status) {
    return STATUS_LABELS[status] || status || '';
  }

  /**
   * Obtiene el numero de miembros de una organizacion
   */
  _getMemberCount(org) {
    if (org.members && Array.isArray(org.members)) {
      return org.members.length;
    }
    return org.memberCount || org.totalMembers || 0;
  }

  /**
   * Obtiene el nombre del presidente de una organizacion
   */
  _getPresidentName(org) {
    // Buscar en directorio provisional
    const directorio = org.provisionalDirectorio || org.directorio || {};
    if (directorio.president) {
      const p = directorio.president;
      return [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || '';
    }

    // Buscar en miembros
    if (org.members && Array.isArray(org.members)) {
      const president = org.members.find(m => m.role === 'president');
      if (president) {
        return [president.firstName, president.lastName].filter(Boolean).join(' ') || '';
      }
    }

    return '';
  }

  /**
   * Obtiene el RUT del presidente de una organizacion
   */
  _getPresidentRut(org) {
    const directorio = org.provisionalDirectorio || org.directorio || {};
    if (directorio.president && directorio.president.rut) {
      return directorio.president.rut;
    }

    if (org.members && Array.isArray(org.members)) {
      const president = org.members.find(m => m.role === 'president');
      if (president) {
        return president.rut || '';
      }
    }

    return '';
  }

  /**
   * Obtiene la fecha actual formateada como YYYY-MM-DD
   */
  _getCurrentDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

// Instancia global
export let exportManager;

/**
 * Inicializa el ExportManager
 * @returns {ExportManager}
 */
export function initExportManager() {
  exportManager = new ExportManager();
  window.exportManagerInstance = exportManager;
  return exportManager;
}
