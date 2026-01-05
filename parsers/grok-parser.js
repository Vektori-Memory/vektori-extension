window.grokChatParser = function() {
    const messages = []

     // Get conversation-level data
    const conversationData = {
        convo_id: generateConversationId(),
        user_id: getCurrentUserId(), // auth stuff 
        platform: 'grok',
        title: getChatTitle(),
        timestamp: new Date().toISOString()
    };

    console.log('[Grok Parser] Starting parse...');

    // Strategy: Find user and LLM messages separately, then interleave by DOM order
    const allMessages = [];
    
    // Find ALL user messages (p tags with white-space: pre-wrap)
    const userPs = document.querySelectorAll('p[style*="white-space: pre-wrap"]');
    console.log(`[Grok Parser] Found ${userPs.length} user <p> elements`);
    
    userPs.forEach((p) => {
        let content = p.textContent.trim();
        
        // Strip injected context to prevent saving duplicates
        content = window.vektoriParserUtils.stripInjectedContext(content);
        
        if (content && content.length > 0) {
            allMessages.push({
                element: p,
                role: 'user',
                text_content: content,
                domPosition: getDOMPosition(p)
            });
        }
    });
    
    // Find ALL LLM messages (.markdown elements)
    const llmMarkdowns = document.querySelectorAll('.markdown');
    console.log(`[Grok Parser] Found ${llmMarkdowns.length} .markdown elements`);
    
    llmMarkdowns.forEach((markdown) => {
        const content = markdown.textContent.trim();
        if (content && content.length > 0) {
            allMessages.push({
                element: markdown,
                role: 'assistant',
                text_content: content,
                domPosition: getDOMPosition(markdown)
            });
        }
    });
    
    // DEDUPLICATE: Remove messages with identical text content
    // (because .markdown containers include the <p> tags inside them)
    const seen = new Set();
    const uniqueMessages = [];
    
    allMessages.forEach((msg) => {
        if (!seen.has(msg.text_content)) {
            seen.add(msg.text_content);
            uniqueMessages.push(msg);
        }
    });
    
    console.log(`[Grok Parser] After deduplication: ${uniqueMessages.length} unique messages`);
    
    // Sort by DOM position to maintain conversation order
    uniqueMessages.sort((a, b) => a.domPosition - b.domPosition);
    
    // Convert to final format with proper indices
    uniqueMessages.forEach((msg, index) => {
        messages.push({
            role: msg.role,
            text_content: msg.text_content,
            message_index: index,
            convo_id: conversationData.convo_id
        });
        console.log(`[Grok Parser] Message ${index} (${msg.role}): ${msg.text_content.substring(0, 50)}...`);
    });

    console.log(`[Grok Parser] Total messages parsed: ${messages.length}`);

    return {
        conversation: conversationData,
        messages: messages
    };
}

// Helper function to get DOM position for sorting
function getDOMPosition(element) {
    let position = 0;
    let current = element;
    
    while (current) {
        if (current.previousSibling) {
            position++;
            current = current.previousSibling;
        } else {
            current = current.parentNode;
            if (current) position += 1000; // Move up a level
        }
    }
    
    return position;
}

function parseUserMessage(messageEl)
{
    const contentEl = messageEl.querySelector('p[style*="white-space: pre-wrap"]');
    return contentEl ? contentEl.textContent.trim() : '';
}

function parseAssistantMessage(messageEl)
{
    const contentEl = messageEl.querySelector('.markdown') || 
                        messageEl.querySelector('.prose')
    return contentEl ? contentEl.textContent.trim() : '';
}

function getChatTitle() 
{
    return document.querySelector('[data-testid="conversation-title"]')?.textContent.trim() || 'Untitled Chat';
}

function generateConversationId()
{
    // Extract convo_id from URL: grok.com/c/{convoId}
    const url = window.location.href;
    const match = url.match(/\/c\/([a-zA-Z0-9\-]+)/);
    
    if (match && match[1]) {
        console.log('[Parser] Extracted convo_id from URL:', match[1]);
        return match[1];
    }
    
    // Fallback to UUID only if not in a chat (shouldn't happen normally)
    console.log('[Parser] No convo_id in URL, generating fallback UUID');
    return generateUUID();
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getCurrentUserId() {
    // Get user ID from chrome.storage.local (set during sign-in)
    // This is synchronous in content script context, so we return null
    // and let background.js handle it from authenticated user
    return null;
}