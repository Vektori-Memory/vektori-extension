/**
 * Vektori Memory - Centralized UI Helper
 * Professional toast notification system with HCI best practices
 */

class VektoriToast {
  constructor() {
    this.container = null;
    this.activeToasts = new Map();
    this.maxToasts = 3;
    this.retryCount = 0;
    this.maxRetries = 50; // 50 retries * 100ms = 5 seconds max
    this.initializeWhenReady();
  }

  initializeWhenReady() {
    if (document.body) {
      this.init();
    } else {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.init());
      } else {
        // Use MutationObserver as fallback
        const observer = new MutationObserver(() => {
          if (document.body) {
            this.init();
            observer.disconnect();
          }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
      }
    }
  }

  init() {
    // Create toast container if it doesn't exist
    if (!this.container && document.body) {
      try {
        this.container = document.createElement('div');
        this.container.id = 'vektori-toast-container';
        this.container.className = 'vektori-toast-container';
        document.body.appendChild(this.container);
        console.log('[VektoriToast] Container initialized successfully ✓');
      } catch (error) {
        console.error('[VektoriToast] Failed to initialize:', error);
      }
    } else if (!document.body) {
      console.warn('[VektoriToast] document.body not ready yet, will retry...');
    }
  }

  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {object} options - Configuration options
   * @param {string} options.type - Type: 'info', 'success', 'warning', 'error', 'loading'
   * @param {number} options.duration - Duration in ms (0 for persistent)
   * @param {boolean} options.dismissible - Can user dismiss?
   * @param {string} options.id - Unique ID for updating the same toast
   * @param {function} options.onDismiss - Callback when dismissed
   * @returns {string} Toast ID for updating/dismissing
   */
  show(message, options = {}) {
    const {
      type = 'info',
      duration = 4000,
      dismissible = true,
      id = this.generateId(),
      onDismiss = null,
      icon = this.getIcon(type),
      progress = false
    } = options;

    console.log(`[VektoriToast] show() called: "${message}" (${type})`);

    // Ensure container exists
    if (!this.container) {
      console.log('[VektoriToast] Container missing, initializing...');
      this.init();
    }

    // CRITICAL: Check if container was detached from DOM (React hydration issue on ChatGPT/Grok/Gemini)
    if (this.container && !this.container.isConnected) {
      console.warn('[VektoriToast]Container detached from DOM! React hydration likely removed it. Reinitializing...');
      
      // Clear all active timers before clearing references
      for (const [toastId, toastData] of this.activeToasts) {
        if (toastData.timer) {
          clearTimeout(toastData.timer);
        }
      }
      
      // Try to remove any orphaned toast containers in the DOM
      const orphanedContainers = document.querySelectorAll('#vektori-toast-container');
      orphanedContainers.forEach(container => {
        console.log('[VektoriToast] Removing orphaned container');
        container.remove();
      });
      
      this.container = null;
      this.activeToasts.clear(); // Clear stale references
      this.init();
    }

    // If still no container, wait and retry (with max limit)
    if (!this.container) {
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.warn(`[VektoriToast] Retry ${this.retryCount}/${this.maxRetries} - waiting for DOM...`);
        setTimeout(() => this.show(message, options), 100);
      } else {
        console.error('[VektoriToast] Failed to initialize after 50 retries. DOM may not be ready.');
      }
      return id;
    }

    // Reset retry counter on successful container access
    this.retryCount = 0;
    console.log(`[VektoriToast] Container ready (connected=${this.container.isConnected}), active toasts: ${this.activeToasts.size}`);

    // If toast with this ID exists, update it instead
    if (this.activeToasts.has(id)) {
      return this.update(id, message, options);
    }

    // Limit number of active toasts
    if (this.activeToasts.size >= this.maxToasts) {
      const oldestId = this.activeToasts.keys().next().value;
      this.dismiss(oldestId);
    }

    // Create toast element
    const toast = this.createToastElement(id, message, type, icon, dismissible, progress);
    
