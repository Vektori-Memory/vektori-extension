// ============================================================================
// Vektori Memory - Central Authentication & API Client
// Used by: background.js, popup.js, content scripts
// ============================================================================

// Production log silencer - silence logs when DEBUG is false
const _log = (typeof CONFIG !== 'undefined' && !CONFIG.DEBUG) ? () => {} : console.log.bind(console);
const _warn = (typeof CONFIG !== 'undefined' && !CONFIG.DEBUG) ? () => {} : console.warn.bind(console);
// Keep console.error always visible

// Import config if available, otherwise use localhost
// To use production: Set PRODUCTION_API_URL in shared/config.js after Railway deployment
let API_BASE_URL = 'http://localhost:8000';

// Try to use config if available (must load config.js before api_client.js in manifest.json)
if (typeof CONFIG !== 'undefined' && CONFIG.API_URL) {
    API_BASE_URL = CONFIG.API_URL;
    _log(`[API Client] Using ${CONFIG.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} API: ${API_BASE_URL}`);
} else {
    _log('[API Client] Using default localhost API');
}

// ============================================================================
// CONCURRENCY CONTROL: Prevents race conditions on token refresh
// ============================================================================
let isRefreshing = false;
let refreshPromise = null;

// ============================================================================
// CONFIGURATION
// ============================================================================
const EXPIRY_BUFFER_SECONDS = 5 * 60;  // Refresh 5 minutes before expiry
const MAX_RETRY_ATTEMPTS = 2;          // Retry failed refreshes twice
const RETRY_BASE_DELAY_MS = 1000;      // Exponential backoff starting at 1s

// ============================================================================
// CORE: Get Valid Token (with automatic refresh and race condition prevention)
// ============================================================================
async function getValidToken() {
    const result = await chrome.storage.local.get([
        'access_token', 
        'refresh_token', 
        'expires_at'
    ]);
    
    const { access_token, refresh_token, expires_at } = result;
    
    // No tokens found
    if (!access_token || !refresh_token) {
        throw new Error('NO_AUTH_FOUND');
    }
    
    // Check if token is expired or expiring soon
    const now = Math.floor(Date.now() / 1000);
    const isExpiringSoon = expires_at <= (now + EXPIRY_BUFFER_SECONDS);
    
    if (!isExpiringSoon) {
        // Token still valid - fast path
        return access_token;
    }
    
    // ═══════════════════════════════════════════════════════════
    // CRITICAL: Token needs refresh - check if already refreshing
    // ═══════════════════════════════════════════════════════════
    if (isRefreshing && refreshPromise) {
        // Another call is already refreshing - wait for it
        _log('[Auth] Refresh already in progress, waiting...');
        await refreshPromise;
        
        // Get the refreshed token from storage
        const updated = await chrome.storage.local.get(['access_token']);
        if (!updated.access_token) {
            throw new Error('Refresh completed but no token found');
        }
        return updated.access_token;
    }
    
    // Start new refresh with lock
    isRefreshing = true;
    refreshPromise = performTokenRefresh(refresh_token)
        .finally(() => {
            // Release lock
            isRefreshing = false;
            refreshPromise = null;
        });
    
    await refreshPromise;
    
    // Get the new token
    const updated = await chrome.storage.local.get(['access_token']);
    if (!updated.access_token) {
        throw new Error('Refresh completed but no token found');
    }
    return updated.access_token;
}

