import { useState, useMemo } from 'react';
import DataTable from '../../components/ui/DataTable';
import { useUiStore } from '../../stores/uiStore';
import { apiService } from '@services/ApiService.js';

const CATEGORY_LABELS = {
  ingreso: 'Ingreso', egreso: 'Egreso', cuota: 'Cuota',
  donacion: 'Donación', proyecto: 'Proyecto', otro: 'Otro'
};

function formatCLP(val) {
  return (val || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

export default function OrgFinanzas({ org, onRefresh }) {
  const [filter, setFilter] = useState('all');
  const addToast = useUiStore((s) => s.addToast);
  const transactions = org?.finances || [];

  const filtered = filter === 'all' ? transactions : transactions.filter((t) => t.category === filter);

  const totals = useMemo(() => {
    const ingresos = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const egresos = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    // Monthly stats (current month)
    const now = new Date();
    const thisMonth = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthIn = thisMonth.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const monthOut = thisMonth.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    return { ingresos, egresos, balance: ingresos - egresos, monthIn, monthOut };
  }, [transactions]);

  async function handleDelete(txId) {
    if (!confirm('¿Eliminar esta transacción?')) return;
    try {
      await apiService.updateOrganization(org._id, { removeFinance: txId });
      addToast('Transacción eliminada', 'success');
      onRefresh();
    } catch (error) {
      addToast(error.message || 'Error al eliminar', 'error');
    }
  }

  function exportCSV() {
    const header = 'Fecha,Concepto,Categoría,Monto\n';
    const rows = transactions.map((t) =>
      `${t.date ? new Date(t.date).toLocaleDateString('es-CL') : ''},${(t.concept || '').replace(/,/g, ';')},${CATEGORY_LABELS[t.category] || t.category || ''},${t.amount || 0}`
    ).join('\n');
    const csv = header + rows;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finanzas_${org.organizationName || 'org'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('CSV exportado', 'success');
  }

  const columns = [
    {
      key: 'date', label: 'Fecha',
      render: (val) => val ? new Date(val).toLocaleDateString('es-CL') : '—'
    },
    { key: 'concept', label: 'Concepto' },
    {
      key: 'category', label: 'Categoría',
      render: (val) => CATEGORY_LABELS[val] || val || '—'
    },
    {
      key: 'amount', label: 'Monto',
      render: (val) => (
        <span style={{ fontWeight: 600, color: val >= 0 ? '#059669' : '#ef4444' }}>
          {val >= 0 ? '+' : ''}{formatCLP(val)}
        </span>
      )
    },
    {
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <button onClick={() => handleDelete(row.id || row._id)}
          style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #fca5a5', borderRadius: 4, background: 'white', color: '#ef4444', cursor: 'pointer' }}>
          Eliminar
        </button>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', margin: 0 }}>Finanzas</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} style={outlineBtn}>Exportar CSV</button>
        </div>
      </div>

      {/* Info card */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
        Cada organización debe tener una cuenta bancaria a su nombre y presentar un balance anual. Las juntas de vecinos no pueden perseguir fines de lucro.
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <SummaryCard label="Ingresos Totales" value={totals.ingresos} color="#059669" />
        <SummaryCard label="Egresos Totales" value={totals.egresos} color="#ef4444" />
        <SummaryCard label="Balance" value={totals.balance} color={totals.balance >= 0 ? '#059669' : '#ef4444'} />
        <SummaryCard label="Ingresos del Mes" value={totals.monthIn} color="#3b82f6" />
        <SummaryCard label="Egresos del Mes" value={totals.monthOut} color="#f59e0b" />
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 16 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}>
          <option value="all">Todas las categorías</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <DataTable columns={columns} data={filtered} emptyMessage="No hay transacciones registradas" />
    </div>
  );
}

const outlineBtn = { padding: '8px 16px', fontSize: 13, border: '1px solid #3b82f6', borderRadius: 8, background: 'white', color: '#3b82f6', cursor: 'pointer', fontWeight: 600 };

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
      <span style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color }}>{formatCLP(value)}</span>
    </div>
  );
}
