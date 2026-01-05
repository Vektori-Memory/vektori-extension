window.claudeChatParser = async function() {
    // Conversation metadata
    const conversationData = {
        convo_id: generateConversationId(),
        user_id: getCurrentUserId(),
        platform: 'claude',
        title: document.title || 'Claude Conversation',
        timestamp: new Date().toISOString()
    };
    
    const messages = [];
    const messageContainers = document.querySelectorAll('[data-test-render-count]');
    let messageIndex = 0;
    
    for (const container of messageContainers) {
        const userMessageElement = container.querySelector('[data-testid="user-message"]');
        
        if (userMessageElement) {
            // USER MESSAGE
            let userText = userMessageElement.innerText.trim();
            
            // Strip injected context to prevent saving duplicates
            userText = window.vektoriParserUtils.stripInjectedContext(userText);
            
            messages.push({
                role: 'user',
                text_content: userText,
                message_index: messageIndex++,
                convo_id: conversationData.convo_id
            });
        } else {
            // LLM MESSAGE
            let messageContent = '';
            
            // Get LLM text
            const textContent = container.querySelector('div[class*="font-claude-message"]') ||
                                container.querySelector('div[class*="prose"]') ||
                                container; // fallback
            messageContent += textContent.innerText.trim();
            
           // Handle ARTIFACTS - updated to handle both code and non-code artifacts
	const artifacts = container.querySelectorAll('.artifact-block-cell');
		if (artifacts.length > 0) {
		    console.log(`Found ${artifacts.length} artifacts in this message...`);
		    messageContent += '\n\n--- ARTIFACTS ---\n';
		    
		    for (let i = 0; i < artifacts.length; i++) {
			const artifact = artifacts[i];
			console.log(`Processing artifact ${i + 1}...`);
			
			const clickableElement = artifact.closest('[role="button"]');
			if (!clickableElement) {
			    console.log(`No clickable element found for artifact ${i + 1}`);
			    continue;
			}
			
			// Click and wait for artifact to open
			clickableElement.click();
			await new Promise(resolve => setTimeout(resolve, 2000));
			
			let extractedContent = null;
			let artifactType = 'unknown';
			
			// Method 1: Try code artifacts first
			const codeContainer = document.querySelector('div.code-block__code');
			if (codeContainer) {
			    const codeBlock = codeContainer.querySelector('code[class^="language-"]');
			    if (codeBlock) {
				artifactType = codeBlock.className.match(/language-(\w+)/)?.[1] || 'code';
				extractedContent = codeBlock.textContent;
				
				if (!extractedContent || extractedContent.length < 10) {
				    const spans = codeBlock.querySelectorAll('span');
				    extractedContent = Array.from(spans).map(span => span.textContent).join('');
				}
				
				// Check for duplication
				if (extractedContent && extractedContent.length > 100) {
				    const halfLength = Math.floor(extractedContent.length / 2);
				    const firstHalf = extractedContent.substring(0, halfLength);
				    const secondHalf = extractedContent.substring(halfLength);
				    
				    if (firstHalf === secondHalf) {
					console.log(`Detected duplication in artifact ${i + 1}, using first half`);
					extractedContent = firstHalf;
				    }
				}
			    }
			}
			
			// Method 2: Try markdown/document artifacts
			if (!extractedContent) {
			    const markdownArtifact = document.querySelector('#markdown-artifact');
			    if (markdownArtifact) {
				artifactType = 'markdown';
				extractedContent = markdownArtifact.innerText;
			    }
			}
			
			if (extractedContent && extractedContent.trim()) {
			    console.log(`Extracted artifact ${i + 1}: ${artifactType}, ${extractedContent.length} chars`);
			    messageContent += `\n--- Artifact ${i + 1} (${artifactType}) ---\n`;
			    messageContent += extractedContent.trim();
			    messageContent += '\n';
			} else {
			    console.log(`Failed to extract content for artifact ${i + 1}`);
			    messageContent += `\n--- Artifact ${i + 1} (failed to extract) ---\n`;
			}
			
			// Close the artifact
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
			await new Promise(resolve => setTimeout(resolve, 500));
			
			const backdrop = document.querySelector('[role="dialog"]') || document.body;
			backdrop.click();
			await new Promise(resolve => setTimeout(resolve, 300));
		    }
		} 
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

function generateConversationId()
{
    // Extract convo_id from URL: claude.ai/chat/{convoId}
    const url = window.location.href;
    const match = url.match(/\/chat\/([a-zA-Z0-9\-]+)/);
    
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