// ============================================================================
// INTERNAL: Perform Token Refresh (with retry logic for transient failures)
// ============================================================================
async function performTokenRefresh(refreshToken) {
    let lastError = null;
    
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
        try {
            _log(`[Auth] Token refresh attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}`);
            
            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            
            // ═══════════════════════════════════════════════════════════
            // CRITICAL: 401 = Invalid refresh token (DON'T retry)
            // ═══════════════════════════════════════════════════════════
            if (response.status === 401) {
                console.error('[Auth] Refresh token invalid or expired');
                await clearAuth();
                throw new Error('INVALID_REFRESH_TOKEN');
            }
            
            // Other HTTP errors (5xx, network issues) - retry these
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP_${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            
            // Validate response structure
            if (!data.access_token || !data.refresh_token || !data.expires_at) {
                throw new Error('Invalid refresh response format');
            }
            
            // ═══════════════════════════════════════════════════════════
            // SUCCESS: Update storage atomically (all tokens together)
            // ═══════════════════════════════════════════════════════════
            await chrome.storage.local.set({
                'access_token': data.access_token,
                'refresh_token': data.refresh_token,  // Single-use: old one is now invalid
                'expires_at': data.expires_at,
                ...(data.user && { 'user': data.user })  // Update user if backend sent it
            });
            
            _log('[Auth] Token refresh successful');
            return;
            
        } catch (error) {
            lastError = error;
            
            // Don't retry on auth errors (invalid refresh token)
            if (error.message === 'INVALID_REFRESH_TOKEN') {
                throw error;
            }
            
            // Retry with exponential backoff for network/server errors
            if (attempt < MAX_RETRY_ATTEMPTS - 1) {
                const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
                _warn(`[Auth] Refresh failed, retrying in ${delay}ms...`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // All retries exhausted
    console.error('[Auth] All refresh attempts failed');
    await clearAuth();
    throw lastError || new Error('REFRESH_FAILED');
}

// ============================================================================
// HELPER: Check Auth Status (doesn't trigger refresh - just checks state)
// ============================================================================
async function checkAuthStatus() {
    const result = await chrome.storage.local.get([
        'user',
        'access_token',
        'refresh_token',
        'expires_at'
    ]);
    
    const { user, access_token, refresh_token, expires_at } = result;
    
    // No tokens stored
    if (!access_token || !refresh_token) {
        return {
            isAuthenticated: false,
            canRefresh: false,
            user: null
        };
    }
    
    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    const isExpired = expires_at <= now;
    
    return {
        isAuthenticated: !isExpired,
        canRefresh: !!refresh_token,
        user: user || null,
        expiresAt: expires_at,
        isExpired: isExpired
    };
}

// ============================================================================
// HELPER: Clear Auth (centralized logout)
// ============================================================================
async function clearAuth() {
    _log('[Auth] Clearing authentication data');
    await chrome.storage.local.remove([
        'user',
        'access_token',
        'refresh_token',
        'expires_at'
    ]);
}

// ============================================================================
// HELPER: Store Auth (centralized login/refresh storage)
// ============================================================================
async function storeAuth(authData) {
    if (!authData.access_token || !authData.refresh_token || !authData.expires_at) {
        throw new Error('Invalid auth data: missing required fields');
    }
    
    // Validate expires_at is a number (Unix timestamp in seconds)
    if (typeof authData.expires_at !== 'number') {
        throw new Error(`Invalid expires_at type: expected number, got ${typeof authData.expires_at}`);
    }
    
    await chrome.storage.local.set({
        'user': authData.user || null,
        'access_token': authData.access_token,
        'refresh_token': authData.refresh_token,
        'expires_at': authData.expires_at
    });
    
    _log('[Auth] Stored new auth data');
}

// ============================================================================
// API WRAPPER: Make Authenticated Request (handles token refresh automatically)
// ============================================================================
async function makeAuthenticatedRequest(url, options = {}) {
    try {
        // Get valid token (automatically refreshes if needed)
        const token = await getValidToken();
        
        // Prepare headers
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };
        
        // Make request
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        // ═══════════════════════════════════════════════════════════
        // CRITICAL: 401 after refresh means JWT is actually invalid
        // ═══════════════════════════════════════════════════════════
        if (response.status === 401) {
            console.error('[Auth] Got 401 even after token refresh - clearing auth');
            await clearAuth();
            throw new Error('AUTHENTICATION_FAILED');
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }
        
        return await response.json();
        
    } catch (error) {
        // Add context to errors
        if (error.message === 'NO_AUTH_FOUND') {
            throw new Error('Not authenticated. Please sign in.');
        }
        if (error.message === 'INVALID_REFRESH_TOKEN') {
            throw new Error('Session expired. Please sign in again.');
        }
        throw error;
    }
}

// ============================================================================
// API HELPERS: Specific API calls (convenience wrappers)
// ============================================================================
async function searchChats(searchTerm, limit = 20, offset = 0) {
    // Get user_id from storage
    const result = await chrome.storage.local.get(['user']);
    const userId = result.user?.id || result.user?.user_id;

    if (!userId) {
        throw new Error('User ID not found in storage');
    }

    const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/search-conversations`, {
        method: 'POST',
        body: JSON.stringify({
            user_id: userId,
            search_term: searchTerm,
            limit: limit,
            offset: offset
        })
    });

    // BACKWARDS COMPATIBILITY: Handle both old (array) and new (wrapped) formats
    if (Array.isArray(response)) {
        console.warn('[API Client] Received legacy array format from /api/search-conversations');
        return {
            success: true,
            results: response,
            has_more: response.length === limit
        };
    }

    // New format - already wrapped
    return response;
}

async function getConversationById(convoId) {
    return makeAuthenticatedRequest(`${API_BASE_URL}/api/conversations/${convoId}`, {
        method: 'GET'
    });
}

async function getConversationMessages(convoId, userId, platform = 'unknown') {
    return makeAuthenticatedRequest(
        `${API_BASE_URL}/api/conversation/${convoId}/messages?user_id=${userId}&platform=${platform}`,
        { method: 'GET' }
    );
}

async function buildContext(query, topK = 10, scoreThreshold = 0.35) {
    return makeAuthenticatedRequest(`${API_BASE_URL}/api/build-context`, {
        method: 'POST',
        body: JSON.stringify({
            query: query,
            top_k: topK,
            score_threshold: scoreThreshold
        })
    });
}

// ============================================================================
// EXPORTS: Make functions available globally and for imports
// ============================================================================

// Determine the global object (window in content scripts, self in service workers)
const globalObject = typeof window !== 'undefined' ? window : self;

// For content scripts (use window.apiClient) and service workers (use self.apiClient)
globalObject.apiClient = {
    getValidToken,
    makeAuthenticatedRequest,
    checkAuthStatus,
    clearAuth,
    storeAuth,
    searchChats,
    getConversationById,
    getConversationMessages,
    buildContext,
    API_BASE_URL
};

// For ES6 modules (if ever supported in future)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getValidToken,
        makeAuthenticatedRequest,
        checkAuthStatus,
        clearAuth,
        storeAuth,
        searchChats,
        getConversationById,
        getConversationMessages,
        buildContext,
        API_BASE_URL
    };
}
