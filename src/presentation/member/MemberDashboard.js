/**
 * Dashboard para Socios (Miembros) de Organizaciones
 * Vistas read-only + votación en asambleas
 */

import { apiService } from '../../services/ApiService.js';
import { showToast } from '../../app.js';

class MemberDashboard {
  constructor() {
    this.org = null;       // Organización activa
    this.orgs = [];        // Todas las organizaciones del miembro
    this.user = null;
  }

  async init() {
    try {
      const userData = localStorage.getItem('currentUser');
      if (userData) this.user = JSON.parse(userData);

      const data = await apiService.getMyOrganization();
      if (data && data.organizations) {
        this.orgs = data.organizations;
        this.org = this.orgs[0] || null;
      } else if (data && !data.organizations) {
        this.orgs = [data];
        this.org = data;
      }
      return this.org;
    } catch (err) {
      this.initError = err.message || String(err);
      return null;
    }
  }

  selectOrg(orgId) {
    const found = this.orgs.find(o => (o._id || o.id) === orgId);
    if (found) {
      this.org = found;
    }
  }

  getActiveOrgId() {
    return this.org ? (this.org._id || this.org.id) : null;
  }

  async refreshOrg() {
    try {
      const data = await apiService.getMyOrganization();
      if (data && data.organizations) {
        this.orgs = data.organizations;
        const activeId = this.getActiveOrgId();
        this.org = this.orgs.find(o => (o._id || o.id) === activeId) || this.orgs[0] || null;
      }
    } catch (err) {
      console.error('Error refreshing org:', err);
    }
  }

  renderPage(pageName) {
    const container = document.getElementById(`member-${pageName}-content`);
    if (!container) return;

    if (!this.org) {
      const errMsg = this.initError || 'Sin datos de organización';
      container.innerHTML = `<div class="org-empty-state"><p>No se encontró tu organización.</p><small style="color:#9ca3af;">Debug: ${errMsg} | orgs: ${this.orgs.length}</small></div>`;
      return;
    }

    switch (pageName) {
      case 'overview': container.innerHTML = this.renderOverview(); break;
      case 'directorio': container.innerHTML = this.renderDirectorio(); break;
      case 'documentos':
        container.innerHTML = this.renderDocumentos();
        this.attachDocumentosListeners(container);
        break;
      case 'actividades': container.innerHTML = this.renderActividades(); break;
      case 'asambleas':
        container.innerHTML = this.renderAsambleas();
        this.attachAsambleasListeners(container);
        break;
      case 'password':
        container.innerHTML = this.renderChangePassword();
        this.attachPasswordListeners(container);
        break;
    }
  }

  // ==================== HELPERS ====================

  _getTypeLabel(type) {
    const labels = {
      'JUNTA_VECINOS': 'Junta de Vecinos',
      'CLUB_DEPORTIVO': 'Club Deportivo',
      'CLUB_ADULTO_MAYOR': 'Club Adulto Mayor',
      'CENTRO_MADRES': 'Centro de Madres',
      'COMITE_VIVIENDA': 'Comité de Vivienda',
      'AGRUPACION_JUVENIL': 'Agrupación Juvenil',
      'CENTRO_CULTURAL': 'Centro Cultural',
      'OTRO': 'Otra Organización'
    };
    return labels[type] || type || '-';
  }

  _getStatusLabel(status) {
    const labels = {
      'draft': 'Borrador', 'waiting_ministro': 'Esperando Ministro',
      'ministro_scheduled': 'Ministro Agendado', 'ministro_approved': 'Ministro Aprobado',
      'pending_review': 'En Revisión', 'in_review': 'En Revisión',
      'approved': 'Aprobada', 'sent_registry': 'Enviada a Registro',
      'rejected': 'Rechazada', 'dissolved': 'Disuelta'
    };
    return labels[status] || status || '-';
  }

  _getStatusColor(status) {
    if (['approved', 'sent_registry'].includes(status)) return '#059669';
    if (['rejected', 'dissolved'].includes(status)) return '#ef4444';
    if (['pending_review', 'in_review'].includes(status)) return '#d97706';
    return '#6b7280';
  }

