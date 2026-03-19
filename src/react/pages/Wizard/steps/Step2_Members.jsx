import { useState, useEffect } from 'react';
import { useWizardStore } from '../../../stores/wizardStore';
import { useAuthStore } from '../../../stores/authStore';
import { useUiStore } from '../../../stores/uiStore';
import { validateRut, formatRut } from '../../../utils/validators';
import DataTable from '../../../components/ui/DataTable';
import Modal from '../../../components/ui/Modal';
import MemberImportModal, { downloadMemberTemplate } from './MemberImportModal';

const EMPTY_MEMBER = { firstName: '', lastName: '', rut: '', email: '', phone: '', birthDate: '', address: '' };

// TEST DATA - 14 members (10 adults + 4 minors: 1 de 14 años, 3 de 15-17 años)
const TEST_MEMBERS = [
  { firstName: 'María', lastName: 'González', rut: '12.456.789-0', email: 'maria.gonzalez@test.cl', phone: '+56 9 1234 5001', birthDate: '1985-03-15', genero: 'femenino', address: 'Av. Dorsal 1250, Renca' },
  { firstName: 'Juan', lastName: 'Pérez', rut: '11.234.567-1', email: 'juan.perez@test.cl', phone: '+56 9 1234 5002', birthDate: '1978-07-22', genero: 'masculino', address: 'Calle Uno 345, Renca' },
  { firstName: 'Carmen', lastName: 'Muñoz', rut: '13.678.901-5', email: 'carmen.munoz@test.cl', phone: '+56 9 1234 5003', birthDate: '1990-11-08', genero: 'femenino', address: 'Psje. Las Flores 78, Renca' },
  { firstName: 'Roberto', lastName: 'Silva', rut: '10.987.654-2', email: 'roberto.silva@test.cl', phone: '+56 9 1234 5004', birthDate: '1972-01-30', genero: 'masculino', address: 'Av. Domingo Santa María 2100, Renca' },
  { firstName: 'Patricia', lastName: 'Rojas', rut: '14.321.098-7', email: 'patricia.rojas@test.cl', phone: '+56 9 1234 5005', birthDate: '1988-05-12', genero: 'femenino', address: 'Calle Los Aromos 456, Renca' },
  { firstName: 'Francisco', lastName: 'Hernández', rut: '9.876.543-3', email: 'francisco.hernandez@test.cl', phone: '+56 9 1234 5006', birthDate: '1965-09-28', genero: 'masculino', address: 'Av. José Miguel Infante 890, Renca' },
  { firstName: 'Andrea', lastName: 'López', rut: '15.432.109-8', email: 'andrea.lopez@test.cl', phone: '+56 9 1234 5007', birthDate: '1992-04-03', genero: 'femenino', address: 'Calle Marte 123, Renca' },
  { firstName: 'Miguel', lastName: 'Torres', rut: '8.765.432-K', email: 'miguel.torres@test.cl', phone: '+56 9 1234 5008', birthDate: '1960-12-17', genero: 'masculino', address: 'Psje. El Sol 567, Renca' },
  { firstName: 'Claudia', lastName: 'Vargas', rut: '16.543.210-K', email: 'claudia.vargas@test.cl', phone: '+56 9 1234 5009', birthDate: '1995-08-25', genero: 'femenino', address: 'Av. Condell 1890, Renca' },
  { firstName: 'Jorge', lastName: 'Martínez', rut: '11.876.543-5', email: 'jorge.martinez@test.cl', phone: '+56 9 1234 5010', birthDate: '1980-02-14', genero: 'masculino', address: 'Calle Neptuno 234, Renca' },
  // 4 menores de edad (1 de 14 años, 1 de 15, 1 de 16, 1 de 17)
  { firstName: 'Martina', lastName: 'Castillo', rut: '23.567.890-K', email: 'martina.castillo@test.cl', phone: '+56 9 1234 5011', birthDate: '2012-01-15', genero: 'femenino', address: 'Calle Neptuno 234, Renca' },
  { firstName: 'Tomás', lastName: 'Araya', rut: '21.345.678-4', email: 'tomas.araya@test.cl', phone: '+56 9 1234 5012', birthDate: '2011-06-20', genero: 'masculino', address: 'Av. Dorsal 980, Renca' },
  { firstName: 'Isidora', lastName: 'Fuentes', rut: '22.456.789-8', email: 'isidora.fuentes@test.cl', phone: '+56 9 1234 5013', birthDate: '2010-08-14', genero: 'femenino', address: 'Calle Saturno 321, Renca' },
  { firstName: 'Mateo', lastName: 'Reyes', rut: '22.890.123-7', email: 'mateo.reyes@test.cl', phone: '+56 9 1234 5014', birthDate: '2009-04-10', genero: 'masculino', address: 'Psje. Los Jazmines 45, Renca' },
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

export default function Step2_Members({ onNext, onPrev }) {
  const { formData, addMember, removeMember, updateMember, templateConfig } = useWizardStore();
  const user = useAuthStore(s => s.user);
  const addToast = useUiStore(s => s.addToast);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_MEMBER });

  const members = formData.members || [];

  // Auto-include creator as first member
  useEffect(() => {
    if (!user?.rut) return;
    const creatorRut = user.rut.replace(/\./g, '').replace(/-/g, '').toLowerCase();
    const alreadyExists = members.some(m =>
      m.rut.replace(/\./g, '').replace(/-/g, '').toLowerCase() === creatorRut
    );
    if (!alreadyExists) {
      addMember({
        firstName: user.firstName || '',
        segundoNombre: user.segundoNombre || '',
        lastName: user.lastName || '',
        apellidoMaterno: user.apellidoMaterno || '',
        rut: user.rut,
        email: user.email || '',
        phone: user.phone || '',
        birthDate: user.birthDate || '',
        address: user.address || '',
        _isCreator: true
      });
    }
  }, []);
  const minMembers = templateConfig?.miembrosMinimos
    || (formData.organization?.type === 'JUNTA_VECINOS' ? 50 : 15);

  function openAdd() {
    setForm({ ...EMPTY_MEMBER });
    setEditIdx(null);
    setShowForm(true);
  }

  function openEdit(idx) {
    setForm({ ...members[idx] });
    setEditIdx(idx);
    setShowForm(true);
  }

  function saveMember() {
    if (!form.firstName?.trim() || !form.lastName?.trim() || !form.rut?.trim() || !form.birthDate) {
      addToast('Nombre, apellido, RUT y fecha de nacimiento son requeridos', 'error');
      return;
    }

    if (form.firstName.trim().length < 2) {
      addToast('El nombre debe tener al menos 2 caracteres', 'error');
      return;
    }
    if (form.lastName.trim().length < 2) {
      addToast('El apellido debe tener al menos 2 caracteres', 'error');
      return;
    }

    // Validate RUT format and check digit
    if (!validateRut(form.rut)) {
      addToast(`RUT inválido para ${form.firstName} ${form.lastName}. Verifica el dígito verificador.`, 'error');
      return;
    }

    // Validate phone format if provided
    if (form.phone && !/^(\+?56)?[\d\s-]{8,15}$/.test(form.phone)) {
      addToast('Formato de teléfono inválido', 'error');
      return;
    }

    // Check duplicate RUT
    const normalizedRut = form.rut.replace(/\./g, '').replace(/-/g, '').toLowerCase();
    const duplicate = members.findIndex((m, i) => {
      if (editIdx !== null && i === editIdx) return false;
      return m.rut.replace(/\./g, '').replace(/-/g, '').toLowerCase() === normalizedRut;
    });
    if (duplicate >= 0) {
      addToast('Ya existe un miembro con este RUT', 'error');
      return;
    }

    if (editIdx !== null) {
      updateMember(editIdx, form);
    } else {
      addMember(form);
    }
    setShowForm(false);
  }

  function handleNext() {
    if (members.length < minMembers) {
      addToast(`Se requieren al menos ${minMembers} miembros (tienes ${members.length})`, 'error');
      return;
    }

    // RUT validation - check all members have valid RUTs
    const rutsInvalidos = members.filter(m => !validateRut(m.rut));
    if (rutsInvalidos.length > 0) {
      const nombres = rutsInvalidos.map(m => `${m.firstName} ${m.lastName} (${m.rut})`).join(', ');
      addToast(`RUT inválido en: ${nombres}. Corrige el dígito verificador antes de continuar.`, 'error');
      return;
    }

    // Age validation
    const edadConfig = templateConfig?.edadConfig || {};
    const permiteMenores = edadConfig.permiteMenores !== false;
    const edadMinima = edadConfig.edadMinima ?? 14;

    // Check all members have birthDate
    const sinFecha = members.filter(m => !m.birthDate);
    if (sinFecha.length > 0) {
      addToast(`${sinFecha.length} miembro(s) no tienen fecha de nacimiento registrada`, 'error');
      return;
    }

    if (!permiteMenores) {
      const menores = members.filter(m => calculateAge(m.birthDate) < 18);
      if (menores.length > 0) {
        const nombres = menores.slice(0, 3).map(m => `${m.firstName} ${m.lastName}`).join(', ');
        addToast(`Esta organización no permite menores de edad. ${menores.length} miembro(s) son menores: ${nombres}${menores.length > 3 ? '...' : ''}`, 'error');
        return;
      }
    } else {
      const muyJovenes = members.filter(m => {
        const age = calculateAge(m.birthDate);
        return age !== null && age < edadMinima;
      });
      if (muyJovenes.length > 0) {
        const nombres = muyJovenes.map(m => `${m.firstName} ${m.lastName}`).join(', ');
        addToast(`Los siguientes miembros no cumplen la edad mínima (${edadMinima} años): ${nombres}`, 'error');
        return;
      }
    }

    onNext();
  }

  // Helper to check if a member is the creator (by RUT match)
  function isCreatorMember(member) {
    if (!user?.rut || !member?.rut) return false;
    const creatorRut = user.rut.replace(/\./g, '').replace(/-/g, '').toLowerCase();
    const memberRut = member.rut.replace(/\./g, '').replace(/-/g, '').toLowerCase();
    return creatorRut === memberRut;
  }

  const columns = [
    { key: 'firstName', label: 'Nombre', sortable: true,
      render: (val, row) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {val}
          {isCreatorMember(row) && (
            <span style={{
              padding: '1px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
              background: '#dbeafe', color: '#1e40af'
            }}>Creador</span>
          )}
        </span>
      )
    },
    { key: 'lastName', label: 'Apellido', sortable: true },
    { key: 'rut', label: 'RUT', sortable: true, hideOnMobile: true },
    {
      key: 'birthDate', label: 'Edad', sortable: true, hideOnTablet: true,
      render: (val) => {
        const age = calculateAge(val);
        if (age === null) return <span style={{ color: '#9ca3af' }}>--</span>;
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {age}
            {age < 18 && (
              <span style={{
                padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                background: '#fef3c7', color: '#92400e'
              }}>Menor</span>
            )}
          </span>
        );
      }
    },
    {
      key: 'actions', label: '', sortable: false,
      render: (_, row) => {
        const idx = members.indexOf(row);
        const isCreator = isCreatorMember(row);
        return (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => openEdit(idx)} style={smallBtn}>Editar</button>
            <button
              onClick={() => !isCreator && removeMember(idx)}
              disabled={isCreator}
              title={isCreator ? 'El creador no puede ser eliminado' : ''}
              style={{ ...smallBtn, color: isCreator ? '#9ca3af' : '#ef4444', cursor: isCreator ? 'not-allowed' : 'pointer' }}
            >Eliminar</button>
          </div>
        );
      }
    }
  ];

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Miembros Fundadores
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: '#6b7280' }}>
        {members.length}/{minMembers} miembros (mínimo {minMembers} requeridos)
      </p>

      {/* Alerta de quórum mínimo y asistencia presencial */}
      <div style={{
        background: '#fefce8', border: '1px solid #f59e0b', borderRadius: 10,
        padding: 14, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start'
      }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>&#9888;</span>
        <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
          <strong>Atención:</strong> Según la ley y el tipo de organización seleccionada, necesitas registrar un mínimo de <strong>{minMembers} socios fundadores</strong>. Es obligatorio que todas estas personas asistan presencialmente el día de la asamblea para firmar la nómina ante el Ministro de Fe, de lo contrario la asamblea será anulada.
        </div>
      </div>

      <div style={{
        height: 6, background: '#e5e7eb', borderRadius: 3, marginBottom: 20, overflow: 'hidden'
      }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${Math.min(100, (members.length / minMembers) * 100)}%`,
          background: members.length >= minMembers ? '#10b981' : '#2563eb',
          transition: 'width 0.3s'
        }} />
      </div>

      <div className="r-btn-row" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={openAdd} style={{
          padding: '10px 20px', border: 'none', borderRadius: 10,
          background: '#2563eb', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer'
        }}>
          Agregar Miembro
        </button>
        <button onClick={() => setShowImport(true)} style={{
          padding: '10px 20px', border: '1px solid #10b981', borderRadius: 10,
          background: '#f0fdf4', color: '#065f46', fontSize: 14, fontWeight: 600, cursor: 'pointer'
        }}>
          Subir Nómina (Excel/CSV)
        </button>
        <button onClick={downloadMemberTemplate} style={{
          padding: '10px 16px', border: 'none', borderRadius: 10,
          background: 'transparent', color: '#2563eb', fontSize: 13, cursor: 'pointer',
          textDecoration: 'underline',
        }}>
          Descargar plantilla
        </button>
        {members.length <= 1 && (
          <button onClick={() => {
            TEST_MEMBERS.forEach(m => addMember(m));
            addToast('14 miembros de prueba agregados (4 menores de edad)', 'success');
          }} style={{
            padding: '10px 20px', border: '1px solid #f59e0b', borderRadius: 10,
            background: '#fffbeb', color: '#92400e', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>
            Cargar 14 miembros de prueba
          </button>
        )}
      </div>

      <div style={{ background: '#f9fafb', borderRadius: 12, overflow: 'hidden' }}>
        <DataTable columns={columns} data={members} emptyMessage="Sin miembros registrados" pageSize={10} />
      </div>

      <div className="r-toolbar" style={{ marginTop: 24 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {members.length < minMembers && members.length > 0 && (
            <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>
              Faltan {minMembers - members.length} socios para cumplir el mínimo legal
            </span>
          )}
          <button
            onClick={handleNext}
            disabled={members.length < minMembers}
            style={{
              ...nextBtnStyle,
              ...(members.length < minMembers ? { opacity: 0.5, cursor: 'not-allowed', background: '#9ca3af' } : {})
            }}
          >Siguiente</button>
        </div>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editIdx !== null ? 'Editar Miembro' : 'Agregar Miembro'}>
        <div style={{ display: 'grid', gap: 14 }}>
          {[
            { key: 'firstName', label: 'Nombre *' },
            { key: 'lastName', label: 'Apellido *' },
            { key: 'rut', label: 'RUT *', placeholder: '12.345.678-9' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'phone', label: 'Teléfono' },
            { key: 'birthDate', label: 'Fecha de nacimiento *', type: 'date' },
            { key: 'address', label: 'Domicilio', placeholder: 'Calle, número, comuna' }
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{f.label}</label>
              <input
                type={f.type || 'text'}
                value={form[f.key] || ''}
                onChange={e => {
                  let val = e.target.value;
                  if (f.key === 'rut') val = formatRut(val);
                  setForm(p => ({ ...p, [f.key]: val }));
                }}
                placeholder={f.placeholder || ''}
                style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
              />
            </div>
          ))}
        </div>
        <div className="r-btn-row" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={saveMember} style={{ padding: '10px 20px', border: 'none', borderRadius: 10, background: '#2563eb', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
        </div>
      </Modal>

      <MemberImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        existingMembers={members}
        edadConfig={templateConfig?.edadConfig}
        onImport={(imported) => {
          imported.forEach(m => addMember(m));
          addToast(`${imported.length} miembros importados exitosamente`, 'success');
        }}
      />
    </div>
  );
}

const smallBtn = { padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', fontSize: 12, cursor: 'pointer', color: '#374151' };
const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
const nextBtnStyle = { padding: '12px 28px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
