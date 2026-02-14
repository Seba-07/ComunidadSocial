/**
 * API Service - Centralized HTTP client for backend communication
 * Con soporte offline mediante IndexedDB y Background Sync
 */

import { indexedDBService } from '../infrastructure/database/IndexedDBService.js';

// Determine API URL based on environment
function getApiUrl() {
  // Check for environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // In browser, check hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001/api';
    }
    // Production - use Railway backend
    return 'https://comunidadsocial-production.up.railway.app/api';
  }

  return 'http://localhost:3001/api';
}

const API_URL = getApiUrl();
console.log('🔗 API URL:', API_URL);

class ApiService {
  constructor() {
    this.baseUrl = API_URL;
    this._offlineListenersSetup = false;
    this._setupOfflineListeners();
  }

  /**
   * Configura listeners para cambios de estado de conexión
   */
  _setupOfflineListeners() {
    if (this._offlineListenersSetup || typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      console.log('🌐 Conexión restaurada');
      this._triggerBackgroundSync();
      this._notifyConnectionChange(true);
    });

    window.addEventListener('offline', () => {
      console.log('📴 Sin conexión');
      this._notifyConnectionChange(false);
    });

    // Escuchar mensajes del Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_COMPLETED') {
          console.log('✅ Sincronización completada:', event.data.requestId);
          window.dispatchEvent(new CustomEvent('offline-sync-completed', { detail: event.data }));
        }
        if (event.data.type === 'SYNC_FAILED') {
          console.log('❌ Sincronización fallida:', event.data.error);
          window.dispatchEvent(new CustomEvent('offline-sync-failed', { detail: event.data }));
        }
        if (event.data.type === 'SYNC_COMPLETE') {
          console.log('🔄 Cola offline sincronizada');
          window.dispatchEvent(new CustomEvent('offline-queue-synced'));
        }
      });
    }

    this._offlineListenersSetup = true;
  }

  /**
   * Notifica cambios de conexión a la UI
   */
  _notifyConnectionChange(isOnline) {
    window.dispatchEvent(new CustomEvent('connection-change', {
      detail: { isOnline }
    }));
  }

  /**
   * Registra background sync para procesar cola offline
   */
  async _triggerBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-offline-queue');
        console.log('📤 Background sync registrado');
      } catch (error) {
        console.warn('⚠️ No se pudo registrar background sync:', error);
        // Fallback: intentar sincronizar manualmente
        this._manualSync();
      }
    } else {
      // Fallback para navegadores sin Background Sync
      this._manualSync();
    }
  }

  /**
   * Sincronización manual cuando Background Sync no está disponible
   */
  async _manualSync() {
    try {
      const pendingRequests = await indexedDBService.getPendingOfflineRequests();
      if (pendingRequests.length === 0) return;

      console.log(`🔄 Sincronización manual: ${pendingRequests.length} peticiones pendientes`);

      for (const req of pendingRequests) {
        try {
          const response = await fetch(req.url, {
            method: req.method,
            headers: JSON.parse(req.headers || '{}'),
            body: req.body,
            credentials: 'include'
          });

          if (response.ok) {
            await indexedDBService.updateOfflineRequestStatus(req.id, 'completed');
            window.dispatchEvent(new CustomEvent('offline-sync-completed', {
              detail: { requestId: req.id, success: true }
            }));
          } else {
            const attempts = (req.attempts || 0) + 1;
            if (attempts >= 3) {
              await indexedDBService.updateOfflineRequestStatus(req.id, 'failed', { attempts });
            } else {
              await indexedDBService.updateOfflineRequestStatus(req.id, 'pending', { attempts });
            }
          }
        } catch (error) {
          console.error('Error sincronizando petición:', req.id, error);
        }
      }

      window.dispatchEvent(new CustomEvent('offline-queue-synced'));
    } catch (error) {
      console.error('Error en sincronización manual:', error);
    }
  }

  /**
   * Verifica si estamos online
   */
  isOnline() {
    return navigator.onLine;
  }

  /**
   * Obtiene el conteo de peticiones pendientes en la cola offline
   */
  async getPendingRequestsCount() {
    try {
      const pending = await indexedDBService.getPendingOfflineRequests();
      return pending.length;
    } catch {
      return 0;
    }
  }

  /**
   * Build headers for request
   * SEGURIDAD: No enviamos Authorization header, usamos cookies HttpOnly exclusivamente
   * El token se envía automáticamente con credentials: 'include'
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Make HTTP request
   * Usa credentials: 'include' para enviar cookies HttpOnly automáticamente
   * Soporta modo offline para operaciones POST/PUT/DELETE
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const method = options.method || 'GET';

    const config = {
      headers: this.getHeaders(),
      credentials: 'include', // IMPORTANTE: Incluir cookies en la petición
      ...options
    };

    // Serializar body si es objeto
    let bodyString = null;
    if (config.body && typeof config.body === 'object') {
      bodyString = JSON.stringify(config.body);
      config.body = bodyString;
    } else if (config.body) {
      bodyString = config.body;
    }

    // Si estamos offline y es una operación modificadora, encolar
    if (!navigator.onLine && ['POST', 'PUT', 'DELETE'].includes(method)) {
      return this._queueOfflineRequest(url, method, config.headers, bodyString, endpoint);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la solicitud');
      }

      return data;
    } catch (error) {
      // Si el error es de red y es operación modificadora, encolar
      if (error.name === 'TypeError' && ['POST', 'PUT', 'DELETE'].includes(method)) {
        console.log('📴 Error de red detectado, encolando petición...');
        return this._queueOfflineRequest(url, method, config.headers, bodyString, endpoint);
      }

      console.error('API Error:', error);
      throw error;
    }
  }

  /**
   * Encola una petición para enviar cuando vuelva la conexión
   */
  async _queueOfflineRequest(url, method, headers, body, endpoint) {
    try {
      // Determinar tipo de petición para priorización
      let type = 'general';
      if (endpoint.includes('validate')) type = 'validation';
      else if (endpoint.includes('assignment')) type = 'assignment';
      else if (endpoint.includes('organization')) type = 'organization';

      const requestId = await indexedDBService.addToOfflineQueue({
        url,
        method,
        headers: JSON.stringify(headers),
        body,
        type,
        endpoint
      });

      console.log('📤 Petición encolada:', requestId, type);

      // Intentar registrar background sync
      this._triggerBackgroundSync();

      // Retornar respuesta indicando que está encolado
      return {
        _queued: true,
        _requestId: requestId,
        _message: 'Petición guardada. Se enviará cuando vuelva la conexión.',
        _type: type
      };
    } catch (error) {
      console.error('Error encolando petición:', error);
      throw new Error('Sin conexión y no se pudo guardar la petición localmente');
    }
  }

  // GET request
  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST request
  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body });
  }

  // PUT request
  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body });
  }

  // DELETE request
  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // ==================== AUTH ====================

  /**
   * Login de usuario
   * SEGURIDAD: El token se maneja exclusivamente via cookies HttpOnly
   * Solo guardamos datos de usuario (sin token) para UI
   */
  async login(email, password) {
    const data = await this.post('/auth/login', { email, password });
    // Guardar datos de usuario para UI (sin información sensible)
    if (data.user && data.user.role !== 'MINISTRO_FE') {
      // Crear copia sin datos sensibles
      const safeUser = {
        _id: data.user._id,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        email: data.user.email,
        role: data.user.role,
        mustChangePassword: data.user.mustChangePassword
      };
      localStorage.setItem('currentUser', JSON.stringify(safeUser));
    }
    return data;
  }

  /**
   * Registro de usuario
   * SEGURIDAD: El token se maneja exclusivamente via cookies HttpOnly
   */
  async register(userData) {
    const data = await this.post('/auth/register', userData);
    // Guardar datos de usuario para UI (sin información sensible)
    if (data.user) {
      const safeUser = {
        _id: data.user._id,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        email: data.user.email,
        role: data.user.role
      };
      localStorage.setItem('currentUser', JSON.stringify(safeUser));
    }
    return data;
  }

  async getCurrentUser() {
    return this.get('/auth/me');
  }

  async changePassword(currentPassword, newPassword) {
    return this.post('/auth/change-password', { currentPassword, newPassword });
  }

  /**
   * Logout - Elimina cookie del servidor y limpia TODOS los datos de localStorage
   * SEGURIDAD: Limpieza completa para evitar datos residuales
   */
  async logout() {
    try {
      await this.post('/auth/logout');
    } catch (error) {
      console.warn('Logout endpoint error:', error);
    }
    // Limpiar TODOS los datos de sesión de localStorage
    const keysToRemove = [
      'auth_token',           // Legacy - ya no debería existir
      'currentUser',
      'currentMinistro',
      'isAuthenticated',
      'isMinistroAuthenticated',
      'user_organizations',
      'ministros_fe',
      'ministro_assignments',
      'user_notifications'
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  // ==================== ORGANIZATIONS ====================

  async getOrganizations() {
    return this.get('/organizations');
  }

  // PUBLIC: Get booked time slots (no auth required)
  async getBookedSlots() {
    return this.get('/organizations/availability/booked-slots');
  }

  async getMyOrganizations() {
    return this.get('/organizations/my');
  }

  async getOrganization(id) {
    return this.get(`/organizations/${id}`);
  }

  async createOrganization(orgData) {
    return this.post('/organizations', orgData);
  }

  async updateOrganization(id, updates) {
    return this.put(`/organizations/${id}`, updates);
  }

  async scheduleMinistro(orgId, ministroData) {
    return this.post(`/organizations/${orgId}/schedule-ministro`, ministroData);
  }

  async approveByMinistro(orgId, data) {
    return this.post(`/organizations/${orgId}/approve-ministro`, data);
  }

  async updateOrgStatus(orgId, status, comment) {
    return this.post(`/organizations/${orgId}/status`, { status, comment });
  }

  async rejectOrganization(orgId, corrections, generalComment) {
    return this.post(`/organizations/${orgId}/reject`, { corrections, generalComment });
  }

  async resubmitOrganization(orgId, userComment, fieldResponses) {
    return this.post(`/organizations/${orgId}/resubmit`, { userComment, fieldResponses });
  }

  async getOrganizationsByStatus(status) {
    return this.get(`/organizations/status/${status}`);
  }

  async getOrganizationStats() {
    return this.get('/organizations/stats/counts');
  }

  // ==================== MINISTROS ====================

  async getMinistros() {
    return this.get('/ministros');
  }

  async getActiveMinistros() {
    return this.get('/ministros/active');
  }

  async getMinistro(id) {
    return this.get(`/ministros/${id}`);
  }

  async createMinistro(ministroData) {
    return this.post('/ministros', ministroData);
  }

  async updateMinistro(id, updates) {
    return this.put(`/ministros/${id}`, updates);
  }

  async toggleMinistroActive(id) {
    return this.post(`/ministros/${id}/toggle-active`);
  }

  async resetMinistroPassword(id) {
    return this.post(`/ministros/${id}/reset-password`);
  }

  async deleteMinistro(id) {
    return this.delete(`/ministros/${id}`);
  }

  /**
   * Login de Ministro de Fe
   * SEGURIDAD: El token se maneja exclusivamente via cookies HttpOnly
   */
  async loginMinistro(email, password) {
    const data = await this.post('/ministros/login', { email, password });
    // Guardar datos de ministro para UI (sin información sensible)
    if (data.ministro) {
      const safeMinistro = {
        _id: data.ministro._id,
        firstName: data.ministro.firstName,
        lastName: data.ministro.lastName,
        email: data.ministro.email,
        rut: data.ministro.rut,
        role: data.ministro.role,
        mustChangePassword: data.ministro.mustChangePassword
      };
      localStorage.setItem('currentMinistro', JSON.stringify(safeMinistro));
    }
    return data;
  }

  async getMinistroStats() {
    return this.get('/ministros/stats/counts');
  }

  // ==================== ASSIGNMENTS ====================

  async getAssignments() {
    return this.get('/assignments');
  }

  async getMinistroAssignments(ministroId) {
    return this.get(`/assignments/ministro/${ministroId}`);
  }

  async getMyPendingAssignments() {
    return this.get('/assignments/my/pending');
  }

  async getAssignment(id) {
    return this.get(`/assignments/${id}`);
  }

  async createAssignment(assignmentData) {
    return this.post('/assignments', assignmentData);
  }

  async updateAssignment(id, updates) {
    return this.put(`/assignments/${id}`, updates);
  }

  async validateSignatures(assignmentId, signatures, wizardData) {
    return this.post(`/assignments/${assignmentId}/validate`, { signatures, wizardData });
  }

  async resetValidation(assignmentId) {
    return this.post(`/assignments/${assignmentId}/reset-validation`);
  }

  async completeAssignment(assignmentId) {
    return this.post(`/assignments/${assignmentId}/complete`);
  }

  async cancelAssignment(assignmentId, reason) {
    return this.post(`/assignments/${assignmentId}/cancel`, { reason });
  }

  async checkScheduleConflict(ministroId, date, time) {
    return this.get(`/assignments/check-conflict/${ministroId}/${date}/${time}`);
  }

  async getAssignmentStats(ministroId) {
    return this.get(`/assignments/stats/${ministroId}`);
  }

  // ==================== NOTIFICATIONS ====================

  async getNotifications() {
    return this.get('/notifications');
  }

  async getUnreadNotifications() {
    return this.get('/notifications/unread');
  }

  async getUnreadCount() {
    return this.get('/notifications/unread/count');
  }

  async markNotificationRead(id) {
    return this.post(`/notifications/${id}/read`);
  }

  async markAllNotificationsRead() {
    return this.post('/notifications/read-all');
  }

  async deleteNotification(id) {
    return this.delete(`/notifications/${id}`);
  }

  async createNotification(notificationData) {
    return this.post('/notifications', notificationData);
  }

  // ==================== MEMBER ACCOUNTS ====================

  async createMemberAccounts(organizationId) {
    return this.post(`/organizations/${organizationId}/create-member-accounts`);
  }

  async getMembersWithAccounts(organizationId) {
    return this.get(`/organizations/${organizationId}/members-with-accounts`);
  }

  async getMyOrganization() {
    return this.get('/organizations/my-organization');
  }

  // ==================== USERS ====================

  async getUsers() {
    return this.get('/users');
  }

  async getUser(id) {
    return this.get(`/users/${id}`);
  }

  async updateUser(id, updates) {
    return this.put(`/users/${id}`, updates);
  }

  async toggleUserActive(id) {
    return this.post(`/users/${id}/toggle-active`);
  }

  async deleteUser(id) {
    return this.delete(`/users/${id}`);
  }

  async getUserStats() {
    return this.get('/users/stats/counts');
  }

  // ==================== ORGANIZATION TYPES ====================

  /**
   * Obtener todos los tipos de organización
   */
  async getOrganizationTypes() {
    return this.get('/organization-types');
  }

  /**
   * Obtener tipos agrupados por categoría
   */
  async getOrganizationTypesGrouped() {
    return this.get('/organization-types/grouped');
  }

  /**
   * Obtener categorías disponibles
   */
  async getOrganizationCategories() {
    return this.get('/organization-types/categories');
  }

  /**
   * Obtener información de un tipo específico
   */
  async getOrganizationType(tipo) {
    return this.get(`/organization-types/${tipo}`);
  }

  // ==================== DOCUMENTS (PDF GENERATION) ====================

  /**
   * Descarga el PDF del Acta Constitutiva
   * @param {string} orgId - ID de la organización
   */
  async downloadActaPDF(orgId) {
    const url = `${this.baseUrl}/documents/${orgId}/generate-acta`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al generar PDF');
    }

    // Descargar el blob
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `Acta_Constitutiva_${orgId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  /**
   * Descarga el PDF de la Lista de Socios
   * @param {string} orgId - ID de la organización
   */
  async downloadMembersPDF(orgId) {
    const url = `${this.baseUrl}/documents/${orgId}/generate-members`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al generar PDF');
    }

    // Descargar el blob
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `Lista_Socios_${orgId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  /**
   * Obtiene el preview HTML del Acta Constitutiva
   * @param {string} orgId - ID de la organización
   * @returns {string} HTML del acta
   */
  async getActaPreview(orgId) {
    const url = `${this.baseUrl}/documents/${orgId}/preview-acta`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al obtener preview');
    }

    return response.text();
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck() {
    return this.get('/health');
  }
}

// Export singleton instance
export const apiService = new ApiService();
