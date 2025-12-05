/**
 * UnidadesVecinalesManager - Componente para gestionar las Unidades Vecinales
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
        <div class="uv-manager-header">
          <h2>Gestión de Unidades Vecinales</h2>
          <p>Administra las 44 unidades vecinales de la comuna de Renca</p>
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
            <input type="text" id="uv-search-input" placeholder="Buscar por número, población o calle..."
                   value="${this.searchQuery}">
          </div>
          <button class="btn-uv-seed" id="btn-uv-seed" title="Recargar datos desde el servidor">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            Recargar
          </button>
        </div>

        <div class="uv-list">
          ${filteredUnidades.length === 0 ? `
            <div class="uv-empty">
              <p>No se encontraron unidades vecinales</p>
            </div>
          ` : filteredUnidades.map(uv => this.renderUnidadCard(uv)).join('')}
        </div>
      </div>

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
    `;
  }

  renderUnidadCard(uv) {
    const poblacionesCount = uv.poblaciones?.length || 0;
    const callesCount = uv.calles?.length || 0;

    return `
      <div class="uv-card" data-uv-id="${uv._id}">
        <div class="uv-card-header">
          <div class="uv-card-numero">UV ${uv.numero}</div>
          <div class="uv-card-macrozona">Macrozona ${uv.macrozona || '?'}</div>
        </div>
        <div class="uv-card-body">
          <div class="uv-card-info">
            <span class="uv-card-badge ${poblacionesCount > 0 ? 'has-data' : 'no-data'}">
              ${poblacionesCount} poblaciones
            </span>
            <span class="uv-card-badge ${callesCount > 0 ? 'has-data' : 'no-data'}">
              ${callesCount} calles
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
          <button class="btn-uv-edit" data-uv-id="${uv._id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Editar
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
    const btnSeed = this.container.querySelector('#btn-uv-seed');
    if (btnSeed) {
      btnSeed.addEventListener('click', async () => {
        try {
          btnSeed.disabled = true;
          btnSeed.innerHTML = 'Recargando...';
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

    // Cerrar modal
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
  }

  openEditModal(uvId) {
    const uv = this.unidades.find(u => u._id === uvId);
    if (!uv) return;

    this.selectedUnidad = uv;
    const modal = this.container.querySelector('#uv-edit-modal');
    const title = this.container.querySelector('#uv-modal-title');
    const body = this.container.querySelector('#uv-modal-body');

    title.textContent = `Editar Unidad Vecinal ${uv.numero}`;
    body.innerHTML = `
      <div class="uv-edit-form">
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

        <div class="uv-form-group">
          <label>Poblaciones, Villas y Barrios</label>
          <div class="uv-tags-container" id="uv-poblaciones-tags">
            ${(uv.poblaciones || []).map(p => `
              <span class="uv-tag">
                ${p}
                <button class="uv-tag-remove" data-type="poblacion" data-value="${p}">&times;</button>
              </span>
            `).join('')}
          </div>
          <div class="uv-add-tag">
            <input type="text" id="uv-new-poblacion" placeholder="Agregar población...">
            <button class="btn-add-tag" id="btn-add-poblacion">+</button>
          </div>
        </div>

        <div class="uv-form-group">
          <label>Calles Principales</label>
          <div class="uv-tags-container" id="uv-calles-tags">
            ${(uv.calles || []).map(c => `
              <span class="uv-tag">
                ${c}
                <button class="uv-tag-remove" data-type="calle" data-value="${c}">&times;</button>
              </span>
            `).join('')}
          </div>
          <div class="uv-add-tag">
            <input type="text" id="uv-new-calle" placeholder="Agregar calle...">
            <button class="btn-add-tag" id="btn-add-calle">+</button>
          </div>
        </div>

        <div class="uv-form-group">
          <label>Límites Geográficos</label>
          <div class="uv-limites-grid">
            <div>
              <label>Norte</label>
              <input type="text" id="uv-limite-norte" value="${uv.limites?.norte || ''}" placeholder="Ej: Av. Dorsal">
            </div>
            <div>
              <label>Sur</label>
              <input type="text" id="uv-limite-sur" value="${uv.limites?.sur || ''}" placeholder="Ej: Río Mapocho">
            </div>
            <div>
              <label>Oriente</label>
              <input type="text" id="uv-limite-oriente" value="${uv.limites?.oriente || ''}" placeholder="Ej: Panamericana Norte">
            </div>
            <div>
              <label>Poniente</label>
              <input type="text" id="uv-limite-poniente" value="${uv.limites?.poniente || ''}" placeholder="Ej: Av. Matta">
            </div>
          </div>
        </div>

        <div class="uv-form-group">
          <label>Notas</label>
          <textarea id="uv-edit-notas" rows="3" placeholder="Notas adicionales...">${uv.notas || ''}</textarea>
        </div>

        <div class="uv-form-actions">
          <button class="btn-cancel" id="btn-uv-cancel">Cancelar</button>
          <button class="btn-save" id="btn-uv-save">Guardar Cambios</button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    this.setupModalEventListeners();
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
      btnSave.addEventListener('click', () => this.saveUnidad());
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
        if (e.key === 'Enter') addPoblacion();
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
        if (e.key === 'Enter') addCalle();
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
    }
  }

  closeModal() {
    const modal = this.container.querySelector('#uv-edit-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    this.selectedUnidad = null;
  }
}

export function initUnidadesVecinalesManager(container) {
  const manager = new UnidadesVecinalesManager(container);
  manager.init();
  return manager;
}

export default UnidadesVecinalesManager;
