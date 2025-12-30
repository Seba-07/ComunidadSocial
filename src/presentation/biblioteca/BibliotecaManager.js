/**
 * BibliotecaManager - Gestiona la página de Biblioteca de Documentos
 */

import libraryDocumentService from '../../services/LibraryDocumentService.js';

class BibliotecaManager {
  constructor() {
    this.container = document.getElementById('page-biblioteca');
    this.listEl = document.getElementById('biblioteca-list');
    this.adminActions = document.getElementById('biblioteca-admin-actions');
    this.documents = [];
    this.currentCategory = 'TODOS';
    this.isAdmin = false;
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

    // Mostrar botón de subir si es admin
    if (this.isAdmin && this.adminActions) {
      this.adminActions.style.display = 'block';
    }

    this.setupEventListeners();
    await this.loadDocuments();
  }

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    // Filtros de categoría
    const filters = this.container.querySelectorAll('.biblioteca-filter-chip');
    filters.forEach(filter => {
      filter.addEventListener('click', () => {
        filters.forEach(f => f.classList.remove('active'));
        filter.classList.add('active');
        this.currentCategory = filter.dataset.category;
        this.loadDocuments();
      });
    });

    // Botón subir documento
    const btnUpload = document.getElementById('btn-upload-document');
    if (btnUpload) {
      btnUpload.addEventListener('click', () => this.showUploadModal());
    }
  }

  /**
   * Cargar documentos
   */
  async loadDocuments() {
    try {
      this.showLoading();

      const options = {
        category: this.currentCategory,
        includeUnpublished: this.isAdmin
      };

      this.documents = await libraryDocumentService.getAll(options);
      this.renderDocuments();
    } catch (error) {
      console.error('Error al cargar documentos:', error);
      this.renderError('Error al cargar documentos. Por favor, intenta de nuevo.');
    }
  }

  /**
   * Renderizar documentos
   */
  renderDocuments() {
    if (!this.listEl) return;

    if (this.documents.length === 0) {
      this.listEl.innerHTML = `
        <div class="biblioteca-empty">
          <div class="empty-icon">📂</div>
          <h3>No hay documentos</h3>
          <p>No se encontraron documentos en esta categoría</p>
        </div>
      `;
      return;
    }

    this.listEl.innerHTML = `
      <div class="biblioteca-grid">
        ${this.documents.map(doc => this.renderDocumentCard(doc)).join('')}
      </div>
    `;

    // Agregar event listeners a los cards
    this.listEl.querySelectorAll('.biblioteca-card').forEach(card => {
      const downloadBtn = card.querySelector('.btn-download');
      const externalBtn = card.querySelector('.btn-external-link');
      const deleteBtn = card.querySelector('.btn-delete-doc');
      const editBtn = card.querySelector('.btn-edit-doc');

      if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.downloadDocument(card.dataset.id);
        });
      }

      if (externalBtn) {
        externalBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const url = externalBtn.dataset.url;
          if (url) {
            window.open(url, '_blank');
          }
        });
      }

      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.confirmDelete(card.dataset.id, card.dataset.name);
        });
      }

      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showEditModal(card.dataset.id);
        });
      }
    });
  }

  /**
   * Renderizar tarjeta de documento
   */
  renderDocumentCard(doc) {
    const categoryLabel = libraryDocumentService.getCategoryLabel(doc.category);
    const fileIcon = doc.isPlaceholder ? this.getPlaceholderIcon(doc.category) : libraryDocumentService.getFileIcon(doc.mimeType);
    const fileSize = doc.fileSize ? libraryDocumentService.formatFileSize(doc.fileSize) : '';
    const date = new Date(doc.createdAt).toLocaleDateString('es-CL');
    const isExternal = !!doc.externalUrl;
    const isPlaceholder = doc.isPlaceholder && !doc.externalUrl;

    // Determinar el texto del botón de acción
    let actionButton = '';
    if (isExternal) {
      actionButton = `
        <button class="btn-external-link" title="Abrir enlace externo" data-url="${doc.externalUrl}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
      `;
    } else if (!isPlaceholder && doc.filePath) {
      actionButton = `
        <button class="btn-download" title="Descargar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
      `;
    }

    return `
      <div class="biblioteca-card ${!doc.isPublished ? 'unpublished' : ''} ${isPlaceholder ? 'placeholder' : ''}" data-id="${doc._id}" data-name="${doc.name}" data-external="${isExternal}">
        <div class="biblioteca-card-icon">
          ${fileIcon}
        </div>
        <div class="biblioteca-card-content">
          <h3 class="biblioteca-card-title">${doc.name}</h3>
          ${doc.description ? `<p class="biblioteca-card-desc">${doc.description}</p>` : ''}
          <div class="biblioteca-card-meta">
            <span class="meta-category">${categoryLabel}</span>
            ${fileSize ? `<span class="meta-size">${fileSize}</span>` : ''}
            <span class="meta-date">${date}</span>
            ${isPlaceholder ? '<span class="meta-placeholder">Próximamente</span>' : ''}
            ${isExternal ? '<span class="meta-external">Enlace externo</span>' : ''}
            ${!doc.isPublished ? '<span class="meta-unpublished">No publicado</span>' : ''}
          </div>
        </div>
        <div class="biblioteca-card-actions">
          ${actionButton}
          ${this.isAdmin ? `
            <button class="btn-edit-doc" title="Editar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn-delete-doc" title="Eliminar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Obtener icono para documento placeholder
   */
  getPlaceholderIcon(category) {
    const icons = {
      'FORMULARIOS': '📋',
      'LEYES': '⚖️',
      'GUIAS': '📖',
      'PLANTILLAS': '📝',
      'OTROS': '📄'
    };
    return `<span class="placeholder-icon">${icons[category] || '📄'}</span>`;
  }

  /**
   * Mostrar loading
   */
  showLoading() {
    if (!this.listEl) return;
    this.listEl.innerHTML = `
      <div class="biblioteca-loading">
        <div class="spinner"></div>
        <p>Cargando documentos...</p>
      </div>
    `;
  }

  /**
   * Renderizar error
   */
  renderError(message) {
    if (!this.listEl) return;
    this.listEl.innerHTML = `
      <div class="biblioteca-error">
        <div class="error-icon">!</div>
        <p>${message}</p>
        <button class="btn-secondary" onclick="bibliotecaManager.loadDocuments()">Reintentar</button>
      </div>
    `;
  }

  /**
   * Descargar documento
   */
  downloadDocument(id) {
    const url = libraryDocumentService.getDownloadUrl(id);
    window.open(url, '_blank');
  }

  /**
   * Mostrar modal de subida
   */
  showUploadModal() {
    const modal = document.createElement('div');
    modal.className = 'biblioteca-modal-overlay';
    modal.innerHTML = `
      <div class="biblioteca-modal">
        <div class="biblioteca-modal-header">
          <h2>Subir Documento</h2>
          <button class="btn-close-modal">×</button>
        </div>
        <form id="upload-form" class="biblioteca-modal-content">
          <div class="form-group">
            <label for="doc-name">Nombre del documento *</label>
            <input type="text" id="doc-name" required placeholder="Ej: Formulario de inscripción">
          </div>
          <div class="form-group">
            <label for="doc-description">Descripción</label>
            <textarea id="doc-description" placeholder="Descripción opcional del documento"></textarea>
          </div>
          <div class="form-group">
            <label for="doc-category">Categoría</label>
            <select id="doc-category">
              <option value="FORMULARIOS">Formularios</option>
              <option value="LEYES">Leyes y Normativas</option>
              <option value="GUIAS">Guías y Manuales</option>
              <option value="PLANTILLAS">Plantillas</option>
              <option value="OTROS">Otros</option>
            </select>
          </div>
          <div class="form-group">
            <label for="doc-file">Archivo *</label>
            <div class="file-upload-area" id="file-upload-area">
              <input type="file" id="doc-file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif">
              <div class="file-upload-placeholder">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <p>Arrastra un archivo o haz clic para seleccionar</p>
                <span class="file-types">PDF, Word, Excel o imágenes (máx. 20MB)</span>
              </div>
              <div class="file-selected" style="display: none;">
                <span class="file-name"></span>
                <button type="button" class="btn-remove-file">×</button>
              </div>
            </div>
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" id="doc-published" checked>
              Publicar inmediatamente
            </label>
          </div>
          <div class="biblioteca-modal-actions">
            <button type="button" class="btn-secondary btn-cancel-upload">Cancelar</button>
            <button type="submit" class="btn-primary">Subir Documento</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners del modal
    const closeBtn = modal.querySelector('.btn-close-modal');
    const cancelBtn = modal.querySelector('.btn-cancel-upload');
    const form = modal.querySelector('#upload-form');
    const fileInput = modal.querySelector('#doc-file');
    const uploadArea = modal.querySelector('#file-upload-area');
    const placeholder = modal.querySelector('.file-upload-placeholder');
    const fileSelected = modal.querySelector('.file-selected');
    const fileName = modal.querySelector('.file-name');
    const removeFileBtn = modal.querySelector('.btn-remove-file');

    const closeModal = () => modal.remove();

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        updateFileDisplay(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        updateFileDisplay(fileInput.files[0]);
      }
    });

    removeFileBtn.addEventListener('click', () => {
      fileInput.value = '';
      placeholder.style.display = 'flex';
      fileSelected.style.display = 'none';
    });

    function updateFileDisplay(file) {
      fileName.textContent = file.name;
      placeholder.style.display = 'none';
      fileSelected.style.display = 'flex';
    }

    // Enviar formulario
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Subiendo...';

      try {
        const file = fileInput.files[0];
        const data = {
          name: document.getElementById('doc-name').value,
          description: document.getElementById('doc-description').value,
          category: document.getElementById('doc-category').value,
          isPublished: document.getElementById('doc-published').checked
        };

        await libraryDocumentService.upload(file, data);
        closeModal();
        this.showToast('Documento subido correctamente', 'success');
        this.loadDocuments();
      } catch (error) {
        console.error('Error al subir documento:', error);
        this.showToast('Error al subir documento: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Subir Documento';
      }
    });
  }

  /**
   * Mostrar modal de edición
   */
  async showEditModal(id) {
    const doc = this.documents.find(d => d._id === id);
    if (!doc) return;

    const modal = document.createElement('div');
    modal.className = 'biblioteca-modal-overlay';
    modal.innerHTML = `
      <div class="biblioteca-modal">
        <div class="biblioteca-modal-header">
          <h2>Editar Documento</h2>
          <button class="btn-close-modal">×</button>
        </div>
        <form id="edit-form" class="biblioteca-modal-content">
          <div class="form-group">
            <label for="edit-name">Nombre del documento *</label>
            <input type="text" id="edit-name" required value="${doc.name}">
          </div>
          <div class="form-group">
            <label for="edit-description">Descripción</label>
            <textarea id="edit-description">${doc.description || ''}</textarea>
          </div>
          <div class="form-group">
            <label for="edit-category">Categoría</label>
            <select id="edit-category">
              <option value="FORMULARIOS" ${doc.category === 'FORMULARIOS' ? 'selected' : ''}>Formularios</option>
              <option value="LEYES" ${doc.category === 'LEYES' ? 'selected' : ''}>Leyes y Normativas</option>
              <option value="GUIAS" ${doc.category === 'GUIAS' ? 'selected' : ''}>Guías y Manuales</option>
              <option value="PLANTILLAS" ${doc.category === 'PLANTILLAS' ? 'selected' : ''}>Plantillas</option>
              <option value="OTROS" ${doc.category === 'OTROS' ? 'selected' : ''}>Otros</option>
            </select>
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" id="edit-published" ${doc.isPublished ? 'checked' : ''}>
              Publicado
            </label>
          </div>
          <div class="biblioteca-modal-actions">
            <button type="button" class="btn-secondary btn-cancel-edit">Cancelar</button>
            <button type="submit" class="btn-primary">Guardar Cambios</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.btn-close-modal');
    const cancelBtn = modal.querySelector('.btn-cancel-edit');
    const form = modal.querySelector('#edit-form');

    const closeModal = () => modal.remove();

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Guardando...';

      try {
        const data = {
          name: document.getElementById('edit-name').value,
          description: document.getElementById('edit-description').value,
          category: document.getElementById('edit-category').value,
          isPublished: document.getElementById('edit-published').checked
        };

        await libraryDocumentService.update(id, data);
        closeModal();
        this.showToast('Documento actualizado correctamente', 'success');
        this.loadDocuments();
      } catch (error) {
        console.error('Error al actualizar documento:', error);
        this.showToast('Error al actualizar documento', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar Cambios';
      }
    });
  }

  /**
   * Confirmar eliminación
   */
  confirmDelete(id, name) {
    if (confirm(`¿Estás seguro de que deseas eliminar "${name}"?\n\nEsta acción no se puede deshacer.`)) {
      this.deleteDocument(id);
    }
  }

  /**
   * Eliminar documento
   */
  async deleteDocument(id) {
    try {
      await libraryDocumentService.delete(id);
      this.showToast('Documento eliminado correctamente', 'success');
      this.loadDocuments();
    } catch (error) {
      console.error('Error al eliminar documento:', error);
      this.showToast('Error al eliminar documento', 'error');
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
const bibliotecaManager = new BibliotecaManager();
window.bibliotecaManager = bibliotecaManager;

export default bibliotecaManager;
