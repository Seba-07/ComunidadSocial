import { useState, useMemo, useEffect } from 'react';

export default function DataTable({ columns, data, emptyMessage = 'Sin datos', pageSize = 20 }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(0);

  // Reset to page 0 when data changes
  useEffect(() => {
    setCurrentPage(0);
  }, [data.length]);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginatedData = sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const showPagination = data.length > pageSize;

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  if (!data || data.length === 0) {
    return <p style={{ color: '#6b7280', textAlign: 'center', padding: 24 }}>{emptyMessage}</p>;
  }

  return (
    <div className="r-table-wrap">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable !== false && handleSort(col.key)}
                className={col.hideOnMobile ? 'r-hide-mobile' : col.hideOnTablet ? 'r-hide-tablet' : ''}
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  borderBottom: '2px solid #e5e7eb',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#374151',
                  cursor: col.sortable !== false ? 'pointer' : 'default',
                  userSelect: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                {col.label}
                {sortKey === col.key && (sortDir === 'asc' ? ' ▲' : ' ▼')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row, i) => (
            <tr key={row._id || row.id || i} style={{ borderBottom: '1px solid #f3f4f6' }}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={col.hideOnMobile ? 'r-hide-mobile' : col.hideOnTablet ? 'r-hide-tablet' : ''}
                  style={{ padding: '12px 16px', fontSize: 14, color: '#374151' }}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {showPagination && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          padding: '12px 8px',
          fontSize: 13,
          color: '#374151',
          borderTop: '1px solid #e5e7eb',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            style={{
              padding: '6px 14px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: currentPage === 0 ? '#f3f4f6' : 'white',
              color: currentPage === 0 ? '#9ca3af' : '#374151',
              cursor: currentPage === 0 ? 'default' : 'pointer',
              fontSize: 13,
              fontWeight: 500
            }}
          >
            Anterior
          </button>
          <span>
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            style={{
              padding: '6px 14px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: currentPage >= totalPages - 1 ? '#f3f4f6' : 'white',
              color: currentPage >= totalPages - 1 ? '#9ca3af' : '#374151',
              cursor: currentPage >= totalPages - 1 ? 'default' : 'pointer',
              fontSize: 13,
              fontWeight: 500
            }}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