  /** Obtiene el nombre del directorio: usa `name` o `firstName lastName` */
  _getDirName(member) {
    if (!member) return 'Sin asignar';
    if (member.name) return member.name;
    if (member.firstName) return `${member.firstName} ${member.lastName || ''}`.trim();
    return 'Sin nombre';
  }

  _getDirInitial(member) {
    if (!member) return '?';
    const name = this._getDirName(member);
    return name[0] || '?';
  }

  // ==================== OVERVIEW ====================

  renderOverview() {
    const org = this.org;
    const typeName = this._getTypeLabel(org.organizationType);
    const statusLabel = this._getStatusLabel(org.status);
    const statusColor = this._getStatusColor(org.status);
    const memberCount = (org.members || []).length;
    const assemblyCount = (org.assemblies || []).length;
    const pd = org.provisionalDirectorio || {};
    const dirType = pd.type === 'ELECTO' ? 'Electo' : 'Provisorio';

    return `
      <div class="org-content-area">
        <div class="org-section-header">
          <h2 class="org-section-title">${org.organizationName || 'Mi Organización'}</h2>
        </div>

        <div class="org-stats-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:24px;">
          <div class="org-stat-card" style="padding:16px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:12px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#2563eb;">${memberCount}</div>
            <div style="font-size:12px;color:#6b7280;font-weight:600;margin-top:4px;">Socios</div>
          </div>
          <div class="org-stat-card" style="padding:16px;background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:12px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#059669;">${assemblyCount}</div>
            <div style="font-size:12px;color:#6b7280;font-weight:600;margin-top:4px;">Asambleas</div>
          </div>
          <div class="org-stat-card" style="padding:16px;background:linear-gradient(135deg,#fefce8,#fef3c7);border-radius:12px;text-align:center;">
            <div style="font-size:14px;font-weight:700;color:#b45309;margin-top:4px;">${dirType}</div>
            <div style="font-size:12px;color:#6b7280;font-weight:600;margin-top:4px;">Directorio</div>
          </div>
          <div class="org-stat-card" style="padding:16px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:12px;text-align:center;">
            <div style="font-size:14px;font-weight:700;color:${statusColor};margin-top:4px;">${statusLabel}</div>
            <div style="font-size:12px;color:#6b7280;font-weight:600;margin-top:4px;">Estado</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="org-info-card" style="padding:16px;background:white;border:1px solid #e5e7eb;border-radius:12px;">
            <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Tipo de Organización</span>
            <div style="margin-top:6px;font-weight:600;color:#1e293b;">${typeName}</div>
          </div>
          <div class="org-info-card" style="padding:16px;background:white;border:1px solid #e5e7eb;border-radius:12px;">
            <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Dirección</span>
            <div style="margin-top:6px;color:#1e293b;">${org.address || '-'}</div>
          </div>
          <div class="org-info-card" style="padding:16px;background:white;border:1px solid #e5e7eb;border-radius:12px;">
            <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Comuna</span>
            <div style="margin-top:6px;color:#1e293b;">${org.comuna || 'Renca'}</div>
          </div>
          <div class="org-info-card" style="padding:16px;background:white;border:1px solid #e5e7eb;border-radius:12px;">
            <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Unidad Vecinal</span>
            <div style="margin-top:6px;color:#1e293b;">${org.unidadVecinal || '-'}</div>
          </div>
          ${org.contactEmail ? `
          <div class="org-info-card" style="padding:16px;background:white;border:1px solid #e5e7eb;border-radius:12px;">
            <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Email de Contacto</span>
            <div style="margin-top:6px;color:#1e293b;">${org.contactEmail}</div>
          </div>` : ''}
          ${org.contactPhone ? `
          <div class="org-info-card" style="padding:16px;background:white;border:1px solid #e5e7eb;border-radius:12px;">
            <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Teléfono de Contacto</span>
            <div style="margin-top:6px;color:#1e293b;">${org.contactPhone}</div>
          </div>` : ''}
        </div>

        ${org.description ? `
        <div style="margin-top:16px;padding:16px;background:white;border:1px solid #e5e7eb;border-radius:12px;">
          <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Descripción</span>
          <p style="margin:8px 0 0;color:#374151;line-height:1.6;">${org.description}</p>
        </div>` : ''}

        ${org.objectives ? `
        <div style="margin-top:16px;padding:16px;background:white;border:1px solid #e5e7eb;border-radius:12px;">
          <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Objetivos</span>
          <p style="margin:8px 0 0;color:#374151;line-height:1.6;">${org.objectives}</p>
        </div>` : ''}
      </div>
    `;
  }

