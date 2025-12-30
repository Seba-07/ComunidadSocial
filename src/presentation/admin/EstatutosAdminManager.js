/**
 * EstatutosAdminManager - Gestor de plantillas de estatutos
 * Permite a MUNICIPALIDAD editar estatutos por tipo de organización
 */

import { showToast, API_URL } from '../../app.js';

class EstatutosAdminManager {
  constructor(container) {
    this.container = container;
    this.templates = [];
    this.tiposDisponibles = {};
    this.selectedTemplate = null;
    this.currentView = 'list'; // 'list', 'edit'
    this.quillEditor = null;
    this.activeTab = 'articulos';
  }

  async init() {
    this.showLoading();
    await this.loadTemplates();
    this.render();
    this.setupEventListeners();
  }

  showLoading() {
    this.container.innerHTML = `
      <div class="estatutos-loading">
        <div class="loading-spinner"></div>
        <p>Cargando plantillas de estatutos...</p>
      </div>
    `;
  }

  async loadTemplates() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/estatuto-templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al cargar plantillas');

      const data = await response.json();
      this.templates = data.templates || [];
      this.tiposDisponibles = data.tiposDisponibles || {};
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al cargar plantillas de estatutos', 'error');
    }
  }

  render() {
    if (this.currentView === 'list') {
      this.renderList();
    } else if (this.currentView === 'edit') {
      this.renderEditor();
    }
  }

  renderList() {
    const categorias = this.organizarPorCategoria();
    const stats = this.getStats();

    this.container.innerHTML = `
      <div class="estatutos-manager">
        <!-- Header -->
        <div class="estatutos-header">
          <div class="estatutos-header-info">
            <div class="estatutos-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div>
              <h2>Editor de Estatutos</h2>
              <p>Gestiona las plantillas de estatutos por tipo de organización</p>
            </div>
          </div>
          <button class="btn-back-admin" id="btn-back-to-admin">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Volver al Panel
          </button>
        </div>

        <!-- Stats -->
        <div class="estatutos-stats">
          <div class="stat-card">
            <span class="stat-number">${stats.total}</span>
            <span class="stat-label">Plantillas Totales</span>
          </div>
          <div class="stat-card stat-success">
            <span class="stat-number">${stats.publicadas}</span>
            <span class="stat-label">Publicadas</span>
          </div>
          <div class="stat-card stat-warning">
            <span class="stat-number">${stats.sinConfigurar}</span>
            <span class="stat-label">Sin Configurar</span>
          </div>
        </div>

        <!-- Lista por categorías -->
        <div class="estatutos-categorias">
          ${Object.entries(categorias).map(([categoria, tipos]) => `
            <div class="categoria-section">
              <h3 class="categoria-title">${this.getCategoriaLabel(categoria)}</h3>
              <div class="estatutos-grid">
                ${tipos.map(tipo => this.renderTemplateCard(tipo)).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  organizarPorCategoria() {
    const categorias = {};
    const tiposKeys = Object.keys(this.tiposDisponibles);

    tiposKeys.forEach(tipo => {
      const info = this.tiposDisponibles[tipo];
      const cat = info.categoria || 'OTRO';
      if (!categorias[cat]) categorias[cat] = [];

      const template = this.templates.find(t => t.tipoOrganizacion === tipo);
      categorias[cat].push({
        id: tipo,
        nombre: info.nombre,
        categoria: cat,
        template: template || null
      });
    });

    // Ordenar categorías
    const orden = ['TERRITORIAL', 'FUNCIONAL', 'EDUCACIONAL', 'CULTURAL', 'SOCIAL', 'OTRO'];
    const ordenado = {};
    orden.forEach(cat => {
      if (categorias[cat]) ordenado[cat] = categorias[cat];
    });

    return ordenado;
  }

  getCategoriaLabel(categoria) {
    const labels = {
      'TERRITORIAL': 'Organizaciones Territoriales',
      'FUNCIONAL': 'Organizaciones Funcionales',
      'EDUCACIONAL': 'Organizaciones Educacionales',
      'CULTURAL': 'Organizaciones Culturales',
      'SOCIAL': 'Organizaciones Sociales',
      'OTRO': 'Otras Organizaciones'
    };
    return labels[categoria] || categoria;
  }

  getStats() {
    const total = this.templates.length;
    const publicadas = this.templates.filter(t => t.publicado).length;
    const sinConfigurar = Object.keys(this.tiposDisponibles).length - total;

    return { total, publicadas, sinConfigurar };
  }

  renderTemplateCard(tipo) {
    const template = tipo.template;
    const hasTemplate = !!template;

    return `
      <div class="estatuto-card ${hasTemplate ? 'configured' : 'not-configured'}"
           data-tipo="${tipo.id}">
        <div class="estatuto-card-header">
          <span class="estatuto-tipo-badge ${tipo.categoria.toLowerCase()}">${tipo.categoria}</span>
          ${hasTemplate && template.publicado ?
            '<span class="estatuto-published-badge">Publicado</span>' :
            hasTemplate ? '<span class="estatuto-draft-badge">Borrador</span>' : ''}
        </div>
        <h4>${tipo.nombre}</h4>
        ${hasTemplate ? `
          <div class="estatuto-card-info">
            <span><strong>${template.articulos?.length || 0}</strong> artículos</span>
            <span><strong>${template.directorio?.cargos?.length || 0}</strong> cargos</span>
            <span>v${template.version || 1}</span>
          </div>
          <div class="estatuto-card-actions">
            <button class="btn-edit-template" data-id="${template._id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Editar
            </button>
            <button class="btn-toggle-publish ${template.publicado ? 'unpublish' : 'publish'}" data-id="${template._id}">
              ${template.publicado ? 'Despublicar' : 'Publicar'}
            </button>
          </div>
        ` : `
          <p class="no-template-msg">Sin configurar</p>
          <button class="btn-configure-template" data-tipo="${tipo.id}" data-nombre="${tipo.nombre}" data-categoria="${tipo.categoria}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Configurar
          </button>
        `}
      </div>
    `;
  }

  renderEditor() {
    const template = this.selectedTemplate;
    if (!template) {
      this.currentView = 'list';
      this.render();
      return;
    }

    this.container.innerHTML = `
      <div class="estatutos-editor">
        <!-- Header del Editor -->
        <div class="editor-header">
          <div class="editor-header-left">
            <button class="btn-back" id="btn-back-to-list">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <div class="editor-title">
              <h2>${template.nombreTipo}</h2>
              <span class="editor-tipo-badge">${template.tipoOrganizacion}</span>
              ${template.publicado ?
                '<span class="badge-published">Publicado</span>' :
                '<span class="badge-draft">Borrador</span>'}
            </div>
          </div>
          <div class="editor-header-actions">
            <button class="btn-save-template" id="btn-save-template">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Guardar Cambios
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="editor-tabs">
          <button class="editor-tab ${this.activeTab === 'articulos' ? 'active' : ''}" data-tab="articulos">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            Artículos
          </button>
          <button class="editor-tab ${this.activeTab === 'directorio' ? 'active' : ''}" data-tab="directorio">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Directorio
          </button>
          <button class="editor-tab ${this.activeTab === 'imagenes' ? 'active' : ''}" data-tab="imagenes">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            Header/Footer
          </button>
          <button class="editor-tab ${this.activeTab === 'config' ? 'active' : ''}" data-tab="config">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Configuración
          </button>
        </div>

        <!-- Contenido del Tab -->
        <div class="editor-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;

    this.setupEditorEvents();
  }

  renderTabContent() {
    switch (this.activeTab) {
      case 'articulos': return this.renderArticulosTab();
      case 'directorio': return this.renderDirectorioTab();
      case 'imagenes': return this.renderImagenesTab();
      case 'config': return this.renderConfigTab();
      default: return '';
    }
  }

  renderArticulosTab() {
    const articulos = this.selectedTemplate.articulos || [];

    return `
      <div class="tab-articulos">
        <div class="tab-header">
          <h3>Artículos del Estatuto</h3>
          <button class="btn-add-articulo" id="btn-add-articulo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Agregar Artículo
          </button>
        </div>

        <div class="articulos-list" id="articulos-list">
          ${articulos.length === 0 ? `
            <div class="empty-articulos">
              <p>No hay artículos configurados</p>
              <button class="btn-add-first-articulo" id="btn-add-first-articulo">Agregar primer artículo</button>
            </div>
          ` : articulos.sort((a, b) => a.orden - b.orden).map((art, index) => `
            <div class="articulo-item" data-id="${art._id || index}" data-orden="${art.orden}">
              <div class="articulo-drag-handle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="8" y1="6" x2="8" y2="6"/><line x1="16" y1="6" x2="16" y2="6"/>
                  <line x1="8" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="16" y2="12"/>
                  <line x1="8" y1="18" x2="8" y2="18"/><line x1="16" y1="18" x2="16" y2="18"/>
                </svg>
              </div>
              <div class="articulo-numero">Art. ${art.numero}</div>
              <div class="articulo-info">
                <div class="articulo-titulo">${art.titulo}</div>
                <div class="articulo-preview">${art.contenido.substring(0, 100)}${art.contenido.length > 100 ? '...' : ''}</div>
              </div>
              <div class="articulo-actions">
                <button class="btn-edit-articulo" data-index="${index}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="btn-delete-articulo" data-index="${index}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderDirectorioTab() {
    const directorio = this.selectedTemplate.directorio || { cargos: [], totalRequerido: 5 };
    const cargos = directorio.cargos || [];

    return `
      <div class="tab-directorio">
        <div class="tab-header">
          <h3>Configuración del Directorio</h3>
          <button class="btn-add-cargo" id="btn-add-cargo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Agregar Cargo
          </button>
        </div>

        <div class="directorio-config-row">
          <div class="config-field">
            <label>Miembros mínimos para constituir</label>
            <input type="number" id="miembros-minimos" value="${this.selectedTemplate.miembrosMinimos || 15}" min="1" max="100">
          </div>
          <div class="config-field">
            <label>Miembros Comisión Electoral</label>
            <input type="number" id="comision-electoral-cantidad" value="${this.selectedTemplate.comisionElectoral?.cantidad || 3}" min="1" max="10">
          </div>
          <div class="config-field">
            <label>Duración mandato (años)</label>
            <input type="number" id="duracion-mandato" value="${directorio.duracionMandato || 2}" min="1" max="5">
          </div>
        </div>

        <div class="cargos-list" id="cargos-list">
          ${cargos.sort((a, b) => a.orden - b.orden).map((cargo, index) => `
            <div class="cargo-item" data-index="${index}">
              <div class="cargo-drag-handle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="8" y1="6" x2="8" y2="6"/><line x1="16" y1="6" x2="16" y2="6"/>
                  <line x1="8" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="16" y2="12"/>
                  <line x1="8" y1="18" x2="8" y2="18"/><line x1="16" y1="18" x2="16" y2="18"/>
                </svg>
              </div>
              <div class="cargo-color" style="background-color: ${cargo.color}"></div>
              <div class="cargo-info">
                <input type="text" class="cargo-nombre-input" value="${cargo.nombre}" data-field="nombre">
                <input type="text" class="cargo-id-input" value="${cargo.id}" data-field="id" placeholder="ID (sin espacios)">
              </div>
              <div class="cargo-options">
                <input type="color" class="cargo-color-input" value="${cargo.color}" data-field="color">
                <label class="cargo-required-label">
                  <input type="checkbox" class="cargo-required-input" ${cargo.required ? 'checked' : ''} data-field="required">
                  Requerido
                </label>
              </div>
              <button class="btn-delete-cargo" data-index="${index}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderImagenesTab() {
    const imagenes = this.selectedTemplate.imagenesDocumento || [];
    const header = imagenes.find(i => i.tipo === 'header');
    const footer = imagenes.find(i => i.tipo === 'footer');

    return `
      <div class="tab-imagenes">
        <div class="tab-header">
          <h3>Imágenes del Documento</h3>
          <p class="tab-description">Estas imágenes aparecerán en el PDF y en la vista previa del estatuto</p>
        </div>

        <div class="imagenes-grid">
          <div class="imagen-upload-card">
            <h4>Header (Encabezado)</h4>
            <p>Imagen que aparece en la parte superior del documento</p>
            ${header ? `
              <div class="imagen-preview">
                <img src="${API_URL.replace('/api', '')}${header.url}" alt="Header">
                <button class="btn-remove-imagen" data-tipo="header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div class="imagen-config">
                <label>Alineación:</label>
                <select class="imagen-alignment" data-tipo="header">
                  <option value="left" ${header.alignment === 'left' ? 'selected' : ''}>Izquierda</option>
                  <option value="center" ${header.alignment === 'center' ? 'selected' : ''}>Centro</option>
                  <option value="right" ${header.alignment === 'right' ? 'selected' : ''}>Derecha</option>
                </select>
              </div>
            ` : `
              <div class="imagen-dropzone" data-tipo="header">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p>Arrastra una imagen o haz clic para seleccionar</p>
                <input type="file" class="imagen-input" data-tipo="header" accept="image/*" hidden>
              </div>
            `}
          </div>

          <div class="imagen-upload-card">
            <h4>Footer (Pie de página)</h4>
            <p>Imagen que aparece en la parte inferior del documento</p>
            ${footer ? `
              <div class="imagen-preview">
                <img src="${API_URL.replace('/api', '')}${footer.url}" alt="Footer">
                <button class="btn-remove-imagen" data-tipo="footer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div class="imagen-config">
                <label>Alineación:</label>
                <select class="imagen-alignment" data-tipo="footer">
                  <option value="left" ${footer.alignment === 'left' ? 'selected' : ''}>Izquierda</option>
                  <option value="center" ${footer.alignment === 'center' ? 'selected' : ''}>Centro</option>
                  <option value="right" ${footer.alignment === 'right' ? 'selected' : ''}>Derecha</option>
                </select>
              </div>
            ` : `
              <div class="imagen-dropzone" data-tipo="footer">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p>Arrastra una imagen o haz clic para seleccionar</p>
                <input type="file" class="imagen-input" data-tipo="footer" accept="image/*" hidden>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  renderConfigTab() {
    const template = this.selectedTemplate;

    return `
      <div class="tab-config">
        <div class="config-section">
          <h3>Información General</h3>
          <div class="config-fields">
            <div class="config-field full-width">
              <label>Nombre del Tipo</label>
              <input type="text" id="config-nombre-tipo" value="${template.nombreTipo || ''}" placeholder="Ej: Centro de Padres y Apoderados">
            </div>
            <div class="config-field full-width">
              <label>Descripción</label>
              <textarea id="config-descripcion" rows="3" placeholder="Descripción del estatuto...">${template.descripcion || ''}</textarea>
            </div>
          </div>
        </div>

        <div class="config-section">
          <h3>Estado de Publicación</h3>
          <div class="publish-status">
            <div class="publish-info">
              <span class="publish-badge ${template.publicado ? 'published' : 'draft'}">
                ${template.publicado ? 'Publicado' : 'Borrador'}
              </span>
              <p>${template.publicado
                ? 'Esta plantilla está activa y se usará para nuevas organizaciones de este tipo.'
                : 'Esta plantilla es un borrador y no se usará hasta que la publiques.'}</p>
            </div>
            <button class="btn-toggle-publish-config ${template.publicado ? 'unpublish' : 'publish'}" id="btn-toggle-publish">
              ${template.publicado ? 'Despublicar' : 'Publicar Plantilla'}
            </button>
          </div>
        </div>

        <div class="config-section">
          <h3>Historial de Versiones</h3>
          <p class="version-current">Versión actual: <strong>v${template.version || 1}</strong></p>
          ${template.historialVersiones && template.historialVersiones.length > 0 ? `
            <div class="version-list">
              ${template.historialVersiones.slice(0, 5).map(v => `
                <div class="version-item">
                  <span class="version-number">v${v.version}</span>
                  <span class="version-date">${new Date(v.fecha).toLocaleDateString()}</span>
                  <span class="version-desc">${v.descripcionCambio || 'Sin descripción'}</span>
                </div>
              `).join('')}
            </div>
          ` : '<p class="no-versions">No hay versiones anteriores</p>'}
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Volver al panel admin
    this.container.addEventListener('click', (e) => {
      if (e.target.closest('#btn-back-to-admin')) {
        this.hide();
        window.showPage('page-admin');
      }

      // Editar template
      if (e.target.closest('.btn-edit-template')) {
        const id = e.target.closest('.btn-edit-template').dataset.id;
        this.editTemplate(id);
      }

      // Configurar nuevo template
      if (e.target.closest('.btn-configure-template')) {
        const btn = e.target.closest('.btn-configure-template');
        this.createTemplate(btn.dataset.tipo, btn.dataset.nombre, btn.dataset.categoria);
      }

      // Toggle publicar
      if (e.target.closest('.btn-toggle-publish')) {
        const id = e.target.closest('.btn-toggle-publish').dataset.id;
        this.togglePublish(id);
      }
    });
  }

  setupEditorEvents() {
    // Volver a la lista
    const btnBack = document.getElementById('btn-back-to-list');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        this.currentView = 'list';
        this.selectedTemplate = null;
        this.render();
      });
    }

    // Tabs
    document.querySelectorAll('.editor-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeTab = tab.dataset.tab;
        this.renderEditor();
      });
    });

    // Guardar cambios
    const btnSave = document.getElementById('btn-save-template');
    if (btnSave) {
      btnSave.addEventListener('click', () => this.saveTemplate());
    }

    // Agregar artículo
    const btnAddArticulo = document.getElementById('btn-add-articulo') || document.getElementById('btn-add-first-articulo');
    if (btnAddArticulo) {
      btnAddArticulo.addEventListener('click', () => this.addArticulo());
    }

    // Editar artículo
    document.querySelectorAll('.btn-edit-articulo').forEach(btn => {
      btn.addEventListener('click', () => this.editArticulo(parseInt(btn.dataset.index)));
    });

    // Eliminar artículo
    document.querySelectorAll('.btn-delete-articulo').forEach(btn => {
      btn.addEventListener('click', () => this.deleteArticulo(parseInt(btn.dataset.index)));
    });

    // Agregar cargo
    const btnAddCargo = document.getElementById('btn-add-cargo');
    if (btnAddCargo) {
      btnAddCargo.addEventListener('click', () => this.addCargo());
    }

    // Eliminar cargo
    document.querySelectorAll('.btn-delete-cargo').forEach(btn => {
      btn.addEventListener('click', () => this.deleteCargo(parseInt(btn.dataset.index)));
    });

    // Actualizar campos de cargo en tiempo real
    document.querySelectorAll('.cargo-item input').forEach(input => {
      input.addEventListener('change', (e) => this.updateCargoField(e));
    });

    // Upload de imágenes
    document.querySelectorAll('.imagen-dropzone').forEach(dropzone => {
      dropzone.addEventListener('click', () => {
        dropzone.querySelector('.imagen-input').click();
      });
    });

    document.querySelectorAll('.imagen-input').forEach(input => {
      input.addEventListener('change', (e) => this.uploadImagen(e));
    });

    document.querySelectorAll('.btn-remove-imagen').forEach(btn => {
      btn.addEventListener('click', () => this.removeImagen(btn.dataset.tipo));
    });

    // Toggle publicar en config
    const btnTogglePublish = document.getElementById('btn-toggle-publish');
    if (btnTogglePublish) {
      btnTogglePublish.addEventListener('click', () => this.togglePublish(this.selectedTemplate._id));
    }
  }

  async editTemplate(id) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/estatuto-templates/id/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al cargar plantilla');

      this.selectedTemplate = await response.json();
      this.currentView = 'edit';
      this.activeTab = 'articulos';
      this.render();
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al cargar la plantilla', 'error');
    }
  }

  async createTemplate(tipo, nombre, categoria) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/estatuto-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tipoOrganizacion: tipo,
          nombreTipo: nombre,
          categoria: categoria
        })
      });

      if (!response.ok) throw new Error('Error al crear plantilla');

      const newTemplate = await response.json();
      showToast('Plantilla creada correctamente', 'success');

      this.selectedTemplate = newTemplate;
      this.currentView = 'edit';
      this.activeTab = 'articulos';
      await this.loadTemplates();
      this.render();
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al crear la plantilla', 'error');
    }
  }

  async saveTemplate() {
    try {
      // Recopilar datos del formulario
      const updateData = {
        descripcionCambio: 'Actualización desde editor'
      };

      // Config general
      const nombreTipo = document.getElementById('config-nombre-tipo');
      const descripcion = document.getElementById('config-descripcion');
      if (nombreTipo) updateData.nombreTipo = nombreTipo.value;
      if (descripcion) updateData.descripcion = descripcion.value;

      // Miembros mínimos y comisión
      const miembrosMinimos = document.getElementById('miembros-minimos');
      const comisionCantidad = document.getElementById('comision-electoral-cantidad');
      const duracionMandato = document.getElementById('duracion-mandato');

      if (miembrosMinimos) updateData.miembrosMinimos = parseInt(miembrosMinimos.value);
      if (comisionCantidad) {
        updateData.comisionElectoral = {
          cantidad: parseInt(comisionCantidad.value),
          descripcion: 'Miembros que organizan las elecciones'
        };
      }

      // Directorio (cargos actualizados)
      const cargosItems = document.querySelectorAll('.cargo-item');
      if (cargosItems.length > 0) {
        const cargos = [];
        cargosItems.forEach((item, index) => {
          cargos.push({
            id: item.querySelector('[data-field="id"]').value,
            nombre: item.querySelector('[data-field="nombre"]').value,
            color: item.querySelector('[data-field="color"]').value,
            required: item.querySelector('[data-field="required"]').checked,
            orden: index + 1
          });
        });
        updateData.directorio = {
          cargos,
          totalRequerido: cargos.filter(c => c.required).length,
          duracionMandato: duracionMandato ? parseInt(duracionMandato.value) : 2
        };
      }

      // Artículos (ya están en selectedTemplate)
      updateData.articulos = this.selectedTemplate.articulos;

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/estatuto-templates/${this.selectedTemplate._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) throw new Error('Error al guardar');

      this.selectedTemplate = await response.json();
      await this.loadTemplates();
      showToast('Cambios guardados correctamente', 'success');
      this.renderEditor();
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al guardar los cambios', 'error');
    }
  }

  async togglePublish(id) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/estatuto-templates/${id}/publicar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al cambiar estado');

      const result = await response.json();
      showToast(result.message, 'success');

      await this.loadTemplates();

      if (this.selectedTemplate && this.selectedTemplate._id === id) {
        this.selectedTemplate.publicado = result.publicado;
      }

      this.render();
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al cambiar estado de publicación', 'error');
    }
  }

  addArticulo() {
    const articulos = this.selectedTemplate.articulos || [];
    const nuevoNumero = articulos.length + 1;

    // Mostrar modal para agregar artículo
    this.showArticuloModal({
      numero: nuevoNumero,
      titulo: '',
      contenido: '',
      esEditable: true,
      orden: nuevoNumero
    }, true);
  }

  editArticulo(index) {
    const articulo = this.selectedTemplate.articulos[index];
    this.showArticuloModal(articulo, false, index);
  }

  showArticuloModal(articulo, isNew, index = -1) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-articulo">
        <div class="modal-header">
          <h3>${isNew ? 'Nuevo Artículo' : 'Editar Artículo'}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-field">
              <label>Número</label>
              <input type="number" id="articulo-numero" value="${articulo.numero}" min="1">
            </div>
            <div class="form-field flex-grow">
              <label>Título</label>
              <input type="text" id="articulo-titulo" value="${articulo.titulo}" placeholder="Ej: Constitución y Denominación">
            </div>
          </div>
          <div class="form-field">
            <label>Contenido</label>
            <div id="articulo-editor-container"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="btn-cancel-articulo">Cancelar</button>
          <button class="btn-save" id="btn-save-articulo">Guardar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Inicializar Quill si está disponible
    const editorContainer = document.getElementById('articulo-editor-container');
    let quillInstance = null;

    if (typeof Quill !== 'undefined') {
      quillInstance = new Quill(editorContainer, {
        theme: 'snow',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['clean']
          ]
        },
        placeholder: 'Escribe el contenido del artículo...'
      });
      quillInstance.root.innerHTML = articulo.contenido || '';
    } else {
      // Fallback a textarea
      editorContainer.innerHTML = `<textarea id="articulo-contenido" rows="10">${articulo.contenido || ''}</textarea>`;
    }

    // Event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#btn-cancel-articulo').addEventListener('click', () => modal.remove());

    modal.querySelector('#btn-save-articulo').addEventListener('click', () => {
      const numero = parseInt(document.getElementById('articulo-numero').value);
      const titulo = document.getElementById('articulo-titulo').value;
      const contenido = quillInstance
        ? quillInstance.root.innerHTML
        : document.getElementById('articulo-contenido').value;

      if (!titulo.trim()) {
        showToast('El título es requerido', 'error');
        return;
      }

      const nuevoArticulo = {
        numero,
        titulo: titulo.trim(),
        contenido: contenido,
        esEditable: true,
        orden: isNew ? this.selectedTemplate.articulos.length + 1 : articulo.orden
      };

      if (isNew) {
        this.selectedTemplate.articulos.push(nuevoArticulo);
      } else {
        this.selectedTemplate.articulos[index] = { ...this.selectedTemplate.articulos[index], ...nuevoArticulo };
      }

      modal.remove();
      this.renderEditor();
      showToast(isNew ? 'Artículo agregado' : 'Artículo actualizado', 'success');
    });
  }

  deleteArticulo(index) {
    if (confirm('¿Estás seguro de eliminar este artículo?')) {
      this.selectedTemplate.articulos.splice(index, 1);
      // Reordenar
      this.selectedTemplate.articulos.forEach((art, i) => {
        art.orden = i + 1;
        art.numero = i + 1;
      });
      this.renderEditor();
      showToast('Artículo eliminado', 'success');
    }
  }

  addCargo() {
    if (!this.selectedTemplate.directorio) {
      this.selectedTemplate.directorio = { cargos: [], totalRequerido: 0 };
    }

    const cargos = this.selectedTemplate.directorio.cargos;
    const nuevoOrden = cargos.length + 1;

    cargos.push({
      id: `cargo_${nuevoOrden}`,
      nombre: `Nuevo Cargo ${nuevoOrden}`,
      color: '#6366f1',
      required: true,
      orden: nuevoOrden
    });

    this.renderEditor();
  }

  deleteCargo(index) {
    if (confirm('¿Estás seguro de eliminar este cargo?')) {
      this.selectedTemplate.directorio.cargos.splice(index, 1);
      // Reordenar
      this.selectedTemplate.directorio.cargos.forEach((c, i) => c.orden = i + 1);
      this.renderEditor();
    }
  }

  updateCargoField(e) {
    const item = e.target.closest('.cargo-item');
    const index = parseInt(item.dataset.index);
    const field = e.target.dataset.field;
    const value = field === 'required' ? e.target.checked : e.target.value;

    this.selectedTemplate.directorio.cargos[index][field] = value;
  }

  async uploadImagen(e) {
    const file = e.target.files[0];
    if (!file) return;

    const tipo = e.target.dataset.tipo;

    const formData = new FormData();
    formData.append('imagen', file);
    formData.append('tipo', tipo);
    formData.append('alignment', 'center');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/estatuto-templates/${this.selectedTemplate._id}/imagen`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) throw new Error('Error al subir imagen');

      this.selectedTemplate = await response.json();
      this.renderEditor();
      showToast('Imagen subida correctamente', 'success');
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al subir la imagen', 'error');
    }
  }

  async removeImagen(tipo) {
    if (!confirm('¿Estás seguro de eliminar esta imagen?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/estatuto-templates/${this.selectedTemplate._id}/imagen/${tipo}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al eliminar imagen');

      this.selectedTemplate = await response.json();
      this.renderEditor();
      showToast('Imagen eliminada', 'success');
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al eliminar la imagen', 'error');
    }
  }

  show() {
    const page = document.getElementById('page-estatutos-admin');
    if (page) {
      document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
      page.classList.add('active');
    }
    this.init();
  }

  hide() {
    const page = document.getElementById('page-estatutos-admin');
    if (page) page.classList.remove('active');
  }
}

export function initEstatutosAdminManager() {
  const container = document.querySelector('.estatutos-admin-container');
  if (!container) return null;

  const manager = new EstatutosAdminManager(container);
  return manager;
}

export default EstatutosAdminManager;
