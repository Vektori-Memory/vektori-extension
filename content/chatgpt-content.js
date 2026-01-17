// ChatGPT Content Script - Vektori Memory Extension

// Production log silencer - silences console.log when DEBUG is false
(function () {
  if (typeof CONFIG !== 'undefined' && !CONFIG.DEBUG) {
    window._originalConsoleLog = console.log;
    console.log = () => { };
  }
})();

// Register message listener FIRST, before anything else
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.action === 'ping') {
    sendResponse({ success: true, message: 'Content script is ready' });
    return true;
  }

  if (message.action === 'clickManageButton') {

    let alreadySaved = false;

    const scrollToBottom = () => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    const extractAndSaveMemories = () => {
      if (alreadySaved) {
        console.log('Already saved, skipping');
        return;
      }
      alreadySaved = true;

      // ChatGPT memory divs - try multiple selectors as DOM changes frequently
      const memoryDivs = document.querySelectorAll('.min-w-0.flex-1.py-3.whitespace-pre-wrap') ||
        document.querySelectorAll('[class*="whitespace-pre-wrap"]');

      if (memoryDivs.length === 0) {
        console.log('No memories found');
        sendResponse({ success: false, message: 'No memories found' });
        return;
      }

      const memories = Array.from(memoryDivs).map(div => div.textContent.trim());

      // Match the backend's expected structure - NO timestamp in messages!
      const memoryConvo = {
        conversation: {
          platform: 'chatgpt_memory',
          convo_id: generateUUID(),
          title: 'ChatGPT Memory Import',
          timestamp: new Date().toISOString()
        },
        messages: memories.map((memory, index) => ({
          role: 'user',
          text_content: memory,
          message_index: index,
          convo_id: generateUUID()
        }))
      };

      console.log(`Saving ${memories.length} memories...`);

      chrome.runtime.sendMessage(
        { action: 'save_chat', chatData: memoryConvo },
        (response) => {
          if (response && response.success) {
            console.log('Memories saved successfully');
            sendResponse({ success: true, count: memories.length });
          } else {
            console.error('Save failed:', response?.error);
            sendResponse({ success: false, message: 'Save failed' });
          }
        }
      );
    };

    let attempts = 0;
    const maxAttempts = 10;
    let buttonClicked = false;

    const intervalId = setInterval(() => {
      if (buttonClicked) {
        clearInterval(intervalId);
        return;
      }

      attempts++;

      scrollToBottom();

      setTimeout(() => {
        if (buttonClicked) return;

        const allButtons = document.querySelectorAll('button');
        const manageBtn = Array.from(allButtons).find(btn =>
          btn.textContent.trim() === 'Manage'
        );

        if (manageBtn) {
          buttonClicked = true;
          clearInterval(intervalId);
          manageBtn.click();
          console.log('Clicked Manage button');
          setTimeout(extractAndSaveMemories, 2000);
          sendResponse({ success: true, message: 'Button clicked' });
        } else if (attempts >= maxAttempts) {
          clearInterval(intervalId);
          console.log('Manage button not found');
          sendResponse({ success: false, message: 'Button not found' });
        }
      }, 500);
    }, 1500);

    return true;
  }

  if (message.action === 'insertMemorySnippet') {
    const inputElement =
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector('textarea');

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
      } else if (inputElement.tagName.toLowerCase() === "p") {
        inputElement.textContent = snippetText;
      } else {
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
    } else if (inputElement.tagName.toLowerCase() === "p") {
      inputElement.textContent = currentContent + snippetText;
    } else {
      inputElement.value = currentContent + snippetText;
    }

    inputElement.dispatchEvent(new Event("input", { bubbles: true }));
    inputElement.focus();
    sendResponse({ success: true });
  }

  return true;
});

