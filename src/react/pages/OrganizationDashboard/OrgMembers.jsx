import { useState, useEffect } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import { apiService } from '@services/ApiService.js';
import { pdfService } from '@services/PDFService.js';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { validateRut, formatRut } from '../../utils/validators';
import { localeDateString } from '../../utils/formatters';

function calcAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const QUORUM_MINIMUMS = { JUNTA_VECINOS: 50 };
const DEFAULT_MINIMUM = 15;

function getMinMembers(orgType) {
  return QUORUM_MINIMUMS[orgType] || DEFAULT_MINIMUM;
}

function isDirectivoOfOrg(org, user) {
  if (!user?.rut || !org?.provisionalDirectorio) return false;
  const clean = (rut) => (rut || '').replace(/\./g, '').replace(/-/g, '').toUpperCase();
  const userRut = clean(user.rut);
  const prov = org.provisionalDirectorio;
  if (prov.president && clean(prov.president.rut) === userRut) return true;
  if (prov.vicePresident && clean(prov.vicePresident.rut) === userRut) return true;
  if (prov.secretary && clean(prov.secretary.rut) === userRut) return true;
  if (prov.treasurer && clean(prov.treasurer.rut) === userRut) return true;
  if (prov.additionalMembers?.some(m => m && clean(m.rut) === userRut)) return true;
  return false;
}

