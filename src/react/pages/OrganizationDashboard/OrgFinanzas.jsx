import { useState, useMemo } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { apiService } from '@services/ApiService.js';
import { localeDateString } from '../../utils/formatters';
import { pdfService } from '@services/PDFService.js';

function getDirectivoCargo(org, user) {
  if (!user?.rut || !org?.provisionalDirectorio) return null;
  const clean = (r) => (r || '').replace(/\./g, '').replace(/-/g, '').toUpperCase();
  const userRut = clean(user.rut);
  const p = org.provisionalDirectorio;
  if (p.president && clean(p.president.rut) === userRut) return 'president';
  if (p.vicePresident && clean(p.vicePresident.rut) === userRut) return 'vicePresident';
  if (p.secretary && clean(p.secretary.rut) === userRut) return 'secretary';
  if (p.treasurer && clean(p.treasurer.rut) === userRut) return 'treasurer';
  if (p.additionalMembers?.some(m => m && clean(m.rut) === userRut)) return 'director';
  return null;
}

const CATEGORY_LABELS = {
  ingreso: 'Ingreso', egreso: 'Egreso', cuota: 'Cuota',
  donacion: 'Donación', proyecto: 'Proyecto', otro: 'Otro'
};

const FUND_SOURCE_LABELS = {
  FONDOS_PROPIOS: 'Fondos Propios',
  SUBVENCION_MUNICIPAL: 'Subvención Municipal'
};

const FUND_SOURCE_STYLES = {
  FONDOS_PROPIOS: { bg: '#dbeafe', color: '#1e40af' },
  SUBVENCION_MUNICIPAL: { bg: '#d1fae5', color: '#065f46' }
};

