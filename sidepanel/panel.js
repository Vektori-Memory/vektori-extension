// ============================================================================
// Vektori Memory - Side Panel JavaScript
// Keyword Search + Recall Context (Semantic Search)
// ============================================================================

// Initialize analytics
if (window.analytics) {
    window.analytics.init({ debug: false });
}

// Element references
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('resultsContainer');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const recallInput = document.getElementById('recallInput');
const recallBtn = document.getElementById('recallBtn');
const recallResultsContainer = document.getElementById('recallResultsContainer');
const keywordSearchSection = document.getElementById('keywordSearchSection');
const recallContextSection = document.getElementById('recallContextSection');
const modeBtns = document.querySelectorAll('.mode-btn');

// State
let currentSearchTerm = '';
let currentOffset = 0;
let hasMore = false;
let isLoading = false;
let isRecallLoading = false;
let currentRecallResult = null;

const RESULTS_PER_PAGE = 20;

// SVG Icons
const ICONS = {
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        <rect x="9" y="2" width="6" height="4" rx="1" ry="1"/>
    </svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>`
};

// ============================================================================
// MODE TOGGLE
// ============================================================================
modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;

        // Update active button
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Show/hide sections
        if (mode === 'keyword') {
            keywordSearchSection.classList.add('active');
            recallContextSection.classList.remove('active');
            searchInput.focus();
        } else if (mode === 'recall') {
            keywordSearchSection.classList.remove('active');
            recallContextSection.classList.add('active');
            recallInput.focus();
        }
    });
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// KEYWORD SEARCH (Existing functionality)
// ============================================================================
async function handleSearch(searchTerm, isLoadMore = false) {
    // Validate search term
    if (searchTerm.length < 3) {
        resultsContainer.innerHTML = '<p class="result-meta">Enter at least 3 characters to search.</p>';
        loadMoreContainer.style.display = 'none';
        return;
    }

    // If new search, reset pagination
    if (!isLoadMore) {
        currentSearchTerm = searchTerm;
        currentOffset = 0;
        resultsContainer.innerHTML = '';
    }

    // Prevent duplicate requests
    if (isLoading) {
        return;
    }

    isLoading = true;

    // Show loading state
    if (isLoadMore) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Loading...';
    } else {
        resultsContainer.innerHTML = '<p class="loading">Searching</p>';
        loadMoreContainer.style.display = 'none';
    }

    try {
        // Call API with pagination
        const response = await window.apiClient.searchChats(
            searchTerm,
            RESULTS_PER_PAGE,
            currentOffset
        );

        if (!response.success) {
            throw new Error('Search failed');
        }

        const conversations = response.results;
        hasMore = response.has_more;

        // If no results at all
        if (!isLoadMore && conversations.length === 0) {
            // Track search with no results
            if (window.analytics) {
                window.analytics.capture('search_performed', {
                    has_results: false,
                    result_count: 0,
                    source: 'sidepanel',
                    search_type: 'keyword'
                });
            }
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">No results</div>
                    <p>No conversations found for "${escapeHtml(searchTerm)}"</p>
                </div>
            `;
            loadMoreContainer.style.display = 'none';
            return;
        }

        // Track successful keyword search
        if (!isLoadMore && window.analytics) {
            window.analytics.capture('search_performed', {
                has_results: true,
                result_count: conversations.length,
                source: 'sidepanel',
                search_type: 'keyword'
            });
        }

        // Render results (append if loading more)
        renderResults(conversations, isLoadMore);

        // Update pagination state
        currentOffset += conversations.length;

        // Show/hide Load More button
        if (hasMore) {
            loadMoreContainer.style.display = 'block';
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = 'Load More';
        } else {
            loadMoreContainer.style.display = 'none';
        }

    } catch (error) {
        console.error('Error searching chats:', error);
        const errorMsg = '<p class="result-meta" style="color: #f28b82;">Error searching. Please try again.</p>';

        if (isLoadMore) {
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = 'Load More';
        } else {
            resultsContainer.innerHTML = errorMsg;
            loadMoreContainer.style.display = 'none';
        }
    } finally {
        isLoading = false;
    }
}