    // Store reference
    this.activeToasts.set(id, {
      element: toast,
      timer: null,
      onDismiss,
      startTime: Date.now()
    });

    // Add to container
    this.container.appendChild(toast);
    console.log(`[VektoriToast] Toast ${id} appended to DOM (total: ${this.container.children.length})`);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      toast.classList.add('vektori-toast-enter');
      console.log(`[VektoriToast] Animation triggered for ${id}`);
    });

    // Auto-dismiss if duration is set
    if (duration > 0 && type !== 'loading') {
      const timer = setTimeout(() => {
        this.dismiss(id);
      }, duration);

      this.activeToasts.get(id).timer = timer;
      console.log(`[VektoriToast] Auto-dismiss set for ${id} in ${duration}ms`);
    }

    return id;
  }

  /**
   * Update an existing toast
   */
  update(id, message, options = {}) {
    console.log(`[VektoriToast] update() called for ${id}: "${message}" (${options.type || 'same type'})`);

    const toastData = this.activeToasts.get(id);
    if (!toastData) {
      console.warn(`[VektoriToast] Cannot update ${id} - toast not found`);
      return null;
    }

    const { element } = toastData;
    const messageEl = element.querySelector('.vektori-toast-message');
    const iconEl = element.querySelector('.vektori-toast-icon');

    // Update message
    if (message) {
      messageEl.textContent = message;
      console.log(`[VektoriToast] Updated message for ${id}`);
    }

    // Update type/icon if provided
    if (options.type) {
      // Remove old type classes while preserving animation classes (vektori-toast-enter, etc.)
      element.classList.remove('vektori-toast-info', 'vektori-toast-success',
                              'vektori-toast-warning', 'vektori-toast-error',
                              'vektori-toast-loading');
      element.classList.add(`vektori-toast-${options.type}`);

      if (options.icon !== false) {
        iconEl.innerHTML = options.icon || this.getIcon(options.type);
      }
      console.log(`[VektoriToast] Updated type to ${options.type} for ${id}`);
    }

    // Update progress
    if (options.progress !== undefined) {
      const progressEl = element.querySelector('.vektori-toast-progress-fill');
      if (progressEl && typeof options.progress === 'number') {
        progressEl.style.width = `${options.progress}%`;
      }
    }

    // Update duration
    if (options.duration !== undefined) {
      if (toastData.timer) {
        clearTimeout(toastData.timer);
      }
      
      if (options.duration > 0 && options.type !== 'loading') {
        toastData.timer = setTimeout(() => {
          this.dismiss(id);
        }, options.duration);
      }
    }

    return id;
  }

  /**
   * Dismiss a toast
   */
  dismiss(id) {
    console.log(`[VektoriToast] dismiss() called for ${id}`);

    const toastData = this.activeToasts.get(id);
    if (!toastData) {
      console.warn(`[VektoriToast] Cannot dismiss ${id} - toast not found`);
      return;
    }

    const { element, timer, onDismiss } = toastData;

    // Clear timer
    if (timer) {
      clearTimeout(timer);
    }

    // Remove from activeToasts immediately to prevent double-dismiss
    this.activeToasts.delete(id);

    // Check if element is still connected to DOM
    if (!element.isConnected) {
      console.warn(`[VektoriToast] Element ${id} already disconnected from DOM`);
      if (onDismiss) onDismiss();
      return;
    }

    // Exit animation
    element.classList.remove('vektori-toast-enter');
    element.classList.add('vektori-toast-exit');

    // Remove after animation
    setTimeout(() => {
      if (element.isConnected && element.parentNode) {
        element.parentNode.removeChild(element);
      }
      
      if (onDismiss) {
        onDismiss();
      }
    }, 300);
  }

  /**
   * Dismiss all toasts
   */
  dismissAll() {
    const ids = Array.from(this.activeToasts.keys());
    ids.forEach(id => this.dismiss(id));
  }

  /**
   * Create toast DOM element
   */
  createToastElement(id, message, type, icon, dismissible, progress) {
    const toast = document.createElement('div');
    toast.className = `vektori-toast vektori-toast-${type}`;
    toast.setAttribute('data-toast-id', id);
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    const content = `
      <div class="vektori-toast-content">
        <div class="vektori-toast-icon">${icon}</div>
        <div class="vektori-toast-message">${this.escapeHtml(message)}</div>
        ${dismissible ? '<button class="vektori-toast-dismiss" aria-label="Dismiss">&times;</button>' : ''}
      </div>
      ${progress ? '<div class="vektori-toast-progress"><div class="vektori-toast-progress-fill"></div></div>' : ''}
    `;

    toast.innerHTML = content;

    // Add dismiss handler
    if (dismissible) {
      const dismissBtn = toast.querySelector('.vektori-toast-dismiss');
      dismissBtn.addEventListener('click', () => this.dismiss(id));
    }

    return toast;
  }

  /**
   * Get icon for toast type
   */
  getIcon(type) {
    const icons = {
      info: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm1 15H9V9h2v6zm0-8H9V5h2v2z"/></svg>',
      success: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm-1.293 13.293l-3-3 1.414-1.414L9 10.758l4.879-4.879 1.414 1.414-6.172 6.172a1 1 0 01-1.414 0z"/></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm1 15H9v-2h2v2zm0-4H9V5h2v6z"/></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm4.293 12.293l-1.414 1.414L10 10.828l-2.879 2.879-1.414-1.414L8.586 10 5.707 7.121l1.414-1.414L10 8.586l2.879-2.879 1.414 1.414L11.414 10l2.879 2.879z"/></svg>',
      loading: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" class="vektori-spinner"><path d="M10 0C8.89543 0 8 0.89543 8 2C8 3.10457 8.89543 4 10 4C14.4183 4 18 7.58172 18 12C18 16.4183 14.4183 20 10 20C5.58172 20 2 16.4183 2 12C2 10.8954 1.10457 10 0 10C-1.10457 10 -2 10.8954 -2 12C-2 17.5228 2.47715 22 8 22H12C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2H10C10 0.89543 9.10457 0 8 0H10Z"/></svg>'
    };
    return icons[type] || icons.info;
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Convenience methods
   */
  info(message, duration = 4000) {
    return this.show(message, { type: 'info', duration });
  }

  success(message, duration = 4000) {
    return this.show(message, { type: 'success', duration });
  }

  warning(message, duration = 5000) {
    return this.show(message, { type: 'warning', duration });
  }

  error(message, duration = 6000) {
    return this.show(message, { type: 'error', duration });
  }

  loading(message, id = null) {
    return this.show(message, { 
      type: 'loading', 
      duration: 0, 
      dismissible: false,
      id: id || this.generateId()
    });
  }

  /**
   * Show a loading toast that updates with progress
   */
  progress(message, id = null) {
    return this.show(message, {
      type: 'loading',
      duration: 0,
      dismissible: false,
      progress: true,
      id: id || this.generateId()
    });
  }

  /**
   * Show authentication required message with action
   */
  authRequired(message = 'Please sign in to use this feature') {
    return this.show(message, {
      type: 'warning',
      duration: 5000,
      icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-13h2v6H9V5zm0 8h2v2H9v-2z"/></svg>'
    });
  }
}

// Create singleton instance
window.vektoriToast = new VektoriToast();

/**
 * Check if user is authenticated
 * Shows toast and returns false if not authenticated
 */
window.vektoriCheckAuth = async function() {
  try {
    const result = await chrome.storage.local.get(['access_token', 'user']);
    
    if (!result.access_token || !result.user) {
      window.vektoriToast.authRequired('Please sign in to use Vektori Memory features');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[Auth Check] Error:', error);
    window.vektoriToast.error('Failed to check authentication status');
    return false;
  }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VektoriToast;
}

console.log('[Vektori] UI Helper loaded successfully');
