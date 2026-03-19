import { useState, useRef } from 'react';

function formatName(p) {
  if (!p) return '—';
  return [p.firstName, p.name, p.lastName].filter(Boolean).join(' ') || '—';
}

export default function ValidationReview({ wizardData, org, onPrev, onSubmit, onRejectAssembly, isSubmitting }) {
  const [actaFile, setActaFile] = useState(null);
  const [attendanceFile, setAttendanceFile] = useState(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const actaRef = useRef(null);
  const attendanceRef = useRef(null);

  const directorio = wizardData.directorio?.members || Object.entries(wizardData.directorio || {})
    .filter(([k]) => !['type', '_id', 'members', 'additionalMembers', 'designatedAt', '__v'].includes(k))
    .map(([cargo, data]) => ({ cargo, ...data }));
  const commission = wizardData.comisionElectoral || [];
  const attendees = wizardData.attendees || [];
  const presentCount = attendees.filter(a => a.present).length;
  const quorumRequired = wizardData.quorumRequired || 15;
  const quorumMet = wizardData.quorumAchieved !== undefined ? wizardData.quorumAchieved : presentCount >= quorumRequired;

  function handleFileSelect(setter) {
    return (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { alert('Archivo demasiado grande (max 10MB)'); return; }
      const reader = new FileReader();
      reader.onload = () => setter({ name: file.name, data: reader.result });
      reader.readAsDataURL(file);
    };
  }

  function handleCertify() {
    // Pass scanned docs to parent submit
    onSubmit({
      actaScanned: actaFile?.data || null,
      attendanceScanned: attendanceFile?.data || null,
    });
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 'clamp(18px, 4vw, 20px)', fontWeight: 700, color: '#111827' }}>
        Certificacion Final
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
        Revise la informacion y suba los documentos firmados.
      </p>

      {/* Quorum result */}
      <div style={{
        padding: 16, borderRadius: 10, marginBottom: 16,
        background: quorumMet ? '#f0fdf4' : '#fef2f2',
        border: `2px solid ${quorumMet ? '#10b981' : '#ef4444'}`,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: quorumMet ? '#059669' : '#dc2626' }}>
          {presentCount}/{quorumRequired} presentes
        </div>
        <div style={{
          padding: '4px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, display: 'inline-block', marginTop: 6,
          background: quorumMet ? '#10b981' : '#ef4444', color: 'white',
        }}>
          {quorumMet ? 'QUORUM ALCANZADO' : 'SIN QUORUM — No se puede certificar'}
        </div>
      </div>

      {/* Summary sections */}
      <Section title={`Directorio (${directorio.length})`}>
        {directorio.map((m, i) => (
          <Row key={i} label={m.cargo || m.cargoNombre || 'Miembro'} value={`${formatName(m)} — ${m.rut || '—'}`} />
        ))}
      </Section>

      <Section title={`Comision Electoral (${commission.length})`}>
        {commission.map((m, i) => (
          <Row key={i} label={`Miembro ${i + 1}`} value={`${formatName(m)} — ${m.rut || '—'}`} />
        ))}
      </Section>

      <Section title="Asistencia">
        <Row label="Presentes" value={`${presentCount} de ${attendees.length}`} />
        <Row label="Quorum requerido" value={String(quorumRequired)} />
      </Section>

      {/* Signature preview */}
      <Section title="Firma Ministro de Fe">
        {wizardData.ministroSignature ? (
          <img src={wizardData.ministroSignature} alt="Firma" style={{ maxWidth: '100%', width: 280, border: '1px solid #e5e7eb', borderRadius: 8 }} />
        ) : (
          <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>Sin firma — vuelva al paso anterior</p>
        )}
      </Section>

      {wizardData.notes && (
        <Section title="Observaciones">
          <p style={{ margin: 0, fontSize: 14, color: '#374151' }}>{wizardData.notes}</p>
        </Section>
      )}

      {/* Upload scanned documents — only if quorum met */}
      {quorumMet && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 12 }}>
            Documentos Firmados (opcional)
          </h3>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            Si dispone de escaner o foto, suba el acta y lista firmada. Tambien puede subirlos despues.
          </p>

          <FileUploadBox
            label="Acta Constitutiva Firmada"
            file={actaFile}
            inputRef={actaRef}
            onSelect={handleFileSelect(setActaFile)}
            onClear={() => setActaFile(null)}
          />
          <FileUploadBox
            label="Lista de Asistencia Firmada"
            file={attendanceFile}
            inputRef={attendanceRef}
            onSelect={handleFileSelect(setAttendanceFile)}
            onClear={() => setAttendanceFile(null)}
          />
        </div>
      )}

      {/* Legal warning */}
      {quorumMet && (
        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
            Al certificar, declara como Ministro de Fe que la asamblea se realizo conforme a la ley,
            con el quorum requerido y la identidad de los asistentes fue verificada.
          </p>
        </div>
      )}

      {/* Reject flow */}
      {showReject && (
        <div style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#991b1b' }}>Rechazar Asamblea</h4>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Motivo del rechazo (ej: quorum insuficiente, irregularidades, documentos faltantes...)"
            rows={3}
            style={{ width: '100%', padding: 10, border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => setShowReject(false)} style={{ padding: '10px 18px', border: '1px solid #d1d5db', borderRadius: 8, background: 'white', fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button
              disabled={rejectReason.trim().length < 10 || isSubmitting}
              onClick={() => onRejectAssembly(rejectReason, presentCount, quorumRequired)}
              style={{
                padding: '10px 18px', border: 'none', borderRadius: 8,
                background: rejectReason.trim().length >= 10 ? '#dc2626' : '#d1d5db',
                color: 'white', fontSize: 13, fontWeight: 600, cursor: rejectReason.trim().length >= 10 ? 'pointer' : 'not-allowed',
              }}
            >
              {isSubmitting ? 'Enviando...' : 'Confirmar Rechazo'}
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!showReject && (
            <button onClick={() => setShowReject(true)} style={{
              padding: 'clamp(10px, 2.5vw, 14px) clamp(16px, 4vw, 24px)',
              border: '1px solid #ef4444', borderRadius: 10, background: 'white',
              color: '#ef4444', fontSize: 'clamp(13px, 3vw, 15px)', fontWeight: 600, cursor: 'pointer',
            }}>
              Rechazar Asamblea
            </button>
          )}
          <button
            onClick={handleCertify}
            disabled={!quorumMet || !wizardData.ministroSignature || isSubmitting}
            style={{
              padding: 'clamp(10px, 2.5vw, 14px) clamp(20px, 5vw, 32px)',
              border: 'none', borderRadius: 10,
              background: (quorumMet && wizardData.ministroSignature && !isSubmitting)
                ? 'linear-gradient(135deg, #10b981, #059669)' : '#d1d5db',
              color: 'white', fontSize: 'clamp(14px, 3vw, 16px)', fontWeight: 700,
              cursor: (quorumMet && wizardData.ministroSignature && !isSubmitting) ? 'pointer' : 'not-allowed',
            }}
          >
            {isSubmitting ? 'Certificando...' : !quorumMet ? 'Sin Quorum' : !wizardData.ministroSignature ? 'Falta Firma' : 'Certificar Constitucion'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FileUploadBox({ label, file, inputRef, onSelect, onClear }) {
  return (
    <div style={{
      padding: 14, border: file ? '2px solid #10b981' : '2px dashed #d1d5db',
      borderRadius: 10, marginBottom: 10, background: file ? '#f0fdf4' : 'white',
    }}>
      {file ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{label}: {file.name}</span>
          <button onClick={onClear} style={{ padding: '4px 10px', border: '1px solid #ef4444', borderRadius: 6, background: 'white', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>
            Quitar
          </button>
        </div>
      ) : (
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', padding: 8 }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>{label}</span>
          <span style={{
            padding: '6px 14px', borderRadius: 8, background: '#f3f4f6', color: '#374151',
            fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          }}>Seleccionar archivo</span>
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={onSelect} />
        </label>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 'clamp(12px, 3vw, 16px)', marginBottom: 12 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#111827' }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 10, padding: '3px 0', fontSize: 13, flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 600, color: '#374151', minWidth: 100, textTransform: 'capitalize' }}>{label}:</span>
      <span style={{ color: '#6b7280' }}>{value}</span>
    </div>
  );
}

const prevBtn = { padding: 'clamp(10px, 2.5vw, 12px) clamp(20px, 5vw, 28px)', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 'clamp(14px, 3vw, 15px)', cursor: 'pointer', color: '#374151' };
