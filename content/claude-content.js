// Claude Content Script - Vektori Memory Extension

// Production log silencer
(function () {
  if (typeof CONFIG !== 'undefined' && !CONFIG.DEBUG) {
    console.log = () => { };
  }
})();

// Import the Claude parser
let script = document.createElement('script');
script.src = chrome.runtime.getURL('parsers/claude-parser.js');
document.documentElement.appendChild(script);

// Note: auto-inject.js is bundled via manifest.json

let observer;
let buttonInjected = false;
const queryCache = new Map();
const MAX_CACHE_SIZE = 50;
let lastInjectedQuery = null;
let lastInjectionTime = 0;
const INJECTION_COOLDOWN = 10000;
let debounceTimer = null;
const MIN_QUERY_LENGTH = 5;


function getInputValue() {
  const inputElement =
    document.querySelector('div[contenteditable="true"]') ||
    document.querySelector("textarea") ||
    document.querySelector('p[data-placeholder="How can I help you today?"]') ||
    document.querySelector('p[data-placeholder="Reply to Claude..."]');

  if (!inputElement) return null;

  // For the p element placeholders specifically
  if (inputElement.tagName.toLowerCase() === 'p' &&
    (inputElement.getAttribute('data-placeholder') === 'How can I help you today?' ||
      inputElement.getAttribute('data-placeholder') === 'Reply to Claude...')) {
    return inputElement.textContent || '';
  }

  return inputElement.textContent || inputElement.value;
}

function setInputValue(newValue) {
  const inputElement = document.querySelector('div[contenteditable="true"]') ||
    document.querySelector("textarea") ||
    document.querySelector('p[data-placeholder="How can I help you today?"]') ||
    document.querySelector('p[data-placeholder="Reply to Claude..."]');

  if (!inputElement) return false;

  if (inputElement.tagName.toLowerCase() === "div") {
    // Convert newlines to <p> tags for proper rich text formatting
    const paragraphs = newValue.split('\n').map(line => {
      if (line.trim() === '') return '<p><br></p>';
      return `<p>${line}</p>`;
    }).join('');
    inputElement.innerHTML = paragraphs;
  } else if (inputElement.tagName.toLowerCase() === "p") {
    inputElement.textContent = newValue;
  } else {
    inputElement.value = newValue;
  }

  inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

async function injectContextIntoPrompt() {
  // AUTH CHECK - Must be first!
  const isAuthenticated = await window.vektoriCheckAuth();
  if (!isAuthenticated) {
    return;
  }

  const currentInput = getInputValue();

  // VALIDATION 1: Empty or too short query
  if (!currentInput || currentInput.trim().length === 0) {
    window.vektoriToast.warning('Please enter a query to inject context');
    return;
  }

  if (currentInput.length < MIN_QUERY_LENGTH) {
    window.vektoriToast.warning(`Query needs at least ${MIN_QUERY_LENGTH} characters for context`);
    return;
  }

  // VALIDATION 2: Already has context
  if (currentInput.includes('Context:') || currentInput.includes('Memory, might or might not be relevent')) {
    window.vektoriToast.info('Context already added to this query');
    return;
  }

  // VALIDATION 3: Same query as last time - USE CACHE instead of blocking
  if (currentInput === lastInjectedQuery && queryCache.has(currentInput)) {
    console.log('Same query as last time, using cache');
    const cachedContext = queryCache.get(currentInput);
    if (cachedContext) {
      const enhancedPrompt = `Just for context: only, take in account if relevent to user query: ${cachedContext}\n\n${currentInput}\n`;
      setInputValue(enhancedPrompt);
      window.vektoriToast.success('Context injected from cache ⚡');
    }
    return;
  }

  // VALIDATION 4: Cooldown check (prevent spam)
  const now = Date.now();
  if (now - lastInjectionTime < INJECTION_COOLDOWN) {
    const remainingSeconds = Math.ceil((INJECTION_COOLDOWN - (now - lastInjectionTime)) / 1000);
    console.log(`Cooldown active: ${remainingSeconds}s remaining`);
    window.vektoriToast.warning(`Please wait ${remainingSeconds}s before next context injection`);
    return;
  }

  // CHECK CACHE FIRST
  if (queryCache.has(currentInput)) {
    console.log('Using cached context');
    const cachedContext = queryCache.get(currentInput);
    if (cachedContext) {
      const enhancedPrompt = `Just for context: only, take in account if relevent to user query: ${cachedContext}\n\n${currentInput}\n`;
      setInputValue(enhancedPrompt);
      window.vektoriToast.success('Context injected from cache ⚡');
      lastInjectedQuery = currentInput;
      lastInjectionTime = now;
    }
    return;
  }

  // Show loading toast with unique ID
  const loadingToastId = window.vektoriToast.loading('Building context from your memory...');

  try {
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'build_context',
        query: currentInput
      }, (response) => {
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

      // Limit cache size (LRU-style)
      if (queryCache.size > MAX_CACHE_SIZE) {
        const firstKey = queryCache.keys().next().value;
        queryCache.delete(firstKey);
      }

      const enhancedPrompt = `Just for context: only, take in account if relevent to user query: ${result.context}\n\n${currentInput}\n`;
      console.log('Injecting enhanced prompt');

      const success = setInputValue(enhancedPrompt);
      if (success) {
        window.vektoriToast.update(loadingToastId, 'Context injected successfully', {
          type: 'success',
          duration: 3000
        });
        lastInjectedQuery = currentInput;
        lastInjectionTime = now;

        // Check if credits are low and show warning
        const creditsRemaining = result.metadata?.creditsRemaining;
        if (creditsRemaining !== undefined && creditsRemaining !== null) {
          if (creditsRemaining <= 10) {
            setTimeout(() => {
              window.vektoriToast.lowCredits(creditsRemaining, true);
            }, 3500);
          } else if (creditsRemaining <= 30) {
            setTimeout(() => {
              window.vektoriToast.lowCredits(creditsRemaining, false);
            }, 3500);
          }
        }
      }
    } else {
      console.log('No context found');
      window.vektoriToast.update(loadingToastId, 'No relevant memories found for this query', {
        type: 'info',
        duration: 3000
      });
    }
  } catch (error) {
    console.error('Context injection failed:', error);
    window.vektoriToast.update(loadingToastId, 'Failed to build context. Please try again.', {
      type: 'error',
      duration: 4000
    });
  }
}

