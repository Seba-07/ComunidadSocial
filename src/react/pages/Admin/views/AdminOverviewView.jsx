import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

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

export default function AdminOverviewView({ onViewChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const addToast = useUiStore(s => s.addToast);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await apiService.getAdminOverviewStats();
      setData(res);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner text="Cargando centro de mando..." />;
  if (!data) return <p style={{ padding: 24, color: '#6b7280' }}>No se pudieron cargar los datos.</p>;

  const { totalOrganizations, totalMembers, organizationsByType, organizationsByBoardStatus, attentionOrgs } = data;

  const vencidas = organizationsByBoardStatus?.VENCIDA || 0;
  const enProceso = organizationsByBoardStatus?.EN_PROCESO_ELECTORAL || 0;
  const pendValidacion = organizationsByBoardStatus?.PENDIENTE_VALIDACION || 0;

  // Pie chart data
  const pieData = (organizationsByType || [])
    .filter(t => t.count > 0)
    .map(t => ({ name: shortLabel(t.type), value: t.count }));

  // Bar chart data — Fix #2: filtrar barras con valor 0
  const barData = Object.entries(organizationsByBoardStatus || {})
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: BOARD_STATUS_LABELS[key] || key,
      cantidad: value,
      fill: BOARD_STATUS_COLORS[key] || '#6b7280'
    }));

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 700, color: '#111827' }}>
        Centro de Mando
      </h1>

      {/* KPI Cards — Fix #6: emojis directos en vez de escape unicode */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <KpiCard
          icon="🏢" label="Total Organizaciones"
          value={totalOrganizations} color="#2563eb" bg="#eff6ff" border="#bfdbfe"
        />
        <KpiCard
          icon="👥" label="Vecinos Afiliados"
          value={totalMembers} color="#059669" bg="#ecfdf5" border="#a7f3d0"
        />
        <KpiCard
          icon="⚠️" label="Directivas Vencidas"
          value={vencidas} color="#dc2626" bg="#fef2f2" border="#fecaca"
          alert={vencidas > 0}
        />
        <KpiCard
          icon="🗳️" label="Elecciones en Curso"
          value={enProceso + pendValidacion} color="#7c3aed" bg="#f5f3ff" border="#c4b5fd"
          subtitle={pendValidacion > 0 ? `${pendValidacion} por validar` : null}
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, marginBottom: 32 }}>
        {/* Pie Chart — Distribution by Type */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#111827' }}>
            Distribución por Tipo
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
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
          ) : (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
              Sin datos
            </div>
          )}
          {/* Legend below chart */}
          {pieData.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center' }}>
              {pieData.map((d, i) => (
                <span key={d.name} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                  {d.name} ({d.value})
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bar Chart — Board Status */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#111827' }}>
            Estado de Directorios
          </h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
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
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
              Sin datos
            </div>
          )}
        </div>
      </div>

      {/* Attention List */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
          🚨 Requieren Atención
          {attentionOrgs.length > 0 && (
            <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>
              {attentionOrgs.length}
            </span>
          )}
        </h3>

        {attentionOrgs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>
            <p style={{ fontSize: 32, margin: '0 0 8px' }}>✅</p>
            <p style={{ fontSize: 14 }}>No hay organizaciones que requieran atención inmediata</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th scope="col" style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Organización</th>
                  <th scope="col" style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Tipo</th>
                  <th scope="col" style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Estado</th>
                  <th scope="col" style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Vencimiento</th>
                  <th scope="col" style={{ textAlign: 'center', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {attentionOrgs.map(org => {
                  const statusColor = BOARD_STATUS_COLORS[org.boardStatus] || '#6b7280';
                  const statusLabel = BOARD_STATUS_LABELS[org.boardStatus] || org.boardStatus;
                  // Fix #13: null check en fecha
                  const expDate = org.boardExpirationDate
                    ? new Date(org.boardExpirationDate).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' })
                    : 'No definida';
                  return (
                    <tr key={org._id} style={{ borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#111827', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</td>
                      <td style={{ padding: '12px', color: '#6b7280' }}>{shortLabel(org.type)}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 700,
                          color: statusColor, background: `${statusColor}15`, border: `1px solid ${statusColor}40`
                        }}>
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#6b7280', fontSize: 13 }}>{expDate}</td>
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
                })}
              </tbody>
            </table>
            {/* Fix #5: mensaje cuando se alcanza el límite */}
            {attentionOrgs.length >= ATTENTION_LIMIT && (
              <div style={{ textAlign: 'center', padding: '12px 16px', background: '#fef3c7', borderRadius: '0 0 8px 8px', fontSize: 13, color: '#92400e', marginTop: 8 }}>
                Mostrando las primeras {ATTENTION_LIMIT} organizaciones. Por favor, exporte a CSV para el listado completo.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Fix #1: usar pulse-badge (definida en CSS) en vez de pulse (no existe)
function KpiCard({ icon, label, value, color, bg, border, alert, subtitle }) {
  return (
    <div style={{
      background: bg, border: `2px solid ${border}`, borderRadius: 12, padding: 20,
      transition: 'transform 0.15s',
      animation: alert ? 'pulse-badge 2s infinite' : 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 28 }}>{icon}</span>
        <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color }}>{value.toLocaleString('es-CL')}</div>
      {subtitle && (
        <div style={{ fontSize: 12, color, fontWeight: 600, marginTop: 4 }}>{subtitle}</div>
      )}
    </div>
  );
}
