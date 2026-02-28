import { useState, useEffect } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import FileUpload from '../../../components/ui/FileUpload';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export default function TimbreFirmaView() {
  const addToast = useUiStore(s => s.addToast);
  const [config, setConfig] = useState({ timbre: null, firma: null });
  const [isLoading, setIsLoading] = useState(true);

  async function loadConfig() {
    setIsLoading(true);
    try {
      const data = await apiService.get('/users/me/timbre-firma');
      setConfig({
        timbre: data.timbreVirtual || null,
        firma: data.firmaDigital || null
      });
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadConfig(); }, []);

  async function uploadFile(type, file) {
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result;
        const endpoint = type === 'timbre' ? '/users/me/timbre-virtual' : '/users/me/firma-digital';
        await apiService.post(endpoint, { image: base64 });
        addToast(`${type === 'timbre' ? 'Timbre' : 'Firma'} actualizado`, 'success');
        loadConfig();
      };
      reader.readAsDataURL(file);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function removeFile(type) {
    try {
      const endpoint = type === 'timbre' ? '/users/me/timbre-virtual' : '/users/me/firma-digital';
      await apiService.delete(endpoint);
      setConfig(c => ({ ...c, [type]: null }));
      addToast(`${type === 'timbre' ? 'Timbre' : 'Firma'} eliminado`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  if (isLoading) return <LoadingSpinner text="Cargando configuración..." />;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700, color: '#111827' }}>
        Timbre y Firma Digital
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        Configura tu timbre virtual y firma digital para documentos oficiales.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {['timbre', 'firma'].map(type => (
          <div key={type} style={{
            background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600, color: '#111827' }}>
              {type === 'timbre' ? 'Timbre Virtual' : 'Firma Digital'}
            </h3>

            {config[type] ? (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={config[type]}
                  alt={type}
                  style={{
                    maxWidth: '100%', maxHeight: 200, borderRadius: 8,
                    border: '1px solid #e5e7eb', marginBottom: 12
                  }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button
                    onClick={() => removeFile(type)}
                    style={{
                      padding: '8px 16px', border: '1px solid #ef4444', borderRadius: 8,
                      background: 'white', color: '#ef4444', fontSize: 13, cursor: 'pointer'
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ) : (
              <FileUpload
                accept=".png,.jpg,.jpeg"
                label={`Subir ${type === 'timbre' ? 'timbre' : 'firma'} (PNG, JPG)`}
                maxSizeMB={2}
                preview
                onFile={file => uploadFile(type, file)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
