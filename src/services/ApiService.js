/**
 * API Service - Centralized HTTP client for backend communication
 * Con soporte offline mediante IndexedDB y Background Sync
 */

import { indexedDBService } from '../infrastructure/database/IndexedDBService.js';

// Determine API URL based on environment
function getApiUrl() {
  // VITE_API_URL is required — set in .env (dev) and Vercel env vars (prod)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Fallback: dev local con Vite proxy (localhost:3000 → localhost:3001)
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '/api';
  }

  // SSR or unknown — default to local backend
  return 'http://localhost:3001/api';
}

const API_URL = getApiUrl();
console.log('🔗 API URL:', API_URL);

// Anti-SSRF: Controlable via variable de entorno
// Fail-safe: en producción se activa por defecto aunque no se configure la variable
const STRICT_LOCAL_NETWORK_BLOCK =
  import.meta.env.VITE_ENABLE_STRICT_LOCAL_NETWORK_BLOCK === 'true' ||
  (import.meta.env.MODE === 'production' && import.meta.env.VITE_ENABLE_STRICT_LOCAL_NETWORK_BLOCK !== 'false');

/**
 * Valida que una URL no apunte a IPs privadas o localhost.
 * Activo si VITE_ENABLE_STRICT_LOCAL_NETWORK_BLOCK=true, o automáticamente en producción.
 * Previene SSRF (Server-Side Request Forgery) en redes municipales.
 */
function assertNotLocalNetwork(url) {
  if (!STRICT_LOCAL_NETWORK_BLOCK) return;

  try {
    const parsed = new URL(url, window.location.origin);
    const hostname = parsed.hostname;

    // Bloquear localhost y variantes
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
      throw new Error('Network violation: Local IP request blocked by security policy');
    }

    // Bloquear rangos de IP privada (RFC 1918) y link-local
    const privateRanges = [
      /^10\./,                          // 10.0.0.0/8
      /^172\.(1[6-9]|2\d|3[01])\./,    // 172.16.0.0/12
      /^192\.168\./,                    // 192.168.0.0/16
      /^169\.254\./,                    // Link-local
      /^fc00:/i,                        // IPv6 ULA
      /^fe80:/i,                        // IPv6 link-local
    ];

    for (const range of privateRanges) {
      if (range.test(hostname)) {
        throw new Error('Network violation: Local IP request blocked by security policy');
      }
    }
  } catch (e) {
    if (e.message.startsWith('Network violation')) throw e;
    // Si la URL no se puede parsear, dejarla pasar (será un path relativo como /api/...)
  }
}

class ApiService {
  constructor() {
    this.baseUrl = API_URL;
    // Restaurar token de sessionStorage (sobrevive refresh, no nuevas pestañas)
    this._authToken = sessionStorage.getItem('_auth_token') || null;
    this._offlineListenersSetup = false;
    this._setupOfflineListeners();
  }

