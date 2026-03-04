import { useWizardStore } from '../../../stores/wizardStore';
import { useUiStore } from '../../../stores/uiStore';
import { pdfService } from '@services/PDFService.js';

export default function Step6_Review({ onNext, onPrev }) {
  const { formData, templateConfig } = useWizardStore();
  const addToast = useUiStore(s => s.addToast);

  const org = formData.organization;
  const members = formData.members || [];
  const directorio = formData.directorioProvisorio || {};
  const comision = formData.comisionElectoral || {};
  const config = formData.config || {};
  const estatutos = formData.estatutos || {};
  const certs = formData.certificates || {};
  const comisionSize = templateConfig?.comisionElectoral?.cantidad || 3;

  function previewDocument(type) {
    try {
      const orgData = {
        organization: org,
        organizationName: org.name,
        organizationType: org.type,
        members,
        provisionalDirectorio: directorio,
        comisionElectoral: comision,
      };
      let doc;
      if (type === 'acta') {
        doc = pdfService.generateActaAsamblea(orgData);
      } else if (type === 'socios') {
        doc = pdfService.generateListaSocios(orgData);
      } else if (type === 'declaraciones') {
        const docs = pdfService.generateAllDeclaracionesJuradas(orgData);
        if (docs.length > 0) doc = docs[0].doc;
        else {
          addToast('No hay directores para generar declaraciones', 'error');
          return;
        }
      }
      if (doc) {
        const url = pdfService.getPDFDataURL(doc);
        window.open(url, '_blank');
      }
    } catch (err) {
      addToast('Error al generar vista previa: ' + err.message, 'error');
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Revisión Final
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        Verifica toda la información antes de continuar.
      </p>

      {/* Org Data */}
      <Section title="Datos de la Organización">
        <Row label="Tipo" value={templateConfig?.nombreTipo || org.type} />
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
          <div key={cargo} style={{ display: 'flex', gap: 12, padding: '4px 0', fontSize: 14, alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: '#374151', minWidth: 120 }}>{data.cargo || cargo}:</span>
            <span style={{ color: '#6b7280', flex: 1 }}>{data.firstName} {data.lastName} - {data.rut}</span>
            {certs[cargo] && <span style={{ fontSize: 11, color: '#10b981' }}>Cert. OK</span>}
          </div>
        ))}
      </Section>

      {/* Comisión */}
      <Section title={`Comisión Electoral (${(comision.members || []).length}/${comisionSize} miembros)`}>
        {(comision.members || []).map((m, i) => (
          <Row key={i} label={`Miembro ${i + 1}`} value={`${m.firstName} ${m.lastName} - ${m.rut}`} />
        ))}
      </Section>

      {/* Config */}
      <Section title="Configuración">
        <Row label="Asambleas" value={(config.asambleas || []).join(', ')} />
        <Row label="Cuotas" value={`${config.cuotaMin || 0} - ${config.cuotaMax || 0} UTM`} />
        <Row label="Estatutos" value={estatutos.type === 'template' ? 'Plantilla automática' : 'Personalizado'} />
      </Section>

      {/* Documents Preview */}
      <Section title="Documentos Generados">
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
          Los siguientes documentos se generarán automáticamente:
        </p>
        {[
          { key: 'acta', label: 'Acta de Asamblea Constitutiva' },
          { key: 'socios', label: 'Lista de Socios Fundadores' },
          { key: 'declaraciones', label: 'Declaraciones Juradas del Directorio' },
        ].map(doc => (
          <div key={doc.key} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', borderBottom: '1px solid #f3f4f6'
          }}>
            <span style={{ fontSize: 14, color: '#374151' }}>{doc.label}</span>
            <button onClick={() => previewDocument(doc.key)} style={{
              padding: '4px 12px', border: '1px solid #2563eb', borderRadius: 6,
              background: 'white', color: '#2563eb', fontSize: 12, cursor: 'pointer'
            }}>Vista previa</button>
          </div>
        ))}
      </Section>

      {/* Warning */}
      <div style={{
        background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10,
        padding: 16, marginTop: 20, marginBottom: 24
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
          Revisa que toda la información sea correcta antes de continuar al agendamiento de la asamblea.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={onNext} style={{
          padding: '12px 28px', border: 'none', borderRadius: 10,
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer'
        }}>Siguiente</button>
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