if (window.vektoriExtensionLoaded) {
  console.log('Vektori already loaded, skipping initialization');
} else {

  let script = document.createElement('script');
  script.src = chrome.runtime.getURL('parsers/chatgpt-parser.js');
  document.documentElement.appendChild(script);

  // Note: auto-inject.js is bundled via manifest.json

  let observer;
  let buttonInjected = false;
  let contextInjectionEnabled = false; // Toggle for auto-inject
  const queryCache = new Map();
  const MAX_CACHE_SIZE = 50;
  let lastInjectedQuery = null;
  let lastInjectionTime = 0;
  const INJECTION_COOLDOWN = 10000;
  let debounceTimer = null;
  const MIN_QUERY_LENGTH = 5; // Minimum 5 characters to avoid cache spam

  function getInputValue() {
    const inputElement =
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector("textarea");

    if (!inputElement) return "";

    if (inputElement.tagName.toLowerCase() === "div") {
      return inputElement.innerHTML || "";
    } else if (inputElement.tagName.toLowerCase() === "p") {
      return inputElement.textContent || "";
    } else {
      return inputElement.value || "";
    }
  }

  function setInputValue(newValue) {
    const inputElement = document.querySelector('#prompt-textarea') ||
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector("textarea");

    if (!inputElement) return false;

    if (inputElement.tagName.toLowerCase() === "div") {
      // Convert newlines to <p> tags for proper rich text formatting
      const paragraphs = newValue.split('\n').map(line => {
        if (line.trim() === '') return '<p><br></p>';
        return `<p>${line}</p>`;
      }).join('');
      inputElement.innerHTML = paragraphs;
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
    // For ChatGPT contenteditable divs, check for actual text content
    const textContent = currentInput.replace(/<[^>]*>/g, '').trim(); // Strip all HTML tags
    if (!textContent || textContent.length === 0) {
      if (window.vektoriToast) {
        window.vektoriToast.warning('Please enter a query to inject context');
      } else {
        console.warn('[Context] Empty query - skipping injection');
      }
      return;
    }

    if (textContent.length < MIN_QUERY_LENGTH) {
      if (window.vektoriToast) {
        window.vektoriToast.warning(`Query needs at least ${MIN_QUERY_LENGTH} characters for context`);
      } else {
        console.warn(`[Context] Query too short (${textContent.length}/${MIN_QUERY_LENGTH} chars)`);
      }
      return;
    }

    if (currentInput.length < MIN_QUERY_LENGTH) {
      if (window.vektoriToast) {
        window.vektoriToast.warning(`Query needs at least ${MIN_QUERY_LENGTH} characters for context`);
      } else {
        console.warn(`[Context] Query too short (${currentInput.length}/${MIN_QUERY_LENGTH} chars)`);
      }
      return;
    }

    // VALIDATION 2: Already has context
    if (currentInput.includes('Context:') || currentInput.includes('Memory, might or might not be relevent')) {
      if (window.vektoriToast) {
        window.vektoriToast.info('Context already added to this query');
      } else {
        console.log('[Context] Context already added to this query');
      }
      return;
    }

    // VALIDATION 3: Same query as last time - USE CACHE instead of blocking
    if (currentInput === lastInjectedQuery && queryCache.has(currentInput)) {
      console.log('Same query as last time, using cache');
      const cachedContext = queryCache.get(currentInput);
      if (cachedContext) {
        const enhancedPrompt = `Just for context: only, take in account if relevent to user query: ${cachedContext}\n\n${currentInput}\n`;
        setInputValue(enhancedPrompt);
        if (window.vektoriToast) {
          window.vektoriToast.success('Context injected from cache ⚡');
        }
      }
      return;
    }

    // VALIDATION 4: Cooldown check (prevent spam)
    const now = Date.now();
    if (now - lastInjectionTime < INJECTION_COOLDOWN) {
      const remainingSeconds = Math.ceil((INJECTION_COOLDOWN - (now - lastInjectionTime)) / 1000);
      if (window.vektoriToast) {
        window.vektoriToast.warning(`Please wait ${remainingSeconds}s before next context injection`);
      } else {
        console.warn(`[Context] Cooldown active: ${remainingSeconds}s remaining`);
      }
      return;
    }

    // CHECK CACHE FIRST
    if (queryCache.has(currentInput)) {
      const cachedContext = queryCache.get(currentInput);
      if (cachedContext) {
        const enhancedPrompt = `Just for context: only, take in account if relevent to user query: ${cachedContext}\n\n${currentInput}\n`;
        setInputValue(enhancedPrompt);
        window.vektoriToast?.success('Context injected from cache ⚡');
        lastInjectedQuery = currentInput;
        lastInjectionTime = now;
      }
      return;
    }

    // Show loading toast with unique ID
    const loadingToastId = window.vektoriToast?.loading('Building context from your memory...') || null;
    if (!loadingToastId) {
      console.warn('[Context] Toast system not available');
    }

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
          // Update loading toast to success
          if (loadingToastId && window.vektoriToast) {
            window.vektoriToast.update(loadingToastId, 'Context injected successfully', {
              type: 'success',
              duration: 3000
            });
          } else {
            console.log('[Context] ✓ Context injected successfully (toast unavailable)');
          }
          lastInjectedQuery = currentInput;
          lastInjectionTime = now;

          // Check if credits are low and show warning
          const creditsRemaining = result.metadata?.creditsRemaining;
          if (creditsRemaining !== undefined && creditsRemaining !== null && window.vektoriToast) {
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
        if (loadingToastId && window.vektoriToast) {
          window.vektoriToast.update(loadingToastId, 'No relevant memories found for this query', {
            type: 'info',
            duration: 3000
          });
        }
      }
    } catch (error) {
      console.error('Context injection failed:', error);
      if (loadingToastId && window.vektoriToast) {
        window.vektoriToast.update(loadingToastId, 'Failed to build context. Please try again.', {
          type: 'error',
          duration: 4000
        });
      }
    }
  }

  function setupInputListener() {
    const inputElement =
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector("textarea");

    if (!inputElement) {
      setTimeout(setupInputListener, 1000);
      return;
    }

    inputElement.addEventListener('input', () => {
      if (!contextInjectionEnabled) return;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        injectContextIntoPrompt();
      }, 2000); // Inject after 2 sec of no typing
    });
  }


  function startObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // const buttonContainer = document.querySelector('div[class=-my-2.5 flex min-h-14 items-center overflow-x-hidden px-1.5 [grid-area:primary] group-data-expanded/composer:mb-0 group-data-expanded/composer:px-2.5"]');
          const buttonContainer = document.querySelector('div[class="-my-2.5 flex min-h-14 items-center overflow-x-hidden px-1.5 [grid-area:primary] group-data-expanded/composer:mb-0 group-data-expanded/composer:px-2.5"]')
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

  function addMemoryButton(sendBtn) {
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
    sendBtn.appendChild(memoryBtn);
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
      const chatData = await window.chatGPTChatParser();

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
      const chatData = await window.chatGPTChatParser();

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

    // Close menu first
    const menu = document.getElementById('memory-menu');
    if (menu) menu.remove();

    // AUTH CHECK for all actions
    const isAuthenticated = await window.vektoriCheckAuth();
    if (!isAuthenticated) {
      return;
    }

    // Track button click via background script (for PostHog analytics)
    chrome.runtime.sendMessage({
      action: 'track_event',
      eventName: 'inpage_button_clicked',
      properties: { button: action, platform: 'chatgpt' }
    });

    switch (action) {
      case 'inject':
        console.log('inject button clicked');
        await injectContextIntoPrompt();
        break;

      case 'search':
        console.log('search button clicked');
        chrome.runtime.sendMessage({
          action: 'openSidePanel'   // ← Background script listens for this
        }, (response) => {            // ← Callback receives response
          if (response && response.success) {
            console.log('Side panel opened successfully');
          } else {
            console.error('Failed to open side panel:', response?.error);
            window.vektoriToast.error('Failed to open search panel');
          }
        });
        break;
      case 'save_chat':
        console.log('save_chat clicked');

        if (!(await window.vektoriCheckAuth())) {
          return;
        }

        const loadingId = window.vektoriToast.loading('Saving conversation...');

        const chatData = await window.chatGPTChatParser();

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
          }
          else {
            console.error('Failed to save chat:', response?.error);
            const errorMsg = response?.error || 'Unknown error';

            // Show specific error message if available
            let displayMessage = 'Failed to save chat';
            if (errorMsg.includes('Not authenticated') || errorMsg.includes('NO_AUTH_FOUND')) {
              displayMessage = 'Please sign in to save chats';
            } else if (errorMsg.includes('Session expired') || errorMsg.includes('INVALID_REFRESH_TOKEN')) {
              displayMessage = 'Session expired. Please sign in again';
            } else if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
              displayMessage = 'Network error. Check your connection';
            } else if (errorMsg.length < 100) {
              displayMessage = `Failed: ${errorMsg}`;
            }

            window.vektoriToast.update(loadingId, displayMessage, {
              type: 'error',
              duration: 5000
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
        showDestinationPicker('chatgpt');
        break;
      default:
        console.log('Unknown action:', action);
    }
  }


  //initial injection
  function initialInject() {
    const buttonContainer = document.querySelector('div[class="-my-2.5 flex min-h-14 items-center overflow-x-hidden px-1.5 [grid-area:primary] group-data-expanded/composer:mb-0 group-data-expanded/composer:px-2.5"]');
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
      this.parseDebounceDelay = 10000; // 10 seconds - gives time for LLM to finish streaming
      this.messageObserver = null;
      this.isProcessing = false;

      // Track message counts per conversation (survives chat switches)
      this.perChatMessageCount = new Map();

      console.log(`[BatchChatSaver] Initialized for ${platform}`);
    }

    getCurrentConvoId() {
      // ChatGPT URL format: /c/{convoId}
      const url = window.location.href;
      const match = url.match(/\/c\/([a-zA-Z0-9\-]+)/);
      return match ? match[1] : null;
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
        console.log('[BatchChatSaver] Querying chat info from backend (source of truth)...');

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
          window.vektoriToast?.info('Resuming chat');
        } else {
          this.isNewChat = true;
          this.lastSavedMessageIndex = 0;
          this.perChatMessageCount.set(convoId, 0);
          console.log(`[BatchChatSaver] NEW chat. Starting fresh.`);
          window.vektoriToast?.success('Starting new chat');
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
                // ChatGPT message selectors
                const isMessage = node.matches && (
                  node.matches('[data-message-author-role]') ||
                  node.querySelector('[data-message-author-role]') ||
                  node.matches('.markdown') ||
                  node.querySelector('.markdown')
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

        const chatData = await this.parser();
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
          window.vektoriToast?.success('Chat auto-saved', 4000);

          const newIndex = response.next_index || response.last_saved_message_index || (this.lastSavedMessageIndex + this.messageBatch.length);
          this.lastSavedMessageIndex = newIndex;
          this.lastFlushTime = Date.now();
          this.isNewChat = false;

          console.log(`[BatchChatSaver] Backend confirmed save. Next index: ${newIndex}`);
        } else {
          console.error('[BatchChatSaver] Batch save failed:', response?.error);
          window.vektoriToast?.error('Failed to auto-save chat');
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
      batchSaver = new BatchChatSaver('chatgpt', chatGPTChatParser);
      batchSaver.start();
      console.log('[BatchChatSaver] Auto-save enabled and started');
    }
  }

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

      // Check if this context is for us (ChatGPT)
      if (pendingContext.destination !== 'chatgpt') {
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

      console.log('[CarryContext] Found pending context for ChatGPT!', {
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
            const inputElement = document.querySelector('div[contenteditable="true"]') ||
              document.querySelector('textarea');

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

  console.log('Vektori extension loaded');
  startObserver();
  initialInject();
  setupInputListener();
  initializeBatchSaver();

  // Check for pending carry context (from another platform)
  // Delay slightly to ensure toast system is ready
  setTimeout(checkForPendingContext, 2000);

  // Mark extension as loaded to prevent double initialization
  window.vektoriExtensionLoaded = true;

  window.addEventListener('beforeunload', resetInjectionFlag);

  // ============================================================================
  // AUTO-INJECT SETUP
  // ============================================================================

  // Wait for auto-inject module to load, then initialize
  setTimeout(() => {
    if (window.VektoriAutoInject) {
      window.VektoriAutoInject.setup({
        getInputElement: () => {
          return document.querySelector('#prompt-textarea') ||
            document.querySelector('div[contenteditable="true"]') ||
            document.querySelector('textarea');
        },
        getSendButton: () => {
          return document.querySelector('button[data-testid="send-button"]') ||
            document.querySelector('button[aria-label="Send prompt"]') ||
            document.querySelector('button[type="submit"]');
        },
        getInputValue: () => {
          const el = document.querySelector('#prompt-textarea') ||
            document.querySelector('div[contenteditable="true"]') ||
            document.querySelector('textarea');
          if (!el) return '';
          if (el.tagName.toLowerCase() === 'div') {
            return el.textContent || '';
          }
          return el.value || '';
        },
        setInputValue: setInputValue,
        toast: window.vektoriToast,
        queryCache: queryCache,
        platformName: 'ChatGPT'
      });
      console.log('[ChatGPT] Auto-inject initialized');
    } else {
      console.log('[ChatGPT] Auto-inject module not found');
    }
  }, 1500);

}