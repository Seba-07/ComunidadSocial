import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import DataTable from '../../../components/ui/DataTable';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

const ACTION_LABELS = {
  CREATE: 'Crear', UPDATE: 'Actualizar', DELETE: 'Eliminar',
  STATUS_CHANGE: 'Cambio Estado', LOGIN: 'Inicio Sesión',
  LOGOUT: 'Cierre Sesión', ASSIGN: 'Asignar', VALIDATE: 'Validar'
};

const ACTION_COLORS = {
  CREATE: '#10b981', UPDATE: '#2563eb', DELETE: '#ef4444',
  STATUS_CHANGE: '#8b5cf6', LOGIN: '#06b6d4', ASSIGN: '#f59e0b', VALIDATE: '#22c55e'
};

const RESOURCE_LABELS = {
  ORGANIZATION: 'Organización', USER: 'Usuario', MINISTRO: 'Ministro',
  ASSIGNMENT: 'Asignación', NEWS: 'Noticia', DOCUMENT: 'Documento', ESTATUTO: 'Estatuto'
};

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

      // Build CSV
      const BOM = '\uFEFF';
      const headers = ['Fecha/Hora', 'Usuario', 'Rol', 'Acción', 'Recurso', 'Nombre Recurso', 'Detalle'];
      const rows = entries.map(e => [
        new Date(e.timestamp || e.createdAt).toLocaleString('es-CL'),
        e.userName || '', e.userRole || '',
        ACTION_LABELS[e.action] || e.action,
        RESOURCE_LABELS[e.resource] || e.resource,
        e.resourceName || '', e.detail || ''
      ]);

      const csv = BOM + [headers, ...rows].map(r =>
        r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
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
      render: (val, row) => {
        const d = new Date(val || row.createdAt);
        return <span style={{ fontSize: 12 }}>{d.toLocaleDateString('es-CL')} {d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>;
      }
    },
    {
      key: 'userName', label: 'Usuario', hideOnTablet: true,
      render: (val, row) => (
        <div>
          <span style={{ fontSize: 13 }}>{val || 'Sistema'}</span>
          {row.userRole && (
            <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 8, fontSize: 10, background: '#f3f4f6', color: '#6b7280' }}>
              {row.userRole}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'action', label: 'Acción',
      render: (val) => (
        <span style={{
          padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
          background: (ACTION_COLORS[val] || '#6b7280') + '20',
          color: ACTION_COLORS[val] || '#6b7280'
        }}>
          {ACTION_LABELS[val] || val}
        </span>
      )
    },
    {
      key: 'resource', label: 'Recurso',
      render: (val, row) => (
        <span style={{ fontSize: 13 }}>
          {RESOURCE_LABELS[val] || val}{row.resourceName ? `: ${row.resourceName}` : ''}
        </span>
      )
    },
    {
      key: 'detail', label: 'Detalle', hideOnMobile: true,
      render: (val) => (
        <span style={{ fontSize: 12, color: '#6b7280', maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {val || '-'}
        </span>
      )
    }
  ];

  return (
    <div className="audit-log-page" style={{ padding: 24 }}>
      <div className="r-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' }}>Historial de Auditoría</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{totalRecords} registros</p>
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
            placeholder="Nombre usuario/recurso..."
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