  /** Persiste token en memoria + sessionStorage */
  _setAuthToken(token) {
    this._authToken = token;
    if (token) {
      sessionStorage.setItem('_auth_token', token);
    } else {
      sessionStorage.removeItem('_auth_token');
    }
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
   * SEGURIDAD: Auth via HttpOnly cookies (credentials: 'include').
   * X-Requested-With para protección CSRF.
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };
    // Fallback: Authorization header when cookies don't work (cross-origin Vercel→Railway)
    if (this._authToken) {
      headers['Authorization'] = `Bearer ${this._authToken}`;
    }
    return headers;
  }

  /**
   * Make HTTP request
   * Usa credentials: 'include' para enviar cookies HttpOnly automáticamente
   * Soporta modo offline para operaciones POST/PUT/DELETE
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    // Anti-SSRF: Bloquear si apunta a IP privada y la política está activa
    assertNotLocalNetwork(url);

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
        // Handle email not verified
        if (response.status === 403 && data.code === 'EMAIL_NOT_VERIFIED') {
          window.dispatchEvent(new CustomEvent('email-not-verified'));
        }

        // Auto-refresh on 401 (token expired or missing cookie)
        if (response.status === 401 && !options._retried) {
          const refreshed = await this._tryRefreshToken();
          if (refreshed) {
            config.headers = this.getHeaders();
            return this.request(endpoint, { ...options, _retried: true });
          }
          // Refresh falló: sesión irrecuperable → forzar logout global
          window.dispatchEvent(new CustomEvent('session-force-logout'));
        }

        const err = new Error(data.error || 'Error en la solicitud');
        if (data.details) {
          err.details = data.details;
        }
        if (data.detail) {
          err.detail = data.detail;
        }
        if (data.code) {
          err.code = data.code;
        }
        throw err;
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

  // DELETE request with body
  deleteWithBody(endpoint, body) {
    return this.request(endpoint, { method: 'DELETE', body });
  }

  /**
   * Intenta renovar el access token usando el refresh token cookie
   */
  async _tryRefreshToken() {
    try {
      const url = `${this.baseUrl}/auth/refresh`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) return false;
      const data = await response.json();
      if (data.token) this._setAuthToken(data.token);
      return true;
    } catch {
      return false;
    }
  }

  // ==================== AUTH ====================

  /**
   * Login de usuario
   * SEGURIDAD: El token se maneja exclusivamente via cookies HttpOnly
   * Solo guardamos datos de usuario (sin token) para UI
   */
  async login(email, password) {
    const data = await this.post('/auth/login', { email, password });
    // Store token in memory as fallback (for when cookies don't work cross-origin)
    if (data.token) this._setAuthToken(data.token);
    if (data.user) {
      const safeUser = {
        _id: data.user._id,
        rut: data.user.rut || '',
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        email: data.user.email,
        phone: data.user.phone || '',
        address: data.user.address || '',
        region: data.user.region || '',
        commune: data.user.commune || '',
        role: data.user.role,
        mustChangePassword: data.user.mustChangePassword,
        emailVerified: data.user.emailVerified || false
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
    if (data.token) this._setAuthToken(data.token);
    if (data.user) {
      const safeUser = {
        _id: data.user._id,
        rut: data.user.rut || '',
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        email: data.user.email,
        phone: data.user.phone || '',
        address: data.user.address || '',
        role: data.user.role,
        emailVerified: data.user.emailVerified || false
      };
      localStorage.setItem('currentUser', JSON.stringify(safeUser));
    }
    return data;
  }

  async getCurrentUser() {
    return this.get('/auth/me');
  }

  async updateProfile(profileData) {
    return this.post('/auth/profile', profileData);
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
    // Clear token (memory + sessionStorage)
    this._setAuthToken(null);
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

  async deleteOrganization(id, reason) {
    if (reason) {
      return this.deleteWithBody(`/organizations/${id}`, { reason });
    }
    return this.delete(`/organizations/${id}`);
  }

  async approveDeletion(orgId) {
    return this.post(`/organizations/${orgId}/approve-deletion`);
  }

  async rejectDeletion(orgId, reason) {
    return this.post(`/organizations/${orgId}/reject-deletion`, { reason });
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

  async retractOrganization(orgId, reason) {
    return this.post(`/organizations/${orgId}/retract`, { reason });
  }

  async submitDraftOrganization(orgId, { electionDate, electionTime, assemblyAddress } = {}) {
    return this.post(`/organizations/${orgId}/submit`, { electionDate, electionTime, assemblyAddress });
  }

  async approveOrgWithDocument(orgId, pdfFile) {
    const formData = new FormData();
    formData.append('signedDocument', pdfFile);
    const url = `${this.baseUrl}/organizations/${orgId}/approve-with-document`;
    const headers = { ...this.getHeaders() };
    delete headers['Content-Type']; // Let browser set multipart boundary
    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Error al aprobar organización');
    }
    return data;
  }

  async getOrganizationsByStatus(status) {
    return this.get(`/organizations/status/${status}`);
  }

  async syncCertificates(orgId, certificates, estatutos) {
    const body = {};
    if (certificates) body.certificates = certificates;
    if (estatutos) body.estatutos = estatutos;
    return this.post(`/organizations/${orgId}/sync-certificates`, body);
  }

  async getOrganizationStats() {
    return this.get('/organizations/stats/counts');
  }

  async getAdvancedMetrics() {
    return this.get('/dashboard/advanced-metrics');
  }

  async exportDashboardReport() {
    const url = `${this.baseUrl}/dashboard/export`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
    });
    if (!response.ok) {
      throw new Error('Error al exportar reporte');
    }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    const disposition = response.headers.get('Content-Disposition');
    const filename = disposition?.match(/filename=(.+)/)?.[1] || `reporte_organizaciones_${new Date().toISOString().split('T')[0]}.csv`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
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
    if (data.token) this._setAuthToken(data.token);
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

  // Ministro notifications
  async getMinistroNotifications(ministroId) {
    return this.get(`/notifications/ministro/${ministroId}`);
  }

  async getMinistroUnreadCount(ministroId) {
    return this.get(`/notifications/ministro/${ministroId}/unread/count`);
  }

  async markMinistroNotificationRead(notificationId) {
    return this.post(`/notifications/ministro/${notificationId}/read`);
  }

  async markAllMinistroNotificationsRead(ministroId) {
    return this.post(`/notifications/ministro/${ministroId}/read-all`);
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

  // ==================== SOCIO LOGIN ====================

  async loginSocio(lastName, rut) {
    const data = await this.post('/auth/login-socio', { lastName, rut });
    if (data.token) this._setAuthToken(data.token);
    if (data.user) {
      const safeUser = {
        _id: data.user._id,
        rut: data.user.rut || '',
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        email: data.user.email,
        role: data.user.role,
        organizationIds: data.user.organizationIds || [],
        organizations: data.user.organizations || [],
        mustChangePassword: data.user.mustChangePassword,
        privacyAcceptedAt: data.user.privacyAcceptedAt || null
      };
      localStorage.setItem('currentUser', JSON.stringify(safeUser));
    }
    return data;
  }

  // ==================== ASSEMBLIES ====================

  async createAssembly(orgId, assemblyData) {
    return this.post(`/organizations/${orgId}/assemblies`, assemblyData);
  }

  async updateAssembly(orgId, assemblyId, data) {
    return this.put(`/organizations/${orgId}/assemblies/${assemblyId}`, data);
  }

  async updateAssemblyStatus(orgId, assemblyId, action) {
    return this.post(`/organizations/${orgId}/assemblies/${assemblyId}/status`, { action });
  }

  async deleteAssembly(orgId, assemblyId) {
    return this.delete(`/organizations/${orgId}/assemblies/${assemblyId}`);
  }

  async addCandidates(orgId, assemblyId, agendaItemId, candidates, customCargos) {
    return this.post(`/organizations/${orgId}/assemblies/${assemblyId}/candidates`, { agendaItemId, candidates, customCargos });
  }

  async castVote(orgId, assemblyId, agendaItemId, votes) {
    return this.post(`/organizations/${orgId}/assemblies/${assemblyId}/vote`, { agendaItemId, votes });
  }

  async checkinAssembly(orgId, assemblyId, attendee) {
    return this.post(`/organizations/${orgId}/assemblies/${assemblyId}/checkin`, attendee || {});
  }

  async checkinQr(orgId, assemblyId, qrToken) {
    return this.post(`/organizations/${orgId}/assemblies/${assemblyId}/checkin-qr`, { qrToken });
  }

  async generateQrToken(regenerate = false) {
    return this.post('/users/me/generate-qr-token', { regenerate });
  }

  async getQrToken() {
    return this.get('/users/me/qr-token');
  }

  async registerManoAlzada(orgId, assemblyId, data) {
    return this.post(`/organizations/${orgId}/assemblies/${assemblyId}/mano-alzada`, data);
  }

  async toggleVoting(orgId, assemblyId, agendaItemId) {
    return this.post(`/organizations/${orgId}/assemblies/${assemblyId}/toggle-voting`, { agendaItemId });
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

  async getEstatutoTemplateConfig(tipo) {
    return this.get(`/estatuto-templates/${tipo}/config`);
  }

  async getEstatutoTemplateSnapshot(tipo) {
    return this.get(`/estatuto-templates/${tipo}/snapshot`);
  }

  // Document Templates (Plantillas de documentos PDF)
  async getDocumentTemplatePublic(id) {
    return this.get(`/document-templates/public/${id}`);
  }

  async getDocumentTemplatesByType(type) {
    return this.get(`/document-templates/by-type/${type}`);
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

  // ==================== MINISTRO BLOCKS ====================

  async getMinistroAvailabilityForDate(date) {
    return this.get(`/ministro-blocks/availability/date/${date}`);
  }

  async getMinistroAvailabilityForMonth(year, month) {
    return this.get(`/ministro-blocks/availability/month/${year}/${month}`);
  }

  async getMinistroBlocks(ministroId) {
    return this.get(`/ministro-blocks/ministro/${ministroId}`);
  }

  async createMinistroBlock(blockData) {
    return this.post('/ministro-blocks', blockData);
  }

  async deleteMinistroBlock(blockId) {
    return this.delete(`/ministro-blocks/${blockId}`);
  }

  async createBlockFromConfirmation(data) {
    return this.post('/ministro-blocks/create-from-confirmation', data);
  }

  async getMinistroBlockCounts() {
    return this.get('/ministro-blocks/counts');
  }

  async getPendingBlocks() {
    return this.get('/ministro-blocks/pending');
  }

  async approveMinistroBlock(blockId) {
    return this.put(`/ministro-blocks/${blockId}/approve`);
  }

  async rejectMinistroBlock(blockId) {
    return this.put(`/ministro-blocks/${blockId}/reject`);
  }

  // ==================== ADMIN PREFERENCES ====================

  async getAdminPreferences() {
    return this.get('/admin-preferences');
  }

  async getAdminPreference(key) {
    return this.get(`/admin-preferences/${key}`);
  }

  async setAdminPreference(key, value) {
    return this.put(`/admin-preferences/${key}`, { value });
  }

  // ==================== MUNICIPALITY CONFIG ====================

  async getMunicipalityConfig() {
    return this.get('/config/municipality');
  }

  async updateMunicipalityConfig(data) {
    return this.put('/config/municipality', data);
  }

  // ==================== PRIVACY & CONSENT (Ley 21.719) ====================

  async getMyConsents() {
    return this.get('/users/me/consents');
  }

  async updateMyConsents(consents) {
    return this.put('/users/me/consents', { consents });
  }

  async exportMyData(format = 'json') {
    if (format === 'csv') {
      const url = `${this.baseUrl}/users/me/export?format=csv`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al exportar datos');
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'mis_datos.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      return { success: true };
    }
    return this.get('/users/me/export?format=json');
  }

  async deleteMyAccount(reason) {
    return this.deleteWithBody('/users/me/account', { reason });
  }

  async acceptPrivacy() {
    return this.post('/auth/accept-privacy');
  }

  async resendVerificationEmail() {
    return this.post('/auth/resend-verification');
  }

  async opposeDataProcessing(purpose, reason) {
    return this.post('/users/me/oppose', { purpose, reason });
  }

  async getArcopHistory() {
    return this.get('/users/me/arcop-history');
  }

  // ==================== SECURITY INCIDENTS ====================

  async getSecurityIncidents() {
    return this.get('/security-incidents');
  }

  async reportSecurityIncident(data) {
    return this.post('/security-incidents', data);
  }

  async updateSecurityIncident(id, updates) {
    return this.put(`/security-incidents/${id}`, updates);
  }

  // ==================== MUNICIPAL EXPORTS (Ley 19.418) ====================

  async exportMemberRoster(orgId) {
    const url = `${this.baseUrl}/organizations/${orgId}/export/members`;
    const response = await fetch(url, { method: 'GET', headers: this.getHeaders(), credentials: 'include' });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Error al exportar'); }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `nomina_socios_${orgId}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  async exportSemesterChanges(orgId, from, to) {
    const url = `${this.baseUrl}/organizations/${orgId}/export/changes?from=${from}&to=${to}`;
    const response = await fetch(url, { method: 'GET', headers: this.getHeaders(), credentials: 'include' });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Error al exportar'); }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `cambios_${orgId}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  async exportElectionResults(orgId, assemblyId) {
    const url = `${this.baseUrl}/organizations/${orgId}/export/election-results/${assemblyId}`;
    const response = await fetch(url, { method: 'GET', headers: this.getHeaders(), credentials: 'include' });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Error al exportar'); }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `eleccion_${orgId}_${assemblyId}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  // ==================== PASSWORD RECOVERY ====================

  async forgotPassword(email) {
    return this.post('/auth/forgot-password', { email });
  }

  async resetPassword(token, newPassword) {
    return this.post('/auth/reset-password', { token, newPassword });
  }

  // ==================== SUPPORT TICKETS ====================

  async createSupportTicket(data) {
    return this.post('/support/ticket', data);
  }

  // ==================== DIRECTORIO ====================

  async registerDirectorioResignation(orgId, data) {
    return this.post(`/organizations/${orgId}/directorio/renuncia`, data);
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck() {
    return this.get('/health');
  }
}

// Export singleton instance
export const apiService = new ApiService();
