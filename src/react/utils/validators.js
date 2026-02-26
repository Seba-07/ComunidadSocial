/**
 * Validates a Chilean RUT (format and check digit)
 */
export function validateRut(rut) {
  const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();

  if (cleanRut.length < 8 || cleanRut.length > 9) return false;

  const body = cleanRut.slice(0, -1);
  const digit = cleanRut.slice(-1);

  if (!/^\d+$/.test(body)) return false;
  if (!/^[\dK]$/.test(digit)) return false;

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = sum % 11;
  const calculated = 11 - remainder;

  let expected;
  if (calculated === 11) expected = '0';
  else if (calculated === 10) expected = 'K';
  else expected = calculated.toString();

  return digit === expected;
}

/**
 * Formats a RUT string with dots and dash (e.g., 12.345.678-9)
 */
export function formatRut(rut) {
  const clean = rut.replace(/\./g, '').replace(/-/g, '');
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const digit = clean.slice(-1);
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${formatted}-${digit}`;
}
