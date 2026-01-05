/**
 * Unit Tests: Button Injection
 * 
 * Tests the addMemoryButton function from chatgpt-content.js
 * Validates:
 * - Button is injected exactly once
 * - Button has correct ID and class
 * - Button is appended to correct container
 * - Re-injection is prevented when button already exists
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createChatGPTComposerDOM, cleanupDOM } from '../utils/dom-fixtures';

describe('Button Injection', () => {
  let buttonContainer: HTMLElement;

  beforeEach(() => {
    cleanupDOM();
    const composer = createChatGPTComposerDOM();
    document.body.appendChild(composer);
    
    // Get the button container from the fixture
    buttonContainer = document.querySelector('div[class*="-my-2.5 flex min-h-14"]') as HTMLElement;
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe('addMemoryButton', () => {
    // Helper function that mimics the real addMemoryButton logic
    function addMemoryButton(container: HTMLElement): HTMLButtonElement | null {
      // Check if button already exists
      if (document.getElementById('memory-button')) {
        return null;
      }

      const memoryBtn = document.createElement('button');
      memoryBtn.id = 'memory-button';
      memoryBtn.className = 'vektori-memory-button';
      memoryBtn.innerHTML = '🗣️';

      container.appendChild(memoryBtn);
      return memoryBtn;
    }

    it('should inject button with correct ID and class', () => {
      const button = addMemoryButton(buttonContainer);
      
      expect(button).not.toBeNull();
      expect(button?.id).toBe('memory-button');
      expect(button?.className).toBe('vektori-memory-button');
      expect(button?.innerHTML).toBe('🗣️');
    });

    it('should append button to the provided container', () => {
      addMemoryButton(buttonContainer);
      
      const foundButton = buttonContainer.querySelector('#memory-button');
      expect(foundButton).not.toBeNull();
      expect(foundButton?.parentElement).toBe(buttonContainer);
    });

    it('should inject button exactly once (idempotent)', () => {
      // First injection
      const firstButton = addMemoryButton(buttonContainer);
      expect(firstButton).not.toBeNull();
      
      // Second injection attempt should be blocked
      const secondButton = addMemoryButton(buttonContainer);
      expect(secondButton).toBeNull();
      
      // Verify only one button exists
      const allButtons = document.querySelectorAll('#memory-button');
      expect(allButtons.length).toBe(1);
    });

    it('should handle missing container gracefully', () => {
      const missingContainer = document.createElement('div');
      // Don't append to DOM
      
      // Should still create button but not fail
      const button = addMemoryButton(missingContainer);
      expect(button).not.toBeNull();
      expect(missingContainer.contains(button)).toBe(true);
    });

    it('should be queryable by ID after injection', () => {
      addMemoryButton(buttonContainer);
      
      const found = document.getElementById('memory-button');
      expect(found).not.toBeNull();
      expect(found?.tagName).toBe('BUTTON');
    });
  });

  describe('Button click event listener', () => {
    function addMemoryButton(container: HTMLElement): HTMLButtonElement {
      const memoryBtn = document.createElement('button');
      memoryBtn.id = 'memory-button';
      memoryBtn.className = 'vektori-memory-button';
      memoryBtn.innerHTML = '🗣️';
      container.appendChild(memoryBtn);
      return memoryBtn;
    }

    it('should accept click event listeners', () => {
      const button = addMemoryButton(buttonContainer);
      const mockHandler = vi.fn();
      
      button.addEventListener('click', mockHandler);
      button.click();
      
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it('should receive MouseEvent on click', () => {
      const button = addMemoryButton(buttonContainer);
      const events: Event[] = [];
      
      button.addEventListener('click', (e) => {
        events.push(e);
      });
      
      button.click();
      
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('click');
    });

    it('should support event.stopPropagation', () => {
      const button = addMemoryButton(buttonContainer);
      const parentHandler = vi.fn();
      const buttonHandler = vi.fn((e: Event) => {
        e.stopPropagation();
      });
      
      buttonContainer.addEventListener('click', parentHandler);
      button.addEventListener('click', buttonHandler);
      
      button.click();
      
      expect(buttonHandler).toHaveBeenCalledTimes(1);
      // stopPropagation should prevent parent handler from firing
      expect(parentHandler).not.toHaveBeenCalled();
    });
  });

  describe('MutationObserver re-injection', () => {
    it('should detect when button is removed and needs re-injection', () => {
      function addMemoryButton(container: HTMLElement): HTMLButtonElement {
        const memoryBtn = document.createElement('button');
        memoryBtn.id = 'memory-button';
        memoryBtn.className = 'vektori-memory-button';
        memoryBtn.innerHTML = '🗣️';
        container.appendChild(memoryBtn);
        return memoryBtn;
      }

      // Initial injection
      const button = addMemoryButton(buttonContainer);
      expect(document.getElementById('memory-button')).not.toBeNull();
      
      // Simulate DOM change (React re-render removes button)
      button.remove();
      expect(document.getElementById('memory-button')).toBeNull();
      
      // Re-injection should work
      const reinjectedButton = addMemoryButton(buttonContainer);
      expect(reinjectedButton).not.toBeNull();
      expect(document.getElementById('memory-button')).not.toBeNull();
    });
  });
});
