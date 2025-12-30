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
