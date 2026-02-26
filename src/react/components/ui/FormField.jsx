export default function FormField({ label, id, error, children, ...inputProps }) {
  // If children provided, render them instead of an input
  if (children) {
    return (
      <div className="form-group">
        {label && <label htmlFor={id}>{label}</label>}
        {children}
        {error && <div className="error-message show">{error}</div>}
      </div>
    );
  }

  return (
    <div className="form-group">
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        className={error ? 'error' : ''}
        {...inputProps}
      />
      {error && <div className="error-message show">{error}</div>}
    </div>
  );
}
