/**
 * Chrome API Mock Utilities
 * 
 * Provides mock implementations of Chrome Extension APIs for testing.
 * These mocks simulate the behavior of chrome.runtime, chrome.storage, etc.
 * 
 * Usage in tests:
 * ```ts
 * import { createChromeRuntimeMock, resetChromeMock } from '@/testing/utils/chrome-mock';
 * 
 * beforeEach(() => {
 *   const mockChrome = createChromeRuntimeMock();
 *   global.chrome = mockChrome;
 * });
 * 
 * afterEach(() => {
 *   resetChromeMock();
 * });
 * ```
 */

// TODO: Implement in Phase 1 when writing unit tests
// This stub is here to satisfy TypeScript imports during Phase 0 setup

export interface ChromeRuntimeMock {
  runtime: {
    sendMessage: (...args: any[]) => void;
    onMessage: {
      addListener: (...args: any[]) => void;
      removeListener: (...args: any[]) => void;
    };
    lastError?: { message: string };
  };
  storage: {
    local: {
      get: (...args: any[]) => Promise<any>;
      set: (...args: any[]) => Promise<void>;
      remove: (...args: any[]) => Promise<void>;
      clear: (...args: any[]) => Promise<void>;
    };
  };
  identity: {
    launchWebAuthFlow: (...args: any[]) => void;
  };
  sidePanel: {
    open: (...args: any[]) => Promise<void>;
    setOptions: (...args: any[]) => void;
  };
  tabs: {
    create: (...args: any[]) => Promise<any>;
    sendMessage: (...args: any[]) => void;
  };
}

/**
 * Create a fresh Chrome API mock instance with sensible defaults.
 * 
 * @returns Mocked chrome object with all necessary APIs
 * 
 * TODO: Implement full mock structure based on actual usage patterns
 * in content scripts, popup, and background scripts.
 */
export function createChromeRuntimeMock(): ChromeRuntimeMock {
  // TODO: Return fully mocked chrome object
  throw new Error('createChromeRuntimeMock not yet implemented - see Phase 1 tasks');
}

/**
 * Reset all Chrome API mocks and clear call history.
 * Call this in afterEach() to prevent test pollution.
 */
export function resetChromeMock(): void {
  // TODO: Clear all mock call counts and reset state
  throw new Error('resetChromeMock not yet implemented - see Phase 1 tasks');
}

/**
 * Create a mock for chrome.runtime.sendMessage that resolves with custom response.
 * 
 * @param response - The response to return when sendMessage is called
 * @returns Mock function
 * 
 * TODO: Implement with proper callback/promise handling
 */
export function mockRuntimeSendMessage(response: any) {
  // TODO: Return vi.fn() that properly handles sendMessage callbacks
  throw new Error('mockRuntimeSendMessage not yet implemented - see Phase 1 tasks');
}

/**
 * Create a mock for chrome.storage.local with pre-populated data.
 * 
 * @param initialData - Key-value pairs to populate storage
 * @returns Mock storage object
 * 
 * TODO: Implement with proper async get/set behavior
 */
export function mockChromeStorage(initialData: Record<string, any> = {}) {
  // TODO: Return storage mock with stateful behavior
  throw new Error('mockChromeStorage not yet implemented - see Phase 1 tasks');
}
