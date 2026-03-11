import { useState, useCallback } from 'react';
import Modal from '../../../components/ui/Modal';
import { validateRut, formatRut } from '../../../utils/validators';

/**
 * MemberImportModal — Importación masiva de socios desde CSV/Excel
 * 3 pasos: Upload → Mapeo columnas → Preview + validación
 */

// Auto-detect column mapping by header name (case/accent insensitive)
const FIELD_MAPPINGS = {
  firstName: ['nombre', 'nombres', 'first_name', 'firstname', 'primer_nombre'],
  lastName: ['apellido', 'apellidos', 'last_name', 'lastname', 'primer_apellido'],
  rut: ['rut', 'run', 'cedula'],
  birthDate: ['fecha_nacimiento', 'fecha_de_nacimiento', 'nacimiento', 'birth_date', 'birthdate', 'fecha_nac', 'fec_nac'],
  email: ['email', 'correo', 'mail', 'e-mail', 'correo_electronico'],
  phone: ['telefono', 'phone', 'celular', 'fono', 'tel'],
  genero: ['genero', 'sexo', 'gender'],
  address: ['domicilio', 'direccion', 'address', 'dir', 'calle']
};

function normalizeHeader(h) {
  return (h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').trim();
}

function autoMapColumns(headers) {
  const mapping = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(FIELD_MAPPINGS)) {
      if (aliases.includes(normalized) && !mapping[field]) {
        mapping[field] = header;
        break;
      }
    }
  }
  return mapping;
}

