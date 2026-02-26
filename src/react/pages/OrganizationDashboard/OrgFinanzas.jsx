import { useState } from 'react';
import DataTable from '../../components/ui/DataTable';

const CATEGORY_LABELS = {
  ingreso: 'Ingreso',
  egreso: 'Egreso',
  cuota: 'Cuota',
  donacion: 'Donación',
  proyecto: 'Proyecto',
  otro: 'Otro'
};

export default function OrgFinanzas({ org }) {
  const [filter, setFilter] = useState('all');
  const transactions = org?.finances || [];

  const filtered = filter === 'all'
    ? transactions
    : transactions.filter((t) => t.category === filter);

  const totalIngresos = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalEgresos = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const balance = totalIngresos - totalEgresos;

  const columns = [
    {
      key: 'date',
      label: 'Fecha',
      render: (val) => val ? new Date(val).toLocaleDateString('es-CL') : '—'
    },
    { key: 'concept', label: 'Concepto' },
    {
      key: 'category',
      label: 'Categoría',
      render: (val) => CATEGORY_LABELS[val] || val || '—'
    },
    {
      key: 'amount',
      label: 'Monto',
      render: (val) => {
        const positive = val >= 0;
        return (
          <span style={{ fontWeight: 600, color: positive ? '#059669' : '#ef4444' }}>
            {positive ? '+' : ''}{(val || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
          </span>
        );
      }
    }
  ];

  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', marginBottom: 24 }}>Finanzas</h3>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <SummaryCard label="Ingresos" value={totalIngresos} color="#059669" />
        <SummaryCard label="Egresos" value={totalEgresos} color="#ef4444" />
        <SummaryCard label="Balance" value={balance} color={balance >= 0 ? '#059669' : '#ef4444'} />
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 16 }}>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}
        >
          <option value="all">Todas las categorías</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <DataTable columns={columns} data={filtered} emptyMessage="No hay transacciones registradas" />
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: 20
    }}>
      <span style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 4 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color }}>
        {(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
      </span>
    </div>
  );
}
