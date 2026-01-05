/**
 * Popup State Management Tests
 * 
 * Tests for popup.js - comprehensive coverage of state management,
 * view rendering, and user interactions.
 * 
 * Coverage:
 * - State management (setState, transitions)
 * - View rendering (loading, signedOut, signedIn, queryMemory, error)
 * - Event handlers (sign in, sign out, toggle auto-save, query)
 * - Auth integration
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Type definitions for our test environment
interface AppState {
  view: 'loading' | 'signedOut' | 'signedIn' | 'error' | 'queryMemory';
  user: any;
  autoSaveEnabled: boolean;
  statusMessage: string;
  errorMessage: string;
  isProcessing: boolean;
  queryResults: any;
  queryInProgress: boolean;
}

interface PopupGlobals {
  appState: AppState;
  setState: (updates: Partial<AppState>) => void;
  render: () => void;
  renderLoadingView: () => string;
  renderSignedOutView: () => string;
  renderSignedInView: () => string;
  renderQueryMemoryView: () => string;
  renderErrorView: () => string;
  handleGoogleSignIn: () => Promise<void>;
  handleSignOut: () => Promise<void>;
  handleAutoSaveToggle: (enabled: boolean) => Promise<void>;
  handleQueryMemory: (query: string) => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  escapeHtml: (text: string) => string;
  getUserInitials: (name: string) => string;
}

let dom: JSDOM;
let document: Document;
let window: Window & typeof globalThis & { popupGlobals?: PopupGlobals };
let chrome: any;
let popupGlobals: PopupGlobals;

function setupDOM() {
  dom = new JSDOM(`<!DOCTYPE html>
    <html>
      <head></head>
      <body>
        <div id="app-container"></div>
      </body>
    </html>`, {
    url: 'chrome-extension://test/popup.html',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    resources: 'usable'
  });
  
  document = dom.window.document;
  window = dom.window as any;
  
  global.document = document;
  global.window = window as any;
  
  // Mock Chrome APIs
  chrome = {
    runtime: {
      getManifest: vi.fn(() => ({
        oauth2: {
          client_id: 'test-client-id',
          scopes: ['openid', 'email', 'profile']
        }
      })),
      sendMessage: vi.fn(),
      id: 'test-extension-id',
      lastError: null
    },
    identity: {
      launchWebAuthFlow: vi.fn()
    },
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn()
      }
    }
  };
  
  (window as any).chrome = chrome;
  
  // Mock apiClient
  (window as any).apiClient = {
    API_BASE_URL: 'https://api.test.com',
    checkAuthStatus: vi.fn(),
    getValidToken: vi.fn(),
    makeAuthenticatedRequest: vi.fn(),
    storeAuth: vi.fn(),
    clearAuth: vi.fn()
  };
}

function loadPopupCode() {
  const fs = require('fs');
  const path = require('path');
  const popupCode = fs.readFileSync(
    path.join(__dirname, '../../popup.js'),
    'utf-8'
  );
  
  // Intercept DOMContentLoaded registration to prevent auto-initialization
  // This keeps the script syntactically valid while giving tests control
  let capturedDOMContentLoadedCallback: Function | null = null;
  
  const originalAddEventListener = document.addEventListener;
  document.addEventListener = function(this: Document, event: string, callback: any, ...args: any[]) {
    if (event === 'DOMContentLoaded') {
      // Capture the callback instead of registering it
      capturedDOMContentLoadedCallback = callback;
      return;
    }
    // Pass through all other event listeners normally
    return originalAddEventListener.call(this, event, callback, ...args);
  } as any;
  
  // Execute in the test environment - DOMContentLoaded won't actually fire
  const scriptElement = document.createElement('script');
  scriptElement.textContent = popupCode;
  document.head.appendChild(scriptElement);
  
  // Restore original addEventListener
  document.addEventListener = originalAddEventListener;
  
  // Wait a tick for script to execute
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      // Extract functions from window.popupGlobals (now exposed by popup.js)
      popupGlobals = (window as any).popupGlobals;
      
      if (!popupGlobals) {
        throw new Error('popupGlobals not found - popup.js may not have loaded correctly');
      }
      
      resolve();
    }, 0);
  });
}

describe('Popup State Management - Core', () => {
  beforeEach(async () => {
    setupDOM();
    await loadPopupCode();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with loading state', () => {
    // Check initial state (before DOMContentLoaded auto-runs)
    // Since we removed auto DOMContentLoaded dispatch, appState should be at initial value
    expect(popupGlobals.appState.view).toBe('loading');
    expect(popupGlobals.appState.user).toBeNull();
    expect(popupGlobals.appState.autoSaveEnabled).toBe(true);
  });

  it('should update state with setState', () => {
    popupGlobals.setState({ view: 'signedIn', user: { name: 'Test' } });
    
    expect(popupGlobals.appState.view).toBe('signedIn');
    expect(popupGlobals.appState.user.name).toBe('Test');
  });

  it('should preserve unmodified state properties', () => {
    const originalAutoSave = popupGlobals.appState.autoSaveEnabled;
    
    popupGlobals.setState({ view: 'signedOut' });
    
    expect(popupGlobals.appState.autoSaveEnabled).toBe(originalAutoSave);
  });

  it('should trigger render on setState', () => {
    // Trigger initial render
    popupGlobals.render();
    
    const container = document.getElementById('app-container');
    expect(container?.innerHTML).toBeTruthy();
    
    const initialHtml = container?.innerHTML;
    
    // Change state and verify render happened
    popupGlobals.setState({ view: 'signedOut' });
    
    expect(container?.innerHTML).not.toBe(initialHtml);
    expect(container?.innerHTML).toContain('view-signed-out');
  });
});

describe('Popup State Management - View Rendering', () => {
  beforeEach(async () => {
    setupDOM();
    await loadPopupCode();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render loading view', () => {
    popupGlobals.setState({ 
      view: 'loading', 
      statusMessage: 'Checking your session...' 
    });
    
    const container = document.getElementById('app-container');
    
    expect(container?.innerHTML).toContain('view-loading');
    expect(container?.innerHTML).toContain('Checking your session...');
    expect(container?.querySelector('.spinner')).toBeTruthy();
  });

  it('should render signed out view', () => {
    popupGlobals.setState({ view: 'signedOut' });
    
    const container = document.getElementById('app-container');
    
    expect(container?.innerHTML).toContain('view-signed-out');
    expect(container?.innerHTML).toContain('Vektori Memory');
    expect(container?.querySelector('#signin-btn')).toBeTruthy();
  });

  it('should render error banner in signed out view', () => {
    popupGlobals.setState({ 
      view: 'signedOut',
      errorMessage: 'Authentication failed'
    });
    
    const container = document.getElementById('app-container');
    
    expect(container?.innerHTML).toContain('banner-error');
    expect(container?.innerHTML).toContain('Authentication failed');
  });

  it('should render signed in view with user info', () => {
    popupGlobals.setState({ 
      view: 'signedIn',
      user: {
        name: 'John Doe',
        email: 'john@example.com'
      }
    });
    
    const container = document.getElementById('app-container');
    
    expect(container?.innerHTML).toContain('view-signed-in');
    expect(container?.innerHTML).toContain('John Doe');
    expect(container?.innerHTML).toContain('john@example.com');
    expect(container?.querySelector('#auto-save-toggle')).toBeTruthy();
    expect(container?.querySelector('#query-memory-btn')).toBeTruthy();
    expect(container?.querySelector('#signout-btn')).toBeTruthy();
  });

  it('should render checked auto-save toggle when enabled', () => {
    popupGlobals.setState({ 
      view: 'signedIn',
      user: { name: 'Test' },
      autoSaveEnabled: true
    });
    
    const toggle = document.getElementById('auto-save-toggle') as HTMLInputElement;
    expect(toggle?.checked).toBe(true);
  });

  it('should render unchecked auto-save toggle when disabled', () => {
    popupGlobals.setState({ 
      view: 'signedIn',
      user: { name: 'Test' },
      autoSaveEnabled: false
    });
    
    const toggle = document.getElementById('auto-save-toggle') as HTMLInputElement;
    expect(toggle?.checked).toBe(false);
  });

  it('should render query memory view', () => {
    popupGlobals.setState({ view: 'queryMemory' });
    
    const container = document.getElementById('app-container');
    
    expect(container?.innerHTML).toContain('view-query-memory');
    expect(container?.querySelector('#query-input')).toBeTruthy();
    expect(container?.querySelector('#submit-query-btn')).toBeTruthy();
    expect(container?.querySelector('#back-btn')).toBeTruthy();
  });

  it('should render query results when available', () => {
    popupGlobals.setState({ 
      view: 'queryMemory',
      queryResults: {
        has_context: true,
        context: 'This is the relevant context',
        results: [{ score: 0.9 }, { score: 0.8 }]
      }
    });
    
    const container = document.getElementById('app-container');
    
    expect(container?.innerHTML).toContain('Relevant Context');
    expect(container?.innerHTML).toContain('This is the relevant context');
    expect(container?.innerHTML).toContain('2 context pieces retrieved');
  });

  it('should render empty state when no results', () => {
    popupGlobals.setState({ 
      view: 'queryMemory',
      queryResults: {
        has_context: false,
        context: '',
        results: []
      }
    });
    
    const container = document.getElementById('app-container');
    
    expect(container?.innerHTML).toContain('No relevant context found');
  });

  it('should render error view', () => {
    popupGlobals.setState({ 
      view: 'error',
      errorMessage: 'Something went wrong'
    });
    
    const container = document.getElementById('app-container');
    
    expect(container?.innerHTML).toContain('view-error');
    expect(container?.innerHTML).toContain('Something went wrong');
    expect(container?.querySelector('#retry-btn')).toBeTruthy();
    expect(container?.querySelector('#signout-btn')).toBeTruthy();
  });

  it('should disable buttons when processing', () => {
    popupGlobals.setState({ 
      view: 'signedOut',
      isProcessing: true
    });
    
    const signinBtn = document.getElementById('signin-btn');
    expect(signinBtn?.hasAttribute('disabled')).toBe(true);
  });
});

describe('Popup State Management - Helper Functions', () => {
  beforeEach(async () => {
    setupDOM();
    await loadPopupCode();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should escape HTML entities', () => {
    const escaped = popupGlobals.escapeHtml('<script>alert("xss")</script>');
    
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });

  it('should get user initials from full name', () => {
    const initials = popupGlobals.getUserInitials('John Doe');
    expect(initials).toBe('JD');
  });

  it('should get initials from single name', () => {
    const initials = popupGlobals.getUserInitials('John');
    expect(initials).toBe('JO');
  });

  it('should handle empty name gracefully', () => {
    const initials = popupGlobals.getUserInitials('');
    expect(initials).toBe('?');
  });

  it('should handle multi-word names', () => {
    const initials = popupGlobals.getUserInitials('John William Doe');
    expect(initials).toBe('JD');
  });
});

describe('Popup State Management - Auth Flow', () => {
  beforeEach(async () => {
    setupDOM();
    await loadPopupCode();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should check auth status on load', async () => {
    const apiClient = (window as any).apiClient;
    apiClient.checkAuthStatus.mockResolvedValue({
      isAuthenticated: true,
      user: { name: 'Test User', email: 'test@example.com' }
    });
    
    await popupGlobals.checkAuthStatus();
    
    expect(apiClient.checkAuthStatus).toHaveBeenCalled();
    expect(popupGlobals.appState.view).toBe('signedIn');
    expect(popupGlobals.appState.user.name).toBe('Test User');
  });

  it('should show signed out view when not authenticated', async () => {
    const apiClient = (window as any).apiClient;
    apiClient.checkAuthStatus.mockResolvedValue({
      isAuthenticated: false,
      canRefresh: false
    });
    
    await popupGlobals.checkAuthStatus();
    
    expect(popupGlobals.appState.view).toBe('signedOut');
  });

  it('should attempt token refresh when expired', async () => {
    const apiClient = (window as any).apiClient;
    
    // First call: token expired, can refresh
    apiClient.checkAuthStatus
      .mockResolvedValueOnce({
        isAuthenticated: false,
        canRefresh: true
      })
      .mockResolvedValueOnce({
        isAuthenticated: true,
        user: { name: 'Test' }
      });
    
    apiClient.getValidToken.mockResolvedValue('new-token');
    
    await popupGlobals.checkAuthStatus();
    
    expect(apiClient.getValidToken).toHaveBeenCalled();
    expect(popupGlobals.appState.view).toBe('signedIn');
  });

  it('should handle refresh failure gracefully', async () => {
    const apiClient = (window as any).apiClient;
    
    apiClient.checkAuthStatus.mockResolvedValue({
      isAuthenticated: false,
      canRefresh: true
    });
    
    apiClient.getValidToken.mockRejectedValue(new Error('Refresh failed'));
    
    await popupGlobals.checkAuthStatus();
    
    expect(popupGlobals.appState.view).toBe('signedOut');
  });

  it('should handle auth check errors', async () => {
    const apiClient = (window as any).apiClient;
    apiClient.checkAuthStatus.mockRejectedValue(new Error('Network error'));
    
    await popupGlobals.checkAuthStatus();
    
    expect(popupGlobals.appState.view).toBe('error');
    expect(popupGlobals.appState.errorMessage).toContain('Failed to check authentication');
  });
});

describe('Popup State Management - Sign In Flow', () => {
  beforeEach(async () => {
    setupDOM();
    await loadPopupCode();
    // Use real timers for OAuth flow tests (setImmediate doesn't work with fake timers)
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should launch OAuth flow on sign in', async () => {
    popupGlobals.setState({ view: 'signedOut' });
    
    chrome.identity.launchWebAuthFlow.mockImplementation((options: any, callback: any) => {
      // Simulate successful OAuth redirect - execute callback in next tick
      setImmediate(() => {
        callback('https://test-extension-id.chromiumapp.org/#id_token=test-token');
      });
    });
    
    // Mock fetch on window (not global) since popup.js runs in JSDOM
    (window as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: Date.now() / 1000 + 3600,
        user: { name: 'Test', email: 'test@example.com' }
      })
    });
    
    // Call handleGoogleSignIn (doesn't wait for callback)
    popupGlobals.handleGoogleSignIn();
    
    // Wait for setImmediate callback and any promises
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve)); // Extra tick for fetch
    
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalled();
    expect((window as any).fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/google-signin'),
      expect.any(Object)
    );
  });

  it('should store auth data on successful sign in', async () => {
    const apiClient = (window as any).apiClient;
    
    chrome.identity.launchWebAuthFlow.mockImplementation((options: any, callback: any) => {
      setImmediate(() => {
        callback('https://test-extension-id.chromiumapp.org/#id_token=test-token');
      });
    });
    
    // Mock fetch on window (not global) since popup.js runs in JSDOM
    (window as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: Date.now() / 1000 + 3600,
        user: { name: 'Test', email: 'test@example.com', id: 'user-123' }
      })
    });
    
    // Call handleGoogleSignIn (doesn't wait for callback)
    popupGlobals.handleGoogleSignIn();
    
    // Wait for setImmediate callback and promises
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve)); // Extra tick for fetch
    
    expect(apiClient.storeAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: expect.objectContaining({ name: 'Test' })
      })
    );
    
    expect(popupGlobals.appState.view).toBe('signedIn');
  });

  it('should handle OAuth cancellation', async () => {
    chrome.identity.launchWebAuthFlow.mockImplementation((options: any, callback: any) => {
      chrome.runtime.lastError = { message: 'User cancelled' };
      callback(null);
    });
    
    await popupGlobals.handleGoogleSignIn();
    
    expect(popupGlobals.appState.isProcessing).toBe(false);
    expect(popupGlobals.appState.errorMessage).toBeTruthy();
    
    chrome.runtime.lastError = null;
  });

  it('should handle backend authentication failure', async () => {
    chrome.identity.launchWebAuthFlow.mockImplementation((options: any, callback: any) => {
      callback('https://test-extension-id.chromiumapp.org/#id_token=test-token');
    });
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401
    });
    
    await popupGlobals.handleGoogleSignIn();
    
    expect(popupGlobals.appState.isProcessing).toBe(false);
    expect(popupGlobals.appState.errorMessage).toBeTruthy();
  });

  it('should handle missing ID token', async () => {
    chrome.identity.launchWebAuthFlow.mockImplementation((options: any, callback: any) => {
      callback('https://test-extension-id.chromiumapp.org/#access_token=invalid');
    });
    
    await popupGlobals.handleGoogleSignIn();
    
    expect(popupGlobals.appState.isProcessing).toBe(false);
    expect(popupGlobals.appState.errorMessage).toBeTruthy();
  });
});

describe('Popup State Management - Sign Out Flow', () => {
  beforeEach(async () => {
    setupDOM();
    await loadPopupCode();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should clear auth data on sign out', async () => {
    const apiClient = (window as any).apiClient;
    
    popupGlobals.setState({ 
      view: 'signedIn',
      user: { name: 'Test' }
    });
    
    await popupGlobals.handleSignOut();
    
    expect(apiClient.clearAuth).toHaveBeenCalled();
    expect(popupGlobals.appState.view).toBe('signedOut');
    expect(popupGlobals.appState.user).toBeNull();
  });

  it('should handle sign out errors gracefully', async () => {
    const apiClient = (window as any).apiClient;
    
    // Mock clearAuth to throw once, then succeed
    // (the real implementation calls clearAuth twice - once in try, once in catch)
    let callCount = 0;
    const originalClearAuth = apiClient.clearAuth;
    apiClient.clearAuth = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Storage error');
      }
      // Second call succeeds
    });
    
    // This should not throw - error is caught internally
    await popupGlobals.handleSignOut();
    
    // Should still clear state even on error
    expect(popupGlobals.appState.view).toBe('signedOut');
    expect(popupGlobals.appState.user).toBeNull();
    
    // Restore
    apiClient.clearAuth = originalClearAuth;
  });
});

describe('Popup State Management - Auto-Save Toggle', () => {
  beforeEach(async () => {
    setupDOM();
    await loadPopupCode();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should save auto-save preference to storage', async () => {
    chrome.storage.local.set.mockResolvedValue(undefined);
    
    await popupGlobals.handleAutoSaveToggle(true);
    
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ autoSaveEnabled: true });
    expect(popupGlobals.appState.autoSaveEnabled).toBe(true);
  });

  it('should update status message on toggle', async () => {
    chrome.storage.local.set.mockResolvedValue(undefined);
    
    await popupGlobals.handleAutoSaveToggle(true);
    
    expect(popupGlobals.appState.statusMessage).toContain('enabled');
    
    await popupGlobals.handleAutoSaveToggle(false);
    
    expect(popupGlobals.appState.statusMessage).toContain('disabled');
  });

  it('should reset status message after delay', async () => {
    chrome.storage.local.set.mockResolvedValue(undefined);
    
    await popupGlobals.handleAutoSaveToggle(true);
    
    expect(popupGlobals.appState.statusMessage).toContain('enabled');
    
    await vi.advanceTimersByTimeAsync(2000);
    
    expect(popupGlobals.appState.statusMessage).toContain('Ready');
  });

  it('should handle storage errors', async () => {
    chrome.storage.local.set.mockRejectedValue(new Error('Storage error'));
    
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await popupGlobals.handleAutoSaveToggle(true);
    
    expect(consoleError).toHaveBeenCalled();
  });
});

describe('Popup State Management - Query Memory', () => {
  beforeEach(async () => {
    setupDOM();
    await loadPopupCode();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should navigate to query view', () => {
    popupGlobals.setState({ view: 'signedIn', user: { name: 'Test' } });
    
    // Simulate query button click
    popupGlobals.setState({ view: 'queryMemory', queryResults: null, queryInProgress: false });
    
    expect(popupGlobals.appState.view).toBe('queryMemory');
  });

  it('should make API request with query', async () => {
    const apiClient = (window as any).apiClient;
    
    popupGlobals.setState({ 
      view: 'queryMemory',
      user: { id: 'user-123' }
    });
    
    apiClient.makeAuthenticatedRequest.mockResolvedValue({
      context: 'Relevant context found',
      results: [{ score: 0.9 }]
    });
    
    await popupGlobals.handleQueryMemory('test query');
    
    expect(apiClient.makeAuthenticatedRequest).toHaveBeenCalledWith(
      expect.stringContaining('/api/retrieve'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('test query')
      })
    );
  });

  it('should display query results', async () => {
    const apiClient = (window as any).apiClient;
    
    popupGlobals.setState({ 
      view: 'queryMemory',
      user: { id: 'user-123' }
    });
    
    apiClient.makeAuthenticatedRequest.mockResolvedValue({
      context: 'Found relevant information',
      results: [{ score: 0.9 }]
    });
    
    await popupGlobals.handleQueryMemory('test query');
    
    expect(popupGlobals.appState.queryResults.has_context).toBe(true);
    expect(popupGlobals.appState.queryResults.context).toContain('Found relevant information');
    expect(popupGlobals.appState.queryInProgress).toBe(false);
  });

  it('should handle empty query results', async () => {
    const apiClient = (window as any).apiClient;
    
    popupGlobals.setState({ 
      view: 'queryMemory',
      user: { id: 'user-123' }
    });
    
    apiClient.makeAuthenticatedRequest.mockResolvedValue({
      context: 'NO_RELEVANT_CONTEXT',
      results: []
    });
    
    await popupGlobals.handleQueryMemory('test query');
    
    expect(popupGlobals.appState.queryResults.has_context).toBe(false);
  });

  it('should reject queries that are too short', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    await popupGlobals.handleQueryMemory('ab');
    
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('at least 3 characters')
    );
  });

  it('should require authenticated user', async () => {
    popupGlobals.setState({ 
      view: 'queryMemory',
      user: null
    });
    
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    await popupGlobals.handleQueryMemory('test query');
    
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('User not authenticated')
    );
  });

  it('should handle query errors', async () => {
    const apiClient = (window as any).apiClient;
    
    popupGlobals.setState({ 
      view: 'queryMemory',
      user: { id: 'user-123' }
    });
    
    apiClient.makeAuthenticatedRequest.mockRejectedValue(new Error('API error'));
    
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    await popupGlobals.handleQueryMemory('test query');
    
    expect(popupGlobals.appState.queryInProgress).toBe(false);
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to query memory')
    );
  });

  it('should navigate back from query view', () => {
    popupGlobals.setState({ view: 'queryMemory' });
    
    // Simulate back button
    popupGlobals.setState({ view: 'signedIn', queryResults: null, queryInProgress: false });
    
    expect(popupGlobals.appState.view).toBe('signedIn');
    expect(popupGlobals.appState.queryResults).toBeNull();
  });
});

describe('Popup State Management - Error Handling', () => {
  beforeEach(async () => {
    setupDOM();
    await loadPopupCode();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show error view on critical failure', () => {
    popupGlobals.setState({ 
      view: 'error',
      errorMessage: 'Critical error occurred'
    });
    
    expect(popupGlobals.appState.view).toBe('error');
    
    const container = document.getElementById('app-container');
    expect(container?.innerHTML).toContain('Critical error occurred');
  });

  it('should retry from error view', async () => {
    const apiClient = (window as any).apiClient;
    
    popupGlobals.setState({ view: 'error' });
    
    apiClient.checkAuthStatus.mockResolvedValue({
      isAuthenticated: true,
      user: { name: 'Test' }
    });
    
    // Simulate retry button click
    popupGlobals.setState({ view: 'loading', errorMessage: '' });
    await popupGlobals.checkAuthStatus();
    
    expect(popupGlobals.appState.view).toBe('signedIn');
    expect(popupGlobals.appState.errorMessage).toBe('');
  });

  it('should allow sign out from error view', async () => {
    const apiClient = (window as any).apiClient;
    
    popupGlobals.setState({ view: 'error' });
    
    await popupGlobals.handleSignOut();
    
    expect(popupGlobals.appState.view).toBe('signedOut');
  });
});
