/**
 * Tests para ApiService
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock IndexedDBService antes de importar ApiService
vi.mock('../infrastructure/database/IndexedDBService.js', () => ({
  indexedDBService: {
    addToOfflineQueue: vi.fn().mockResolvedValue('mock-request-id'),
    getPendingOfflineRequests: vi.fn().mockResolvedValue([]),
    updateOfflineRequestStatus: vi.fn().mockResolvedValue({}),
    removeFromOfflineQueue: vi.fn().mockResolvedValue({})
  }
}));

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

    // Mock window completo con addEventListener
    const eventListeners = {};
    global.window = {
      location: { hostname: 'localhost' },
      addEventListener: vi.fn((event, handler) => {
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(handler);
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    };

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true
    });

    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({ sync: { register: vi.fn() } }),
        addEventListener: vi.fn()
      },
      writable: true,
      configurable: true
    });

    // Mock SyncManager
    global.SyncManager = vi.fn();

    // Import fresh instance
    const module = await import('../services/ApiService.js');
    apiService = module.apiService;
  });

  describe('getApiUrl', () => {
    it('should return localhost URL for local development', () => {
      expect(apiService.baseUrl).toBe('http://localhost:3001/api');
    });
  });

  describe('authentication (HttpOnly cookies)', () => {
    // Nota: Tokens ahora se manejan via HttpOnly cookies
    // No hay setToken/removeToken - el servidor maneja las cookies

    it('should check online status', () => {
      expect(apiService.isOnline()).toBe(true);
    });

    it('should get pending requests count', async () => {
      const count = await apiService.getPendingRequestsCount();
      expect(count).toBe(0);
    });
  });

  describe('getHeaders', () => {
    it('should return headers with Content-Type', () => {
      const headers = apiService.getHeaders();

      expect(headers['Content-Type']).toBe('application/json');
      // Authorization ya no se usa - autenticación via cookies HttpOnly
    });

    it('should use credentials include for cookie auth', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'test' })
      });

      await apiService.request('/test');

      // Verifica que se use credentials: include para enviar cookies
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ credentials: 'include' })
      );
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
    it('should store user on successful login (token via HttpOnly cookie)', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          message: 'Inicio de sesión exitoso',
          user: { _id: '1', email: 'test@example.com', role: 'ORGANIZADOR' }
        })
      });

      const result = await apiService.login('test@example.com', 'password');

      // Token ahora se maneja via HttpOnly cookie, no localStorage
      // Solo se guarda el usuario para la UI
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'currentUser',
        expect.stringContaining('test@example.com')
      );
      expect(result.user.email).toBe('test@example.com');
    });

    it('should not store MINISTRO_FE users in currentUser', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          message: 'Inicio de sesión exitoso',
          user: { _id: '1', email: 'ministro@example.com', role: 'MINISTRO_FE' }
        })
      });

      await apiService.login('ministro@example.com', 'password');

      const setItemCalls = localStorage.setItem.mock.calls;
      const currentUserCall = setItemCalls.find(call => call[0] === 'currentUser');
      expect(currentUserCall).toBeUndefined();
    });
  });

  describe('logout', () => {
    it('should remove user from localStorage and call server logout', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Sesión cerrada' })
      });

      await apiService.logout();

      // Verifica que se elimina el usuario de localStorage
      expect(localStorage.removeItem).toHaveBeenCalledWith('currentUser');
      // Verifica que se llama al endpoint de logout
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/logout',
        expect.objectContaining({ method: 'POST' })
      );
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

    it('should login ministro and store data (token via HttpOnly cookie)', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          message: 'Inicio de sesión exitoso',
          ministro: { _id: '1', firstName: 'Test', lastName: 'Ministro' }
        })
      });

      await apiService.loginMinistro('ministro@example.com', 'password');

      // Token ahora se maneja via HttpOnly cookie, no localStorage
      // Solo se guarda el ministro para la UI
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'currentMinistro',
        expect.stringContaining('Test')
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
