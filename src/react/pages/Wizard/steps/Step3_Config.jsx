import { useWizardStore } from '../../../stores/wizardStore';
import { useUiStore } from '../../../stores/uiStore';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function Step3_Config({ onNext, onPrev }) {
  const { formData, updateFormData } = useWizardStore();
  const addToast = useUiStore(s => s.addToast);
  const config = formData.config || {};

  function update(field, value) {
    updateFormData('config', { [field]: value });
  }

  function toggleMonth(month) {
    const current = config.asambleas || [];
    const updated = current.includes(month)
      ? current.filter(m => m !== month)
      : [...current, month];
    useWizardStore.getState().setFormDataField('config', { ...config, asambleas: updated });
  }

  function handleNext() {
    if (!(config.asambleas || []).length) {
      addToast('Selecciona al menos un mes para asambleas', 'error');
      return;
    }
    onNext();
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Configuración Preliminar
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        Estos datos son preliminares y se confirmarán en la asamblea constitutiva.
      </p>

      <div style={{ display: 'grid', gap: 24 }}>
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Meses de Asambleas Ordinarias</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {MONTHS.map(m => {
              const selected = (config.asambleas || []).includes(m);
              return (
                <button key={m} onClick={() => toggleMonth(m)} style={{
                  padding: '8px 14px', borderRadius: 20,
                  border: selected ? '2px solid #2563eb' : '1px solid #d1d5db',
                  background: selected ? '#eff6ff' : 'white',
                  color: selected ? '#2563eb' : '#374151',
                  fontSize: 13, fontWeight: selected ? 600 : 400, cursor: 'pointer'
                }}>
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Cuota de Socios (UTM)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 300 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Mínima</label>
              <input type="number" step="0.01" value={config.cuotaMin ?? 0.1}
                onChange={e => update('cuotaMin', parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Máxima</label>
              <input type="number" step="0.01" value={config.cuotaMax ?? 0.5}
                onChange={e => update('cuotaMax', parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Disolución</h3>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Entidad beneficiaria en caso de disolución
          </label>
          <input value={config.beneficiarioDisolucion || ''}
            onChange={e => update('beneficiarioDisolucion', e.target.value)}
            placeholder="Nombre de entidad..."
            style={{ width: '100%', maxWidth: 400, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={handleNext} style={nextBtn}>Siguiente</button>
      </div>
    </div>
  );
}

const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
const nextBtn = { padding: '12px 28px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
