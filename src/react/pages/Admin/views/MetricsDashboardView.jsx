import { useState, useEffect } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import StatsGrid from '../../../components/ui/StatsGrid';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { ORG_STATUS_LABELS, ORG_STATUS_COLORS } from '../../../utils/formatters';

export default function MetricsDashboardView() {
  const addToast = useUiStore(s => s.addToast);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadStats() {
    setIsLoading(true);
    try {
      const data = await apiService.getOrganizationStats();
      setStats(data.stats || data);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadStats(); }, []);

  if (isLoading) return <LoadingSpinner text="Cargando métricas..." />;
  if (!stats) return <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>No se pudieron cargar las métricas</p>;

  const orgStats = stats.organizations || stats;
  const byStatus = orgStats.byStatus || {};
  const ministroStats = stats.ministros || {};
  const userStats = stats.users || {};
  const timeline = stats.timeline || [];

  const kpis = [
    { icon: '\uD83C\uDFE2', label: 'Total Organizaciones', value: orgStats.total || 0, color: '#2563eb' },
    { icon: '\u2705', label: 'Aprobadas este mes', value: orgStats.approvedThisMonth || 0, color: '#10b981',
      trend: orgStats.approvedLastMonth ? Math.round(((orgStats.approvedThisMonth - orgStats.approvedLastMonth) / orgStats.approvedLastMonth) * 100) : undefined },
    { icon: '\u23F1\uFE0F', label: 'Días promedio proceso', value: orgStats.avgProcessingDays || '-', color: '#f59e0b' },
    { icon: '\uD83D\uDC64', label: 'Ministros Activos', value: `${ministroStats.active || 0}/${ministroStats.total || 0}`, color: '#8b5cf6' }
  ];

  const maxStatusCount = Math.max(...Object.values(byStatus), 1);

  return (
    <div style={{ padding: 24 }}>
      <div className="r-toolbar" style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' }}>Métricas</h1>
        <button onClick={loadStats} style={{
          padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8,
          background: 'white', fontSize: 13, cursor: 'pointer'
        }}>Actualizar</button>
      </div>

      <StatsGrid stats={kpis} />

      {/* Status Distribution */}
      <div className="r-grid-2" style={{ gap: 20, marginTop: 24 }}>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Distribución por Estado</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {Object.entries(byStatus).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <div key={status}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#374151' }}>{ORG_STATUS_LABELS[status] || status}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{count}</span>
                </div>
                <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4, transition: 'width 0.3s',
                    width: `${(count / maxStatusCount) * 100}%`,
                    background: ORG_STATUS_COLORS[status] || '#6b7280'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Actividad Mensual</h3>
          {timeline.length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {timeline.slice(-6).map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#6b7280', width: 80 }}>{m.month}</span>
                  <div style={{ flex: 1, display: 'flex', gap: 4, height: 20 }}>
                    {m.created > 0 && <div style={{ background: '#2563eb', borderRadius: 3, flex: m.created, minWidth: 2 }} title={`Creadas: ${m.created}`} />}
                    {m.approved > 0 && <div style={{ background: '#10b981', borderRadius: 3, flex: m.approved, minWidth: 2 }} title={`Aprobadas: ${m.approved}`} />}
                    {m.rejected > 0 && <div style={{ background: '#ef4444', borderRadius: 3, flex: m.rejected, minWidth: 2 }} title={`Rechazadas: ${m.rejected}`} />}
                  </div>
                  <span style={{ fontSize: 11, color: '#6b7280', width: 60, textAlign: 'right' }}>
                    {(m.created || 0) + (m.approved || 0) + (m.rejected || 0)}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#2563eb' }} /> Creadas
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981' }} /> Aprobadas
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444' }} /> Rechazadas
                </span>
              </div>
            </div>
          ) : (
            <p style={{ color: '#6b7280', textAlign: 'center', fontSize: 14 }}>Sin datos de timeline</p>
          )}
        </div>
      </div>

      {/* Ministro Load + User Stats */}
      <div className="r-grid-2" style={{ gap: 20, marginTop: 20 }}>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Carga de Ministros</h3>
          {(ministroStats.loadByMinistro || []).length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {ministroStats.loadByMinistro.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, flex: 1 }}>{m.name}</span>
                  <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>{m.pending} pend.</span>
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>{m.completed} comp.</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#6b7280', textAlign: 'center', fontSize: 14 }}>Sin datos</p>
          )}
        </div>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Usuarios</h3>
          <StatsGrid stats={[
            { icon: '\uD83D\uDC65', label: 'Total', value: userStats.total || 0, color: '#2563eb' },
            { icon: '\uD83D\uDCDD', label: 'Organizadores', value: userStats.organizers || 0, color: '#3b82f6' },
            { icon: '\uD83D\uDC64', label: 'Miembros', value: userStats.members || 0, color: '#22c55e' },
            { icon: '\u2795', label: 'Nuevos (mes)', value: userStats.registeredThisMonth || 0, color: '#f59e0b' }
          ]} />
        </div>
      </div>
    </div>
  );
}
