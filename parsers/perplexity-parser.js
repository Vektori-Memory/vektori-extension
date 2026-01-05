window.perplexityChatParser = function() {
    const messages = []

     // Get conversation-level data
    const conversationData = {
        convo_id: generateConversationId(),
        user_id: getCurrentUserId(), // auth stuff 
        platform: 'perplexity',
        title: getChatTitle(),
        timestamp: new Date().toISOString()
    };


	const userMessages = document.querySelectorAll('[data-lexical-editor="true"][role="textbox"]');    
	const assistantMessages = document.querySelectorAll('[id^="markdown-content-"]');


    const allMessages = [];
    
    
    // Add user messages with their DOM position
	userMessages.forEach((userEl) => {
	    const textSpan = userEl.querySelector('[data-lexical-text="true"]');
	    if (textSpan) {
		let content = textSpan.textContent.trim();
		
		// Strip injected context to prevent saving duplicates
		content = window.vektoriParserUtils.stripInjectedContext(content);
		
		if (content && content !== 'Ask anything…') {
		    allMessages.push({
			element: userEl,
			role: 'user',
			text_content: content,
			domPosition: getDOMPosition(userEl)
		    });
		}
	    }
	}); 
    // Add assistant messages with their DOM position
    assistantMessages.forEach((assistantEl) => {
        const content = parseAssistantMessage(assistantEl);
        if (content.trim()) {
            allMessages.push({
                element: assistantEl,
                role: 'assistant',
                text_content: content,
                domPosition: getDOMPosition(assistantEl)
            });
        }
    });
    
    // Sort by DOM position to maintain conversation order
    allMessages.sort((a, b) => a.domPosition - b.domPosition);
    
    // Convert to final message format
    allMessages.forEach((msg, index) => {
        if (msg.role === 'user') {
            messages.push({
                role: 'user',
                text_content: msg.text_content,
                message_index: index,
                convo_id: conversationData.convo_id
            });
        } else {
            messages.push({
                role: 'assistant',
                text_content: msg.text_content,
                message_index: index,
                convo_id: conversationData.convo_id
            });
        }
    });

    return {
        conversation: conversationData,
        messages: messages
    };
}

function parseUserMessage(messageEl) {
    // Extract text content from <p dir="ltr"> element
    return messageEl.textContent.trim();
}

function parseAssistantMessage(messageEl) {
    // Extract text content from markdown-content-* elements
    return messageEl.textContent.trim();
}


function getDOMPosition(element) {
    // Get the element's position in the document for ordering
    let position = 0;
    let walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        null,
        false
    );
    
    while (walker.nextNode()) {
        position++;
        if (walker.currentNode === element) {
            return position;
        }
    }
    return position;
}


function getChatTitle() 
{
    const titleEl = document.querySelector('h1[class*="text-foreground"]');
    if (titleEl) {
        const textboxInside = titleEl.querySelector('[data-lexical-editor="true"]');
        if (textboxInside) {
            const titleSpan = textboxInside.querySelector('[data-lexical-text="true"]');
            if (titleSpan) {
                return titleSpan.textContent.trim();
            }
        }
    }
    return 'Untitled Chat';
}

function generateConversationId()
{
    // Extract convo_id from URL: perplexity.ai/search/{query}-{convoId}
    // Example: https://www.perplexity.ai/search/is-thehre-any-thing-for-i-want-6010JIhXRo.peJqBK2pbNQ
    const url = window.location.href;
    const match = url.match(/\/search\/[^\/]+-([a-zA-Z0-9._\-]+)/);
    
    if (match && match[1]) {
        console.log('[Parser] Extracted convo_id from URL:', match[1]);
        return match[1];
    }
    
    // Fallback: Try to extract anything after last hyphen in URL path
    const urlPath = window.location.pathname;
    const parts = urlPath.split('-');
    if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart.length > 10) {
            console.log('[Parser] Extracted convo_id from URL (fallback):', lastPart);
            return lastPart;
        }
    }
    
    // Last resort: generate UUID
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
