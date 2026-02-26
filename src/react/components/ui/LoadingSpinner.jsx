export default function LoadingSpinner({ text = 'Cargando...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 16 }}>
      <div className="spinner" />
      {text && <p style={{ color: '#6b7280', fontSize: 14 }}>{text}</p>}
    </div>
  );
}