function formatCLP(val) {
  return (val || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

export default function OrgFinanzas({ org, onRefresh }) {
  const [filter, setFilter] = useState('all');
  const [fundFilter, setFundFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showBalanceSelector, setShowBalanceSelector] = useState(false);
  const [balanceYear, setBalanceYear] = useState(new Date().getFullYear());
  const addToast = useUiStore((s) => s.addToast);
  const user = useAuthStore((s) => s.user);
  const transactions = org?.finances || [];

  // RBAC: solo Tesorero, Presidente, owner o admin pueden gestionar finanzas
  const cargo = getDirectivoCargo(org, user);
  const canManage = user?.role === 'MUNICIPALIDAD' || org?.userId === user?._id || cargo === 'treasurer' || cargo === 'president';

  function downloadBalancePDF() {
    try {
      const doc = pdfService.generateBalanceAnual(org, balanceYear);
      doc.save(`balance_anual_${org.organizationName || 'org'}_${balanceYear}.pdf`);
      addToast(`Balance ${balanceYear} descargado`, 'success');
      setShowBalanceSelector(false);
    } catch (error) {
      addToast('Error al generar PDF: ' + (error.message || ''), 'error');
    }
  }

  let filtered = filter === 'all' ? transactions : transactions.filter((t) => t.category === filter);
  if (fundFilter !== 'all') {
    filtered = filtered.filter((t) => (t.fundSource || 'FONDOS_PROPIOS') === fundFilter);
  }

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
    const header = 'Fecha,Concepto,Categoría,Origen,Monto,N° Resolución,Ref. Documento\n';
    const rows = transactions.map((t) =>
      `${t.date ? localeDateString(t.date) : ''},${(t.concept || '').replace(/,/g, ';')},${CATEGORY_LABELS[t.category] || t.category || ''},${FUND_SOURCE_LABELS[t.fundSource] || 'Fondos Propios'},${t.amount || 0},${(t.resolutionNumber || '').replace(/,/g, ';')},${(t.documentRef || '').replace(/,/g, ';')}`
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
      render: (val) => val ? localeDateString(val) : '—'
    },
    { key: 'concept', label: 'Concepto' },
    {
      key: 'fundSource', label: 'Origen',
      hideOnMobile: true,
      render: (val) => {
        const source = val || 'FONDOS_PROPIOS';
        const style = FUND_SOURCE_STYLES[source] || FUND_SOURCE_STYLES.FONDOS_PROPIOS;
        return (
          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: style.bg, color: style.color, whiteSpace: 'nowrap' }}>
            {FUND_SOURCE_LABELS[source] || 'Fondos Propios'}
          </span>
        );
      }
    },
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
    ...(canManage ? [{
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <button onClick={() => handleDelete(row.id || row._id)}
          style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #fca5a5', borderRadius: 4, background: 'white', color: '#ef4444', cursor: 'pointer' }}>
          Eliminar
        </button>
      )
    }] : [])
  ];

  return (
    <div>
      <div className="r-toolbar" style={{ marginBottom: 16 }}>
        <h3 className="r-page-title" style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', margin: 0 }}>Finanzas</h3>
        <div className="r-toolbar__actions">
          {canManage && (
            <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' }} onClick={() => setShowCreate(true)}>
              + Transacción
            </button>
          )}
          <button onClick={() => setShowBalanceSelector(true)} style={{ ...outlineBtn, background: '#eff6ff', borderColor: '#3b82f6' }}>Balance PDF</button>
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

      {/* Filters */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}>
          <option value="all">Todas las categorías</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={fundFilter} onChange={(e) => setFundFilter(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}>
          <option value="all">Todos los orígenes</option>
          <option value="FONDOS_PROPIOS">Fondos Propios</option>
          <option value="SUBVENCION_MUNICIPAL">Subvención Municipal</option>
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

      {/* Balance Year Selector */}
      {showBalanceSelector && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowBalanceSelector(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: '100%', maxWidth: 360 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Descargar Balance Anual</h3>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Año</span>
              <select value={balanceYear} onChange={(e) => setBalanceYear(parseInt(e.target.value))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowBalanceSelector(false)}
                style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={downloadBalancePDF}
                style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}
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
  const [fundSource, setFundSource] = useState('FONDOS_PROPIOS');
  const [resolutionNumber, setResolutionNumber] = useState('');
  const [documentRef, setDocumentRef] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setConcept('');
    setAmount('');
    setDirection('ingreso');
    setCategory('ingreso');
    setFundSource('FONDOS_PROPIOS');
    setResolutionNumber('');
    setDocumentRef('');
    setDate(new Date().toISOString().slice(0, 10));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!concept.trim()) { addToast('Ingresa un concepto', 'error'); return; }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) { addToast('Ingresa un monto válido mayor a 0', 'error'); return; }

    const finalAmount = direction === 'egreso' ? -Math.abs(numAmount) : Math.abs(numAmount);

    const payload = { concept: concept.trim(), amount: finalAmount, category, fundSource, date };
    if (resolutionNumber.trim()) payload.resolutionNumber = resolutionNumber.trim();
    if (documentRef.trim()) payload.documentRef = documentRef.trim();

    setSubmitting(true);
    try {
      await apiService.updateOrganization(orgId, { addFinance: payload });
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

        <FormField label="Monto (CLP) *" id="tx-amount" type="number" placeholder="0" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />

        <FormField label="Tipo" id="tx-direction">
          <div className="r-form-row" style={{ gap: 8 }}>
            <button type="button" onClick={() => setDirection('ingreso')}
              style={{ flex: 1, padding: '12px 16px', border: '2px solid', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                borderColor: direction === 'ingreso' ? '#059669' : '#e5e7eb',
                background: direction === 'ingreso' ? '#ecfdf5' : 'white',
                color: direction === 'ingreso' ? '#059669' : '#6b7280' }}>
              Ingreso
            </button>
            <button type="button" onClick={() => setDirection('egreso')}
              style={{ flex: 1, padding: '12px 16px', border: '2px solid', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                borderColor: direction === 'egreso' ? '#ef4444' : '#e5e7eb',
                background: direction === 'egreso' ? '#fef2f2' : 'white',
                color: direction === 'egreso' ? '#ef4444' : '#6b7280' }}>
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

        <FormField label="Origen de Fondos *" id="tx-fund-source">
          <div className="r-form-row" style={{ gap: 8 }}>
            <button type="button" onClick={() => setFundSource('FONDOS_PROPIOS')}
              style={{ flex: 1, padding: '12px 16px', border: '2px solid', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                borderColor: fundSource === 'FONDOS_PROPIOS' ? '#1e40af' : '#e5e7eb',
                background: fundSource === 'FONDOS_PROPIOS' ? '#dbeafe' : 'white',
                color: fundSource === 'FONDOS_PROPIOS' ? '#1e40af' : '#6b7280' }}>
              Fondos Propios
            </button>
            <button type="button" onClick={() => setFundSource('SUBVENCION_MUNICIPAL')}
              style={{ flex: 1, padding: '12px 16px', border: '2px solid', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                borderColor: fundSource === 'SUBVENCION_MUNICIPAL' ? '#065f46' : '#e5e7eb',
                background: fundSource === 'SUBVENCION_MUNICIPAL' ? '#d1fae5' : 'white',
                color: fundSource === 'SUBVENCION_MUNICIPAL' ? '#065f46' : '#6b7280' }}>
              Subvención Municipal
            </button>
          </div>
        </FormField>

        {fundSource === 'SUBVENCION_MUNICIPAL' && (
          <FormField label="N° Resolución Municipal" id="tx-resolution" type="text" placeholder="Ej: Res. Exenta N° 1234/2026"
            value={resolutionNumber} onChange={(e) => setResolutionNumber(e.target.value)} />
        )}

        <FormField label="Ref. Documento (boleta/factura)" id="tx-doc-ref" type="text" placeholder="Ej: Boleta N° 5678"
          value={documentRef} onChange={(e) => setDocumentRef(e.target.value)} />

        <FormField label="Fecha" id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <div className="r-form-row" style={{ marginTop: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, background: '#f3f4f6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Cancelar</button>
          <button type="submit" className="btn-auth" style={{ flex: 1 }} disabled={submitting}>{submitting ? 'Guardando...' : 'Registrar Transacción'}</button>
        </div>
      </form>
    </Modal>
  );
}
