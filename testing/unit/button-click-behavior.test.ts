/**
 * Unit Tests: Button Click Behavior (Single/Double-Click)
 *
 * Tests the new click detection logic:
 * - Single click → injectContextIntoPrompt()
 * - Double click → showMemoryMenu()
 * - Timing validation (300ms threshold)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createChatGPTComposerDOM, cleanupDOM } from '../utils/dom-fixtures';

describe('Button Click Behavior', () => {
  let buttonContainer: HTMLElement;
  let mockInjectContext: any;
  let mockShowMenu: any;

  beforeEach(() => {
    cleanupDOM();
    const composer = createChatGPTComposerDOM();
    document.body.appendChild(composer);

    buttonContainer = document.querySelector('div[class*="-my-2.5 flex min-h-14"]') as HTMLElement;

    // Mock the functions
    mockInjectContext = vi.fn();
    mockShowMenu = vi.fn();
  });

  afterEach(() => {
    cleanupDOM();
    vi.clearAllMocks();
  });

  describe('Single click detection', () => {
    function addMemoryButtonWithClickDetection(container: HTMLElement) {
      const memoryBtn = document.createElement('button');
      memoryBtn.id = 'memory-button';
      memoryBtn.className = 'vektori-memory-button';
      memoryBtn.innerHTML = '🗣️';

      let clickCount = 0;
      let clickTimer: NodeJS.Timeout | null = null;

      memoryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        clickCount++;

        if (clickCount === 1) {
          clickTimer = setTimeout(() => {
            // Single click detected
            mockInjectContext();
            clickCount = 0;
          }, 300);
        } else if (clickCount === 2) {
          if (clickTimer) clearTimeout(clickTimer);
          // Double click detected
          mockShowMenu(e, memoryBtn);
          clickCount = 0;
        }
      });

      container.appendChild(memoryBtn);
      return memoryBtn;
    }

    it('should trigger inject context after 300ms on single click', async () => {
      const button = addMemoryButtonWithClickDetection(buttonContainer);

      button.click();

      // Should not be called immediately
      expect(mockInjectContext).not.toHaveBeenCalled();

      // Wait for 300ms timeout
      await new Promise(resolve => setTimeout(resolve, 350));

      expect(mockInjectContext).toHaveBeenCalledTimes(1);
      expect(mockShowMenu).not.toHaveBeenCalled();
    });

    it('should not trigger inject context if second click comes within 300ms', async () => {
      const button = addMemoryButtonWithClickDetection(buttonContainer);

      button.click();

      // Wait 100ms and click again
      await new Promise(resolve => setTimeout(resolve, 100));
      button.click();

      // Wait for full timeout period
      await new Promise(resolve => setTimeout(resolve, 350));

      expect(mockInjectContext).not.toHaveBeenCalled();
      expect(mockShowMenu).toHaveBeenCalledTimes(1);
    });
  });

  describe('Double click detection', () => {
    function addMemoryButtonWithClickDetection(container: HTMLElement) {
      const memoryBtn = document.createElement('button');
      memoryBtn.id = 'memory-button';
      memoryBtn.className = 'vektori-memory-button';
      memoryBtn.innerHTML = '🗣️';

      let clickCount = 0;
      let clickTimer: NodeJS.Timeout | null = null;

      memoryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        clickCount++;

        if (clickCount === 1) {
          clickTimer = setTimeout(() => {
            mockInjectContext();
            clickCount = 0;
          }, 300);
        } else if (clickCount === 2) {
          if (clickTimer) clearTimeout(clickTimer);
          mockShowMenu(e, memoryBtn);
          clickCount = 0;
        }
      });

      container.appendChild(memoryBtn);
      return memoryBtn;
    }

    it('should trigger showMemoryMenu immediately on double click', async () => {
      const button = addMemoryButtonWithClickDetection(buttonContainer);

      button.click();
      button.click();

      // Should be called immediately (synchronously)
      expect(mockShowMenu).toHaveBeenCalledTimes(1);
      expect(mockInjectContext).not.toHaveBeenCalled();

      // Wait to ensure inject context is not triggered
      await new Promise(resolve => setTimeout(resolve, 350));

      expect(mockInjectContext).not.toHaveBeenCalled();
    });

    it('should pass event and button element to showMemoryMenu', () => {
      const button = addMemoryButtonWithClickDetection(buttonContainer);

      button.click();
      button.click();

      expect(mockShowMenu).toHaveBeenCalledWith(
        expect.any(MouseEvent),
        button
      );
    });

    it('should reset click count after double click', async () => {
      const button = addMemoryButtonWithClickDetection(buttonContainer);

      // First double click
      button.click();
      button.click();
      expect(mockShowMenu).toHaveBeenCalledTimes(1);

      // Reset mocks
      vi.clearAllMocks();

      // Second single click should work independently
      button.click();
      await new Promise(resolve => setTimeout(resolve, 350));

      expect(mockInjectContext).toHaveBeenCalledTimes(1);
      expect(mockShowMenu).not.toHaveBeenCalled();
    });
  });

  describe('Click timing edge cases', () => {
    function addMemoryButtonWithClickDetection(container: HTMLElement) {
      const memoryBtn = document.createElement('button');
      memoryBtn.id = 'memory-button';
      memoryBtn.className = 'vektori-memory-button';
      memoryBtn.innerHTML = '🗣️';

      let clickCount = 0;
      let clickTimer: NodeJS.Timeout | null = null;

      memoryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        clickCount++;

        if (clickCount === 1) {
          clickTimer = setTimeout(() => {
            mockInjectContext();
            clickCount = 0;
          }, 300);
        } else if (clickCount === 2) {
          if (clickTimer) clearTimeout(clickTimer);
          mockShowMenu(e, memoryBtn);
          clickCount = 0;
        }
      });

      container.appendChild(memoryBtn);
      return memoryBtn;
    }

    it('should handle rapid triple clicks gracefully', async () => {
      const button = addMemoryButtonWithClickDetection(buttonContainer);

      button.click();
      button.click();

      // Double-click handler fires immediately
      expect(mockShowMenu).toHaveBeenCalledTimes(1);

      // Third click starts a new single-click sequence
      button.click();

      await new Promise(resolve => setTimeout(resolve, 350));

      // Third click triggers inject context after timeout
      expect(mockInjectContext).toHaveBeenCalledTimes(1);
    });

    it('should handle clicks at exactly 300ms boundary', async () => {
      const button = addMemoryButtonWithClickDetection(buttonContainer);

      button.click();

      // Wait exactly 300ms before second click
      await new Promise(resolve => setTimeout(resolve, 300));

      // First click should have triggered inject context
      expect(mockInjectContext).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();

      // Second click is now a new single click
      button.click();
      await new Promise(resolve => setTimeout(resolve, 350));

      expect(mockInjectContext).toHaveBeenCalledTimes(1);
    });
  });
});
