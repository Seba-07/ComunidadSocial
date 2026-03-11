import { useState, useEffect } from 'react';
import { apiService } from '../../../../services/ApiService';
import { useUiStore } from '../../../stores/uiStore';

const cardStyle = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 };

export default function DataRegistryView() {
  const [registry, setRegistry] = useState(null);
  const [loading, setLoading] = useState(true);
  const addToast = useUiStore(s => s.addToast);

  useEffect(() => {
    apiService.get('/users/stats/data-processing-registry')
      .then(data => setRegistry(data))
      .catch(err => addToast('Error al cargar registro', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 24, color: '#6b7280' }}>Cargando registro...</div>;
  if (!registry) return <div style={{ padding: 24, color: '#ef4444' }}>Error al cargar registro</div>;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#111827' }}>
        Registro de Tratamiento de Datos
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>
        Ley 21.719 — Versión {registry.registroTratamientoDatos?.version || '1.0'} | Responsable: {registry.registroTratamientoDatos?.responsable}
      </p>

      {/* Categories */}
      {(registry.categoriasDatos || []).map(cat => (
        <div key={cat.id} style={cardStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 12px' }}>{cat.nombre}</h3>
          <div className="r-table-wrap" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>Campo</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>Propósito</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>Base Legal</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>Retención</th>
                </tr>
              </thead>
              <tbody>
                {(cat.campos || []).map((campo, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 6px', fontWeight: 500, color: '#111827' }}>{campo.campo}</td>
                    <td style={{ padding: '8px 6px', color: '#4b5563' }}>{campo.proposito}</td>
                    <td style={{ padding: '8px 6px', color: '#4b5563', fontSize: 12 }}>{campo.baseLegal}</td>
                    <td style={{ padding: '8px 6px', color: '#6b7280', fontSize: 12 }}>{campo.retencion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Transfer flows */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 12px' }}>Flujos de Transferencia</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {(registry.flujosTransferencia || []).map((f, i) => (
            <div key={i} style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#2563eb', minWidth: 120 }}>{f.origen}</span>
              <span style={{ color: '#9ca3af' }}>&rarr;</span>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#111827', minWidth: 120 }}>{f.destino}</span>
              <span style={{ fontSize: 12, color: '#6b7280', flex: 1 }}>{f.datos?.join(', ')}</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{f.baseLegal}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Security measures */}
      {registry.medidasSeguridad && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 12px' }}>Medidas de Seguridad</h3>
          {Object.entries(registry.medidasSeguridad).map(([key, measures]) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'capitalize', margin: '0 0 6px' }}>{key}</h4>
              <div style={{ display: 'grid', gap: 4 }}>
                {Object.entries(measures).map(([k, v]) => (
                  <div key={k} style={{ fontSize: 12, color: '#4b5563' }}>
                    <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{k}:</span> {v}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
