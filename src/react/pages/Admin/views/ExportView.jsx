import { useState } from 'react';
import { useAdminStore } from '../../../stores/adminStore';
import { useUiStore } from '../../../stores/uiStore';
import { ORG_STATUS_LABELS } from '../../../utils/formatters';
import { apiService } from '../../../../services/ApiService';

function generateCSV(headers, rows) {
  const BOM = '\uFEFF';
  const csv = [headers, ...rows].map(r =>
    r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  return BOM + csv;
}

function downloadFile(content, filename, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getPresidentName(org) {
  const dir = org.provisionalDirectorio || org.directorio || {};
  if (dir.president) return `${dir.president.firstName || ''} ${dir.president.lastName || ''}`.trim();
  if (dir.members) {
    const pres = dir.members.find(m => m.cargo === 'Presidente' || m.role === 'presidente');
    if (pres) return `${pres.firstName || pres.name || ''} ${pres.lastName || ''}`.trim();
  }
  return '';
}

export default function ExportView() {
  const { organizations } = useAdminStore();
  const addToast = useUiStore(s => s.addToast);
  const [selectedExport, setSelectedExport] = useState(null);

  function exportOrganizationsCSV() {
    const headers = ['Nombre', 'Tipo', 'Estado', 'Comuna', 'Fecha Creación', 'N° Miembros', 'Presidente', 'Email'];
    const rows = organizations.map(o => [
      o.name || '',
      o.type || '',
      ORG_STATUS_LABELS[o.status] || o.status || '',
      o.commune || '',
      o.createdAt ? new Date(o.createdAt).toLocaleDateString('es-CL') : '',
      (o.members || []).length,
      getPresidentName(o),
      o.email || ''
    ]);
    const csv = generateCSV(headers, rows);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(csv, `organizaciones_${date}.csv`);
    addToast('CSV de organizaciones exportado', 'success');
  }

  function exportOrganizationsExcel() {
    const headers = ['Nombre', 'Tipo', 'Estado', 'Comuna', 'Fecha Creación', 'N° Miembros', 'Presidente', 'Email'];
    const rows = organizations.map(o => [
      o.name || '',
      o.type || '',
      ORG_STATUS_LABELS[o.status] || o.status || '',
      o.commune || '',
      o.createdAt ? new Date(o.createdAt).toLocaleDateString('es-CL') : '',
      (o.members || []).length,
      getPresidentName(o),
      o.email || ''
    ]);

    let html = '<html><head><meta charset="UTF-8"></head><body>';
    html += '<table border="1" style="border-collapse:collapse">';
    html += '<tr>' + headers.map(h => `<th style="background:#2563eb;color:white;padding:8px">${h}</th>`).join('') + '</tr>';
    rows.forEach(r => {
      html += '<tr>' + r.map(v => `<td style="padding:6px">${v}</td>`).join('') + '</tr>';
    });
    html += '</table></body></html>';

    const date = new Date().toISOString().split('T')[0];
    downloadFile(html, `organizaciones_${date}.xls`, 'application/vnd.ms-excel');
    addToast('Excel de organizaciones exportado', 'success');
  }

  function exportStatsCSV() {
    const byStatus = {};
    organizations.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });

    let csv = '\uFEFF';
    csv += '"Resumen de Organizaciones"\n\n';
    csv += '"Total","' + organizations.length + '"\n\n';
    csv += '"Estado","Cantidad"\n';
    Object.entries(byStatus).forEach(([status, count]) => {
      csv += `"${ORG_STATUS_LABELS[status] || status}","${count}"\n`;
    });

    const date = new Date().toISOString().split('T')[0];
    downloadFile(csv, `estadisticas_${date}.csv`);
    addToast('CSV de estadísticas exportado', 'success');
  }

  // Municipal exports
  const [mExportOrgId, setMExportOrgId] = useState('');
  const [mExportFrom, setMExportFrom] = useState('');
  const [mExportTo, setMExportTo] = useState('');
  const [mExporting, setMExporting] = useState(false);

  const approvedOrgs = organizations.filter(o => ['approved', 'sent_registry'].includes(o.status));

  async function handleMunicipalExport(type) {
    if (!mExportOrgId) { addToast('Seleccione una organización', 'error'); return; }
    setMExporting(true);
    try {
      if (type === 'members') {
        await apiService.exportMemberRoster(mExportOrgId);
        addToast('Nómina de socios exportada', 'success');
      } else if (type === 'changes') {
        if (!mExportFrom || !mExportTo) { addToast('Seleccione fechas', 'error'); setMExporting(false); return; }
        await apiService.exportSemesterChanges(mExportOrgId, mExportFrom, mExportTo);
        addToast('Reporte de cambios exportado', 'success');
      }
    } catch (err) {
      addToast(err.message || 'Error al exportar', 'error');
    } finally {
      setMExporting(false);
    }
  }

  const exports = [
    {
      key: 'org-csv', label: 'Organizaciones (CSV)',
      description: 'Lista completa de organizaciones con datos básicos',
      icon: '\uD83D\uDCC4', action: exportOrganizationsCSV
    },
    {
      key: 'org-excel', label: 'Organizaciones (Excel)',
      description: 'Lista con formato para Excel',
      icon: '\uD83D\uDCCA', action: exportOrganizationsExcel
    },
    {
      key: 'stats-csv', label: 'Estadísticas (CSV)',
      description: 'Resumen estadístico por estado',
      icon: '\uD83D\uDCC8', action: exportStatsCSV
    }
  ];

  const inputSm = {
    padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700, color: '#111827' }}>
        Exportar Datos
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        {organizations.length} organizaciones disponibles para exportar.
      </p>

      <div style={{ display: 'grid', gap: 12, maxWidth: 600 }}>
        {exports.map(exp => (
          <div
            key={exp.key}
            onClick={exp.action}
            style={{
              background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
              padding: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
              transition: 'box-shadow 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <span style={{ fontSize: 32 }}>{exp.icon}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{exp.label}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{exp.description}</div>
            </div>
            <span style={{ marginLeft: 'auto', color: '#2563eb', fontSize: 20 }}>&darr;</span>
          </div>
        ))}
      </div>

      {/* Municipal Exports (Ley 19.418) */}
      <h2 style={{ margin: '32px 0 8px', fontSize: 18, fontWeight: 700, color: '#111827' }}>
        Exportaciones Municipales (Ley 19.418)
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
        Reportes oficiales para la secretaría municipal. Solo organizaciones aprobadas.
      </p>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, maxWidth: 600 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Organización</label>
          <select value={mExportOrgId} onChange={e => setMExportOrgId(e.target.value)}
            style={{ ...inputSm, width: '100%' }}>
            <option value="">Seleccionar organización...</option>
            {approvedOrgs.map(o => (
              <option key={o._id} value={o._id}>{o.organizationName || o.name}</option>
            ))}
          </select>
          {approvedOrgs.length === 0 && (
            <p style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>No hay organizaciones aprobadas</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => handleMunicipalExport('members')} disabled={mExporting || !mExportOrgId}
            style={{
              padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: (mExporting || !mExportOrgId) ? 0.5 : 1
            }}>
            Nómina de Socios (Art. 15)
          </button>
        </div>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Reporte de Cambios (período)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={mExportFrom} onChange={e => setMExportFrom(e.target.value)} style={inputSm} />
            <span style={{ color: '#9ca3af', fontSize: 13 }}>a</span>
            <input type="date" value={mExportTo} onChange={e => setMExportTo(e.target.value)} style={inputSm} />
            <button onClick={() => handleMunicipalExport('changes')}
              disabled={mExporting || !mExportOrgId || !mExportFrom || !mExportTo}
              style={{
                padding: '8px 16px', background: '#fff', color: '#2563eb', border: '1px solid #2563eb',
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                opacity: (mExporting || !mExportOrgId || !mExportFrom || !mExportTo) ? 0.5 : 1
              }}>
              Exportar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
