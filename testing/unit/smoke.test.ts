/**
 * Smoke Test - Verifies test infrastructure is working
 * 
 * This file validates that Vitest, jsdom, and our test utilities
 * are properly configured. Delete or modify once real tests are added.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Test Infrastructure Smoke Test', () => {
  it('should have Vitest globals available', () => {
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
    expect(expect).toBeDefined();
  });

  it('should have jsdom environment with document and window', () => {
    expect(document).toBeDefined();
    expect(window).toBeDefined();
    expect(document.body).toBeDefined();
  });

  it('should have chrome API mocked globally', () => {
    expect(chrome).toBeDefined();
    expect(chrome.runtime).toBeDefined();
    expect(chrome.storage).toBeDefined();
    expect(chrome.runtime.sendMessage).toBeDefined();
  });

  it('should have window.vektoriToast mocked', () => {
    expect((window as any).vektoriToast).toBeDefined();
    expect((window as any).vektoriToast.success).toBeDefined();
    expect((window as any).vektoriToast.error).toBeDefined();
  });

  it('should have window.apiClient mocked', () => {
    expect((window as any).apiClient).toBeDefined();
    expect((window as any).apiClient.getValidToken).toBeDefined();
    expect((window as any).apiClient.makeAuthenticatedRequest).toBeDefined();
  });

  describe('DOM manipulation', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="test-container"></div>';
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should allow DOM element creation and querying', () => {
      const container = document.getElementById('test-container');
      expect(container).not.toBeNull();
      expect(container?.tagName).toBe('DIV');
    });

    it('should support appending elements', () => {
      const button = document.createElement('button');
      button.textContent = 'Test Button';
      button.id = 'test-btn';
      
      document.body.appendChild(button);
      
      const found = document.getElementById('test-btn');
      expect(found).not.toBeNull();
      expect(found?.textContent).toBe('Test Button');
    });
  });
});
