/**
 * Módulo Compartido (Shared)
 * Punto de entrada unificado para utilidades y componentes
 * @module shared
 */

// Utilidades
export * from './utils/index.js';

// Form Helpers
export * from './utils/formHelpers.js';

// State Management
export { StateManager, createState, createStore } from './state/StateManager.js';

// Componentes Base
export { BaseWizard } from './components/BaseWizard.js';

// Componentes UI
export * from './components/index.js';

// Re-exportar default de componentes
export { default as UI } from './components/index.js';

/**
 * Helper para crear un wizard rápidamente
 * @param {Function} WizardClass - Clase del wizard
 * @param {Object} options - Opciones
 * @returns {Promise} Wizard inicializado
 */
export async function createWizard(WizardClass, options) {
  const wizard = new WizardClass(options);
  await wizard.init();
  return wizard;
}
