// Perplexity Content Script - Vektori Memory Extension

// Production log silencer
(function () {
  if (typeof CONFIG !== 'undefined' && !CONFIG.DEBUG) {
    console.log = () => { };
  }
})();

// Import the Perplexity parser
let script = document.createElement('script');
script.src = chrome.runtime.getURL('parsers/perplexity-parser.js');
document.documentElement.appendChild(script);

// Note: auto-inject.js is bundled via manifest.json

let observer;
let buttonInjected = false;
let contextInjectionEnabled = false; // Toggle for auto-inject
let lastInjectedQuery = null;
let lastInjectionTime = 0;
const INJECTION_COOLDOWN = 10000;
let debounceTimer = null;
const queryCache = new Map();
const MAX_CACHE_SIZE = 50;
const MIN_QUERY_LENGTH = 5;

function getTextarea() {
  return (
    document.querySelector('textarea[id="ask-input"]') ||
    document.querySelector('textarea[placeholder="Ask a follow-up…"]') ||
    document.querySelector('div[contenteditable="true"][id="ask-input"]') ||
    document.querySelector('div[contenteditable="true"][aria-placeholder="Ask anything…"]') ||
    document.querySelector('textarea[placeholder="Ask anything…"]')
  );
}

function getInputText(inputElement) {
  if (!inputElement) {
    return '';
  }

  if (inputElement.tagName === 'TEXTAREA') {
    return inputElement.value || '';
  } else if (inputElement.contentEditable === 'true') {
    const paragraph = inputElement.querySelector('p[dir="ltr"]');
    if (paragraph) {
      let text = '';
      const childNodes = paragraph.childNodes;

      for (let i = 0; i < childNodes.length; i++) {
        const node = childNodes[i];
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent || '';
        } else if (
          node.tagName === 'SPAN' &&
          node.getAttribute('data-lexical-text') === 'true'
        ) {
          text += node.textContent || '';
        } else if (node.tagName === 'BR') {
          text += '\n';
        }
      }

      return text;
    }

    return inputElement.textContent || '';
  }

  return '';
}

function getInputValue() {
  const inputElement = getTextarea();
  return getInputText(inputElement);
}

function setInputValue(newValue) {
  const inputElement = getTextarea();

  if (!inputElement) return false;

  if (inputElement.tagName === "TEXTAREA") {
    inputElement.value = newValue;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } else if (inputElement.contentEditable === 'true') {
    return setContentEditableValue(inputElement, newValue);
  }

  return false;
}

function setContentEditableValue(inputElement, text) {
  try {
    inputElement.focus();

    // Clear existing content first
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);

    // Use clipboard API to paste the text
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setTimeout(() => {
          // Create a paste event with the text data
          const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: new DataTransfer()
          });

          if (pasteEvent.clipboardData) {
            pasteEvent.clipboardData.setData('text/plain', text);
          }

          inputElement.dispatchEvent(pasteEvent);

          // Fallback: use execCommand if paste doesn't work
          setTimeout(() => {
            const currentContent = getInputText(inputElement);
            if (!currentContent.includes(text.substring(0, Math.min(20, text.length)))) {
              document.execCommand('paste', false, null);
            }
          }, 50);
        }, 50);
      }).catch(() => {
        // If clipboard fails, use direct text manipulation
        replaceContentEditableText(inputElement, text);
      });

      return true;
    } else {
      // Fallback for browsers without clipboard API
      replaceContentEditableText(inputElement, text);
      return true;
    }
  } catch (error) {
    console.error('Error setting contenteditable value:', error);
    return false;
  }
}

function replaceContentEditableText(inputElement, text) {
  // Direct manipulation of the Lexical editor structure
  const paragraph = inputElement.querySelector('p[dir="ltr"]');

  if (paragraph) {
    // Clear the paragraph
    paragraph.innerHTML = '';

    // Create span with data-lexical-text attribute
    const span = document.createElement('span');
    span.setAttribute('data-lexical-text', 'true');
    span.textContent = text;

    paragraph.appendChild(span);
  } else {
    // Fallback: just set textContent
    inputElement.textContent = text;
  }

  // Trigger input events
  inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  inputElement.dispatchEvent(new Event('change', { bubbles: true }));
  inputElement.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
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
  }  // VALIDATION 2: Already has context
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
    window.vektoriToast.warning(`Please wait ${remainingSeconds}s before next context injection`);
    return;
  }

  // CHECK CACHE FIRST
  if (queryCache.has(currentInput)) {
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
      window.vektoriToast.update(loadingToastId, 'No relevant memories found for this query', {
        type: 'info',
        duration: 3000
      });
    }
  } catch (error) {
    window.vektoriToast.update(loadingToastId, 'Failed to build context. Please try again.', {
      type: 'error',
      duration: 4000
    });
  }
}