function parseDateValue(val) {
  if (!val) return '';
  const str = String(val).trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Excel serial date (days since 1900-01-01)
  const num = Number(str);
  if (!isNaN(num) && num > 10000 && num < 60000) {
    const d = new Date((num - 25569) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return str;
}

function calculateAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function validateRow(row, existingRuts, seenRuts) {
  const errors = [];
  const warnings = [];

  if (!row.firstName?.trim()) errors.push('Falta nombre');
  if (!row.lastName?.trim()) errors.push('Falta apellido');
  if (!row.rut?.trim()) {
    errors.push('Falta RUT');
  } else {
    const formatted = formatRut(row.rut);
    if (!validateRut(formatted)) {
      errors.push('RUT inválido');
    } else {
      const clean = formatted.replace(/\./g, '').replace(/-/g, '').toLowerCase();
      if (existingRuts.has(clean)) errors.push('RUT ya existe en la nómina');
      if (seenRuts.has(clean)) errors.push('RUT duplicado en archivo');
      seenRuts.add(clean);
    }
  }

  if (!row.birthDate) {
    errors.push('Falta fecha de nacimiento');
  } else {
    const age = calculateAge(row.birthDate);
    if (age === null) errors.push('Fecha de nacimiento inválida');
    else if (age < 14) errors.push(`Edad ${age}: menor de 14 años`);
    else if (age < 18) warnings.push(`Menor de edad (${age} años)`);
  }

  return { errors, warnings };
}

export function downloadMemberTemplate() {
  const BOM = '\uFEFF';
  const rows = [
    ['Nombre', 'Apellido', 'RUT', 'Fecha de Nacimiento', 'Email', 'Teléfono', 'Género', 'Domicilio'],
    ['Juan', 'Pérez', '12.345.678-5', '15/03/1990', 'juan@email.com', '912345678', 'masculino', 'Av. Dorsal 1250, Renca'],
    ['María', 'González', '23.456.789-0', '20/07/1985', '', '', 'femenino', 'Calle Uno 345, Renca'],
  ];
  const csv = BOM + rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_nomina_socios.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function MemberImportModal({ open, onClose, existingMembers = [], onImport, edadConfig }) {
  const [step, setStep] = useState(1);
  const [rawData, setRawData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [columnMap, setColumnMap] = useState({});
  const [fileName, setFileName] = useState('');
  const [previewRows, setPreviewRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState('');

  function reset() {
    setStep(1);
    setRawData([]);
    setHeaders([]);
    setColumnMap({});
    setFileName('');
    setPreviewRows([]);
    setImporting(false);
    setParseError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  // Step 1: File upload
  const handleFile = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setParseError('');
    setFileName(file.name);

    const ext = file.name.split('.').pop().toLowerCase();

    try {
      if (ext === 'csv' || ext === 'txt') {
        const Papa = (await import('papaparse')).default;
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        if (result.errors.length > 0 && result.data.length === 0) {
          setParseError('Error al leer CSV: ' + result.errors[0].message);
          return;
        }
        setHeaders(result.meta.fields || []);
        setRawData(result.data);
      } else if (['xlsx', 'xls'].includes(ext)) {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (json.length === 0) {
          setParseError('El archivo está vacío');
          return;
        }
        setHeaders(Object.keys(json[0]));
        setRawData(json);
      } else {
        setParseError('Formato no soportado. Usa .csv, .xlsx o .xls');
        return;
      }
      setStep(2);
    } catch (err) {
      setParseError('Error al leer archivo: ' + err.message);
    }
  }, []);

  // Step 2: Auto-map and allow manual correction
  function handleMapContinue() {
    const map = { ...columnMap };
    if (!map.firstName && !map.lastName && !map.rut) {
      // Try auto-map
      const auto = autoMapColumns(headers);
      Object.assign(map, auto);
      setColumnMap(map);
    }

    if (!map.firstName || !map.lastName || !map.rut) {
      setParseError('Debes asignar al menos Nombre, Apellido y RUT');
      return;
    }

    // Build preview
    const existingRuts = new Set(existingMembers.map(m => m.rut.replace(/\./g, '').replace(/-/g, '').toLowerCase()));
    const seenRuts = new Set();

    const rows = rawData.map(raw => {
      const row = {
        firstName: String(raw[map.firstName] || '').trim(),
        lastName: String(raw[map.lastName] || '').trim(),
        rut: formatRut(String(raw[map.rut] || '').trim()),
        birthDate: parseDateValue(raw[map.birthDate]),
        email: map.email ? String(raw[map.email] || '').trim() : '',
        phone: map.phone ? String(raw[map.phone] || '').trim() : '',
        genero: map.genero ? String(raw[map.genero] || '').trim().toLowerCase() : '',
        address: map.address ? String(raw[map.address] || '').trim() : ''
      };
      const { errors, warnings } = validateRow(row, existingRuts, seenRuts);
      return { ...row, _errors: errors, _warnings: warnings };
    });

    setPreviewRows(rows);
    setParseError('');
    setStep(3);
  }

  // Initialize auto-map when entering step 2
  if (step === 2 && Object.keys(columnMap).length === 0 && headers.length > 0) {
    const auto = autoMapColumns(headers);
    setColumnMap(auto);
  }

  // Step 3: Import valid rows
  function handleImport() {
    setImporting(true);
    const valid = previewRows.filter(r => r._errors.length === 0);
    const imported = valid.map(({ _errors, _warnings, ...member }) => member);
    onImport(imported);
    setImporting(false);
    handleClose();
  }

  const validCount = previewRows.filter(r => r._errors.length === 0).length;
  const errorCount = previewRows.filter(r => r._errors.length > 0).length;
  const warnCount = previewRows.filter(r => r._errors.length === 0 && r._warnings.length > 0).length;

  return (
    <Modal open={open} onClose={handleClose} title="Importar Nómina" maxWidth={720}>
      <div>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['Archivo', 'Columnas', 'Revisión'].map((label, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: step === i + 1 ? '#2563eb' : step > i + 1 ? '#10b981' : '#f3f4f6',
              color: step >= i + 1 ? 'white' : '#9ca3af'
            }}>{i + 1}. {label}</div>
          ))}
        </div>

        {parseError && (
          <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
            {parseError}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 1 && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
              Sube un archivo CSV o Excel con los datos de los miembros.<br />
              Columnas esperadas: <strong>Nombre, Apellido, RUT, Fecha de Nacimiento</strong>
            </p>
            <button
              onClick={downloadMemberTemplate}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', background: '#f0fdf4', color: '#065f46',
                border: '1px solid #10b981', borderRadius: 8, fontSize: 13,
                fontWeight: 500, cursor: 'pointer', marginBottom: 16,
              }}
            >
              Descargar Plantilla CSV
            </button>
            <br />
            <label style={{
              display: 'inline-block', padding: '12px 32px', background: '#2563eb', color: 'white',
              borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer'
            }}>
              Seleccionar Archivo (.csv, .xlsx)
              <input type="file" accept=".csv,.xlsx,.xls,.txt" onChange={handleFile} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {/* Step 2: Column mapping */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>
              Archivo: <strong>{fileName}</strong> — {rawData.length} filas detectadas
            </p>
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>
              Asigna las columnas del archivo a los campos requeridos:
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                { field: 'firstName', label: 'Nombre *', required: true },
                { field: 'lastName', label: 'Apellido *', required: true },
                { field: 'rut', label: 'RUT *', required: true },
                { field: 'birthDate', label: 'Fecha Nacimiento *', required: true },
                { field: 'email', label: 'Email' },
                { field: 'phone', label: 'Teléfono' },
                { field: 'genero', label: 'Género' },
                { field: 'address', label: 'Domicilio' }
              ].map(({ field, label }) => (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ minWidth: 120, fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</span>
                  <select
                    value={columnMap[field] || ''}
                    onChange={(e) => setColumnMap(prev => ({ ...prev, [field]: e.target.value || undefined }))}
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
                  >
                    <option value="">— No asignar —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {columnMap[field] && <span style={{ color: '#10b981', fontSize: 16 }}>✓</span>}
                </div>
              ))}
            </div>
            <div className="r-btn-row" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => { setStep(1); setParseError(''); }} style={secondaryBtn}>Volver</button>
              <button onClick={handleMapContinue} style={primaryBtn}>Continuar</button>
            </div>
          </div>
        )}

        {/* Step 3: Preview + validation */}
        {step === 3 && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <StatBadge color="#10b981" bg="#d1fae5" label="Válidos" count={validCount} />
              <StatBadge color="#dc2626" bg="#fef2f2" label="Con errores" count={errorCount} />
              {warnCount > 0 && <StatBadge color="#d97706" bg="#fef3c7" label="Advertencias" count={warnCount} />}
            </div>

            <div className="r-table-wrap" style={{ maxHeight: 320, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Nombre</th>
                    <th style={thStyle}>Apellido</th>
                    <th style={thStyle}>RUT</th>
                    <th style={thStyle}>Edad</th>
                    <th style={thStyle}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => {
                    const hasErr = row._errors.length > 0;
                    const hasWarn = !hasErr && row._warnings.length > 0;
                    const bg = hasErr ? '#fef2f2' : hasWarn ? '#fefce8' : '#f0fdf4';
                    return (
                      <tr key={i} style={{ background: bg }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={tdStyle}>{row.firstName}</td>
                        <td style={tdStyle}>{row.lastName}</td>
                        <td style={tdStyle}>{row.rut}</td>
                        <td style={tdStyle}>{calculateAge(row.birthDate) ?? '—'}</td>
                        <td style={tdStyle}>
                          {hasErr && <span style={{ color: '#dc2626' }}>{row._errors.join(', ')}</span>}
                          {hasWarn && <span style={{ color: '#d97706' }}>{row._warnings.join(', ')}</span>}
                          {!hasErr && !hasWarn && <span style={{ color: '#059669' }}>OK</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="r-btn-row" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setStep(2)} style={secondaryBtn}>Volver</button>
              <button onClick={handleImport} disabled={validCount === 0 || importing} style={{
                ...primaryBtn, opacity: validCount === 0 ? 0.5 : 1
              }}>
                {importing ? 'Importando...' : `Importar ${validCount} miembros`}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function StatBadge({ color, bg, label, count }) {
  return (
    <div style={{ padding: '6px 14px', background: bg, borderRadius: 8, fontSize: 13, fontWeight: 600, color }}>
      {count} {label}
    </div>
  );
}

const thStyle = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' };
const tdStyle = { padding: '6px 10px', borderBottom: '1px solid #f3f4f6' };
const primaryBtn = { padding: '10px 24px', border: 'none', borderRadius: 10, background: '#2563eb', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const secondaryBtn = { padding: '10px 24px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 14, cursor: 'pointer', color: '#374151' };
