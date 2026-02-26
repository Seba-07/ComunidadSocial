import { ORG_STATUS_LABELS, ORG_STATUS_COLORS } from '../../utils/formatters';

export default function StatusBadge({ status }) {
  const label = ORG_STATUS_LABELS[status] || status;
  const color = ORG_STATUS_COLORS[status] || '#6b7280';

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        color: 'white',
        background: color
      }}
    >
      {label}
    </span>
  );
}
