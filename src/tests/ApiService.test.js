/**
 * Tests para ApiService
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a fresh mock for each test
let apiService;

describe('ApiService', () => {
  beforeEach(async () => {
    vi.resetModules();

    // Mock fetch globally
    global.fetch = vi.fn();

    // Mock localStorage
    const localStorageData = {};
    global.localStorage = {
      getItem: vi.fn((key) => localStorageData[key] || null),
      setItem: vi.fn((key, value) => { localStorageData[key] = value; }),
      removeItem: vi.fn((key) => { delete localStorageData[key]; }),
      clear: vi.fn()
    };

    // Mock window.location
    global.window = {
      location: { hostname: 'localhost' }
    };

    // Import fresh instance
    const module = await import('../services/ApiService.js');
    apiService = module.apiService;
  });

  describe('getApiUrl', () => {
    it('should return localhost URL for local development', () => {
      expect(apiService.baseUrl).toBe('http://localhost:3001/api');
    });
  });

  describe('token management', () => {
    it('should get token from localStorage', () => {
      localStorage.getItem.mockReturnValue('test-token');

      const token = apiService.getToken();

      expect(localStorage.getItem).toHaveBeenCalledWith('auth_token');
      expect(token).toBe('test-token');
    });

    it('should set token in localStorage', () => {
      apiService.setToken('new-token');

      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'new-token');
    });

    it('should remove token from localStorage', () => {
      apiService.removeToken();

      expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('getHeaders', () => {
    it('should return headers with Content-Type', () => {
      localStorage.getItem.mockReturnValue(null);

      const headers = apiService.getHeaders();

      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should include Authorization header when token exists', () => {
      localStorage.getItem.mockReturnValue('test-token');

      const headers = apiService.getHeaders();

      expect(headers['Authorization']).toBe('Bearer test-token');
    });
  });

  describe('request', () => {
    it('should make fetch request with correct URL', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'test' })
      });

      await apiService.request('/test');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/test',
        expect.any(Object)
      );
    });

    it('should stringify body objects', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      await apiService.request('/test', {
        method: 'POST',
        body: { name: 'test' }
      });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/test',
        expect.objectContaining({
          body: JSON.stringify({ name: 'test' })
        })
      );
    });

    it('should throw error for non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Bad Request' })
      });

      await expect(apiService.request('/test')).rejects.toThrow('Bad Request');
    });
  });

  describe('HTTP methods', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });

    it('should make GET request', async () => {
      await apiService.get('/users');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/users',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should make POST request', async () => {
      await apiService.post('/users', { name: 'Test' });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test' })
        })
      );
    });

    it('should make PUT request', async () => {
      await apiService.put('/users/1', { name: 'Updated' });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/users/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated' })
        })
      );
    });

    it('should make DELETE request', async () => {
      await apiService.delete('/users/1');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/users/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('login', () => {
    it('should store token and user on successful login', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          token: 'jwt-token',
          user: { id: '1', email: 'test@example.com', role: 'ORGANIZADOR' }
        })
      });

      const result = await apiService.login('test@example.com', 'password');

      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'jwt-token');
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'currentUser',
        expect.stringContaining('test@example.com')
      );
      expect(result.token).toBe('jwt-token');
    });

    it('should not store MINISTRO_FE users in currentUser', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          token: 'jwt-token',
          user: { id: '1', email: 'ministro@example.com', role: 'MINISTRO_FE' }
        })
      });

      await apiService.login('ministro@example.com', 'password');

      const setItemCalls = localStorage.setItem.mock.calls;
      const currentUserCall = setItemCalls.find(call => call[0] === 'currentUser');
      expect(currentUserCall).toBeUndefined();
    });
  });

  describe('logout', () => {
    it('should remove token and user from localStorage', () => {
      apiService.logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('currentUser');
    });
  });

  describe('organization endpoints', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });
    });

    it('should fetch organizations', async () => {
      await apiService.getOrganizations();
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/organizations',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should fetch my organizations', async () => {
      await apiService.getMyOrganizations();
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/organizations/my',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should fetch organization by id', async () => {
      await apiService.getOrganization('123');
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/organizations/123',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should create organization', async () => {
      await apiService.createOrganization({ name: 'Test Org' });
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/organizations',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should update organization status', async () => {
      await apiService.updateOrgStatus('123', 'approved', 'Looks good');
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/organizations/123/status',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should create member accounts', async () => {
      await apiService.createMemberAccounts('org123');
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/organizations/org123/create-member-accounts',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('notification endpoints', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });
    });

    it('should fetch notifications', async () => {
      await apiService.getNotifications();
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/notifications',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should fetch unread notifications', async () => {
      await apiService.getUnreadNotifications();
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/notifications/unread',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should mark notification as read', async () => {
      await apiService.markNotificationRead('notif123');
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/notifications/notif123/read',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should mark all as read', async () => {
      await apiService.markAllNotificationsRead();
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/notifications/read-all',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should delete notification', async () => {
      await apiService.deleteNotification('notif123');
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/notifications/notif123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('ministro endpoints', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    it('should fetch ministros', async () => {
      await apiService.getMinistros();
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/ministros',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should login ministro and store data', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          token: 'ministro-token',
          ministro: { id: '1', name: 'Test Ministro' }
        })
      });

      await apiService.loginMinistro('ministro@example.com', 'password');

      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'ministro-token');
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'currentMinistro',
        expect.stringContaining('Test Ministro')
      );
    });
  });

  describe('health check', () => {
    it('should call health endpoint', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' })
      });

      const result = await apiService.healthCheck();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/health',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.status).toBe('ok');
    });
  });
});
