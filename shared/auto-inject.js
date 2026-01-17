// Vektori Auto-Inject Module
// Intercepts BOTH Enter key AND Send button click

(function () {
    'use strict';

    if (window.VektoriAutoInject) {
        console.log('[VektoriAutoInject] Already initialized');
        return;
    }

    let isProcessing = false;
    let config = null;
    let autoInjectEnabledCache = true;
    let lastProcessedMessage = '';
    let lastProcessTime = 0;
    let documentListenerAttached = false;
    let attachedSendButton = null;
    let cachedInputValue = ''; // Cache input on every keystroke because Claude clears before we read
    const DUPLICATE_THRESHOLD = 1000;

    function loadEnabledState() {
        chrome.storage.local.get(['autoInjectEnabled'], (result) => {
            autoInjectEnabledCache = result.autoInjectEnabled !== false;
            console.log('[AutoInject] Enabled:', autoInjectEnabledCache);
        });
    }

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.autoInjectEnabled) {
            autoInjectEnabledCache = changes.autoInjectEnabled.newValue !== false;
        }
    });

    async function fetchContext(query) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'build_context', query }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('[AutoInject] Runtime error:', chrome.runtime.lastError);
                    resolve(null);
                    return;
                }
                if (response && response.success && response.data?.context) {
                    resolve(response.data.context);
                } else {
                    resolve(null);
                }
            });
        });
    }

    function clickSendButton() {
        if (!config || !config.getSendButton) return false;
        const btn = config.getSendButton();
        if (btn && !btn.disabled) {
            console.log('[AutoInject] Clicking send button');
            btn.click();
            return true;
        }
        return false;
    }

    function triggerSend() {
        if (!clickSendButton()) {
            // Fallback: dispatch Enter on input
            const input = config.getInputElement ? config.getInputElement() : null;
            if (input) {
                console.log('[AutoInject] Dispatching Enter key');
                input.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
                    bubbles: true, cancelable: false
                }));
            }
        }
    }

    async function processMessage(originalInput, eventToBlock) {
        if (eventToBlock) {
            eventToBlock.preventDefault();
            eventToBlock.stopPropagation();
        }

        const safetyTimeout = setTimeout(() => {
            console.log('[AutoInject] Safety timeout - resetting');
            isProcessing = false;
        }, 10000);

        const now = Date.now();
        if (originalInput === lastProcessedMessage && (now - lastProcessTime) < DUPLICATE_THRESHOLD) {
            console.log('[AutoInject] Duplicate, skipping');
            clearTimeout(safetyTimeout);
            isProcessing = false;
            return;
        }

        console.log('[AutoInject] Processing:', originalInput.substring(0, 50) + '...');

        let loadingToastId = null;
        if (config.toast && config.toast.loading) {
            loadingToastId = config.toast.loading('Building context...');
        }

        try {
            // Check cache
            if (config.queryCache && config.queryCache.has(originalInput)) {
                const cachedContext = config.queryCache.get(originalInput);
                if (cachedContext) {
                    const enhanced = `[MEMORY CONTEXT - Use ONLY if directly relevant to my question below. If not relevant, completely ignore this section.]\n${cachedContext}\n\n[MY QUESTION]\n${originalInput}`;
                    config.setInputValue(enhanced);
                    if (config.toast && loadingToastId) {
                        config.toast.update(loadingToastId, 'Context from cache ⚡', { type: 'success', duration: 2000 });
                    }
                    lastProcessedMessage = originalInput;
                    lastProcessTime = Date.now();
                    setTimeout(() => {
                        triggerSend();
                        clearTimeout(safetyTimeout);
                        isProcessing = false;
                    }, 150);
                    return;
                }
            }

            const context = await fetchContext(originalInput);

            if (context && context.trim().length > 0) {
                if (config.queryCache) {
                    config.queryCache.set(originalInput, context);
                    if (config.queryCache.size > 50) {
                        const firstKey = config.queryCache.keys().next().value;
                        config.queryCache.delete(firstKey);
                    }
                }
                const enhanced = `[MEMORY CONTEXT - Use ONLY if directly relevant to my question below. If not relevant, completely ignore this section.]\n${context}\n\n[MY QUESTION]\n${originalInput}`;
                config.setInputValue(enhanced);
                if (config.toast && loadingToastId) {
                    config.toast.update(loadingToastId, 'Context injected!', { type: 'success', duration: 2000 });
                }
            } else {
                if (config.toast && loadingToastId) {
                    config.toast.update(loadingToastId, 'No context found', { type: 'info', duration: 2000 });
                }
            }

            lastProcessedMessage = originalInput;
            lastProcessTime = Date.now();

            setTimeout(() => {
                triggerSend();
                clearTimeout(safetyTimeout);
                isProcessing = false;
            }, 150);

        } catch (error) {
            console.error('[AutoInject] Error:', error);
            if (config.toast && loadingToastId) {
                config.toast.update(loadingToastId, 'Error, sending as-is', { type: 'warning', duration: 2000 });
            }
            lastProcessedMessage = originalInput;
            lastProcessTime = Date.now();
            setTimeout(() => {
                triggerSend();
                clearTimeout(safetyTimeout);
                isProcessing = false;
            }, 150);
        }
    }

    function shouldProcess() {
        if (!config) { console.error('[AutoInject DEBUG] No config'); return false; }
        if (!autoInjectEnabledCache) { console.error('[AutoInject DEBUG] Disabled'); return false; }
        if (isProcessing) { console.error('[AutoInject DEBUG] Already processing'); return false; }

        const input = config.getInputValue ? config.getInputValue() : '';
        if (!input || input.trim().length < 3) {
            console.error('[AutoInject DEBUG] Input too short:', input ? input.length : 0);
            return false;
        }
        if (input.includes('[MEMORY CONTEXT') || input.includes('Just for context:')) {
            console.error('[AutoInject DEBUG] Context exists');
            return false;
        }

        return true;
    }

    function getCurrentInput() {
        return config && config.getInputValue ? config.getInputValue() : '';
    }

    // SIMPLIFIED: Check if we're in any contenteditable or textarea
    function handleEnterKey(event) {
        // Cache input on every keystroke (so we have it when Enter clears)
        if (config && config.getInputValue && event.key !== 'Enter') {
            const currentVal = config.getInputValue();
            if (currentVal && currentVal.trim().length > 0) {
                cachedInputValue = currentVal;
            }
            return; // Only process Enter key below
        }

        if (event.key !== 'Enter' || event.shiftKey) return;
        if (!config) return;

        // Skip Enter for Claude - ProseMirror fires before DOM events, cannot intercept
        // Claude users should use the Send button instead (which works)
        if (config.platformName === 'Claude') {
            return; // Let Claude handle Enter natively
        }

        // Check if focus is in an editable area
        const activeEl = document.activeElement;
        if (!activeEl) return;

        const isContentEditable = activeEl.getAttribute && activeEl.getAttribute('contenteditable') === 'true';
        const isTextarea = activeEl.tagName === 'TEXTAREA';
        const isInContentEditable = activeEl.closest && activeEl.closest('[contenteditable="true"]');

        if (!isContentEditable && !isTextarea && !isInContentEditable) {
            return; // Not in editable area, let event propagate normally
        }

        // IMMEDIATELY prevent processing while we check
        event.preventDefault();
        event.stopPropagation();

        // Now do our checks - if we fail, send the message anyway
        const input = cachedInputValue;

        // Early exit conditions - but still send the original message
        if (!input || input.trim().length < 3) {
            triggerSend();
            return;
        }
        if (!autoInjectEnabledCache) {
            triggerSend();
            return;
        }
        if (isProcessing) {
            triggerSend();
            return;
        }
        if (input.includes('[MEMORY CONTEXT') || input.includes('Just for context:')) {
            triggerSend();
            return;
        }

        console.log('[AutoInject] *** INTERCEPTING Enter ***');
        isProcessing = true;
        cachedInputValue = ''; // Clear cache after use
        processMessage(input, null); // Don't pass event since we already prevented
    }

    function handleSendClick(event) {
        console.log('[AutoInject] Send button click');
        if (!shouldProcess()) return;

        const input = getCurrentInput();
        console.log('[AutoInject] *** INTERCEPTING Send ***');

        isProcessing = true;
        processMessage(input, event);
    }

    function attachListeners() {
        if (!config) return;

        // Attach document keydown listener ONCE
        if (!documentListenerAttached) {
            document.addEventListener('keydown', handleEnterKey, true);
            documentListenerAttached = true;
            console.log('[AutoInject] Document keydown listener attached');
        }

        // Attach to send button if it changed
        const currentSendBtn = config.getSendButton ? config.getSendButton() : null;
        if (currentSendBtn && currentSendBtn !== attachedSendButton) {
            if (attachedSendButton) {
                attachedSendButton.removeEventListener('click', handleSendClick, true);
            }
            currentSendBtn.addEventListener('click', handleSendClick, true);
            attachedSendButton = currentSendBtn;
            console.log('[AutoInject] Send button listener attached');
        }
    }

    function setup(platformConfig) {
        config = platformConfig;
        console.log('[AutoInject] Setting up for', config.platformName);

        loadEnabledState();
        attachListeners();

        // Keep watching for DOM changes
        const observer = new MutationObserver(attachListeners);
        observer.observe(document.body, { childList: true, subtree: true });

        // Poll as backup
        setInterval(attachListeners, 2000);

        console.log('[AutoInject] Setup complete for', config.platformName);
    }

    window.VektoriAutoInject = { setup };
    console.log('[VektoriAutoInject] Module loaded');

})();
