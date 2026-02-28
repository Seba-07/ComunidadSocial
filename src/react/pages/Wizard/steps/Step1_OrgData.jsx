import { useWizardStore } from '../../../stores/wizardStore';
import { useUiStore } from '../../../stores/uiStore';

const CONTACT_PREFS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'whatsapp', label: 'WhatsApp' }
];

export default function Step1_OrgData({ onNext, isFirst }) {
  const { formData, updateFormData, organizationTypes } = useWizardStore();
  const addToast = useUiStore(s => s.addToast);
  const org = formData.organization;

  function update(field, value) {
    updateFormData('organization', { [field]: value });
  }

  function validate() {
    if (!org.type) return 'Selecciona un tipo de organización';
    if (!org.name?.trim()) return 'Ingresa el nombre';
    if (!org.street?.trim()) return 'Ingresa la calle';
    if (!org.email?.trim()) return 'Ingresa un email de contacto';
    return null;
  }

  function handleNext() {
    const err = validate();
    if (err) { addToast(err, 'error'); return; }
    onNext();
  }

  // Group types by category
  const grouped = {};
  if (Array.isArray(organizationTypes)) {
    organizationTypes.forEach(t => {
      const cat = t.category || 'Otros';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    });
  } else if (typeof organizationTypes === 'object') {
    Object.entries(organizationTypes).forEach(([cat, types]) => {
      grouped[cat] = Array.isArray(types) ? types : [];
    });
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Datos de la Organización
      </h2>

      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <label style={labelStyle}>Tipo de Organización *</label>
          <select value={org.type} onChange={e => update('type', e.target.value)} style={inputStyle}>
            <option value="">Seleccionar tipo...</option>
            {Object.entries(grouped).map(([cat, types]) => (
              <optgroup key={cat} label={cat}>
                {types.map(t => (
                  <option key={t.tipo || t.value} value={t.tipo || t.value}>
                    {t.label || t.nombre || t.tipo}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Nombre *</label>
          <input value={org.name} onChange={e => update('name', e.target.value)}
            placeholder="Nombre de la organización" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Descripción</label>
          <textarea value={org.description || ''} onChange={e => update('description', e.target.value)}
            rows={3} placeholder="Descripción breve..." style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Calle *</label>
            <input value={org.street} onChange={e => update('street', e.target.value)}
              placeholder="Calle" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Número</label>
            <input value={org.streetNumber || ''} onChange={e => update('streetNumber', e.target.value)}
              placeholder="N°" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Región</label>
            <input value={org.region} disabled style={{ ...inputStyle, background: '#f3f4f6' }} />
          </div>
          <div>
            <label style={labelStyle}>Comuna</label>
            <input value={org.commune} disabled style={{ ...inputStyle, background: '#f3f4f6' }} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Unidad Vecinal</label>
          <input value={org.neighborhood || ''} onChange={e => update('neighborhood', e.target.value)}
            placeholder="Número de unidad vecinal" style={inputStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Email de contacto *</label>
            <input type="email" value={org.email} onChange={e => update('email', e.target.value)}
              placeholder="email@ejemplo.cl" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Teléfono</label>
            <input value={org.phone || ''} onChange={e => update('phone', e.target.value)}
              placeholder="+56 9 1234 5678" style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Preferencia de contacto</label>
          <select value={org.contactPreference} onChange={e => update('contactPreference', e.target.value)} style={inputStyle}>
            {CONTACT_PREFS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <button onClick={handleNext} style={nextBtn}>Siguiente</button>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontWeight: 600, fontSize: 14, color: '#374151', marginBottom: 6 };
const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14 };
const nextBtn = {
  padding: '12px 28px', border: 'none', borderRadius: 10,
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white',
  fontSize: 15, fontWeight: 600, cursor: 'pointer'
};
