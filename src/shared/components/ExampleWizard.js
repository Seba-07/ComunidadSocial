/**
 * ExampleWizard
 * Ejemplo de cómo extender BaseWizard para crear un wizard específico
 *
 * Este archivo sirve como referencia para refactorizar:
 * - ValidationWizard.js
 * - WizardController.js
 * - Otros wizards del sistema
 *
 * @example
 * // Uso básico
 * const wizard = new ExampleWizard({
 *   container: document.getElementById('wizard-container'),
 *   initialData: { organizationName: 'Mi Org' },
 *   callbacks: {
 *     onComplete: (data) => console.log('Completado:', data),
 *     onCancel: () => console.log('Cancelado')
 *   }
 * });
 * await wizard.init();
 */

import { BaseWizard } from './BaseWizard.js';
import { apiService } from '../../services/ApiService.js';

export class ExampleWizard extends BaseWizard {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Contenedor DOM
   * @param {Object} options.initialData - Datos iniciales
   * @param {Object} options.callbacks - Callbacks del wizard
   */
  constructor(options = {}) {
    super({
      id: 'example-wizard', // ID único para persistencia
      container: options.container,
      initialData: options.initialData || {},
      callbacks: options.callbacks || {}
    });

    // Estado adicional específico de este wizard
    this.apiData = null;
  }

  /**
   * Define los pasos del wizard
   * Cada paso tiene: id, title, description (opcional), validate (opcional)
   */
  getSteps() {
    return [
      {
        id: 'info-basica',
        title: 'Información Básica',
        description: 'Ingrese los datos principales',
        validate: (data) => {
          return data.nombre && data.nombre.length >= 3;
        }
      },
      {
        id: 'contacto',
        title: 'Datos de Contacto',
        description: 'Información de contacto',
        validate: (data) => {
          return data.email && data.email.includes('@');
        }
      },
      {
        id: 'confirmacion',
        title: 'Confirmación',
        description: 'Revise y confirme los datos'
        // Sin validación - siempre válido
      }
    ];
  }

  /**
   * Renderiza el contenido de cada paso
   * @param {Object} step - Configuración del paso actual
   */
  renderStepContent(step) {
    const { data } = this.state;

    switch (step.id) {
      case 'info-basica':
        return this.renderInfoBasica(data);

      case 'contacto':
        return this.renderContacto(data);

      case 'confirmacion':
        return this.renderConfirmacion(data);

      default:
        return '<p>Paso no encontrado</p>';
    }
  }

  /**
   * Renderiza el paso de información básica
   */
  renderInfoBasica(data) {
    return `
      <div class="wizard-step-content">
        <div class="form-group">
          <label for="nombre">Nombre *</label>
          <input
            type="text"
            id="nombre"
            name="nombre"
            value="${data.nombre || ''}"
            placeholder="Ingrese el nombre"
            class="form-input"
            required
          />
          <small class="form-hint">Mínimo 3 caracteres</small>
        </div>

        <div class="form-group">
          <label for="descripcion">Descripción</label>
          <textarea
            id="descripcion"
            name="descripcion"
            placeholder="Descripción opcional"
            class="form-textarea"
            rows="3"
          >${data.descripcion || ''}</textarea>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza el paso de contacto
   */
  renderContacto(data) {
    return `
      <div class="wizard-step-content">
        <div class="form-group">
          <label for="email">Email *</label>
          <input
            type="email"
            id="email"
            name="email"
            value="${data.email || ''}"
            placeholder="correo@ejemplo.com"
            class="form-input"
            required
          />
        </div>

        <div class="form-group">
          <label for="telefono">Teléfono</label>
          <input
            type="tel"
            id="telefono"
            name="telefono"
            value="${data.telefono || ''}"
            placeholder="+56 9 1234 5678"
            class="form-input"
          />
        </div>
      </div>
    `;
  }

  /**
   * Renderiza el paso de confirmación
   */
  renderConfirmacion(data) {
    return `
      <div class="wizard-step-content">
        <div class="confirmation-summary">
          <h3>Resumen de Datos</h3>

          <div class="summary-section">
            <h4>Información Básica</h4>
            <dl class="summary-list">
              <dt>Nombre:</dt>
              <dd>${data.nombre || '-'}</dd>
              <dt>Descripción:</dt>
              <dd>${data.descripcion || '-'}</dd>
            </dl>
          </div>

          <div class="summary-section">
            <h4>Contacto</h4>
            <dl class="summary-list">
              <dt>Email:</dt>
              <dd>${data.email || '-'}</dd>
              <dt>Teléfono:</dt>
              <dd>${data.telefono || '-'}</dd>
            </dl>
          </div>

          <div class="confirmation-notice">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>Por favor revise los datos antes de confirmar</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Configura listeners específicos del paso actual
   * Se llama después de cada render()
   */
  setupStepListeners() {
    const step = this.currentStepConfig;

    // Agregar listeners de input para auto-guardar
    const inputs = this.container.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      input.addEventListener('change', () => this.saveStepData());
      input.addEventListener('blur', () => this.saveStepData());
    });

