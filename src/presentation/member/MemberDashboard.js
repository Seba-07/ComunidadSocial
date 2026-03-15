/**
 * Dashboard para Socios (Miembros) de Organizaciones
 * Vistas read-only + votación en asambleas
 */

import { apiService } from '../../services/ApiService.js';
import { orgDocumentService } from '../../services/OrgDocumentService.js';
import { pdfService } from '../../services/PDFService.js';
import { jsPDF } from 'jspdf';
import { showToast } from '../../app.js';
import tenant from '../../config/tenant.js';

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

  /**
   * Inicializa con datos pre-cargados (evita doble llamada API)
   */
  initWithData(orgs, user) {
    this.user = user || null;
    this.orgs = orgs || [];
    this.org = this.orgs[0] || null;
    return this.org;
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
      container.innerHTML = `<div class="org-empty-state"><p>No se encontró tu organización.</p><small style="color:#9ca3af;"></small></div>`;
      container.querySelector('small').textContent = `Debug: ${errMsg} | orgs: ${this.orgs.length}`;
      return;
    }

    switch (pageName) {
      case 'overview':
        container.innerHTML = this.renderOverview();
        container.querySelectorAll('.btn-overview-assembly').forEach(btn => {
          btn.addEventListener('click', () => this.showAssemblyDetail(btn.dataset.id));
        });
        break;
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

    // Upcoming/active assemblies for notification
    const activeAssemblies = (org.assemblies || []).filter(a =>
      ['convocada', 'en_curso'].includes(a.status)
    );

    return `
      <div class="org-content-area">
        <div class="org-section-header">
          <h2 class="org-section-title">${org.organizationName || 'Mi Organización'}</h2>
        </div>

        ${activeAssemblies.length > 0 ? `
        <div style="margin-bottom:20px;display:grid;gap:10px;">
          ${activeAssemblies.map(a => {
            const isEnCurso = a.status === 'en_curso';
            const hasOpenVoting = (a.agendaItems || []).some(i => i.votingOpen);
            const borderColor = isEnCurso ? '#059669' : '#2563eb';
            const bgColor = isEnCurso ? '#ecfdf5' : '#eff6ff';
            const iconColor = isEnCurso ? '#059669' : '#2563eb';
            return `
            <div style="padding:16px 20px;background:${bgColor};border:2px solid ${borderColor};border-radius:12px;display:flex;align-items:center;gap:14px;">
              <div style="width:42px;height:42px;border-radius:50%;background:${borderColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M15 17h5l-1.4-1.4A6.97 6.97 0 0 0 21 11a7 7 0 1 0-14 0c0 1.7.6 3.3 1.6 4.6L7 17h5"/><path d="M12 21a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2z"/></svg>
              </div>
              <div style="flex:1;">
                <div style="font-weight:700;color:${iconColor};font-size:15px;">
                  ${isEnCurso ? 'Asamblea en curso' : 'Convocatoria a Asamblea'}
                  ${hasOpenVoting ? ' - Votacion abierta' : ''}
                </div>
                <div style="font-size:14px;color:#374151;margin-top:2px;">${a.title || 'Asamblea'} ${a.date ? '- ' + new Date(a.date).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : ''} ${a.time || ''}</div>
              </div>
              <button class="btn-overview-assembly" data-id="${a.id}" style="padding:8px 16px;border:2px solid ${borderColor};border-radius:8px;background:white;color:${borderColor};cursor:pointer;font-weight:600;font-size:13px;white-space:nowrap;">Ver Detalle</button>
            </div>`;
          }).join('')}
        </div>` : ''}

        <div class="org-stats-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:24px;">
          <div style="padding:16px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:12px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#2563eb;">${memberCount}</div>
            <div style="font-size:12px;color:#6b7280;font-weight:600;margin-top:4px;">Socios</div>
          </div>
          <div style="padding:16px;background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:12px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#059669;">${assemblyCount}</div>
            <div style="font-size:12px;color:#6b7280;font-weight:600;margin-top:4px;">Asambleas</div>
          </div>
          <div style="padding:16px;background:linear-gradient(135deg,#fefce8,#fef3c7);border-radius:12px;text-align:center;">
            <div style="font-size:14px;font-weight:700;color:#b45309;margin-top:4px;">${dirType}</div>
            <div style="font-size:12px;color:#6b7280;font-weight:600;margin-top:4px;">Directorio</div>
          </div>
          <div style="padding:16px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:12px;text-align:center;">
            <div style="font-size:14px;font-weight:700;color:${statusColor};margin-top:4px;">${statusLabel}</div>
            <div style="font-size:12px;color:#6b7280;font-weight:600;margin-top:4px;">Estado</div>
          </div>
        </div>

        <div class="r-grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div style="padding:16px;background:white;border:1px solid #e5e7eb;border-radius:12px;">
            <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Tipo de Organización</span>
            <div style="margin-top:6px;font-weight:600;color:#1e293b;">${typeName}</div>
          </div>
          <div style="padding:16px;background:white;border:1px solid #e5e7eb;border-radius:12px;">
            <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Dirección</span>
            <div style="margin-top:6px;color:#1e293b;">${org.address || '-'}</div>
          </div>
          <div style="padding:16px;background:white;border:1px solid #e5e7eb;border-radius:12px;">
            <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Comuna</span>
            <div style="margin-top:6px;color:#1e293b;">${org.comuna || tenant.communeName}</div>
          </div>
          <div style="padding:16px;background:white;border:1px solid #e5e7eb;border-radius:12px;">
            <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Unidad Vecinal</span>
            <div style="margin-top:6px;color:#1e293b;">${org.unidadVecinal || '-'}</div>
          </div>
        </div>

        ${org.description ? `
        <div style="margin-top:16px;padding:16px;background:white;border:1px solid #e5e7eb;border-radius:12px;">
          <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Descripción</span>
          <p style="margin:8px 0 0;color:#374151;line-height:1.6;">${org.description}</p>
        </div>` : ''}
      </div>
    `;
  }

  // ==================== DIRECTORIO ====================

  /**
   * Obtiene la configuración de cargos según tipo de org o estatutosSnapshot
   */
  _getDirectorioConfig() {
    const org = this.org;
    const orgType = org.organizationType || '';

    // Primero intentar desde estatutosSnapshot
    const snapshotCargos = org.estatutosSnapshot?.directorio?.cargos;
    if (snapshotCargos && snapshotCargos.length > 0) return snapshotCargos;

    const configs = {
      JUNTA_VECINOS: [
        { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb' },
        { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6' },
        { id: 'secretario', nombre: 'Secretario/a', color: '#10b981' },
        { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b' },
        { id: 'director1', nombre: 'Director/a', color: '#6366f1' }
      ],
      COMITE_VIVIENDA: [
        { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb' },
        { id: 'secretario', nombre: 'Secretario/a', color: '#10b981' },
        { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b' },
        { id: 'director1', nombre: 'Director/a 1', color: '#6366f1' },
        { id: 'director2', nombre: 'Director/a 2', color: '#ec4899' }
      ],
      COMITE_CONVIVENCIA: [
        { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb' },
        { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6' },
        { id: 'secretario', nombre: 'Secretario/a', color: '#10b981' },
        { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b' },
        { id: 'directorPrevencion', nombre: 'Director/a de Prevención', color: '#ef4444' },
        { id: 'directorConvivencia', nombre: 'Director/a de Convivencia', color: '#06b6d4' }
      ]
    };

    return configs[orgType] || [
      { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb' },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6' },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981' },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b' },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1' }
    ];
  }

  /**
   * Obtiene el miembro del directorio para un cargo dado (misma lógica que OrganizationDashboard)
   */
  _getProvisionalMember(cargoId) {
    const org = this.org;
    const prov = org.provisionalDirectorio || {};
    const fieldMap = {
      'presidente': 'president',
      'vicepresidente': 'vicePresident',
      'secretario': 'secretary',
      'tesorero': 'treasurer'
    };
    const field = fieldMap[cargoId];
    if (field && prov[field]) return prov[field];
    // Buscar con nombre en español directamente
    if (prov[cargoId]) return prov[cargoId];
    // Buscar en additionalMembers para directores
    if (cargoId.startsWith('director') && prov.additionalMembers) {
      const idx = cargoId === 'director1' ? 0 : cargoId === 'director2' ? 1 : null;
      if (idx !== null && prov.additionalMembers[idx]) return prov.additionalMembers[idx];
    }
    // Buscar en miembros del org por role
    const roleMap = { 'presidente': 'president', 'vicepresidente': 'vice_president', 'secretario': 'secretary', 'tesorero': 'treasurer', 'director1': 'director', 'director2': 'director' };
    const memberRole = roleMap[cargoId];
    if (memberRole && org.members) {
      const found = org.members.filter(m => m.role === memberRole);
      if (cargoId === 'director2') return found[1] || null;
      return found[0] || null;
    }
    return null;
  }

  renderDirectorio() {
    const pd = this.org.provisionalDirectorio || {};
    const dirType = pd.type === 'ELECTO' ? 'Electo' : 'Provisorio';
    const cargos = this._getDirectorioConfig();

    return `
      <div class="org-content-area">
        <div class="org-section-header" style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <h2 class="org-section-title" style="margin:0;">Directorio</h2>
          <span style="background:${dirType === 'Electo' ? '#ecfdf5' : '#fefce8'};color:${dirType === 'Electo' ? '#059669' : '#b45309'};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">${dirType}</span>
        </div>
        <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">Miembros del directorio actual de tu organización.</p>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
          ${cargos.map(cargo => {
            const m = this._getProvisionalMember(cargo.id);
            const name = this._getDirName(m);
            const initial = this._getDirInitial(m);
            const rut = m?.rut || '';
            const color = cargo.color || '#6366f1';
            const bg = color + '15';
            return `
              <div style="padding:20px;background:white;border-radius:12px;border:1px solid #e5e7eb;border-left:4px solid ${color};transition:box-shadow 0.2s;">
                <div style="font-size:12px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">${cargo.nombre}</div>
                ${m ? `
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:44px;height:44px;border-radius:50%;background:${bg};color:${color};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;flex-shrink:0;">${initial}</div>
                  <div>
                    <div style="font-weight:600;font-size:15px;color:#1e293b;">${name}</div>
                    <div style="font-size:13px;color:#6b7280;margin-top:2px;">${rut}</div>
                  </div>
                </div>` : `
                <div style="color:#9ca3af;font-style:italic;">Sin asignar</div>`}
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

    // Build legal document items
    const legalDocs = [];
    if (hasEstatutos) {
      legalDocs.push({ type: 'estatutos', title: 'Estatutos', color: '#2563eb', bg: '#eff6ff' });
    }
    // Acta Constitutiva is always available (generated from org data)
    legalDocs.push({ type: 'acta', title: 'Acta Constitutiva', color: '#7c3aed', bg: '#f5f3ff' });
    legalDocs.push({ type: 'certificacion', title: 'Certificación Municipal', color: '#059669', bg: '#ecfdf5' });

    return `
      <div class="org-content-area">
        <div class="org-section-header">
          <h2 class="org-section-title">Documentos</h2>
        </div>

        <div style="margin-bottom:24px;">
          <h3 style="font-size:14px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">Documentos Legales</h3>
          <div style="display:grid;gap:12px;">
            ${legalDocs.map(doc => `
              <div style="padding:16px 20px;background:white;border:1px solid #e5e7eb;border-radius:12px;display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:14px;">
                  <div style="width:40px;height:40px;border-radius:10px;background:${doc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${doc.color}" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <div style="font-weight:600;color:#1e293b;">${doc.title}</div>
                </div>
                <div style="display:flex;gap:8px;">
                  <button class="btn-member-legal-doc" data-doc-type="${doc.type}" data-action="view" style="padding:8px 16px;border:1px solid ${doc.color};border-radius:8px;background:${doc.bg};color:${doc.color};cursor:pointer;font-weight:600;font-size:13px;">Ver</button>
                  <button class="btn-member-legal-doc" data-doc-type="${doc.type}" data-action="download" style="padding:8px 16px;border:1px solid #d1d5db;border-radius:8px;background:#f9fafb;color:#374151;cursor:pointer;font-weight:600;font-size:13px;display:flex;align-items:center;gap:4px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    PDF
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        ${(org.assemblies || []).length > 0 ? `
        <div style="margin-bottom:24px;">
          <h3 style="font-size:14px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">Actas de Asamblea</h3>
          <div style="display:grid;gap:12px;">
            ${org.assemblies.map(a => `
              <div style="padding:16px 20px;background:white;border:1px solid #e5e7eb;border-radius:12px;display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:14px;">
                  <div style="width:40px;height:40px;border-radius:10px;background:#f5f3ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </div>
                  <div>
                    <div style="font-weight:600;color:#1e293b;">${a.title || 'Asamblea'}</div>
                    <div style="font-size:13px;color:#6b7280;margin-top:2px;">${a.date ? new Date(a.date).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : ''}</div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <div>
          <h3 style="font-size:14px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">Documentos Subidos</h3>
          <div id="member-org-documents-list" style="display:grid;gap:12px;">
            <div style="padding:32px;text-align:center;color:#9ca3af;font-size:14px;">Cargando documentos...</div>
          </div>
        </div>
      </div>
    `;
  }

  attachDocumentosListeners(container) {
    // Legal document buttons (view/download PDF)
    container.querySelectorAll('.btn-member-legal-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const docType = btn.dataset.docType;
        const action = btn.dataset.action;
        if (action === 'view') this._viewLegalDocument(docType);
        else if (action === 'download') this._downloadLegalDocument(docType);
      });
    });

    // Load uploaded org documents asynchronously
    this._loadOrgDocuments(container);
  }

  _viewLegalDocument(docType) {
    try {
      const org = this.org;
      let doc, title;

      if (docType === 'estatutos') {
        if (!org.estatutos) { showToast('No hay estatutos disponibles', 'error'); return; }
        doc = this._generateEstatutosPDF(org);
        title = 'Estatutos';
      } else if (docType === 'acta') {
        doc = pdfService.generateActaAsamblea(org);
        title = 'Acta Constitutiva';
      } else if (docType === 'certificacion') {
        doc = pdfService.generateCertificacion(org, org.certificNumber || '');
        title = 'Certificación Municipal';
      } else { return; }

      const blobUrl = pdfService.getPDFDataURL(doc);
      this._showPDFModal(blobUrl, title, doc);
    } catch (err) {
      showToast('Error al generar el documento: ' + (err.message || ''), 'error');
    }
  }

  _downloadLegalDocument(docType) {
    try {
      const org = this.org;
      const orgName = (org.organizationName || 'Organizacion').replace(/\s+/g, '_');
      let doc, filename;

      if (docType === 'estatutos') {
        if (!org.estatutos) { showToast('No hay estatutos disponibles', 'error'); return; }
        doc = this._generateEstatutosPDF(org);
        filename = `Estatutos_${orgName}.pdf`;
      } else if (docType === 'acta') {
        doc = pdfService.generateActaAsamblea(org);
        filename = `Acta_Constitutiva_${orgName}.pdf`;
      } else if (docType === 'certificacion') {
        doc = pdfService.generateCertificacion(org, org.certificNumber || '');
        filename = `Certificacion_Municipal_${orgName}.pdf`;
      } else { return; }

      pdfService.downloadPDF(doc, filename);
      showToast(`${filename} descargado`, 'success');
    } catch (err) {
      showToast('Error al descargar: ' + (err.message || ''), 'error');
    }
  }

  _generateEstatutosPDF(org) {
    const doc = new jsPDF();
    const orgName = org.organizationName || 'Organización';
    const content = org.estatutos || '';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ESTATUTOS', 105, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.text(orgName, 105, 28, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const lines = doc.splitTextToSize(content, 170);
    let y = 40;
    const pageHeight = 280;

    for (const line of lines) {
      if (y > pageHeight) { doc.addPage(); y = 20; }
      doc.text(line, 20, y);
      y += 5;
    }

    return doc;
  }

  _showPDFModal(blobUrl, title, doc) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:200000;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;width:100%;max-width:800px;height:90vh;display:flex;flex-direction:column;overflow:hidden;">
        <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">
          <h3 style="margin:0;font-size:18px;color:#1e293b;">${title}</h3>
          <div style="display:flex;gap:8px;">
            <button id="modal-download-pdf" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;border:none;padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;">Descargar PDF</button>
            <button id="modal-close-pdf" style="background:#f1f5f9;border:none;width:36px;height:36px;border-radius:8px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;">✕</button>
          </div>
        </div>
        <div style="flex:1;overflow:hidden;">
          <iframe src="${blobUrl}" style="width:100%;height:100%;border:none;"></iframe>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#modal-close-pdf').addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-download-pdf').addEventListener('click', () => {
      const orgName = (this.org.organizationName || 'Doc').replace(/\s+/g, '_');
      pdfService.downloadPDF(doc, `${title.replace(/\s+/g, '_')}_${orgName}.pdf`);
    });
  }

  async _loadOrgDocuments(container) {
    const orgId = this.getActiveOrgId();
    const listEl = container.querySelector('#member-org-documents-list');
    if (!listEl || !orgId) return;

    const categoryLabels = {
      ACTA_ASAMBLEA: 'Acta de Asamblea', BALANCE: 'Balance Financiero',
      INFORME: 'Informe', CERTIFICADO: 'Certificado',
      CORRESPONDENCIA: 'Correspondencia', OTRO: 'Otro'
    };
    const categoryColors = {
      ACTA_ASAMBLEA: { color: '#7c3aed', bg: '#f5f3ff' },
      BALANCE: { color: '#059669', bg: '#ecfdf5' },
      INFORME: { color: '#2563eb', bg: '#eff6ff' },
      CERTIFICADO: { color: '#d97706', bg: '#fefce8' },
      CORRESPONDENCIA: { color: '#6b7280', bg: '#f3f4f6' },
      OTRO: { color: '#6b7280', bg: '#f3f4f6' }
    };

    try {
      const docs = await orgDocumentService.getDocuments(orgId);

      if (!docs || docs.length === 0) {
        listEl.innerHTML = `
          <div style="padding:36px 24px;text-align:center;background:white;border:1px solid #e5e7eb;border-radius:12px;">
            <p style="color:#9ca3af;margin:0;font-size:14px;">No hay documentos subidos adicionales.</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = docs.map(doc => {
        const cat = categoryColors[doc.category] || categoryColors.OTRO;
        const catLabel = categoryLabels[doc.category] || doc.category || 'Otro';
        const fileSize = this._formatFileSize(doc.fileSize);
        const date = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('es-CL') : '';

        return `
          <div style="padding:16px 20px;background:white;border:1px solid #e5e7eb;border-radius:12px;display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;">
              <div style="width:40px;height:40px;border-radius:10px;background:${cat.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${cat.color}" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div style="min-width:0;">
                <div style="font-weight:600;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${doc.name}</div>
                <div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;">
                  <span style="background:${cat.bg};color:${cat.color};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">${catLabel}</span>
                  ${fileSize ? `<span style="font-size:12px;color:#9ca3af;">${fileSize}</span>` : ''}
                  ${date ? `<span style="font-size:12px;color:#9ca3af;">${date}</span>` : ''}
                </div>
              </div>
            </div>
            <button class="btn-member-download-doc" data-doc-id="${doc._id}" style="padding:8px 16px;border:1px solid #2563eb;border-radius:8px;background:#eff6ff;color:#2563eb;cursor:pointer;font-weight:600;font-size:13px;white-space:nowrap;margin-left:12px;display:flex;align-items:center;gap:6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Descargar
            </button>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.btn-member-download-doc').forEach(btn => {
        btn.addEventListener('click', async () => {
          const docId = btn.dataset.docId;
          btn.disabled = true;
          btn.textContent = 'Descargando...';
          try {
            await orgDocumentService.downloadDocument(orgId, docId);
          } catch (err) {
            showToast(err.message || 'Error al descargar', 'error');
          }
          btn.disabled = false;
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar`;
        });
      });
    } catch (err) {
      listEl.innerHTML = `
        <div style="padding:24px;text-align:center;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;">
          <p style="color:#ef4444;margin:0;font-size:14px;">Error al cargar documentos</p>
        </div>
      `;
    }
  }

  _formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
                  ${a.date ? `<span style="font-size:13px;color:#6b7280;background:#f3f4f6;padding:4px 10px;border-radius:8px;">${new Date(a.date).toLocaleDateString('es-CL', { timeZone: 'UTC' })}</span>` : ''}
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
      draft: { label: 'Borrador', color: '#6b7280', bg: '#f3f4f6', icon: '&#128221;' },
      convocada: { label: 'Convocada', color: '#2563eb', bg: '#eff6ff', icon: '&#128227;' },
      en_curso: { label: 'En Curso', color: '#059669', bg: '#ecfdf5', icon: '&#9989;' },
      finalizada: { label: 'Finalizada', color: '#7c3aed', bg: '#f5f3ff', icon: '&#9989;' },
      cancelada: { label: 'Cancelada', color: '#ef4444', bg: '#fef2f2', icon: '&#10060;' }
    };

    const activeOnes = asambleas.filter(a => ['convocada', 'en_curso'].includes(a.status));
    const pastOnes = asambleas.filter(a => ['finalizada', 'cancelada'].includes(a.status));
    const draftOnes = asambleas.filter(a => a.status === 'draft');

    const renderCard = (a) => {
      const st = statusConfig[a.status] || statusConfig.draft;
      const hasOpenVoting = (a.agendaItems || []).some(item => item.votingOpen);
      const isActive = ['convocada', 'en_curso'].includes(a.status);
      const agendaTypes = (a.agendaItems || []).map(i => {
        if (i.type === 'eleccion_directorio') return 'Eleccion de Directorio';
        if (i.type === 'aprobacion_presupuesto') return 'Presupuesto';
        if (i.type === 'reforma_estatutos') return 'Reforma Estatutos';
        return i.title;
      });
      return `
        <div style="padding:20px;background:white;border-radius:14px;border:1px solid ${isActive ? st.color : '#e5e7eb'};${isActive ? `box-shadow:0 0 0 1px ${st.color},0 4px 12px rgba(0,0,0,0.06);` : 'box-shadow:0 2px 8px rgba(0,0,0,0.04);'}transition:all 0.2s;cursor:pointer;" class="btn-member-view-assembly" data-id="${a.id}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                <span style="font-size:16px;font-weight:700;color:#1e293b;">${a.title || 'Asamblea'}</span>
                <span style="background:${st.bg};color:${st.color};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">${st.label}</span>
                ${hasOpenVoting ? '<span style="background:#dcfce7;color:#15803d;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;animation:pulse 2s infinite;">Votacion Abierta</span>' : ''}
              </div>
              <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                ${a.date ? `<span style="font-size:13px;color:#6b7280;display:flex;align-items:center;gap:5px;">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  ${new Date(a.date).toLocaleDateString('es-CL', { timeZone: 'UTC' })}${a.time ? ' ' + a.time : ''}
                </span>` : ''}
                <span style="font-size:13px;color:#6b7280;display:flex;align-items:center;gap:5px;">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  ${(a.attendees || []).length} asistentes
                </span>
                <span style="font-size:13px;color:#6b7280;">${(a.agendaItems || []).length} punto(s)</span>
              </div>
              ${agendaTypes.length > 0 ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">${agendaTypes.map(t => `<span style="font-size:11px;background:#f3f4f6;color:#4b5563;padding:3px 8px;border-radius:6px;">${t}</span>`).join('')}</div>` : ''}
            </div>
            <div style="color:#2563eb;flex-shrink:0;margin-top:4px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        </div>`;
    };

    return `
      <div class="org-content-area">
        <div class="org-section-header" style="margin-bottom:20px;">
          <h2 class="org-section-title" style="font-size:22px;font-weight:700;color:#1e293b;">Asambleas</h2>
        </div>

        ${activeOnes.length > 0 ? `
          <div style="margin-bottom:24px;">
            <h3 style="font-size:14px;font-weight:600;color:#059669;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Proximas / En Curso
            </h3>
            <div style="display:grid;gap:12px;">${activeOnes.map(renderCard).join('')}</div>
          </div>
        ` : ''}

        ${pastOnes.length > 0 ? `
          <div style="margin-bottom:24px;">
            <h3 style="font-size:14px;font-weight:600;color:#7c3aed;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Historial
            </h3>
            <div style="display:grid;gap:12px;">${pastOnes.map(renderCard).join('')}</div>
          </div>
        ` : ''}

        ${draftOnes.length > 0 ? `
          <div style="margin-bottom:24px;">
            <h3 style="font-size:14px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">Borradores</h3>
            <div style="display:grid;gap:12px;">${draftOnes.map(renderCard).join('')}</div>
          </div>
        ` : ''}

        ${asambleas.length === 0 ? `
        <div style="padding:60px 24px;text-align:center;background:white;border:1px solid #e5e7eb;border-radius:16px;">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" style="margin:0 auto 16px;">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p style="color:#6b7280;margin:0;font-size:15px;">No hay asambleas registradas aun.</p>
          <p style="color:#9ca3af;margin:8px 0 0;font-size:13px;">Las asambleas seran visibles aqui cuando el directorio las convoque.</p>
        </div>
        ` : ''}
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
      eleccion_directorio: 'Eleccion de Directorio',
      aprobacion_presupuesto: 'Aprobacion de Presupuesto',
      reforma_estatutos: 'Reforma de Estatutos',
      memoria_anual: 'Memoria Anual',
      disolucion: 'Disolucion',
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
          <!-- Info grid -->
          <div class="r-grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
            <div style="padding:14px;background:#f8fafc;border-radius:10px;">
              <span style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Estado</span>
              <div style="margin-top:6px;"><span style="background:${st.bg};color:${st.color};padding:4px 12px;border-radius:10px;font-size:13px;font-weight:600;">${st.label}</span></div>
            </div>
            <div style="padding:14px;background:#f8fafc;border-radius:10px;">
              <span style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Tipo</span>
              <div style="margin-top:6px;font-weight:600;color:#1e293b;">${assembly.type === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'}</div>
            </div>
            <div style="padding:14px;background:#f8fafc;border-radius:10px;">
              <span style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Fecha</span>
              <div style="margin-top:6px;font-weight:600;color:#1e293b;">${assembly.date ? new Date(assembly.date).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '-'} ${assembly.time || ''}</div>
            </div>
            <div style="padding:14px;border-radius:10px;background:${quorumMet ? '#ecfdf5' : '#fef2f2'};">
              <span style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Quorum</span>
              <div style="margin-top:6px;font-weight:600;color:${quorumMet ? '#059669' : '#ef4444'};">${attendeeCount} / ${quorumRequired}
                <span style="font-size:11px;font-weight:400;color:#6b7280;">(${assembly.quorumValue || 50}${assembly.quorumType === 'percentage' ? '%' : ' pers.'})</span>
              </div>
            </div>
          </div>

          ${assembly.description ? `<div style="padding:14px;background:#f8fafc;border-radius:10px;margin-bottom:20px;"><span style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Descripcion</span><p style="margin:6px 0 0;color:#374151;font-size:14px;line-height:1.5;">${assembly.description}</p></div>` : ''}

          <h4 style="margin:0 0 12px;font-size:16px;color:#1e293b;">Puntos de Agenda</h4>
          ${(assembly.agendaItems || []).map((item, idx) => {
            const typeLabel = agendaTypeLabels[item.type] || item.type;
            const isElection = item.type === 'eleccion_directorio';
            const alreadyVoted = (item.voterRegistry || item.votes || []).some(v => v.voterRut === voterRut);
            const canVote = assembly.status === 'en_curso' && item.votingOpen && !alreadyVoted;
            const candidates = item.candidates || [];

            // Candidates display for elections (read-only, when not voting)
            let candidatesUI = '';
            if (isElection && candidates.length > 0 && !canVote) {
              if (item.votingMode === 'per_cargo') {
                const byCargo = {};
                candidates.forEach(c => {
                  const key = c.cargo || 'Sin cargo';
                  if (!byCargo[key]) byCargo[key] = [];
                  byCargo[key].push(c);
                });
                candidatesUI = `
                  <div style="margin-top:12px;">
                    <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px;">Candidatos (${candidates.length})</div>
                    <div style="display:grid;gap:6px;">
                      ${Object.entries(byCargo).map(([cargo, cands]) => `
                        <div style="padding:10px 14px;background:#fafafa;border-radius:8px;border:1px solid #f0f0f0;">
                          <div style="font-size:11px;font-weight:600;color:#2563eb;text-transform:capitalize;margin-bottom:4px;">${cargo}</div>
                          ${cands.map(c => `<div style="font-size:13px;color:#374151;">${c.firstName} ${c.lastName}</div>`).join('')}
                        </div>
                      `).join('')}
                    </div>
                  </div>`;
              } else {
                const listas = {};
                candidates.forEach(c => {
                  const key = c.lista || 'Sin lista';
                  if (!listas[key]) listas[key] = [];
                  listas[key].push(c);
                });
                candidatesUI = `
                  <div style="margin-top:12px;">
                    <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px;">Listas (${Object.keys(listas).length})</div>
                    <div style="display:grid;gap:6px;">
                      ${Object.entries(listas).map(([lista, cands]) => `
                        <div style="padding:10px 14px;background:#fafafa;border-radius:8px;border:1px solid #f0f0f0;">
                          <div style="font-size:13px;font-weight:600;color:#2563eb;margin-bottom:4px;">${lista}</div>
                          <div style="font-size:12px;color:#6b7280;">${cands.map(c => `${c.cargo ? c.cargo + ': ' : ''}${c.firstName} ${c.lastName}`).join(', ')}</div>
                        </div>
                      `).join('')}
                    </div>
                  </div>`;
              }
            }

            // Voting UI
            let votingUI = '';
            if (canVote && isElection) {
              if (item.votingMode === 'per_cargo') {
                const byCargo = {};
                candidates.forEach(c => {
                  if (!byCargo[c.cargo]) byCargo[c.cargo] = [];
                  byCargo[c.cargo].push(c);
                });
                votingUI = `
                  <div class="vote-section" data-agenda-id="${item.id}" data-mode="per_cargo" style="margin-top:14px;padding:16px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;">
                    <div style="font-size:14px;font-weight:600;color:#15803d;margin-bottom:12px;">Emitir tu voto</div>
                    ${Object.entries(byCargo).map(([cargo, cands]) => `
                      <div style="margin-bottom:14px;">
                        <div style="font-size:12px;font-weight:600;color:#374151;text-transform:capitalize;margin-bottom:6px;">${cargo}</div>
                        <div style="display:grid;gap:6px;">
                          ${cands.map(c => `
                            <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:white;border-radius:8px;cursor:pointer;border:2px solid #e5e7eb;transition:all 0.2s;">
                              <input type="radio" name="vote-${item.id}-${cargo}" value="${c.rut}" style="width:18px;height:18px;accent-color:#2563eb;">
                              <span style="font-size:14px;">${c.firstName} ${c.lastName}</span>
                            </label>
                          `).join('')}
                        </div>
                      </div>
                    `).join('')}
                    <button class="btn-submit-vote" data-agenda-id="${item.id}" style="margin-top:4px;padding:12px 28px;border:none;border-radius:10px;background:#2563eb;color:white;cursor:pointer;font-weight:600;font-size:14px;transition:all 0.2s;">Emitir Voto</button>
                  </div>
                `;
              } else if (item.votingMode === 'per_lista') {
                const listas = {};
                candidates.forEach(c => {
                  if (!listas[c.lista]) listas[c.lista] = [];
                  listas[c.lista].push(c);
                });
                votingUI = `
                  <div class="vote-section" data-agenda-id="${item.id}" data-mode="per_lista" style="margin-top:14px;padding:16px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;">
                    <div style="font-size:14px;font-weight:600;color:#15803d;margin-bottom:12px;">Emitir tu voto</div>
                    <div style="display:grid;gap:8px;">
                      ${Object.entries(listas).map(([lista, cands]) => `
                        <label style="display:flex;align-items:start;gap:12px;padding:14px;background:white;border-radius:10px;cursor:pointer;border:2px solid #e5e7eb;transition:all 0.2s;">
                          <input type="radio" name="vote-lista-${item.id}" value="${lista}" style="width:18px;height:18px;margin-top:2px;accent-color:#2563eb;">
                          <div>
                            <strong style="font-size:14px;">${lista}</strong>
                            <div style="font-size:12px;color:#6b7280;margin-top:4px;">${cands.map(c => `${c.cargo ? c.cargo + ': ' : ''}${c.firstName} ${c.lastName}`).join(', ')}</div>
                          </div>
                        </label>
                      `).join('')}
                    </div>
                    <button class="btn-submit-vote" data-agenda-id="${item.id}" style="margin-top:10px;padding:12px 28px;border:none;border-radius:10px;background:#2563eb;color:white;cursor:pointer;font-weight:600;font-size:14px;">Emitir Voto</button>
                  </div>
                `;
              }
            }

            // Results UI
            let resultUI = '';
            if (item.result && assembly.status === 'finalizada') {
              if (item.result.mode === 'per_cargo') {
                resultUI = `<div style="margin-top:12px;padding:14px;background:#f5f3ff;border-radius:10px;border:1px solid #e9d5ff;">
                  <div style="font-size:13px;font-weight:600;color:#7c3aed;margin-bottom:8px;">Resultados</div>
                  ${Object.entries(item.result.winners || {}).map(([cargo, w]) => `<div style="margin-top:4px;font-size:13px;"><span style="text-transform:capitalize;color:#6b7280;">${cargo}:</span> <strong>${w.firstName} ${w.lastName}</strong> <span style="color:#6b7280;">(${w.votes} votos)</span></div>`).join('')}
                </div>`;
              } else if (item.result.mode === 'per_lista') {
                resultUI = `<div style="margin-top:12px;padding:14px;background:#f5f3ff;border-radius:10px;border:1px solid #e9d5ff;">
                  <div style="font-size:13px;font-weight:600;color:#7c3aed;">Lista ganadora: ${item.result.winningLista || '-'}</div>
                  <div style="font-size:12px;color:#6b7280;margin-top:4px;">${item.result.votesByLista?.[item.result.winningLista] || 0} votos</div>
                </div>`;
              }
            }

            return `
            <div style="border:1px solid ${item.votingOpen ? '#86efac' : '#e5e7eb'};border-radius:12px;padding:16px;margin-bottom:12px;${item.votingOpen ? 'background:#f0fdf4;box-shadow:0 0 0 1px #86efac;' : 'background:white;'}">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <strong style="font-size:15px;color:#1e293b;">${idx + 1}. ${item.title}</strong>
                  <span style="font-size:11px;color:#6b7280;margin-left:8px;background:#f3f4f6;padding:2px 8px;border-radius:6px;">${typeLabel}</span>
                  ${isElection && item.votingMode ? `<span style="font-size:11px;color:#2563eb;margin-left:4px;">(${item.votingMode === 'per_cargo' ? 'Por cargo' : 'Por lista'})</span>` : ''}
                </div>
                ${item.votingOpen ? '<span style="background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600;">Votacion Abierta</span>' : ''}
              </div>
              ${alreadyVoted && !item.result ? '<div style="margin-top:10px;padding:10px 14px;background:#ecfdf5;border-radius:8px;color:#059669;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Tu voto ha sido registrado.</div>' : ''}
              ${candidatesUI}
              ${votingUI}
              ${resultUI}
            </div>`;
          }).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());

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
          btn.textContent = 'Emitir Voto';
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
