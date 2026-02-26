export default function Card({ children, className = '', glass, style, ...props }) {
  const cls = glass ? `glass-card ${className}` : `card ${className}`;
  return (
    <div className={cls.trim()} style={style} {...props}>
      {children}
    </div>
  );
}