  // ==================== DIRECTORIO ====================

  renderDirectorio() {
    const pd = this.org.provisionalDirectorio || {};
    const dirType = pd.type === 'ELECTO' ? 'Electo' : 'Provisorio';
    const mainCargos = [
      { key: 'president', label: 'Presidente', color: '#2563eb', bg: '#eff6ff' },
      { key: 'secretary', label: 'Secretario/a', color: '#059669', bg: '#ecfdf5' },
      { key: 'treasurer', label: 'Tesorero/a', color: '#d97706', bg: '#fefce8' }
    ];
    const additionalMembers = pd.additionalMembers || [];

    return `
      <div class="org-content-area">
        <div class="org-section-header" style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <h2 class="org-section-title" style="margin:0;">Directorio</h2>
          <span style="background:${dirType === 'Electo' ? '#ecfdf5' : '#fefce8'};color:${dirType === 'Electo' ? '#059669' : '#b45309'};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">${dirType}</span>
        </div>
        <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">Miembros del directorio actual de tu organización.</p>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
          ${mainCargos.map(c => {
            const m = pd[c.key];
            const name = this._getDirName(m);
            const initial = this._getDirInitial(m);
            const rut = m?.rut || '';
            return `
              <div style="padding:20px;background:white;border-radius:12px;border:1px solid #e5e7eb;border-left:4px solid ${c.color};transition:box-shadow 0.2s;">
                <div style="font-size:12px;font-weight:700;color:${c.color};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">${c.label}</div>
                ${m ? `
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:44px;height:44px;border-radius:50%;background:${c.bg};color:${c.color};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;flex-shrink:0;">${initial}</div>
                  <div>
                    <div style="font-weight:600;font-size:15px;color:#1e293b;">${name}</div>
                    <div style="font-size:13px;color:#6b7280;margin-top:2px;">${rut}</div>
                  </div>
                </div>` : `
                <div style="color:#9ca3af;font-style:italic;">Sin asignar</div>`}
              </div>
            `;
          }).join('')}

          ${additionalMembers.map((m, i) => {
            const name = this._getDirName(m);
            const initial = this._getDirInitial(m);
            const rut = m?.rut || '';
            return `
              <div style="padding:20px;background:white;border-radius:12px;border:1px solid #e5e7eb;border-left:4px solid #8b5cf6;transition:box-shadow 0.2s;">
                <div style="font-size:12px;font-weight:700;color:#8b5cf6;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">Director/a ${i + 1}</div>
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:44px;height:44px;border-radius:50%;background:#f5f3ff;color:#8b5cf6;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;flex-shrink:0;">${initial}</div>
                  <div>
                    <div style="font-weight:600;font-size:15px;color:#1e293b;">${name}</div>
                    <div style="font-size:13px;color:#6b7280;margin-top:2px;">${rut}</div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ==================== DOCUMENTOS ====================

  renderDocumentos() {
    const org = this.org;
    const hasEstatutos = !!org.estatutos;
    const myCerts = (org.certificatesStep5 || []);
    const userRut = this.user?.rut;
    const myCert = myCerts.find(c => c.memberId === userRut || c.memberName?.includes(this.user?.firstName));

    const docItems = [];

    if (hasEstatutos) {
      docItems.push({
        title: 'Estatutos de la Organización',
        icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
        color: '#2563eb',
        bg: '#eff6ff',
        action: 'view-estatutos',
        actionLabel: 'Ver'
      });
    }

    if (myCert) {
      docItems.push({
        title: 'Mi Certificado de Residencia',
        icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        color: '#059669',
        bg: '#ecfdf5',
        action: 'view-cert',
        actionLabel: 'Ver'
      });
    }

    // Mostrar todos los certificados si hay mas de uno (para transparencia)
    if (myCerts.length > 0 && !myCert) {
      docItems.push({
        title: `Certificados de Socios (${myCerts.length})`,
        icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        color: '#059669',
        bg: '#ecfdf5',
        action: null,
        actionLabel: `${myCerts.length} disponibles`
      });
    }

    return `
      <div class="org-content-area">
        <div class="org-section-header">
          <h2 class="org-section-title">Documentos</h2>
        </div>

        ${docItems.length > 0 ? `
        <div style="display:grid;gap:12px;">
          ${docItems.map(doc => `
            <div style="padding:16px 20px;background:white;border:1px solid #e5e7eb;border-radius:12px;display:flex;align-items:center;justify-content:space-between;transition:box-shadow 0.2s;">
              <div style="display:flex;align-items:center;gap:14px;">
                <div style="width:40px;height:40px;border-radius:10px;background:${doc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                  ${doc.icon}
                </div>
                <div>
                  <div style="font-weight:600;color:#1e293b;">${doc.title}</div>
                </div>
              </div>
              ${doc.action ? `
              <button class="btn-member-doc" data-action="${doc.action}" style="padding:8px 20px;border:1px solid ${doc.color};border-radius:8px;background:${doc.bg};color:${doc.color};cursor:pointer;font-weight:600;font-size:13px;transition:all 0.2s;">${doc.actionLabel}</button>
              ` : `
              <span style="color:#6b7280;font-size:13px;font-weight:500;">${doc.actionLabel}</span>
              `}
            </div>
          `).join('')}
        </div>
        ` : `
        <div class="org-empty-state" style="padding:48px 24px;text-align:center;background:white;border:1px solid #e5e7eb;border-radius:12px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" style="margin:0 auto 12px;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <p style="color:#6b7280;margin:0;">No hay documentos disponibles aún.</p>
        </div>
        `}
      </div>
    `;
  }

  attachDocumentosListeners(container) {
    container.querySelectorAll('.btn-member-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'view-estatutos') this.viewEstatutos();
        if (action === 'view-cert') this.viewMyCertificate();
      });
    });
  }

  viewEstatutos() {
    const estatutos = this.org.estatutos;
    if (!estatutos) return;

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width:800px;max-height:90vh;">
        <div class="org-modal-header">
          <h3>Estatutos de la Organización</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding:24px;overflow-y:auto;max-height:70vh;">
          <div style="line-height:1.8;color:#374151;white-space:pre-wrap;font-size:14px;">${estatutos}</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  viewMyCertificate() {
    const certs = this.org.certificatesStep5 || [];
    const userRut = this.user?.rut;
    const cert = certs.find(c => c.memberId === userRut || c.memberName?.includes(this.user?.firstName));
    if (!cert || !cert.certificate) { showToast('Certificado no encontrado', 'error'); return; }

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width:700px;max-height:90vh;">
        <div class="org-modal-header">
          <h3>Mi Certificado</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding:24px;overflow-y:auto;max-height:70vh;text-align:center;">
          <img src="${cert.certificate}" alt="Certificado" style="max-width:100%;border-radius:8px;border:1px solid #e5e7eb;">
          <p style="margin-top:12px;font-size:13px;color:#6b7280;">${cert.memberName || ''}</p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  // ==================== ACTIVIDADES ====================

  renderActividades() {
    const activities = this.org.activities || [];
    return `
      <div class="org-content-area">
        <div class="org-section-header">
          <h2 class="org-section-title">Actividades</h2>
        </div>
        ${activities.length > 0 ? `
          <div style="display:grid;gap:12px;">
            ${activities.map(a => `
              <div style="padding:16px 20px;background:white;border:1px solid #e5e7eb;border-radius:12px;border-left:4px solid #2563eb;transition:box-shadow 0.2s;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div style="font-weight:600;font-size:15px;color:#1e293b;">${a.title || a.name || 'Actividad'}</div>
                  ${a.date ? `<span style="font-size:13px;color:#6b7280;background:#f3f4f6;padding:4px 10px;border-radius:8px;">${new Date(a.date).toLocaleDateString('es-CL')}</span>` : ''}
                </div>
                ${a.description ? `<p style="margin:8px 0 0;color:#4b5563;font-size:14px;line-height:1.5;">${a.description}</p>` : ''}
              </div>
            `).join('')}
          </div>
        ` : `
        <div class="org-empty-state" style="padding:48px 24px;text-align:center;background:white;border:1px solid #e5e7eb;border-radius:12px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" style="margin:0 auto 12px;">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p style="color:#6b7280;margin:0;">No hay actividades registradas.</p>
        </div>
        `}
      </div>
    `;
  }

  // ==================== ASAMBLEAS ====================

  renderAsambleas() {
    const asambleas = this.org.assemblies || [];
    const statusConfig = {
      draft: { label: 'Borrador', color: '#6b7280', bg: '#f3f4f6' },
      convocada: { label: 'Convocada', color: '#2563eb', bg: '#eff6ff' },
      en_curso: { label: 'En Curso', color: '#059669', bg: '#ecfdf5' },
      finalizada: { label: 'Finalizada', color: '#7c3aed', bg: '#f5f3ff' },
      cancelada: { label: 'Cancelada', color: '#ef4444', bg: '#fef2f2' }
    };

    return `
      <div class="org-content-area">
        <div class="org-section-header">
          <h2 class="org-section-title">Asambleas</h2>
        </div>
        ${asambleas.length > 0 ? `
          <div style="display:grid;gap:12px;">
            ${asambleas.map(a => {
              const st = statusConfig[a.status] || statusConfig.draft;
              const hasOpenVoting = (a.agendaItems || []).some(item => item.votingOpen);
              return `
              <div style="padding:16px 20px;background:white;border-radius:12px;border:1px solid #e5e7eb;${hasOpenVoting ? 'border-color:#059669;box-shadow:0 0 0 1px #059669;' : ''}transition:box-shadow 0.2s;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                  <div style="flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                      <strong style="font-size:15px;color:#1e293b;">${a.title || 'Asamblea'}</strong>
                      <span style="background:${st.bg};color:${st.color};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;">${st.label}</span>
                      ${hasOpenVoting ? '<span style="background:#ecfdf5;color:#059669;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;">Votación Abierta</span>' : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:16px;margin-top:10px;">
                      ${a.date ? `<span style="font-size:13px;color:#6b7280;display:flex;align-items:center;gap:4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        ${new Date(a.date).toLocaleDateString('es-CL')}
                      </span>` : ''}
                      <span style="font-size:13px;color:#6b7280;">${(a.agendaItems || []).length} punto(s)</span>
                      <span style="font-size:13px;color:#6b7280;">${(a.attendees || []).length} asistentes</span>
                    </div>
                  </div>
                  <button class="btn-member-view-assembly" data-id="${a.id}" style="padding:8px 20px;border:1px solid #2563eb;border-radius:8px;background:#eff6ff;color:#2563eb;cursor:pointer;font-weight:600;font-size:13px;white-space:nowrap;transition:all 0.2s;">Ver Detalle</button>
                </div>
              </div>
            `;}).join('')}
          </div>
        ` : `
        <div class="org-empty-state" style="padding:48px 24px;text-align:center;background:white;border:1px solid #e5e7eb;border-radius:12px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" style="margin:0 auto 12px;">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p style="color:#6b7280;margin:0;">No hay asambleas registradas.</p>
        </div>
        `}
      </div>
    `;
  }

  attachAsambleasListeners(container) {
    container.querySelectorAll('.btn-member-view-assembly').forEach(btn => {
      btn.addEventListener('click', () => this.showAssemblyDetail(btn.dataset.id));
    });
  }

  showAssemblyDetail(assemblyId) {
    const assembly = (this.org.assemblies || []).find(a => a.id === assemblyId);
    if (!assembly) return;

    const orgId = this.org._id;
    const voterRut = this.user?.rut;
    const statusConfig = {
      draft: { label: 'Borrador', color: '#6b7280', bg: '#f3f4f6' },
      convocada: { label: 'Convocada', color: '#2563eb', bg: '#eff6ff' },
      en_curso: { label: 'En Curso', color: '#059669', bg: '#ecfdf5' },
      finalizada: { label: 'Finalizada', color: '#7c3aed', bg: '#f5f3ff' },
      cancelada: { label: 'Cancelada', color: '#ef4444', bg: '#fef2f2' }
    };
    const st = statusConfig[assembly.status] || statusConfig.draft;
    const totalMembers = (this.org.members || []).length;
    const quorumRequired = assembly.quorumType === 'percentage'
      ? Math.ceil(totalMembers * (assembly.quorumValue || 50) / 100)
      : (assembly.quorumValue || 0);
    const attendeeCount = (assembly.attendees || []).length;
    const quorumMet = attendeeCount >= quorumRequired;

    const agendaTypeLabels = {
      eleccion_directorio: 'Elección de Directorio',
      aprobacion_presupuesto: 'Aprobación de Presupuesto',
      reforma_estatutos: 'Reforma de Estatutos',
      memoria_anual: 'Memoria Anual',
      disolucion: 'Disolución',
      custom: 'Tema General'
    };

    const modal = document.createElement('div');
    modal.className = 'org-modal-overlay';
    modal.innerHTML = `
      <div class="org-modal" style="max-width: 700px; max-height: 90vh;">
        <div class="org-modal-header">
          <h3>${assembly.title || 'Detalle de Asamblea'}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="org-modal-body" style="padding: 24px; overflow-y: auto; max-height: 70vh;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
            <div style="padding:12px;background:#f8fafc;border-radius:8px;">
              <span style="font-size:12px;color:#6b7280;">Estado</span>
              <div style="margin-top:4px;"><span style="background:${st.bg};color:${st.color};padding:4px 12px;border-radius:10px;font-size:13px;font-weight:600;">${st.label}</span></div>
            </div>
            <div style="padding:12px;border-radius:8px;background:${quorumMet ? '#ecfdf5' : '#fef2f2'};">
              <span style="font-size:12px;color:#6b7280;">Quórum</span>
              <div style="margin-top:4px;font-weight:600;color:${quorumMet ? '#059669' : '#ef4444'};">${attendeeCount} / ${quorumRequired}</div>
            </div>
          </div>

          <h4 style="margin:16px 0 8px;">Puntos de Agenda</h4>
          ${(assembly.agendaItems || []).map((item, idx) => {
            const typeLabel = agendaTypeLabels[item.type] || item.type;
            const isElection = item.type === 'eleccion_directorio';
            const alreadyVoted = (item.votes || []).some(v => v.voterRut === voterRut);
            const canVote = assembly.status === 'en_curso' && item.votingOpen && !alreadyVoted;

            let votingUI = '';
            if (canVote && isElection) {
              if (item.votingMode === 'per_cargo') {
                const byCargo = {};
                (item.candidates || []).forEach(c => {
                  if (!byCargo[c.cargo]) byCargo[c.cargo] = [];
                  byCargo[c.cargo].push(c);
                });
                votingUI = `
                  <div class="vote-section" data-agenda-id="${item.id}" data-mode="per_cargo" style="margin-top:12px;">
                    ${Object.entries(byCargo).map(([cargo, cands]) => `
                      <div style="margin-bottom:12px;">
                        <strong style="font-size:13px;text-transform:capitalize;">${cargo}</strong>
                        <div style="display:grid;gap:6px;margin-top:6px;">
                          ${cands.map(c => `
                            <label style="display:flex;align-items:center;gap:10px;padding:10px;background:#f9fafb;border-radius:8px;cursor:pointer;border:2px solid transparent;transition:border-color 0.2s;">
                              <input type="radio" name="vote-${item.id}-${cargo}" value="${c.rut}" style="width:18px;height:18px;">
                              <span>${c.firstName} ${c.lastName}</span>
                            </label>
                          `).join('')}
                        </div>
                      </div>
                    `).join('')}
                    <button class="btn-submit-vote" data-agenda-id="${item.id}" style="margin-top:8px;padding:10px 24px;border:none;border-radius:8px;background:#2563eb;color:white;cursor:pointer;font-weight:600;">Votar</button>
                  </div>
                `;
              } else if (item.votingMode === 'per_lista') {
                const listas = {};
                (item.candidates || []).forEach(c => {
                  if (!listas[c.lista]) listas[c.lista] = [];
                  listas[c.lista].push(c);
                });
                votingUI = `
                  <div class="vote-section" data-agenda-id="${item.id}" data-mode="per_lista" style="margin-top:12px;">
                    <div style="display:grid;gap:8px;">
                      ${Object.entries(listas).map(([lista, cands]) => `
                        <label style="display:flex;align-items:start;gap:12px;padding:14px;background:#f9fafb;border-radius:10px;cursor:pointer;border:2px solid transparent;transition:border-color 0.2s;">
                          <input type="radio" name="vote-lista-${item.id}" value="${lista}" style="width:18px;height:18px;margin-top:2px;">
                          <div>
                            <strong>${lista}</strong>
                            <div style="font-size:12px;color:#6b7280;margin-top:4px;">${cands.map(c => `${c.cargo ? c.cargo + ': ' : ''}${c.firstName} ${c.lastName}`).join(', ')}</div>
                          </div>
                        </label>
                      `).join('')}
                    </div>
                    <button class="btn-submit-vote" data-agenda-id="${item.id}" style="margin-top:8px;padding:10px 24px;border:none;border-radius:8px;background:#2563eb;color:white;cursor:pointer;font-weight:600;">Votar</button>
                  </div>
                `;
              }
            }

            let resultUI = '';
            if (item.result && assembly.status === 'finalizada') {
              if (item.result.mode === 'per_cargo') {
                resultUI = `<div style="margin-top:8px;padding:10px;background:#f5f3ff;border-radius:8px;font-size:13px;">
                  <strong style="color:#7c3aed;">Resultados:</strong>
                  ${Object.entries(item.result.winners || {}).map(([cargo, w]) => `<div style="margin-top:4px;">${cargo}: <strong>${w.firstName} ${w.lastName}</strong> (${w.votes} votos)</div>`).join('')}
                </div>`;
              } else if (item.result.mode === 'per_lista') {
                resultUI = `<div style="margin-top:8px;padding:10px;background:#f5f3ff;border-radius:8px;font-size:13px;">
                  <strong style="color:#7c3aed;">Lista ganadora: ${item.result.winningLista || '-'}</strong>
                  (${item.result.votesByLista?.[item.result.winningLista] || 0} votos)
                </div>`;
              }
            }

            return `
            <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:10px;${item.votingOpen ? 'border-color:#059669;background:#f0fdf4;' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <strong>${idx + 1}. ${item.title}</strong>
                  <span style="font-size:11px;color:#6b7280;margin-left:8px;">${typeLabel}</span>
                </div>
                ${item.votingOpen ? '<span style="background:#ecfdf5;color:#059669;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">Votación Abierta</span>' : ''}
              </div>
              ${alreadyVoted && !item.result ? '<div style="margin-top:8px;color:#059669;font-size:13px;font-weight:600;">Tu voto ha sido registrado.</div>' : ''}
              ${votingUI}
              ${resultUI}
            </div>`;
          }).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Vote submission handlers
    modal.querySelectorAll('.btn-submit-vote').forEach(btn => {
      btn.addEventListener('click', async () => {
        const agendaItemId = btn.dataset.agendaId;
        const section = modal.querySelector(`.vote-section[data-agenda-id="${agendaItemId}"]`);
        const mode = section?.dataset.mode;
        const votes = [];

        if (mode === 'per_cargo') {
          const radioGroups = new Set();
          section.querySelectorAll('input[type="radio"]').forEach(r => radioGroups.add(r.name));
          for (const group of radioGroups) {
            const selected = section.querySelector(`input[name="${group}"]:checked`);
            if (selected) {
              const cargo = group.replace(`vote-${agendaItemId}-`, '');
              votes.push({ cargo, candidateRut: selected.value });
            }
          }
          if (votes.length === 0) { showToast('Selecciona al menos un candidato', 'error'); return; }
        } else if (mode === 'per_lista') {
          const selected = section.querySelector(`input[name="vote-lista-${agendaItemId}"]:checked`);
          if (!selected) { showToast('Selecciona una lista', 'error'); return; }
          votes.push({ lista: selected.value });
        }

        btn.disabled = true;
        btn.textContent = 'Enviando...';

        try {
          await apiService.castVote(orgId, assemblyId, agendaItemId, votes);
          showToast('Voto registrado exitosamente', 'success');
          await this.refreshOrg();
          modal.remove();
          this.showAssemblyDetail(assemblyId);
        } catch (err) {
          showToast(err.message || 'Error al votar', 'error');
          btn.disabled = false;
          btn.textContent = 'Votar';
        }
      });
    });
  }

  // ==================== CAMBIAR CONTRASEÑA ====================

  renderChangePassword() {
    return `
      <div class="org-content-area" style="max-width:500px;">
        <div class="org-section-header">
          <h2 class="org-section-title">Cambiar Contraseña</h2>
        </div>
        <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">Tu contraseña inicial es tu RUT. Te recomendamos cambiarla por una contraseña segura.</p>
        <form id="member-change-password-form" style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
          <div style="margin-bottom:20px;">
            <label style="display:block;font-weight:600;margin-bottom:6px;font-size:14px;color:#374151;">Contraseña Actual</label>
            <input type="password" id="member-current-password" required style="width:100%;padding:12px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;box-sizing:border-box;transition:border-color 0.2s;">
          </div>
          <div style="margin-bottom:20px;">
            <label style="display:block;font-weight:600;margin-bottom:6px;font-size:14px;color:#374151;">Nueva Contraseña</label>
            <input type="password" id="member-new-password" required style="width:100%;padding:12px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;box-sizing:border-box;transition:border-color 0.2s;" placeholder="Min 6 caracteres, una mayúscula">
          </div>
          <div style="margin-bottom:24px;">
            <label style="display:block;font-weight:600;margin-bottom:6px;font-size:14px;color:#374151;">Confirmar Nueva Contraseña</label>
            <input type="password" id="member-confirm-password" required style="width:100%;padding:12px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;box-sizing:border-box;transition:border-color 0.2s;">
          </div>
          <button type="submit" style="padding:14px 32px;border:none;border-radius:10px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;font-weight:600;font-size:15px;cursor:pointer;transition:opacity 0.2s;width:100%;">Cambiar Contraseña</button>
        </form>
      </div>
    `;
  }

  attachPasswordListeners(container) {
    const form = container.querySelector('#member-change-password-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const currentPassword = container.querySelector('#member-current-password').value;
      const newPassword = container.querySelector('#member-new-password').value;
      const confirmPassword = container.querySelector('#member-confirm-password').value;

      if (newPassword.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
      if (!/[A-Z]/.test(newPassword)) { showToast('La contraseña debe contener al menos una mayúscula', 'error'); return; }
      if (newPassword !== confirmPassword) { showToast('Las contraseñas no coinciden', 'error'); return; }

      try {
        await apiService.changePassword(currentPassword, newPassword);
        showToast('Contraseña cambiada exitosamente', 'success');
        const userData = localStorage.getItem('currentUser');
        if (userData) {
          const user = JSON.parse(userData);
          user.mustChangePassword = false;
          localStorage.setItem('currentUser', JSON.stringify(user));
        }
        form.reset();
      } catch (err) {
        showToast(err.message || 'Error al cambiar contraseña', 'error');
      }
    });
  }
}

export const memberDashboard = new MemberDashboard();
