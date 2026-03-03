import { useState, useEffect } from 'react';
import { useWizardStore } from '../../../stores/wizardStore';
import { useUiStore } from '../../../stores/uiStore';
import { apiService } from '@services/ApiService.js';
import FileUpload from '../../../components/ui/FileUpload';

const DEFAULT_CARGOS = [
  { id: 'presidente', nombre: 'Presidente/a', required: true, orden: 1 },
  { id: 'vicepresidente', nombre: 'Vicepresidente/a', required: true, orden: 2 },
  { id: 'secretario', nombre: 'Secretario/a', required: true, orden: 3 },
  { id: 'tesorero', nombre: 'Tesorero/a', required: true, orden: 4 },
  { id: 'director1', nombre: 'Director/a', required: true, orden: 5 }
];

export default function Step5_Directorio({ onNext, onPrev }) {
  const { formData, updateFormData, setFormDataField } = useWizardStore();
  const addToast = useUiStore(s => s.addToast);
  const members = formData.members || [];
  const directorio = formData.directorioProvisorio || {};
  const comision = formData.comisionElectoral || { members: [], electionDate: null };
  const certs = formData.certificates || {};
  const [cargos, setCargos] = useState(DEFAULT_CARGOS);

  // Load cargos from template configuration for this org type
  useEffect(() => {
    if (formData.organization?.type) {
      apiService.get(`/organization-types/${formData.organization.type}`)
        .then(data => {
          // Prioritize directorio.cargos from template, then fallback
          const templateCargos = data.directorio?.cargos || data.cargos;
          if (templateCargos?.length) {
            setCargos(templateCargos.sort((a, b) => (a.orden || 0) - (b.orden || 0)));
          }
        })
        .catch(() => {});
    }
  }, [formData.organization?.type]);

  const selectedRuts = new Set(
    [...Object.values(directorio).map(d => d?.rut), ...comision.members.map(m => m?.rut)]
      .filter(Boolean).map(r => r.replace(/\./g, '').replace(/-/g, ''))
  );

  function getAvailableMembers(excludeRut) {
    return members.filter(m => {
      const norm = (m.rut || '').replace(/\./g, '').replace(/-/g, '');
      if (excludeRut && norm === excludeRut.replace(/\./g, '').replace(/-/g, '')) return true;
      return !selectedRuts.has(norm);
    });
  }

  function assignCargo(cargoId, memberIdx) {
    const m = members[memberIdx];
    if (!m) return;
    const updated = { ...directorio, [cargoId]: { ...m, cargo: cargoId } };
    setFormDataField('directorioProvisorio', updated);
  }

  function removeCargo(cargoId) {
    const updated = { ...directorio };
    delete updated[cargoId];
    setFormDataField('directorioProvisorio', updated);
  }

  function addComisionMember(memberIdx) {
    if (comision.members.length >= 3) {
      addToast('La comisión electoral requiere exactamente 3 miembros', 'error');
      return;
    }
    const m = members[memberIdx];
    if (!m) return;
    setFormDataField('comisionElectoral', {
      ...comision,
      members: [...comision.members, m]
    });
  }

  function removeComisionMember(idx) {
    setFormDataField('comisionElectoral', {
      ...comision,
      members: comision.members.filter((_, i) => i !== idx)
    });
  }

  function handleCertificate(cargoId, file) {
    if (!file) {
      const updated = { ...certs };
      delete updated[cargoId];
      setFormDataField('certificates', updated);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormDataField('certificates', {
        ...certs,
        [cargoId]: { name: file.name, data: reader.result }
      });
    };
    reader.readAsDataURL(file);
  }

  function validate() {
    const requiredCargos = cargos.filter(c => c.required);
    for (const cargo of requiredCargos) {
      if (!directorio[cargo.id]) return `Asigna un miembro al cargo: ${cargo.nombre}`;
    }
    if (comision.members.length < 3) return 'La comisión electoral requiere 3 miembros';
    return null;
  }

  function handleNext() {
    const err = validate();
    if (err) { addToast(err, 'error'); return; }
    onNext();
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Directorio Provisorio y Comisión Electoral
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        Asigna miembros a los cargos del directorio y la comisión electoral.
      </p>

      {/* Directorio */}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Directorio Provisorio</h3>
      <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
        {cargos.map(cargo => {
          const assigned = directorio[cargo.id];
          return (
            <div key={cargo.id} style={{
              padding: 16, border: '1px solid #e5e7eb', borderRadius: 10, background: 'white'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                  {cargo.nombre} {cargo.required && '*'}
                </span>
                {assigned && (
                  <button onClick={() => removeCargo(cargo.id)} style={{
                    background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer'
                  }}>Quitar</button>
                )}
              </div>

              {assigned ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: '#374151' }}>
                    {assigned.firstName} {assigned.lastName} - {assigned.rut}
                  </span>
                  <span style={{ color: '#10b981', fontSize: 12 }}>Asignado</span>
                </div>
              ) : (
                <select
                  value=""
                  onChange={e => {
                    if (e.target.value) assignCargo(cargo.id, parseInt(e.target.value));
                  }}
                  style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
                >
                  <option value="">Seleccionar miembro...</option>
                  {getAvailableMembers().map((m, i) => (
                    <option key={m.rut || i} value={members.indexOf(m)}>
                      {m.firstName} {m.lastName} - {m.rut}
                    </option>
                  ))}
                </select>
              )}

              {/* Certificate upload */}
              {assigned && (
                <div style={{ marginTop: 8 }}>
                  <FileUpload
                    accept=".pdf,.jpg,.jpeg,.png"
                    label="Certificado (opcional)"
                    maxSizeMB={5}
                    onFile={file => handleCertificate(cargo.id, file)}
                    value={certs[cargo.id]}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Comisión Electoral */}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        Comisión Electoral ({comision.members.length}/3)
      </h3>
      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        {comision.members.map((m, i) => (
          <div key={i} style={{
            padding: 12, border: '1px solid #e5e7eb', borderRadius: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: 14 }}>{m.firstName} {m.lastName} - {m.rut}</span>
            <button onClick={() => removeComisionMember(i)} style={{
              background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer'
            }}>Quitar</button>
          </div>
        ))}
      </div>

      {comision.members.length < 3 && (
        <select
          value=""
          onChange={e => { if (e.target.value) addComisionMember(parseInt(e.target.value)); }}
          style={{ width: '100%', maxWidth: 400, padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, marginBottom: 16 }}
        >
          <option value="">Agregar miembro a comisión...</option>
          {getAvailableMembers().map((m, i) => (
            <option key={m.rut || i} value={members.indexOf(m)}>
              {m.firstName} {m.lastName} - {m.rut}
            </option>
          ))}
        </select>
      )}

      <div>
        <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 6 }}>
          Fecha estimada de elección
        </label>
        <input type="date" value={comision.electionDate || ''}
          onChange={e => setFormDataField('comisionElectoral', { ...comision, electionDate: e.target.value })}
          style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={handleNext} style={nextBtnS}>Siguiente</button>
      </div>
    </div>
  );
}

const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
const nextBtnS = { padding: '12px 28px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
