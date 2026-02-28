export default function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      borderBottom: '2px solid #e5e7eb',
      overflowX: 'auto',
      paddingBottom: 0
    }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              padding: '10px 18px',
              border: 'none',
              borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
              background: 'none',
              color: isActive ? '#2563eb' : '#6b7280',
              fontWeight: isActive ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginBottom: -2,
              transition: 'color 0.15s, border-color 0.15s'
            }}
          >
            {tab.icon && <span style={{ marginRight: 6 }}>{tab.icon}</span>}
            {tab.label}
            {tab.count != null && (
              <span style={{
                marginLeft: 6,
                background: isActive ? '#2563eb' : '#e5e7eb',
                color: isActive ? 'white' : '#6b7280',
                padding: '2px 7px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 600
              }}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
