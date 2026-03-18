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

function calculateAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function Step5_Directorio({ onNext, onPrev }) {
  const { formData, updateFormData, setFormDataField, templateConfig } = useWizardStore();
  const addToast = useUiStore(s => s.addToast);
  const members = formData.members || [];
  const directorio = formData.directorioProvisorio || {};
  const comision = formData.comisionElectoral || { members: [], electionDate: null };
  const certs = formData.certificates || {};
  const inhCerts = formData.inhabilityCertificates || {};
  const [cargos, setCargos] = useState(DEFAULT_CARGOS);

  const edadConfig = templateConfig?.edadConfig || {};
  const permiteMenores = edadConfig.permiteMenores === true;
  const comisionSize = templateConfig?.comisionElectoral?.cantidad || 3;
  const esDefinitivo = templateConfig?.requiereDirectorioProvisorio === false;
  const tipoDirectorio = esDefinitivo ? 'Definitivo' : 'Provisorio';

  // Load cargos from template config or API fallback
  useEffect(() => {
    if (templateConfig?.directorio?.cargos?.length) {
      setCargos(templateConfig.directorio.cargos.sort((a, b) => (a.orden || 0) - (b.orden || 0)));
    } else if (formData.organization?.type) {
      apiService.get(`/organization-types/${formData.organization.type}`)
        .then(data => {
          const templateCargos = data.directorio?.cargos || data.cargos;
          if (templateCargos?.length) {
            setCargos(templateCargos.sort((a, b) => (a.orden || 0) - (b.orden || 0)));
          }
        })
        .catch(() => {});
    }
  }, [formData.organization?.type, templateConfig]);

  const selectedRuts = new Set(
    [...Object.values(directorio).map(d => d?.rut), ...comision.members.map(m => m?.rut)]
      .filter(Boolean).map(r => r.replace(/\./g, '').replace(/-/g, ''))
  );

  function getAvailableMembers(excludeRut, forDirectorio = false, forComision = false) {
    return members.filter(m => {
      const norm = (m.rut || '').replace(/\./g, '').replace(/-/g, '');
      if (excludeRut && norm === excludeRut.replace(/\./g, '').replace(/-/g, '')) return true;
      if (selectedRuts.has(norm)) return false;

      // Age filter for directorio
      if (forDirectorio && !edadConfig.menoresEnDirectorio) {
        const age = calculateAge(m.birthDate);
        if (age !== null && age < 18) return false;
      }
      // Age filter for commission
      if (forComision && !edadConfig.menoresEnComisionElectoral) {
        const age = calculateAge(m.birthDate);
        if (age !== null && age < 18) return false;
      }
      return true;
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
    if (certs[cargoId]) {
      const updatedCerts = { ...certs };
      delete updatedCerts[cargoId];
      setFormDataField('certificates', updatedCerts);
    }
    if (inhCerts[cargoId]) {
      const updatedInh = { ...inhCerts };
      delete updatedInh[cargoId];
      setFormDataField('inhabilityCertificates', updatedInh);
    }
  }

  function addComisionMember(memberIdx) {
    if (comision.members.length >= comisionSize) {
      addToast(`La comisión electoral requiere exactamente ${comisionSize} miembros`, 'error');
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

  function handleInhabilityCert(cargoId, file) {
    if (!file) {
      const updated = { ...inhCerts };
      delete updated[cargoId];
      setFormDataField('inhabilityCertificates', updated);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormDataField('inhabilityCertificates', {
        ...inhCerts,
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
    if (comision.members.length < comisionSize) return `La comisión electoral requiere ${comisionSize} miembros`;
    // Validar certificados de antecedentes — obligatorio para todos los directores asignados
    // Certs must have actual data (not just metadata from localStorage)
    for (const cargo of cargos) {
      if (directorio[cargo.id] && (!certs[cargo.id] || !certs[cargo.id].data)) {
        return `Falta el Certificado de Antecedentes para: ${cargo.nombre}`;
      }
    }
    // Validar certificados de inhabilidades si permite menores — solo para directores mayores de 18
    if (permiteMenores) {
      for (const cargo of requiredCargos) {
        const assigned = directorio[cargo.id];
        if (assigned) {
          const age = calculateAge(assigned.birthDate);
          const isAdult = age === null || age >= 18;
          if (isAdult && (!inhCerts[cargo.id] || !inhCerts[cargo.id].data)) {
            return `Falta el Certificado de Inhabilidades para: ${cargo.nombre}`;
          }
        }
      }
    }

    // Validar tamaño total de archivos adjuntos (~40MB max para dejar margen)
    const MAX_TOTAL_MB = 40;
    let totalBytes = 0;
    const oversizedFiles = [];

    for (const [cargoId, cert] of Object.entries(certs)) {
      if (cert?.data) {
        const size = cert.data.length * 0.75; // base64 → bytes approx
        if (size > 5 * 1024 * 1024) {
          const cargoInfo = cargos.find(c => c.id === cargoId);
          oversizedFiles.push(`Certificado de ${cargoInfo?.nombre || cargoId} (${(size / 1024 / 1024).toFixed(1)}MB)`);
        }
        totalBytes += size;
      }
    }
    for (const [cargoId, cert] of Object.entries(inhCerts)) {
      if (cert?.data) {
        const size = cert.data.length * 0.75;
        if (size > 5 * 1024 * 1024) {
          const cargoInfo = cargos.find(c => c.id === cargoId);
          oversizedFiles.push(`Cert. Inhabilidades de ${cargoInfo?.nombre || cargoId} (${(size / 1024 / 1024).toFixed(1)}MB)`);
        }
        totalBytes += size;
      }
    }

    if (oversizedFiles.length > 0) {
      return `Archivos demasiado grandes (máx. 5MB c/u): ${oversizedFiles.join(', ')}`;
    }

    const totalMB = totalBytes / 1024 / 1024;
    if (totalMB > MAX_TOTAL_MB) {
      return `El peso total de los archivos (${totalMB.toFixed(1)}MB) excede el límite de ${MAX_TOTAL_MB}MB. Reduce el tamaño de los certificados.`;
    }

    return null;
  }

  const pendingCerts = cargos.filter(c => directorio[c.id] && (!certs[c.id] || !certs[c.id].data));

  function handleNext() {
    const err = validate();
    if (err) { addToast(err, 'error'); return; }

    // Embeber certificados de inhabilidades en el directorio antes de avanzar (solo adultos)
    if (permiteMenores && Object.keys(inhCerts).length > 0) {
      const updated = { ...directorio };
      for (const [cargoId, cert] of Object.entries(inhCerts)) {
        if (updated[cargoId] && cert?.data) {
          const age = calculateAge(updated[cargoId].birthDate);
          if (age === null || age >= 18) {
            updated[cargoId] = { ...updated[cargoId], inhabilityCertificate: cert.data };
          }
        }
      }
      setFormDataField('directorioProvisorio', updated);
    }

    onNext();
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Directorio {tipoDirectorio} y Comisión Electoral
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        {esDefinitivo
          ? 'Asigna los miembros del directorio definitivo y la comisión electoral.'
          : 'Asigna miembros a los cargos del directorio provisorio. Se confirmarán en la asamblea constitutiva.'}
      </p>

      {/* Directorio */}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Directorio {tipoDirectorio}</h3>
      <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
        {cargos.map(cargo => {
          const assigned = directorio[cargo.id];
          return (
            <div key={cargo.id} style={{
              padding: 16, border: '1px solid #e5e7eb', borderRadius: 10, background: 'white'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
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
                  {getAvailableMembers(null, true).map((m, i) => (
                    <option key={m.rut || i} value={members.indexOf(m)}>
                      {m.firstName} {m.lastName} - {m.rut}
                    </option>
                  ))}
                </select>
              )}

              {/* Certificate upload - required for all directors */}
              {assigned && (
                <div style={{ marginTop: 8 }}>
                  <FileUpload
                    accept=".pdf,.jpg,.jpeg,.png"
                    label="Certificado de Antecedentes *"
                    maxSizeMB={5}
                    onFile={file => handleCertificate(cargo.id, file)}
                    value={certs[cargo.id]}
                  />
                  {!certs[cargo.id] && (
                    <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginTop: 4, display: 'block' }}>
                      Obligatorio para avanzar
                    </span>
                  )}
                </div>
              )}

              {/* Certificado de Inhabilidades — solo si permite menores Y el director es mayor de 18 */}
              {assigned && permiteMenores && (() => {
                const memberAge = calculateAge(assigned.birthDate);
                const isAdult = memberAge === null || memberAge >= 18;
                if (!isAdult) {
                  return (
                    <div style={{ marginTop: 10, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14 }}>&#10003;</span>
                      <span style={{ fontSize: 12, color: '#166534' }}>
                        Certificado de Inhabilidades no aplica — socio menor de 18 años
                      </span>
                    </div>
                  );
                }
                return (
                  <div style={{ marginTop: 10, padding: 12, background: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: 8 }}>
                    <FileUpload
                      accept=".pdf,.jpg,.jpeg,.png"
                      label="Certificado de Inhabilidades (Registro Civil) *"
                      maxSizeMB={5}
                      onFile={file => handleInhabilityCert(cargo.id, file)}
                      value={inhCerts[cargo.id]}
                    />
                    {!inhCerts[cargo.id] && (
                      <span style={{ fontSize: 11, color: '#be123c', fontWeight: 600, display: 'block', marginTop: 6 }}>
                        Obligatorio — la organización admite menores de edad
                      </span>
                    )}
                    <div style={{ marginTop: 8, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#334155', margin: '0 0 8px' }}>
                        ¿Cómo obtener este certificado?
                      </p>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                        <span style={{ background: '#2563eb', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>1</span>
                        <div>
                          <a
                            href="https://www.registrocivil.cl/principal/servicios-en-linea"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#2563eb', fontWeight: 600, fontSize: 12, textDecoration: 'underline' }}
                          >Obtener certificado oficial con ClaveÚnica</a>
                          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginLeft: 6 }}>Recomendado</span>
                          <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>Descarga un PDF listo para subir.</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ background: '#64748b', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>2</span>
                        <div>
                          <a
                            href="https://inhabilidades.srcei.cl/ConsInhab/consultaInhabilidad.do"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#2563eb', fontWeight: 600, fontSize: 12, textDecoration: 'underline' }}
                          >Realizar consulta pública por RUT</a>
                          <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>No requiere ClaveÚnica.</p>
                          <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0', fontStyle: 'italic' }}>
                            Si usas esta opción, recuerda usar Imprimir en tu navegador (Ctrl+P) y seleccionar "Guardar como PDF" para poder subir el archivo aquí.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Comisión Electoral */}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        Comisión Electoral ({comision.members.length}/{comisionSize})
      </h3>
      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        {comision.members.map((m, i) => (
          <div key={i} style={{
            padding: 12, border: '1px solid #e5e7eb', borderRadius: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8
          }}>
            <span style={{ fontSize: 14 }}>{m.firstName} {m.lastName} - {m.rut}</span>
            <button onClick={() => removeComisionMember(i)} style={{
              background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer'
            }}>Quitar</button>
          </div>
        ))}
      </div>

      {comision.members.length < comisionSize && (
        <select
          value=""
          onChange={e => { if (e.target.value) addComisionMember(parseInt(e.target.value)); }}
          style={{ width: '100%', maxWidth: 400, padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, marginBottom: 16 }}
        >
          <option value="">Agregar miembro a comisión...</option>
          {getAvailableMembers(null, false, true).map((m, i) => (
            <option key={m.rut || i} value={members.indexOf(m)}>
              {m.firstName} {m.lastName} - {m.rut}
            </option>
          ))}
        </select>
      )}

      {pendingCerts.length > 0 && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, marginTop: 16, fontSize: 13, color: '#991b1b' }}>
          <strong>Certificados pendientes</strong> — Faltan certificados de antecedentes para: {pendingCerts.map(c => c.nombre).join(', ')}.
        </div>
      )}

      <div className="r-toolbar" style={{ marginTop: 32 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={handleNext} style={nextBtnS}>Siguiente</button>
      </div>
    </div>
  );
}

const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
const nextBtnS = { padding: '12px 28px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
