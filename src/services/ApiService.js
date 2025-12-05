/**
 * API Service - Centralized HTTP client for backend communication
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  constructor() {
    this.baseUrl = API_URL;
  }

  /**
   * Get auth token from storage
   */
  getToken() {
    return localStorage.getItem('auth_token');
  }

  /**
   * Set auth token
   */
  setToken(token) {
    localStorage.setItem('auth_token', token);
  }

  /**
   * Remove auth token
   */
  removeToken() {
    localStorage.removeItem('auth_token');
  }

  /**
   * Build headers with auth token
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Make HTTP request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const config = {
      headers: this.getHeaders(),
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
      localStorage.setItem('currentUser', JSON.stringify(data.user));
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

  logout() {
    this.removeToken();
    localStorage.removeItem('currentUser');
  }

  // ==================== ORGANIZATIONS ====================

  async getOrganizations() {
    return this.get('/organizations');
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

  // ==================== HEALTH CHECK ====================

  async healthCheck() {
    return this.get('/health');
  }
}

// Export singleton instance
export const apiService = new ApiService();
