window.chatGPTChatParser = async function() {
    const messages = []

     // Get conversation-level data
    const conversationData = {
        convo_id: generateConversationId(),
        user_id: getCurrentUserId(), // auth stuff 
        platform: 'chatgpt',
        title: getChatTitle(),
        timestamp: new Date().toISOString()
    };


    const  messageElements = document.querySelectorAll('[data-message-author-role]');
    messageElements.forEach((messageEl, index) => 
    {
        const role = messageEl.getAttribute('data-message-author-role');
        
        if (role == 'user')
        {
            const content = parseUserMessage(messageEl);
            if(content.trim())
            {
                messages.push({
                    role:'user',
                    text_content: content,
                    message_index: index,
                    convo_id: conversationData.convo_id
                });
            }
        } 
        else if(role == 'assistant')
        {
            const content = parseAssistantMessage(messageEl);
            if (content.trim())
            {
                messages.push({
                    role: 'assistant',
                    text_content: content,
                    message_index: index,
                    convo_id:conversationData.convo_id
                });
            }
        }
    });

    return {
        conversation: conversationData,
        messages: messages
    };
}

function parseUserMessage(messageEl)
{
    // Try multiple selectors for user message content (ChatGPT DOM changes frequently)
    const contentEl = messageEl.querySelector('.min-w-0.flex-1.py-3.whitespace-pre-wrap') ||
                      messageEl.querySelector('.whitespace-pre-wrap') ||
                      messageEl.querySelector('[class*="whitespace-pre-wrap"]');
    let content = contentEl ? contentEl.textContent.trim() : '';

    // Strip injected context to prevent duplicates (using shared utility)
    content = window.vektoriParserUtils.stripInjectedContext(content);

    return content;
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
    // Extract convo_id from URL: chatgpt.com/c/{convoId}
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