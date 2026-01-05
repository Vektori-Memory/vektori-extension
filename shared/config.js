// Configuration for Vektori Memory Extension

const CONFIG = {
    // Production API URL - using workers.dev URL (custom domain broken)
    // Custom domain: https://api.vektori.cloud (Cloudflare error 1014)
    PRODUCTION_API_URL: 'https://vektori-memory.vektori-cloud.workers.dev',

    // Automatically use production URL if set, otherwise localhost for dev
    get API_URL() {
        return this.PRODUCTION_API_URL || 'http://127.0.0.1:8787';
    },

    // Check if running in production mode
    get isProduction() {
        return !!this.PRODUCTION_API_URL;
    },

    // Debug mode - set to false for production to silence logs
    DEBUG: false
};

// Lightweight logger - only logs when DEBUG is true
const log = {
    info: (...args) => CONFIG.DEBUG && console.log('[Vektori]', ...args),
    warn: (...args) => CONFIG.DEBUG && console.warn('[Vektori]', ...args),
    error: (...args) => console.error('[Vektori]', ...args), // Always show errors
    debug: (...args) => CONFIG.DEBUG && console.log('[Vektori:Debug]', ...args)
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
    window.vLog = log;
}
if (typeof self !== 'undefined') {
    self.CONFIG = CONFIG;
    self.vLog = log;
}
