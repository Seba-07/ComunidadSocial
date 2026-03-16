import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizardStore } from '../../../stores/wizardStore';
import { useAuthStore } from '../../../stores/authStore';
import { useUiStore } from '../../../stores/uiStore';
import { apiService } from '../../../../services/ApiService';

const UVMiniMap = lazy(() => import('./UVMiniMap'));

const OBJETIVOS_SUGERIDOS = {
  JUNTA_VECINOS: [
    'Promover el desarrollo de la comunidad territorial y la participación ciudadana',
    'Representar a los vecinos ante autoridades municipales y otros organismos',
    'Gestionar el mejoramiento de espacios públicos, áreas verdes e infraestructura del barrio',
    'Organizar actividades de integración social, cultural y recreativa para los vecinos',
    'Velar por la seguridad y convivencia pacífica en la unidad vecinal'
  ],
  CLUB_DEPORTIVO: [
    'Fomentar la práctica deportiva y la vida sana entre sus socios y la comunidad',
    'Organizar competencias, campeonatos y actividades deportivas periódicas',
    'Gestionar espacios e implementación deportiva para el desarrollo de las actividades',
    'Promover la formación deportiva de niños, jóvenes y adultos de la comuna',
    'Representar a la comunidad en campeonatos y torneos a nivel local y regional'
  ],
  CLUB_ADULTO_MAYOR: [
    'Promover el bienestar físico, mental y social de las personas mayores',
    'Organizar actividades recreativas, culturales y de esparcimiento',
    'Facilitar el acceso a programas de salud, talleres y capacitaciones',
    'Fomentar la participación activa y la integración social de los adultos mayores',
    'Gestionar beneficios y convenios para mejorar la calidad de vida de los socios'
  ],
  CENTRO_MADRES: [
    'Promover el desarrollo personal, laboral y social de las socias',
    'Organizar talleres de capacitación y emprendimiento',
    'Fomentar la participación comunitaria y el apoyo mutuo entre mujeres',
    'Gestionar redes de apoyo y acceso a programas sociales',
    'Difundir los derechos de la mujer y la igualdad de género'
  ],
  ORG_MUJERES: [
    'Promover el desarrollo personal, laboral y social de las socias',
    'Organizar talleres de capacitación y emprendimiento',
    'Fomentar la participación comunitaria y el apoyo mutuo entre mujeres',
    'Gestionar redes de apoyo y acceso a programas sociales',
    'Difundir los derechos de la mujer y la igualdad de género'
  ],
  COMITE_VIVIENDA: [
    'Gestionar soluciones habitacionales para las familias socias',
    'Representar a los socios ante organismos públicos vinculados a la vivienda (SERVIU, MINVU)',
    'Organizar y administrar proyectos de postulación a subsidios habitacionales',
    'Promover la participación activa de las familias en el proceso de obtención de vivienda',
    'Realizar actividades de recaudación de fondos para el proyecto habitacional'
  ],
  COMITE_ALLEGADOS: [
    'Gestionar soluciones habitacionales para las familias socias',
    'Representar a los socios ante organismos públicos vinculados a la vivienda (SERVIU, MINVU)',
    'Organizar y administrar proyectos de postulación a subsidios habitacionales',
    'Promover la participación activa de las familias en el proceso de obtención de vivienda',
    'Realizar actividades de recaudación de fondos para el proyecto habitacional'
  ],
  CENTRO_PADRES: [
    'Fomentar la formación y desarrollo integral de los hijos',
    'Integrar a los padres y apoderados en la comunidad educativa',
    'Establecer vínculos entre el hogar y la escuela',
    'Proponer iniciativas de formación integral para los estudiantes',
    'Participar en programas de desarrollo educativo de la institución'
  ],
  CLUB_CULTURAL: [
    'Promover actividades artísticas y culturales en la comunidad',
    'Organizar talleres, exposiciones y eventos culturales',
    'Rescatar y difundir el patrimonio cultural local',
    'Fomentar la creación artística entre los socios',
    'Gestionar espacios para la realización de actividades culturales'
  ],
  CENTRO_CULTURAL: [
    'Promover actividades artísticas y culturales en la comunidad',
    'Organizar talleres, exposiciones y eventos culturales',
    'Rescatar y difundir el patrimonio cultural local',
    'Fomentar la creación artística entre los socios',
    'Gestionar espacios para la realización de actividades culturales'
  ],
  AGRUPACION_CULTURAL: [
    'Promover actividades artísticas y culturales en la comunidad',
    'Organizar talleres, exposiciones y eventos culturales',
    'Rescatar y difundir el patrimonio cultural local',
    'Fomentar la creación artística entre los socios',
    'Gestionar espacios para la realización de actividades culturales'
  ],
  COMITE_SEGURIDAD: [
    'Promover la seguridad ciudadana en el barrio',
    'Organizar sistemas de vigilancia vecinal',
    'Coordinar con Carabineros y autoridades locales en prevención del delito',
    'Fomentar la prevención del delito y la convivencia pacífica',
    'Gestionar iluminación y mejoras de infraestructura de seguridad'
  ],
  _DEFAULT: [
    'Promover la integración, participación y desarrollo de la comunidad',
    'Canalizar las aptitudes, intereses y capacidades de sus miembros',
    'Organizar actividades que contribuyan al cumplimiento de sus fines',
    'Gestionar recursos para el desarrollo de las actividades de la organización',
    'Representar a los socios ante las autoridades e instituciones pertinentes'
  ]
};

