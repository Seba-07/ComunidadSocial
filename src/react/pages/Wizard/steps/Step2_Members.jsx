import { useState } from 'react';
import { useWizardStore } from '../../../stores/wizardStore';
import { useUiStore } from '../../../stores/uiStore';
import { validateRut, formatRut } from '../../../utils/validators';
import DataTable from '../../../components/ui/DataTable';
import Modal from '../../../components/ui/Modal';
import MemberImportModal, { downloadMemberTemplate } from './MemberImportModal';

const EMPTY_MEMBER = { firstName: '', lastName: '', rut: '', email: '', phone: '', birthDate: '' };

// TEST DATA - 15 members (13 adults + 2 minors 15-16 years old)
const TEST_MEMBERS = [
  { firstName: 'María', lastName: 'González', rut: '12.456.789-0', email: 'maria.gonzalez@test.cl', phone: '+56 9 1234 5001', birthDate: '1985-03-15', genero: 'femenino' },
  { firstName: 'Juan', lastName: 'Pérez', rut: '11.234.567-8', email: 'juan.perez@test.cl', phone: '+56 9 1234 5002', birthDate: '1978-07-22', genero: 'masculino' },
  { firstName: 'Carmen', lastName: 'Muñoz', rut: '13.678.901-2', email: 'carmen.munoz@test.cl', phone: '+56 9 1234 5003', birthDate: '1990-11-08', genero: 'femenino' },
  { firstName: 'Roberto', lastName: 'Silva', rut: '10.987.654-3', email: 'roberto.silva@test.cl', phone: '+56 9 1234 5004', birthDate: '1972-01-30', genero: 'masculino' },
  { firstName: 'Patricia', lastName: 'Rojas', rut: '14.321.098-7', email: 'patricia.rojas@test.cl', phone: '+56 9 1234 5005', birthDate: '1988-05-12', genero: 'femenino' },
  { firstName: 'Francisco', lastName: 'Hernández', rut: '9.876.543-2', email: 'francisco.hernandez@test.cl', phone: '+56 9 1234 5006', birthDate: '1965-09-28', genero: 'masculino' },
  { firstName: 'Andrea', lastName: 'López', rut: '15.432.109-8', email: 'andrea.lopez@test.cl', phone: '+56 9 1234 5007', birthDate: '1992-04-03', genero: 'femenino' },
  { firstName: 'Miguel', lastName: 'Torres', rut: '8.765.432-1', email: 'miguel.torres@test.cl', phone: '+56 9 1234 5008', birthDate: '1960-12-17', genero: 'masculino' },
  { firstName: 'Claudia', lastName: 'Vargas', rut: '16.543.210-9', email: 'claudia.vargas@test.cl', phone: '+56 9 1234 5009', birthDate: '1995-08-25', genero: 'femenino' },
  { firstName: 'Jorge', lastName: 'Martínez', rut: '11.876.543-0', email: 'jorge.martinez@test.cl', phone: '+56 9 1234 5010', birthDate: '1980-02-14', genero: 'masculino' },
  { firstName: 'Valentina', lastName: 'Soto', rut: '17.654.321-0', email: 'valentina.soto@test.cl', phone: '+56 9 1234 5011', birthDate: '1993-06-19', genero: 'femenino' },
  { firstName: 'Luis', lastName: 'Ramírez', rut: '10.234.567-1', email: 'luis.ramirez@test.cl', phone: '+56 9 1234 5012', birthDate: '1975-10-05', genero: 'masculino' },
  { firstName: 'Sofía', lastName: 'Díaz', rut: '18.765.432-3', email: 'sofia.diaz@test.cl', phone: '+56 9 1234 5013', birthDate: '1998-01-11', genero: 'femenino' },
  // 2 menores de edad (15-16 años)
  { firstName: 'Tomás', lastName: 'Araya', rut: '21.345.678-9', email: 'tomas.araya@test.cl', phone: '+56 9 1234 5014', birthDate: '2010-03-20', genero: 'masculino' },
  { firstName: 'Isidora', lastName: 'Fuentes', rut: '22.456.789-0', email: 'isidora.fuentes@test.cl', phone: '+56 9 1234 5015', birthDate: '2009-08-14', genero: 'femenino' },
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
  const addToast = useUiStore(s => s.addToast);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_MEMBER });

  const members = formData.members || [];
  const minMembers = templateConfig?.miembrosMinimos
    || (formData.organization?.type === 'JUNTA_VECINOS' ? 200 : 15);

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

  const columns = [
    { key: 'firstName', label: 'Nombre', sortable: true },
    { key: 'lastName', label: 'Apellido', sortable: true },
    { key: 'rut', label: 'RUT', sortable: true },
    {
      key: 'birthDate', label: 'Edad', sortable: true,
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
        return (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => openEdit(idx)} style={smallBtn}>Editar</button>
            <button onClick={() => removeMember(idx)} style={{ ...smallBtn, color: '#ef4444' }}>Eliminar</button>
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
      <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
        {members.length}/{minMembers} miembros (mínimo {minMembers} requeridos)
      </p>

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

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
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
        {members.length === 0 && (
          <button onClick={() => {
            TEST_MEMBERS.forEach(m => addMember(m));
            addToast('15 miembros de prueba agregados (2 menores de edad)', 'success');
          }} style={{
            padding: '10px 20px', border: '1px solid #f59e0b', borderRadius: 10,
            background: '#fffbeb', color: '#92400e', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>
            Cargar 15 miembros de prueba
          </button>
        )}
      </div>

      <div style={{ background: '#f9fafb', borderRadius: 12, overflow: 'hidden' }}>
        <DataTable columns={columns} data={members} emptyMessage="Sin miembros registrados" pageSize={10} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={handleNext} style={nextBtnStyle}>Siguiente</button>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editIdx !== null ? 'Editar Miembro' : 'Agregar Miembro'}>
        <div style={{ display: 'grid', gap: 14 }}>
          {[
            { key: 'firstName', label: 'Nombre *' },
            { key: 'lastName', label: 'Apellido *' },
            { key: 'rut', label: 'RUT *', placeholder: '12.345.678-9' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'phone', label: 'Teléfono' },
            { key: 'birthDate', label: 'Fecha de nacimiento *', type: 'date' }
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
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
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