function showAuthPopup() {
  const popupOverlay = document.createElement('div');
  popupOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
  `;

  const popupContainer = document.createElement('div');
  popupContainer.style.cssText = `
    background: #1A1A1A;
    border-radius: 12px;
    padding: 32px 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  `;

  const closeButton = document.createElement('button');
  closeButton.textContent = '✕';
  closeButton.style.cssText = `
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: #A1A1A1;
    font-size: 18px;
    cursor: pointer;
    transition: color 0.2s;
  `;
  closeButton.addEventListener('mouseenter', () => { closeButton.style.color = '#FFFFFF'; });
  closeButton.addEventListener('mouseleave', () => { closeButton.style.color = '#A1A1A1'; });
  closeButton.addEventListener('click', () => { document.body.removeChild(popupOverlay); });

  const logoContainer = document.createElement('div');
  logoContainer.style.cssText = `
    text-align: center;
    margin-bottom: 24px;
  `;

  const logoText = document.createElement('div');
  logoText.textContent = 'Vektori';
  logoText.style.cssText = `
    font-size: 32px;
    font-weight: 700;
    color: #FFFFFF;
  `;
  logoContainer.appendChild(logoText);

  const message = document.createElement('p');
  message.textContent = 'Please sign in to access your memories and enhance your conversations!';
  message.style.cssText = `
    margin: 0 0 24px 0;
    color: #D4D4D8;
    font-size: 14px;
    line-height: 1.5;
    text-align: center;
  `;

  const signInButton = document.createElement('button');
  signInButton.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 10px;
    background-color: white;
    color: black;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  `;

  const signInText = document.createElement('span');
  signInText.textContent = 'Sign in with Vektori';
  signInButton.appendChild(signInText);

  signInButton.addEventListener('mouseenter', () => {
    signInButton.style.backgroundColor = '#f5f5f5';
  });

  signInButton.addEventListener('mouseleave', () => {
    signInButton.style.backgroundColor = 'white';
  });

  signInButton.addEventListener('click', () => {
    window.open('https://vektori.cloud/login', '_blank');
    document.body.removeChild(popupOverlay);
  });

  popupContainer.appendChild(closeButton);
  popupContainer.appendChild(logoContainer);
  popupContainer.appendChild(message);
  popupContainer.appendChild(signInButton);

  popupOverlay.appendChild(popupContainer);

  popupOverlay.addEventListener('click', e => {
    if (e.target === popupOverlay) {
      document.body.removeChild(popupOverlay);
    }
  });

  document.body.appendChild(popupOverlay);
}

function setupInputListener() {
  const inputElement = getTextarea();

  if (!inputElement) {
    setTimeout(setupInputListener, 1000);
    return;
  }

  inputElement.addEventListener('input', () => {
    if (!contextInjectionEnabled) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      injectContextIntoPrompt();
    }, 2000);
  });
}