function renderResults(conversations, append = false) {
    // Clear container if not appending
    if (!append) {
        resultsContainer.innerHTML = '';
    }

    if (!conversations || conversations.length === 0) {
        return;
    }

    conversations.forEach(convo => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';

        // Format date
        const date = new Date(convo.timestamp);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Determine if conversation is recent (within 7 days)
        const isRecent = (Date.now() - date.getTime()) < (7 * 24 * 60 * 60 * 1000);

        resultItem.innerHTML = `
        <div class="result-title">${escapeHtml(convo.title || 'Untitled')}</div>
        ${convo.snippet ? `<div class="result-snippet">${escapeHtml(convo.snippet)}</div>` : ''}
        <div class="result-meta">
            <span class="platform">${escapeHtml(convo.platform || 'unknown')}</span>
            <span class="date">${formattedDate}</span>
        </div>
    `;

        resultItem.addEventListener('click', async () => {
            try {
                // Show loading state on the clicked item
                resultItem.classList.add('loading-content');

                // Fetch the full conversation messages
                const result = await chrome.storage.local.get(['user']);
                const userId = result.user?.id || result.user?.user_id;

                if (!userId) {
                    throw new Error('User not found');
                }

                // Fetch full conversation content
                const messages = await window.apiClient.getConversationMessages(
                    convo.convo_id,
                    userId,
                    convo.platform || 'unknown'
                );

                // Build full conversation text from messages
                let fullContent = '';
                if (Array.isArray(messages) && messages.length > 0) {
                    fullContent = messages.map(msg => {
                        const role = msg.role === 'user' ? 'User' : 'Assistant';
                        return `${role}: ${msg.text_content}`;
                    }).join('\n\n');
                } else {
                    // Fallback to snippet if messages fetch fails
                    fullContent = convo.snippet || 'No content available';
                }

                // Remove loading state
                resultItem.classList.remove('loading-content');

                // Send the full content to inject into search box
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                chrome.tabs.sendMessage(tab.id, {
                    action: 'insertMemorySnippet',
                    snippet: fullContent,
                    isSearchMemory: true,
                    fromMemorySearch: true
                });
            } catch (error) {
                console.error('Error injecting memory snippet:', error);
                resultItem.classList.remove('loading-content');

                // Fallback to snippet on error
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'insertMemorySnippet',
                        snippet: convo.snippet || 'No content available',
                        isSearchMemory: true,
                        fromMemorySearch: true
                    });
                } catch (e) {
                    console.error('Fallback also failed:', e);
                }
            }
        });

        resultsContainer.appendChild(resultItem);
    });
}

