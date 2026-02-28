export default function ProgressBar({ steps, currentStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 8px' }}>
      {steps.map((step, i) => {
        const isComplete = i < currentStep;
        const isCurrent = i === currentStep;
        const isLast = i === steps.length - 1;

        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 32 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600,
                background: isComplete ? '#2563eb' : isCurrent ? '#2563eb' : '#e5e7eb',
                color: isComplete || isCurrent ? 'white' : '#6b7280',
                border: isCurrent ? '3px solid #93c5fd' : 'none',
                transition: 'all 0.2s'
              }}>
                {isComplete ? '\u2713' : i + 1}
              </div>
              <span style={{
                fontSize: 11, color: isCurrent ? '#2563eb' : '#6b7280',
                fontWeight: isCurrent ? 600 : 400,
                marginTop: 4, textAlign: 'center', whiteSpace: 'nowrap'
              }}>
                {step}
              </span>
            </div>
            {!isLast && (
              <div style={{
                flex: 1, height: 2, marginBottom: 20,
                background: isComplete ? '#2563eb' : '#e5e7eb',
                marginLeft: 4, marginRight: 4,
                transition: 'background 0.2s'
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
