export default function StatsGrid({ stats }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 16
    }}>
      {stats.map((stat, i) => (
        <div key={i} style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 14
        }}>
          {stat.icon && (
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: (stat.color || '#2563eb') + '15',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0
            }}>
              {stat.icon}
            </div>
          )}
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {stat.label}
            </div>
            {stat.trend && (
              <div style={{
                fontSize: 11, marginTop: 2,
                color: stat.trend > 0 ? '#10b981' : stat.trend < 0 ? '#ef4444' : '#6b7280'
              }}>
                {stat.trend > 0 ? '+' : ''}{stat.trend}%
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
