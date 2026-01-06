/**
 * IndexedDBService
 * Servicio para manejar la base de datos local (IndexedDB)
 * Permite almacenar documentos, imágenes y datos offline
 */

export class IndexedDBService {
  constructor() {
    this.dbName = 'ComunidadRencaDB';
    this.version = 3; // Incrementado para añadir stores de validation wizard y offline queue
    this.db = null;
  }

  /**
   * Inicializa la base de datos
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Error al abrir IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('✅ IndexedDB inicializada correctamente');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store para usuarios
        if (!db.objectStoreNames.contains('users')) {
          const usersStore = db.createObjectStore('users', { keyPath: 'id' });
          usersStore.createIndex('email', 'email', { unique: true });
          usersStore.createIndex('rut', 'profile.rut', { unique: true });
        }

        // Store para organizaciones
        if (!db.objectStoreNames.contains('organizations')) {
          const orgsStore = db.createObjectStore('organizations', { keyPath: 'id' });
          orgsStore.createIndex('createdBy', 'createdBy', { unique: false });
          orgsStore.createIndex('status', 'status', { unique: false });
          orgsStore.createIndex('commune', 'commune', { unique: false });
        }

        // Store para solicitudes/aplicaciones
        if (!db.objectStoreNames.contains('applications')) {
          const appsStore = db.createObjectStore('applications', { keyPath: 'id' });
          appsStore.createIndex('userId', 'userId', { unique: false });
          appsStore.createIndex('organizationId', 'organizationId', { unique: false });
          appsStore.createIndex('status', 'status', { unique: false });
        }

        // Store para documentos (archivos como base64 o blobs)
        if (!db.objectStoreNames.contains('documents')) {
          const docsStore = db.createObjectStore('documents', { keyPath: 'id' });
          docsStore.createIndex('applicationId', 'applicationId', { unique: false });
          docsStore.createIndex('type', 'type', { unique: false });
        }

        // Store para certificados del wizard (base64 grandes)
        if (!db.objectStoreNames.contains('wizard_certificates')) {
          db.createObjectStore('wizard_certificates', { keyPath: 'key' });
        }

        // Store para estado del validation wizard de ministros (persistencia offline)
        if (!db.objectStoreNames.contains('validation_wizard_state')) {
          const wizardStore = db.createObjectStore('validation_wizard_state', { keyPath: 'assignmentId' });
          wizardStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }

        // Store para cola de peticiones offline (background sync)
        if (!db.objectStoreNames.contains('offline_queue')) {
          const offlineStore = db.createObjectStore('offline_queue', { keyPath: 'id', autoIncrement: true });
          offlineStore.createIndex('status', 'status', { unique: false });
          offlineStore.createIndex('createdAt', 'createdAt', { unique: false });
          offlineStore.createIndex('type', 'type', { unique: false });
        }

        console.log('📦 Stores creadas en IndexedDB');
      };
    });
  }

  /**
   * Agrega un registro a un store
   */
  async add(storeName, data) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(new Error(`Error al agregar en ${storeName}`));
    });
  }

  /**
   * Obtiene un registro por ID
   */
  async get(storeName, id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Error al obtener de ${storeName}`));
    });
  }

  /**
   * Obtiene todos los registros de un store
   */
  async getAll(storeName) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Error al obtener todos de ${storeName}`));
    });
  }

  /**
   * Obtiene registros por índice
   */
  async getByIndex(storeName, indexName, value) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Error al buscar en índice ${indexName}`));
    });
  }

  /**
   * Actualiza un registro
   */
  async update(storeName, data) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(new Error(`Error al actualizar en ${storeName}`));
    });
  }

  /**
   * Elimina un registro
   */
  async delete(storeName, id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error(`Error al eliminar de ${storeName}`));
    });
  }

  /**
   * Limpia un store completo
   */
  async clear(storeName) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error(`Error al limpiar ${storeName}`));
    });
  }

  /**
   * Guarda un archivo como base64
   */
  async saveFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          data: reader.result, // base64
          lastModified: file.lastModified
        });
      };

      reader.onerror = () => reject(new Error('Error al leer archivo'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convierte base64 a Blob
   */
  base64ToBlob(base64, mimeType) {
    const byteString = atob(base64.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ab], { type: mimeType });
  }

  // ============ MÉTODOS PARA CERTIFICADOS DEL WIZARD ============

  /**
   * Guarda un certificado del wizard
   */
  async saveWizardCertificate(key, certData) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['wizard_certificates'], 'readwrite');
      const store = transaction.objectStore('wizard_certificates');
      const request = store.put({ key, ...certData, savedAt: new Date().toISOString() });

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error('Error al guardar certificado'));
    });
  }

  /**
   * Obtiene un certificado del wizard
   */
  async getWizardCertificate(key) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['wizard_certificates'], 'readonly');
      const store = transaction.objectStore('wizard_certificates');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Error al obtener certificado'));
    });
  }

  /**
   * Obtiene todos los certificados del wizard
   */
  async getAllWizardCertificates() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['wizard_certificates'], 'readonly');
      const store = transaction.objectStore('wizard_certificates');
      const request = store.getAll();

      request.onsuccess = () => {
        // Convertir array a objeto con key como propiedad
        const certs = {};
        request.result.forEach(cert => {
          certs[cert.key] = cert;
        });
        resolve(certs);
      };
      request.onerror = () => reject(new Error('Error al obtener certificados'));
    });
  }

  /**
   * Limpia todos los certificados del wizard
   */
  async clearWizardCertificates() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['wizard_certificates'], 'readwrite');
      const store = transaction.objectStore('wizard_certificates');
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error('Error al limpiar certificados'));
    });
  }

  // ============ MÉTODOS PARA VALIDATION WIZARD STATE (MINISTROS) ============

  /**
   * Guarda el estado del validation wizard
   * @param {string} assignmentId - ID del assignment
   * @param {Object} state - Estado a guardar (currentStep, wizardData, etc.)
   */
  async saveValidationWizardState(assignmentId, state) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['validation_wizard_state'], 'readwrite');
      const store = transaction.objectStore('validation_wizard_state');
      const request = store.put({
        assignmentId,
        ...state,
        lastUpdated: new Date().toISOString()
      });

      request.onsuccess = () => {
        console.log('💾 Estado del wizard guardado:', assignmentId);
        resolve(true);
      };
      request.onerror = () => reject(new Error('Error al guardar estado del wizard'));
    });
  }

  /**
   * Obtiene el estado guardado del validation wizard
   * @param {string} assignmentId - ID del assignment
   * @returns {Object|null} Estado guardado o null si no existe
   */
  async getValidationWizardState(assignmentId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['validation_wizard_state'], 'readonly');
      const store = transaction.objectStore('validation_wizard_state');
      const request = store.get(assignmentId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Error al obtener estado del wizard'));
    });
  }

  /**
   * Elimina el estado guardado del validation wizard
   * @param {string} assignmentId - ID del assignment
   */
  async deleteValidationWizardState(assignmentId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['validation_wizard_state'], 'readwrite');
      const store = transaction.objectStore('validation_wizard_state');
      const request = store.delete(assignmentId);

      request.onsuccess = () => {
        console.log('🗑️ Estado del wizard eliminado:', assignmentId);
        resolve(true);
      };
      request.onerror = () => reject(new Error('Error al eliminar estado del wizard'));
    });
  }

  /**
   * Obtiene todos los estados de wizard guardados
   * @returns {Array} Lista de estados guardados
   */
  async getAllValidationWizardStates() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['validation_wizard_state'], 'readonly');
      const store = transaction.objectStore('validation_wizard_state');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Error al obtener estados del wizard'));
    });
  }

  // ============ MÉTODOS PARA OFFLINE QUEUE ============

  /**
   * Agrega una petición a la cola offline
   * @param {Object} request - Petición a encolar
   * @returns {number} ID de la petición encolada
   */
  async addToOfflineQueue(request) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offline_queue'], 'readwrite');
      const store = transaction.objectStore('offline_queue');
      const data = {
        ...request,
        status: 'pending',
        createdAt: new Date().toISOString(),
        attempts: 0
      };
      const req = store.add(data);

      req.onsuccess = () => {
        console.log('📤 Petición agregada a cola offline:', req.result);
        resolve(req.result);
      };
      req.onerror = () => reject(new Error('Error al agregar a cola offline'));
    });
  }

  /**
   * Obtiene todas las peticiones pendientes de la cola offline
   * @returns {Array} Lista de peticiones pendientes
   */
  async getPendingOfflineRequests() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offline_queue'], 'readonly');
      const store = transaction.objectStore('offline_queue');
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Error al obtener peticiones pendientes'));
    });
  }

  /**
   * Actualiza el estado de una petición offline
   * @param {number} id - ID de la petición
   * @param {string} status - Nuevo estado ('pending', 'processing', 'completed', 'failed')
   * @param {Object} extra - Datos adicionales (error, result, etc.)
   */
  async updateOfflineRequestStatus(id, status, extra = {}) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offline_queue'], 'readwrite');
      const store = transaction.objectStore('offline_queue');
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const data = getReq.result;
        if (!data) {
          reject(new Error('Petición no encontrada'));
          return;
        }

        const updated = {
          ...data,
          status,
          ...extra,
          lastUpdated: new Date().toISOString()
        };

        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve(updated);
        putReq.onerror = () => reject(new Error('Error al actualizar petición'));
      };

      getReq.onerror = () => reject(new Error('Error al obtener petición'));
    });
  }

  /**
   * Elimina una petición de la cola offline
   * @param {number} id - ID de la petición
   */
  async removeFromOfflineQueue(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offline_queue'], 'readwrite');
      const store = transaction.objectStore('offline_queue');
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('🗑️ Petición eliminada de cola offline:', id);
        resolve(true);
      };
      request.onerror = () => reject(new Error('Error al eliminar de cola offline'));
    });
  }

  /**
   * Limpia peticiones completadas o fallidas de la cola offline
   */
  async cleanOfflineQueue() {
    if (!this.db) await this.init();

    const requests = await this.getAll('offline_queue');
    const toDelete = requests.filter(r => r.status === 'completed' || r.status === 'failed');

    for (const req of toDelete) {
      await this.removeFromOfflineQueue(req.id);
    }

    console.log('🧹 Cola offline limpiada:', toDelete.length, 'peticiones eliminadas');
    return toDelete.length;
  }
}

// Instancia singleton
export const indexedDBService = new IndexedDBService();
