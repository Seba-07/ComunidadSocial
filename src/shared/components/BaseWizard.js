/**
 * BaseWizard
 * Clase base para crear wizards (asistentes paso a paso)
 * Proporciona:
 * - Manejo de pasos
 * - Persistencia de estado en IndexedDB
 * - Validación por paso
 * - Navegación (siguiente, anterior)
 * - Modal de recuperación de sesión
 *
 * @example
 * class MyWizard extends BaseWizard {
 *   getSteps() {
 *     return [
 *       { id: 'step1', title: 'Paso 1', validate: () => true },
 *       { id: 'step2', title: 'Paso 2', validate: () => this.state.data.name }
 *     ];
 *   }
 *
 *   renderStep(step) {
 *     return `<div>Contenido del paso ${step.id}</div>`;
 *   }
 * }
 */

import { StateManager } from '../state/StateManager.js';
import { indexedDBService } from '../../infrastructure/database/IndexedDBService.js';

export class BaseWizard extends StateManager {
  /**
   * @param {Object} options - Opciones del wizard
   * @param {string} options.id - ID único del wizard (para persistencia)
   * @param {HTMLElement} options.container - Contenedor donde renderizar
   * @param {Object} options.initialData - Datos iniciales
   * @param {Object} options.callbacks - Callbacks (onComplete, onCancel, onStepChange)
   */
  constructor(options = {}) {
    super(
      {
        currentStep: 0,
        data: options.initialData || {},
        errors: {},
        isLoading: false
      },
      {
        persistKey: options.id,
        autoPersist: true
      }
    );

    this.id = options.id;
    this.container = options.container;
    this.callbacks = options.callbacks || {};
    this._steps = null;
  }

  /**
   * Debe ser implementado por subclases
   * @returns {Array} Array de objetos step { id, title, description?, validate? }
   */
  getSteps() {
    throw new Error('getSteps() must be implemented by subclass');
  }

  /**
   * Debe ser implementado por subclases
   * @param {Object} step - Paso actual
   * @returns {string} HTML del contenido del paso
   */
  renderStepContent(step) {
    throw new Error('renderStepContent() must be implemented by subclass');
  }

  /**
   * Obtiene los pasos (con cache)
   */
  get steps() {
    if (!this._steps) {
      this._steps = this.getSteps();
    }
    return this._steps;
  }

  /**
   * Obtiene el paso actual
   */
  get currentStepConfig() {
    return this.steps[this.state.currentStep];
  }

  /**
   * Inicializa el wizard
   */
  async init() {
    // Verificar si hay sesión guardada
    const hasRestoredState = await this.restoreState();

    if (hasRestoredState && this.state.currentStep > 0) {
      const shouldContinue = await this.showRecoveryModal();
      if (!shouldContinue) {
        this.reset({ currentStep: 0, data: {}, errors: {} });
        await this.clearPersistedState();
      }
    }

    this.render();
    this.setupEventListeners();
  }

  /**
   * Renderiza el wizard completo
   */
  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="wizard-wrapper" data-wizard-id="${this.id}">
        ${this.renderHeader()}
        ${this.renderProgressBar()}
        <div class="wizard-content">
          ${this.renderStepContent(this.currentStepConfig)}
        </div>
        ${this.renderFooter()}
      </div>
    `;

    this.setupStepListeners();
  }

  /**
   * Renderiza el header del wizard
   */
  renderHeader() {
    const step = this.currentStepConfig;
    return `
      <div class="wizard-header">
        <h2 class="wizard-title">${step.title || `Paso ${this.state.currentStep + 1}`}</h2>
        ${step.description ? `<p class="wizard-description">${step.description}</p>` : ''}
        <button type="button" class="wizard-close-btn" data-action="close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  }

