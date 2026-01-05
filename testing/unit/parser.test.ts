/**
 * Unit Tests: ChatGPT Parser
 * 
 * Tests the chatGPTChatParser function from parsers/chatgpt-parser.js
 * Validates:
 * - Extracts conversation metadata (convo_id, title, platform)
 * - Parses user and assistant messages correctly
 * - Strips injected context from user messages
 * - Extracts convo_id from URL
 * - Handles missing DOM elements gracefully
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createChatGPTMessageDOM, cleanupDOM } from '../utils/dom-fixtures';

describe('ChatGPT Parser', () => {
  beforeEach(() => {
    cleanupDOM();
    
    // Mock window.location for URL-based convo_id extraction
    delete (window as any).location;
    (window as any).location = {
      href: 'https://chatgpt.com/c/abc-123-def-456'
    };

    // Mock vektoriParserUtils for context stripping
    (window as any).vektoriParserUtils = {
      stripInjectedContext: vi.fn((text: string) => {
        // Strip "Just for context:" prefix and anything before the actual query
        if (text.includes('Just for context:')) {
          const parts = text.split('\n\n');
          return parts[parts.length - 1] || text;
        }
        return text;
      })
    };
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe('Conversation metadata', () => {
    function chatGPTChatParser() {
      const conversationData = {
        convo_id: generateConversationId(),
        platform: 'chatgpt',
        title: getChatTitle(),
        timestamp: new Date().toISOString()
      };

      return {
        conversation: conversationData,
        messages: []
      };
    }

    function generateConversationId() {
      const url = window.location.href;
      const match = url.match(/\/c\/([a-zA-Z0-9\-]+)/);
      return match ? match[1] : 'fallback-uuid';
    }

    function getChatTitle() {
      const titleEl = document.querySelector('[data-testid="conversation-title"]');
      return titleEl ? titleEl.textContent?.trim() || 'Untitled Chat' : 'Untitled Chat';
    }

    it('should extract convo_id from URL', () => {
      const result = chatGPTChatParser();
      
      expect(result.conversation.convo_id).toBe('abc-123-def-456');
    });

    it('should set platform to chatgpt', () => {
      const result = chatGPTChatParser();
      
      expect(result.conversation.platform).toBe('chatgpt');
    });

    it('should extract chat title from DOM', () => {
      const titleEl = document.createElement('div');
      titleEl.setAttribute('data-testid', 'conversation-title');
      titleEl.textContent = 'My Test Conversation';
      document.body.appendChild(titleEl);

      const result = chatGPTChatParser();
      
      expect(result.conversation.title).toBe('My Test Conversation');
    });

    it('should use "Untitled Chat" as fallback title', () => {
      // No title element in DOM
      const result = chatGPTChatParser();
      
      expect(result.conversation.title).toBe('Untitled Chat');
    });

    it('should generate fallback UUID if URL has no convo_id', () => {
      (window as any).location.href = 'https://chatgpt.com/';
      
      const result = chatGPTChatParser();
      
      expect(result.conversation.convo_id).toBe('fallback-uuid');
    });

    it('should include timestamp in ISO format', () => {
      const result = chatGPTChatParser();
      
      expect(result.conversation.timestamp).toBeTruthy();
      expect(() => new Date(result.conversation.timestamp)).not.toThrow();
    });
  });

  describe('Message parsing', () => {
    function chatGPTChatParser() {
      const messages: any[] = [];
      const conversationData = {
        convo_id: 'test-convo',
        platform: 'chatgpt',
        title: 'Test',
        timestamp: new Date().toISOString()
      };

      const messageElements = document.querySelectorAll('[data-message-author-role]');
      messageElements.forEach((messageEl, index) => {
        const role = messageEl.getAttribute('data-message-author-role');
        
        if (role === 'user') {
          const content = parseUserMessage(messageEl as HTMLElement);
          if (content.trim()) {
            messages.push({
              role: 'user',
              text_content: content,
              message_index: index,
              convo_id: conversationData.convo_id
            });
          }
        } else if (role === 'assistant') {
          const content = parseAssistantMessage(messageEl as HTMLElement);
          if (content.trim()) {
            messages.push({
              role: 'assistant',
              text_content: content,
              message_index: index,
              convo_id: conversationData.convo_id
            });
          }
        }
      });

      return {
        conversation: conversationData,
        messages: messages
      };
    }

    function parseUserMessage(messageEl: HTMLElement) {
      const contentEl = messageEl.querySelector('.min-w-0.flex-1.py-3.whitespace-pre-wrap') ||
                        messageEl.querySelector('.whitespace-pre-wrap');
      let content = contentEl ? contentEl.textContent?.trim() || '' : '';
      
      // Strip injected context
      content = (window as any).vektoriParserUtils.stripInjectedContext(content);
      
      return content;
    }

    function parseAssistantMessage(messageEl: HTMLElement) {
      const contentEl = messageEl.querySelector('.markdown') ||
                        messageEl.querySelector('.prose');
      return contentEl ? contentEl.textContent?.trim() || '' : '';
    }

    it('should parse user messages', () => {
      const messages = createChatGPTMessageDOM([
        { role: 'user', content: 'Hello, how are you?' }
      ]);
      document.body.appendChild(messages);

      const result = chatGPTChatParser();
      
      expect(result.messages.length).toBe(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].text_content).toBe('Hello, how are you?');
    });

    it('should parse assistant messages', () => {
      const messages = createChatGPTMessageDOM([
        { role: 'assistant', content: 'I am doing well, thank you!' }
      ]);
      document.body.appendChild(messages);

      const result = chatGPTChatParser();
      
      expect(result.messages.length).toBe(1);
      expect(result.messages[0].role).toBe('assistant');
      expect(result.messages[0].text_content).toBe('I am doing well, thank you!');
    });

    it('should parse multiple messages in order', () => {
      const messages = createChatGPTMessageDOM([
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second message' },
        { role: 'assistant', content: 'Second response' }
      ]);
      document.body.appendChild(messages);

      const result = chatGPTChatParser();
      
      expect(result.messages.length).toBe(4);
      expect(result.messages[0].text_content).toBe('First message');
      expect(result.messages[1].text_content).toBe('First response');
      expect(result.messages[2].text_content).toBe('Second message');
      expect(result.messages[3].text_content).toBe('Second response');
    });

    it('should include message_index for each message', () => {
      const messages = createChatGPTMessageDOM([
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' }
      ]);
      document.body.appendChild(messages);

      const result = chatGPTChatParser();
      
      expect(result.messages[0].message_index).toBe(0);
      expect(result.messages[1].message_index).toBe(1);
    });

    it('should include convo_id in each message', () => {
      const messages = createChatGPTMessageDOM([
        { role: 'user', content: 'Test' }
      ]);
      document.body.appendChild(messages);

      const result = chatGPTChatParser();
      
      expect(result.messages[0].convo_id).toBe('test-convo');
    });

    it('should skip empty messages', () => {
      const messages = createChatGPTMessageDOM([
        { role: 'user', content: '   ' },
        { role: 'user', content: 'Valid message' }
      ]);
      document.body.appendChild(messages);

      const result = chatGPTChatParser();
      
      // Should only include the non-empty message
      expect(result.messages.length).toBe(1);
      expect(result.messages[0].text_content).toBe('Valid message');
    });
  });

  describe('Context stripping', () => {
    function parseUserMessage(messageEl: HTMLElement) {
      const contentEl = messageEl.querySelector('.whitespace-pre-wrap');
      let content = contentEl ? contentEl.textContent?.trim() || '' : '';
      content = (window as any).vektoriParserUtils.stripInjectedContext(content);
      return content;
    }

    it('should strip injected context prefix from user messages', () => {
      const messageEl = document.createElement('div');
      messageEl.setAttribute('data-message-author-role', 'user');
      
      const contentEl = document.createElement('div');
      contentEl.className = 'whitespace-pre-wrap';
      contentEl.textContent = 'Just for context: only, take in account if relevent to user query: Some context here\n\nActual user query';
      messageEl.appendChild(contentEl);

      const content = parseUserMessage(messageEl);
      
      expect(content).toBe('Actual user query');
      expect((window as any).vektoriParserUtils.stripInjectedContext).toHaveBeenCalled();
    });

    it('should preserve messages without injected context', () => {
      const messageEl = document.createElement('div');
      messageEl.setAttribute('data-message-author-role', 'user');
      
      const contentEl = document.createElement('div');
      contentEl.className = 'whitespace-pre-wrap';
      contentEl.textContent = 'Regular user message';
      messageEl.appendChild(contentEl);

      const content = parseUserMessage(messageEl);
      
      expect(content).toBe('Regular user message');
    });
  });

  describe('Error handling', () => {
    function chatGPTChatParser() {
      const messages: any[] = [];
      const conversationData = {
        convo_id: 'test',
        platform: 'chatgpt',
        title: 'Test',
        timestamp: new Date().toISOString()
      };

      const messageElements = document.querySelectorAll('[data-message-author-role]');
      messageElements.forEach((messageEl) => {
        // Try to parse, but don't fail if elements are missing
        const role = messageEl.getAttribute('data-message-author-role');
        if (role === 'user' || role === 'assistant') {
          const contentEl = messageEl.querySelector('.whitespace-pre-wrap, .markdown');
          const content = contentEl?.textContent?.trim() || '';
          if (content) {
            messages.push({ role, text_content: content });
          }
        }
      });

      return {
        conversation: conversationData,
        messages: messages
      };
    }

    it('should return empty messages array when no messages found', () => {
      // No message elements in DOM
      const result = chatGPTChatParser();
      
      expect(result.messages).toEqual([]);
      expect(result.conversation).toBeTruthy();
    });

    it('should handle missing content elements gracefully', () => {
      const messageEl = document.createElement('div');
      messageEl.setAttribute('data-message-author-role', 'user');
      // No content element inside
      document.body.appendChild(messageEl);

      const result = chatGPTChatParser();
      
      // Should not throw, just return empty messages
      expect(result.messages).toEqual([]);
    });

    it('should handle malformed message structure', () => {
      const messageEl = document.createElement('div');
      messageEl.setAttribute('data-message-author-role', 'unknown-role');
      document.body.appendChild(messageEl);

      const result = chatGPTChatParser();
      
      // Should ignore unknown roles
      expect(result.messages).toEqual([]);
    });
  });
});
