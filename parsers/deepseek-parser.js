window.deepseekChatParser = async function() {
    // Conversation metadata
    const conversationData = {
        convo_id: generateConversationId(),
        user_id: getCurrentUserId(),
        platform: 'deepseek',
        title: document.title || 'DeepSeek Conversation',
        timestamp: new Date().toISOString()
    };
    
    const messages = [];
    const messageContainers = document.querySelectorAll('div.ds-message._63c77b1');
    let messageIndex = 0;
    
    for (const container of messageContainers) {
        // Check if it's a user message by presence of d29f3d7d class
        const isUserMessage = container.classList.contains('d29f3d7d');
        
        if (isUserMessage) {
            // USER MESSAGE
            const userTextElement = container.querySelector('div.fbb737a4');
            const textContent = userTextElement || container; // fallback
            
            let userText = textContent.innerText.trim();
            
            // Strip injected context to prevent saving duplicates
            userText = window.vektoriParserUtils.stripInjectedContext(userText);
            
            if (userText && userText.length > 0) {
                messages.push({
                    role: 'user',
                    text_content: userText,
                    message_index: messageIndex++,
                    convo_id: conversationData.convo_id
                });
            }
        } else {
            // LLM MESSAGE
            let messageContent = '';
            
            // Get LLM text from markdown container
            const textContent = container.querySelector('div.ds-markdown') ||
                                container; // fallback
            messageContent += textContent.innerText.trim();
            
            // DeepSeek doesn't have artifacts like Claude
            // All content is already in the markdown div
            // No need for artifact extraction
            
            // Add the LLM message if content exists
            if (messageContent.trim()) {
                messages.push({
                    role: 'assistant',
                    text_content: messageContent.trim(),
                    message_index: messageIndex++,
                    convo_id: conversationData.convo_id
                });
            }
        }
    }
    
    // Final structure
    const chatData = {
        conversation: conversationData,
        messages: messages
    };
    
    console.log('Parsed chat data:', chatData);
    return chatData;
}

function generateConversationId() {
    // Extract convo_id from URL: chat.deepseek.com/a/chat/s/{convoId}
    const url = window.location.href;
    const match = url.match(/\/a\/chat\/s\/([a-zA-Z0-9\-]+)/);
    
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

