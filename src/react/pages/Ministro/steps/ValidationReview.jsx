export default function ValidationReview({ wizardData, org, onPrev, onSubmit, isSubmitting }) {
  const directorio = wizardData.directorio?.members || Object.entries(wizardData.directorio || {})
    .filter(([k]) => !['type', '_id', 'members'].includes(k))
    .map(([cargo, data]) => ({ cargo, ...data }));
  const commission = wizardData.comisionElectoral || [];
  const attendees = wizardData.attendees || [];
  const presentCount = attendees.filter(a => a.present).length;

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Confirmación Final
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        Revisa toda la información antes de confirmar la validación.
      </p>

      {/* Org Info */}
      <Section title="Organización">
        <Row label="Nombre" value={org?.name} />
        <Row label="Tipo" value={org?.type} />
      </Section>

      {/* Directorio */}
      <Section title={`Directorio (${directorio.length} miembros)`}>
        {directorio.map((m, i) => (
          <Row key={i}
            label={m.cargo || 'Miembro'}
            value={`${m.firstName || m.name || ''} ${m.lastName || ''} - ${m.rut || ''}`}
          />
        ))}
      </Section>

      {/* Commission */}
      <Section title={`Comisión Electoral (${commission.length})`}>
        {commission.map((m, i) => (
          <Row key={i}
            label={`Miembro ${i + 1}`}
            value={`${m.firstName || m.name || ''} ${m.lastName || ''} - ${m.rut || ''}`}
          />
        ))}
      </Section>

      {/* Attendance */}
      <Section title="Asistencia">
        <Row label="Presentes" value={`${presentCount}/${attendees.length}`} />
      </Section>

      {/* Signature */}
      <Section title="Firma Ministro">
        {wizardData.ministroSignature ? (
          <img src={wizardData.ministroSignature} alt="Firma"
            style={{ maxWidth: 300, border: '1px solid #e5e7eb', borderRadius: 8 }} />
        ) : (
          <p style={{ color: '#ef4444', fontSize: 13 }}>Sin firma</p>
        )}
      </Section>

      {/* Notes */}
      {wizardData.notes && (
        <Section title="Observaciones">
          <p style={{ margin: 0, fontSize: 14, color: '#374151' }}>{wizardData.notes}</p>
        </Section>
      )}

      {/* Legal warning */}
      <div style={{
        background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10,
        padding: 16, marginBottom: 24
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
          Al confirmar, certifica como Ministro de Fe que la información presentada
          es verídica y ha sido verificada en persona.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={onSubmit} disabled={isSubmitting} style={{
          padding: '14px 32px', border: 'none', borderRadius: 10,
          background: isSubmitting ? '#9ca3af' : 'linear-gradient(135deg, #10b981, #059669)',
          color: 'white', fontSize: 16, fontWeight: 700, cursor: isSubmitting ? 'wait' : 'pointer'
        }}>
          {isSubmitting ? 'Enviando...' : 'Confirmar Validación'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: 16, marginBottom: 16
    }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600, color: '#111827' }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '3px 0', fontSize: 14 }}>
      <span style={{ fontWeight: 600, color: '#374151', minWidth: 120, textTransform: 'capitalize' }}>{label}:</span>
      <span style={{ color: '#6b7280' }}>{value}</span>
    </div>
  );
}

const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
