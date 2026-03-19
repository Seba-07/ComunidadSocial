import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';

const TYPE_LABELS = {
  JUNTA_VECINOS: 'Juntas de Vecinos',
  CLUB_DEPORTIVO: 'Clubes Deportivos',
  CLUB_ADULTO_MAYOR: 'Adulto Mayor',
  CLUB_JUVENIL: 'Clubes Juveniles',
  CLUB_CULTURAL: 'Clubes Culturales',
  CENTRO_MADRES: 'Centros de Madres',
  CENTRO_PADRES: 'Centros de Padres',
  CENTRO_CULTURAL: 'Centros Culturales',
  COMITE_VIVIENDA: 'Com. Vivienda',
  COMITE_ALLEGADOS: 'Com. Allegados',
  COMITE_APR: 'Com. APR',
  COMITE_ADELANTO: 'Com. Adelanto',
  COMITE_VECINOS: 'Com. Vecinos',
  ORG_COMUNITARIA: 'Org. Comunitaria',
  ORG_FUNCIONAL: 'Org. Funcional',
  ORG_SOCIAL: 'Org. Social',
  ORG_CULTURAL: 'Org. Cultural',
  ORG_MUJERES: 'Org. Mujeres',
  AGRUPACION_FOLCLORICA: 'Ag. Folclórica',
  AGRUPACION_CULTURAL: 'Ag. Cultural',
  AGRUPACION_JUVENIL: 'Ag. Juvenil',
  AGRUPACION_AMBIENTAL: 'Ag. Ambiental',
  AGRUPACION_EMPRENDEDORES: 'Ag. Emprendedores',
  CONDOMINIO: 'Condominios',
  FUNDACION: 'Fundaciones',
  CORPORACION: 'Corporaciones'
};

const PIE_COLORS = [
  '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#be185d', '#4f46e5', '#ea580c', '#65a30d',
  '#0d9488', '#a21caf', '#ca8a04', '#4338ca', '#e11d48'
];

const BOARD_STATUS_LABELS = {
  VIGENTE: 'Vigentes',
  VENCIDA: 'Vencidas',
  EN_PROCESO_ELECTORAL: 'En Proceso Electoral',
  PENDIENTE_VALIDACION: 'Pend. Validación'
};

const BOARD_STATUS_COLORS = {
  VIGENTE: '#059669',
  VENCIDA: '#dc2626',
  EN_PROCESO_ELECTORAL: '#d97706',
  PENDIENTE_VALIDACION: '#7c3aed'
};

const ATTENTION_LIMIT = 20;

function shortLabel(type) {
  return TYPE_LABELS[type] || type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Otro';
}

// --- Skeleton Loader ---
function SkeletonBlock({ width, height, borderRadius = 8, style }) {
  return (
    <div style={{
      width, height, borderRadius, background: '#e5e7eb',
      position: 'relative', overflow: 'hidden', ...style
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
        animation: 'shimmer 2s infinite'
      }} />
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div style={{ padding: 24 }} aria-busy="true" aria-label="Cargando centro de mando">
      <SkeletonBlock width={220} height={32} style={{ marginBottom: 24 }} />
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ background: '#f9fafb', border: '2px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <SkeletonBlock width={36} height={36} borderRadius={8} />
              <SkeletonBlock width={120} height={14} />
            </div>
            <SkeletonBlock width={80} height={32} />
          </div>
        ))}
      </div>
      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, marginBottom: 32 }}>
        {[1, 2].map(i => (
          <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
            <SkeletonBlock width={180} height={18} style={{ marginBottom: 16 }} />
            <SkeletonBlock width="100%" height={260} borderRadius={12} />
          </div>
        ))}
      </div>
      {/* Table */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
        <SkeletonBlock width={200} height={18} style={{ marginBottom: 16 }} />
        {[1, 2, 3].map(i => (
          <SkeletonBlock key={i} width="100%" height={44} style={{ marginBottom: 8 }} />
        ))}
      </div>
    </div>
  );
}

