import { useState, useEffect } from 'react';
import { useWizardStore } from '../../../stores/wizardStore';
import { useUiStore } from '../../../stores/uiStore';
import { apiService } from '@services/ApiService.js';
import tenant from '../../../../config/tenant.js';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const UTM_FALLBACK = 65000;
const UF_FALLBACK = 38000;

const CURRENCY_OPTIONS = [
  { key: 'UTM', label: 'UTM (Unidad Tributaria Mensual)' },
  { key: 'UF', label: 'UF (Unidad de Fomento)' },
  { key: 'CLP', label: 'Pesos Chilenos (CLP)' },
];

function formatCLP(amount) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
}

export default function Step3_Config({ onNext, onPrev }) {
  const { formData, updateFormData, templateConfig } = useWizardStore();
  const addToast = useUiStore(s => s.addToast);
  const config = formData.config || {};
  const [utmValue, setUtmValue] = useState(UTM_FALLBACK);
  const [ufValue, setUfValue] = useState(UF_FALLBACK);

  const moneda = config.monedaCuota || 'UTM';

  // Municipality institutional data from DB (for dissolution auto-fill)
  const [muniData, setMuniData] = useState(null);

  useEffect(() => {
    apiService.getMunicipalityConfig()
      .then(res => { if (res.data) setMuniData(res.data); })
      .catch(() => {});
  }, []);

  // Fetch UTM and UF values from mindicador.cl
  useEffect(() => {
    async function fetchIndicadores() {
      try {
        const [utmRes, ufRes] = await Promise.all([
          fetch('https://mindicador.cl/api/utm').then(r => r.json()).catch(() => null),
          fetch('https://mindicador.cl/api/uf').then(r => r.json()).catch(() => null),
        ]);
        const utmVal = utmRes?.serie?.[0]?.valor;
        const ufVal = ufRes?.serie?.[0]?.valor;
        if (utmVal && typeof utmVal === 'number') setUtmValue(utmVal);
        if (ufVal && typeof ufVal === 'number') setUfValue(ufVal);
      } catch {
        // Fallback silently
      }
    }
    fetchIndicadores();
  }, []);

  // Set default duracionMandato from template when it loads
  useEffect(() => {
    if (templateConfig?.mandatoOpciones?.length && !config.duracionMandato) {
      updateFormData('config', { duracionMandato: templateConfig.mandatoOpciones[0] });
    }
  }, [templateConfig]);

  function update(field, value) {
    updateFormData('config', { [field]: value });
  }

  function handleCurrencyChange(newMoneda) {
    // Reset cuota values when switching currency to avoid confusion
    const defaults = newMoneda === 'CLP'
      ? { cuotaMin: 5000, cuotaMax: 30000, cuotaIncorporacion: 30000 }
      : newMoneda === 'UF'
        ? { cuotaMin: 0.1, cuotaMax: 0.5, cuotaIncorporacion: 0.5 }
        : { cuotaMin: 0.1, cuotaMax: 0.5, cuotaIncorporacion: 0.5 };
    updateFormData('config', { monedaCuota: newMoneda, ...defaults });
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

  // CLP equivalence hint for UTM/UF values
  const clpHint = (amount) => {
    if (!amount || amount <= 0 || moneda === 'CLP') return null;
    const factor = moneda === 'UF' ? ufValue : utmValue;
    return (
      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
        Equivale aprox. a {formatCLP(amount * factor)}
      </p>
    );
  };

  const currencyLabel = moneda === 'CLP' ? '$' : moneda;
  const step = moneda === 'CLP' ? 1000 : 0.01;

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

        {/* Moneda de cuotas */}
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Moneda para Cuotas</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {CURRENCY_OPTIONS.map(opt => {
              const selected = moneda === opt.key;
              return (
                <button key={opt.key} onClick={() => handleCurrencyChange(opt.key)} style={{
                  padding: '8px 16px', borderRadius: 20,
                  border: selected ? '2px solid #2563eb' : '1px solid #d1d5db',
                  background: selected ? '#eff6ff' : 'white',
                  color: selected ? '#2563eb' : '#374151',
                  fontSize: 13, fontWeight: selected ? 600 : 400, cursor: 'pointer'
                }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
          {moneda !== 'CLP' && (
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
              Valor {moneda} actual: {formatCLP(moneda === 'UF' ? ufValue : utmValue)}
            </p>
          )}
        </div>

        {/* Cuota de socios */}
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>
            Cuota de Socios ({currencyLabel})
          </h3>
          <div className="r-form-row" style={{ maxWidth: 350 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Mínima</label>
              <div style={{ position: 'relative' }}>
                <input type="number" step={step} value={config.cuotaMin ?? (moneda === 'CLP' ? 5000 : 0.1)}
                  onChange={e => update('cuotaMin', parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '10px 10px 10px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
              </div>
              {clpHint(config.cuotaMin ?? (moneda === 'CLP' ? 5000 : 0.1))}
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Máxima</label>
              <input type="number" step={step} value={config.cuotaMax ?? (moneda === 'CLP' ? 30000 : 0.5)}
                onChange={e => update('cuotaMax', parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
              {clpHint(config.cuotaMax ?? (moneda === 'CLP' ? 30000 : 0.5))}
            </div>
          </div>
        </div>

        {(() => {
          const mandatoTipo = templateConfig?.mandatoTipo || 'fijo';
          const mandatoOpciones = templateConfig?.mandatoOpciones || [3];
          const isFijo = mandatoTipo === 'fijo';

          return (
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Directorio</h3>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Duración del mandato
              </label>
              {isFijo ? (
                <>
                  <input value={`${mandatoOpciones[0]} año${mandatoOpciones[0] > 1 ? 's' : ''}`}
                    disabled
                    style={{ width: '100%', maxWidth: 200, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, background: '#f3f4f6', color: '#6b7280' }} />
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6b7280' }}>
                    Duración establecida por normativa para esta organización.
                  </p>
                </>
              ) : (
                <select value={config.duracionMandato ?? mandatoOpciones[0]}
                  onChange={e => update('duracionMandato', parseInt(e.target.value))}
                  style={{ width: '100%', maxWidth: 200, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                  {mandatoOpciones.map(n => (
                    <option key={n} value={n}>{n} año{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })()}

        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Citaciones a Asambleas</h3>
          <div className="r-form-row" style={{ maxWidth: 500 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Método de citación</label>
              <select value={config.metodoCitacion || 'carta_certificada'}
                onChange={e => update('metodoCitacion', e.target.value)}
                style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                <option value="carta_certificada">Carta certificada</option>
                <option value="correo_electronico">Correo Electrónico</option>
                <option value="mensajeria_instantanea">Mensajería Instantánea (ej: WhatsApp)</option>
                <option value="entrega_personal">Entrega personal por escrito</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Días de anticipación</label>
              <input type="number" min={5} max={30} value={config.diasAnticipacion ?? 10}
                onChange={e => update('diasAnticipacion', parseInt(e.target.value) || 10)}
                style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Comisión Revisora de Cuentas</h3>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Mes de balance anual
          </label>
          <select value={config.accountReviewMonth || 'Marzo'}
            onChange={e => update('accountReviewMonth', e.target.value)}
            style={{ width: '100%', maxWidth: 250, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
            {MONTHS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
            Mes en que la Comisión Revisora presenta el informe de cuentas a la asamblea.
          </p>
        </div>

        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>
            Cuota de Incorporación ({currencyLabel})
          </h3>
          <input type="number" step={step} min={0} value={config.cuotaIncorporacion ?? (moneda === 'CLP' ? 30000 : 0.5)}
            onChange={e => update('cuotaIncorporacion', parseFloat(e.target.value) || 0)}
            style={{ width: '100%', maxWidth: 200, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
          {clpHint(config.cuotaIncorporacion ?? (moneda === 'CLP' ? 30000 : 0.5))}
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>Monto que pagan nuevos socios al ingresar</p>
        </div>

        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Disolución</h3>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
            Institución sin fines de lucro que recibirá los bienes de esta organización en caso de que algún día deje de existir o se disuelva.
          </p>

          <div style={{ display: 'grid', gap: 12, maxWidth: 500 }}>
            <div>
              <label style={labelSt}>Entidad beneficiaria</label>
              <select
                value={config.tipoEntidadDisolucion || ''}
                onChange={e => {
                  const tipo = e.target.value;
                  const store = useWizardStore.getState();
                  if (tipo === 'municipalidad') {
                    store.setFormDataField('config', {
                      ...store.formData.config,
                      tipoEntidadDisolucion: tipo,
                      beneficiarioDisolucion: muniData?.officialName || tenant.municipalityFullName || `Ilustre Municipalidad de ${tenant.communeName}`,
                      rutDisolucion: muniData?.rut || ''
                    });
                  } else if (tipo === 'bomberos') {
                    store.setFormDataField('config', {
                      ...store.formData.config,
                      tipoEntidadDisolucion: tipo,
                      beneficiarioDisolucion: 'Cuerpo de Bomberos de ' + tenant.communeName,
                      rutDisolucion: ''
                    });
                  } else if (tipo === 'cruz_roja') {
                    store.setFormDataField('config', {
                      ...store.formData.config,
                      tipoEntidadDisolucion: tipo,
                      beneficiarioDisolucion: 'Cruz Roja Chilena',
                      rutDisolucion: ''
                    });
                  } else if (tipo === 'otra') {
                    store.setFormDataField('config', {
                      ...store.formData.config,
                      tipoEntidadDisolucion: tipo,
                      beneficiarioDisolucion: '',
                      rutDisolucion: ''
                    });
                  } else {
                    store.setFormDataField('config', {
                      ...store.formData.config,
                      tipoEntidadDisolucion: '',
                      beneficiarioDisolucion: '',
                      rutDisolucion: ''
                    });
                  }
                }}
                style={inputSt}
              >
                <option value="">Seleccione una entidad...</option>
                <option value="municipalidad">Municipalidad</option>
                <option value="bomberos">Cuerpo de Bomberos</option>
                <option value="cruz_roja">Cruz Roja Chilena</option>
                <option value="otra">Otra institución (Personalizada)</option>
              </select>
            </div>

            {config.tipoEntidadDisolucion && (
              <div className="r-form-row">
                <div>
                  <label style={labelSt}>Nombre de la entidad</label>
                  {config.tipoEntidadDisolucion === 'otra' ? (
                    <input
                      value={config.beneficiarioDisolucion || ''}
                      onChange={e => update('beneficiarioDisolucion', e.target.value)}
                      placeholder="Nombre de la institución sin fines de lucro"
                      style={inputSt}
                    />
                  ) : (
                    <input
                      value={config.beneficiarioDisolucion || ''}
                      readOnly
                      style={{ ...inputSt, background: '#f3f4f6', color: '#6b7280' }}
                    />
                  )}
                </div>
                <div>
                  <label style={labelSt}>RUT de la entidad</label>
                  {config.tipoEntidadDisolucion === 'municipalidad' && muniData?.rut ? (
                    <input
                      value={config.rutDisolucion || ''}
                      readOnly
                      style={{ ...inputSt, background: '#f3f4f6', color: '#6b7280' }}
                    />
                  ) : (
                    <input
                      value={config.rutDisolucion || ''}
                      onChange={e => update('rutDisolucion', e.target.value)}
                      placeholder="Ej: 70.000.000-0"
                      style={inputSt}
                    />
                  )}
                </div>
              </div>
            )}

            {config.tipoEntidadDisolucion === 'municipalidad' && (
              <div style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, color: '#1e40af' }}>
                Los datos de la municipalidad se completan automáticamente desde la configuración institucional.
                {!muniData?.rut && (
                  <span style={{ display: 'block', marginTop: 4, color: '#92400e' }}>
                    El RUT de la municipalidad aún no ha sido configurado por el Secretario Municipal. Ingréselo manualmente.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={handleNext} style={nextBtn}>Siguiente</button>
      </div>
    </div>
  );
}

const labelSt = { fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 };
const inputSt = { width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
const nextBtn = { padding: '12px 28px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
