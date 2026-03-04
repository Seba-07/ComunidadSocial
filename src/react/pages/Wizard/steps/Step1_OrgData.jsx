import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useWizardStore } from '../../../stores/wizardStore';
import { useUiStore } from '../../../stores/uiStore';
import { apiService } from '../../../../services/ApiService';

const UVMiniMap = lazy(() => import('./UVMiniMap'));

const CONTACT_PREFS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'whatsapp', label: 'WhatsApp' }
];

export default function Step1_OrgData({ onNext, isFirst }) {
  const { formData, updateFormData, organizationTypes, fetchTemplateConfig } = useWizardStore();
  const addToast = useUiStore(s => s.addToast);
  const org = formData.organization;

  // UV auto-detection state
  const [uvOptions, setUvOptions] = useState([]);
  const [uvDetected, setUvDetected] = useState(null); // { numero, nombre, geometry, coords }
  const [uvSearching, setUvSearching] = useState(false);
  const debounceRef = useRef(null);

  // Load UV options for dropdown on mount
  useEffect(() => {
    apiService.get('/unidades-vecinales').then(data => {
      const uvs = data.unidades || data || [];
      setUvOptions(uvs.map(uv => ({
        value: uv.numero,
        label: `UV ${uv.numero}${uv.nombre ? ` - ${uv.nombre}` : ''}`,
        nombre: uv.nombre
      })));
    }).catch(() => {});
  }, []);

  function update(field, value) {
    updateFormData('organization', { [field]: value });
  }

  // Auto-detect UV when street changes
  const searchUV = useCallback((street, number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const fullAddress = `${street || ''} ${number || ''}`.trim();
    if (fullAddress.length < 5) {
      setUvDetected(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setUvSearching(true);
      try {
        const result = await apiService.get(`/unidades-vecinales/buscar?direccion=${encodeURIComponent(fullAddress)}`);
        if (result.encontrada && result.unidadVecinal) {
          const uv = result.unidadVecinal;
          setUvDetected({
            numero: uv.numero,
            nombre: uv.nombre,
            geometry: uv.geometry || null,
            coords: result.coords || null
          });
          if (!org.neighborhood || org.neighborhood !== uv.numero) {
            update('neighborhood', uv.numero);
          }
        } else {
          setUvDetected(null);
        }
      } catch {
        setUvDetected(null);
      } finally {
        setUvSearching(false);
      }
    }, 600);
  }, [org.neighborhood]);

  function handleStreetChange(value) {
    update('street', value);
    searchUV(value, org.streetNumber);
  }

  function handleNumberChange(value) {
    update('streetNumber', value);
    searchUV(org.street, value);
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
          <select value={org.type} onChange={e => {
            const tipo = e.target.value;
            update('type', tipo);
            if (tipo) fetchTemplateConfig(tipo);
          }} style={inputStyle}>
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
            <input value={org.street} onChange={e => handleStreetChange(e.target.value)}
              placeholder="Calle" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Número</label>
            <input value={org.streetNumber || ''} onChange={e => handleNumberChange(e.target.value)}
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

        {/* Unidad Vecinal with auto-detection */}
        <div>
          <label style={labelStyle}>
            Unidad Vecinal
            {uvSearching && (
              <span style={{ fontWeight: 400, fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
                Buscando...
              </span>
            )}
          </label>
          <select
            value={org.neighborhood || ''}
            onChange={e => { update('neighborhood', e.target.value); setUvDetected(null); }}
            style={inputStyle}
          >
            <option value="">Seleccionar unidad vecinal...</option>
            {uvOptions.map(uv => (
              <option key={uv.value} value={uv.value}>{uv.label}</option>
            ))}
          </select>
          {uvDetected && (
            <div style={{
              marginTop: 6, padding: '6px 12px', borderRadius: 8,
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 6
            }}>
              <span>&#10003;</span>
              <span>
                Detectada automáticamente: <strong>UV {uvDetected.numero}</strong>
                {uvDetected.nombre ? ` — ${uvDetected.nombre}` : ''}
              </span>
            </div>
          )}
          {!uvDetected && org.street && org.street.length >= 5 && !uvSearching && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
              No se detectó unidad vecinal. Puedes seleccionarla manualmente.
            </p>
          )}
          {uvDetected?.geometry?.coordinates && (
            <div style={{ marginTop: 8 }}>
              <Suspense fallback={<div style={{ height: 180, background: '#f3f4f6', borderRadius: 8 }} />}>
                <UVMiniMap geometry={uvDetected.geometry} coords={uvDetected.coords} label={`UV ${uvDetected.numero}`} />
              </Suspense>
            </div>
          )}
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
const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' };
const nextBtn = {
  padding: '12px 28px', border: 'none', borderRadius: 10,
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white',
  fontSize: 15, fontWeight: 600, cursor: 'pointer'
};
