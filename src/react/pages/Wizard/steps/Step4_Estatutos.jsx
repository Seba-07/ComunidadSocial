import { useState } from 'react';
import { useWizardStore } from '../../../stores/wizardStore';
import { useUiStore } from '../../../stores/uiStore';
import FileUpload from '../../../components/ui/FileUpload';

export default function Step4_Estatutos({ onNext, onPrev }) {
  const { formData, setFormDataField } = useWizardStore();
  const addToast = useUiStore(s => s.addToast);
  const estatutos = formData.estatutos || { type: 'template', content: null };
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  function setType(type) {
    setFormDataField('estatutos', { ...estatutos, type, content: null, customFile: null });
  }

  function handleEditTemplate() {
    setEditContent(estatutos.content || 'Los estatutos serán generados automáticamente basados en la Ley 19.418 y el tipo de organización seleccionada.');
    setEditing(true);
  }

  function saveEdit() {
    setFormDataField('estatutos', { ...estatutos, content: editContent });
    setEditing(false);
    addToast('Estatutos guardados', 'success');
  }

  function handleCustomFile(file) {
    if (!file) {
      setFormDataField('estatutos', { type: 'custom', content: null, customFile: null });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormDataField('estatutos', {
        type: 'custom',
        content: null,
        customFile: { name: file.name, data: reader.result, type: file.type }
      });
    };
    reader.readAsDataURL(file);
  }

  function handleNext() {
    onNext();
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Estatutos
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        Selecciona cómo configurar los estatutos de tu organización.
      </p>

      <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
        {[
          { key: 'template', label: 'Usar plantilla automática', desc: 'Generados según Ley 19.418 y tipo de organización' },
          { key: 'custom', label: 'Subir estatutos personalizados', desc: 'Sube tu propio archivo (PDF, DOC, DOCX)' }
        ].map(opt => (
          <div
            key={opt.key}
            onClick={() => setType(opt.key)}
            style={{
              padding: 16, borderRadius: 12, cursor: 'pointer',
              border: estatutos.type === opt.key ? '2px solid #2563eb' : '1px solid #d1d5db',
              background: estatutos.type === opt.key ? '#eff6ff' : 'white'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: estatutos.type === opt.key ? '6px solid #2563eb' : '2px solid #d1d5db'
              }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{opt.label}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{opt.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {estatutos.type === 'template' && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          {editing ? (
            <>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={12}
                style={{
                  width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 8,
                  fontSize: 14, fontFamily: 'inherit', resize: 'vertical'
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={saveEdit} style={{
                  padding: '8px 16px', border: 'none', borderRadius: 8,
                  background: '#2563eb', color: 'white', fontSize: 13, cursor: 'pointer'
                }}>Guardar</button>
                <button onClick={() => setEditing(false)} style={{
                  padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8,
                  background: 'white', fontSize: 13, cursor: 'pointer'
                }}>Cancelar</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', whiteSpace: 'pre-wrap' }}>
                {estatutos.content || 'Los estatutos serán generados automáticamente basados en la Ley 19.418 y el tipo de organización seleccionada.'}
              </p>
              <button onClick={handleEditTemplate} style={{
                padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8,
                background: 'white', fontSize: 13, cursor: 'pointer'
              }}>Editar</button>
            </>
          )}
        </div>
      )}

      {estatutos.type === 'custom' && (
        <div>
          <FileUpload
            accept=".pdf,.doc,.docx"
            label="Arrastra o selecciona tus estatutos (PDF, DOC, DOCX)"
            maxSizeMB={10}
            onFile={handleCustomFile}
            value={estatutos.customFile}
          />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={handleNext} style={nextBtnS}>Siguiente</button>
      </div>
    </div>
  );
}

const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
const nextBtnS = { padding: '12px 28px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