function getObjetivos(tipo, templateConfig) {
  if (templateConfig?.objetivosSugeridos?.length > 0) {
    return templateConfig.objetivosSugeridos;
  }
  return OBJETIVOS_SUGERIDOS[tipo] || OBJETIVOS_SUGERIDOS._DEFAULT;
}

const CONTACT_PREFS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'whatsapp', label: 'WhatsApp' }
];

export default function Step1_OrgData({ onNext, isFirst }) {
  const { formData, updateFormData, organizationTypes, fetchTemplateConfig, templateConfig, saveProgress } = useWizardStore();
  const user = useAuthStore(s => s.user);
  const addToast = useUiStore(s => s.addToast);
  const navigate = useNavigate();
  const org = formData.organization;

  // Pre-load email and phone from user profile if empty
  useEffect(() => {
    const updates = {};
    if (!org.email && user?.email) updates.email = user.email;
    if (!org.phone && user?.phone) updates.phone = user.phone;
    if (Object.keys(updates).length) updateFormData('organization', updates);
    // Always refresh template config on mount if org type is already set
    if (org.type) fetchTemplateConfig(org.type).catch(() => {});
  }, []);

  // UV auto-detection state
  const [uvOptions, setUvOptions] = useState([]);
  const [uvDetected, setUvDetected] = useState(null); // { numero, nombre, geometry, coords }
  const [uvSearching, setUvSearching] = useState(false);
  const [customObj, setCustomObj] = useState('');
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

        {org.type && (() => {
          const sugeridos = getObjetivos(org.type, templateConfig);
          const seleccionados = (org.objectives || '').split('\n').filter(Boolean);
          const personalizados = seleccionados.filter(o => !sugeridos.includes(o));

          function toggleObj(obj) {
            const current = (org.objectives || '').split('\n').filter(Boolean);
            const exists = current.includes(obj);
            const updated = exists ? current.filter(o => o !== obj) : [...current, obj];
            update('objectives', updated.join('\n'));
          }

          function addCustomObj() {
            if (!customObj.trim()) return;
            const current = (org.objectives || '').split('\n').filter(Boolean);
            if (!current.includes(customObj.trim())) {
              current.push(customObj.trim());
              update('objectives', current.join('\n'));
            }
            setCustomObj('');
          }

          function removeObj(obj) {
            const current = (org.objectives || '').split('\n').filter(Boolean);
            update('objectives', current.filter(o => o !== obj).join('\n'));
          }

          return (
            <div>
              <label style={labelStyle}>Objetivos de la Organización</label>
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
                padding: 12, marginBottom: 12, fontSize: 13, color: '#1e40af'
              }}>
                Estos objetivos aparecerán en el Artículo 2 de los estatutos. Selecciona los que apliquen o agrega uno personalizado.
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {sugeridos.map((obj, i) => {
                  const selected = seleccionados.includes(obj);
                  return (
                    <label key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
                      padding: '8px 12px', borderRadius: 8,
                      background: selected ? '#f0fdf4' : '#f9fafb',
                      border: selected ? '1px solid #86efac' : '1px solid #e5e7eb',
                    }}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleObj(obj)}
                        style={{ marginTop: 2 }}
                      />
                      <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{obj}</span>
                    </label>
                  );
                })}
              </div>

              {personalizados.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 6, display: 'block' }}>
                    Objetivos personalizados
                  </label>
                  {personalizados.map((obj, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
                      padding: '8px 12px', borderRadius: 8,
                      background: '#fef3c7', border: '1px solid #fcd34d'
                    }}>
                      <span style={{ flex: 1, fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{obj}</span>
                      <button type="button" onClick={() => removeObj(obj)} style={{
                        background: 'none', border: 'none', color: '#ef4444',
                        fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1
                      }} title="Eliminar objetivo">&times;</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  value={customObj}
                  onChange={e => setCustomObj(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomObj();
                    }
                  }}
                  placeholder="Agregar objetivo personalizado (Enter para agregar)"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button type="button" onClick={addCustomObj} disabled={!customObj.trim()} style={{
                  padding: '10px 16px', border: 'none', borderRadius: 8, background: '#2563eb',
                  color: 'white', fontSize: 13, fontWeight: 600,
                  cursor: customObj.trim() ? 'pointer' : 'not-allowed',
                  opacity: customObj.trim() ? 1 : 0.5
                }}>Agregar</button>
              </div>
            </div>
          );
        })()}

        <div className="r-form-row">
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

        <div className="r-form-row">
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

        <div className="r-form-row">
          <div>
            <label style={labelStyle}>Email de contacto *</label>
            <input type="email" value={org.email} disabled style={{ ...inputStyle, background: '#f3f4f6' }} />
          </div>
          <div>
            <label style={labelStyle}>Teléfono</label>
            <input value={org.phone || ''} disabled style={{ ...inputStyle, background: '#f3f4f6' }} />
          </div>
        </div>
        <p style={{ margin: '-4px 0 8px', fontSize: 12, color: '#6b7280' }}>
          Email y teléfono provienen de tu perfil.{' '}
          <button type="button" onClick={() => { saveProgress(); navigate('/org/auto?tab=configuracion'); }}
            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, textDecoration: 'underline' }}>
            Cambiar en Configuración
          </button>
        </p>

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
