import { useRef, useState } from 'react';

export default function FileUpload({
  onFile, accept = '.pdf,.jpg,.jpeg,.png', label = 'Subir archivo',
  maxSizeMB = 5, preview = false, value = null
}) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState('');

  function handleChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Archivo muy grande (max ${maxSizeMB}MB)`);
      return;
    }

    if (preview && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    }

    onFile(file);
  }

  function handleRemove(e) {
    e.stopPropagation();
    setPreviewUrl(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
    onFile(null);
  }

  function handleView(e) {
    e.stopPropagation();
    if (!value?.data) return;
    const w = window.open('');
    if (w) {
      if (value.data.startsWith('data:application/pdf') || value.name?.endsWith('.pdf')) {
        w.document.write(`<iframe src="${value.data}" style="width:100%;height:100%;border:none;"></iframe>`);
      } else {
        w.document.write(`<img src="${value.data}" style="max-width:100%;"/>`);
      }
    }
  }

  const hasFile = previewUrl || value;
  const fileName = typeof value === 'string' ? value : value?.name || 'Archivo';
  const truncatedName = fileName.length > 32 ? fileName.slice(0, 29) + '...' : fileName;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      {hasFile ? (
        /* --- File card: loaded state --- */
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: '10px 14px',
          background: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          {/* PDF icon + green check */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <div style={{
              position: 'absolute', bottom: -2, right: -4,
              width: 14, height: 14, borderRadius: '50%',
              background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2 6 5 9 10 3"/>
              </svg>
            </div>
          </div>

          {/* Filename */}
          <span style={{
            flex: 1, fontSize: 13, color: '#374151', fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            minWidth: 0
          }} title={fileName}>
            {truncatedName}
          </span>

          {/* View button */}
          {value?.data && (
            <button onClick={handleView} title="Ver archivo" style={{
              background: 'none', border: '1px solid #e5e7eb', borderRadius: 6,
              padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
              color: '#6b7280', fontSize: 12, flexShrink: 0
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Ver
            </button>
          )}

          {/* Delete button */}
          <button onClick={handleRemove} title="Eliminar archivo" style={{
            background: 'none', border: '1px solid #fecaca', borderRadius: 6,
            padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
            color: '#ef4444', fontSize: 12, flexShrink: 0
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      ) : (
        /* --- Drop zone: empty state --- */
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            border: '2px dashed #d1d5db',
            borderRadius: 12,
            padding: 20,
            textAlign: 'center',
            cursor: 'pointer',
            background: '#f9fafb',
            transition: 'border-color 0.15s'
          }}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#2563eb'; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; }}
          onDrop={e => {
            e.preventDefault();
            e.currentTarget.style.borderColor = '#d1d5db';
            const file = e.dataTransfer.files[0];
            if (file) {
              if (file.size > maxSizeMB * 1024 * 1024) {
                setError(`Archivo muy grande (max ${maxSizeMB}MB)`);
                return;
              }
              onFile(file);
            }
          }}
        >
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>{label}</p>
        </div>
      )}

      {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  );
}
