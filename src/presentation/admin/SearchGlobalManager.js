/**
 * SearchGlobalManager - Componente de busqueda global para el panel admin
 * Se integra en el header del admin, reemplazando/mejorando la barra de busqueda existente
 */

import { searchService } from '../../services/SearchService.js';
import { showToast } from '../../app.js';

// Iconos SVG por tipo de resultado
const TYPE_ICONS = {
  organizations: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>`,
  users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>`,
  news: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1m2 13a2 2 0 0 1-2-2V7m2 13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"></path>
  </svg>`,
  documents: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
  </svg>`
};

// Nombres en espanol para cada tipo
const TYPE_LABELS = {
  organizations: 'Organizaciones',
  users: 'Usuarios',
  news: 'Noticias',
  documents: 'Documentos'
};

// Estilos inline del dropdown de busqueda
const DROPDOWN_STYLES = `
  .search-global-wrapper {
    position: relative;
    width: 100%;
  }

  .search-global-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0 0 12px 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08);
    z-index: 9999;
    max-height: 400px;
    overflow-y: auto;
    display: none;
  }

  .search-global-dropdown.active {
    display: block;
  }

  .search-global-dropdown::-webkit-scrollbar {
    width: 6px;
  }

  .search-global-dropdown::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }

  .search-global-dropdown::-webkit-scrollbar-thumb {
    background: #94a3b8;
    border-radius: 3px;
  }

  .search-global-group {
    border-bottom: 1px solid #f1f5f9;
  }

  .search-global-group:last-child {
    border-bottom: none;
  }

  .search-global-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    background: #f8fafc;
    border-bottom: 1px solid #f1f5f9;
  }

  .search-global-group-count {
    background: #e2e8f0;
    color: #475569;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 700;
  }

  .search-global-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    cursor: pointer;
    transition: background-color 0.15s ease;
    border-bottom: 1px solid #f8fafc;
  }

  .search-global-item:last-child {
    border-bottom: none;
  }

  .search-global-item:hover,
  .search-global-item.highlighted {
    background-color: #eff6ff;
  }

  .search-global-item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: #f1f5f9;
    color: #475569;
    flex-shrink: 0;
  }

  .search-global-item-icon.type-organizations {
    background: #dbeafe;
    color: #2563eb;
  }

  .search-global-item-icon.type-users {
    background: #dcfce7;
    color: #16a34a;
  }

  .search-global-item-icon.type-news {
    background: #fef3c7;
    color: #d97706;
  }

  .search-global-item-icon.type-documents {
    background: #f3e8ff;
    color: #7c3aed;
  }

  .search-global-item-info {
    flex: 1;
    min-width: 0;
  }

  .search-global-item-name {
    font-size: 14px;
    font-weight: 500;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .search-global-item-subtitle {
    font-size: 12px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }

  .search-global-item-action {
    color: #94a3b8;
    flex-shrink: 0;
    transition: color 0.15s ease;
  }

  .search-global-item:hover .search-global-item-action {
    color: #3b82f6;
  }

  .search-global-empty {
    padding: 24px 16px;
    text-align: center;
    color: #94a3b8;
  }

  .search-global-empty-icon {
    font-size: 28px;
    margin-bottom: 8px;
  }

  .search-global-empty-text {
    font-size: 14px;
    font-weight: 500;
    color: #64748b;
  }

  .search-global-empty-hint {
    font-size: 12px;
    color: #94a3b8;
    margin-top: 4px;
  }

  .search-global-loading {
    padding: 20px 16px;
    text-align: center;
    color: #64748b;
    font-size: 13px;
  }

  .search-global-loading-spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 2px solid #e2e8f0;
    border-top: 2px solid #3b82f6;
    border-radius: 50%;
    animation: search-spin 0.6s linear infinite;
    margin-right: 8px;
    vertical-align: middle;
  }

  @keyframes search-spin {
    to { transform: rotate(360deg); }
  }
`;

export class SearchGlobalManager {
  constructor() {
    this.searchInput = null;
    this.dropdown = null;
    this.wrapper = null;
    this.debounceTimer = null;
    this.isOpen = false;
    this.highlightedIndex = -1;
    this.currentResults = [];
    this.flatResults = [];
  }

