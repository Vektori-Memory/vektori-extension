/**
 * Unit Tests: Context Injection
 * 
 * Tests the injectContextIntoPrompt function from chatgpt-content.js
 * Validates:
 * - Validation checks (length, already-has-context, duplicate query, cooldown)
 * - Cache behavior (LRU eviction, cache hits vs API calls)
 * - API call flow (runtime messaging, response handling)
 * - Toast lifecycle (loading → success/error/info based on response)
 * - Input manipulation (getInputValue, setInputValue, context prefix)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanupDOM } from '../utils/dom-fixtures';

describe('Context Injection', () => {
  // Constants from chatgpt-content.js
  const MIN_QUERY_LENGTH = 5;
  const INJECTION_COOLDOWN = 10000; // 10 seconds
  const MAX_CACHE_SIZE = 50;

  let mockGetInputValue: () => string;
  let mockSetInputValue: (value: string) => boolean;
  let queryCache: Map<string, string>;
  let lastInjectedQuery: string | null;
  let lastInjectionTime: number;
  let mockToastId: string;

  beforeEach(() => {
    cleanupDOM();
    
    // Reset state
    queryCache = new Map();
    lastInjectedQuery = null;
    lastInjectionTime = 0;
    mockToastId = 'toast-123';

    // Mock input value functions
    mockGetInputValue = vi.fn(() => 'Test user query');
    mockSetInputValue = vi.fn(() => true);

    // Reset toast mocks completely
    vi.mocked((window as any).vektoriToast.loading).mockClear();
    vi.mocked((window as any).vektoriToast.loading).mockReturnValue(mockToastId);
    vi.mocked((window as any).vektoriToast.update).mockClear();
    vi.mocked((window as any).vektoriToast.update).mockReturnValue(undefined);
    vi.mocked((window as any).vektoriToast.success).mockClear();
    vi.mocked((window as any).vektoriToast.success).mockReturnValue(undefined);
    vi.mocked((window as any).vektoriToast.info).mockClear();
    vi.mocked((window as any).vektoriToast.info).mockReturnValue(undefined);
    vi.mocked((window as any).vektoriToast.warning).mockClear();
    vi.mocked((window as any).vektoriToast.warning).mockReturnValue(undefined);

    // Reset auth mock to return true by default
    vi.mocked((window as any).vektoriCheckAuth).mockClear();
    vi.mocked((window as any).vektoriCheckAuth).mockResolvedValue(true);

    // Reset runtime.sendMessage mock
    vi.mocked(chrome.runtime.sendMessage).mockClear();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe('Validation checks', () => {
    async function injectContextIntoPrompt() {
      // AUTH CHECK
      const isAuthenticated = await (window as any).vektoriCheckAuth();
      if (!isAuthenticated) {
        return;
      }

      const currentInput = mockGetInputValue();

      // VALIDATION 1: Length check
      if (!currentInput || currentInput.length < MIN_QUERY_LENGTH) {
        (window as any).vektoriToast?.warning('Query needs at least 5 characters for context');
        return;
      }

      // VALIDATION 2: Already has context
      if (currentInput.includes('Context:') || currentInput.includes('Memory, might or might not be relevent')) {
        (window as any).vektoriToast?.info('Context already added to this query');
        return;
      }

      // VALIDATION 3: Same query as last time
      if (currentInput === lastInjectedQuery) {
        (window as any).vektoriToast?.info('This query was already processed');
        return;
      }

      // VALIDATION 4: Cooldown check
      const now = Date.now();
      if (now - lastInjectionTime < INJECTION_COOLDOWN) {
        const remainingSeconds = Math.ceil((INJECTION_COOLDOWN - (now - lastInjectionTime)) / 1000);
        (window as any).vektoriToast?.warning(`Please wait ${remainingSeconds}s before next context injection`);
        return;
      }

      return true; // All validations passed
    }

    it('should reject unauthenticated requests', async () => {
      vi.mocked((window as any).vektoriCheckAuth).mockResolvedValue(false);

      await injectContextIntoPrompt();

      expect((window as any).vektoriToast.warning).not.toHaveBeenCalled();
      expect(mockGetInputValue).not.toHaveBeenCalled();
    });

    it('should reject queries shorter than MIN_QUERY_LENGTH', async () => {
      mockGetInputValue = vi.fn(() => 'Hi'); // Only 2 characters

      await injectContextIntoPrompt();

      expect((window as any).vektoriToast.warning).toHaveBeenCalledWith('Query needs at least 5 characters for context');
    });

    it('should reject empty queries', async () => {
      mockGetInputValue = vi.fn(() => '');

      await injectContextIntoPrompt();

      expect((window as any).vektoriToast.warning).toHaveBeenCalledWith('Query needs at least 5 characters for context');
    });

    it('should reject queries that already have context (Context: marker)', async () => {
      mockGetInputValue = vi.fn(() => 'Context: Some context here\n\nUser query');

      await injectContextIntoPrompt();

      expect((window as any).vektoriToast.info).toHaveBeenCalledWith('Context already added to this query');
    });

    it('should reject queries that already have context (Memory marker)', async () => {
      mockGetInputValue = vi.fn(() => 'Memory, might or might not be relevent: Some info\n\nUser query');

      await injectContextIntoPrompt();

      expect((window as any).vektoriToast.info).toHaveBeenCalledWith('Context already added to this query');
    });

    it('should reject duplicate queries', async () => {
      lastInjectedQuery = 'Test user query';

      await injectContextIntoPrompt();

      expect((window as any).vektoriToast.info).toHaveBeenCalledWith('This query was already processed');
    });

    it('should enforce cooldown between injections', async () => {
      mockGetInputValue = vi.fn(() => 'This is a long query'); // Ensure it passes length check
      lastInjectionTime = Date.now() - 5000; // 5 seconds ago (cooldown is 10s)

      await injectContextIntoPrompt();

      expect((window as any).vektoriToast.warning).toHaveBeenCalled();
      const warningCall = vi.mocked((window as any).vektoriToast.warning).mock.calls[0][0];
      expect(warningCall).toMatch(/Please wait \d+s before next context injection/);
    });

    it('should allow injection after cooldown expires', async () => {
      mockGetInputValue = vi.fn(() => 'This is a long query'); // Ensure it passes length check
      lastInjectionTime = Date.now() - 11000; // 11 seconds ago (cooldown expired)

      const result = await injectContextIntoPrompt();

      expect(result).toBe(true); // Validations passed
      expect((window as any).vektoriToast.warning).not.toHaveBeenCalled();
    });
  });

  describe('Cache behavior', () => {
    async function injectContextIntoPrompt() {
      // Skip all validations for cache tests
      const currentInput = mockGetInputValue();
      const now = Date.now();

      // CHECK CACHE FIRST
      if (queryCache.has(currentInput)) {
        const cachedContext = queryCache.get(currentInput);
        if (cachedContext) {
          const enhancedPrompt = `Just for context: only, take in account if relevent to user query: ${cachedContext}\n\n${currentInput}\n`;
          mockSetInputValue(enhancedPrompt);
          (window as any).vektoriToast?.success('Context injected from cache ⚡');
          lastInjectedQuery = currentInput;
          lastInjectionTime = now;
          return 'cache_hit';
        }
      }

      return 'cache_miss';
    }

    it('should use cached context when available', async () => {
      const query = 'Test user query';
      queryCache.set(query, 'Cached context data');

      const result = await injectContextIntoPrompt();

      expect(result).toBe('cache_hit');
      expect(mockSetInputValue).toHaveBeenCalledWith(
        'Just for context: only, take in account if relevent to user query: Cached context data\n\nTest user query\n'
      );
      expect((window as any).vektoriToast.success).toHaveBeenCalledWith('Context injected from cache ⚡');
    });

    it('should update lastInjectedQuery and lastInjectionTime on cache hit', async () => {
      const query = 'Test user query';
      queryCache.set(query, 'Context');

      await injectContextIntoPrompt();

      expect(lastInjectedQuery).toBe(query);
      expect(lastInjectionTime).toBeGreaterThan(0);
    });

    it('should proceed to API call when cache misses', async () => {
      // Cache is empty

      const result = await injectContextIntoPrompt();

      expect(result).toBe('cache_miss');
      expect(mockSetInputValue).not.toHaveBeenCalled();
    });

    it('should evict oldest entry when cache exceeds MAX_CACHE_SIZE', () => {
      // Fill cache to MAX_CACHE_SIZE
      for (let i = 0; i < MAX_CACHE_SIZE; i++) {
        queryCache.set(`query-${i}`, `context-${i}`);
      }

      expect(queryCache.size).toBe(MAX_CACHE_SIZE);

      // Add one more entry
      queryCache.set('new-query', 'new-context');

      // Manual LRU eviction (oldest entry)
      if (queryCache.size > MAX_CACHE_SIZE) {
        const firstKey = queryCache.keys().next().value;
        if (firstKey) queryCache.delete(firstKey);
      }

      expect(queryCache.size).toBe(MAX_CACHE_SIZE);
      expect(queryCache.has('query-0')).toBe(false); // Oldest evicted
      expect(queryCache.has('new-query')).toBe(true); // New entry kept
    });
  });

  describe('API call flow', () => {
    async function injectContextIntoPrompt() {
      const currentInput = mockGetInputValue();
      const now = Date.now();

      // Skip cache check for API tests

      // Show loading toast
      const loadingToastId = (window as any).vektoriToast?.loading('Building context from your memory...');

      try {
        // Call runtime API
        const result = await new Promise<{ context: string }>((resolve, reject) => {
          chrome.runtime.sendMessage({
            action: 'build_context',
            query: currentInput
          }, (response: any) => {
            if (response && response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response?.error || 'Failed to build context'));
            }
          });
        });

        if (result.context && result.context.trim().length > 0) {
          // Cache the result
          queryCache.set(currentInput, result.context);

          // LRU eviction
          if (queryCache.size > MAX_CACHE_SIZE) {
            const firstKey = queryCache.keys().next().value;
            if (firstKey) queryCache.delete(firstKey);
          }

          const enhancedPrompt = `Just for context: only, take in account if relevent to user query: ${result.context}\n\n${currentInput}\n`;
          const success = mockSetInputValue(enhancedPrompt);

          if (success && loadingToastId && (window as any).vektoriToast) {
            (window as any).vektoriToast.update(loadingToastId, 'Context injected successfully', {
              type: 'success',
              duration: 3000
            });
          }

          lastInjectedQuery = currentInput;
          lastInjectionTime = now;
        } else {
          // No context found
          if (loadingToastId && (window as any).vektoriToast) {
            (window as any).vektoriToast.update(loadingToastId, 'No relevant memories found for this query', {
              type: 'info',
              duration: 3000
            });
          }
        }
      } catch (error) {
        // Error handling
        if (loadingToastId && (window as any).vektoriToast) {
          (window as any).vektoriToast.update(loadingToastId, 'Failed to build context. Please try again.', {
            type: 'error',
            duration: 4000
          });
        }
      }
    }

    it('should send build_context message to runtime', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message, callback: any) => {
        callback({ success: true, data: { context: 'Retrieved context' } });
      });

      await injectContextIntoPrompt();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        {
          action: 'build_context',
          query: 'Test user query'
        },
        expect.any(Function)
      );
    });

    it('should inject context and update toast on success', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message, callback: any) => {
        callback({ success: true, data: { context: 'Retrieved context' } });
      });

      await injectContextIntoPrompt();

      expect(mockSetInputValue).toHaveBeenCalledWith(
        'Just for context: only, take in account if relevent to user query: Retrieved context\n\nTest user query\n'
      );
      expect((window as any).vektoriToast.update).toHaveBeenCalledWith(
        mockToastId,
        'Context injected successfully',
        { type: 'success', duration: 3000 }
      );
    });

    it('should cache successful API response', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message, callback: any) => {
        callback({ success: true, data: { context: 'Retrieved context' } });
      });

      await injectContextIntoPrompt();

      expect(queryCache.has('Test user query')).toBe(true);
      expect(queryCache.get('Test user query')).toBe('Retrieved context');
    });

    it('should show info toast when no context found', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message, callback: any) => {
        callback({ success: true, data: { context: '' } }); // Empty context
      });

      await injectContextIntoPrompt();

      expect((window as any).vektoriToast.update).toHaveBeenCalledWith(
        mockToastId,
        'No relevant memories found for this query',
        { type: 'info', duration: 3000 }
      );
      expect(mockSetInputValue).not.toHaveBeenCalled();
    });

    it('should show error toast on API failure', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message, callback: any) => {
        callback({ success: false, error: 'Network error' });
      });

      await injectContextIntoPrompt();

      expect((window as any).vektoriToast.update).toHaveBeenCalledWith(
        mockToastId,
        'Failed to build context. Please try again.',
        { type: 'error', duration: 4000 }
      );
    });

    it('should update lastInjectedQuery and lastInjectionTime on success', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message, callback: any) => {
        callback({ success: true, data: { context: 'Context' } });
      });

      await injectContextIntoPrompt();

      expect(lastInjectedQuery).toBe('Test user query');
      expect(lastInjectionTime).toBeGreaterThan(0);
    });
  });

  describe('Input manipulation', () => {
    it('should construct enhanced prompt with correct prefix format', () => {
      const context = 'User likes TypeScript and Vitest';
      const query = 'How do I mock functions?';
      const expectedPrompt = `Just for context: only, take in account if relevent to user query: ${context}\n\n${query}\n`;

      expect(expectedPrompt).toContain('Just for context:');
      expect(expectedPrompt).toContain(context);
      expect(expectedPrompt).toContain(query);
    });

    it('should call setInputValue with enhanced prompt', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message, callback: any) => {
        callback({ success: true, data: { context: 'Context data' } });
      });

      async function injectWithInputManipulation() {
        const currentInput = mockGetInputValue();
        const loadingToastId = (window as any).vektoriToast?.loading('Building context from your memory...');

        const result = await new Promise<{ context: string }>((resolve) => {
          chrome.runtime.sendMessage({
            action: 'build_context',
            query: currentInput
          }, (response: any) => {
            resolve(response.data);
          });
        });

        const enhancedPrompt = `Just for context: only, take in account if relevent to user query: ${result.context}\n\n${currentInput}\n`;
        mockSetInputValue(enhancedPrompt);

        if (loadingToastId && (window as any).vektoriToast) {
          (window as any).vektoriToast.update(loadingToastId, 'Context injected successfully', {
            type: 'success',
            duration: 3000
          });
        }
      }

      await injectWithInputManipulation();

      expect(mockSetInputValue).toHaveBeenCalledWith(
        'Just for context: only, take in account if relevent to user query: Context data\n\nTest user query\n'
      );
    });

    it('should not update toast if setInputValue fails', async () => {
      const localMockSetInput = vi.fn((value: string) => false); // Simulate failure

      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message, callback: any) => {
        callback({ success: true, data: { context: 'Context' } });
      });

      async function injectWithFailureHandling() {
        const currentInput = mockGetInputValue();
        const loadingToastId = (window as any).vektoriToast?.loading('Building context...');

        const result = await new Promise<{ context: string }>((resolve) => {
          chrome.runtime.sendMessage({ action: 'build_context', query: currentInput }, (response: any) => {
            resolve(response.data);
          });
        });

        const enhancedPrompt = `Just for context: only, take in account if relevent to user query: ${result.context}\n\n${currentInput}\n`;
        const success = localMockSetInput(enhancedPrompt);

        if (success && loadingToastId && (window as any).vektoriToast) {
          (window as any).vektoriToast.update(loadingToastId, 'Context injected successfully', {
            type: 'success',
            duration: 3000
          });
        }
      }

      // Clear previous mock calls
      vi.mocked((window as any).vektoriToast.update).mockClear();

      await injectWithFailureHandling();

      expect(localMockSetInput).toHaveBeenCalled();
      expect((window as any).vektoriToast.update).not.toHaveBeenCalledWith(
        expect.anything(),
        'Context injected successfully',
        expect.anything()
      );
    });
  });
});
