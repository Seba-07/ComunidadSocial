import { useState, useEffect, useRef } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../stores/uiStore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const STATUS_CONFIG = {
  VIGENTE: { label: 'Vigente', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: '✅' },
  EN_PROCESO_ELECTORAL: { label: 'En Proceso Electoral', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '🗳️' },
  PENDIENTE_VALIDACION: { label: 'Pendiente de Validación', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', icon: '⏳' },
  VENCIDA: { label: 'Vencida', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', icon: '⚠️' },
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
}

function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
}

export default function OrgElecciones({ org, onRefresh }) {
  const [electionData, setElectionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTricelModal, setShowTricelModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const addToast = useUiStore((s) => s.addToast);

  useEffect(() => {
    if (org?._id) loadElectionStatus();
  }, [org?._id]);

  async function loadElectionStatus() {
    setLoading(true);
    try {
      const data = await apiService.get(`/organizations/${org._id}/elections/status`);
      setElectionData(data);
    } catch {
      setElectionData({
        boardStatus: org.boardStatus || 'VIGENTE',
        boardElectionDate: org.boardElectionDate,
        boardExpirationDate: org.boardExpirationDate,
        tricelDocument: org.tricelDocument,
        pendingElectoralBoard: org.pendingElectoralBoard
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSuccess() {
    loadElectionStatus();
    if (onRefresh) onRefresh();
  }

  if (loading) return <LoadingSpinner text="Cargando estado electoral..." />;

  const status = electionData?.boardStatus || 'VIGENTE';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.VIGENTE;
  const expirationDays = daysUntil(electionData?.boardExpirationDate);
  const canStartElection = status === 'VIGENTE' || status === 'VENCIDA';
  const canSubmitResults = status === 'EN_PROCESO_ELECTORAL';

  // Directorio provisorio data
  const prov = org?.provisionalDirectorio || {};
  const cargos = [
    { key: 'president', label: 'Presidente/a', data: prov.president },
    { key: 'vicePresident', label: 'Vicepresidente/a', data: prov.vicePresident },
    { key: 'secretary', label: 'Secretario/a', data: prov.secretary },
    { key: 'treasurer', label: 'Tesorero/a', data: prov.treasurer },
  ].filter(c => c.data?.rut);
  const additionalMembers = (prov.additionalMembers || []).filter(m => m?.rut);

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 20 }}>
        Elecciones y Renovación de Directorio
      </h2>

      {/* Status Card */}
      <div style={{ background: config.bg, border: `2px solid ${config.border}`, borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 32 }}>{config.icon}</span>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Estado de la Directiva</div>
            <div style={{
              fontSize: 20, fontWeight: 700, color: config.color,
              display: 'inline-block', padding: '2px 16px', borderRadius: 20,
              background: 'white', border: `1px solid ${config.border}`, marginTop: 4
            }}>
              {config.label}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div style={{ background: 'white', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Fecha de Elección</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{formatDate(electionData?.boardElectionDate)}</div>
          </div>
          <div style={{ background: 'white', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Vencimiento del Mandato</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{formatDate(electionData?.boardExpirationDate)}</div>
            {expirationDays !== null && (
              <div style={{
                fontSize: 12, marginTop: 4, fontWeight: 600,
                color: expirationDays <= 0 ? '#dc2626' : expirationDays <= 30 ? '#d97706' : '#059669'
              }}>
                {expirationDays <= 0 ? `Vencido hace ${Math.abs(expirationDays)} días`
                  : expirationDays <= 30 ? `Vence en ${expirationDays} días`
                  : `${expirationDays} días restantes`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TRICEL info (when in electoral process) */}
      {(status === 'EN_PROCESO_ELECTORAL' || status === 'PENDIENTE_VALIDACION') && electionData?.tricelDocument && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#92400e', margin: '0 0 12px' }}>
            {status === 'PENDIENTE_VALIDACION' ? 'Resultados Enviados — Esperando Validación Municipal' : 'Proceso Electoral en Curso'}
          </h3>
          <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
            {electionData.tricelDocument.plannedElectionDate && (
              <div><span style={{ color: '#6b7280' }}>Fecha planificada: </span><span style={{ fontWeight: 600 }}>{formatDate(electionData.tricelDocument.plannedElectionDate)}</span></div>
            )}
            {electionData.tricelDocument.fileName && (
              <div><span style={{ color: '#6b7280' }}>Acta TRICEL: </span><span style={{ fontWeight: 500 }}>{electionData.tricelDocument.fileName}</span></div>
            )}
          </div>
        </div>
      )}

      {/* Pending board preview */}
      {status === 'PENDIENTE_VALIDACION' && electionData?.pendingElectoralBoard && (
        <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#5b21b6', margin: '0 0 12px' }}>Directiva Electa (Pendiente de Aprobación)</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              { label: 'Presidente/a', data: electionData.pendingElectoralBoard.president },
              { label: 'Secretario/a', data: electionData.pendingElectoralBoard.secretary },
              { label: 'Tesorero/a', data: electionData.pendingElectoralBoard.treasurer },
            ].filter(c => c.data?.rut).map(({ label, data }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'white', borderRadius: 8, flexWrap: 'wrap', gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#5b21b6' }}>{label}</span>
                <span style={{ fontSize: 14, color: '#374151' }}>{data.firstName} {data.lastName} ({data.rut})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {canStartElection && (
          <button onClick={() => setShowTricelModal(true)}
            style={{ padding: '14px 28px', border: 'none', borderRadius: 10, background: '#1e40af', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            🗳️ Informar Comisión Electoral (TRICEL)
          </button>
        )}
        {canSubmitResults && (
          <button onClick={() => setShowResultsModal(true)}
            style={{ padding: '14px 28px', border: 'none', borderRadius: 10, background: '#7c3aed', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            📋 Informar Resultados de Elección
          </button>
        )}
        {status === 'PENDIENTE_VALIDACION' && (
          <p style={{ fontSize: 13, color: '#7c3aed', alignSelf: 'center', margin: 0 }}>
            Los resultados han sido enviados. La municipalidad debe validar la nueva directiva.
          </p>
        )}
      </div>

      {/* Current Board */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Directorio Actual</h3>
        {cargos.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {cargos.map(({ key, label, data }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f9fafb', borderRadius: 8, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#1e40af' }}>{label}</span>
                <span style={{ color: '#374151', fontSize: 14 }}>{data.firstName} {data.lastName}</span>
              </div>
            ))}
            {additionalMembers.map((m, i) => (
              <div key={`add-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f9fafb', borderRadius: 8, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#1e40af' }}>{m.cargo || 'Director/a'}</span>
                <span style={{ color: '#374151', fontSize: 14 }}>{m.firstName} {m.lastName}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: 16 }}>No hay información de directorio disponible.</p>
        )}
      </div>

      {showTricelModal && (
        <TricelModal orgId={org._id} onClose={() => setShowTricelModal(false)}
          onSuccess={() => { setShowTricelModal(false); handleSuccess(); }} addToast={addToast} />
      )}
      {showResultsModal && (
        <ElectionResultsModal orgId={org._id} members={org.members || []}
          onClose={() => setShowResultsModal(false)}
          onSuccess={() => { setShowResultsModal(false); handleSuccess(); }} addToast={addToast} />
      )}
    </div>
  );
}

// ========== TRICEL Modal (unchanged from Fase 1) ==========
function TricelModal({ orgId, onClose, onSuccess, addToast }) {
  const [file, setFile] = useState(null);
  const [plannedDate, setPlannedDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!plannedDate) { addToast('Debe indicar la fecha planificada para la elección', 'error'); return; }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('plannedElectionDate', plannedDate);
      if (file) formData.append('tricelDocument', file);
      const response = await fetch(`${apiService.baseUrl}/organizations/${orgId}/elections/start`, {
        method: 'POST', body: formData, credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest', ...(apiService._authToken && { Authorization: `Bearer ${apiService._authToken}` }) }
      });
      if (!response.ok) { const d = await response.json().catch(() => ({})); throw new Error(d.error || 'Error'); }
      addToast('Proceso electoral iniciado correctamente', 'success');
      onSuccess();
    } catch (error) { addToast(error.message, 'error'); }
    finally { setSubmitting(false); }
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Informar Comisión Electoral (TRICEL)</h3>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#6b7280' }}>Al confirmar, el estado cambiará a "En Proceso Electoral".</p>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13, color: '#1e40af', lineHeight: 1.5 }}>
            Según la Ley 19.418, la Comisión Electoral (TRICEL) es responsable de organizar y supervisar el proceso de elección del nuevo directorio.
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Fecha planificada de elección *</label>
            <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} min={today} required
              style={{ width: '100%', padding: '12px 14px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 15, boxSizing: 'border-box' }} />
          </div>
          <PdfUploadField file={file} setFile={setFile} fileRef={fileRef} addToast={addToast} label="Acta del TRICEL (PDF, opcional)" />
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancelar</button>
            <button type="submit" disabled={submitting} style={{ ...submitBtnStyle, background: '#1e40af', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Procesando...' : 'Iniciar Proceso Electoral'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========== Election Results Modal (Fase 2) ==========
function ElectionResultsModal({ orgId, members, onClose, onSuccess, addToast }) {
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef();
  const [board, setBoard] = useState({
    presidentRut: '', presidentFirstName: '', presidentLastName: '',
    secretaryRut: '', secretaryFirstName: '', secretaryLastName: '',
    treasurerRut: '', treasurerFirstName: '', treasurerLastName: '',
  });

  function updateField(field, value) {
    setBoard(prev => ({ ...prev, [field]: value }));
  }

  // Auto-fill name from members when RUT changes
  function handleRutChange(cargo, rut) {
    updateField(`${cargo}Rut`, rut);
    const clean = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
    if (clean.length >= 7) {
      const match = members.find(m => {
        const mRut = (m.rut || '').replace(/\./g, '').replace(/-/g, '').toUpperCase();
        return mRut === clean;
      });
      if (match) {
        updateField(`${cargo}FirstName`, match.firstName || '');
        updateField(`${cargo}LastName`, match.lastName || '');
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const { presidentRut, presidentFirstName, presidentLastName,
            secretaryRut, secretaryFirstName, secretaryLastName,
            treasurerRut, treasurerFirstName, treasurerLastName } = board;

    if (!presidentRut || !secretaryRut || !treasurerRut) {
      addToast('Debe indicar los RUTs de los tres cargos', 'error'); return;
    }
    if (!presidentFirstName || !presidentLastName || !secretaryFirstName || !secretaryLastName || !treasurerFirstName || !treasurerLastName) {
      addToast('Debe completar nombre y apellido de cada cargo', 'error'); return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(board).forEach(([k, v]) => formData.append(k, v));
      if (file) formData.append('electionActDocument', file);

      const response = await fetch(`${apiService.baseUrl}/organizations/${orgId}/elections/submit-results`, {
        method: 'POST', body: formData, credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest', ...(apiService._authToken && { Authorization: `Bearer ${apiService._authToken}` }) }
      });
      if (!response.ok) { const d = await response.json().catch(() => ({})); throw new Error(d.error || 'Error'); }
      addToast('Resultados enviados para validación municipal', 'success');
      onSuccess();
    } catch (error) { addToast(error.message, 'error'); }
    finally { setSubmitting(false); }
  }

  const cargoFields = [
    { cargo: 'president', label: 'Presidente/a' },
    { cargo: 'secretary', label: 'Secretario/a' },
    { cargo: 'treasurer', label: 'Tesorero/a' },
  ];

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Informar Resultados de Elección</h3>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#6b7280' }}>
            Complete los datos de la nueva directiva electa. La municipalidad deberá validar estos resultados.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13, color: '#1e40af', lineHeight: 1.5 }}>
            Ingrese los datos de los tres cargos obligatorios según la Ley 19.418. Al escribir el RUT de un socio existente, los nombres se completarán automáticamente.
          </div>

          {cargoFields.map(({ cargo, label }) => (
            <div key={cargo} style={{ marginBottom: 20, padding: 16, background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 10 }}>{label} *</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <input placeholder="RUT (ej: 12.345.678-9)" value={board[`${cargo}Rut`]}
                  onChange={(e) => handleRutChange(cargo, e.target.value)}
                  style={inputStyle} required />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input placeholder="Nombre" value={board[`${cargo}FirstName`]}
                    onChange={(e) => updateField(`${cargo}FirstName`, e.target.value)}
                    style={inputStyle} required />
                  <input placeholder="Apellido" value={board[`${cargo}LastName`]}
                    onChange={(e) => updateField(`${cargo}LastName`, e.target.value)}
                    style={inputStyle} required />
                </div>
              </div>
            </div>
          ))}

          <PdfUploadField file={file} setFile={setFile} fileRef={fileRef} addToast={addToast}
            label="Acta de Elección Definitiva (PDF)" />

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancelar</button>
            <button type="submit" disabled={submitting} style={{ ...submitBtnStyle, background: '#7c3aed', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Enviando...' : 'Enviar para Validación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========== Shared Components ==========
function PdfUploadField({ file, setFile, fileRef, addToast, label }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>{label}</label>
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
          <span style={{ fontSize: 14, color: '#059669', fontWeight: 500 }}>{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
          <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
            style={{ padding: '2px 10px', border: '1px solid #ef4444', borderRadius: 6, background: 'white', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>Quitar</button>
        </div>
      ) : (
        <label style={{ display: 'block', padding: 16, border: '2px dashed #d1d5db', borderRadius: 10, textAlign: 'center', cursor: 'pointer', color: '#6b7280', fontSize: 14 }}>
          Haz clic para seleccionar un PDF
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files[0];
              if (f && f.type !== 'application/pdf') { addToast('Solo se permiten archivos PDF', 'error'); return; }
              if (f && f.size > 20 * 1024 * 1024) { addToast('El archivo no puede superar 20MB', 'error'); return; }
              setFile(f);
            }} />
        </label>
      )}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
const cancelBtnStyle = { flex: 1, padding: 14, background: '#f3f4f6', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' };
const submitBtnStyle = { flex: 1, padding: 14, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff' };
