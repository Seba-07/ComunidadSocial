import { useState, useEffect } from 'react';
import useDebounce from '../../hooks/useDebounce';

export default function SearchBar({ value, onChange, placeholder = 'Buscar...', delay = 300 }) {
  const [local, setLocal] = useState(value || '');
  const debounced = useDebounce(local, delay);

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
  }, [debounced]);

  // Sync external value changes
  useEffect(() => {
    if (value !== undefined && value !== local) setLocal(value);
  }, [value]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={local}
        onChange={e => setLocal(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 16px 10px 40px',
          border: '1px solid #d1d5db',
          borderRadius: 10,
          fontSize: 14,
          outline: 'none',
          background: '#f9fafb',
          transition: 'border-color 0.15s'
        }}
        onFocus={e => e.target.style.borderColor = '#2563eb'}
        onBlur={e => e.target.style.borderColor = '#d1d5db'}
      />
      <span style={{
        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        color: '#9ca3af', fontSize: 16, pointerEvents: 'none'
      }}>
        &#128269;
      </span>
      {local && (
        <button
          onClick={() => { setLocal(''); onChange(''); }}
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer',
            fontSize: 18, lineHeight: 1, padding: 2
          }}
        >
          &times;
        </button>
      )}
    </div>
  );
}
