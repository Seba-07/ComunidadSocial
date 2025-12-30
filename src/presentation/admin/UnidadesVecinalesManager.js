/**
 * UnidadesVecinalesManager - Componente para gestionar las Unidades Vecinales
 * CRUD completo: Crear, Leer, Actualizar y Eliminar
 */

import unidadesVecinalesService from '../../services/UnidadesVecinalesService.js';
import { showToast } from '../../app.js';

class UnidadesVecinalesManager {
  constructor(container) {
    this.container = container;
    this.unidades = [];
    this.macrozonas = [];
    this.filtroMacrozona = null;
    this.searchQuery = '';
    this.selectedUnidad = null;
    this.isCreating = false;
  }

  async init() {
    await this.loadData();
    this.render();
    this.setupEventListeners();
  }

  async loadData() {
    try {
      this.unidades = await unidadesVecinalesService.getAll();
      this.macrozonas = await unidadesVecinalesService.getMacrozonas();
    } catch (error) {
      console.error('Error cargando unidades vecinales:', error);
      showToast('Error al cargar unidades vecinales', 'error');
    }
  }

  render() {
    const filteredUnidades = this.getFilteredUnidades();

    this.container.innerHTML = `
      <div class="uv-manager">
        <!-- Header como ficha informativa -->
        <div class="uv-manager-header-card">
          <div class="uv-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <div class="uv-header-text">
            <h2>Gestión de Unidades Vecinales</h2>
            <p>Administra las unidades vecinales de la comuna de Renca y sus demarcaciones territoriales</p>
          </div>
          <button class="btn-uv-create" id="btn-uv-create">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nueva Unidad
          </button>
        </div>

        <div class="uv-stats-row">
          ${this.macrozonas.map(m => `
            <div class="uv-stat-card ${this.filtroMacrozona === m.macrozona ? 'active' : ''}"
                 data-macrozona="${m.macrozona}">
              <div class="uv-stat-number">${m.cantidad}</div>
              <div class="uv-stat-label">Macrozona ${m.macrozona}</div>
            </div>
          `).join('')}
          <div class="uv-stat-card ${this.filtroMacrozona === null ? 'active' : ''}" data-macrozona="all">
            <div class="uv-stat-number">${this.unidades.length}</div>
            <div class="uv-stat-label">Total</div>
          </div>
        </div>

        <div class="uv-controls">
          <div class="uv-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="uv-search-input" placeholder="Buscar por número, población o calle..."
                   value="${this.searchQuery}">
          </div>
          <button class="btn-uv-reload" id="btn-uv-reload" title="Recargar datos desde el servidor">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
        </div>

        <div class="uv-list">
          ${filteredUnidades.length === 0 ? `
            <div class="uv-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <p>No se encontraron unidades vecinales</p>
              ${this.searchQuery ? '<span>Intenta con otros términos de búsqueda</span>' : ''}
            </div>
          ` : filteredUnidades.map(uv => this.renderUnidadCard(uv)).join('')}
        </div>
      </div>

      <!-- Modal de Edición/Creación -->
      <div id="uv-edit-modal" class="uv-modal" style="display: none;">
        <div class="uv-modal-content">
          <div class="uv-modal-header">
            <h3 id="uv-modal-title">Editar Unidad Vecinal</h3>
            <button class="uv-modal-close">&times;</button>
          </div>
          <div class="uv-modal-body" id="uv-modal-body">
          </div>
        </div>
      </div>

      <!-- Modal de Confirmación de Eliminación -->
      <div id="uv-delete-modal" class="uv-modal uv-modal-confirm" style="display: none;">
        <div class="uv-modal-content uv-modal-small">
          <div class="uv-modal-header uv-modal-header-danger">
            <h3>Eliminar Unidad Vecinal</h3>
            <button class="uv-modal-close" id="uv-delete-close">&times;</button>
          </div>
          <div class="uv-modal-body" id="uv-delete-body">
          </div>
        </div>
      </div>
    `;
  }