function startObserver() {
  if (observer) observer.disconnect();

  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const buttonContainer = document.querySelector('div[class="overflow-hidden shrink-0 p-1 -m-1"]')
        const existingButton = document.getElementById('memory-button');
        if (buttonContainer && !existingButton) {
          console.log('Re-injecting button after DOM change');
          addMemoryButton(buttonContainer);
        }
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function addMemoryButton(buttonContainer) {
  if (document.getElementById('memory-button')) return;
  buttonInjected = true;

  const memoryBtn = document.createElement('button');
  memoryBtn.id = 'memory-button';
  memoryBtn.className = 'vektori-memory-button';
  memoryBtn.innerHTML = '🗣️';

  // Click detection state
  let clickCount = 0;
  let clickTimer = null;

  //then we insert the next to send button we have created it
  buttonContainer.insertAdjacentElement('afterend', memoryBtn);
  //add the event listener to the memory button sortof
  memoryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();

    clickCount++;

    if (clickCount === 1) {
      // Wait to see if second click comes
      clickTimer = setTimeout(() => {
        // Single click detected - show menu
        console.log('Single click - showing menu');
        showMemoryMenu(e, memoryBtn);
        clickCount = 0;
      }, 250);
    } else if (clickCount === 2) {
      // Double click detected - inject context
      clearTimeout(clickTimer);
      console.log('Double click - injecting context');
      injectContextIntoPrompt();
      clickCount = 0;
    }
  });
  console.log('Vektori Memory Button Added')
}

function showMemoryMenu(event, memoryBtn) {
  console.log('showMemoryMenu');

  //first we remove existing memory menu
  const existingMenu = document.getElementById('memory-menu');

  if (existingMenu) {
    existingMenu.remove();
    return;
  }

  const memoryMenu = document.createElement('div');
  memoryMenu.id = 'memory-menu';
  memoryMenu.className = 'vektori-memory-menu';


  memoryMenu.innerHTML = `
        <div class = "vektori-memory-item" data-action = "inject"> Recall Context </div>
        <div class = "vektori-memory-item" data-action = "search"> Search Memory </div>
        <div class = "vektori-memory-item" data-action = "save_chat"> Save Chat </div>
        <div class = "vektori-memory-item" data-action = "carry_context"> Carry Context </div>
        `;


  document.body.appendChild(memoryMenu);


  requestAnimationFrame(() => {
    const rect = memoryBtn.getBoundingClientRect();
    const menuHeight = memoryMenu.offsetHeight;
    const windowHeight = window.innerHeight;

    if (rect.bottom + menuHeight > windowHeight) {
      memoryMenu.style.top = `${rect.top - menuHeight - 8}px`;
    } else {
      memoryMenu.style.top = `${rect.bottom + 8}px`;
    }
    memoryMenu.style.left = `${rect.left}px`;

    const menuWidth = memoryMenu.offsetWidth;
    const windowWidth = window.innerWidth;
    if (rect.left + menuWidth > windowWidth) {
      memoryMenu.style.left = `${windowWidth - menuWidth - 16}px`;
    }
  });


  memoryMenu.querySelectorAll('.vektori-memory-item').forEach(item => {
    item.addEventListener('click', handleMenuClick);
  });

  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!memoryMenu.contains(e.target)) {
        memoryMenu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });

  }, 100);
}

