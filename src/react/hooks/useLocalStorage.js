import { useState, useCallback } from 'react';

export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const set = useCallback((newValue) => {
    try {
      const val = typeof newValue === 'function' ? newValue(value) : newValue;
      setValue(val);
      localStorage.setItem(key, JSON.stringify(val));
    } catch { /* localStorage unavailable */ }
  }, [key, value]);

  const remove = useCallback(() => {
    setValue(initialValue);
    localStorage.removeItem(key);
  }, [key, initialValue]);

  return [value, set, remove];
}