function startObserver() {
  if (observer) observer.disconnect();

  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const buttonContainer = document.querySelector('div[class="flex items-center justify-self-end col-start-3 row-start-2')
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
  buttonContainer.insertBefore(memoryBtn, buttonContainer.firstChild);
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
  const existingOverlay = document.getElementById('vektori-destination-overlay');
  const existingModal = document.getElementById('vektori-destination-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();

  const overlay = document.createElement('div');
  overlay.id = 'vektori-destination-overlay';
  overlay.className = 'vektori-destination-overlay';

  const modal = document.createElement('div');
  modal.id = 'vektori-destination-modal';
  modal.className = 'vektori-destination-modal';

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
    <div class="vektori-destination-grid">${destinationItems}</div>
    <div class="vektori-destination-footer">
      <button class="vektori-destination-cancel">Cancel</button>
      <button class="vektori-destination-copy-only">Just Copy</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  const closeModal = () => { overlay.remove(); modal.remove(); };
  overlay.addEventListener('click', closeModal);
  modal.querySelector('.vektori-destination-cancel').addEventListener('click', closeModal);

  modal.querySelector('.vektori-destination-copy-only').addEventListener('click', async () => {
    closeModal();
    await handleCopyOnlyCarryContext(currentPlatform);
  });

  modal.querySelectorAll('.vektori-destination-item:not(.current-platform)').forEach(item => {
    item.addEventListener('click', async () => {
      closeModal();
      await handleCarryToDestination(item.dataset.destination, currentPlatform);
    });
  });
}

async function handleCopyOnlyCarryContext(platform) {
  const loadingId = window.vektoriToast.loading('Saving and generating context...');
  try {
    const chatData = perplexityChatParser();
    if (!chatData || !chatData.conversation?.convo_id) {
      window.vektoriToast.update(loadingId, 'Could not parse chat.', { type: 'error', duration: 4000 });
      return;
    }
    chrome.runtime.sendMessage({ action: 'carry_context', chatData, platform }, async (response) => {
      if (response?.success) {
        await navigator.clipboard.writeText(response.data.formattedContext || '');
        window.vektoriToast.update(loadingId, 'Context copied!', { type: 'success', duration: 5000 });
      } else {
        window.vektoriToast.update(loadingId, response?.error || 'Failed.', { type: 'error', duration: 4000 });
      }
    });
  } catch (e) {
    window.vektoriToast.update(loadingId, 'Error occurred.', { type: 'error', duration: 4000 });
  }
}

async function handleCarryToDestination(destination, sourcePlatform) {
  const loadingId = window.vektoriToast.loading(`Preparing context for ${DESTINATION_CONFIG[destination]?.name}...`);
  try {
    const chatData = perplexityChatParser();
    if (!chatData || !chatData.conversation?.convo_id) {
      window.vektoriToast.update(loadingId, 'Could not parse chat.', { type: 'error', duration: 4000 });
      return;
    }
    chrome.runtime.sendMessage({ action: 'carry_context_to_destination', chatData, platform: sourcePlatform, destination }, (response) => {
      if (response?.success) {
        window.vektoriToast.update(loadingId, `Opening ${DESTINATION_CONFIG[destination]?.name}...`, { type: 'success', duration: 4000 });
      } else {
        window.vektoriToast.update(loadingId, response?.error || 'Failed.', { type: 'error', duration: 4000 });
      }
    });
  } catch (e) {
    window.vektoriToast.update(loadingId, 'Error occurred.', { type: 'error', duration: 4000 });
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
    properties: { button: action, platform: 'perplexity' }
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
      const chatData = perplexityChatParser();

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
      if (!(await window.vektoriCheckAuth())) return;
      showDestinationPicker('perplexity');
      break;

    default:
      console.log('Unknown action:', action);
  }

  const menu = document.getElementById('memory-menu');
  if (menu) menu.remove();
}


//initial injection
function initialInject() {
  const buttonContainer = document.querySelector('div[class="flex items-center justify-self-end col-start-3 row-start-2"]');
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

// BATCH CHAT SAVER 
class BatchChatSaver {
  constructor(platform, parser) {
    this.platform = platform;
    this.parser = parser;
    this.currentConvoId = null;
    this.isNewChat = false;
    this.messageBatch = [];
    this.batchSize = 10;
    this.lastSavedMessageIndex = 0;

    this.timerInterval = 30000;
    this.lastFlushTime = Date.now();
    this.batchTimerId = null;

    // Debouncing - INCREASED to wait for LLM streaming to complete
    this.parseDebounceTimer = null;
    this.parseDebounceDelay = 30000; // 10 seconds - gives time for LLM to finish streaming
    this.messageObserver = null;
    this.isProcessing = false;

    // Track message counts per conversation
    this.perChatMessageCount = new Map();

    console.log(`[BatchChatSaver] Initialized for ${platform}`);
  }

  getCurrentConvoId() {
    // Perplexity URL format: /search/{query}-{convoId}
    const url = window.location.href;
    const match = url.match(/\/search\/[^\/]+-([a-zA-Z0-9._\-]+)/);
    if (match && match[1]) {
      return match[1];
    }

    // Fallback: extract from last hyphen
    const urlPath = window.location.pathname;
    const parts = urlPath.split('-');
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart.length > 10) {
        return lastPart;
      }
    }

    return null;
  }

  start() {
    this.observeChatSwitch();
    this.observeNewMessages();
    this.startBatchTimer();
    this.setupUnloadHandler();
    console.log('[BatchChatSaver] Started monitoring (with tab close handler!)');
  }

  setupUnloadHandler() {
    console.log('[BatchChatSaver] Setting up unload handlers...');

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
    this.batchTimerId = setInterval(() => {
      const timeSinceFlush = Date.now() - this.lastFlushTime;

      if (timeSinceFlush >= this.timerInterval && this.messageBatch.length > 0) {
        console.log(`[BatchChatSaver] Timeout triggered: ${timeSinceFlush}ms elapsed with ${this.messageBatch.length} messages`);
        this.saveBatch('timeout');
      }
    }, this.timerInterval);
  }

  observeChatSwitch() {
    let lastUrl = window.location.href;

    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.onChatSwitch();
      }
    }, 3000); // Reduced from 1s to 3s
  }

  async onChatSwitch() {
    const convoId = this.getCurrentConvoId();

    if (!convoId) return;

    if (convoId !== this.currentConvoId) {
      console.log(`[BatchChatSaver] Chat switched from ${this.currentConvoId} to ${convoId}`);

      if (this.messageBatch.length > 0) {
        console.log(`[BatchChatSaver] Saving ${this.messageBatch.length} messages on chat switch`);
        await this.saveBatch('chat_switch');
      }

      this.currentConvoId = convoId;
      this.messageBatch = [];
      this.lastFlushTime = Date.now();

      await this.queryChatInfo(convoId);
    }
  }

  async queryChatInfo(convoId) {
    try {
      console.log('[BatchChatSaver] Querying backend (source of truth)...');

      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'get_chat_info',
          convo_id: convoId,
          platform: this.platform
        }, (resp) => {
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
      const hasRelevantChanges = mutations.some(mutation => {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Perplexity message selectors
              const isMessage = node.matches && (
                node.matches('[class*="Answer"]') ||
                node.querySelector('[class*="Answer"]') ||
                node.matches('.prose') ||
                node.querySelector('.prose')
              );
              if (isMessage) return true;
            }
          }
        }
        return false;
      });

      if (hasRelevantChanges) {
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

      const chatData = this.parser();
      if (!chatData || !chatData.messages) {
        this.isProcessing = false;
        return;
      }

      const allMessages = chatData.messages;
      const lastCount = this.perChatMessageCount.get(this.currentConvoId) || 0;

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

    if (useBeacon) {
      chrome.runtime.sendMessage({
        action: 'auto_save_chat',
        chatData: batchData,
        platform: this.platform,
        source: 'batch_save',
        urgent: true
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
    batchSaver = new BatchChatSaver('perplexity', perplexityChatParser);
    batchSaver.start();
    console.log('[BatchChatSaver] Auto-save enabled and started');
  }
}

console.log('Vektori extension loaded');
startObserver(); // Start watching for changes
initialInject();
setupInputListener();
initializeBatchSaver();

//so we have to reset flag when the page navigates for SPA
window.addEventListener('beforeunload', resetInjectionFlag);

// Check for pending carry context
async function checkForPendingContext() {
  try {
    const result = await chrome.storage.local.get(['vektori_pending_context']);
    const pendingContext = result.vektori_pending_context;
    if (!pendingContext || pendingContext.destination !== 'perplexity') return;

    const contextAge = Date.now() - (pendingContext.timestamp || 0);
    if (contextAge > 5 * 60 * 1000) {
      await chrome.storage.local.remove(['vektori_pending_context']);
      return;
    }

    const inputElement = await new Promise(resolve => {
      let elapsed = 0;
      const check = () => {
        const el = getTextarea();
        if (el) resolve(el);
        else if (elapsed < 10000) { elapsed += 500; setTimeout(check, 500); }
        else resolve(null);
      };
      check();
    });

    if (!inputElement) {
      await navigator.clipboard.writeText(pendingContext.context);
      window.vektoriToast?.error('Could not find input. Context copied to clipboard.');
      return;
    }

    setInputValue(pendingContext.context);
    inputElement.focus();
    await chrome.storage.local.remove(['vektori_pending_context']);
    window.vektoriToast?.success(`Context from ${pendingContext.sourcePlatform} ready!`, 5000);
  } catch (e) {
    console.error('[CarryContext] Error:', e);
  }
}
setTimeout(checkForPendingContext, 2000);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'insertMemorySnippet') {
    const inputElement = getTextarea();

    if (!inputElement) {
      sendResponse({ success: false });
      return true;
    }

    // If this is from search memory, inject just the snippet as search query
    if (message.isSearchMemory || message.fromMemorySearch) {
      const snippetText = message.snippet || '';
      if (setInputValue(snippetText)) {
        inputElement.focus();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false });
      }
      return true;
    }

    // Otherwise, append to existing content (context injection)
    let currentContent = getInputValue();
    const snippetText = `[Memory for context,from another chat]${message.snippet}`;
    const finalText = currentContent + snippetText;

    if (setInputValue(finalText)) {
      inputElement.focus();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
  }
  return true;
});

// ============================================================================
// AUTO-INJECT SETUP
// ============================================================================

setTimeout(() => {
  if (window.VektoriAutoInject) {
    window.VektoriAutoInject.setup({
      getInputElement: getTextarea,
      getSendButton: () => {
        return document.querySelector('button[aria-label="Submit"]') ||
          document.querySelector('button[type="submit"]') ||
          document.querySelector('button[aria-label="Send"]');
      },
      getInputValue: getInputValue,
      setInputValue: setInputValue,
      toast: window.vektoriToast,
      queryCache: queryCache,
      platformName: 'Perplexity'
    });
    console.log('[Perplexity] Auto-inject initialized');
  }
}, 1500);