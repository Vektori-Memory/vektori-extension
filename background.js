// ============================================================================
// Background Service Worker - Vektori Memory Extension
// Handles API communication with automatic token refresh
// ============================================================================

// Import the shared API client using importScripts (MV3 compatible)
// IMPORTANT: Load config.js BEFORE api_client.js so CONFIG is available
importScripts('shared/config.js', 'shared/api_client.js', 'shared/analytics.js');

// Initialize analytics
self.analytics.init({ debug: false });

// Now we can use: getValidToken, makeAuthenticatedRequest, clearAuth, API_BASE_URL
// from self.apiClient (exported by api_client.js)
// Note: Service workers use 'self' instead of 'window'

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "save_chat") {
        saveChatToAPI(message.chatData)
            .then(result => {
                self.analytics.capture('conversation_saved', {
                    platform: message.chatData?.platform || message.chatData?.conversation?.platform || 'unknown',
                    message_count: message.chatData?.messages?.length || 0,
                    trigger: 'manual'
                });
                sendResponse({ success: true, data: result });
            })
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    else if (message.action === "import_chatgpt_memory") {
        console.log('Background: Starting ChatGPT memory import...');

        chrome.tabs.create({
            url: 'https://chatgpt.com/#settings/Personalization',
            active: false
        }).then(tab => {
            console.log('Background: Opened tab:', tab.id);

            const waitAndClick = async () => {
                await new Promise(resolve => setTimeout(resolve, 4000));

                // Ping only 5 times max
                for (let i = 0; i < 5; i++) {
                    try {
                        await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                        console.log('Background: Content script ready');

                        await new Promise(resolve => setTimeout(resolve, 1000));

                        const response = await chrome.tabs.sendMessage(tab.id, {
                            action: 'clickManageButton'
                        });

                        console.log('Background: Response:', response);
                        sendResponse({ success: true, response });
                        return;
                    } catch (error) {
                        if (i < 4) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }

                console.log('Background: Content script not ready');
                sendResponse({ success: false, error: 'Content script not ready' });
            };

            waitAndClick();
        }).catch(error => {
            console.error('Background: Error:', error);
            sendResponse({ success: false, error: error.message });
        });

        return true;
    }
    else if (message.action === "get_chat_info") {
        getChatInfo(message.convo_id, message.platform)
            .then(result => sendResponse({ success: true, ...result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    else if (message.action === "auto_save_chat") {
        autoSaveChatToAPI(message.chatData)
            .then(result => {
                self.analytics.capture('conversation_saved', {
                    platform: message.chatData?.platform || message.chatData?.conversation?.platform || 'unknown',
                    message_count: message.chatData?.messages?.length || 0,
                    trigger: 'auto'
                });
                sendResponse({ success: true, data: result });
            })
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    else if (message.action === "openSidePanel") {
        console.log("Background script received 'openSidePanel' message.");
        self.analytics.capture('sidepanel_opened', {
            source: sender.tab?.url ? new URL(sender.tab.url).hostname : 'unknown'
        });

        // Get the ID of the tab that sent the message
        const tabId = sender.tab.id;
        // Configure tab-specific side panel
        chrome.sidePanel.setOptions({
            tabId: tabId,
            path: 'sidepanel/panel.html',
            enabled: true
        });
        // Open the side panel specifically for this tab
        chrome.sidePanel.open({ tabId: tabId })
            .then(() => {
                sendResponse({ success: true });
            })
            .catch((error) => {
                sendResponse({ success: false, error: error.message });
            });

        return true;
    }

    else if (message.action === 'startGoogleSignIn') {
        startGoogleSignIn(sendResponse);
        return true;
    }

    else if (message.action === 'track_event') {
        // Allow content scripts to send analytics events
        self.analytics.capture(message.eventName, message.properties || {});
        sendResponse({ success: true });
        return true;
    }

    else if (message.action === 'build_context') {
        // Use getValidToken for automatic refresh handling
        (async () => {
            try {
                // Get user_id from authenticated user in storage
                const user = await chrome.storage.local.get(['user']);
                const userId = user.user?.id || user.user?.user_id;
                if (!userId) {
                    throw new Error('User ID not found in storage. Please sign in.');
                }

                const token = await self.apiClient.getValidToken();

                // Use unified retrieval endpoint
                const endpoint = `${self.apiClient.API_BASE_URL}/api/retrieve`;
                const body = {
                    user_id: userId,
                    query: message.query
                };
                console.log(`[Background] Calling unified retrieval endpoint`);

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                sendResponse({ success: true, data: data });
            } catch (error) {
                console.error('[Background] Build context error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Keep message channel open for async response
    }

    else if (message.action === 'carry_context_to_destination') {
        // New flow: Generate context and open destination AI chat
        // 1. Save + fetch context (same as carry_context)
        // 2. Store context in chrome.storage.local
        // 3. Open new tab to destination URL
        (async () => {
            const startTime = Date.now();
            const logContext = { action: 'carry_context_to_destination' };

            // Destination URLs for each AI platform
            const DESTINATION_URLS = {
                chatgpt: 'https://chatgpt.com/',
                claude: 'https://claude.ai/new',
                perplexity: 'https://www.perplexity.ai/',
                grok: 'https://grok.com/',
                gemini: 'https://gemini.google.com/app',
                deepseek: 'https://chat.deepseek.com/'
            };

            try {
                const destination = message.destination;
                const chatData = message.chatData;
                const sourcePlatform = message.platform || 'unknown';

                if (!destination || !DESTINATION_URLS[destination]) {
                    throw new Error(`Invalid destination: ${destination}`);
                }

                if (!chatData) {
                    throw new Error('Chat data is required');
                }

                const convoId = chatData.conversation?.convo_id;
                logContext.destination = destination;
                logContext.sourcePlatform = sourcePlatform;
                logContext.convoId = convoId?.substring(0, 8) || 'missing';

                // Get user info
                const user = await chrome.storage.local.get(['user']);
                const userId = user.user?.id || user.user?.user_id;

                if (!userId) {
                    throw new Error('User ID not found. Please sign in.');
                }

                logContext.userId = userId.substring(0, 8);

                let token;
                try {
                    token = await self.apiClient.getValidToken();
                } catch (tokenError) {
                    throw new Error('Authentication failed. Please sign in again.');
                }

                console.log(`[Background] [CarryToDestination] Step 1 - Saving chat`, logContext);

                // STEP 1: Save the chat
                const saveEndpoint = `${self.apiClient.API_BASE_URL}/api/save-and-process`;
                const saveBody = {
                    user_id: userId,
                    convo_id: convoId,
                    title: chatData.conversation?.title || 'Untitled',
                    platform: sourcePlatform,
                    messages: chatData.messages || []
                };

                const saveResponse = await fetch(saveEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(saveBody)
                });

                if (!saveResponse.ok) {
                    const errorData = await saveResponse.json().catch(() => ({}));
                    throw new Error(`Save failed: ${errorData.error || saveResponse.statusText}`);
                }

                const saveData = await saveResponse.json();
                const savedConvoId = saveData.convo_id || convoId;

                // STEP 2: Poll /processing-status until RAG pipeline completes
                console.log(`[Background] [CarryToDestination] Step 2 - Polling for processing completion...`, logContext);

                const MAX_PROCESSING_POLLS = 20;
                const PROCESSING_POLL_DELAY_MS = 2000;
                let processingComplete = false;

                for (let poll = 1; poll <= MAX_PROCESSING_POLLS; poll++) {
                    try {
                        const statusEndpoint = `${self.apiClient.API_BASE_URL}/api/processing-status?user_id=${encodeURIComponent(userId)}&convo_id=${encodeURIComponent(savedConvoId)}&platform=${encodeURIComponent(sourcePlatform)}`;

                        const statusResponse = await fetch(statusEndpoint, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            }
                        });

                        if (statusResponse.ok) {
                            const statusData = await statusResponse.json();
                            console.log(`[Background] [CarryToDestination] Processing poll ${poll}/${MAX_PROCESSING_POLLS}:`, {
                                ...logContext,
                                processed: statusData.processed,
                                facts: statusData.facts_count,
                                sentences: statusData.sentences_count
                            });

                            if (statusData.processed) {
                                processingComplete = true;
                                break;
                            }
                        }
                    } catch (pollError) {
                        console.warn(`[Background] [CarryToDestination] Status poll ${poll} error: ${pollError.message}`, logContext);
                    }

                    if (poll < MAX_PROCESSING_POLLS) {
                        await new Promise(resolve => setTimeout(resolve, PROCESSING_POLL_DELAY_MS));
                    }
                }

                if (!processingComplete) {
                    console.warn(`[Background] [CarryToDestination] Processing timeout. Proceeding anyway...`, logContext);
                }

                // STEP 3: Fetch the carry context
                console.log(`[Background] [CarryToDestination] Step 3 - Fetching carry context...`, logContext);

                let data = null;
                try {
                    const contextResponse = await fetch(`${self.apiClient.API_BASE_URL}/api/carry-context`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            user_id: userId,
                            convo_id: savedConvoId,
                            platform: sourcePlatform
                        })
                    });

                    if (contextResponse.ok) {
                        data = await contextResponse.json();
                        console.log(`[Background] [CarryToDestination] Context retrieved`, {
                            ...logContext,
                            facts: data.facts?.length || 0,
                            insights: data.insights?.length || 0,
                            sentences: data.representativeSentences?.length || 0
                        });
                    }
                } catch (fetchError) {
                    console.warn(`[Background] [CarryToDestination] Context fetch error: ${fetchError.message}`, logContext);
                }

                const formattedContext = data?.formattedContext || '';

                console.log(`[Background] [CarryToDestination] Step 3 - Storing context and opening tab`, logContext);

                // STEP 3: Store context in chrome.storage.local for destination page to pick up
                await chrome.storage.local.set({
                    vektori_pending_context: {
                        context: formattedContext,
                        destination: destination,
                        sourceConvoId: convoId,
                        sourcePlatform: sourcePlatform,
                        timestamp: Date.now(),
                        metadata: {
                            facts: data?.facts?.length || 0,
                            insights: data?.insights?.length || 0,
                            sentences: data?.representativeSentences?.length || 0,
                            estimatedTokens: data?.metadata?.estimatedTokens || 0
                        }
                    }
                });

                // STEP 4: Open new tab to destination
                const destinationUrl = DESTINATION_URLS[destination];
                const newTab = await chrome.tabs.create({
                    url: destinationUrl,
                    active: true
                });

                const totalTimeMs = Date.now() - startTime;
                console.log(`[Background] [CarryToDestination] Success`, {
                    ...logContext,
                    destination,
                    tabId: newTab.id,
                    contextLength: formattedContext.length,
                    hasData: !!data,
                    totalTimeMs
                });

                sendResponse({
                    success: true,
                    destination: destination,
                    tabId: newTab.id,
                    contextStored: true,
                    hasData: !!data && formattedContext.length > 100
                });

            } catch (error) {
                const totalTimeMs = Date.now() - startTime;
                console.error('[Background] [CarryToDestination] Error', {
                    ...logContext,
                    error: error.message,
                    totalTimeMs
                });
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    else if (message.action === 'carry_context') {
        // Generate memory snapshot for current conversation:
        // 1. Save the current chat first (run through pipeline)
        // 2. Then fetch carry-context for that specific conversation
        (async () => {
            const startTime = Date.now();
            const logContext = { action: 'carry_context' };

            try {
                // Require chatData from content script
                if (!message.chatData) {
                    console.error('[Background] [CarryContext] Missing required chatData', logContext);
                    throw new Error('Chat data is required for carry context');
                }

                const chatData = message.chatData;
                const convoId = chatData.conversation?.convo_id;
                const platform = chatData.platform || message.platform || 'unknown';

                logContext.platform = platform;
                logContext.convoId = convoId?.substring(0, 8) || 'missing';
                logContext.messageCount = chatData.messages?.length || 0;

                if (!convoId) {
                    console.error('[Background] [CarryContext] Conversation ID not found in chat data', logContext);
                    throw new Error('Conversation ID not found in chat data');
                }

                // Get user_id from authenticated user in storage
                const user = await chrome.storage.local.get(['user']);
                const userId = user.user?.id || user.user?.user_id;

                if (!userId) {
                    console.error('[Background] [CarryContext] User not authenticated', logContext);
                    throw new Error('User ID not found in storage. Please sign in.');
                }

                logContext.userId = userId.substring(0, 8);

                let token;
                try {
                    token = await self.apiClient.getValidToken();
                } catch (tokenError) {
                    console.error('[Background] [CarryContext] Failed to get auth token', {
                        ...logContext,
                        error: tokenError.message
                    });
                    throw new Error('Authentication failed. Please sign in again.');
                }

                console.log(`[Background] [CarryContext] Step 1 - Saving chat`, logContext);

                // STEP 1: Save the chat using save-and-process endpoint
                const saveEndpoint = `${self.apiClient.API_BASE_URL}/api/save-and-process`;
                const saveBody = {
                    user_id: userId,
                    convo_id: convoId,
                    title: chatData.conversation?.title || 'Untitled',
                    platform: platform,
                    messages: chatData.messages || []
                };

                let saveResponse;
                try {
                    saveResponse = await fetch(saveEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(saveBody)
                    });
                } catch (fetchError) {
                    console.error('[Background] [CarryContext] Network error during save', {
                        ...logContext,
                        error: fetchError.message
                    });
                    throw new Error(`Network error: ${fetchError.message}`);
                }

                if (!saveResponse.ok) {
                    const errorData = await saveResponse.json().catch(() => ({}));
                    console.error('[Background] [CarryContext] Save API error', {
                        ...logContext,
                        status: saveResponse.status,
                        statusText: saveResponse.statusText,
                        error: errorData.error || 'Unknown error',
                        code: errorData.code
                    });

                    // Handle specific error codes
                    if (saveResponse.status === 402) {
                        throw new Error('Insufficient credits. Please upgrade your plan.');
                    } else if (saveResponse.status === 429) {
                        throw new Error('Rate limit exceeded. Please try again later.');
                    } else if (saveResponse.status === 403) {
                        throw new Error('Access denied. Please sign in again.');
                    }

                    throw new Error(`Save failed: ${errorData.error || saveResponse.statusText}`);
                }

                const saveData = await saveResponse.json();
                const savedConvoId = saveData.convo_id || convoId; // Use stable ID from backend
                const saveTimeMs = Date.now() - startTime;
                console.log(`[Background] [CarryContext] Chat saved successfully`, {
                    ...logContext,
                    saveTimeMs,
                    savedConvoId: savedConvoId?.substring(0, 8)
                });

                // STEP 2: Poll /processing-status until RAG pipeline completes
                console.log(`[Background] [CarryContext] Step 2 - Polling for processing completion...`, logContext);

                const MAX_PROCESSING_POLLS = 20; // Max 40 seconds (20 * 2s)
                const PROCESSING_POLL_DELAY_MS = 2000;
                let processingComplete = false;

                for (let poll = 1; poll <= MAX_PROCESSING_POLLS; poll++) {
                    try {
                        const statusEndpoint = `${self.apiClient.API_BASE_URL}/api/processing-status?user_id=${encodeURIComponent(userId)}&convo_id=${encodeURIComponent(savedConvoId)}&platform=${encodeURIComponent(platform)}`;

                        const statusResponse = await fetch(statusEndpoint, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            }
                        });

                        if (statusResponse.ok) {
                            const statusData = await statusResponse.json();
                            console.log(`[Background] [CarryContext] Processing poll ${poll}/${MAX_PROCESSING_POLLS}:`, {
                                ...logContext,
                                processed: statusData.processed,
                                facts: statusData.facts_count,
                                sentences: statusData.sentences_count
                            });

                            if (statusData.processed) {
                                processingComplete = true;
                                console.log(`[Background] [CarryContext] Processing complete after ${poll * PROCESSING_POLL_DELAY_MS / 1000}s`, logContext);
                                break;
                            }
                        } else {
                            console.warn(`[Background] [CarryContext] Status poll ${poll} failed: HTTP ${statusResponse.status}`, logContext);
                        }
                    } catch (pollError) {
                        console.warn(`[Background] [CarryContext] Status poll ${poll} error: ${pollError.message}`, logContext);
                    }

                    // Wait before next poll (unless last attempt)
                    if (poll < MAX_PROCESSING_POLLS) {
                        await new Promise(resolve => setTimeout(resolve, PROCESSING_POLL_DELAY_MS));
                    }
                }

                if (!processingComplete) {
                    console.warn(`[Background] [CarryContext] Processing timeout after ${MAX_PROCESSING_POLLS * PROCESSING_POLL_DELAY_MS / 1000}s. Proceeding anyway...`, logContext);
                }

                // STEP 3: Fetch the carry context (should work first time now)
                console.log(`[Background] [CarryContext] Step 3 - Fetching carry context...`, logContext);

                const contextEndpoint = `${self.apiClient.API_BASE_URL}/api/carry-context`;
                let data = null;
                let lastError = null;

                try {
                    const contextResponse = await fetch(contextEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            user_id: userId,
                            convo_id: savedConvoId,
                            platform: platform
                        })
                    });

                    if (contextResponse.ok) {
                        data = await contextResponse.json();
                        console.log(`[Background] [CarryContext] Context retrieved successfully`, {
                            ...logContext,
                            facts: data.facts?.length || 0,
                            insights: data.insights?.length || 0,
                            summaries: data.summaries?.length || 0,
                            sentences: data.representativeSentences?.length || 0
                        });
                    } else {
                        const errorData = await contextResponse.json().catch(() => ({}));
                        lastError = errorData.error || `HTTP ${contextResponse.status}`;
                        console.warn(`[Background] [CarryContext] Context fetch failed: ${lastError}`, logContext);
                    }
                } catch (fetchError) {
                    lastError = fetchError.message;
                    console.error(`[Background] [CarryContext] Context fetch error: ${fetchError.message}`, logContext);
                }

                const totalTimeMs = Date.now() - startTime;

                // Return whatever we have
                if (data) {
                    console.log(`[Background] [CarryContext] Success`, {
                        ...logContext,
                        facts: data.facts?.length || 0,
                        insights: data.insights?.length || 0,
                        summaries: data.summaries?.length || 0,
                        sentences: data.representativeSentences?.length || 0,
                        estimatedTokens: data.metadata?.estimatedTokens || 0,
                        totalTimeMs
                    });
                    sendResponse({ success: true, data: data });
                } else {
                    console.error('[Background] [CarryContext] Failed to get context', { ...logContext, lastError, totalTimeMs });
                    sendResponse({ success: false, error: lastError || 'Failed to fetch context' });
                }
            } catch (error) {
                const totalTimeMs = Date.now() - startTime;
                console.error('[Background] [CarryContext] Error', {
                    ...logContext,
                    error: error.message,
                    totalTimeMs
                });
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Keep message channel open for async response
    }
});

function startGoogleSignIn(sendResponse) {
    try {
        const manifest = chrome.runtime.getManifest();
        const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;

        const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
        authUrl.searchParams.set('client_id', manifest.oauth2.client_id);
        authUrl.searchParams.set('response_type', 'id_token');
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', manifest.oauth2.scopes.join(' '));

        chrome.identity.launchWebAuthFlow(
            {
                url: authUrl.href,
                interactive: true
            },
            async (redirectedTo) => {
                if (chrome.runtime.lastError) {
                    console.error('[Background] Auth error:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    return;
                }

                try {
                    const urlObj = new URL(redirectedTo);
                    const params = new URLSearchParams(urlObj.hash.substring(1));
                    const idToken = params.get('id_token');

                    if (!idToken) {
                        throw new Error('No ID token received from Google');
                    }

                    const response = await fetch(`${self.apiClient.API_BASE_URL}/auth/google-signin`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ credential: idToken })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Backend auth failed (${response.status}): ${errorText}`);
                    }

                    const authData = await response.json();

                    if (!authData.access_token || !authData.refresh_token || !authData.user) {
                        throw new Error('Authentication failed: Invalid response from server');
                    }

                    await self.apiClient.storeAuth({
                        user: authData.user,
                        access_token: authData.access_token,
                        refresh_token: authData.refresh_token,
                        expires_at: authData.expires_at
                    });

                    // Track successful sign-in
                    self.analytics.identify(authData.user.id, {
                        email: authData.user.email,
                        name: authData.user.name
                    });
                    self.analytics.capture('user_signed_in', {
                        method: 'google'
                    });

                    // Open welcome page after successful sign-in
                    chrome.tabs.create({
                        url: chrome.runtime.getURL('welcome.html'),
                        active: true
                    });

                    sendResponse({ success: true, user: authData.user });
                } catch (error) {
                    console.error('[Background] Error completing sign-in:', error);
                    sendResponse({ success: false, error: error.message });
                }
            }
        );
    } catch (error) {
        console.error('[Background] Failed to start sign-in flow:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function saveChatToAPI(chatData) {
    // Use makeAuthenticatedRequest - handles token refresh automatically
    // NOTE: Using /api/save-and-process (saves + processes through RAG pipeline)
    // This makes memories searchable immediately

    // Get user_id from authenticated user in storage
    const user = await chrome.storage.local.get(['user']);
    const userId = user.user?.id || user.user?.user_id;

    if (!userId) {
        throw new Error('User ID not found in storage. Please sign in.');
    }

    // Transform nested format to flat format expected by backend
    // Parser returns: { conversation: {...}, messages: [...] }
    // Backend expects: { user_id, convo_id, platform, title, messages: [...] }
    const flatData = {
        user_id: userId,
        convo_id: chatData.conversation?.convo_id || chatData.convo_id,
        platform: chatData.conversation?.platform || chatData.platform || 'chatgpt',
        title: chatData.conversation?.title || chatData.title || 'Untitled Chat',
        timestamp: chatData.conversation?.timestamp || chatData.timestamp,
        messages: chatData.messages || []
    };

    return self.apiClient.makeAuthenticatedRequest(`${self.apiClient.API_BASE_URL}/api/save-and-process`, {
        method: 'POST',
        body: JSON.stringify(flatData)
    });
}

async function getChatInfo(convoId, platform = 'gemini') {
    // Use makeAuthenticatedRequest - handles token refresh automatically
    // NOTE: chat-info is a GET endpoint with query params
    const user = await chrome.storage.local.get(['user']);
    const userId = user.user?.id || user.user?.user_id;

    if (!userId) {
        throw new Error('User ID not found in storage');
    }

    return self.apiClient.makeAuthenticatedRequest(
        `${self.apiClient.API_BASE_URL}/api/chat-info?user_id=${encodeURIComponent(userId)}&convo_id=${encodeURIComponent(convoId)}&platform=${encodeURIComponent(platform)}`,
        {
            method: 'GET'
        }
    );
}

async function autoSaveChatToAPI(chatData) {
    // Use makeAuthenticatedRequest - handles token refresh automatically

    // Get user_id from authenticated user in storage
    const user = await chrome.storage.local.get(['user']);
    const userId = user.user?.id || user.user?.user_id;

    if (!userId) {
        throw new Error('User ID not found in storage. Please sign in.');
    }

    // Transform nested format to flat format if needed
    const flatData = {
        user_id: userId,
        convo_id: chatData.conversation?.convo_id || chatData.convo_id,
        platform: chatData.conversation?.platform || chatData.platform || 'chatgpt',
        title: chatData.conversation?.title || chatData.title,
        timestamp: chatData.conversation?.timestamp || chatData.timestamp,
        messages: chatData.messages || [],
        trigger: chatData.trigger || 'auto',  // Forward trigger from content script
        source: chatData.source || 'batch_save'  // Forward source for debugging
    };

    return self.apiClient.makeAuthenticatedRequest(`${self.apiClient.API_BASE_URL}/api/auto-save-chat`, {
        method: 'POST',
        body: JSON.stringify(flatData)
    });
}

chrome.tabs.onActivated.addListener(() => {
    chrome.sidePanel.setOptions({ enabled: false });
});

// ============================================================================
// Extension Lifecycle Events (Install/Update tracking)
// ============================================================================
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        self.analytics.capture('extension_installed', {
            version: chrome.runtime.getManifest().version
        });
    } else if (details.reason === 'update') {
        self.analytics.capture('extension_updated', {
            previous_version: details.previousVersion,
            new_version: chrome.runtime.getManifest().version
        });
    }
});