  /**
   * Renderiza la barra de progreso
   */
  renderProgressBar() {
    const progress = ((this.state.currentStep) / (this.steps.length - 1)) * 100;

    return `
      <div class="wizard-progress">
        <div class="wizard-progress-bar" style="width: ${progress}%"></div>
        <div class="wizard-steps-indicator">
          ${this.steps.map((step, index) => `
            <div class="wizard-step-dot ${index <= this.state.currentStep ? 'active' : ''} ${index === this.state.currentStep ? 'current' : ''}"
                 title="${step.title}">
              ${index + 1}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Renderiza el footer con botones de navegación
   */
  renderFooter() {
    const isFirstStep = this.state.currentStep === 0;
    const isLastStep = this.state.currentStep === this.steps.length - 1;

    return `
      <div class="wizard-footer">
        <button type="button"
                class="wizard-btn wizard-btn-secondary"
                data-action="prev"
                ${isFirstStep ? 'disabled' : ''}>
          Anterior
        </button>
        <span class="wizard-step-counter">
          Paso ${this.state.currentStep + 1} de ${this.steps.length}
        </span>
        <button type="button"
                class="wizard-btn wizard-btn-primary"
                data-action="${isLastStep ? 'submit' : 'next'}">
          ${isLastStep ? 'Finalizar' : 'Siguiente'}
        </button>
      </div>
    `;
  }

  /**
   * Configura los event listeners principales
   */
  setupEventListeners() {
    this.container.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      switch (action) {
        case 'prev':
          this.prevStep();
          break;
        case 'next':
          this.nextStep();
          break;
        case 'submit':
          this.submit();
          break;
        case 'close':
          this.close();
          break;
      }
    });
  }

  /**
   * Configura listeners específicos del paso actual
   * Puede ser sobrescrito por subclases
   */
  setupStepListeners() {
    // Implementar en subclases si es necesario
  }

  /**
   * Avanza al siguiente paso
   */
  async nextStep() {
    // Guardar datos del paso actual
    this.saveStepData();

    // Validar paso actual
    const step = this.currentStepConfig;
    if (step.validate && !step.validate(this.state.data)) {
      this.showError('Por favor completa todos los campos requeridos');
      return;
    }

    if (this.state.currentStep < this.steps.length - 1) {
      this.setState({ currentStep: this.state.currentStep + 1 });
      this.render();

      if (this.callbacks.onStepChange) {
        this.callbacks.onStepChange(this.state.currentStep, this.state.data);
      }
    }
  }

  /**
   * Retrocede al paso anterior
   */
  async prevStep() {
    this.saveStepData();

    if (this.state.currentStep > 0) {
      this.setState({ currentStep: this.state.currentStep - 1 });
      this.render();

      if (this.callbacks.onStepChange) {
        this.callbacks.onStepChange(this.state.currentStep, this.state.data);
      }
    }
  }

  /**
   * Guarda los datos del paso actual
   * Debe ser sobrescrito por subclases
   */
  saveStepData() {
    // Implementar en subclases
  }

  /**
   * Envía el wizard (último paso)
   */
  async submit() {
    this.saveStepData();

    // Validar último paso
    const step = this.currentStepConfig;
    if (step.validate && !step.validate(this.state.data)) {
      this.showError('Por favor completa todos los campos requeridos');
      return;
    }

    // Limpiar estado persistido
    await this.clearPersistedState();

    // Llamar callback
    if (this.callbacks.onComplete) {
      this.callbacks.onComplete(this.state.data);
    }
  }

  /**
   * Cierra el wizard
   */
  async close() {
    await this.persistState();

    const confirmClose = confirm(
      '¿Estás seguro de que deseas cerrar?\n\nTu progreso ha sido guardado y podrás continuar después.'
    );

    if (confirmClose) {
      if (this.callbacks.onCancel) {
        this.callbacks.onCancel();
      }
      this.destroy();
    }
  }

  /**
   * Muestra el modal de recuperación de sesión
   * @returns {Promise<boolean>} True si el usuario quiere continuar
   */
  showRecoveryModal() {
    return new Promise((resolve) => {
      const stepTitle = this.steps[this.state.currentStep]?.title || `Paso ${this.state.currentStep + 1}`;

      const modal = document.createElement('div');
      modal.className = 'wizard-recovery-modal';
      modal.innerHTML = `
        <div class="wizard-recovery-content">
          <div class="wizard-recovery-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
            </svg>
          </div>
          <h3>Sesión Anterior Encontrada</h3>
          <p>Se encontró progreso guardado en <strong>${stepTitle}</strong>.</p>
          <p>¿Deseas continuar donde lo dejaste?</p>
          <div class="wizard-recovery-actions">
            <button type="button" class="wizard-btn wizard-btn-secondary" data-recovery="no">
              Empezar de Nuevo
            </button>
            <button type="button" class="wizard-btn wizard-btn-primary" data-recovery="yes">
              Continuar
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector('[data-recovery="yes"]').addEventListener('click', () => {
        modal.remove();
        resolve(true);
      });

      modal.querySelector('[data-recovery="no"]').addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });
    });
  }

  /**
   * Muestra un mensaje de error
   */
  showError(message) {
    // Toast simple
    const toast = document.createElement('div');
    toast.className = 'wizard-toast wizard-toast-error';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  /**
   * Muestra un mensaje de éxito
   */
  showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'wizard-toast wizard-toast-success';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  /**
   * Destruye el wizard y limpia recursos
   */
  destroy() {
    super.destroy();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

/**
 * CSS base para wizards (inyectado automáticamente)
 */
const WIZARD_STYLES = `
  .wizard-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .wizard-header {
    padding: 24px;
    border-bottom: 1px solid #e5e7eb;
    position: relative;
  }

  .wizard-title {
    margin: 0 0 8px;
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
  }

  .wizard-description {
    margin: 0;
    color: #6b7280;
  }

  .wizard-close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    color: #6b7280;
  }

  .wizard-close-btn:hover {
    background: #f3f4f6;
    color: #1f2937;
  }

  .wizard-progress {
    padding: 16px 24px;
    background: #f9fafb;
    position: relative;
  }

  .wizard-progress-bar {
    height: 4px;
    background: linear-gradient(90deg, #10b981, #059669);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .wizard-steps-indicator {
    display: flex;
    justify-content: space-between;
    margin-top: 12px;
  }

  .wizard-step-dot {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #e5e7eb;
    color: #6b7280;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.3s ease;
  }

  .wizard-step-dot.active {
    background: #10b981;
    color: white;
  }

  .wizard-step-dot.current {
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
  }

  .wizard-content {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
  }

  .wizard-footer {
    padding: 16px 24px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .wizard-step-counter {
    color: #6b7280;
    font-size: 14px;
  }

  .wizard-btn {
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .wizard-btn-primary {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
  }

  .wizard-btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .wizard-btn-secondary {
    background: white;
    color: #374151;
    border: 2px solid #e5e7eb;
  }

  .wizard-btn-secondary:hover {
    border-color: #d1d5db;
    background: #f9fafb;
  }

  .wizard-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .wizard-recovery-modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .wizard-recovery-content {
    background: white;
    padding: 32px;
    border-radius: 16px;
    max-width: 400px;
    text-align: center;
  }

  .wizard-recovery-icon {
    color: #f59e0b;
    margin-bottom: 16px;
  }

  .wizard-recovery-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }

  .wizard-recovery-actions .wizard-btn {
    flex: 1;
  }

  .wizard-toast {
    position: fixed;
    top: 24px;
    right: 24px;
    padding: 16px 24px;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    z-index: 1100;
    animation: slideIn 0.3s ease;
  }

  .wizard-toast-error {
    background: #ef4444;
  }

  .wizard-toast-success {
    background: #10b981;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;

// Inyectar estilos si no existen
if (typeof document !== 'undefined' && !document.getElementById('wizard-base-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'wizard-base-styles';
  styleEl.textContent = WIZARD_STYLES;
  document.head.appendChild(styleEl);
}

export default BaseWizard;
