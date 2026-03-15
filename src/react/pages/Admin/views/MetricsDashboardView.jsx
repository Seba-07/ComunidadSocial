import { useState, useEffect } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { ORG_STATUS_LABELS, ORG_STATUS_COLORS } from '../../../utils/formatters';

const card = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20
};

export default function MetricsDashboardView() {
  const addToast = useUiStore(s => s.addToast);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  async function loadMetrics() {
    setIsLoading(true);
    try {
      const result = await apiService.getAdvancedMetrics();
      setData(result);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      await apiService.exportDashboardReport();
      addToast('Reporte exportado correctamente', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsExporting(false);
    }
  }

  useEffect(() => { loadMetrics(); }, []);

  if (isLoading) return <LoadingSpinner text="Cargando Centro de Comando..." />;
  if (!data) return <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>No se pudieron cargar las métricas</p>;

  const { kpis, legalAlerts, boardExpirations, upcomingAssemblies, orgTypes, byStatus, recentApplications, ministroLoad, resolutionTime, observationRate, upcomingElections } = data;

  const totalOrgTypes = orgTypes.reduce((sum, t) => sum + t.count, 0) || 1;
  const maxStatusCount = Math.max(...Object.values(byStatus || {}), 1);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div className="r-toolbar" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' }}>Centro de Comando</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Cumplimiento Ley 19.418 y gestión operativa</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadMetrics} style={{
            padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8,
            background: 'white', fontSize: 13, cursor: 'pointer'
          }}>Actualizar</button>
          <button onClick={handleExport} disabled={isExporting} style={{
            padding: '8px 16px', border: 'none', borderRadius: 8,
            background: '#059669', color: '#fff', fontSize: 13, cursor: 'pointer',
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
            opacity: isExporting ? 0.7 : 1
          }}>
            <span style={{ fontSize: 15 }}>📊</span>
            {isExporting ? 'Exportando...' : 'Exportar Reporte (CSV)'}
          </button>
        </div>
      </div>

      {/* ═══ FILA 1: Tarjetas de Alerta Crítica ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Trámites por Vencer */}
        <AlertCard
          icon="⚠️"
          label="Trámites por Vencer"
          sublabel="Alerta Legal (Art. 7)"
          value={kpis.legalAlertsCount}
          color={kpis.legalAlertsCount > 0 ? '#dc2626' : '#10b981'}
          bgColor={kpis.legalAlertsCount > 0 ? '#fef2f2' : '#f0fdf4'}
          borderColor={kpis.legalAlertsCount > 0 ? '#fecaca' : '#bbf7d0'}
        />
        {/* Directivas Vencidas */}
        <AlertCard
          icon="🔄"
          label="Directivas Vencidas"
          sublabel="Requieren elecciones"
          value={kpis.boardExpirationsCount}
          color={kpis.boardExpirationsCount > 0 ? '#ea580c' : '#10b981'}
          bgColor={kpis.boardExpirationsCount > 0 ? '#fff7ed' : '#f0fdf4'}
          borderColor={kpis.boardExpirationsCount > 0 ? '#fed7aa' : '#bbf7d0'}
        />
        {/* Asambleas Próximos 7 días */}
        <AlertCard
          icon="📅"
          label="Asambleas Próx. 7 días"
          sublabel="Gestión de terreno"
          value={kpis.upcomingAssembliesCount}
          color="#2563eb"
          bgColor="#eff6ff"
          borderColor="#bfdbfe"
        />
        {/* Total Aprobadas */}
        <AlertCard
          icon="✅"
          label="Total Aprobadas"
          sublabel={`${kpis.approvedThisMonth} este mes`}
          value={kpis.totalApproved}
          color="#059669"
          bgColor="#f0fdf4"
          borderColor="#bbf7d0"
        />
      </div>

      {/* ═══ FILA 1.5: Métricas Avanzadas de Gestión ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Tiempo Promedio de Resolución */}
        <AlertCard
          icon="⏱️"
          label="Tiempo de Resolución"
          sublabel={resolutionTime?.count > 0
            ? `Min: ${resolutionTime.min}d · Max: ${resolutionTime.max}d`
            : 'Sin datos suficientes'}
          value={resolutionTime?.avgDays > 0 ? `${resolutionTime.avgDays}d` : '—'}
          color="#7c3aed"
          bgColor="#f5f3ff"
          borderColor="#ddd6fe"
        />
        {/* Tasa de Observaciones */}
        <AlertCard
          icon="📋"
          label="Tasa de Observaciones"
          sublabel={observationRate?.total > 0
            ? `${observationRate.withObservations} con obs. · ${observationRate.directApproval} directo`
            : 'Sin trámites procesados'}
          value={observationRate?.total > 0 ? `${observationRate.rate}%` : '—'}
          color={observationRate?.rate > 50 ? '#dc2626' : '#059669'}
          bgColor={observationRate?.rate > 50 ? '#fef2f2' : '#f0fdf4'}
          borderColor={observationRate?.rate > 50 ? '#fecaca' : '#bbf7d0'}
        />
        {/* Elecciones/Asambleas próximos 15 días hábiles */}
        <AlertCard
          icon="🗳️"
          label="Elecciones 15 días háb."
          sublabel="Art. 10 — Ley 19.418"
          value={upcomingElections?.length || 0}
          color="#0284c7"
          bgColor="#f0f9ff"
          borderColor="#bae6fd"
        />
      </div>

      {/* ═══ FILA 2: Gráficos y Tablas ═══ */}
      <div className="r-grid-2" style={{ gap: 20, marginBottom: 24 }}>
        {/* Tipos de Organización (Dona visual) */}
        <div style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#111827' }}>Tipos de Organización</h3>
          {orgTypes.length > 0 ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {orgTypes.map((t, i) => {
                const pct = Math.round((t.count / totalOrgTypes) * 100);
                const colors = ['#2563eb', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#6366f1'];
                const color = colors[i % colors.length];
                return (
                  <div key={t.type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: '#374151' }}>{t.type}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color }}>{t.count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 5, background: color,
                        width: `${pct}%`, transition: 'width 0.4s'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: '#6b7280', textAlign: 'center', fontSize: 13 }}>Sin datos</p>
          )}

          {/* Status mini-distribution */}
          <h4 style={{ margin: '20px 0 10px', fontSize: 14, fontWeight: 600, color: '#374151' }}>Distribución por Estado</h4>
          <div style={{ display: 'grid', gap: 6 }}>
            {Object.entries(byStatus || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: ORG_STATUS_COLORS[status] || '#6b7280'
                }} />
                <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{ORG_STATUS_LABELS[status] || status}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Últimas Solicitudes Ingresadas */}
        <div style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#111827' }}>Últimas Solicitudes</h3>
          {recentApplications.length > 0 ? (
            <div style={{ display: 'grid', gap: 6, maxHeight: 420, overflow: 'auto' }}>
              {recentApplications.map(org => (
                <div key={org._id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: '#f9fafb', borderRadius: 8, fontSize: 13
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {org.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      {org.type} · {org.daysInSystem}d en sistema
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, flexShrink: 0,
                    background: (ORG_STATUS_COLORS[org.status] || '#6b7280') + '20',
                    color: ORG_STATUS_COLORS[org.status] || '#6b7280'
                  }}>
                    {ORG_STATUS_LABELS[org.status] || org.status}
                  </span>
                  <button
                    onClick={() => { window.location.href = `/app/admin?view=organizations&org=${org._id}`; }}
                    style={{
                      padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 6,
                      background: '#fff', fontSize: 11, cursor: 'pointer', color: '#2563eb',
                      fontWeight: 600, flexShrink: 0
                    }}
                  >
                    Revisar
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#6b7280', textAlign: 'center', fontSize: 13 }}>Sin solicitudes recientes</p>
          )}
        </div>
      </div>

      {/* ═══ FILA 3: Alertas Detalladas + Gestión de Equipo ═══ */}
      <div className="r-grid-2" style={{ gap: 20, marginBottom: 24 }}>
        {/* Alertas legales detalladas */}
        <div style={card}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: '#111827' }}>Alertas Legales (Art. 7)</h3>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>
            Organizaciones en revisión que se acercan al plazo legal de 30 días
          </p>
          {legalAlerts.length > 0 ? (
            <div style={{ display: 'grid', gap: 8, maxHeight: 300, overflow: 'auto' }}>
              {legalAlerts.map(alert => (
                <div key={alert._id} style={{
                  padding: '10px 12px', borderRadius: 8, fontSize: 13,
                  border: `1px solid ${alert.isOverdue ? '#fecaca' : '#fed7aa'}`,
                  background: alert.isOverdue ? '#fef2f2' : '#fffbeb'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{alert.name}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: alert.isOverdue ? '#dc2626' : '#f59e0b',
                      color: '#fff'
                    }}>
                      {alert.isOverdue ? `Vencido ${Math.abs(alert.daysRemaining)}d` : `${alert.daysRemaining}d restantes`}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                    {alert.type} · {alert.daysInReview} días en revisión
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <span style={{ fontSize: 32 }}>✅</span>
              <p style={{ color: '#059669', fontSize: 14, fontWeight: 600, margin: '8px 0 0' }}>Sin alertas legales</p>
              <p style={{ color: '#6b7280', fontSize: 12, margin: '4px 0 0' }}>Todos los trámites están dentro del plazo</p>
            </div>
          )}
        </div>

        {/* Carga de Ministros este mes */}
        <div style={card}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: '#111827' }}>Carga de Ministros de Fe</h3>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>
            Asambleas asignadas este mes · {kpis.activeMinistros}/{kpis.totalMinistros} activos
          </p>
          {ministroLoad.length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {ministroLoad.map((m, i) => {
                const maxLoad = Math.max(...ministroLoad.map(x => x.total), 1);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 12px', background: '#f9fafb', borderRadius: 8
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: '#2563eb', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 13, flexShrink: 0
                    }}>
                      {m.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{m.name}</div>
                      <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          background: `linear-gradient(90deg, #10b981 0%, #10b981 ${(m.completed / m.total) * 100}%, #f59e0b ${(m.completed / m.total) * 100}%)`,
                          width: `${(m.total / maxLoad) * 100}%`,
                          transition: 'width 0.3s'
                        }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{m.total}</div>
                      <div style={{ fontSize: 10, color: '#6b7280' }}>
                        {m.completed} comp · {m.pending} pend
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: '#6b7280', textAlign: 'center', fontSize: 13 }}>Sin asignaciones este mes</p>
          )}
        </div>
      </div>

      {/* ═══ FILA 4: Directivas Vencidas + Asambleas Próximas ═══ */}
      <div className="r-grid-2" style={{ gap: 20 }}>
        {/* Directivas Vencidas */}
        <div style={card}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: '#111827' }}>Directivas Vencidas</h3>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>
            Organizaciones con directorio de más de 2 años (Art. 24)
          </p>
          {boardExpirations.length > 0 ? (
            <div style={{ display: 'grid', gap: 6, maxHeight: 250, overflow: 'auto' }}>
              {boardExpirations.map(org => (
                <div key={org._id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: '#fff7ed', border: '1px solid #fed7aa',
                  borderRadius: 8, fontSize: 13
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{org.name}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      Aprobada: {org.approvalDate} · Venció: {org.expirationDate}
                    </div>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    background: '#ea580c', color: '#fff', flexShrink: 0
                  }}>
                    {org.daysExpired}d vencida
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <span style={{ fontSize: 32 }}>✅</span>
              <p style={{ color: '#059669', fontSize: 14, fontWeight: 600, margin: '8px 0 0' }}>Todas las directivas vigentes</p>
            </div>
          )}
        </div>

        {/* Asambleas Próximos 7 días */}
        <div style={card}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: '#111827' }}>Asambleas Próximos 7 Días</h3>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>
            Agenda de terreno para la semana
          </p>
          {upcomingAssemblies.length > 0 ? (
            <div style={{ display: 'grid', gap: 6, maxHeight: 250, overflow: 'auto' }}>
              {upcomingAssemblies.map(a => (
                <div key={a._id} style={{
                  padding: '10px 12px', background: '#eff6ff', border: '1px solid #bfdbfe',
                  borderRadius: 8, fontSize: 13
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{a.orgName}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#2563eb' }}>
                      {new Date(a.date).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })} {a.time}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                    MF: {a.ministro}{a.location ? ` · ${a.location}` : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <span style={{ fontSize: 32 }}>📋</span>
              <p style={{ color: '#6b7280', fontSize: 14, margin: '8px 0 0' }}>Sin asambleas programadas esta semana</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertCard({ icon, label, sublabel, value, color, bgColor, borderColor }) {
  return (
    <div style={{
      background: bgColor, border: `2px solid ${borderColor}`, borderRadius: 14,
      padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14
    }}>
      <span style={{ fontSize: 28, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginTop: 4 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{sublabel}</div>}
      </div>
    </div>
  );
}
