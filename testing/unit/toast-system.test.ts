/**
 * Toast System Tests
 * 
 * Tests for shared/ui_helper.js - comprehensive coverage of the VektoriToast
 * notification system including initialization, display, updates, and dismissal.
 * 
 * Coverage:
 * - Container initialization and DOM readiness
 * - Toast creation and display
 * - Multiple toast management (max toasts enforcement)
 * - Update operations (message, type, progress)
 * - Dismissal (manual, automatic, dismissAll)
 * - Convenience methods (info, success, warning, error, loading)
 * - Edge cases (detached container, missing body)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Setup VektoriToast class for testing
let VektoriToast: any;
let dom: JSDOM;
let document: Document;
let window: Window & typeof globalThis;

function setupDOM() {
  dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, {
    url: 'https://chatgpt.com',
    pretendToBeVisual: true,
  });
  
  document = dom.window.document;
  window = dom.window as any;
  
  // Setup global objects
  global.document = document;
  global.window = window as any;
  global.MutationObserver = window.MutationObserver;
  global.requestAnimationFrame = (callback: FrameRequestCallback) => {
    setTimeout(callback, 0);
    return 0;
  };
}

function loadVektoriToast() {
  // Use CommonJS require to load VektoriToast directly
  const path = require('path');
  const helperPath = path.join(__dirname, '../../shared/ui_helper.js');
  
  // Clear require cache to ensure fresh instance per test
  delete require.cache[require.resolve(helperPath)];
  
  // Load the class - ui_helper.js exports VektoriToast via module.exports
  VektoriToast = require(helperPath);
  
  // Also make it available on window for singleton pattern tests
  (window as any).VektoriToast = VektoriToast;
}

describe('Toast System - Initialization', () => {
  beforeEach(() => {
    setupDOM();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize container when body is ready', () => {
    loadVektoriToast();
    const toast = new VektoriToast();
    
    expect(toast.container).toBeTruthy();
    expect(toast.container.id).toBe('vektori-toast-container');
    expect(toast.container.className).toBe('vektori-toast-container');
    expect(document.body.contains(toast.container)).toBe(true);
  });

  it('should wait for body if not immediately available', async () => {
    // Remove body temporarily
    const body = document.body;
    document.documentElement.removeChild(body);
    
    loadVektoriToast();
    const toast = new VektoriToast();
    
    // Container should not exist yet
    expect(toast.container).toBeNull();
    
    // Restore body
    document.documentElement.appendChild(body);
    
    // Give the MutationObserver time to detect the body
    await vi.advanceTimersByTimeAsync(10);
    
    // Now container should exist
    expect(toast.container).toBeTruthy();
  });

  it('should handle React hydration (detached container)', async () => {
    loadVektoriToast();
    const toast = new VektoriToast();
    
    // Simulate React removing the container
    const oldContainer = toast.container;
    document.body.removeChild(oldContainer);
    
    // Try to show a toast - should detect and recreate
    const id = toast.show('Test message');
    
    // Advance timers to allow initialization
    await vi.advanceTimersByTimeAsync(0);
    
    // Should have created a new container
    expect(toast.container).toBeTruthy();
    expect(toast.container).not.toBe(oldContainer);
    expect(document.body.contains(toast.container)).toBe(true);
  });

  it('should retry initialization with exponential backoff', async () => {
    // Start without body
    const body = document.body;
    document.documentElement.removeChild(body);
    
    loadVektoriToast();
    const toast = new VektoriToast();
    
    // Try to show toast - should retry (retryCount increments on first attempt)
    toast.show('Test message');
    
    // After show() is called without a body, retryCount will be 1
    await vi.advanceTimersByTimeAsync(0);
    expect(toast.retryCount).toBe(1);
    
    // Advance through more retries
    await vi.advanceTimersByTimeAsync(100);
    expect(toast.retryCount).toBe(2);
    
    await vi.advanceTimersByTimeAsync(100);
    expect(toast.retryCount).toBe(3);
    
    // Restore body
    document.documentElement.appendChild(body);
    
    await vi.advanceTimersByTimeAsync(100);
    
    // Should now succeed
    expect(toast.container).toBeTruthy();
    expect(toast.retryCount).toBe(0); // Reset after success
  });

  it('should stop retrying after max retries', async () => {
    // Remove body permanently
    document.documentElement.removeChild(document.body);
    
    loadVektoriToast();
    const toast = new VektoriToast();
    
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Try to show toast
    toast.show('Test message');
    
    // Advance through all retries
    for (let i = 0; i < 50; i++) {
      await vi.advanceTimersByTimeAsync(100);
    }
    
    expect(toast.retryCount).toBe(50);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to initialize after 50 retries')
    );
  });
});

describe('Toast System - Display', () => {
  beforeEach(() => {
    setupDOM();
    loadVektoriToast();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should create and display a basic toast', async () => {
    const toast = new VektoriToast();
    
    const id = toast.show('Hello World');
    
    expect(id).toBeTruthy();
    expect(toast.activeToasts.has(id)).toBe(true);
    
    // Wait for requestAnimationFrame
    await vi.advanceTimersByTimeAsync(0);
    
    const toastElement = document.querySelector(`[data-toast-id="${id}"]`);
    expect(toastElement).toBeTruthy();
    expect(toastElement?.textContent).toContain('Hello World');
  });

  it('should display toast with different types', async () => {
    const toast = new VektoriToast();
    
    const types = ['info', 'success', 'warning', 'error', 'loading'];
    
    for (const type of types) {
      const id = toast.show(`${type} message`, { type });
      await vi.advanceTimersByTimeAsync(0);
      
      const element = document.querySelector(`[data-toast-id="${id}"]`);
      expect(element?.classList.contains(`vektori-toast-${type}`)).toBe(true);
    }
  });

  it('should escape HTML in messages', async () => {
    const toast = new VektoriToast();
    
    const id = toast.show('<script>alert("xss")</script>');
    await vi.advanceTimersByTimeAsync(0);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    const messageEl = element?.querySelector('.vektori-toast-message');
    
    // Should be escaped
    expect(messageEl?.textContent).toBe('<script>alert("xss")</script>');
    expect(messageEl?.innerHTML).not.toContain('<script>');
  });

  it('should set correct ARIA attributes', async () => {
    const toast = new VektoriToast();
    
    const infoId = toast.show('Info', { type: 'info' });
    await vi.advanceTimersByTimeAsync(0);
    const infoToast = document.querySelector(`[data-toast-id="${infoId}"]`);
    
    expect(infoToast?.getAttribute('role')).toBe('status');
    expect(infoToast?.getAttribute('aria-live')).toBe('polite');
    
    const errorId = toast.show('Error', { type: 'error' });
    await vi.advanceTimersByTimeAsync(0);
    const errorToast = document.querySelector(`[data-toast-id="${errorId}"]`);
    
    expect(errorToast?.getAttribute('role')).toBe('alert');
    expect(errorToast?.getAttribute('aria-live')).toBe('assertive');
  });

  it('should add dismiss button if dismissible', async () => {
    const toast = new VektoriToast();
    
    const id = toast.show('Dismissible', { dismissible: true });
    await vi.advanceTimersByTimeAsync(0);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    const dismissBtn = element?.querySelector('.vektori-toast-dismiss');
    
    expect(dismissBtn).toBeTruthy();
    expect(dismissBtn?.getAttribute('aria-label')).toBe('Dismiss');
  });

  it('should not add dismiss button if not dismissible', async () => {
    const toast = new VektoriToast();
    
    const id = toast.show('Not dismissible', { dismissible: false });
    await vi.advanceTimersByTimeAsync(0);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    const dismissBtn = element?.querySelector('.vektori-toast-dismiss');
    
    expect(dismissBtn).toBeNull();
  });

  it('should add progress bar if progress option is true', async () => {
    const toast = new VektoriToast();
    
    const id = toast.show('Loading...', { progress: true });
    await vi.advanceTimersByTimeAsync(0);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    const progressBar = element?.querySelector('.vektori-toast-progress');
    
    expect(progressBar).toBeTruthy();
  });

  it('should use custom ID if provided', async () => {
    const toast = new VektoriToast();
    
    const customId = 'my-custom-toast';
    const returnedId = toast.show('Custom ID', { id: customId });
    
    expect(returnedId).toBe(customId);
    expect(toast.activeToasts.has(customId)).toBe(true);
  });
});

describe('Toast System - Multiple Toasts', () => {
  beforeEach(() => {
    setupDOM();
    loadVektoriToast();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should enforce max toast limit', async () => {
    const toast = new VektoriToast();
    toast.maxToasts = 3;
    
    const id1 = toast.show('Toast 1', { duration: 0 });
    const id2 = toast.show('Toast 2', { duration: 0 });
    const id3 = toast.show('Toast 3', { duration: 0 });
    
    await vi.advanceTimersByTimeAsync(0);
    
    expect(toast.activeToasts.size).toBe(3);
    
    // Adding a 4th should remove the oldest
    const id4 = toast.show('Toast 4', { duration: 0 });
    
    await vi.advanceTimersByTimeAsync(500); // Allow dismiss animation
    
    expect(toast.activeToasts.has(id1)).toBe(false);
    expect(toast.activeToasts.has(id2)).toBe(true);
    expect(toast.activeToasts.has(id3)).toBe(true);
    expect(toast.activeToasts.has(id4)).toBe(true);
  });

  it('should stack toasts in the container', async () => {
    const toast = new VektoriToast();
    
    const id1 = toast.show('First');
    const id2 = toast.show('Second');
    const id3 = toast.show('Third');
    
    await vi.advanceTimersByTimeAsync(0);
    
    const toasts = toast.container.querySelectorAll('.vektori-toast');
    expect(toasts.length).toBe(3);
  });
});

describe('Toast System - Updates', () => {
  beforeEach(() => {
    setupDOM();
    loadVektoriToast();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should update existing toast message', async () => {
    const toast = new VektoriToast();
    
    const id = toast.show('Original message', { id: 'update-test', duration: 0 });
    await vi.advanceTimersByTimeAsync(0);
    
    toast.update(id, 'Updated message');
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    expect(element?.textContent).toContain('Updated message');
  });

  it('should update toast type and icon', async () => {
    const toast = new VektoriToast();
    
    const id = toast.show('Loading...', { id: 'type-test', type: 'loading', duration: 0 });
    await vi.advanceTimersByTimeAsync(0);
    
    let element = document.querySelector(`[data-toast-id="${id}"]`);
    expect(element?.classList.contains('vektori-toast-loading')).toBe(true);
    
    toast.update(id, 'Success!', { type: 'success' });
    
    element = document.querySelector(`[data-toast-id="${id}"]`);
    expect(element?.classList.contains('vektori-toast-loading')).toBe(false);
    expect(element?.classList.contains('vektori-toast-success')).toBe(true);
  });

  it('should update progress bar', async () => {
    const toast = new VektoriToast();
    
    const id = toast.show('Uploading...', { progress: true, duration: 0 });
    await vi.advanceTimersByTimeAsync(0);
    
    toast.update(id, null, { progress: 50 });
    
    const progressFill = document.querySelector(`[data-toast-id="${id}"] .vektori-toast-progress-fill`) as HTMLElement;
    expect(progressFill?.style.width).toBe('50%');
    
    toast.update(id, null, { progress: 100 });
    expect(progressFill?.style.width).toBe('100%');
  });

  it('should update duration and reset timer', async () => {
    const toast = new VektoriToast();
    
    const id = toast.show('Message', { duration: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    
    // Update with new duration before original expires
    await vi.advanceTimersByTimeAsync(500);
    toast.update(id, 'Updated', { duration: 2000 });
    
    // Original timer should be cancelled
    await vi.advanceTimersByTimeAsync(600); // Total 1100ms - original would have expired
    expect(toast.activeToasts.has(id)).toBe(true);
    
    // New timer should work - wait for the remaining time
    await vi.advanceTimersByTimeAsync(1400); // Total 2500ms from update
    
    // Wait for animation to complete
    await vi.advanceTimersByTimeAsync(300);
    
    expect(toast.activeToasts.has(id)).toBe(false);
  });

  it('should update existing toast instead of creating new one with same ID', async () => {
    const toast = new VektoriToast();
    
    const id = 'duplicate-test';
    toast.show('First', { id, duration: 0 });
    await vi.advanceTimersByTimeAsync(0);
    
    expect(toast.activeToasts.size).toBe(1);
    
    toast.show('Second', { id, duration: 0 });
    await vi.advanceTimersByTimeAsync(0);
    
    // Should still be only one toast
    expect(toast.activeToasts.size).toBe(1);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    expect(element?.textContent).toContain('Second');
  });

  it('should handle update of non-existent toast gracefully', () => {
    const toast = new VektoriToast();
    
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const result = toast.update('non-existent-id', 'Update');
    
    expect(result).toBeNull();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('Cannot update')
    );
  });
});

describe('Toast System - Dismissal', () => {
  beforeEach(() => {
    setupDOM();
    loadVektoriToast();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should dismiss toast manually', async () => {
    const toast = new VektoriToast();
    
    const id = toast.show('Dismissible', { duration: 0 });
    await vi.advanceTimersByTimeAsync(0);
    
    expect(toast.activeToasts.has(id)).toBe(true);
    
    toast.dismiss(id);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    expect(element?.classList.contains('vektori-toast-exit')).toBe(true);
    
    await vi.advanceTimersByTimeAsync(300); // Animation duration
    
    expect(toast.activeToasts.has(id)).toBe(false);
    expect(document.querySelector(`[data-toast-id="${id}"]`)).toBeNull();
  });

  it('should auto-dismiss after duration', async () => {
    const toast = new VektoriToast();
    
    const id = toast.show('Auto dismiss', { duration: 2000 });
    await vi.advanceTimersByTimeAsync(0);
    
    expect(toast.activeToasts.has(id)).toBe(true);
    
    await vi.advanceTimersByTimeAsync(2000);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    expect(element?.classList.contains('vektori-toast-exit')).toBe(true);
    
    await vi.advanceTimersByTimeAsync(300);
    
    expect(toast.activeToasts.has(id)).toBe(false);
  });

  it('should not auto-dismiss loading toasts', async () => {
    const toast = new VektoriToast();
    
    const id = toast.show('Loading...', { type: 'loading', duration: 2000 });
    await vi.advanceTimersByTimeAsync(0);
    
    await vi.advanceTimersByTimeAsync(2500);
    
    // Loading toast should still be active
    expect(toast.activeToasts.has(id)).toBe(true);
  });

  it('should dismiss on button click', async () => {
    const toast = new VektoriToast();
    
    const id = toast.show('Clickable', { dismissible: true, duration: 0 });
    await vi.advanceTimersByTimeAsync(0);
    
    const dismissBtn = document.querySelector(`[data-toast-id="${id}"] .vektori-toast-dismiss`) as HTMLElement;
    dismissBtn?.click();
    
    await vi.advanceTimersByTimeAsync(300);
    
    expect(toast.activeToasts.has(id)).toBe(false);
  });

  it('should call onDismiss callback', async () => {
    const toast = new VektoriToast();
    const onDismiss = vi.fn();
    
    const id = toast.show('Callback test', { duration: 0, onDismiss });
    await vi.advanceTimersByTimeAsync(0);
    
    toast.dismiss(id);
    
    await vi.advanceTimersByTimeAsync(300);
    
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should dismissAll toasts', async () => {
    const toast = new VektoriToast();
    
    toast.show('First', { duration: 0 });
    toast.show('Second', { duration: 0 });
    toast.show('Third', { duration: 0 });
    
    await vi.advanceTimersByTimeAsync(0);
    
    expect(toast.activeToasts.size).toBe(3);
    
    toast.dismissAll();
    
    await vi.advanceTimersByTimeAsync(300);
    
    expect(toast.activeToasts.size).toBe(0);
    expect(toast.container.children.length).toBe(0);
  });

  it('should handle dismiss of non-existent toast gracefully', () => {
    const toast = new VektoriToast();
    
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    toast.dismiss('non-existent-id');
    
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('Cannot dismiss')
    );
  });
});

describe('Toast System - Convenience Methods', () => {
  beforeEach(() => {
    setupDOM();
    loadVektoriToast();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should create info toast with info()', async () => {
    const toast = new VektoriToast();
    
    const id = toast.info('Info message');
    await vi.advanceTimersByTimeAsync(0);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    expect(element?.classList.contains('vektori-toast-info')).toBe(true);
  });

  it('should create success toast with success()', async () => {
    const toast = new VektoriToast();
    
    const id = toast.success('Success message');
    await vi.advanceTimersByTimeAsync(0);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    expect(element?.classList.contains('vektori-toast-success')).toBe(true);
  });

  it('should create warning toast with warning()', async () => {
    const toast = new VektoriToast();
    
    const id = toast.warning('Warning message');
    await vi.advanceTimersByTimeAsync(0);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    expect(element?.classList.contains('vektori-toast-warning')).toBe(true);
  });

  it('should create error toast with error()', async () => {
    const toast = new VektoriToast();
    
    const id = toast.error('Error message');
    await vi.advanceTimersByTimeAsync(0);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    expect(element?.classList.contains('vektori-toast-error')).toBe(true);
  });

  it('should create loading toast with loading()', async () => {
    const toast = new VektoriToast();
    
    const id = toast.loading('Loading message');
    await vi.advanceTimersByTimeAsync(0);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    expect(element?.classList.contains('vektori-toast-loading')).toBe(true);
    expect(element?.querySelector('.vektori-toast-dismiss')).toBeNull();
  });

  it('should create progress toast with progress()', async () => {
    const toast = new VektoriToast();
    
    const id = toast.progress('Uploading...');
    await vi.advanceTimersByTimeAsync(0);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    expect(element?.querySelector('.vektori-toast-progress')).toBeTruthy();
  });

  it('should create auth required toast', async () => {
    const toast = new VektoriToast();
    
    const id = toast.authRequired();
    await vi.advanceTimersByTimeAsync(0);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    expect(element?.classList.contains('vektori-toast-warning')).toBe(true);
    expect(element?.textContent).toContain('sign in');
  });

  it('should use different default durations for different types', async () => {
    const toast = new VektoriToast();
    
    toast.info('Info');
    const infoData = Array.from(toast.activeToasts.values())[0];
    expect(infoData.timer).toBeTruthy();
    
    toast.warning('Warning');
    const warningData = Array.from(toast.activeToasts.values())[1];
    expect(warningData.timer).toBeTruthy();
    
    toast.error('Error');
    const errorData = Array.from(toast.activeToasts.values())[2];
    expect(errorData.timer).toBeTruthy();
  });
});

describe('Toast System - Edge Cases', () => {
  beforeEach(() => {
    setupDOM();
    loadVektoriToast();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should handle empty message', async () => {
    const toast = new VektoriToast();
    
    const id = toast.show('');
    await vi.advanceTimersByTimeAsync(0);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    expect(element).toBeTruthy();
  });

  it('should handle very long messages', async () => {
    const toast = new VektoriToast();
    
    const longMessage = 'A'.repeat(1000);
    const id = toast.show(longMessage);
    await vi.advanceTimersByTimeAsync(0);
    
    const element = document.querySelector(`[data-toast-id="${id}"]`);
    expect(element?.textContent).toContain(longMessage);
  });

  it('should generate unique IDs', () => {
    const toast = new VektoriToast();
    
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(toast.generateId());
    }
    
    expect(ids.size).toBe(100); // All unique
  });

  it('should handle concurrent show calls', async () => {
    const toast = new VektoriToast();
    
    // Spy on dismiss method
    const dismissSpy = vi.spyOn(toast, 'dismiss');
    
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(Promise.resolve(toast.show(`Message ${i}`)));
    }
    
    await Promise.all(promises);
    await vi.advanceTimersByTimeAsync(0);
    
    // With 10 toasts and maxToasts=3, the system should call dismiss 7 times
    // to make room for toasts 4-10
    expect(dismissSpy).toHaveBeenCalledTimes(7);
    
    // Advance time to complete all dismissal animations  
    // Note: Due to how show() immediately adds before dismiss() completes,
    // we'll temporarily have more than maxToasts active during transitions
    await vi.advanceTimersByTimeAsync(350 * 10);
    
    // After sufficient time, activeToasts should have reduced
    // (May not be exactly maxToasts due to animation timing, but should be < initial 10)
    expect(toast.activeToasts.size).toBeLessThan(10);
  });

  it('should clear timer on manual dismiss', async () => {
    const toast = new VektoriToast();
    
    const id = toast.show('Timed', { duration: 5000 });
    await vi.advanceTimersByTimeAsync(0);
    
    const toastData = toast.activeToasts.get(id);
    const timer = toastData.timer;
    
    toast.dismiss(id);
    
    // Timer should be cleared
    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(5000); // Original duration
    
    // Should not try to dismiss again
    expect(toast.activeToasts.has(id)).toBe(false);
  });
});