// ============================================================================
// RECALL CONTEXT (Semantic Search - NEW)
// ============================================================================
async function handleRecallContext(query) {
    if (!query || query.trim().length < 3) {
        recallResultsContainer.innerHTML = '<p class="result-meta">Please enter at least 3 characters.</p>';
        return;
    }

    if (isRecallLoading) {
        return;
    }

    isRecallLoading = true;
    recallBtn.disabled = true;
    recallBtn.textContent = 'Searching...';
    recallResultsContainer.innerHTML = '<p class="recall-loading">Recalling memories</p>';

    try {
        // Get user from storage
        const result = await chrome.storage.local.get(['user']);
        const userId = result.user?.id || result.user?.user_id;

        if (!userId) {
            throw new Error('User not authenticated. Please sign in.');
        }

        // Call the /api/retrieve endpoint (same as popup.js)
        const response = await window.apiClient.makeAuthenticatedRequest(
            `${window.apiClient.API_BASE_URL}/api/retrieve`,
            {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId,
                    query: query.trim()
                })
            }
        );

        // Check if we got meaningful context
        const hasContext = response.context &&
            response.context.length > 0 &&
            response.context !== 'NO_RELEVANT_CONTEXT' &&
            !response.context.includes('No relevant context');

        if (hasContext) {
            currentRecallResult = response.context;
            const resultCount = response.results?.length || 0;

            // Track successful recall
            if (window.analytics) {
                window.analytics.capture('search_performed', {
                    has_results: true,
                    result_count: resultCount,
                    source: 'sidepanel',
                    search_type: 'recall'
                });
            }

            recallResultsContainer.innerHTML = `
                <div class="recall-result-card">
                    <div class="recall-result-header">
                        <span class="recall-result-label">Memory Found</span>
                        <button id="copyRecallBtn" class="copy-context-btn">
                            ${ICONS.copy}
                            <span>Copy</span>
                        </button>
                    </div>
                    <div class="recall-result-content">${escapeHtml(response.context)}</div>
                    ${resultCount > 0 ? `
                        <div class="recall-result-meta">${resultCount} relevant memories retrieved</div>
                    ` : ''}
                </div>
            `;

            // Attach copy handler
            const copyBtn = document.getElementById('copyRecallBtn');
            if (copyBtn) {
                copyBtn.addEventListener('click', handleCopyRecallResult);
            }
        } else {
            currentRecallResult = null;

            // Track recall with no results
            if (window.analytics) {
                window.analytics.capture('search_performed', {
                    has_results: false,
                    result_count: 0,
                    source: 'sidepanel',
                    search_type: 'recall'
                });
            }

            recallResultsContainer.innerHTML = `
                <div class="recall-empty">
                    No memories found for this query. Try a different search or save more conversations.
                </div>
            `;
        }

    } catch (error) {
        console.error('Error recalling context:', error);
        currentRecallResult = null;

        let errorMessage = 'Failed to recall context. Please try again.';

        if (error.message && error.message.includes('Insufficient credits')) {
            errorMessage = 'You don\'t have enough credits for this query.';
        } else if (error.message && error.message.includes('Account not activated')) {
            errorMessage = 'Please activate your account first.';
        } else if (error.message) {
            errorMessage = error.message;
        }

        recallResultsContainer.innerHTML = `
            <p class="result-meta" style="color: #f28b82;">${escapeHtml(errorMessage)}</p>
        `;
    } finally {
        isRecallLoading = false;
        recallBtn.disabled = false;
        recallBtn.textContent = 'Recall Context';
    }
}

function handleCopyRecallResult() {
    if (!currentRecallResult) return;

    const copyBtn = document.getElementById('copyRecallBtn');
    if (!copyBtn) return;

    navigator.clipboard.writeText(currentRecallResult).then(() => {
        const originalContent = copyBtn.innerHTML;
        copyBtn.innerHTML = `${ICONS.check}<span>Copied!</span>`;
        copyBtn.style.background = 'rgba(52, 211, 153, 0.2)';
        copyBtn.style.borderColor = 'rgba(52, 211, 153, 0.5)';
        copyBtn.style.color = '#34D399';

        setTimeout(() => {
            copyBtn.innerHTML = originalContent;
            copyBtn.style.background = '';
            copyBtn.style.borderColor = '';
            copyBtn.style.color = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Keyword search - debounced input
const debouncedSearch = debounce(handleSearch, 300);
searchInput.addEventListener('input', (event) => {
    debouncedSearch(event.target.value.trim());
});

// Load More button
loadMoreBtn.addEventListener('click', () => {
    handleSearch(currentSearchTerm, true);
});

// Recall context - button click
recallBtn.addEventListener('click', () => {
    handleRecallContext(recallInput.value);
});

// Recall context - Enter key
recallInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleRecallContext(recallInput.value);
    }
});

// Auto-focus recall input on panel open
recallInput.focus();