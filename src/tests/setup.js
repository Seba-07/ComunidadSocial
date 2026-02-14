/**
 * Vitest Test Setup
 * Configuración global para los tests
 */

import { vi } from 'vitest';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = vi.fn();

// Mock window.location
delete window.location;
window.location = {
  hostname: 'localhost',
  href: '',
  assign: vi.fn(),
  reload: vi.fn()
};

// Mock window.addEventListener y removeEventListener (para offline listeners)
const eventListeners = {};
window.addEventListener = vi.fn((event, handler) => {
  if (!eventListeners[event]) eventListeners[event] = [];
  eventListeners[event].push(handler);
});
window.removeEventListener = vi.fn((event, handler) => {
  if (eventListeners[event]) {
    eventListeners[event] = eventListeners[event].filter(h => h !== handler);
  }
});
window.dispatchEvent = vi.fn((event) => {
  const handlers = eventListeners[event.type] || [];
  handlers.forEach(h => h(event));
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true,
  configurable: true
});

// Mock navigator.serviceWorker
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    ready: Promise.resolve({
      sync: {
        register: vi.fn()
      }
    }),
    addEventListener: vi.fn()
  },
  writable: true,
  configurable: true
});

// Mock SyncManager
global.SyncManager = vi.fn();

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockReturnValue(null);
});
