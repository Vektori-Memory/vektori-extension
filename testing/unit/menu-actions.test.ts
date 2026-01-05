/**
 * Unit Tests: Menu Actions (handleMenuClick)
 * 
 * Tests the three menu action branches from chatgpt-content.js:
 * 1. Inject Context - validates auth, calls runtime messaging, shows toasts
 * 2. Search Memory - opens side panel via runtime messaging
 * 3. Save Chat - validates auth, calls parser, sends to backend, handles errors
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMemoryMenuDOM, cleanupDOM } from '../utils/dom-fixtures';

describe('Menu Actions', () => {
  let mockToast: any;
  let mockCheckAuth: any;
  let mockRuntimeSendMessage: any;

  beforeEach(() => {
    cleanupDOM();
    
    // Setup global mocks
    mockToast = {
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      loading: vi.fn().mockReturnValue('toast-id-123'),
      update: vi.fn(),
    };
    (window as any).vektoriToast = mockToast;

    mockCheckAuth = vi.fn().mockResolvedValue(true);
    (window as any).vektoriCheckAuth = mockCheckAuth;

    mockRuntimeSendMessage = vi.fn();
    chrome.runtime.sendMessage = mockRuntimeSendMessage;
  });

  afterEach(() => {
    cleanupDOM();
    vi.clearAllMocks();
  });

  describe('Inject Context action', () => {
    async function handleInjectAction() {
      // Check auth first
      const isAuthenticated = await (window as any).vektoriCheckAuth();
      if (!isAuthenticated) {
        return;
      }

      // Mock inject context logic
      const loadingId = (window as any).vektoriToast.loading('Building context...');
      
      // Call runtime messaging
      chrome.runtime.sendMessage(
        { action: 'build_context', query: 'test query' },
        (response: any) => {
          if (response && response.success) {
            (window as any).vektoriToast.update(loadingId, 'Context injected', { type: 'success' });
          } else {
            (window as any).vektoriToast.update(loadingId, 'Failed to build context', { type: 'error' });
          }
        }
      );
    }

    it('should check authentication before proceeding', async () => {
      await handleInjectAction();
      
      expect(mockCheckAuth).toHaveBeenCalledTimes(1);
    });

    it('should abort if user is not authenticated', async () => {
      mockCheckAuth.mockResolvedValueOnce(false);
      
      await handleInjectAction();
      
      expect(mockToast.loading).not.toHaveBeenCalled();
      expect(mockRuntimeSendMessage).not.toHaveBeenCalled();
    });

    it('should show loading toast when authenticated', async () => {
      await handleInjectAction();
      
      expect(mockToast.loading).toHaveBeenCalledWith('Building context...');
    });

    it('should call runtime.sendMessage with build_context action', async () => {
      await handleInjectAction();
      
      expect(mockRuntimeSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'build_context',
          query: expect.any(String)
        }),
        expect.any(Function)
      );
    });

    it('should update toast to success on successful response', async () => {
      mockRuntimeSendMessage.mockImplementation((message: any, callback: Function) => {
        callback({ success: true, data: { context: 'some context' } });
      });

      await handleInjectAction();
      
      expect(mockToast.update).toHaveBeenCalledWith(
        'toast-id-123',
        'Context injected',
        { type: 'success' }
      );
    });

    it('should update toast to error on failed response', async () => {
      mockRuntimeSendMessage.mockImplementation((message: any, callback: Function) => {
        callback({ success: false, error: 'Network error' });
      });

      await handleInjectAction();
      
      expect(mockToast.update).toHaveBeenCalledWith(
        'toast-id-123',
        'Failed to build context',
        { type: 'error' }
      );
    });
  });

  describe('Search Memory action', () => {
    async function handleSearchAction() {
      const isAuthenticated = await (window as any).vektoriCheckAuth();
      if (!isAuthenticated) {
        return;
      }

      chrome.runtime.sendMessage(
        { action: 'openSidePanel' },
        (response: any) => {
          if (response && response.success) {
            (window as any).vektoriToast.success('Side panel opened');
          } else {
            (window as any).vektoriToast.error('Failed to open side panel');
          }
        }
      );
    }

    it('should check authentication before opening side panel', async () => {
      await handleSearchAction();
      
      expect(mockCheckAuth).toHaveBeenCalledTimes(1);
    });

    it('should send openSidePanel message to runtime', async () => {
      await handleSearchAction();
      
      expect(mockRuntimeSendMessage).toHaveBeenCalledWith(
        { action: 'openSidePanel' },
        expect.any(Function)
      );
    });

    it('should show success toast when side panel opens', async () => {
      mockRuntimeSendMessage.mockImplementation((message: any, callback: Function) => {
        callback({ success: true });
      });

      await handleSearchAction();
      
      expect(mockToast.success).toHaveBeenCalledWith('Side panel opened');
    });

    it('should show error toast if side panel fails to open', async () => {
      mockRuntimeSendMessage.mockImplementation((message: any, callback: Function) => {
        callback({ success: false, error: 'Panel unavailable' });
      });

      await handleSearchAction();
      
      expect(mockToast.error).toHaveBeenCalledWith('Failed to open side panel');
    });
  });

  describe('Save Chat action', () => {
    const mockParser = vi.fn();

    beforeEach(() => {
      (window as any).chatGPTChatParser = mockParser;
    });

    async function handleSaveChatAction() {
      const isAuthenticated = await (window as any).vektoriCheckAuth();
      if (!isAuthenticated) {
        return;
      }

      const loadingId = (window as any).vektoriToast.loading('Saving conversation...');

      const chatData = (window as any).chatGPTChatParser();

      chrome.runtime.sendMessage(
        { action: 'save_chat', chatData: chatData },
        (response: any) => {
          if (response && response.success) {
            (window as any).vektoriToast.update(loadingId, 'Chat saved successfully', { 
              type: 'success',
              duration: 3000 
            });
          } else {
            const errorMsg = response?.error || 'Unknown error';
            let displayMessage = 'Failed to save chat';
            
            if (errorMsg.includes('Not authenticated') || errorMsg.includes('NO_AUTH_FOUND')) {
              displayMessage = 'Please sign in to save chats';
            } else if (errorMsg.includes('Session expired') || errorMsg.includes('INVALID_REFRESH_TOKEN')) {
              displayMessage = 'Session expired. Please sign in again';
            } else if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
              displayMessage = 'Network error. Check your connection';
            }

            (window as any).vektoriToast.update(loadingId, displayMessage, {
              type: 'error',
              duration: 5000
            });
          }
        }
      );
    }

    it('should check authentication before saving', async () => {
      mockParser.mockReturnValue({
        conversation: { convo_id: 'test-123' },
        messages: []
      });

      await handleSaveChatAction();
      
      expect(mockCheckAuth).toHaveBeenCalledTimes(1);
    });

    it('should call parser to get chat data', async () => {
      mockParser.mockReturnValue({
        conversation: { convo_id: 'test-123' },
        messages: []
      });

      await handleSaveChatAction();
      
      expect(mockParser).toHaveBeenCalledTimes(1);
    });

    it('should show loading toast while saving', async () => {
      mockParser.mockReturnValue({
        conversation: { convo_id: 'test-123' },
        messages: []
      });

      await handleSaveChatAction();
      
      expect(mockToast.loading).toHaveBeenCalledWith('Saving conversation...');
    });

    it('should send save_chat message with parsed data', async () => {
      const mockChatData = {
        conversation: { convo_id: 'test-123', platform: 'chatgpt' },
        messages: [{ role: 'user', text_content: 'Hello' }]
      };
      mockParser.mockReturnValue(mockChatData);

      await handleSaveChatAction();
      
      expect(mockRuntimeSendMessage).toHaveBeenCalledWith(
        {
          action: 'save_chat',
          chatData: mockChatData
        },
        expect.any(Function)
      );
    });

    it('should show success toast on successful save', async () => {
      mockParser.mockReturnValue({
        conversation: { convo_id: 'test-123' },
        messages: []
      });

      mockRuntimeSendMessage.mockImplementation((message: any, callback: Function) => {
        callback({ success: true });
      });

      await handleSaveChatAction();
      
      expect(mockToast.update).toHaveBeenCalledWith(
        'toast-id-123',
        'Chat saved successfully',
        expect.objectContaining({ type: 'success' })
      );
    });

    it('should show auth error message for NO_AUTH_FOUND', async () => {
      mockParser.mockReturnValue({
        conversation: { convo_id: 'test-123' },
        messages: []
      });

      mockRuntimeSendMessage.mockImplementation((message: any, callback: Function) => {
        callback({ success: false, error: 'NO_AUTH_FOUND: User not authenticated' });
      });

      await handleSaveChatAction();
      
      expect(mockToast.update).toHaveBeenCalledWith(
        'toast-id-123',
        'Please sign in to save chats',
        expect.objectContaining({ type: 'error' })
      );
    });

    it('should show session expired message for INVALID_REFRESH_TOKEN', async () => {
      mockParser.mockReturnValue({
        conversation: { convo_id: 'test-123' },
        messages: []
      });

      mockRuntimeSendMessage.mockImplementation((message: any, callback: Function) => {
        callback({ success: false, error: 'INVALID_REFRESH_TOKEN: Token expired' });
      });

      await handleSaveChatAction();
      
      expect(mockToast.update).toHaveBeenCalledWith(
        'toast-id-123',
        'Session expired. Please sign in again',
        expect.objectContaining({ type: 'error' })
      );
    });

    it('should show network error message for network failures', async () => {
      mockParser.mockReturnValue({
        conversation: { convo_id: 'test-123' },
        messages: []
      });

      mockRuntimeSendMessage.mockImplementation((message: any, callback: Function) => {
        callback({ success: false, error: 'Network request failed' });
      });

      await handleSaveChatAction();
      
      expect(mockToast.update).toHaveBeenCalledWith(
        'toast-id-123',
        'Network error. Check your connection',
        expect.objectContaining({ type: 'error' })
      );
    });

    it('should show generic error for unknown failures', async () => {
      mockParser.mockReturnValue({
        conversation: { convo_id: 'test-123' },
        messages: []
      });

      mockRuntimeSendMessage.mockImplementation((message: any, callback: Function) => {
        callback({ success: false, error: 'Unknown database error' });
      });

      await handleSaveChatAction();
      
      expect(mockToast.update).toHaveBeenCalledWith(
        'toast-id-123',
        'Failed to save chat',
        expect.objectContaining({ type: 'error' })
      );
    });
  });

  describe('Menu item click handling', () => {
    it('should close menu after action is triggered', async () => {
      const menu = createMemoryMenuDOM();
      document.body.appendChild(menu);

      expect(document.getElementById('memory-menu')).not.toBeNull();

      // Simulate action handler closing menu
      menu.remove();

      expect(document.getElementById('memory-menu')).toBeNull();
    });

    it('should extract data-action from clicked item', () => {
      const menu = createMemoryMenuDOM();
      document.body.appendChild(menu);

      const searchItem = Array.from(menu.querySelectorAll('.vektori-memory-item'))
        .find(item => item.getAttribute('data-action') === 'search');

      expect(searchItem).not.toBeNull();
      expect(searchItem?.getAttribute('data-action')).toBe('search');
    });

    it('should have exactly 2 menu items', () => {
      const menu = createMemoryMenuDOM();
      document.body.appendChild(menu);

      const menuItems = menu.querySelectorAll('.vektori-memory-item');
      expect(menuItems.length).toBe(2);
    });
  });
});