  /**
   * Inicializa el buscador global, adjuntandolo al header existente
   */
  init() {
    // Inyectar estilos
    this._injectStyles();

    // Buscar el input de busqueda existente en el header
    this.searchInput = document.getElementById('admin-search');
    if (!this.searchInput) {
      console.warn('SearchGlobalManager: No se encontro el input #admin-search');
      return;
    }

    // Actualizar placeholder para reflejar busqueda global
    this.searchInput.placeholder = 'Buscar organizaciones, usuarios, noticias...';

    // Envolver el contenedor de busqueda existente
    const searchBar = this.searchInput.closest('.muni-search-bar');
    if (searchBar) {
      this.wrapper = document.createElement('div');
      this.wrapper.className = 'search-global-wrapper';
      searchBar.style.position = 'relative';

      // Crear el dropdown
      this.dropdown = document.createElement('div');
      this.dropdown.className = 'search-global-dropdown';
      this.dropdown.id = 'search-global-dropdown';
      searchBar.appendChild(this.dropdown);
    }

    // Adjuntar listeners
    this._attachListeners();

    console.log('SearchGlobalManager inicializado');
  }

  /**
   * Inyecta los estilos CSS en el documento
   */
  _injectStyles() {
    if (document.getElementById('search-global-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'search-global-styles';
    styleEl.textContent = DROPDOWN_STYLES;
    document.head.appendChild(styleEl);
  }

  /**
   * Adjunta event listeners al input y al documento
   */
  _attachListeners() {
    if (!this.searchInput) return;

    // Input con debounce
    this.searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();

      clearTimeout(this.debounceTimer);

      if (query.length < 2) {
        this.close();
        return;
      }

      this.debounceTimer = setTimeout(() => {
        this.search(query);
      }, 300);
    });

    // Focus: reabrir si hay resultados
    this.searchInput.addEventListener('focus', () => {
      const query = this.searchInput.value.trim();
      if (query.length >= 2 && this.flatResults.length > 0) {
        this._showDropdown();
      }
    });

    // Teclado: Escape cierra, Enter selecciona, flechas navegan
    this.searchInput.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          this.close();
          break;

        case 'Enter':
          e.preventDefault();
          if (this.highlightedIndex >= 0 && this.flatResults[this.highlightedIndex]) {
            const result = this.flatResults[this.highlightedIndex];
            this.navigateToResult(result.type, result.id);
          } else if (this.flatResults.length > 0) {
            // Seleccionar el primer resultado
            const first = this.flatResults[0];
            this.navigateToResult(first.type, first.id);
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          this._moveHighlight(1);
          break;

        case 'ArrowUp':
          e.preventDefault();
          this._moveHighlight(-1);
          break;
      }
    });

    // Click fuera cierra el dropdown
    document.addEventListener('click', (e) => {
      if (!this.isOpen) return;
      const searchBar = this.searchInput.closest('.muni-search-bar');
      if (searchBar && !searchBar.contains(e.target)) {
        this.close();
      }
    });
  }

  /**
   * Ejecuta la busqueda global llamando al searchService
   * @param {string} query - Texto de busqueda
   */
  async search(query) {
    if (!query || query.length < 2) {
      this.close();
      return;
    }

    // Mostrar estado de carga
    this._showLoading();

    try {
      const results = await searchService.search(query);
      this.currentResults = results;
      this.renderResults(results);
    } catch (error) {
      console.error('Error en busqueda global:', error);
      this._showError();
      showToast('Error al buscar. Intente nuevamente.', 'error');
    }
  }

  /**
   * Renderiza los resultados agrupados por tipo en el dropdown
   * @param {Object|Array} results - Resultados de la busqueda
   */
  renderResults(results) {
    if (!this.dropdown) return;

    // Normalizar resultados: pueden venir como objeto agrupado o como array
    const grouped = this._groupResults(results);

    // Aplanar resultados para navegacion con teclado
    this.flatResults = [];
    this.highlightedIndex = -1;

    // Verificar si hay resultados
    const totalCount = Object.values(grouped).reduce((sum, items) => sum + items.length, 0);

    if (totalCount === 0) {
      this.dropdown.innerHTML = `
        <div class="search-global-empty">
          <div class="search-global-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </div>
          <div class="search-global-empty-text">Sin resultados</div>
          <div class="search-global-empty-hint">Intente con otros terminos de busqueda</div>
        </div>
      `;
      this._showDropdown();
      return;
    }

    // Construir HTML de resultados agrupados
    let html = '';
    const typeOrder = ['organizations', 'users', 'news', 'documents'];

    for (const type of typeOrder) {
      const items = grouped[type];
      if (!items || items.length === 0) continue;

      html += `
        <div class="search-global-group">
          <div class="search-global-group-header">
            <span>${TYPE_LABELS[type] || type}</span>
            <span class="search-global-group-count">${items.length}</span>
          </div>
      `;

      for (const item of items) {
        const flatIndex = this.flatResults.length;
        this.flatResults.push({ type, id: item._id || item.id, data: item });

        const name = this._getItemName(type, item);
        const subtitle = this._getItemSubtitle(type, item);

        html += `
          <div class="search-global-item" data-index="${flatIndex}" data-type="${type}" data-id="${item._id || item.id}">
            <div class="search-global-item-icon type-${type}">
              ${TYPE_ICONS[type] || ''}
            </div>
            <div class="search-global-item-info">
              <div class="search-global-item-name">${this._escapeHtml(name)}</div>
              <div class="search-global-item-subtitle">${this._escapeHtml(subtitle)}</div>
            </div>
            <div class="search-global-item-action">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
        `;
      }

      html += '</div>';
    }

    this.dropdown.innerHTML = html;

    // Adjuntar listeners de click a cada resultado
    this.dropdown.querySelectorAll('.search-global-item').forEach(item => {
      item.addEventListener('click', () => {
        const type = item.dataset.type;
        const id = item.dataset.id;
        this.navigateToResult(type, id);
      });

      item.addEventListener('mouseenter', () => {
        this.highlightedIndex = parseInt(item.dataset.index, 10);
        this._updateHighlight();
      });
    });

    this._showDropdown();
  }

  /**
   * Cierra el dropdown de resultados
   */
  close() {
    if (this.dropdown) {
      this.dropdown.classList.remove('active');
    }
    this.isOpen = false;
    this.highlightedIndex = -1;
  }

  /**
   * Navega al resultado seleccionado segun su tipo
   * @param {string} type - Tipo de resultado (organizations, users, news, documents)
   * @param {string} id - ID del recurso
   */
  navigateToResult(type, id) {
    this.close();
    this.searchInput.value = '';

    switch (type) {
      case 'organizations':
        // Abrir modal de revision de la organizacion
        if (window.adminDashboard && typeof window.adminDashboard.openReviewModal === 'function') {
          window.adminDashboard.openReviewModal(id);
        } else {
          // Fallback: disparar evento personalizado
          window.dispatchEvent(new CustomEvent('navigate-to-organization', { detail: { id } }));
          showToast('Navegando a la organizacion...', 'info');
        }
        break;

      case 'users':
        // Mostrar usuario en UserManager o seccion de usuarios
        if (window.userManagerInstance && typeof window.userManagerInstance.showUser === 'function') {
          window.userManagerInstance.showUser(id);
        } else {
          window.dispatchEvent(new CustomEvent('navigate-to-user', { detail: { id } }));
          showToast('Navegando al perfil de usuario...', 'info');
        }
        break;

      case 'news':
        // Navegar a la pagina de noticias
        window.dispatchEvent(new CustomEvent('navigate-to-page', { detail: { page: 'noticias', id } }));
        // Intentar cambiar vista directamente
        const newsNav = document.querySelector('[data-page="noticias"]');
        if (newsNav) {
          newsNav.click();
        }
        break;

      case 'documents':
        // Navegar a la biblioteca de documentos
        window.dispatchEvent(new CustomEvent('navigate-to-page', { detail: { page: 'biblioteca', id } }));
        const biblioNav = document.querySelector('[data-page="biblioteca"]');
        if (biblioNav) {
          biblioNav.click();
        }
        break;

      default:
        console.warn('SearchGlobalManager: Tipo de resultado desconocido:', type);
    }
  }

  // ===================== Metodos internos =====================

  /**
   * Agrupa resultados por tipo
   * @param {Object|Array} results
   * @returns {Object} Resultados agrupados
   */
  _groupResults(results) {
    // Si ya vienen agrupados (objeto con claves de tipo)
    if (results && !Array.isArray(results) && typeof results === 'object') {
      return {
        organizations: results.organizations || [],
        users: results.users || [],
        news: results.news || [],
        documents: results.documents || []
      };
    }

    // Si viene como array plano, agrupar por campo type
    if (Array.isArray(results)) {
      const grouped = {
        organizations: [],
        users: [],
        news: [],
        documents: []
      };

      for (const item of results) {
        const itemType = item._type || item.type || 'organizations';
        if (grouped[itemType]) {
          grouped[itemType].push(item);
        }
      }

      return grouped;
    }

    return { organizations: [], users: [], news: [], documents: [] };
  }

  /**
   * Obtiene el nombre/titulo principal de un resultado
   */
  _getItemName(type, item) {
    switch (type) {
      case 'organizations':
        return item.organizationName || item.name || item.nombre || 'Sin nombre';
      case 'users':
        return [item.firstName, item.lastName].filter(Boolean).join(' ') || item.name || item.email || 'Sin nombre';
      case 'news':
        return item.title || item.titulo || 'Sin titulo';
      case 'documents':
        return item.title || item.name || item.nombre || 'Sin titulo';
      default:
        return item.name || item.title || 'Sin nombre';
    }
  }

  /**
   * Obtiene el subtitulo descriptivo de un resultado
   */
  _getItemSubtitle(type, item) {
    switch (type) {
      case 'organizations':
        return item.organizationType || item.type || item.status || '';
      case 'users':
        return item.role || item.email || '';
      case 'news':
        return item.category || item.categoria || item.date || '';
      case 'documents':
        return item.category || item.type || item.formato || '';
      default:
        return '';
    }
  }

  /**
   * Muestra el dropdown
   */
  _showDropdown() {
    if (this.dropdown) {
      this.dropdown.classList.add('active');
      this.isOpen = true;
    }
  }

  /**
   * Muestra estado de carga en el dropdown
   */
  _showLoading() {
    if (!this.dropdown) return;

    this.dropdown.innerHTML = `
      <div class="search-global-loading">
        <span class="search-global-loading-spinner"></span>
        Buscando...
      </div>
    `;
    this._showDropdown();
  }

  /**
   * Muestra estado de error en el dropdown
   */
  _showError() {
    if (!this.dropdown) return;

    this.dropdown.innerHTML = `
      <div class="search-global-empty">
        <div class="search-global-empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <div class="search-global-empty-text">Error en la busqueda</div>
        <div class="search-global-empty-hint">Intente nuevamente en unos segundos</div>
      </div>
    `;
    this._showDropdown();
  }

  /**
   * Mueve el resaltado con las flechas del teclado
   * @param {number} direction - 1 para abajo, -1 para arriba
   */
  _moveHighlight(direction) {
    if (this.flatResults.length === 0) return;

    this.highlightedIndex += direction;

    if (this.highlightedIndex < 0) {
      this.highlightedIndex = this.flatResults.length - 1;
    } else if (this.highlightedIndex >= this.flatResults.length) {
      this.highlightedIndex = 0;
    }

    this._updateHighlight();
  }

  /**
   * Actualiza el resaltado visual del item seleccionado
   */
  _updateHighlight() {
    if (!this.dropdown) return;

    this.dropdown.querySelectorAll('.search-global-item').forEach(item => {
      item.classList.remove('highlighted');
    });

    const highlighted = this.dropdown.querySelector(`.search-global-item[data-index="${this.highlightedIndex}"]`);
    if (highlighted) {
      highlighted.classList.add('highlighted');
      highlighted.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /**
   * Escapa HTML para prevenir XSS
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Instancia global
export let searchGlobalManager;

/**
 * Inicializa el SearchGlobalManager (no requiere contenedor, se adjunta al header)
 * @returns {SearchGlobalManager}
 */
export function initSearchGlobalManager() {
  searchGlobalManager = new SearchGlobalManager();
  searchGlobalManager.init();
  window.searchGlobalManagerInstance = searchGlobalManager;
  return searchGlobalManager;
}
