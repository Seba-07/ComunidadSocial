/**
 * Módulo Compartido (Shared)
 * Punto de entrada unificado para utilidades y componentes
 * @module shared
 */

// Utilidades
export * from './utils/index.js';

// Componentes UI
export * from './components/index.js';

// Re-exportar default de componentes
export { default as UI } from './components/index.js';