// --- CSV Export ---
function exportAttentionCSV(attentionOrgs) {
  const header = 'Organización,Tipo,Estado Directorio,Vencimiento';
  const rows = attentionOrgs.map(org => {
    const name = (org.name || '').replace(/,/g, ' ');
    const type = shortLabel(org.type).replace(/,/g, ' ');
    const status = BOARD_STATUS_LABELS[org.boardStatus] || org.boardStatus || '';
    const date = org.boardExpirationDate
      ? new Date(org.boardExpirationDate).toLocaleDateString('es-CL')
      : 'No definida';
    return `${name},${type},${status},${date}`;
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `organizaciones_atencion_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- Main Component ---
export default function AdminOverviewView({ onViewChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const addToast = useUiStore(s => s.addToast);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getAdminOverviewStats();
      setData(res);
    } catch (err) {
      setError(err.message);
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <OverviewSkeleton />;

  if (error || !data) {
    return (
      <div role="alert" style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ fontSize: 40, margin: '0 0 12px' }}>⚠️</p>
        <p style={{ fontSize: 16, color: '#374151', fontWeight: 600, margin: '0 0 8px' }}>
          No se pudo cargar el Centro de Mando
        </p>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px' }}>
          {error || 'Respuesta vacía del servidor'}
        </p>
        <button
          onClick={loadData}
          className="btn-auth"
          style={{ maxWidth: 180, margin: '0 auto' }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  const { totalOrganizations, totalMembers, organizationsByType, organizationsByBoardStatus, attentionOrgs } = data;

  const vencidas = organizationsByBoardStatus?.VENCIDA || 0;
  const enProceso = organizationsByBoardStatus?.EN_PROCESO_ELECTORAL || 0;
  const pendValidacion = organizationsByBoardStatus?.PENDIENTE_VALIDACION || 0;

  const pieData = (organizationsByType || [])
    .filter(t => t.count > 0)
    .map(t => ({ name: shortLabel(t.type), value: t.count }));

  const barData = Object.entries(organizationsByBoardStatus || {})
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: BOARD_STATUS_LABELS[key] || key,
      cantidad: value,
      fill: BOARD_STATUS_COLORS[key] || '#6b7280'
    }));

  return (
    <div style={{ padding: 24 }} role="region" aria-label="Centro de Mando">
      {/* Header with refresh */}
      <div className="responsive-flex-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 24px)', fontWeight: 700, color: '#111827' }}>
          Centro de Mando
        </h1>
        <button
          onClick={loadData}
          aria-label="Actualizar datos"
          title="Actualizar datos"
          style={{
            padding: '6px 14px', fontSize: 13, fontWeight: 500, border: '1px solid #d1d5db',
            borderRadius: 8, background: 'white', color: '#374151', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
          }}
        >
          🔄 Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div role="region" aria-label="Indicadores clave" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <KpiCard icon="🏢" label="Total Organizaciones" value={totalOrganizations} color="#2563eb" bg="#eff6ff" border="#bfdbfe" />
        <KpiCard icon="👥" label="Vecinos Afiliados" value={totalMembers} color="#059669" bg="#ecfdf5" border="#a7f3d0" />
        <KpiCard icon="⚠️" label="Directivas Vencidas" value={vencidas} color="#dc2626" bg="#fef2f2" border="#fecaca" alert={vencidas > 0} />
        <KpiCard icon="🗳️" label="Elecciones en Curso" value={enProceso + pendValidacion} color="#7c3aed" bg="#f5f3ff" border="#c4b5fd" subtitle={pendValidacion > 0 ? `${pendValidacion} por validar` : null} />
      </div>

      {/* Charts Row */}
      <div role="region" aria-label="Gráficos" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 32 }}>
        {/* Pie Chart */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 'clamp(16px, 3vw, 24px)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 'clamp(14px, 2.5vw, 16px)', fontWeight: 600, color: '#111827' }}>
            Distribución por Tipo
          </h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData} cx="50%" cy="50%"
                    innerRadius="35%" outerRadius="65%"
                    paddingAngle={2} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => [`${val} org.`, 'Cantidad']} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend — grid for mobile-friendly wrap */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '6px 12px', marginTop: 12
              }}>
                {pieData.map((d, i) => (
                  <span key={d.name} style={{ fontSize: 'clamp(10px, 1.8vw, 12px)', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.name} ({d.value})
                    </span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
              Sin datos
            </div>
          )}
        </div>

        {/* Bar Chart */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 'clamp(16px, 3vw, 24px)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 'clamp(14px, 2.5vw, 16px)', fontWeight: 600, color: '#111827' }}>
            Estado de Directorios
          </h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(val) => [`${val}`, 'Organizaciones']} />
                <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
              Sin datos
            </div>
          )}
        </div>
      </div>

      {/* Attention List */}
      <div role="region" aria-label="Organizaciones que requieren atención" style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 'clamp(16px, 3vw, 24px)' }}>
        <div className="responsive-flex-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 'clamp(14px, 2.5vw, 16px)', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
            🚨 Requieren Atención
            {attentionOrgs.length > 0 && (
              <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>
                {attentionOrgs.length}
              </span>
            )}
          </h3>
          {attentionOrgs.length > 0 && (
            <button
              onClick={() => exportAttentionCSV(attentionOrgs)}
              aria-label="Exportar lista de atención a CSV"
              style={{
                padding: '5px 12px', fontSize: 12, fontWeight: 500, border: '1px solid #d1d5db',
                borderRadius: 6, background: 'white', color: '#374151', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
              }}
            >
              📥 Exportar CSV
            </button>
          )}
        </div>

        {attentionOrgs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>
            <p style={{ fontSize: 32, margin: '0 0 8px' }}>✅</p>
            <p style={{ fontSize: 14 }}>No hay organizaciones que requieran atención inmediata</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'clamp(12px, 2vw, 14px)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th scope="col" style={thStyle}>Organización</th>
                  <th scope="col" style={thStyle}>Tipo</th>
                  <th scope="col" style={thStyle}>Estado</th>
                  <th scope="col" style={thStyle}>Vencimiento</th>
                  <th scope="col" style={{ ...thStyle, textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {attentionOrgs.map(org => (
                  <AttentionRow key={org._id} org={org} onViewChange={onViewChange} />
                ))}
              </tbody>
            </table>
            {attentionOrgs.length >= ATTENTION_LIMIT && (
              <div style={{ textAlign: 'center', padding: '12px 16px', background: '#fef3c7', borderRadius: '0 0 8px 8px', fontSize: 13, color: '#92400e', marginTop: 8 }}>
                Mostrando las primeras {ATTENTION_LIMIT} organizaciones. Exporte a CSV para el listado completo.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: 'left', padding: '10px 12px', color: '#6b7280',
  fontWeight: 600, fontSize: 'clamp(10px, 1.8vw, 12px)', textTransform: 'uppercase', whiteSpace: 'nowrap'
};

// Touch-friendly row: button always visible, no hover dependency
function AttentionRow({ org, onViewChange }) {
  const statusColor = BOARD_STATUS_COLORS[org.boardStatus] || '#6b7280';
  const statusLabel = BOARD_STATUS_LABELS[org.boardStatus] || org.boardStatus;
  const expDate = org.boardExpirationDate
    ? new Date(org.boardExpirationDate).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'No definida';

  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ padding: '12px', fontWeight: 600, color: '#111827', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {org.name}
      </td>
      <td style={{ padding: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{shortLabel(org.type)}</td>
      <td style={{ padding: '12px' }}>
        <span style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 700, whiteSpace: 'nowrap',
          color: statusColor, background: `${statusColor}15`, border: `1px solid ${statusColor}40`
        }}>
          {statusLabel}
        </span>
      </td>
      <td style={{ padding: '12px', color: '#6b7280', fontSize: 13, whiteSpace: 'nowrap' }}>{expDate}</td>
      <td style={{ padding: '12px', textAlign: 'center' }}>
        <button
          onClick={() => onViewChange && onViewChange('organizations')}
          aria-label={`Ver organización ${org.name}`}
          style={{
            padding: '5px 14px', fontSize: 12, fontWeight: 600, border: '1px solid #d1d5db',
            borderRadius: 6, background: 'white', color: '#374151', cursor: 'pointer'
          }}
        >
          Ver
        </button>
      </td>
    </tr>
  );
}

function KpiCard({ icon, label, value, color, bg, border, alert, subtitle }) {
  return (
    <div style={{
      background: bg, border: `2px solid ${border}`, borderRadius: 12, padding: 'clamp(14px, 2.5vw, 20px)',
      transition: 'transform 0.15s',
      animation: alert ? 'pulse-badge 2s infinite' : 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 'clamp(22px, 4vw, 28px)' }}>{icon}</span>
        <span style={{ fontSize: 'clamp(11px, 2vw, 13px)', color: '#6b7280', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 800, color }}>{value.toLocaleString('es-CL')}</div>
      {subtitle && (
        <div style={{ fontSize: 'clamp(10px, 1.8vw, 12px)', color, fontWeight: 600, marginTop: 4 }}>{subtitle}</div>
      )}
    </div>
  );
}
