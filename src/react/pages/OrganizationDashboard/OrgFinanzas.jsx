import { useState, useMemo } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
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
  const [showCreate, setShowCreate] = useState(false);
  const addToast = useUiStore((s) => s.addToast);
  const transactions = org?.finances || [];

  const filtered = filter === 'all' ? transactions : transactions.filter((t) => t.category === filter);

  const totals = useMemo(() => {
    const ingresos = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const egresos = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

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
      hideOnMobile: true,
      render: (val) => CATEGORY_LABELS[val] || val || '—'
    },
    {
      key: 'amount', label: 'Monto',
      render: (val) => (
        <span style={{ fontWeight: 600, color: val >= 0 ? '#059669' : '#ef4444', whiteSpace: 'nowrap' }}>
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
      <div className="r-toolbar" style={{ marginBottom: 16 }}>
        <h3 className="r-page-title" style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', margin: 0 }}>Finanzas</h3>
        <div className="r-toolbar__actions">
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' }} onClick={() => setShowCreate(true)}>
            + Transacción
          </button>
          <button onClick={exportCSV} style={outlineBtn}>Exportar CSV</button>
        </div>
      </div>

      {/* Info card */}
      <div className="r-info-card" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
        Cada organización debe tener una cuenta bancaria a su nombre y presentar un balance anual. Las juntas de vecinos no pueden perseguir fines de lucro.
      </div>

      {/* Summary Cards */}
      <div className="r-grid-3" style={{ marginBottom: 24 }}>
        <SummaryCard label="Ingresos Totales" value={totals.ingresos} color="#059669" />
        <SummaryCard label="Egresos Totales" value={totals.egresos} color="#ef4444" />
        <SummaryCard label="Balance" value={totals.balance} color={totals.balance >= 0 ? '#059669' : '#ef4444'} />
        <SummaryCard label="Ingresos del Mes" value={totals.monthIn} color="#3b82f6" />
        <SummaryCard label="Egresos del Mes" value={totals.monthOut} color="#f59e0b" />
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 16 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, maxWidth: '100%' }}>
          <option value="all">Todas las categorías</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <DataTable columns={columns} data={filtered} emptyMessage="No hay transacciones registradas" />

      <CreateTransactionModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        orgId={org._id}
        onCreated={() => { setShowCreate(false); onRefresh(); }}
        addToast={addToast}
      />
    </div>
  );
}

const outlineBtn = { padding: '8px 16px', fontSize: 13, border: '1px solid #3b82f6', borderRadius: 8, background: 'white', color: '#3b82f6', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' };

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
      <span style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{formatCLP(value)}</span>
    </div>
  );
}

function CreateTransactionModal({ open, onClose, orgId, onCreated, addToast }) {
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState('ingreso');
  const [category, setCategory] = useState('ingreso');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setConcept('');
    setAmount('');
    setDirection('ingreso');
    setCategory('ingreso');
    setDate(new Date().toISOString().slice(0, 10));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!concept.trim()) { addToast('Ingresa un concepto', 'error'); return; }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) { addToast('Ingresa un monto válido mayor a 0', 'error'); return; }

    const finalAmount = direction === 'egreso' ? -Math.abs(numAmount) : Math.abs(numAmount);

    setSubmitting(true);
    try {
      await apiService.updateOrganization(orgId, {
        addFinance: { concept: concept.trim(), amount: finalAmount, category, date }
      });
      addToast('Transacción registrada', 'success');
      resetForm();
      onCreated();
    } catch (error) {
      addToast(error.message || 'Error al registrar transacción', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva Transacción">
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField label="Concepto *" id="tx-concept" type="text" placeholder="Ej: Pago de arriendo, Cuota mensual" value={concept} onChange={(e) => setConcept(e.target.value)} />

        <FormField label="Monto *" id="tx-amount" type="number" placeholder="0" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />

        <FormField label="Tipo" id="tx-direction">
          <div className="r-form-row" style={{ gap: 8 }}>
            <button
              type="button"
              onClick={() => setDirection('ingreso')}
              style={{
                flex: 1, padding: '12px 16px', border: '2px solid', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                borderColor: direction === 'ingreso' ? '#059669' : '#e5e7eb',
                background: direction === 'ingreso' ? '#ecfdf5' : 'white',
                color: direction === 'ingreso' ? '#059669' : '#6b7280'
              }}
            >
              Ingreso
            </button>
            <button
              type="button"
              onClick={() => setDirection('egreso')}
              style={{
                flex: 1, padding: '12px 16px', border: '2px solid', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                borderColor: direction === 'egreso' ? '#ef4444' : '#e5e7eb',
                background: direction === 'egreso' ? '#fef2f2' : 'white',
                color: direction === 'egreso' ? '#ef4444' : '#6b7280'
              }}
            >
              Egreso
            </button>
          </div>
        </FormField>

        <FormField label="Categoría" id="tx-category">
          <select id="tx-category" value={category} onChange={(e) => setCategory(e.target.value)}
            style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 16 }}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </FormField>

        <FormField label="Fecha" id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <div className="r-form-row" style={{ marginTop: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, background: '#f3f4f6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Cancelar</button>
          <button type="submit" className="btn-auth" style={{ flex: 1 }} disabled={submitting}>{submitting ? 'Guardando...' : 'Registrar Transacción'}</button>
        </div>
      </form>
    </Modal>
  );
}