export default function OrgMembers({ org, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [viewMember, setViewMember] = useState(null);
  const [payMember, setPayMember] = useState(null);
  const [search, setSearch] = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateCategory, setDeactivateCategory] = useState('');
  const [deactivateReason, setDeactivateReason] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const addToast = useUiStore((s) => s.addToast);
  const user = useAuthStore((s) => s.user);

  // RBAC: solo owner, admin o directivo pueden editar miembros
  const canEdit = user?.role === 'MUNICIPALIDAD' || org?.userId === user?._id || isDirectivoOfOrg(org, user);

  const members = org?.members || [];
  const activeCount = members.filter((m) => m.status !== 'inactive').length;
  const inactiveCount = members.length - activeCount;
  const minRequired = getMinMembers(org?.organizationType);
  const quorumMet = activeCount >= minRequired;
  const visibleMembers = showInactive ? members : members.filter(m => m.status !== 'inactive');
  const filtered = search
    ? visibleMembers.filter((m) => {
        const q = search.toLowerCase();
        return (m.firstName || '').toLowerCase().includes(q) ||
          (m.lastName || '').toLowerCase().includes(q) ||
          (m.rut || '').includes(q);
      })
    : visibleMembers;

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    if (!deactivateCategory) {
      addToast('Debe seleccionar una causal de baja', 'error');
      return;
    }
    try {
      await apiService.deactivateMember(org._id, deactivateTarget.rut, deactivateCategory, deactivateReason);
      addToast(`${deactivateTarget.firstName} ${deactivateTarget.lastName} dado/a de baja`, 'success');
      setDeactivateTarget(null);
      setDeactivateCategory('');
      setDeactivateReason('');
      onRefresh();
    } catch (error) {
      addToast(error.message || 'Error al dar de baja', 'error');
    }
  }

  async function handleCertificate(member) {
    try {
      const res = await apiService.getMemberCertificateData(org._id, member.rut);
      const { organization: certOrg, member: certMember } = res.data;
      const doc = await pdfService.generateMemberCertificate(certOrg, certMember);
      doc.save(`certificado_${certMember.firstName}_${certMember.lastName}.pdf`);
      addToast('Certificado descargado', 'success');
    } catch (error) {
      addToast(error.message || 'Error al generar certificado', 'error');
    }
  }

  async function handleReactivate(member) {
    try {
      await apiService.reactivateMember(org._id, member.rut);
      addToast(`${member.firstName} ${member.lastName} reactivado/a`, 'success');
      onRefresh();
    } catch (error) {
      addToast(error.message || 'Error al reactivar', 'error');
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Nombre',
      render: (_, row) => (
        <span style={{ fontWeight: 500, cursor: 'pointer', color: '#1e40af' }} onClick={() => setViewMember(row)}>
          {row.firstName} {row.lastName}
        </span>
      )
    },
    { key: 'rut', label: 'RUT' },
    {
      key: 'age',
      label: 'Edad',
      hideOnMobile: true,
      render: (_, row) => {
        const age = calcAge(row.birthDate);
        if (age === null) return '—';
        return (
          <span>
            {age} años
            {age < 18 && <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 8px', borderRadius: 8, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>Menor</span>}
          </span>
        );
      }
    },
    {
      key: 'role',
      label: 'Rol',
      hideOnMobile: true,
      render: (val) => {
        const ROLE_LABELS = { president: 'Presidente', secretary: 'Secretario', treasurer: 'Tesorero', director: 'Director', member: 'Socio', electoral_commission: 'Comisión Electoral' };
        const label = ROLE_LABELS[val] || val || 'Socio';
        const isDirectivo = ['president', 'secretary', 'treasurer', 'director'].includes(val);
        const bg = isDirectivo ? '#dbeafe' : '#f3f4f6';
        const color = isDirectivo ? '#1e40af' : '#374151';
        return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: bg, color }}>{label}</span>;
      }
    },
    {
      key: 'status',
      label: 'Estado',
      hideOnMobile: true,
      render: (val) => {
        const isInactive = val === 'inactive';
        return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: isInactive ? '#fef2f2' : '#f0fdf4', color: isInactive ? '#dc2626' : '#059669' }}>{isInactive ? 'Baja' : 'Activo'}</span>;
      }
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => {
        const isInactive = row.status === 'inactive';
        const cleanR = (r) => (r || '').replace(/\./g, '').replace(/-/g, '').toUpperCase();
        const isSelf = cleanR(user?.rut) === cleanR(row.rut);
        const canCert = canEdit || isSelf;
        return (
          <div className="r-btn-row" style={{ gap: 6 }}>
            <button onClick={() => setViewMember(row)} style={actionBtnStyle}>Ver</button>
            {canCert && !isInactive && (
              <button onClick={() => handleCertificate(row)} style={{ ...actionBtnStyle, color: '#7c3aed', borderColor: '#c4b5fd' }} title="Descargar Certificado">Certificado</button>
            )}
            {canEdit && !isInactive && <button onClick={() => setPayMember(row)} style={{ ...actionBtnStyle, color: '#059669', borderColor: '#bbf7d0' }} title="Registrar Pago">Pago</button>}
            {canEdit && !isInactive && <button onClick={() => setEditMember(row)} style={actionBtnStyle}>Editar</button>}
            {canEdit && (isInactive ? (
              <button onClick={() => handleReactivate(row)} style={{ ...actionBtnStyle, color: '#2563eb', borderColor: '#bfdbfe' }}>Reactivar</button>
            ) : (
              <button onClick={() => setDeactivateTarget(row)} style={{ ...actionBtnStyle, color: '#f59e0b', borderColor: '#fde68a' }}>Dar de Baja</button>
            ))}
          </div>
        );
      }
    }
  ];

  const data = filtered.map((m) => ({ ...m, name: `${m.firstName} ${m.lastName}` }));

  return (
    <div>
      {/* Stats */}
      <div className="r-stats" style={{ marginBottom: 20 }}>
        <div style={{ background: '#eff6ff', borderRadius: 12, padding: '12px 20px', flex: 1, minWidth: 120 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Total socios</span>
          <span style={{ display: 'block', fontSize: 22, fontWeight: 700, color: '#1e40af' }}>{members.length}</span>
        </div>
        <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 20px', flex: 1, minWidth: 120 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Activos</span>
          <span style={{ display: 'block', fontSize: 22, fontWeight: 700, color: '#059669' }}>{activeCount}</span>
        </div>
        <div style={{ background: quorumMet ? '#f0fdf4' : '#fef2f2', borderRadius: 12, padding: '12px 20px', flex: 1, minWidth: 120 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Quórum mínimo</span>
          <span style={{ display: 'block', fontSize: 22, fontWeight: 700, color: quorumMet ? '#059669' : '#dc2626' }}>{activeCount}/{minRequired}</span>
        </div>
        {inactiveCount > 0 && (
          <div style={{ background: '#fef3c7', borderRadius: 12, padding: '12px 20px', flex: 1, minWidth: 120 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Dados de baja</span>
            <span style={{ display: 'block', fontSize: 22, fontWeight: 700, color: '#92400e' }}>{inactiveCount}</span>
          </div>
        )}
      </div>

      {/* Quorum alert */}
      {!quorumMet && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 13, color: '#991b1b' }}>
          <strong>Quórum Insuficiente:</strong> La organización necesita al menos {minRequired} socios activos para operar legalmente{org?.organizationType === 'JUNTA_VECINOS' ? ' (Art. 40, Ley 19.418)' : ''}. Actualmente tiene {activeCount}.
        </div>
      )}

      {/* Info */}
      <div className="r-info-card" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
        Para ser socio se requiere tener al menos 14 años de edad y residencia en la unidad vecinal respectiva.
      </div>

      {/* Toolbar */}
      <div className="r-toolbar" style={{ marginBottom: 16 }}>
        <h3 className="r-page-title" style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', margin: 0 }}>
          Nómina de Socios
        </h3>
        <div className="r-toolbar__actions">
          {inactiveCount > 0 && (
            <label style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
              Mostrar dados de baja
            </label>
          )}
          <input type="text" placeholder="Buscar por nombre o RUT..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="r-search" />
          {canEdit && (
            <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 14, whiteSpace: 'nowrap' }} onClick={() => setShowAdd(true)}>
              + Agregar
            </button>
          )}
        </div>
      </div>

      <DataTable columns={columns} data={data} emptyMessage="No hay miembros registrados" />

      {/* Add Member Modal */}
      <MemberFormModal open={showAdd} onClose={() => setShowAdd(false)} orgId={org._id}
        onSaved={() => { setShowAdd(false); onRefresh(); }} addToast={addToast} />

      {/* Edit Member Modal */}
      <MemberFormModal open={!!editMember} onClose={() => setEditMember(null)} orgId={org._id}
        member={editMember} onSaved={() => { setEditMember(null); onRefresh(); }} addToast={addToast} />

      {/* View Member Modal */}
      <MemberProfileModal open={!!viewMember} onClose={() => setViewMember(null)} member={viewMember} org={org} onCertificate={handleCertificate} />

      {/* Payment Modal */}
      <MemberPaymentModal open={!!payMember} onClose={() => setPayMember(null)} orgId={org._id}
        member={payMember} onSaved={() => { setPayMember(null); onRefresh(); }} addToast={addToast} />

      {/* Deactivation Modal */}
      {deactivateTarget && (
        <div onClick={e => { if (e.target === e.currentTarget) { setDeactivateTarget(null); setDeactivateCategory(''); setDeactivateReason(''); } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Dar de Baja a Socio</h3>
            <p style={{ fontSize: 14, color: '#374151', margin: '0 0 16px' }}>
              ¿Confirma la baja de <strong>{deactivateTarget.firstName} {deactivateTarget.lastName}</strong> ({deactivateTarget.rut})?
            </p>
            {!quorumMet || activeCount <= minRequired ? (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: '#991b1b' }}>
                La organización quedará con quórum insuficiente tras esta baja.
              </div>
            ) : null}
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Causal de baja *</label>
            <select value={deactivateCategory} onChange={e => setDeactivateCategory(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `2px solid ${!deactivateCategory ? '#fca5a5' : '#d1d5db'}`, borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box', background: '#fff' }}>
              <option value="">— Seleccione causal —</option>
              <option value="RENUNCIA_VOLUNTARIA">Renuncia Voluntaria</option>
              <option value="FALLECIMIENTO">Fallecimiento</option>
              <option value="CAMBIO_DOMICILIO">Cambio de Domicilio</option>
              <option value="EXPULSION_ASAMBLEA">Expulsión por Asamblea</option>
              <option value="OTRA">Otra</option>
            </select>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Detalle adicional (opcional)</label>
            <input type="text" value={deactivateReason} onChange={e => setDeactivateReason(e.target.value)}
              placeholder="Ej: Solicitud presentada el 15/03/2026..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setDeactivateTarget(null); setDeactivateCategory(''); setDeactivateReason(''); }}
                style={{ padding: '8px 20px', fontSize: 13, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleDeactivate} disabled={!deactivateCategory}
                style={{ padding: '8px 20px', fontSize: 13, background: deactivateCategory ? '#f59e0b' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                Confirmar Baja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const actionBtnStyle = {
  padding: '3px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6,
  background: 'white', cursor: 'pointer', color: '#374151', fontWeight: 500
};

// ========== Member Form Modal (Add / Edit) ==========
function MemberFormModal({ open, onClose, orgId, member, onSaved, addToast }) {
  const isEdit = !!member;
  const [form, setForm] = useState({
    firstName: '', lastName: '', rut: '', phone: '', email: '', birthDate: '', address: ''
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Reset form when member changes
  useEffect(() => {
    if (member) {
      setForm({
        firstName: member.firstName || '',
        lastName: member.lastName || '',
        rut: member.rut || '',
        phone: member.phone || '',
        email: member.email || '',
        birthDate: member.birthDate ? member.birthDate.slice(0, 10) : '',
        address: member.address || ''
      });
    } else {
      setForm({ firstName: '', lastName: '', rut: '', phone: '', email: '', birthDate: '', address: '' });
    }
  }, [member]);


  function set(field) {
    return (e) => {
      let value = e.target.value;
      if (field === 'rut' && !isEdit) {
        const clean = value.replace(/\./g, '').replace(/-/g, '');
        value = clean ? formatRut(clean) : '';
      }
      setForm((f) => ({ ...f, [field]: value }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.firstName || form.firstName.length < 2) errs.firstName = 'Nombre requerido';
    if (!form.lastName || form.lastName.length < 2) errs.lastName = 'Apellido requerido';
    if (!isEdit && !validateRut(form.rut)) errs.rut = 'RUT inválido';
    if (!form.birthDate) {
      errs.birthDate = 'Fecha de nacimiento es requerida';
    } else {
      const age = calcAge(form.birthDate);
      if (age !== null && age < 14) {
        errs.birthDate = 'Por Ley 19.418, el socio debe tener al menos 14 años de edad';
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      if (isEdit) {
        await apiService.updateOrganization(orgId, {
          updateMember: {
            rut: member.rut,
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone,
            email: form.email,
            birthDate: form.birthDate || undefined,
            address: form.address
          }
        });
        addToast('Miembro actualizado', 'success');
      } else {
        await apiService.updateOrganization(orgId, {
          addMember: {
            firstName: form.firstName,
            lastName: form.lastName,
            rut: form.rut,
            phone: form.phone,
            email: form.email,
            birthDate: form.birthDate || undefined,
            address: form.address
          }
        });
        addToast('Miembro agregado exitosamente', 'success');
      }
      setForm({ firstName: '', lastName: '', rut: '', phone: '', email: '', birthDate: '', address: '' });
      onSaved();
    } catch (error) {
      addToast(error.message || 'Error', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Miembro' : 'Agregar Miembro'}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField label="Nombre *" id="m-fname" type="text" placeholder="Juan" value={form.firstName} onChange={set('firstName')} error={errors.firstName} />
        <FormField label="Apellido *" id="m-lname" type="text" placeholder="Pérez" value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
        {!isEdit && <FormField label="RUT *" id="m-rut" type="text" placeholder="12.345.678-9" value={form.rut} onChange={set('rut')} error={errors.rut} />}
        <FormField label="Fecha de Nacimiento *" id="m-birth" type="date" value={form.birthDate} onChange={set('birthDate')} error={errors.birthDate} />
        <FormField label="Teléfono" id="m-phone" type="tel" placeholder="+56 9 1234 5678" value={form.phone} onChange={set('phone')} />
        <FormField label="Email" id="m-email" type="email" placeholder="juan@email.cl" value={form.email} onChange={set('email')} />
        <FormField label="Dirección" id="m-address" type="text" placeholder="Calle 123" value={form.address} onChange={set('address')} />
        <div className="r-form-row" style={{ marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, background: '#f3f4f6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            Cancelar
          </button>
          <button type="submit" className="btn-auth" style={{ flex: 1 }} disabled={submitting}>
            {submitting ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Agregar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ========== Member Profile Modal ==========
function MemberProfileModal({ open, onClose, member, org, onCertificate }) {
  if (!member) return null;

  const age = calcAge(member.birthDate);
  const dir = org?.provisionalDirectorio;
  let dirRole = null;
  if (dir) {
    const rut = member.rut;
    if (dir.president?.rut === rut) dirRole = 'Presidente';
    else if (dir.vicePresident?.rut === rut) dirRole = 'Vicepresidente';
    else if (dir.secretary?.rut === rut) dirRole = 'Secretario';
    else if (dir.treasurer?.rut === rut) dirRole = 'Tesorero';
    else if (dir.additionalMembers?.some((m) => m?.rut === rut)) dirRole = 'Director';
  }

  return (
    <Modal open={open} onClose={onClose} title="Perfil de Miembro">
      <div className="r-profile-header" style={{ marginBottom: 24 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: '#3b82f6', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700,
          flexShrink: 0
        }}>
          {(member.firstName || '?')[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e3a8a' }}>{member.firstName} {member.lastName}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {dirRole && <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: '#dbeafe', color: '#1e40af' }}>{dirRole}</span>}
            <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: ['president', 'secretary', 'treasurer', 'director'].includes(member.role) ? '#dbeafe' : '#f3f4f6', color: ['president', 'secretary', 'treasurer', 'director'].includes(member.role) ? '#1e40af' : '#374151' }}>
              {({ president: 'Presidente', secretary: 'Secretario', treasurer: 'Tesorero', director: 'Director', member: 'Socio', electoral_commission: 'Comisión Electoral' })[member.role] || member.role || 'Socio'}
            </span>
          </div>
        </div>
      </div>

      <div className="r-grid-2">
        <ProfileField label="RUT" value={member.rut} />
        <ProfileField label="Edad" value={age !== null ? `${age} años${age < 18 ? ' (Menor de edad)' : ''}` : '—'} />
        <ProfileField label="Fecha de Nacimiento" value={member.birthDate ? localeDateString(member.birthDate) : '—'} />
        <ProfileField label="Teléfono" value={member.phone || '—'} />
        <ProfileField label="Email" value={member.email || '—'} />
        <ProfileField label="Dirección" value={member.address || '—'} />
        <ProfileField label="Estado" value={member.status === 'inactive' ? 'Dado de baja' : 'Activo'} />
        <ProfileField label="Fecha de Ingreso" value={member.joinDate ? localeDateString(member.joinDate) : '—'} />
        {member.status === 'inactive' && (
          <>
            <ProfileField label="Causal de Baja" value={({
              RENUNCIA_VOLUNTARIA: 'Renuncia Voluntaria',
              FALLECIMIENTO: 'Fallecimiento',
              CAMBIO_DOMICILIO: 'Cambio de Domicilio',
              EXPULSION_ASAMBLEA: 'Expulsión por Asamblea',
              OTRA: 'Otra'
            })[member.deactivationCategory] || member.deactivationReason || '—'} />
            <ProfileField label="Fecha de Baja" value={member.deactivatedAt ? localeDateString(member.deactivatedAt) : '—'} />
          </>
        )}
      </div>
      {member.status !== 'inactive' && onCertificate && (
        <button onClick={() => onCertificate(member)}
          style={{ width: '100%', marginTop: 16, padding: '12px 20px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Descargar Certificado de Membresía
        </button>
      )}
    </Modal>
  );
}

function ProfileField({ label, value }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
      <span style={{ fontSize: 11, color: '#6b7280', display: 'block' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: '#374151', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

// ========== Member Payment Modal ==========
const FEE_CONCEPTS = [
  { value: 'Cuota Mensual', label: 'Cuota Mensual' },
  { value: 'Incorporación', label: 'Cuota de Incorporación' },
  { value: 'Extraordinaria', label: 'Cuota Extraordinaria' }
];

function buildPeriodOptions() {
  const options = [];
  const now = new Date();
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  // Current year and previous year
  for (let y = now.getFullYear(); y >= now.getFullYear() - 1; y--) {
    months.forEach(m => options.push(`${m} ${y}`));
  }
  return options;
}

function MemberPaymentModal({ open, onClose, orgId, member, onSaved, addToast }) {
  const [concept, setConcept] = useState('Cuota Mensual');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  });
  const [submitting, setSubmitting] = useState(false);

  if (!member) return null;

  const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim();
  const periodOptions = buildPeriodOptions();

  async function handleSubmit(e) {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) { addToast('Ingresa un monto válido', 'error'); return; }

    setSubmitting(true);
    try {
      await apiService.updateOrganization(orgId, {
        addFinance: {
          concept: `${concept} — ${memberName}`,
          amount: Math.abs(numAmount),
          category: 'cuota',
          date: new Date().toISOString(),
          memberRut: member.rut,
          feePeriod: concept === 'Incorporación' ? 'Incorporación' : period
        }
      });
      addToast(`Pago de ${memberName} registrado`, 'success');
      setAmount('');
      setConcept('Cuota Mensual');
      onSaved();
    } catch (error) {
      addToast(error.message || 'Error al registrar pago', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar Pago">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="r-grid-2" style={{ marginBottom: 16 }}>
          <ProfileField label="Socio" value={memberName} />
          <ProfileField label="RUT" value={member.rut || '—'} />
        </div>

        <FormField label="Concepto" id="pay-concept">
          <select id="pay-concept" value={concept} onChange={(e) => setConcept(e.target.value)}
            style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 16 }}>
            {FEE_CONCEPTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </FormField>

        {concept !== 'Incorporación' && (
          <FormField label="Período" id="pay-period">
            <select id="pay-period" value={period} onChange={(e) => setPeriod(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 16 }}>
              {periodOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </FormField>
        )}

        <FormField label="Monto (CLP) *" id="pay-amount" type="number" placeholder="0" min="1" step="1"
          value={amount} onChange={(e) => setAmount(e.target.value)} />

        <div className="r-form-row" style={{ marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, background: '#f3f4f6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            Cancelar
          </button>
          <button type="submit" className="btn-auth" style={{ flex: 1 }} disabled={submitting}>
            {submitting ? 'Guardando...' : 'Registrar Pago'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