// ============================================================================
// DESTINATION PICKER FOR CARRY CONTEXT
// ============================================================================

const DESTINATION_CONFIG = {
  chatgpt: { name: 'ChatGPT', icon: '' },
  claude: { name: 'Claude', icon: '' },
  perplexity: { name: 'Perplexity', icon: '' },
  grok: { name: 'Grok', icon: '' },
  gemini: { name: 'Gemini', icon: '' },
  deepseek: { name: 'DeepSeek', icon: '' }
};

function showDestinationPicker(currentPlatform) {
  // Remove any existing picker
  const existingOverlay = document.getElementById('vektori-destination-overlay');
  const existingModal = document.getElementById('vektori-destination-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'vektori-destination-overlay';
  overlay.className = 'vektori-destination-overlay';

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'vektori-destination-modal';
  modal.className = 'vektori-destination-modal';

  // Build destination grid
  const destinationItems = Object.entries(DESTINATION_CONFIG).map(([key, config]) => {
    const isCurrent = key === currentPlatform;
    return `
      <div class="vektori-destination-item ${isCurrent ? 'current-platform' : ''}" 
           data-destination="${key}" 
           ${isCurrent ? 'title="You are already on this platform"' : ''}>
        <div class="vektori-destination-name">${config.name}</div>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="vektori-destination-header">
      <h3 class="vektori-destination-title">Carry Context To...</h3>
      <p class="vektori-destination-subtitle">Select where to continue your conversation</p>
    </div>
    <div class="vektori-destination-grid">
      ${destinationItems}
    </div>
    <div class="vektori-destination-footer">
      <button class="vektori-destination-cancel">Cancel</button>
      <button class="vektori-destination-copy-only">Just Copy</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  // Event handlers
  const closeModal = () => {
    overlay.remove();
    modal.remove();
  };

  overlay.addEventListener('click', closeModal);
  modal.querySelector('.vektori-destination-cancel').addEventListener('click', closeModal);

  // "Just Copy" button - fallback to old behavior
  modal.querySelector('.vektori-destination-copy-only').addEventListener('click', async () => {
    closeModal();
    await handleCopyOnlyCarryContext(currentPlatform);
  });

  // Destination selection
  modal.querySelectorAll('.vektori-destination-item:not(.current-platform)').forEach(item => {
    item.addEventListener('click', async () => {
      const destination = item.dataset.destination;
      closeModal();
      await handleCarryToDestination(destination, currentPlatform);
    });
  });
}

async function handleCopyOnlyCarryContext(platform) {
  const loadingId = window.vektoriToast.loading('Saving and generating context...');

  try {
    const chatData = await claudeChatParser();

    if (!chatData || !chatData.conversation?.convo_id) {
      window.vektoriToast.update(loadingId, 'Could not parse current chat. Please try again.', {
        type: 'error',
        duration: 4000
      });
      return;
    }

    chrome.runtime.sendMessage({
      action: 'carry_context',
      chatData: chatData,
      platform: platform
    }, async (response) => {
      if (response && response.success) {
        const contextText = response.data.formattedContext || '';
        try {
          await navigator.clipboard.writeText(contextText);
          window.vektoriToast.update(loadingId, 'Context copied to clipboard! Paste it into any AI chat.', {
            type: 'success',
            duration: 5000
          });
        } catch (clipboardError) {
          console.error('Clipboard write failed:', clipboardError);
          window.vektoriToast.update(loadingId, 'Failed to copy to clipboard. Try again.', {
            type: 'error',
            duration: 4000
          });
        }
      } else {
        window.vektoriToast.update(loadingId, response?.error || 'Failed to generate context.', {
          type: 'error',
          duration: 4000
        });
      }
    });
  } catch (error) {
    console.error('Copy only carry context error:', error);
    window.vektoriToast.update(loadingId, 'An error occurred. Please try again.', {
      type: 'error',
      duration: 4000
    });
  }
}

async function handleCarryToDestination(destination, sourcePlatform) {
  const loadingId = window.vektoriToast.loading(`Preparing context for ${DESTINATION_CONFIG[destination]?.name || destination}...`);

  try {
    const chatData = await claudeChatParser();

    if (!chatData || !chatData.conversation?.convo_id) {
      window.vektoriToast.update(loadingId, 'Could not parse current chat. Please try again.', {
        type: 'error',
        duration: 4000
      });
      return;
    }

    chrome.runtime.sendMessage({
      action: 'carry_context_to_destination',
      chatData: chatData,
      platform: sourcePlatform,
      destination: destination
    }, (response) => {
      if (response && response.success) {
        window.vektoriToast.update(loadingId, `Opening ${DESTINATION_CONFIG[destination]?.name || destination}... Context will be auto-inserted.`, {
          type: 'success',
          duration: 4000
        });
      } else {
        console.error('Carry to destination failed:', response?.error);
        window.vektoriToast.update(loadingId, response?.error || 'Failed to carry context.', {
          type: 'error',
          duration: 4000
        });
      }
    });
  } catch (error) {
    console.error('Carry to destination error:', error);
    window.vektoriToast.update(loadingId, 'An error occurred. Please try again.', {
      type: 'error',
      duration: 4000
    });
  }
}

async function handleMenuClick(e) {
  e.preventDefault();
  e.stopImmediatePropagation();
  const action = e.target.dataset.action;

  // Track button click via background script (for PostHog analytics)
  chrome.runtime.sendMessage({
    action: 'track_event',
    eventName: 'inpage_button_clicked',
    properties: { button: action, platform: 'claude' }
  });

  switch (action) {
    case 'inject':
      console.log('inject button clicked');
      await injectContextIntoPrompt();
      break;

    case 'search':
      console.log('search button clicked');
      chrome.runtime.sendMessage({
        action: 'openSidePanel'
      }, (response) => {
        if (response && response.success) {
          console.log('Side panel opened successfully');
        } else {
          console.error('Failed to open side panel:', response?.error);
        }
      });
      break;

    case 'save_chat':
      console.log('save_chat clicked');

      if (!(await window.vektoriCheckAuth())) {
        return;
      }

      const loadingId = window.vektoriToast.loading('Saving conversation...');
      const chatData = await claudeChatParser();

      chrome.runtime.sendMessage({
        action: 'save_chat',
        chatData: chatData
      }, (response) => {
        if (response && response.success) {
          console.log('Chat saved successfully');
          window.vektoriToast.update(loadingId, 'Chat saved successfully', {
            type: 'success',
            duration: 3000
          });
        } else {
          console.error('Failed to save chat:', response?.error);
          window.vektoriToast.update(loadingId, 'Failed to save chat', {
            type: 'error',
            duration: 4000
          });
        }
      });
      break;

    case 'carry_context':
      console.log('carry_context clicked');

      if (!(await window.vektoriCheckAuth())) {
        return;
      }

      // Show destination picker modal
      showDestinationPicker('claude');
      break;

    default:
      console.log('Unknown action:', action);
  }

  const menu = document.getElementById('memory-menu');
  if (menu) menu.remove();
}


//initial injection
function initialInject() {
  const buttonContainer = document.querySelector('div[class="overflow-hidden shrink-0 p-1 -m-1"]');
  if (buttonContainer && !buttonInjected) {
    // buttonInjected = false;
    addMemoryButton(buttonContainer);
  }
  else {
    setTimeout(initialInject, 1000);
  }
}

function resetInjectionFlag() {
  buttonInjected = false;
}

// BATCH CHAT SAVER - OPTIMIZED EVENT-DRIVEN VERSION
class BatchChatSaver {
  constructor(platform, parser) {
    this.platform = platform;
    this.parser = parser;
    this.currentConvoId = null;
    this.isNewChat = false;
    this.messageBatch = [];
    this.batchSize = 10;
    this.lastSavedMessageIndex = 0; // Synced from backend

    this.timerInterval = 30000; // 30 seconds for timeout flush
    this.lastFlushTime = Date.now();
    this.batchTimerId = null;

    // Debouncing - INCREASED to wait for LLM streaming to complete
    this.parseDebounceTimer = null;
    this.parseDebounceDelay = 10000; // 10 seconds - gives time for LLM to finish streaming

    // MutationObserver for DOM changes
    this.messageObserver = null;
    this.isProcessing = false; // Prevent concurrent parsing

    // Track parsed message counts per conversation (survives chat switches)
    this.perChatMessageCount = new Map(); // convoId -> last parsed count

    console.log(`[BatchChatSaver] Initialized for ${platform}`);
  }

  getCurrentConvoId() {
    // Claude URL format: /chat/{convoId}
    const url = window.location.href;
    const match = url.match(/\/chat\/([a-zA-Z0-9\-]+)/);
    return match ? match[1] : null;
  }

  start() {
    this.observeChatSwitch();
    this.observeNewMessages();
    this.startBatchTimer();
    this.setupUnloadHandler(); // Save on tab close
    console.log('[BatchChatSaver] Started monitoring (with tab close handler!)');
  }

  setupUnloadHandler() {
    console.log('[BatchChatSaver] Setting up unload handlers...');

    // Save when tab becomes hidden (more reliable than beforeunload)
    document.addEventListener('visibilitychange', async () => {
      console.log(`[BatchChatSaver] visibilitychange event! hidden=${document.hidden}, batch size=${this.messageBatch.length}`);

      if (document.hidden) {
        // FORCE check for new messages (bypass debounce)
        console.log('[BatchChatSaver] Tab hidden - forcing immediate message check');
        await this.checkForNewMessages();

        if (this.messageBatch.length > 0) {
          console.log(`[BatchChatSaver] Tab hidden with ${this.messageBatch.length} unsaved messages - flushing`);
          this.saveBatch('tab_hidden', true);
        } else {
          console.log('[BatchChatSaver] No unsaved messages found after forced check');
        }
      }
    });

    // Backup: Also try beforeunload (but less reliable)
    window.addEventListener('beforeunload', () => {
      console.log(`[BatchChatSaver] beforeunload event! batch size=${this.messageBatch.length}`);
      if (this.messageBatch.length > 0) {
        console.log(`[BatchChatSaver] Tab unloading with ${this.messageBatch.length} unsaved messages`);
        this.saveBatch('tab_close', true);
      }
    });

    console.log('[BatchChatSaver] Unload handlers registered!');
  }

  startBatchTimer() {
    // Only run timer every 30 seconds to flush pending messages
    this.batchTimerId = setInterval(() => {
      const timeSinceFlush = Date.now() - this.lastFlushTime;

      if (timeSinceFlush >= this.timerInterval && this.messageBatch.length > 0) {
        console.log(`[BatchChatSaver] Timeout triggered: ${timeSinceFlush}ms elapsed with ${this.messageBatch.length} messages`);
        this.saveBatch('timeout');
      }
    }, this.timerInterval);
  }

  observeChatSwitch() {
    // Use Navigation API or fallback to URL monitoring (but less frequently)
    let lastUrl = window.location.href;

    // Check URL every 3 seconds instead of 1 second
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.onChatSwitch();
      }
    }, 3000);
  }

  async onChatSwitch() {
    const convoId = this.getCurrentConvoId();

    if (!convoId) return;

    if (convoId !== this.currentConvoId) {
      console.log(`[BatchChatSaver] Chat switched from ${this.currentConvoId} to ${convoId}`);

      // Save pending batch from old chat
      if (this.messageBatch.length > 0) {
        console.log(`[BatchChatSaver] Saving ${this.messageBatch.length} messages on chat switch`);
        await this.saveBatch('chat_switch');
      }

      // Switch to new chat
      this.currentConvoId = convoId;
      this.messageBatch = [];
      this.lastFlushTime = Date.now();

      // Query backend for latest state - this is source of truth
      await this.queryChatInfo(convoId);
    }
  }

  async queryChatInfo(convoId) {
    try {
      console.log('[BatchChatSaver] Querying chat info from backend (source of truth)...');
      console.log('[BatchChatSaver] Query params:', { convo_id: convoId, platform: this.platform });

      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'get_chat_info',
          convo_id: convoId,
          platform: this.platform
        }, (resp) => {
          console.log('[BatchChatSaver] Backend response:', resp);
          if (resp && resp.success) {
            resolve(resp);
          } else {
            reject(new Error(resp?.error || 'Failed to get chat info'));
          }
        });
      });

      if (response.exists) {
        this.isNewChat = false;
        this.lastSavedMessageIndex = response.last_saved_message_index || 0;

        // Sync message count with backend state
        this.perChatMessageCount.set(convoId, this.lastSavedMessageIndex);

        console.log(`[BatchChatSaver] OLD chat. Last saved index: ${this.lastSavedMessageIndex}`);
        window.vektoriToast.info('Resuming chat');
      } else {
        this.isNewChat = true;
        this.lastSavedMessageIndex = 0;
        this.perChatMessageCount.set(convoId, 0);

        console.log(`[BatchChatSaver] NEW chat. Starting fresh.`);
        window.vektoriToast.success('Starting new chat');
      }
    } catch (error) {
      console.error('[BatchChatSaver] Chat info query failed:', error);
      this.isNewChat = true;
      this.lastSavedMessageIndex = 0;
      this.perChatMessageCount.set(convoId, 0);
    }
  }

  observeNewMessages() {
    // Use MutationObserver instead of constant polling
    const chatContainer = document.body;

    this.messageObserver = new MutationObserver((mutations) => {
      // Check if mutations contain message-like elements
      const hasRelevantChanges = mutations.some(mutation => {
        // Look for added nodes that might be messages
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Claude message selectors - check if new message was added
              const isMessage = node.matches && (
                node.matches('[data-test-render-count]') ||
                node.querySelector('[data-test-render-count]') ||
                node.matches('.font-claude-message') ||
                node.querySelector('.font-claude-message')
              );
              if (isMessage) return true;
            }
          }
        }
        return false;
      });

      if (hasRelevantChanges) {
        // Debounce: Wait for DOM to settle before parsing
        this.debouncedCheckMessages();
      }
    });

    this.messageObserver.observe(chatContainer, {
      childList: true,
      subtree: true
    });

    console.log('[BatchChatSaver] MutationObserver watching for new messages');
  }

  debouncedCheckMessages() {
    clearTimeout(this.parseDebounceTimer);
    this.parseDebounceTimer = setTimeout(() => {
      this.checkForNewMessages();
    }, this.parseDebounceDelay);
  }

  async checkForNewMessages() {
    // Prevent concurrent parsing
    if (this.isProcessing) {
      console.log('[BatchChatSaver] Already processing, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      const convoId = this.getCurrentConvoId();
      if (convoId !== this.currentConvoId) {
        await this.onChatSwitch();
      }

      if (!this.currentConvoId) {
        this.isProcessing = false;
        return;
      }

      const chatData = await this.parser();
      if (!chatData || !chatData.messages) {
        this.isProcessing = false;
        return;
      }

      const allMessages = chatData.messages;

      // Get last parsed count for THIS conversation
      const lastCount = this.perChatMessageCount.get(this.currentConvoId) || 0;

      // Only process if message count actually increased
      if (allMessages.length > lastCount) {
        const newMessages = allMessages.slice(lastCount);
        console.log(`[BatchChatSaver] Found ${newMessages.length} new messages (${lastCount} → ${allMessages.length})`);

        this.messageBatch.push(...newMessages);
        this.perChatMessageCount.set(this.currentConvoId, allMessages.length);

        if (this.messageBatch.length >= this.batchSize) {
          console.log(`[BatchChatSaver] Batch size reached (${this.messageBatch.length}), saving...`);
          await this.saveBatch('batch_size');
        }
      }
    } catch (error) {
      console.error('[BatchChatSaver] Error checking messages:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  saveBatch(trigger = 'manual', useBeacon = false) {
    if (this.messageBatch.length === 0) {
      console.log('[BatchChatSaver] Skipping save: batch empty');
      return;
    }

    if (!this.currentConvoId) {
      console.log('[BatchChatSaver] Skipping save: no convo_id (not in a chat)');
      this.messageBatch = []; // Clear batch to prevent retry loops
      return;
    }

    const batchData = {
      conversation: { convo_id: this.currentConvoId },
      messages: this.messageBatch,
      platform: this.platform,
      source: 'batch_save',
      trigger: trigger,
      last_saved_message_index: this.lastSavedMessageIndex
    };

    console.log(`[BatchChatSaver] Sending batch of ${this.messageBatch.length} messages (trigger: ${trigger}, from index ${this.lastSavedMessageIndex})...`);

    // Use sendBeacon for reliable delivery during page unload
    if (useBeacon) {
      // sendBeacon only works with POST and doesn't support callbacks
      // We need to send directly to backend
      chrome.runtime.sendMessage({
        action: 'auto_save_chat',
        chatData: batchData,
        platform: this.platform,
        source: 'batch_save',
        urgent: true // Flag for synchronous handling
      });

      this.messageBatch = [];
      console.log('[BatchChatSaver] Sent urgent save via beacon');
      return;
    }

    chrome.runtime.sendMessage({
      action: 'auto_save_chat',
      chatData: batchData,
      platform: this.platform,
      source: 'batch_save'
    }, (response) => {
      if (response && response.success) {
        console.log('[BatchChatSaver] Batch saved successfully:', response);
        window.vektoriToast.success('Chat auto-saved', 4000);

        // Trust backend response as source of truth
        const newIndex = response.next_index || response.last_saved_message_index || (this.lastSavedMessageIndex + this.messageBatch.length);
        this.lastSavedMessageIndex = newIndex;
        this.lastFlushTime = Date.now();
        this.isNewChat = false;

        console.log(`[BatchChatSaver] Backend confirmed save. Next index: ${newIndex}`);
      } else {
        console.error('[BatchChatSaver] Batch save failed:', response?.error);
        window.vektoriToast.error('Failed to auto-save chat');
      }
    });

    // Clear batch immediately (don't wait for callback)
    this.messageBatch = [];
  }
}

// Initialize batch saver
let batchSaver = null;

async function initializeBatchSaver() {
  try {
    const result = await chrome.storage.local.get(['autoSaveEnabled']);
    const isEnabled = result.autoSaveEnabled !== false;

    if (!isEnabled) {
      console.log('[BatchChatSaver] Auto-save is disabled in settings');
      return;
    }
  } catch (error) {
    console.error('[BatchChatSaver] Error checking auto-save setting:', error);
  }

  if (!batchSaver) {
    batchSaver = new BatchChatSaver('claude', claudeChatParser);
    batchSaver.start();
    console.log('[BatchChatSaver] Auto-save enabled and started');
  }
}

console.log('Vektori extension loaded');
startObserver(); // Start watching for changes
initialInject();
initializeBatchSaver();

//so we have to reset flag when the page navigates for SPA
window.addEventListener('beforeunload', resetInjectionFlag);


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'insertMemorySnippet') {
    const inputElement =
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector("textarea") ||
      document.querySelector('p[data-placeholder="How can I help you today?"]') ||
      document.querySelector('p[data-placeholder="Reply to Claude..."]');

    if (!inputElement) {
      sendResponse({ success: false });
      return true;
    }

    // If this is from search memory, inject just the snippet as search query
    if (message.isSearchMemory || message.fromMemorySearch) {
      const snippetText = message.snippet || '';
      if (inputElement.tagName.toLowerCase() === "div") {
        inputElement.textContent = snippetText;
        inputElement.innerHTML = snippetText;
      }
      else if (inputElement.tagName.toLowerCase() === "p") {
        inputElement.textContent = snippetText;
      }
      else {
        inputElement.value = snippetText;
      }
      inputElement.dispatchEvent(new Event("input", { bubbles: true }));
      inputElement.focus();
      sendResponse({ success: true });
      return true;
    }

    // Otherwise, append to existing content (context injection)
    let currentContent = getInputValue();
    const snippetText = `[Memory for context,from another chat]${message.snippet}`;

    if (inputElement.tagName.toLowerCase() === "div") {
      inputElement.innerHTML = currentContent + snippetText.replace(/\n/g, '<br>');
    }
    else if (inputElement.tagName.toLowerCase() === "p") {
      inputElement.textContent = currentContent + snippetText
    }
    else {
      inputElement.value = currentContent + snippetText
    }

    inputElement.dispatchEvent(new Event("input", { bubbles: true }));
    inputElement.focus();

    sendResponse({ success: true });
  }
  return true;
});

// ============================================================================
// CHECK FOR PENDING CONTEXT (auto-inject when arriving from another platform)
// ============================================================================

async function checkForPendingContext() {
  try {
    const result = await chrome.storage.local.get(['vektori_pending_context']);
    const pendingContext = result.vektori_pending_context;

    if (!pendingContext) {
      console.log('[CarryContext] No pending context found');
      return;
    }

    // Check if this context is for us (Claude)
    if (pendingContext.destination !== 'claude') {
      console.log('[CarryContext] Pending context is for:', pendingContext.destination, '- not us');
      return;
    }

    // Check if context is fresh (within last 5 minutes)
    const contextAge = Date.now() - (pendingContext.timestamp || 0);
    const MAX_CONTEXT_AGE = 5 * 60 * 1000; // 5 minutes

    if (contextAge > MAX_CONTEXT_AGE) {
      console.log('[CarryContext] Pending context expired:', contextAge, 'ms old');
      await chrome.storage.local.remove(['vektori_pending_context']);
      return;
    }

    console.log('[CarryContext] Found pending context for Claude!', {
      sourcePlatform: pendingContext.sourcePlatform,
      contextLength: pendingContext.context?.length,
      metadata: pendingContext.metadata
    });

    // Wait for the input element to be available
    const maxWaitTime = 10000; // 10 seconds
    const checkInterval = 500; // Check every 500ms
    let elapsed = 0;

    const waitForInput = () => {
      return new Promise((resolve) => {
        const check = () => {
          const inputElement =
            document.querySelector('div[contenteditable="true"]') ||
            document.querySelector('textarea') ||
            document.querySelector('p[data-placeholder="How can I help you today?"]') ||
            document.querySelector('p[data-placeholder="Reply to Claude..."]');

          if (inputElement) {
            resolve(inputElement);
          } else if (elapsed < maxWaitTime) {
            elapsed += checkInterval;
            setTimeout(check, checkInterval);
          } else {
            resolve(null);
          }
        };
        check();
      });
    };

    const inputElement = await waitForInput();

    if (!inputElement) {
      console.error('[CarryContext] Could not find input element after waiting');
      window.vektoriToast?.error('Could not find chat input. Please paste context manually.');
      // Still copy to clipboard as fallback
      await navigator.clipboard.writeText(pendingContext.context);
      return;
    }

    // Inject the context
    const contextText = pendingContext.context || '';

    if (inputElement.tagName.toLowerCase() === 'div') {
      inputElement.innerHTML = contextText.replace(/\n/g, '<br>');
    } else if (inputElement.tagName.toLowerCase() === 'p') {
      inputElement.textContent = contextText;
    } else {
      inputElement.value = contextText;
    }

    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.focus();

    // Clear the pending context
    await chrome.storage.local.remove(['vektori_pending_context']);

    // Show success toast
    window.vektoriToast?.success(`Context from ${pendingContext.sourcePlatform || 'previous chat'} ready! Review and send.`, 5000);

    console.log('[CarryContext] Successfully injected context', {
      facts: pendingContext.metadata?.facts,
      insights: pendingContext.metadata?.insights,
      sentences: pendingContext.metadata?.sentences
    });

  } catch (error) {
    console.error('[CarryContext] Error checking for pending context:', error);
  }
}

// Check for pending carry context when page loads
// Delay slightly to ensure input element and toast system are ready
setTimeout(checkForPendingContext, 2000);

// ============================================================================
// AUTO-INJECT SETUP
// ============================================================================

// Initialize auto-inject immediately and keep retrying
function initAutoInject() {
  if (!window.VektoriAutoInject) {
    return false; // Wait for retry
  }

  window.VektoriAutoInject.setup({
    getInputElement: () => {
      const selectors = [
        'div.ProseMirror[contenteditable="true"]',
        'div[contenteditable="true"].ProseMirror',
        'fieldset div[contenteditable="true"]',
        'div[contenteditable="true"]',
        'textarea'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    },
    getSendButton: () => {
      const selectors = [
        'button[aria-label="Send Message"]',
        'button[aria-label="Send message"]',
        'button[type="button"][aria-disabled="false"] svg',
        'button[type="submit"]',
        'fieldset button:last-child'
      ];
      for (const sel of selectors) {
        let el = document.querySelector(sel);
        if (el) {
          if (el.tagName === 'svg' || el.tagName === 'SVG') {
            el = el.closest('button');
          }
          if (el) return el;
        }
      }
      return null;
    },
    getInputValue: getInputValue,
    setInputValue: setInputValue,
    toast: window.vektoriToast,
    queryCache: queryCache,
    platformName: 'Claude'
  });
  console.log('[Claude] Auto-inject setup complete');
  return true;
}

// Try immediately
if (!initAutoInject()) {
  // Retry every 500ms until it works
  const initInterval = setInterval(() => {
    if (initAutoInject()) {
      clearInterval(initInterval);
    }
  }, 500);

  // Stop trying after 10 seconds
  setTimeout(() => clearInterval(initInterval), 10000);
}

