/**
 * Dependency Injection Container
 * Configura e inicializa todas las dependencias de la aplicación
 */

import { APP_CONFIG } from './app.config.js';

// Repositorios IndexedDB
import { IndexedDBUserRepository } from '../repositories/IndexedDBUserRepository.js';
import { MockOrganizationRepository } from '../repositories/MockOrganizationRepository.js';
import { MockApplicationRepository } from '../repositories/MockApplicationRepository.js';

// Servicios
import { MockAuthService } from '../services/MockAuthService.js';

// Database
import { indexedDBService } from '../database/IndexedDBService.js';

/**
 * Container singleton que mantiene todas las instancias
 */
class Container {
  constructor() {
    this.dependencies = {};
    this.initialized = false;
  }

  /**
   * Inicializa todas las dependencias
   */
  async init() {
    if (this.initialized) {
      return;
    }

    console.log('🚀 Inicializando aplicación en modo:', APP_CONFIG.USE_MOCKS ? 'LOCAL (IndexedDB)' : 'PRODUCTION');

    // Inicializar IndexedDB
    await indexedDBService.init();

    // Repositorios
    this.dependencies.userRepository = new IndexedDBUserRepository();
    this.dependencies.organizationRepository = new MockOrganizationRepository();
    this.dependencies.applicationRepository = new MockApplicationRepository();

    // Servicios
    this.dependencies.authService = new MockAuthService(this.dependencies.userRepository);

    this.initialized = true;
    console.log('✅ Aplicación inicializada correctamente');
  }

  /**
   * Obtiene una dependencia del container
   */
  get(name) {
    if (!this.initialized) {
      this.init();
    }

    if (!this.dependencies[name]) {
      throw new Error(`Dependencia "${name}" no encontrada`);
    }

    return this.dependencies[name];
  }

  /**
   * Resetea el container (útil para testing)
   */
  reset() {
    this.dependencies = {};
    this.initialized = false;
  }
}

// Exportar instancia singleton
export const container = new Container();

// Helpers para obtener dependencias comunes
export const getUserRepository = () => container.get('userRepository');
export const getOrganizationRepository = () => container.get('organizationRepository');
export const getApplicationRepository = () => container.get('applicationRepository');
export const getAuthService = () => container.get('authService');
