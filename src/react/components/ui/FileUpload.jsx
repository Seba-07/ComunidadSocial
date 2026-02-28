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

  function handleRemove() {
    setPreviewUrl(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
    onFile(null);
  }

  return (
    <div>
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
        {previewUrl ? (
          <img src={previewUrl} alt="Preview" style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 8 }} />
        ) : value ? (
          <p style={{ color: '#374151', fontSize: 14, margin: 0 }}>{typeof value === 'string' ? value : value.name}</p>
        ) : (
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>{label}</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          style={{ display: 'none' }}
        />
      </div>
      {(previewUrl || value) && (
        <button
          onClick={handleRemove}
          style={{
            marginTop: 8, background: 'none', border: 'none',
            color: '#ef4444', fontSize: 13, cursor: 'pointer'
          }}
        >
          Eliminar archivo
        </button>
      )}
      {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  );
}
