import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizardStore } from '../../../stores/wizardStore';
import { useUiStore } from '../../../stores/uiStore';
import StatusBadge from '../../../components/ui/StatusBadge';

export default function Step6_Review({ onPrev }) {
  const navigate = useNavigate();
  const { formData, submitOrganization, isSubmitting } = useWizardStore();
  const addToast = useUiStore(s => s.addToast);
  const [submitted, setSubmitted] = useState(false);

  const org = formData.organization;
  const members = formData.members || [];
  const directorio = formData.directorioProvisorio || {};
  const comision = formData.comisionElectoral || {};
  const config = formData.config || {};
  const estatutos = formData.estatutos || {};

  async function handleSubmit() {
    try {
      await submitOrganization();
      addToast('Organización creada exitosamente', 'success');
      setSubmitted(true);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#127881;</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
          Organización Creada
        </h2>
        <p style={{ fontSize: 15, color: '#6b7280', marginBottom: 24 }}>
          Tu organización ha sido enviada para revisión. Te notificaremos cuando sea procesada.
        </p>
        <button onClick={() => navigate('/login')} style={{
          padding: '12px 28px', border: 'none', borderRadius: 10,
          background: '#2563eb', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer'
        }}>
          Ir al Inicio
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Revisión Final
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        Verifica toda la información antes de enviar.
      </p>

      {/* Org Data */}
      <Section title="Datos de la Organización">
        <Row label="Tipo" value={org.type} />
        <Row label="Nombre" value={org.name} />
        <Row label="Dirección" value={[org.street, org.streetNumber, org.commune].filter(Boolean).join(', ')} />
        <Row label="Email" value={org.email} />
        <Row label="Teléfono" value={org.phone} />
      </Section>

      {/* Members */}
      <Section title={`Miembros (${members.length})`}>
        <div style={{ maxHeight: 200, overflow: 'auto' }}>
          {members.slice(0, 10).map((m, i) => (
            <div key={i} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
              <span>{m.firstName} {m.lastName}</span>
              <span style={{ color: '#6b7280' }}>{m.rut}</span>
            </div>
          ))}
          {members.length > 10 && (
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
              ...y {members.length - 10} miembros más
            </p>
          )}
        </div>
      </Section>

      {/* Directorio */}
      <Section title="Directorio Provisorio">
        {Object.entries(directorio).map(([cargo, data]) => (
          <Row key={cargo} label={data.cargo || cargo} value={`${data.firstName} ${data.lastName} - ${data.rut}`} />
        ))}
      </Section>

      {/* Comisión */}
      <Section title={`Comisión Electoral (${(comision.members || []).length} miembros)`}>
        {(comision.members || []).map((m, i) => (
          <Row key={i} label={`Miembro ${i + 1}`} value={`${m.firstName} ${m.lastName} - ${m.rut}`} />
        ))}
        {comision.electionDate && <Row label="Fecha elección" value={comision.electionDate} />}
      </Section>

      {/* Config */}
      <Section title="Configuración">
        <Row label="Asambleas" value={(config.asambleas || []).join(', ')} />
        <Row label="Cuotas" value={`${config.cuotaMin || 0} - ${config.cuotaMax || 0} UTM`} />
        <Row label="Estatutos" value={estatutos.type === 'template' ? 'Plantilla automática' : 'Personalizado'} />
      </Section>

      {/* Warning */}
      <div style={{
        background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10,
        padding: 16, marginTop: 20, marginBottom: 24
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
          Al enviar, tu organización será revisada por la municipalidad.
          Asegúrate de que toda la información sea correcta.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={handleSubmit} disabled={isSubmitting} style={{
          padding: '14px 32px', border: 'none', borderRadius: 10,
          background: isSubmitting ? '#9ca3af' : 'linear-gradient(135deg, #10b981, #059669)',
          color: 'white', fontSize: 16, fontWeight: 700, cursor: isSubmitting ? 'wait' : 'pointer'
        }}>
          {isSubmitting ? 'Enviando...' : 'Enviar Organización'}
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
      <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#111827' }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '4px 0', fontSize: 14 }}>
      <span style={{ fontWeight: 600, color: '#374151', minWidth: 120 }}>{label}:</span>
      <span style={{ color: '#6b7280' }}>{value}</span>
    </div>
  );
}

const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
