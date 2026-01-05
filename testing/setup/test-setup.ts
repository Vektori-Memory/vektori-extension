/**
 * Test Setup File
 * 
 * Runs before each test file to configure the global test environment.
 * This is specified in vitest.config.ts as the setupFiles entry.
 */

import { vi } from 'vitest';

// Mock window.chrome API globally
// This prevents "chrome is not defined" errors in content script tests
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    },
  },
  identity: {
    launchWebAuthFlow: vi.fn(),
  },
  sidePanel: {
    open: vi.fn().mockResolvedValue(undefined),
    setOptions: vi.fn(),
  },
  tabs: {
    create: vi.fn().mockResolvedValue({ id: 1 }),
    sendMessage: vi.fn(),
  },
} as any;

// Mock window.vektoriToast globally
// This prevents toast initialization errors during tests
global.window = global.window || {};
(global.window as any).vektoriToast = {
  show: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
  update: vi.fn(),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
  authRequired: vi.fn(),
};

// Mock window.vektoriCheckAuth
(global.window as any).vektoriCheckAuth = vi.fn().mockResolvedValue(true);

// Mock window.apiClient
(global.window as any).apiClient = {
  getValidToken: vi.fn().mockResolvedValue('mock-token'),
  makeAuthenticatedRequest: vi.fn().mockResolvedValue({}),
  checkAuthStatus: vi.fn().mockResolvedValue({ isAuthenticated: true }),
  clearAuth: vi.fn().mockResolvedValue(undefined),
  storeAuth: vi.fn().mockResolvedValue(undefined),
  API_BASE_URL: 'http://localhost:8000',
};

// TODO: Add any other global mocks needed for tests
// TODO: Consider moving some of these to individual test files if they need custom behavior

console.log('[Test Setup] Global mocks initialized');
