const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'rgba(0, 0, 0, 0.5)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const cardStyle = {
  maxHeight: '90vh',
  overflowY: 'auto',
  background: 'white',
  borderRadius: 24,
  padding: 48,
  width: '90%',
  maxWidth: 500,
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 24
};

const titleStyle = {
  margin: 0,
  color: '#2563eb',
  fontSize: 28,
  fontWeight: 700
};

const closeStyle = {
  background: 'none',
  border: 'none',
  fontSize: 32,
  color: '#6b7280',
  cursor: 'pointer',
  lineHeight: 1
};

export default function Modal({ open, onClose, title, children }) {
  if (!open) return null;

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>{title}</h3>
          <button style={closeStyle} onClick={onClose}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}
