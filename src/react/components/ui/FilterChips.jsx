export default function FilterChips({ filters, active, onChange }) {
  return (
    <div className="filter-chips" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {filters.map(f => {
        const isActive = active === f.key;
        return (
          <button
            key={f.key}
            onClick={() => onChange(f.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: isActive ? '1px solid #2563eb' : '1px solid #d1d5db',
              background: isActive ? '#2563eb' : 'white',
              color: isActive ? 'white' : '#374151',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s'
            }}
          >
            {f.color && (
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: isActive ? 'white' : f.color,
                display: 'inline-block'
              }} />
            )}
            {f.label}
            {f.count != null && (
              <span style={{
                background: isActive ? 'rgba(255,255,255,0.25)' : '#f3f4f6',
                padding: '1px 6px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600
              }}>
                {f.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