    // Listeners específicos por paso
    if (step.id === 'info-basica') {
      // Ejemplo: validación en tiempo real
      const nombreInput = this.container.querySelector('#nombre');
      if (nombreInput) {
        nombreInput.addEventListener('input', (e) => {
          const isValid = e.target.value.length >= 3;
          e.target.classList.toggle('input-error', !isValid && e.target.value.length > 0);
        });
      }
    }
  }

  /**
   * Guarda los datos del formulario actual al estado
   */
  saveStepData() {
    const form = this.container.querySelector('.wizard-step-content');
    if (!form) return;

    const formData = {};
    const inputs = form.querySelectorAll('input, textarea, select');

    inputs.forEach(input => {
      if (input.name) {
        if (input.type === 'checkbox') {
          formData[input.name] = input.checked;
        } else if (input.type === 'radio') {
          if (input.checked) formData[input.name] = input.value;
        } else {
          formData[input.name] = input.value;
        }
      }
    });

    // Actualizar estado con los nuevos datos
    this.setState({
      data: {
        ...this.state.data,
        ...formData
      }
    });
  }

  /**
   * Override del método submit para lógica personalizada
   */
  async submit() {
    this.saveStepData();

    // Validar paso final
    const step = this.currentStepConfig;
    if (step.validate && !step.validate(this.state.data)) {
      this.showError('Por favor completa todos los campos requeridos');
      return;
    }

    // Mostrar loading
    this.setState({ isLoading: true });
    this.showLoadingState();

    try {
      // Aquí iría la llamada a la API
      // const result = await apiService.createSomething(this.state.data);

      // Simular llamada API
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Limpiar estado persistido
      await this.clearPersistedState();

      // Mostrar éxito
      this.showSuccess('Datos guardados correctamente');

      // Llamar callback
      if (this.callbacks.onComplete) {
        this.callbacks.onComplete(this.state.data);
      }

    } catch (error) {
      console.error('Error en submit:', error);
      this.showError(error.message || 'Error al guardar los datos');
    } finally {
      this.setState({ isLoading: false });
    }
  }

  /**
   * Muestra estado de carga en el botón de submit
   */
  showLoadingState() {
    const submitBtn = this.container.querySelector('[data-action="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="spinner"></span>
        Guardando...
      `;
    }
  }
}

/**
 * CSS adicional específico para este wizard
 */
const EXAMPLE_WIZARD_STYLES = `
  .wizard-step-content .form-group {
    margin-bottom: 20px;
  }

  .wizard-step-content label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #374151;
  }

  .wizard-step-content .form-input,
  .wizard-step-content .form-textarea {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 16px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .wizard-step-content .form-input:focus,
  .wizard-step-content .form-textarea:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }

  .wizard-step-content .form-input.input-error {
    border-color: #ef4444;
  }

  .wizard-step-content .form-hint {
    display: block;
    margin-top: 4px;
    font-size: 14px;
    color: #6b7280;
  }

  .confirmation-summary {
    background: #f9fafb;
    border-radius: 12px;
    padding: 24px;
  }

  .confirmation-summary h3 {
    margin: 0 0 20px;
    color: #1f2937;
  }

  .summary-section {
    margin-bottom: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid #e5e7eb;
  }

  .summary-section:last-of-type {
    border-bottom: none;
  }

  .summary-section h4 {
    margin: 0 0 12px;
    font-size: 14px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .summary-list {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 8px;
    margin: 0;
  }

  .summary-list dt {
    color: #6b7280;
  }

  .summary-list dd {
    margin: 0;
    color: #1f2937;
    font-weight: 500;
  }

  .confirmation-notice {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: #fef3c7;
    border-radius: 8px;
    color: #92400e;
  }

  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 8px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

// Inyectar estilos si no existen
if (typeof document !== 'undefined' && !document.getElementById('example-wizard-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'example-wizard-styles';
  styleEl.textContent = EXAMPLE_WIZARD_STYLES;
  document.head.appendChild(styleEl);
}

/**
 * Función factory para mantener compatibilidad con código existente
 * @param {Object} options - Opciones del wizard
 * @returns {Promise<ExampleWizard>} Instancia inicializada
 */
export async function createExampleWizard(options) {
  const wizard = new ExampleWizard(options);
  await wizard.init();
  return wizard;
}

export default ExampleWizard;
