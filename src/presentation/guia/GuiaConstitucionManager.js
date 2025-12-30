/**
 * GuiaConstitucionManager - Gestiona la página de Guía de Constitución
 */

import guiaConstitucionService from '../../services/GuiaConstitucionService.js';

class GuiaConstitucionManager {
  constructor() {
    this.container = document.getElementById('page-guia-constitucion');
    this.contentEl = document.getElementById('guia-content');
    this.editorContainer = document.getElementById('guia-editor-container');
    this.editorEl = document.getElementById('guia-editor');
    this.quillEditorEl = document.getElementById('guia-quill-editor');
    this.quill = null;
    this.currentContent = '';
    this.isEditing = false;
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

    // Mostrar botón de edición si es admin
    if (this.isAdmin && this.editorContainer) {
      this.editorContainer.style.display = 'block';
    }

    this.setupEventListeners();
    await this.loadGuia();
  }

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    const btnEdit = document.getElementById('btn-edit-guia');
    const btnCancel = document.getElementById('btn-cancel-guia');
    const btnSave = document.getElementById('btn-save-guia');

    if (btnEdit) {
      btnEdit.addEventListener('click', () => this.startEditing());
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', () => this.cancelEditing());
    }

    if (btnSave) {
      btnSave.addEventListener('click', () => this.saveGuia());
    }
  }

  /**
   * Cargar la guía de constitución
   */
  async loadGuia() {
    try {
      this.showLoading();
      const guia = await guiaConstitucionService.get();
      this.currentContent = guia.contentHTML || '';
      this.renderContent(this.currentContent);
    } catch (error) {
      console.error('Error al cargar guía:', error);
      this.renderError('Error al cargar la guía. Por favor, intenta de nuevo.');
    }
  }

  /**
   * Renderizar el contenido
   */
  renderContent(html) {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = `
      <div class="guia-content-inner">
        ${html}
      </div>
    `;
  }

  /**
   * Mostrar loading
   */
  showLoading() {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = `
      <div class="guia-loading">
        <div class="spinner"></div>
        <p>Cargando guía...</p>
      </div>
    `;
  }

  /**
   * Renderizar error
   */
  renderError(message) {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = `
      <div class="guia-error">
        <div class="error-icon">!</div>
        <p>${message}</p>
        <button class="btn-secondary" onclick="guiaConstitucionManager.loadGuia()">Reintentar</button>
      </div>
    `;
  }

  /**
   * Iniciar modo de edición
   */
  startEditing() {
    if (!this.isAdmin) return;

    this.isEditing = true;
    this.editorEl.style.display = 'block';
    this.contentEl.style.display = 'none';
    document.getElementById('btn-edit-guia').style.display = 'none';

    // Inicializar Quill si no existe
    if (!this.quill && window.Quill) {
      this.quill = new Quill('#guia-quill-editor', {
        theme: 'snow',
        placeholder: 'Escribe aquí el contenido de la guía...',
        modules: {
          toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'indent': '-1' }, { 'indent': '+1' }],
            ['link'],
            ['clean']
          ]
        }
      });
    }

    // Cargar contenido actual en el editor usando el método correcto de Quill
    if (this.quill && this.currentContent) {
      // Limpiar el editor primero
      this.quill.setContents([]);
      // Usar dangerouslyPasteHTML para cargar HTML correctamente
      this.quill.clipboard.dangerouslyPasteHTML(0, this.currentContent);
    }
  }

  /**
   * Cancelar edición
   */
  cancelEditing() {
    this.isEditing = false;
    this.editorEl.style.display = 'none';
    this.contentEl.style.display = 'block';
    document.getElementById('btn-edit-guia').style.display = 'flex';
  }

  /**
   * Guardar la guía
   */
  async saveGuia() {
    if (!this.quill) return;

    const newContent = this.quill.root.innerHTML;

    try {
      const btnSave = document.getElementById('btn-save-guia');
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'Guardando...';
      }

      await guiaConstitucionService.update(newContent);

      this.currentContent = newContent;
      this.renderContent(newContent);
      this.cancelEditing();

      // Mostrar mensaje de éxito
      this.showToast('Guía actualizada correctamente', 'success');
    } catch (error) {
      console.error('Error al guardar guía:', error);
      this.showToast('Error al guardar la guía', 'error');
    } finally {
      const btnSave = document.getElementById('btn-save-guia');
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = 'Guardar Cambios';
      }
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
const guiaConstitucionManager = new GuiaConstitucionManager();
window.guiaConstitucionManager = guiaConstitucionManager;

export default guiaConstitucionManager;
