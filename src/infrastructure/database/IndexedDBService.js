/**
 * IndexedDBService
 * Servicio para manejar la base de datos local (IndexedDB)
 * Permite almacenar documentos, imágenes y datos offline
 */

export class IndexedDBService {
  constructor() {
    this.dbName = 'ComunidadRencaDB';
    this.version = 1;
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
}

// Instancia singleton
export const indexedDBService = new IndexedDBService();
