/**
 * NewsManager - Gestiona la página de Noticias
 */

import newsService from '../../services/NewsService.js';
import { sanitizeRichText, sanitizeText, escapeHtml } from '../../shared/utils/sanitize.js';

class NewsManager {
  constructor() {
    this.container = document.getElementById('page-noticias');
    this.listEl = document.getElementById('news-list');
    this.adminActions = document.getElementById('news-admin-actions');
    this.articleContainer = document.getElementById('page-article');
    this.articleContent = document.getElementById('article-content');
    this.news = [];
    this.currentCategory = 'TODAS';
    this.isAdmin = false;
    this.quill = null;
  }

  /**
   * Inicializar el manager
   */
  async init() {
    if (!this.container) return;

    // Verificar si el usuario es MUNICIPALIDAD
    const userData = localStorage.getItem('currentUser');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        this.isAdmin = user.role === 'MUNICIPALIDAD';
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }

    // Mostrar botón de crear si es admin
    if (this.isAdmin && this.adminActions) {
      this.adminActions.style.display = 'block';
    }

    this.setupEventListeners();
    await this.loadNews();
  }

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    // Filtros de categoría
    const filters = this.container.querySelectorAll('.news-filter-chip');
    filters.forEach(filter => {
      filter.addEventListener('click', () => {
        filters.forEach(f => f.classList.remove('active'));
        filter.classList.add('active');
        this.currentCategory = filter.dataset.category;
        this.loadNews();
      });
    });

    // Botón nueva noticia
    const btnNew = document.getElementById('btn-new-article');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.showArticleEditor());
    }

    // Botón volver de artículo
    const btnBack = document.getElementById('btn-back-to-news');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        window.appState?.navigateTo('noticias');
      });
    }
  }

  /**
   * Cargar noticias
   */
  async loadNews() {
    try {
      this.showLoading();

      const options = {
        category: this.currentCategory,
        includeUnpublished: this.isAdmin
      };

      const response = await newsService.getAll(options);
      this.news = response.news || response;
      this.renderNews();
    } catch (error) {
      console.error('Error al cargar noticias:', error);
      this.renderError('Error al cargar noticias. Por favor, intenta de nuevo.');
    }
  }

  /**
   * Renderizar noticias
   */
  renderNews() {
    if (!this.listEl) return;

    if (this.news.length === 0) {
      this.listEl.innerHTML = `
        <div class="news-empty">
          <div class="empty-icon">📰</div>
          <h3>No hay noticias</h3>
          <p>No se encontraron noticias en esta categoría</p>
        </div>
      `;
      return;
    }

    this.listEl.innerHTML = `
      <div class="news-grid">
        ${this.news.map(article => this.renderNewsCard(article)).join('')}
      </div>
    `;

    // Agregar event listeners a los cards
    this.listEl.querySelectorAll('.news-card').forEach(card => {
      card.addEventListener('click', () => {
        this.viewArticle(card.dataset.id);
      });

      const editBtn = card.querySelector('.btn-edit-news');
      const deleteBtn = card.querySelector('.btn-delete-news');

      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showArticleEditor(card.dataset.id);
        });
      }

      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.confirmDelete(card.dataset.id, card.dataset.title);
        });
      }
    });
  }

  /**
   * Renderizar tarjeta de noticia
   */
  renderNewsCard(article) {
    const categoryLabel = newsService.getCategoryLabel(article.category);
    const date = newsService.getRelativeTime(article.publishedAt || article.createdAt);
    const featuredImage = article.featuredImage || '';

    return `
      <div class="news-card ${!article.isPublished ? 'unpublished' : ''}" data-id="${article._id}" data-title="${article.title}">
        ${featuredImage ? `
          <div class="news-card-image">
            <img src="${featuredImage}" alt="${article.title}">
          </div>
        ` : `
          <div class="news-card-image no-image">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
        `}
        <div class="news-card-content">
          <div class="news-card-meta">
            <span class="meta-category">${categoryLabel}</span>
            <span class="meta-date">${date}</span>
            ${!article.isPublished ? '<span class="meta-unpublished">Borrador</span>' : ''}
          </div>
          <h3 class="news-card-title">${article.title}</h3>
          ${article.summary ? `<p class="news-card-summary">${article.summary}</p>` : ''}
        </div>
        ${this.isAdmin ? `
          <div class="news-card-actions">
            <button class="btn-edit-news" title="Editar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn-delete-news" title="Eliminar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Mostrar loading
   */
  showLoading() {
    if (!this.listEl) return;
    this.listEl.innerHTML = `
      <div class="news-loading">
        <div class="spinner"></div>
        <p>Cargando noticias...</p>
      </div>
    `;
  }

  /**
   * Renderizar error
   */
  renderError(message) {
    if (!this.listEl) return;
    this.listEl.innerHTML = `
      <div class="news-error">
        <div class="error-icon">!</div>
        <p>${message}</p>
        <button class="btn-secondary" onclick="newsManager.loadNews()">Reintentar</button>
      </div>
    `;
  }

  /**
   * Ver artículo completo
   */
  async viewArticle(id) {
    try {
      const article = await newsService.getById(id);

      if (!this.articleContent) return;

      const date = newsService.formatDate(article.publishedAt || article.createdAt);
      const categoryLabel = newsService.getCategoryLabel(article.category);

      // Sanitizar contenido para prevenir XSS
      const safeTitle = sanitizeText(article.title);
      const safeContentHTML = sanitizeRichText(article.contentHTML);
      const safeAuthorFirst = article.author ? sanitizeText(article.author.firstName) : '';
      const safeAuthorLast = article.author ? sanitizeText(article.author.lastName) : '';

      this.articleContent.innerHTML = `
        ${article.featuredImage ? `
          <div class="article-featured-image">
            <img src="${escapeHtml(article.featuredImage)}" alt="${safeTitle}">
          </div>
        ` : ''}
        <div class="article-header">
          <div class="article-meta">
            <span class="meta-category">${escapeHtml(categoryLabel)}</span>
            <span class="meta-date">${escapeHtml(date)}</span>
            ${article.viewCount ? `<span class="meta-views">${article.viewCount} vistas</span>` : ''}
          </div>
          <h1 class="article-title">${safeTitle}</h1>
          ${article.author ? `
            <div class="article-author">
              Por ${safeAuthorFirst} ${safeAuthorLast}
            </div>
          ` : ''}
        </div>
        <div class="article-body">
          ${safeContentHTML}
        </div>
        ${article.tags && article.tags.length > 0 ? `
          <div class="article-tags">
            ${article.tags.map(tag => `<span class="tag">#${sanitizeText(tag)}</span>`).join('')}
          </div>
        ` : ''}
      `;

      window.appState?.navigateTo('article');
    } catch (error) {
      console.error('Error al cargar artículo:', error);
      this.showToast('Error al cargar el artículo', 'error');
    }
  }

  /**
   * Mostrar editor de artículo
   */
  async showArticleEditor(id = null) {
    const article = id ? this.news.find(a => a._id === id) : null;

    const modal = document.createElement('div');
    modal.className = 'news-modal-overlay';
    modal.innerHTML = `
      <div class="news-modal news-modal-large">
        <div class="news-modal-header">
          <h2>${article ? 'Editar Noticia' : 'Nueva Noticia'}</h2>
          <button class="btn-close-modal">×</button>
        </div>
        <form id="article-form" class="news-modal-content">
          <div class="form-row">
            <div class="form-group flex-2">
              <label for="article-title">Título *</label>
              <input type="text" id="article-title" required value="${article?.title || ''}" placeholder="Título de la noticia">
            </div>
            <div class="form-group flex-1">
              <label for="article-category">Categoría</label>
              <select id="article-category">
                <option value="NOTICIAS" ${article?.category === 'NOTICIAS' ? 'selected' : ''}>Noticias</option>
                <option value="COMUNICADOS" ${article?.category === 'COMUNICADOS' ? 'selected' : ''}>Comunicados</option>
                <option value="EVENTOS" ${article?.category === 'EVENTOS' ? 'selected' : ''}>Eventos</option>
                <option value="CONVOCATORIAS" ${article?.category === 'CONVOCATORIAS' ? 'selected' : ''}>Convocatorias</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="article-summary">Resumen</label>
            <textarea id="article-summary" placeholder="Breve resumen de la noticia (opcional)">${article?.summary || ''}</textarea>
          </div>
          <div class="form-group">
            <label>Contenido *</label>
            <div id="article-quill-editor" class="quill-editor-container"></div>
          </div>
          <div class="form-group">
            <label for="article-image">Imagen destacada (URL)</label>
            <input type="url" id="article-image" value="${article?.featuredImage || ''}" placeholder="https://...">
          </div>
          <div class="form-group">
            <label for="article-tags">Etiquetas (separadas por coma)</label>
            <input type="text" id="article-tags" value="${article?.tags?.join(', ') || ''}" placeholder="noticia, importante, comunidad">
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" id="article-published" ${article?.isPublished ? 'checked' : ''}>
              Publicar inmediatamente
            </label>
          </div>
          <div class="news-modal-actions">
            <button type="button" class="btn-secondary btn-cancel-article">Cancelar</button>
            <button type="submit" class="btn-primary">${article ? 'Guardar Cambios' : 'Crear Noticia'}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Inicializar Quill
    if (window.Quill) {
      this.quill = new Quill('#article-quill-editor', {
        theme: 'snow',
        placeholder: 'Escribe el contenido de la noticia...',
        modules: {
          toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'indent': '-1' }, { 'indent': '+1' }],
            ['link', 'image'],
            [{ 'align': [] }],
            ['clean']
          ]
        }
      });

      if (article?.contentHTML) {
        this.quill.root.innerHTML = article.contentHTML;
      }
    }

    // Event listeners del modal
    const closeBtn = modal.querySelector('.btn-close-modal');
    const cancelBtn = modal.querySelector('.btn-cancel-article');
    const form = modal.querySelector('#article-form');

    const closeModal = () => {
      modal.remove();
      this.quill = null;
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Enviar formulario
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Guardando...';

      try {
        const tagsInput = document.getElementById('article-tags').value;
        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

        const data = {
          title: document.getElementById('article-title').value,
          summary: document.getElementById('article-summary').value,
          contentHTML: this.quill?.root.innerHTML || '',
          category: document.getElementById('article-category').value,
          featuredImage: document.getElementById('article-image').value,
          tags: tags,
          isPublished: document.getElementById('article-published').checked
        };

        if (article) {
          await newsService.update(article._id, data);
          this.showToast('Noticia actualizada correctamente', 'success');
        } else {
          await newsService.create(data);
          this.showToast('Noticia creada correctamente', 'success');
        }

        closeModal();
        this.loadNews();
      } catch (error) {
        console.error('Error al guardar noticia:', error);
        this.showToast('Error al guardar noticia', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = article ? 'Guardar Cambios' : 'Crear Noticia';
      }
    });
  }

  /**
   * Confirmar eliminación
   */
  confirmDelete(id, title) {
    if (confirm(`¿Estás seguro de que deseas eliminar "${title}"?\n\nEsta acción no se puede deshacer.`)) {
      this.deleteArticle(id);
    }
  }

  /**
   * Eliminar artículo
   */
  async deleteArticle(id) {
    try {
      await newsService.delete(id);
      this.showToast('Noticia eliminada correctamente', 'success');
      this.loadNews();
    } catch (error) {
      console.error('Error al eliminar noticia:', error);
      this.showToast('Error al eliminar noticia', 'error');
    }
  }

  /**
   * Mostrar toast
   */
  showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      alert(message);
    }
  }
}

// Exportar instancia global
const newsManager = new NewsManager();
window.newsManager = newsManager;

export default newsManager;
