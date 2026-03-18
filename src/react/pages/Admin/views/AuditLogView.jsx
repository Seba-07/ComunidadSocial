import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import { localeString } from '../../../utils/formatters';
import DataTable from '../../../components/ui/DataTable';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

// ============ Diccionario humanizado de acciones ============
const ACTION_LABELS = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  STATUS_CHANGE: 'Cambio de Estado',
  LOGIN: 'Inicio de Sesión',
  LOGOUT: 'Cierre de Sesión',
  ASSIGN: 'Asignación',
  APPROVE: 'Aprobación',
  REJECT: 'Rechazo',
  UPLOAD: 'Carga de Archivo',
  DOWNLOAD: 'Descarga',
  EXPORT: 'Exportación',
  OPPOSE: 'Oposición de Datos',
  ACCESS_PII: 'Visualización de Datos'
};

const ACTION_COLORS = {
  CREATE: '#10b981',
  UPDATE: '#2563eb',
  DELETE: '#ef4444',
  STATUS_CHANGE: '#8b5cf6',
  LOGIN: '#06b6d4',
  LOGOUT: '#64748b',
  ASSIGN: '#f59e0b',
  APPROVE: '#22c55e',
  REJECT: '#ef4444',
  UPLOAD: '#0891b2',
  DOWNLOAD: '#6366f1',
  EXPORT: '#f59e0b',
  OPPOSE: '#dc2626',
  ACCESS_PII: '#94a3b8'
};

// ============ Diccionario humanizado de recursos ============
const RESOURCE_LABELS = {
  ORGANIZATION: 'Organización',
  USER: 'Usuario',
  MINISTRO: 'Ministro de Fe',
  ASSIGNMENT: 'Asignación',
  NEWS: 'Noticia',
  DOCUMENT: 'Documento',
  ESTATUTO: 'Estatuto',
  UNIDAD_VECINAL: 'Unidad Vecinal',
  NOTIFICATION: 'Notificación',
  GUIA: 'Guía',
  LIBRARY_DOCUMENT: 'Biblioteca',
  SYSTEM: 'Sistema',
  CONSENT: 'Consentimiento',
  SECURITY_INCIDENT: 'Incidente de Seguridad'
};

// ============ Rol humanizado ============
const ROLE_LABELS = {
  MUNICIPALIDAD: 'Secretario Municipal',
  ORGANIZADOR: 'Dirigente Social',
  MIEMBRO: 'Miembro',
  MIEMBRO_DIRECTIVO: 'Miembro Directivo',
  MINISTRO_FE: 'Ministro de Fe'
};

/**
 * Limpia el nombre de recurso removiendo prefijos técnicos
 */
function cleanResourceName(name) {
  if (!name) return '';
  // Remove prefixes like "SYSTEM:", "Incidente:", etc. if they duplicate the resource column
  return name
    .replace(/^SYSTEM:\s*/i, '')
    .replace(/^ORGANIZATION:\s*/i, '')
    .replace(/^USER:\s*/i, '');
}

/**
 * Genera un detalle legible a partir de los datos del log (fallback para logs antiguos sin detail)
 */
function generateFallbackDetail(log) {
  const type = log.details?.type;
  const name = cleanResourceName(log.resourceName);

  switch (type) {
    case 'list_all_users':
      return `Consultó el listado de ${log.details.count || ''} dirigentes sociales`;
    case 'list_all_ministros':
      return `Consultó el listado de ${log.details.count || ''} ministros de fe`;
    case 'view_user_detail':
      return name ? `Accedió a la ficha personal de ${name}` : 'Accedió a ficha de usuario';
    case 'view_members_with_accounts':
      return name ? `Consultó datos de socios de "${name}"` : 'Consultó datos de socios';
    case 'consent_update':
      return 'Actualizó sus preferencias de consentimiento';
    case 'personal_data_export':
      return `Exportó datos personales en formato ${log.details.format || 'JSON'}`;
    case 'arcop_opposition':
      return `Ejerció derecho de oposición ARCOP sobre "${log.details.purpose || ''}"`;
    case 'account_deletion_request':
      return `Solicitó eliminación de cuenta. Motivo: ${log.details.reason || 'No especificado'}`;
    case 'security_incident_report':
      return name ? `Registró incidente de seguridad "${name}"` : 'Registró incidente de seguridad';
    case 'security_incident_update':
      return name ? `Actualizó incidente "${name}" a estado "${log.details.status || ''}"` : 'Actualizó incidente de seguridad';
    case 'export_member_roster':
      return name ? `Exportó nómina de socios de "${name}"` : 'Exportó nómina de socios';
    case 'export_semester_changes':
      return name ? `Exportó cambios del período de "${name}"` : 'Exportó cambios del período';
    case 'export_election_results':
      return name ? `Exportó resultados de elección de "${name}"` : 'Exportó resultados de elección';
    case 'directorio_resignation':
      return log.details.outMember
        ? `Renuncia de ${log.details.outMember.name} (${log.details.outMember.cargo}) en "${name}"`
        : `Renuncia de directivo en "${name}"`;
    case 'organization_dissolution':
      return name ? `Disolvió la organización "${name}"` : 'Disolvió organización';
    case 'auto_anonymization':
      return `Anonimización automática por ${log.details.reason === 'inactive_3_years' ? 'inactividad (3 años)' : 'disolución (5 años)'}`;
    default:
      return null;
  }
}

