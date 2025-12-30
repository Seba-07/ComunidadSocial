/**
 * Tests para NotificationService
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock del apiService antes de importar NotificationService
vi.mock('../services/ApiService.js', () => ({
  apiService: {
    getToken: vi.fn(),
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    getUnreadNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    deleteNotification: vi.fn(),
    createNotification: vi.fn()
  }
}));

import { notificationService } from '../services/NotificationService.js';
import { apiService } from '../services/ApiService.js';

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationService.notifications = [];
    notificationService.unreadCount = 0;
    notificationService.listeners = [];
    notificationService.isPolling = false;
    notificationService.pollInterval = null;
  });

  afterEach(() => {
    notificationService.stopPolling();
  });

  describe('startPolling', () => {
    it('should not start polling if no token', () => {
      apiService.getToken.mockReturnValue(null);

      notificationService.startPolling();

      expect(notificationService.isPolling).toBe(false);
    });

    it('should start polling if token exists', () => {
      apiService.getToken.mockReturnValue('valid-token');
      apiService.getNotifications.mockResolvedValue([]);
      apiService.getUnreadCount.mockResolvedValue({ count: 0 });

      notificationService.startPolling();

      expect(notificationService.isPolling).toBe(true);
    });

    it('should not start polling twice', () => {
      apiService.getToken.mockReturnValue('valid-token');
      apiService.getNotifications.mockResolvedValue([]);
      apiService.getUnreadCount.mockResolvedValue({ count: 0 });

      notificationService.startPolling();
      notificationService.startPolling();

      expect(apiService.getNotifications).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopPolling', () => {
    it('should stop polling and clear interval', () => {
      apiService.getToken.mockReturnValue('valid-token');
      apiService.getNotifications.mockResolvedValue([]);
      apiService.getUnreadCount.mockResolvedValue({ count: 0 });

      notificationService.startPolling();
      notificationService.stopPolling();

      expect(notificationService.isPolling).toBe(false);
      expect(notificationService.pollInterval).toBe(null);
    });
  });

  describe('loadFromServer', () => {
    it('should load notifications and update state', async () => {
      const mockNotifications = [
        { _id: '1', title: 'Test', message: 'Test message', read: false },
        { _id: '2', title: 'Test 2', message: 'Test message 2', read: true }
      ];

      apiService.getToken.mockReturnValue('valid-token');
      apiService.getNotifications.mockResolvedValue(mockNotifications);
      apiService.getUnreadCount.mockResolvedValue({ count: 1 });

      await notificationService.loadFromServer();

      expect(notificationService.notifications).toEqual(mockNotifications);
      expect(notificationService.unreadCount).toBe(1);
      expect(notificationService.loaded).toBe(true);
    });

    it('should stop polling if no token during load', async () => {
      apiService.getToken.mockReturnValue(null);

      notificationService.isPolling = true;
      await notificationService.loadFromServer();

      expect(notificationService.isPolling).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should add listener and return unsubscribe function', () => {
      const listener = vi.fn();

      const unsubscribe = notificationService.subscribe(listener);

      expect(notificationService.listeners).toContain(listener);

      unsubscribe();

      expect(notificationService.listeners).not.toContain(listener);
    });

    it('should notify listeners when state changes', () => {
      const listener = vi.fn();
      notificationService.subscribe(listener);

      notificationService.notifications = [{ _id: '1' }];
      notificationService.unreadCount = 1;
      notificationService.notifyListeners();

      expect(listener).toHaveBeenCalledWith({
        notifications: [{ _id: '1' }],
        unreadCount: 1
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read and update count', async () => {
      notificationService.notifications = [
        { _id: '1', read: false },
        { _id: '2', read: false }
      ];
      notificationService.unreadCount = 2;

      apiService.markNotificationRead.mockResolvedValue({ _id: '1', read: true });

      await notificationService.markAsRead('1');

      expect(notificationService.notifications[0].read).toBe(true);
      expect(notificationService.unreadCount).toBe(1);
    });

    it('should not decrease count for already read notification', async () => {
      notificationService.notifications = [{ _id: '1', read: true }];
      notificationService.unreadCount = 0;

      apiService.markNotificationRead.mockResolvedValue({ _id: '1', read: true });

      await notificationService.markAsRead('1');

      expect(notificationService.unreadCount).toBe(0);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      notificationService.notifications = [
        { _id: '1', read: false },
        { _id: '2', read: false }
      ];
      notificationService.unreadCount = 2;

      apiService.markAllNotificationsRead.mockResolvedValue({});

      await notificationService.markAllAsRead();

      expect(notificationService.notifications.every(n => n.read)).toBe(true);
      expect(notificationService.unreadCount).toBe(0);
    });
  });

  describe('delete', () => {
    it('should remove notification from list', async () => {
      notificationService.notifications = [
        { _id: '1', read: true },
        { _id: '2', read: false }
      ];
      notificationService.unreadCount = 1;

      apiService.deleteNotification.mockResolvedValue({});

      await notificationService.delete('1');

      expect(notificationService.notifications).toHaveLength(1);
      expect(notificationService.notifications[0]._id).toBe('2');
    });

    it('should decrease unread count when deleting unread notification', async () => {
      notificationService.notifications = [
        { _id: '1', read: false },
        { _id: '2', read: false }
      ];
      notificationService.unreadCount = 2;

      apiService.deleteNotification.mockResolvedValue({});

      await notificationService.delete('1');

      expect(notificationService.unreadCount).toBe(1);
    });
  });

  describe('create', () => {
    it('should add new notification to list', async () => {
      const newNotification = { _id: '3', title: 'New', message: 'New notification' };
      apiService.createNotification.mockResolvedValue(newNotification);

      await notificationService.create({ title: 'New', message: 'New notification' });

      expect(notificationService.notifications[0]).toEqual(newNotification);
      expect(notificationService.unreadCount).toBe(1);
    });
  });

  describe('getToastType', () => {
    it('should return success for approval notifications', () => {
      expect(notificationService.getToastType('organization_approved')).toBe('success');
      expect(notificationService.getToastType('member_accounts_created')).toBe('success');
      expect(notificationService.getToastType('welcome_member')).toBe('success');
    });

    it('should return warning for reminder notifications', () => {
      expect(notificationService.getToastType('correction_required')).toBe('warning');
      expect(notificationService.getToastType('assembly_reminder')).toBe('warning');
      expect(notificationService.getToastType('election_reminder')).toBe('warning');
    });

    it('should return error for rejection notifications', () => {
      expect(notificationService.getToastType('organization_rejected')).toBe('error');
      expect(notificationService.getToastType('member_removed')).toBe('error');
    });

    it('should return info for general notifications', () => {
      expect(notificationService.getToastType('general')).toBe('info');
      expect(notificationService.getToastType('new_assignment')).toBe('info');
    });
  });

  describe('getNotificationIcon', () => {
    it('should return appropriate emoji for notification types', () => {
      expect(notificationService.getNotificationIcon('ministro_assigned')).toBe('👨‍⚖️');
      expect(notificationService.getNotificationIcon('organization_approved')).toBe('✅');
      expect(notificationService.getNotificationIcon('organization_rejected')).toBe('❌');
      expect(notificationService.getNotificationIcon('new_assembly')).toBe('🏛️');
      expect(notificationService.getNotificationIcon('election_announced')).toBe('🗳️');
    });

    it('should return default bell for unknown types', () => {
      expect(notificationService.getNotificationIcon('unknown_type')).toBe('🔔');
    });
  });

  describe('formatDate', () => {
    it('should return "Ahora" for very recent dates', () => {
      const now = new Date().toISOString();
      expect(notificationService.formatDate(now)).toBe('Ahora');
    });

    it('should return minutes ago for recent dates', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(notificationService.formatDate(fiveMinutesAgo)).toBe('Hace 5 min');
    });

    it('should return hours ago for dates within 24 hours', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(notificationService.formatDate(twoHoursAgo)).toBe('Hace 2h');
    });

    it('should return days ago for dates within a week', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(notificationService.formatDate(threeDaysAgo)).toBe('Hace 3 días');
    });
  });

  describe('getAll and getUnread', () => {
    it('should return all notifications', () => {
      notificationService.notifications = [
        { _id: '1', read: true },
        { _id: '2', read: false }
      ];

      expect(notificationService.getAll()).toHaveLength(2);
    });

    it('should return only unread notifications', () => {
      notificationService.notifications = [
        { _id: '1', read: true },
        { _id: '2', read: false }
      ];

      expect(notificationService.getUnread()).toHaveLength(1);
      expect(notificationService.getUnread()[0]._id).toBe('2');
    });
  });

  describe('getUnreadCount', () => {
    it('should return current unread count', () => {
      notificationService.unreadCount = 5;
      expect(notificationService.getUnreadCount()).toBe(5);
    });
  });
});
