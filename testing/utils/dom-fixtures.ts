/**
 * DOM Fixture Utilities
 * 
 * Factory functions for creating realistic DOM structures used in tests.
 * These fixtures simulate the actual DOM elements found in ChatGPT, Claude, etc.
 * 
 * Usage in tests:
 * ```ts
 * import { createChatGPTComposerDOM, createPopupContainerDOM } from '@/testing/utils/dom-fixtures';
 * 
 * beforeEach(() => {
 *   document.body.innerHTML = '';
 *   document.body.appendChild(createChatGPTComposerDOM());
 * });
 * ```
 */

// TODO: Implement in Phase 1 when writing unit tests
// This stub is here to satisfy TypeScript imports during Phase 0 setup

/**
 * Create a mock ChatGPT composer area with the button container.
 * Replicates the actual DOM structure where the Vektori button is injected.
 * 
 * @returns HTMLElement representing the composer area
 */
export function createChatGPTComposerDOM(): HTMLElement {
  const container = document.createElement('div');
  
  // Create the button container that matches the selector in chatgpt-content.js
  const buttonContainer = document.createElement('div');
  buttonContainer.className = '-my-2.5 flex min-h-14 items-center overflow-x-hidden px-1.5 [grid-area:primary] group-data-expanded/composer:mb-0 group-data-expanded/composer:px-2.5';
  
  // Create contenteditable input (where user types)
  const input = document.createElement('div');
  input.setAttribute('contenteditable', 'true');
  input.className = 'composer-input';
  
  container.appendChild(input);
  container.appendChild(buttonContainer);
  
  return container;
}

/**
 * Create mock ChatGPT message elements (user + assistant).
 * Used for testing the parser.
 * 
 * @param messages - Array of message configs { role, content }
 * @returns HTMLElement with message elements
 */
export function createChatGPTMessageDOM(messages: Array<{ role: 'user' | 'assistant'; content: string }>): HTMLElement {
  const container = document.createElement('div');
  
  messages.forEach(msg => {
    const messageEl = document.createElement('div');
    messageEl.setAttribute('data-message-author-role', msg.role);
    
    if (msg.role === 'user') {
      // User messages have .whitespace-pre-wrap
      const contentEl = document.createElement('div');
      contentEl.className = 'min-w-0 flex-1 py-3 whitespace-pre-wrap';
      contentEl.textContent = msg.content;
      messageEl.appendChild(contentEl);
    } else {
      // Assistant messages have .markdown
      const contentEl = document.createElement('div');
      contentEl.className = 'markdown prose';
      contentEl.textContent = msg.content;
      messageEl.appendChild(contentEl);
    }
    
    container.appendChild(messageEl);
  });
  
  return container;
}

/**
 * Create the popup container (#app-container) for popup.js tests.
 * 
 * @returns HTMLElement representing the popup root
 */
export function createPopupContainerDOM(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'app-container';
  container.setAttribute('role', 'main');
  return container;
}

/**
 * Create a contenteditable input element matching ChatGPT's composer.
 * 
 * @param initialValue - Optional initial content
 * @returns HTMLElement representing the input
 */
export function createContentEditableInput(initialValue: string = ''): HTMLElement {
  const input = document.createElement('div');
  input.setAttribute('contenteditable', 'true');
  input.className = 'composer-input';
  input.innerHTML = initialValue;
  return input;
}

/**
 * Create a mock memory menu for testing showMemoryMenu behavior.
 * 
 * @returns HTMLElement representing the menu
 * 
 * TODO: Match structure from chatgpt-content.js showMemoryMenu
 */
export function createMemoryMenuDOM(): HTMLElement {
  const menu = document.createElement('div');
  menu.id = 'memory-menu';
  menu.className = 'vektori-memory-menu';
  menu.innerHTML = `
    <div class="vektori-memory-item" data-action="search">Search Memory</div>
    <div class="vektori-memory-item" data-action="save_chat">Save Chat</div>
  `;
  return menu;
}

/**
 * Cleanup helper - removes all DOM fixtures from document.
 * Call in afterEach() to prevent test pollution.
 */
export function cleanupDOM(): void {
  document.body.innerHTML = '';
}