  renderUnidadCard(uv) {
    const poblacionesCount = uv.poblaciones?.length || 0;
    const callesCount = uv.calles?.length || 0;
    const hasLimites = uv.limites && (uv.limites.norte || uv.limites.sur || uv.limites.oriente || uv.limites.poniente);

    return `
      <div class="uv-card" data-uv-id="${uv._id}">
        <div class="uv-card-header">
          <div class="uv-card-numero">UV ${uv.numero}</div>
          <div class="uv-card-macrozona">Macrozona ${uv.macrozona || '?'}</div>
        </div>
        <div class="uv-card-body">
          ${uv.nombre && uv.nombre !== `Unidad Vecinal ${uv.numero}` ? `
            <div class="uv-card-nombre">${uv.nombre}</div>
          ` : ''}
          <div class="uv-card-info">
            <span class="uv-card-badge ${poblacionesCount > 0 ? 'has-data' : 'no-data'}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              </svg>
              ${poblacionesCount} poblaciones
            </span>
            <span class="uv-card-badge ${callesCount > 0 ? 'has-data' : 'no-data'}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
              ${callesCount} calles
            </span>
            <span class="uv-card-badge ${hasLimites ? 'has-data' : 'no-data'}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
              ${hasLimites ? 'Con límites' : 'Sin límites'}
            </span>
          </div>
          ${uv.poblaciones?.length > 0 ? `
            <div class="uv-card-poblaciones">
              ${uv.poblaciones.slice(0, 3).map(p => `<span class="uv-poblacion-tag">${p}</span>`).join('')}
              ${uv.poblaciones.length > 3 ? `<span class="uv-more">+${uv.poblaciones.length - 3} más</span>` : ''}
            </div>
          ` : ''}
        </div>
        <div class="uv-card-actions">
          <button class="btn-uv-edit" data-uv-id="${uv._id}" title="Editar unidad vecinal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Editar
          </button>
          <button class="btn-uv-delete" data-uv-id="${uv._id}" data-uv-numero="${uv.numero}" title="Eliminar unidad vecinal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  getFilteredUnidades() {
    let filtered = [...this.unidades];

    // Filtrar por macrozona
    if (this.filtroMacrozona !== null) {
      filtered = filtered.filter(uv => uv.macrozona === this.filtroMacrozona);
    }

    // Filtrar por búsqueda
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(uv =>
        uv.numero.toLowerCase().includes(query) ||
        uv.nombre?.toLowerCase().includes(query) ||
        uv.poblaciones?.some(p => p.toLowerCase().includes(query)) ||
        uv.calles?.some(c => c.toLowerCase().includes(query))
      );
    }

    // Ordenar por número
    filtered.sort((a, b) => {
      const numA = parseInt(a.numero) || 999;
      const numB = parseInt(b.numero) || 999;
      return numA - numB;
    });

    return filtered;
  }

  setupEventListeners() {
    // Botón crear nueva
    const btnCreate = this.container.querySelector('#btn-uv-create');
    if (btnCreate) {
      btnCreate.addEventListener('click', () => this.openCreateModal());
    }

    // Filtro por macrozona
    this.container.querySelectorAll('.uv-stat-card').forEach(card => {
      card.addEventListener('click', () => {
        const mz = card.dataset.macrozona;
        this.filtroMacrozona = mz === 'all' ? null : parseInt(mz);
        this.render();
        this.setupEventListeners();
      });
    });

    // Búsqueda
    const searchInput = this.container.querySelector('#uv-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render();
        this.setupEventListeners();
        // Mantener el foco en el input
        const newInput = this.container.querySelector('#uv-search-input');
        if (newInput) {
          newInput.focus();
          newInput.selectionStart = newInput.selectionEnd = newInput.value.length;
        }
      });
    }

    // Botón recargar
    const btnReload = this.container.querySelector('#btn-uv-reload');
    if (btnReload) {
      btnReload.addEventListener('click', async () => {
        try {
          btnReload.disabled = true;
          btnReload.classList.add('spinning');
          unidadesVecinalesService.invalidateCache();
          await this.loadData();
          this.render();
          this.setupEventListeners();
          showToast('Datos recargados correctamente', 'success');
        } catch (error) {
          showToast('Error al recargar datos', 'error');
        }
      });
    }

    // Botones de editar
    this.container.querySelectorAll('.btn-uv-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const uvId = btn.dataset.uvId;
        this.openEditModal(uvId);
      });
    });

    // Botones de eliminar
    this.container.querySelectorAll('.btn-uv-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const uvId = btn.dataset.uvId;
        const uvNumero = btn.dataset.uvNumero;
        this.openDeleteModal(uvId, uvNumero);
      });
    });

    // Cerrar modales
    const modalClose = this.container.querySelector('.uv-modal-close');
    if (modalClose) {
      modalClose.addEventListener('click', () => this.closeModal());
    }

    const modal = this.container.querySelector('#uv-edit-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal();
      });
    }

    const deleteModal = this.container.querySelector('#uv-delete-modal');
    if (deleteModal) {
      deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) this.closeDeleteModal();
      });
      const closeBtn = deleteModal.querySelector('#uv-delete-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeDeleteModal());
      }
    }
  }

  openCreateModal() {
    this.isCreating = true;
    this.selectedUnidad = {
      numero: '',
      idOficial: '',
      nombre: '',
      macrozona: 1,
      poblaciones: [],
      calles: [],
      limites: { norte: '', sur: '', oriente: '', poniente: '' },
      palabrasClave: [],
      notas: ''
    };

    const modal = this.container.querySelector('#uv-edit-modal');
    const title = this.container.querySelector('#uv-modal-title');
    const body = this.container.querySelector('#uv-modal-body');

    title.textContent = 'Crear Nueva Unidad Vecinal';
    body.innerHTML = this.renderFormContent(this.selectedUnidad, true);

    modal.style.display = 'flex';
    this.setupModalEventListeners();
  }

  openEditModal(uvId) {
    const uv = this.unidades.find(u => u._id === uvId);
    if (!uv) return;

    this.isCreating = false;
    this.selectedUnidad = { ...uv };
    const modal = this.container.querySelector('#uv-edit-modal');
    const title = this.container.querySelector('#uv-modal-title');
    const body = this.container.querySelector('#uv-modal-body');

    title.textContent = `Editar Unidad Vecinal ${uv.numero}`;
    body.innerHTML = this.renderFormContent(uv, false);

    modal.style.display = 'flex';
    this.setupModalEventListeners();
  }

  renderFormContent(uv, isNew) {
    return `
      <div class="uv-edit-form">
        ${isNew ? `
          <div class="uv-form-row">
            <div class="uv-form-group">
              <label>Número de UV <span class="required">*</span></label>
              <input type="text" id="uv-edit-numero" value="${uv.numero || ''}"
                     placeholder="Ej: 48, 49A">
              <small>Identificador único de la unidad vecinal</small>
            </div>
            <div class="uv-form-group">
              <label>ID Oficial <span class="required">*</span></label>
              <input type="text" id="uv-edit-idoficial" value="${uv.idOficial || ''}"
                     placeholder="Ej: 13132048">
              <small>ID del Ministerio de Desarrollo Social</small>
            </div>
          </div>
        ` : ''}

        <div class="uv-form-row">
          <div class="uv-form-group">
            <label>Nombre descriptivo</label>
            <input type="text" id="uv-edit-nombre" value="${uv.nombre || ''}"
                   placeholder="Ej: Sector Plaza de Renca">
          </div>
          <div class="uv-form-group">
            <label>Macrozona</label>
            <select id="uv-edit-macrozona">
              ${[1,2,3,4,5,6,7].map(m => `
                <option value="${m}" ${uv.macrozona === m ? 'selected' : ''}>Macrozona ${m}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="uv-form-section">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            </svg>
            Poblaciones, Villas y Barrios
          </h4>
          <p class="uv-form-hint">Estas direcciones se usarán para asignar automáticamente organizaciones a esta UV</p>
          <div class="uv-tags-container" id="uv-poblaciones-tags">
            ${(uv.poblaciones || []).map(p => `
              <span class="uv-tag">
                ${p}
                <button class="uv-tag-remove" data-type="poblacion" data-value="${p}">&times;</button>
              </span>
            `).join('')}
          </div>
          <div class="uv-add-tag">
            <input type="text" id="uv-new-poblacion" placeholder="Agregar población, villa o barrio...">
            <button class="btn-add-tag" id="btn-add-poblacion">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="uv-form-section">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            Calles Principales
          </h4>
          <p class="uv-form-hint">Calles principales que pertenecen o delimitan esta unidad vecinal</p>
          <div class="uv-tags-container" id="uv-calles-tags">
            ${(uv.calles || []).map(c => `
              <span class="uv-tag">
                ${c}
                <button class="uv-tag-remove" data-type="calle" data-value="${c}">&times;</button>
              </span>
            `).join('')}
          </div>
          <div class="uv-add-tag">
            <input type="text" id="uv-new-calle" placeholder="Agregar calle principal...">
            <button class="btn-add-tag" id="btn-add-calle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="uv-form-section">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
              <line x1="8" y1="2" x2="8" y2="18"></line>
              <line x1="16" y1="6" x2="16" y2="22"></line>
            </svg>
            Demarcaciones y Límites Geográficos
          </h4>
          <p class="uv-form-hint">Define los límites territoriales de esta unidad vecinal</p>
          <div class="uv-limites-grid">
            <div class="uv-limite-item uv-limite-norte">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="19" x2="12" y2="5"></line>
                  <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
                Norte
              </label>
              <input type="text" id="uv-limite-norte" value="${uv.limites?.norte || ''}" placeholder="Ej: Av. Dorsal">
            </div>
            <div class="uv-limite-item uv-limite-sur">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <polyline points="19 12 12 19 5 12"></polyline>
                </svg>
                Sur
              </label>
              <input type="text" id="uv-limite-sur" value="${uv.limites?.sur || ''}" placeholder="Ej: Río Mapocho">
            </div>
            <div class="uv-limite-item uv-limite-oriente">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
                Oriente
              </label>
              <input type="text" id="uv-limite-oriente" value="${uv.limites?.oriente || ''}" placeholder="Ej: Panamericana Norte">
            </div>
            <div class="uv-limite-item uv-limite-poniente">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                Poniente
              </label>
              <input type="text" id="uv-limite-poniente" value="${uv.limites?.poniente || ''}" placeholder="Ej: Av. Matta">
            </div>
          </div>
        </div>

        <div class="uv-form-section">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Notas Administrativas
          </h4>
          <textarea id="uv-edit-notas" rows="3" placeholder="Notas adicionales sobre esta unidad vecinal...">${uv.notas || ''}</textarea>
        </div>

        <div class="uv-form-actions">
          <button class="btn-cancel" id="btn-uv-cancel">Cancelar</button>
          <button class="btn-save" id="btn-uv-save">
            ${isNew ? 'Crear Unidad Vecinal' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    `;
  }

  openDeleteModal(uvId, uvNumero) {
    const deleteModal = this.container.querySelector('#uv-delete-modal');
    const body = this.container.querySelector('#uv-delete-body');

    body.innerHTML = `
      <div class="uv-delete-content">
        <div class="uv-delete-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <p>¿Estás seguro de eliminar la <strong>Unidad Vecinal ${uvNumero}</strong>?</p>
        <span class="uv-delete-warning">Esta acción no se puede deshacer. Si hay organizaciones asociadas, no se podrá eliminar.</span>
        <div class="uv-delete-actions">
          <button class="btn-cancel" id="btn-delete-cancel">Cancelar</button>
          <button class="btn-danger" id="btn-delete-confirm" data-uv-id="${uvId}">Eliminar</button>
        </div>
      </div>
    `;

    deleteModal.style.display = 'flex';

    // Event listeners del modal de eliminación
    body.querySelector('#btn-delete-cancel').addEventListener('click', () => this.closeDeleteModal());
    body.querySelector('#btn-delete-confirm').addEventListener('click', async () => {
      await this.deleteUnidad(uvId);
    });
  }

  closeDeleteModal() {
    const modal = this.container.querySelector('#uv-delete-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  async deleteUnidad(uvId) {
    try {
      const btn = this.container.querySelector('#btn-delete-confirm');
      btn.disabled = true;
      btn.textContent = 'Eliminando...';

      await unidadesVecinalesService.delete(uvId);
      showToast('Unidad vecinal eliminada correctamente', 'success');
      this.closeDeleteModal();
      await this.loadData();
      this.render();
      this.setupEventListeners();
    } catch (error) {
      console.error('Error al eliminar:', error);
      const errorMsg = error.message || 'Error al eliminar la unidad vecinal';
      showToast(errorMsg, 'error');
      this.closeDeleteModal();
    }
  }

  setupModalEventListeners() {
    // Cancelar
    const btnCancel = this.container.querySelector('#btn-uv-cancel');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => this.closeModal());
    }

    // Guardar
    const btnSave = this.container.querySelector('#btn-uv-save');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        if (this.isCreating) {
          this.createUnidad();
        } else {
          this.saveUnidad();
        }
      });
    }

    // Agregar población
    const btnAddPoblacion = this.container.querySelector('#btn-add-poblacion');
    const inputPoblacion = this.container.querySelector('#uv-new-poblacion');
    if (btnAddPoblacion && inputPoblacion) {
      const addPoblacion = () => {
        const value = inputPoblacion.value.trim();
        if (value) {
          this.addTag('poblacion', value);
          inputPoblacion.value = '';
        }
      };
      btnAddPoblacion.addEventListener('click', addPoblacion);
      inputPoblacion.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addPoblacion();
        }
      });
    }

    // Agregar calle
    const btnAddCalle = this.container.querySelector('#btn-add-calle');
    const inputCalle = this.container.querySelector('#uv-new-calle');
    if (btnAddCalle && inputCalle) {
      const addCalle = () => {
        const value = inputCalle.value.trim();
        if (value) {
          this.addTag('calle', value);
          inputCalle.value = '';
        }
      };
      btnAddCalle.addEventListener('click', addCalle);
      inputCalle.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addCalle();
        }
      });
    }

    // Eliminar tags
    this.container.querySelectorAll('.uv-tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const value = btn.dataset.value;
        this.removeTag(type, value);
      });
    });
  }

  addTag(type, value) {
    if (!this.selectedUnidad) return;

    const container = this.container.querySelector(
      type === 'poblacion' ? '#uv-poblaciones-tags' : '#uv-calles-tags'
    );

    const array = type === 'poblacion' ? this.selectedUnidad.poblaciones : this.selectedUnidad.calles;
    if (!array) {
      if (type === 'poblacion') {
        this.selectedUnidad.poblaciones = [];
      } else {
        this.selectedUnidad.calles = [];
      }
    }

    const targetArray = type === 'poblacion' ? this.selectedUnidad.poblaciones : this.selectedUnidad.calles;
    if (!targetArray.includes(value)) {
      targetArray.push(value);

      const tag = document.createElement('span');
      tag.className = 'uv-tag';
      tag.innerHTML = `
        ${value}
        <button class="uv-tag-remove" data-type="${type}" data-value="${value}">&times;</button>
      `;
      tag.querySelector('.uv-tag-remove').addEventListener('click', () => {
        this.removeTag(type, value);
      });
      container.appendChild(tag);
    }
  }

  removeTag(type, value) {
    if (!this.selectedUnidad) return;

    const array = type === 'poblacion' ? this.selectedUnidad.poblaciones : this.selectedUnidad.calles;
    const index = array?.indexOf(value);
    if (index > -1) {
      array.splice(index, 1);
    }

    const container = this.container.querySelector(
      type === 'poblacion' ? '#uv-poblaciones-tags' : '#uv-calles-tags'
    );
    const tags = container.querySelectorAll('.uv-tag');
    tags.forEach(tag => {
      if (tag.textContent.trim().startsWith(value)) {
        tag.remove();
      }
    });
  }

  async createUnidad() {
    try {
      const numero = this.container.querySelector('#uv-edit-numero')?.value.trim();
      const idOficial = this.container.querySelector('#uv-edit-idoficial')?.value.trim();

      if (!numero || !idOficial) {
        showToast('El número e ID oficial son requeridos', 'error');
        return;
      }

      const nombre = this.container.querySelector('#uv-edit-nombre').value;
      const macrozona = parseInt(this.container.querySelector('#uv-edit-macrozona').value);
      const notas = this.container.querySelector('#uv-edit-notas').value;
      const limites = {
        norte: this.container.querySelector('#uv-limite-norte').value,
        sur: this.container.querySelector('#uv-limite-sur').value,
        oriente: this.container.querySelector('#uv-limite-oriente').value,
        poniente: this.container.querySelector('#uv-limite-poniente').value
      };

      const btn = this.container.querySelector('#btn-uv-save');
      btn.disabled = true;
      btn.textContent = 'Creando...';

      await unidadesVecinalesService.create({
        numero,
        idOficial,
        nombre: nombre || `Unidad Vecinal ${numero}`,
        macrozona,
        notas,
        limites,
        poblaciones: this.selectedUnidad.poblaciones || [],
        calles: this.selectedUnidad.calles || []
      });

      showToast('Unidad vecinal creada correctamente', 'success');
      this.closeModal();
      await this.loadData();
      this.render();
      this.setupEventListeners();
    } catch (error) {
      console.error('Error al crear:', error);
      const errorMsg = error.message || 'Error al crear la unidad vecinal';
      showToast(errorMsg, 'error');
      const btn = this.container.querySelector('#btn-uv-save');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Crear Unidad Vecinal';
      }
    }
  }

  async saveUnidad() {
    if (!this.selectedUnidad) return;

    try {
      const nombre = this.container.querySelector('#uv-edit-nombre').value;
      const macrozona = parseInt(this.container.querySelector('#uv-edit-macrozona').value);
      const notas = this.container.querySelector('#uv-edit-notas').value;
      const limites = {
        norte: this.container.querySelector('#uv-limite-norte').value,
        sur: this.container.querySelector('#uv-limite-sur').value,
        oriente: this.container.querySelector('#uv-limite-oriente').value,
        poniente: this.container.querySelector('#uv-limite-poniente').value
      };

      const btn = this.container.querySelector('#btn-uv-save');
      btn.disabled = true;
      btn.textContent = 'Guardando...';

      await unidadesVecinalesService.update(this.selectedUnidad._id, {
        nombre,
        macrozona,
        notas,
        limites,
        poblaciones: this.selectedUnidad.poblaciones || [],
        calles: this.selectedUnidad.calles || []
      });

      showToast('Unidad vecinal actualizada correctamente', 'success');
      this.closeModal();
      await this.loadData();
      this.render();
      this.setupEventListeners();
    } catch (error) {
      console.error('Error al guardar:', error);
      showToast('Error al guardar los cambios', 'error');
      const btn = this.container.querySelector('#btn-uv-save');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Guardar Cambios';
      }
    }
  }

  closeModal() {
    const modal = this.container.querySelector('#uv-edit-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    this.selectedUnidad = null;
    this.isCreating = false;
  }
}

export function initUnidadesVecinalesManager(container) {
  const manager = new UnidadesVecinalesManager(container);
  manager.init();
  return manager;
}

export default UnidadesVecinalesManager;
