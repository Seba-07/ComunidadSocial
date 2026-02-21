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
      // El endpoint ahora devuelve { organizations: [...] }
      if (data && data.organizations) {
        this.orgs = data.organizations;
        this.org = this.orgs[0] || null;
      } else if (data && !data.organizations) {
        // Backward compat: si devuelve un solo objeto org (legacy)
        this.orgs = [data];
        this.org = data;
      }
      return this.org;
    } catch (err) {
      console.error('MemberDashboard init error:', err);
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
      container.innerHTML = '<div style="padding:40px;text-align:center;color:#6b7280;">No se encontró tu organización. Contacta al administrador.</div>';
      return;
    }

    switch (pageName) {
      case 'overview': container.innerHTML = this.renderOverview(); break;
      case 'directorio': container.innerHTML = this.renderDirectorio(); break;
      case 'documentos': container.innerHTML = this.renderDocumentos(); break;
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

  renderOverview() {
    const org = this.org;
    const typeLabels = {
      'JUNTA_VECINOS': 'Junta de Vecinos', 'CLUB_DEPORTIVO': 'Club Deportivo',
      'CLUB_ADULTO_MAYOR': 'Club Adulto Mayor', 'CENTRO_MADRES': 'Centro de Madres',
      'COMITE_VIVIENDA': 'Comité de Vivienda'
    };
    const typeName = typeLabels[org.organizationType] || org.organizationType || '-';

    return `
      <div style="padding: 24px;">
        <h2 style="margin:0 0 24px;font-size:24px;color:#1e293b;">${org.organizationName || 'Mi Organización'}</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div style="padding:16px;background:#f8fafc;border-radius:12px;">
            <span style="font-size:12px;color:#6b7280;font-weight:600;">Tipo</span>
            <div style="margin-top:4px;font-weight:600;">${typeName}</div>
          </div>
          <div style="padding:16px;background:#f8fafc;border-radius:12px;">
            <span style="font-size:12px;color:#6b7280;font-weight:600;">Dirección</span>
            <div style="margin-top:4px;">${org.address || '-'}</div>
          </div>
          <div style="padding:16px;background:#f8fafc;border-radius:12px;">
            <span style="font-size:12px;color:#6b7280;font-weight:600;">Comuna</span>
            <div style="margin-top:4px;">${org.comuna || 'Renca'}</div>
          </div>
          <div style="padding:16px;background:#f8fafc;border-radius:12px;">
            <span style="font-size:12px;color:#6b7280;font-weight:600;">Socios</span>
            <div style="margin-top:4px;font-weight:600;">${(org.members || []).length}</div>
          </div>
        </div>
        ${org.description ? `<div style="margin-top:16px;padding:16px;background:#f8fafc;border-radius:12px;"><span style="font-size:12px;color:#6b7280;font-weight:600;">Descripción</span><p style="margin:8px 0 0;color:#374151;">${org.description}</p></div>` : ''}
        ${org.objectives ? `<div style="margin-top:16px;padding:16px;background:#f8fafc;border-radius:12px;"><span style="font-size:12px;color:#6b7280;font-weight:600;">Objetivos</span><p style="margin:8px 0 0;color:#374151;">${org.objectives}</p></div>` : ''}
      </div>
    `;
  }

  renderDirectorio() {
    const pd = this.org.provisionalDirectorio || {};
    const dirType = pd.type === 'ELECTO' ? 'Electo' : 'Provisorio';
    const cargos = [
      { key: 'president', label: 'Presidente', color: '#2563eb' },
      { key: 'secretary', label: 'Secretario', color: '#059669' },
      { key: 'treasurer', label: 'Tesorero', color: '#d97706' }
    ];

    return `
      <div style="padding: 24px;">
        <h2 style="margin:0 0 8px;font-size:24px;color:#1e293b;">Directorio
          <span style="background:#f59e0b20;color:#b45309;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;margin-left:8px;">${dirType}</span>
        </h2>
        <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">Miembros del directorio actual de tu organización.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;">
          ${cargos.map(c => {
            const m = pd[c.key];
            if (!m) return `<div style="padding:20px;background:#f9fafb;border-radius:12px;border-top:3px solid ${c.color};"><div style="color:${c.color};font-weight:700;font-size:14px;">${c.label}</div><div style="margin-top:8px;color:#9ca3af;">Sin asignar</div></div>`;
            return `
              <div style="padding:20px;background:white;border-radius:12px;border:1px solid #e5e7eb;border-top:3px solid ${c.color};">
                <div style="color:${c.color};font-weight:700;font-size:14px;">${c.label}</div>
                <div style="margin-top:12px;display:flex;align-items:center;gap:12px;">
                  <div style="width:40px;height:40px;border-radius:50%;background:${c.color}15;color:${c.color};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;">${(m.firstName || '?')[0]}</div>
                  <div>
                    <div style="font-weight:600;">${m.firstName || ''} ${m.lastName || ''}</div>
                    <div style="font-size:12px;color:#6b7280;">${m.rut || ''}</div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderDocumentos() {
    return `
      <div style="padding: 24px;">
        <h2 style="margin:0 0 24px;font-size:24px;color:#1e293b;">Documentos</h2>
        <div style="display:grid;gap:12px;">
          ${this.org.estatutos ? `
            <div style="padding:16px;background:#f8fafc;border-radius:12px;display:flex;justify-content:space-between;align-items:center;">
              <div><strong>Estatutos de la Organización</strong></div>
              <span style="color:#6b7280;font-size:13px;">Disponible</span>
            </div>
          ` : ''}
          <div style="padding:40px;text-align:center;color:#6b7280;">
            <p>Los documentos de tu organización serán visibles aquí.</p>
          </div>
        </div>
      </div>
    `;
  }

  renderActividades() {
    const activities = this.org.activities || [];
    return `
      <div style="padding: 24px;">
        <h2 style="margin:0 0 24px;font-size:24px;color:#1e293b;">Actividades</h2>
        ${activities.length > 0 ? `
          <div style="display:grid;gap:12px;">
            ${activities.map(a => `
              <div style="padding:16px;background:#f8fafc;border-radius:12px;border-left:4px solid #2563eb;">
                <div style="font-weight:600;">${a.title || a.name || 'Actividad'}</div>
                ${a.date ? `<div style="font-size:13px;color:#6b7280;margin-top:4px;">${new Date(a.date).toLocaleDateString('es-CL')}</div>` : ''}
                ${a.description ? `<p style="margin:8px 0 0;color:#4b5563;font-size:14px;">${a.description}</p>` : ''}
              </div>
            `).join('')}
          </div>
        ` : '<div style="text-align:center;color:#6b7280;padding:40px;">No hay actividades registradas.</div>'}
      </div>
    `;
  }

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
      <div style="padding: 24px;">
        <h2 style="margin:0 0 24px;font-size:24px;color:#1e293b;">Asambleas</h2>
        ${asambleas.length > 0 ? `
          <div style="display:grid;gap:12px;">
            ${asambleas.map(a => {
              const st = statusConfig[a.status] || statusConfig.draft;
              const hasOpenVoting = (a.agendaItems || []).some(item => item.votingOpen);
              return `
              <div style="padding:16px;background:white;border-radius:12px;border:1px solid #e5e7eb;${hasOpenVoting ? 'border-color:#059669;box-shadow:0 0 0 1px #059669;' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <strong>${a.title || 'Asamblea'}</strong>
                    <span class="assembly-status-badge" style="background:${st.bg};color:${st.color};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;margin-left:8px;">${st.label}</span>
                    ${hasOpenVoting ? '<span style="background:#ecfdf5;color:#059669;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;margin-left:4px;">Votación Abierta</span>' : ''}
                  </div>
                  <span style="font-size:13px;color:#6b7280;">${a.date ? new Date(a.date).toLocaleDateString('es-CL') : '-'}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
                  <span style="font-size:13px;color:#6b7280;">${(a.agendaItems || []).length} punto(s) | ${(a.attendees || []).length} asistentes</span>
                  <button class="btn-member-view-assembly" data-id="${a.id}" style="padding:6px 16px;border:1px solid #2563eb;border-radius:8px;background:#eff6ff;color:#2563eb;cursor:pointer;font-weight:600;font-size:13px;">Ver Detalle</button>
                </div>
              </div>
            `;}).join('')}
          </div>
        ` : '<div style="text-align:center;color:#6b7280;padding:40px;">No hay asambleas registradas.</div>'}
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

          <!-- Agenda items with voting UI -->
          <h4 style="margin:16px 0 8px;">Puntos de Agenda</h4>
          ${(assembly.agendaItems || []).map((item, idx) => {
            const typeLabel = agendaTypeLabels[item.type] || item.type;
            const isElection = item.type === 'eleccion_directorio';
            const alreadyVoted = (item.votes || []).some(v => v.voterRut === voterRut);
            const canVote = assembly.status === 'en_curso' && item.votingOpen && !alreadyVoted;

            let votingUI = '';
            if (canVote && isElection) {
              if (item.votingMode === 'per_cargo') {
                // Group candidates by cargo
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
                            <label class="vote-option" style="display:flex;align-items:center;gap:10px;padding:10px;background:#f9fafb;border-radius:8px;cursor:pointer;border:2px solid transparent;transition:border-color 0.2s;">
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
                // Group candidates by lista
                const listas = {};
                (item.candidates || []).forEach(c => {
                  if (!listas[c.lista]) listas[c.lista] = [];
                  listas[c.lista].push(c);
                });
                votingUI = `
                  <div class="vote-section" data-agenda-id="${item.id}" data-mode="per_lista" style="margin-top:12px;">
                    <div style="display:grid;gap:8px;">
                      ${Object.entries(listas).map(([lista, cands]) => `
                        <label class="vote-lista-card" style="display:flex;align-items:start;gap:12px;padding:14px;background:#f9fafb;border-radius:10px;cursor:pointer;border:2px solid transparent;transition:border-color 0.2s;">
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
          // Refresh org and re-render
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

  renderChangePassword() {
    return `
      <div style="padding: 24px; max-width: 500px;">
        <h2 style="margin:0 0 8px;font-size:24px;color:#1e293b;">Cambiar Contraseña</h2>
        <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">Tu contraseña inicial es tu RUT. Te recomendamos cambiarla por una contraseña segura.</p>
        <form id="member-change-password-form">
          <div class="form-group" style="margin-bottom:20px;">
            <label style="display:block;font-weight:600;margin-bottom:6px;font-size:14px;">Contraseña Actual</label>
            <input type="password" id="member-current-password" required style="width:100%;padding:12px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;box-sizing:border-box;">
          </div>
          <div class="form-group" style="margin-bottom:20px;">
            <label style="display:block;font-weight:600;margin-bottom:6px;font-size:14px;">Nueva Contraseña</label>
            <input type="password" id="member-new-password" required style="width:100%;padding:12px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;box-sizing:border-box;" placeholder="Min 6 caracteres, una mayúscula">
          </div>
          <div class="form-group" style="margin-bottom:20px;">
            <label style="display:block;font-weight:600;margin-bottom:6px;font-size:14px;">Confirmar Nueva Contraseña</label>
            <input type="password" id="member-confirm-password" required style="width:100%;padding:12px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;box-sizing:border-box;">
          </div>
          <button type="submit" style="padding:14px 32px;border:none;border-radius:10px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;font-weight:600;font-size:15px;cursor:pointer;">Cambiar Contraseña</button>
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
        // Update user data
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