export default function AuditLogView() {
  const addToast = useUiStore(s => s.addToast);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filters, setFilters] = useState({ action: '', resource: '', startDate: '', endDate: '', search: '' });

  const loadLogs = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', 20);
      if (filters.action) params.set('action', filters.action);
      if (filters.resource) params.set('resource', filters.resource);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.search) params.set('search', filters.search);

      const data = await apiService.get(`/audit-log?${params.toString()}`);
      setLogs(data.logs || data.entries || data || []);
      setTotalPages(data.totalPages || 1);
      setTotalRecords(data.total || 0);
      setCurrentPage(page);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadLogs(1); }, []);

  function applyFilters() { loadLogs(1); }

  function clearFilters() {
    setFilters({ action: '', resource: '', startDate: '', endDate: '', search: '' });
    loadLogs(1);
  }

  async function exportCSV() {
    try {
      const params = new URLSearchParams();
      if (filters.action) params.set('action', filters.action);
      if (filters.resource) params.set('resource', filters.resource);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.search) params.set('search', filters.search);
      params.set('format', 'csv');

      const data = await apiService.get(`/audit-log?${params.toString()}`);
      const entries = data.logs || data.entries || data || [];

      const BOM = '\uFEFF';
      const headers = ['Fecha/Hora', 'Usuario', 'Rol', 'Acción', 'Recurso', 'Nombre Recurso', 'Detalle'];
      const rows = entries.map(e => {
        const detailText = e.detail || generateFallbackDetail(e) || 'Sin detalle adicional';
        return [
          localeString(e.timestamp || e.createdAt),
          e.userName || '', ROLE_LABELS[e.userRole] || e.userRole || '',
          ACTION_LABELS[e.action] || e.action,
          RESOURCE_LABELS[e.resource] || e.resource,
          cleanResourceName(e.resourceName) || '', detailText
        ];
      });

      const csv = BOM + [headers, ...rows].map(r =>
        r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historial_auditoria_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('CSV exportado', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  const columns = [
    {
      key: 'timestamp', label: 'Fecha', sortable: true,
      render: (val, row) => (
        <span style={{ fontSize: 12 }}>
          {localeString(val || row.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      )
    },
    {
      key: 'userName', label: 'Usuario', hideOnTablet: true,
      render: (val, row) => (
        <div>
          <span style={{ fontSize: 13 }}>{val || 'Sistema'}</span>
          {row.userRole && (
            <span style={{
              marginLeft: 6, padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 500,
              background: '#f0f9ff', color: '#0369a1'
            }}>
              {ROLE_LABELS[row.userRole] || row.userRole}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'action', label: 'Evento',
      render: (val, row) => {
        const color = ACTION_COLORS[val] || '#6b7280';
        const resourceLabel = RESOURCE_LABELS[row.resource] || row.resource;
        return (
          <div>
            <span style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
              background: color + '15',
              color: color,
              whiteSpace: 'nowrap'
            }}>
              {ACTION_LABELS[val] || val}
            </span>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {resourceLabel}
            </div>
          </div>
        );
      }
    },
    {
      key: 'detail', label: 'Detalle',
      render: (val, row) => {
        const text = val || generateFallbackDetail(row) || 'Sin detalle adicional';
        const isNoDetail = text === 'Sin detalle adicional';
        return (
          <span style={{
            fontSize: 12,
            color: isNoDetail ? '#94a3b8' : '#374151',
            fontStyle: isNoDetail ? 'italic' : 'normal',
            lineHeight: 1.5,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}>
            {text}
          </span>
        );
      }
    }
  ];

  return (
    <div className="audit-log-page" style={{ padding: 24 }}>
      <div className="r-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' }}>Historial de Auditoría</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            {totalRecords} registros — Retención: 365 días
          </p>
        </div>
        <button onClick={exportCSV} style={{
          padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8,
          background: 'white', fontSize: 13, cursor: 'pointer'
        }}>Exportar CSV</button>
      </div>

      {/* Filters */}
      <div className="audit-filters" style={{
        background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12,
        alignItems: 'end', marginBottom: 20
      }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Acción</label>
          <select value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
            style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}>
            <option value="">Todas</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Recurso</label>
          <select value={filters.resource} onChange={e => setFilters(f => ({ ...f, resource: e.target.value }))}
            style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}>
            <option value="">Todos</option>
            {Object.entries(RESOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Desde</label>
          <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
            style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Hasta</label>
          <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
            style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Buscar</label>
          <input type="text" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            placeholder="Nombre de usuario o recurso..."
            style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
          <button onClick={applyFilters} style={{
            padding: '8px 16px', border: 'none', borderRadius: 6,
            background: '#2563eb', color: 'white', fontSize: 13, cursor: 'pointer', flex: 1
          }}>Filtrar</button>
          <button onClick={clearFilters} style={{
            padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6,
            background: 'white', fontSize: 13, cursor: 'pointer', flex: 1
          }}>Limpiar</button>
        </div>
      </div>

      {/* Table */}
      <div className="r-table-wrap" style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {isLoading ? <LoadingSpinner text="Cargando registros..." /> : (
          <DataTable columns={columns} data={logs} emptyMessage="Sin registros de auditoría" />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16, fontSize: 13, flexWrap: 'wrap' }}>
          <button onClick={() => loadLogs(currentPage - 1)} disabled={currentPage <= 1}
            style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: currentPage <= 1 ? 'default' : 'pointer', color: currentPage <= 1 ? '#9ca3af' : '#374151' }}>
            Anterior
          </button>
          <span>Página {currentPage} de {totalPages}</span>
          <button onClick={() => loadLogs(currentPage + 1)} disabled={currentPage >= totalPages}
            style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: currentPage >= totalPages ? 'default' : 'pointer', color: currentPage >= totalPages ? '#9ca3af' : '#374151' }}>
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
