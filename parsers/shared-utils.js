/**
 * Shared parser utilities for Vektori Memory Extension
 * 
 * Common functions used across all platform parsers (ChatGPT, Claude, Perplexity, etc.)
 */

/**
 * Strips injected context from user messages to prevent saving duplicate memory.
 * 
 * Handles multiple injection formats:
 * 1. Bullet-point context format: "Just for context...\n• fact\n• fact\n\noriginal query"
 * 2. Legacy "Context:" format: "Context: {context}\n\n{query}"
 * 3. Old format: "Memory, might or might not be relevent dont assume: {context}\n\n{query}"
 * 4. New format: "Just for context: only, take in account if relevent to user query:{context}\n\n{query}"
 * @param {string} text - The user message text that might contain injected context
 * @returns {string} - The cleaned user message without injected context
 */
function stripInjectedContext(text) {
    if (!text) return text;

    // Pattern 1: New format with bullet points
    // Format: "Just for context: only, take in account if relevent to user query:\n• fact\n• fact\n\noriginal query"
    const bulletFormatPattern = /^Just\s+for\s+context:\s*only,\s*take\s+in\s+account\s+if\s+rele[vV]ent\s+to\s+user\s+query:\s*\n([\s\S]*?)\n\n+(.+)$/is;
    const bulletMatch = text.match(bulletFormatPattern);
    if (bulletMatch && bulletMatch[2]) {
        console.log('[Parser] Stripped "Just for context" bullet format from user message');
        return bulletMatch[2].trim();
    }

    // Pattern 2: New format (legacy without bullets)
    // Format: "Just for context: only, take in account if relevent to user query:{context}\n\n{query}"
    const newFormatPattern = /^Just\s+for\s+context:\s*only,\s*take\s+in\s+account\s+if\s+rele[vV]ent\s+to\s+user\s+query:\s*(.+?)\n\n+(.+)$/is;
    const newFormatMatch = text.match(newFormatPattern);
    if (newFormatMatch && newFormatMatch[2]) {
        console.log('[Parser] Stripped "Just for context" format from user message');
        return newFormatMatch[2].trim();
    }

    // Pattern 3: Bullet-point context at the beginning (generic)
    // Format: "• fact\n• fact\n\noriginal query" or "* fact\n* fact\n\noriginal query"
    if (text.match(/^[\s\n]*[*\-•]/)) {
        // Find the last occurrence of double newline (context separator)
        const parts = text.split(/\n\n+/);

        // If we have multiple parts, check if first parts look like context
        if (parts.length >= 2) {
            // Context parts typically have multiple bullets
            const potentialContext = parts.slice(0, -1).join('\n\n');
            const potentialQuery = parts[parts.length - 1].trim();

            // Heuristic: If the last part is shorter and doesn't have bullets,
            // it's likely the original query
            if (potentialQuery.length > 10 &&
                !potentialQuery.match(/^[*\-•]/) &&
                potentialContext.match(/[*\-•]/g)?.length >= 2) {
                console.log('[Parser] Stripped bullet-point context from user message');
                return potentialQuery;
            }
        }
    }

    // Pattern 4: Legacy "Context:" format
    // Format: "Context: {context}\n\n{query}"
    if (text.toLowerCase().startsWith('context:')) {
        const contextMatch = text.match(/^context:\s*(.+?)\n\n+(.+)$/is);
        if (contextMatch && contextMatch[2]) {
            console.log('[Parser] Stripped legacy "Context:" format from user message');
            return contextMatch[2].trim();
        }
    }

    // No context detected, return original text
    return text;
}

/**
 * Extracts timestamp from a DOM element (common patterns across platforms).
 * 
 * @param {HTMLElement} element - The message element containing timestamp
 * @returns {string|null} - ISO timestamp or null if not found
 */
function extractTimestamp(element) {
    if (!element) return null;

    // Try <time> element with datetime attribute
    const timeEl = element.querySelector('time[datetime]');
    if (timeEl) {
        const datetime = timeEl.getAttribute('datetime');
        if (datetime) return new Date(datetime).toISOString();
    }

    // Try data-message-time attribute
    const messageTime = element.getAttribute('data-message-time') || 
                       element.querySelector('[data-message-time]')?.getAttribute('data-message-time');
    if (messageTime) {
        return new Date(parseInt(messageTime)).toISOString();
    }

    // Try data-timestamp attribute
    const timestamp = element.getAttribute('data-timestamp') ||
                     element.querySelector('[data-timestamp]')?.getAttribute('data-timestamp');
    if (timestamp) {
        return new Date(parseInt(timestamp)).toISOString();
    }

    // Fallback to current time
    return null;
}

/**
 * Sanitizes text content by removing excessive whitespace and normalizing newlines.
 * 
 * @param {string} text - The text to sanitize
 * @returns {string} - Cleaned text
 */
function sanitizeText(text) {
    if (!text) return '';
    
    return text
        .replace(/\r\n/g, '\n')           // Normalize line endings
        .replace(/\n{3,}/g, '\n\n')       // Max 2 consecutive newlines
        .trim();
}

// Export for use in content scripts (if needed)
if (typeof window !== 'undefined') {
    window.vektoriParserUtils = {
        stripInjectedContext,
        extractTimestamp,
        sanitizeText
    };
}
