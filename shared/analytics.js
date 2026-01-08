// ============================================================================
// PostHog Analytics - Vektori Memory Extension
// Manifest V3 compatible analytics with shared distinct_id across contexts
// ============================================================================

const POSTHOG_API_KEY = 'phc_J6J05uIXjo0Ii3rUFXfzMUB7qxfgKtHSOUE1xCMTCWt';
const POSTHOG_HOST = 'https://us.i.posthog.com';

// Simple UUID v4 generator (no external dependencies)
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Get or create a shared distinct_id across all extension contexts
async function getSharedDistinctId() {
    try {
        const stored = await chrome.storage.local.get(['posthog_distinct_id']);
        if (stored.posthog_distinct_id) {
            return stored.posthog_distinct_id;
        }

        // Generate new distinct ID and store it
        const distinctId = generateUUID();
        await chrome.storage.local.set({ posthog_distinct_id: distinctId });
        return distinctId;
    } catch (error) {
        console.warn('[Analytics] Failed to access storage, using session ID:', error.message);
        // Fallback to session-based ID if storage fails
        return 'temp_' + generateUUID();
    }
}

// Lightweight PostHog capture implementation (no SDK needed)
// This avoids bundling issues and CSP problems
class VektoriAnalytics {
    constructor() {
        this.distinctId = null;
        this.userId = null;
        this.initialized = false;
        this.queue = [];
        this.debug = false;
    }

    async init(options = {}) {
        if (this.initialized) return;

        this.debug = options.debug || false;
        this.distinctId = await getSharedDistinctId();
        this.initialized = true;

        // Process queued events
        while (this.queue.length > 0) {
            const event = this.queue.shift();
            await this._send(event.eventName, event.properties);
        }

        if (this.debug) {
            console.log('[Analytics] Initialized with distinct_id:', this.distinctId);
        }
    }

    // Identify user (after login)
    identify(userId, traits = {}) {
        if (!userId) return;

        this.userId = userId;
        this.capture('$identify', {
            $set: traits,
            $user_id: userId
        });

        if (this.debug) {
            console.log('[Analytics] Identified user:', userId, traits);
        }
    }

    // Reset user (after logout)
    async reset() {
        this.userId = null;
        const newDistinctId = generateUUID();
        await chrome.storage.local.set({ posthog_distinct_id: newDistinctId });
        this.distinctId = newDistinctId;

        if (this.debug) {
            console.log('[Analytics] Reset, new distinct_id:', newDistinctId);
        }
    }

    // Capture an event
    capture(eventName, properties = {}) {
        if (!this.initialized) {
            this.queue.push({ eventName, properties });
            return;
        }

        this._send(eventName, properties);
    }

    async _send(eventName, properties = {}) {
        try {
            const payload = {
                api_key: POSTHOG_API_KEY,
                event: eventName,
                properties: {
                    distinct_id: this.distinctId,
                    $lib: 'vektori-extension',
                    $lib_version: chrome.runtime.getManifest().version,
                    ...properties
                },
                timestamp: new Date().toISOString()
            };

            // Add user_id if identified
            if (this.userId) {
                payload.properties.$user_id = this.userId;
            }

            const response = await fetch(`${POSTHOG_HOST}/capture/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (this.debug) {
                console.log('[Analytics] Event sent:', eventName, response.ok ? '✓' : '✗');
            }
        } catch (error) {
            if (this.debug) {
                console.warn('[Analytics] Failed to send event:', eventName, error.message);
            }
        }
    }

    // Batch capture multiple events
    async captureBatch(events) {
        if (!this.initialized) {
            events.forEach(e => this.queue.push(e));
            return;
        }

        try {
            const batch = events.map(({ eventName, properties = {} }) => ({
                event: eventName,
                properties: {
                    distinct_id: this.distinctId,
                    $lib: 'vektori-extension',
                    $lib_version: chrome.runtime.getManifest().version,
                    ...(this.userId && { $user_id: this.userId }),
                    ...properties
                },
                timestamp: new Date().toISOString()
            }));

            await fetch(`${POSTHOG_HOST}/batch/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    api_key: POSTHOG_API_KEY,
                    batch
                })
            });
        } catch (error) {
            if (this.debug) {
                console.warn('[Analytics] Batch send failed:', error.message);
            }
        }
    }
}

// Export singleton instance
const analytics = new VektoriAnalytics();

// Make available globally for different contexts
if (typeof self !== 'undefined') {
    self.analytics = analytics;
}
if (typeof window !== 'undefined') {
    window.analytics = analytics;
}
