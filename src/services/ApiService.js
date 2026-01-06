/**
 * API Service - Centralized HTTP client for backend communication
 */

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
  }

  /**
   * Get auth token from storage (DEPRECATED - se usa cookies HttpOnly)
   * Mantenido para compatibilidad durante transición
   */
  getToken() {
    return localStorage.getItem('auth_token');
  }

  /**
   * Set auth token (DEPRECATED - se usa cookies HttpOnly)
   * Mantenido para compatibilidad durante transición
   */
  setToken(token) {
    localStorage.setItem('auth_token', token);
  }

  /**
   * Remove auth token (DEPRECATED - se usa cookies HttpOnly)
   * Mantenido para compatibilidad durante transición
   */
  removeToken() {
    localStorage.removeItem('auth_token');
  }

  /**
   * Build headers for request
   * Nota: Ya no enviamos Authorization header, usamos cookies HttpOnly
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    // Durante transición: Mantener header si hay token local
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Make HTTP request
   * Usa credentials: 'include' para enviar cookies HttpOnly automáticamente
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const config = {
      headers: this.getHeaders(),
      credentials: 'include', // IMPORTANTE: Incluir cookies en la petición
      ...options
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la solicitud');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
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

  async login(email, password) {
    const data = await this.post('/auth/login', { email, password });
    if (data.token) {
      this.setToken(data.token);
      // Solo guardar en currentUser si NO es ministro (los ministros usan currentMinistro)
      if (data.user && data.user.role !== 'MINISTRO_FE') {
        localStorage.setItem('currentUser', JSON.stringify(data.user));
      }
    }
    return data;
  }

  async register(userData) {
    const data = await this.post('/auth/register', userData);
    if (data.token) {
      this.setToken(data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
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
   * Logout - Elimina cookie del servidor y limpia localStorage
   */
  async logout() {
    try {
      await this.post('/auth/logout');
    } catch (error) {
      console.warn('Logout endpoint error:', error);
    }
    // Limpiar localStorage (compatibilidad durante transición)
    this.removeToken();
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentMinistro');
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

  async loginMinistro(email, password) {
    const data = await this.post('/ministros/login', { email, password });
    if (data.token) {
      this.setToken(data.token);
      localStorage.setItem('currentMinistro', JSON.stringify(data.ministro));
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
