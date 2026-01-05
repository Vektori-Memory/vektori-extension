// Vektori Memory Popup - v2 (Modular Tab-Based Design)
// ============================================================================

// ============================================================================
// PRODUCTION LOG SILENCER
// ============================================================================
(function () {
    if (typeof CONFIG !== 'undefined' && !CONFIG.DEBUG) {
        const noop = () => { };
        window._originalConsoleLog = console.log;
        console.log = noop;
    }
})();

// ============================================================================
// SVG ICONS
// ============================================================================
const ICONS = {
    // Vektori brand logos - SWITCH BETWEEN THESE TO TEST:
    // Options: 'transparent', 'light', 'monochrome', 'original'
    // To test: change LOGO_VARIANT below and reload extension

    // Current: using transparent (inline SVG for best quality)
    vektori: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(100, 100)">
            <path d="M -50 30 L -30 40 L 30 40 L 50 30 L 30 20 L -30 20 Z" fill="#FF8204" opacity="0.4"/>
            <path d="M -45 5 L -25 15 L 25 15 L 45 5 L 25 -5 L -25 -5 Z" fill="#FF8204" opacity="0.7"/>
            <path d="M -40 -20 L -20 -10 L 20 -10 L 40 -20 L 20 -30 L -20 -30 Z" fill="#FF8204" opacity="1"/>
            <line x1="-30" y1="20" x2="-25" y2="-5" stroke="#FF8204" stroke-width="2" opacity="0.3"/>
            <line x1="30" y1="20" x2="25" y2="-5" stroke="#FF8204" stroke-width="2" opacity="0.3"/>
            <line x1="-25" y1="-5" x2="-20" y2="-30" stroke="#FF8204" stroke-width="2" opacity="0.3"/>
            <line x1="25" y1="-5" x2="20" y2="-30" stroke="#FF8204" stroke-width="2" opacity="0.3"/>
        </g>
    </svg>`,

    // Alternative: Light background version (white circle behind)
    vektoriLight: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="100" fill="#FFFFFF"/>
        <g transform="translate(100, 100)">
            <path d="M -50 30 L -30 40 L 30 40 L 50 30 L 30 20 L -30 20 Z" fill="#FF8204" opacity="0.4"/>
            <path d="M -45 5 L -25 15 L 25 15 L 45 5 L 25 -5 L -25 -5 Z" fill="#FF8204" opacity="0.7"/>
            <path d="M -40 -20 L -20 -10 L 20 -10 L 40 -20 L 20 -30 L -20 -30 Z" fill="#FF8204" opacity="1"/>
            <line x1="-30" y1="20" x2="-25" y2="-5" stroke="#FF8204" stroke-width="2" opacity="0.3"/>
            <line x1="30" y1="20" x2="25" y2="-5" stroke="#FF8204" stroke-width="2" opacity="0.3"/>
            <line x1="-25" y1="-5" x2="-20" y2="-30" stroke="#FF8204" stroke-width="2" opacity="0.3"/>
            <line x1="25" y1="-5" x2="20" y2="-30" stroke="#FF8204" stroke-width="2" opacity="0.3"/>
        </g>
    </svg>`,

    // Alternative: Monochrome version (white on black)
    vektoriMono: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="100" fill="#0f0f0f"/>
        <g transform="translate(100, 100)">
            <path d="M -50 30 L -30 40 L 30 40 L 50 30 L 30 20 L -30 20 Z" fill="#FFFFFF" opacity="0.4"/>
            <path d="M -45 5 L -25 15 L 25 15 L 45 5 L 25 -5 L -25 -5 Z" fill="#FFFFFF" opacity="0.7"/>
            <path d="M -40 -20 L -20 -10 L 20 -10 L 40 -20 L 20 -30 L -20 -30 Z" fill="#FFFFFF" opacity="1"/>
            <line x1="-30" y1="20" x2="-25" y2="-5" stroke="#FFFFFF" stroke-width="2" opacity="0.3"/>
            <line x1="30" y1="20" x2="25" y2="-5" stroke="#FFFFFF" stroke-width="2" opacity="0.3"/>
            <line x1="-25" y1="-5" x2="-20" y2="-30" stroke="#FFFFFF" stroke-width="2" opacity="0.3"/>
            <line x1="25" y1="-5" x2="20" y2="-30" stroke="#FFFFFF" stroke-width="2" opacity="0.3"/>
        </g>
    </svg>`,

    brain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.54"/>
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.54"/>
    </svg>`,
    globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>`,
    externalLink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>`,
    mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>`,
    helpCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`,
    checkCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
    </svg>`,
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="M21 21l-4.35-4.35"/>
    </svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
    </svg>`,
    save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
    </svg>`,
    logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>`,
    chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
    </svg>`,
    alertCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>`,
    zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>`,
    chatgpt: `<svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
    </svg>`,
    claude: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="m3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212 2.736-.75.096-.324-.302.04-.496.154-.162 1.267-.871z"/></svg>`,
    google: `<svg viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>`,
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>`,
    rocket: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>`,
    target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="6"/>
        <circle cx="12" cy="12" r="2"/>
    </svg>`,
    heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
    </svg>`,
    sparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        <path d="M5 3v4"/>
        <path d="M19 17v4"/>
        <path d="M3 5h4"/>
        <path d="M17 19h4"/>
    </svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        <rect x="9" y="2" width="6" height="4" rx="1" ry="1"/>
    </svg>`
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
let appState = {
    view: 'loading', // 'loading' | 'signedOut' | 'signedIn' | 'enterInviteCode' | 'error'
    activeTab: 'home', // 'home' | 'search' | 'import' | 'profile'
    user: null,
    autoSaveEnabled: false,
    statusMessage: '',
    errorMessage: '',
    isProcessing: false,
    queryResults: null,
    queryInProgress: false,
    credits: null,
    inviteCodeError: '',
    waitlistJoined: false,
    theme: 'dark' // 'dark' | 'light'
};

function setState(updates, preserveScroll = true) {
    const scrollContainer = document.querySelector('.app-content');
    const scrollTop = preserveScroll && scrollContainer ? scrollContainer.scrollTop : 0;

    appState = { ...appState, ...updates };
    render();

    // Restore scroll position after render
    if (preserveScroll && scrollTop > 0) {
        requestAnimationFrame(() => {
            const newScrollContainer = document.querySelector('.app-content');
            if (newScrollContainer) {
                newScrollContainer.scrollTop = scrollTop;
            }
        });
    }
}

// Theme management
function loadTheme() {
    const saved = localStorage.getItem('vektori-theme');
    if (saved) {
        appState.theme = saved;
        applyTheme(saved);
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vektori-theme', theme);
}

function toggleTheme() {
    const newTheme = appState.theme === 'dark' ? 'light' : 'dark';
    appState.theme = newTheme;
    applyTheme(newTheme);
    render();
}

// ============================================================================
// RENDER DISPATCHER
// ============================================================================
function render() {
    console.log('[Popup] Rendering:', appState.view, 'Tab:', appState.activeTab);

    const container = document.getElementById('app-container');
    if (!container) return;

    switch (appState.view) {
        case 'loading':
            container.innerHTML = renderLoadingView();
            break;
        case 'signedOut':
            container.innerHTML = renderSignedOutView();
            attachSignedOutHandlers();
            break;
        case 'signedIn':
            container.innerHTML = renderSignedInView();
            attachSignedInHandlers();
            break;
        case 'enterInviteCode':
            container.innerHTML = renderInviteCodeView();
            attachInviteCodeHandlers();
            break;
        case 'error':
            container.innerHTML = renderErrorView();
            attachErrorHandlers();
            break;
    }
}

// ============================================================================
// VIEW RENDERERS
// ============================================================================

function renderLoadingView() {
    return `
        <div class="view-loading">
            <div class="spinner"></div>
            <div class="loading-text">${appState.statusMessage || 'Loading...'}</div>
        </div>
    `;
}

function renderSignedOutView() {
    const errorBanner = appState.errorMessage ? `
        <div class="error-banner">${escapeHtml(appState.errorMessage)}</div>
    ` : '';

    const themeIcon = appState.theme === 'dark' ? ICONS.sun : ICONS.moon;
    const themeTitle = appState.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

    return `
        <div class="view-signed-out">
            <div class="signed-out-header">
                <button class="theme-toggle-float" id="theme-toggle-btn" title="${themeTitle}">
                    ${themeIcon}
                </button>
                <div class="hero-glow"></div>
                <div class="brand-inline">
                    <div class="hero-icon">${ICONS.vektori}</div>
                    <h1 class="brand-title-large">Vektori</h1>
                </div>
                <p class="brand-tagline-left">Your AI conversations, <span class="highlight">remembered forever</span></p>
            </div>
            
            ${errorBanner}
            
            <div class="mission-cards">
                <div class="mission-card">
                    <div class="mission-icon">${ICONS.rocket}</div>
                    <div class="mission-content">
                        <span class="mission-title">Mission</span>
                        <span class="mission-text">Never lose an insight again</span>
                    </div>
                </div>
                <div class="mission-card">
                    <div class="mission-icon">${ICONS.target}</div>
                    <div class="mission-content">
                        <span class="mission-title">Goal</span>
                        <span class="mission-text">Build your personal AI memory</span>
                    </div>
                </div>
                <div class="mission-card">
                    <div class="mission-icon">${ICONS.heart}</div>
                    <div class="mission-content">
                        <span class="mission-title">Promise</span>
                        <span class="mission-text">Privacy-first, always yours</span>
                    </div>
                </div>
            </div>
            
            <div class="signin-section">
                <button id="signin-btn" class="btn-google" ${appState.isProcessing ? 'disabled' : ''}>
                    ${ICONS.google}
                    <span>${appState.isProcessing ? 'Signing in...' : 'Continue with Google'}</span>
                </button>
                <p class="privacy-note">Your data is private and secure</p>
            </div>
            
            <div class="footer-link">
                <a href="https://vektori.cloud" target="_blank" rel="noopener noreferrer">
                    Learn more at <strong>vektori.cloud</strong>
                </a>
            </div>
        </div>
    `;
}

function renderSignedInView() {
    const user = appState.user || {};
    const userInitials = getUserInitials(user.name || user.email);

    return `
        <div class="app-layout">
            ${renderHeader(userInitials)}
            <div class="app-content">
                ${renderTabContent()}
            </div>
            ${renderTabBar()}
        </div>
    `;
}

function renderHeader(userInitials) {
    const themeIcon = appState.theme === 'dark' ? ICONS.sun : ICONS.moon;
    const themeTitle = appState.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

    return `
        <header class="app-header">
            <div class="header-brand">
                <div class="brand-logo">${ICONS.vektori}</div>
                <span class="brand-name">Vektori</span>
            </div>
            <div class="header-actions">
                <button class="header-btn theme-toggle" id="theme-toggle-btn" title="${themeTitle}">
                    ${themeIcon}
                </button>
                <button class="header-avatar" id="profile-btn" title="Profile">${userInitials}</button>
            </div>
        </header>
    `;
}

function renderTabBar() {
    const tabs = [
        { id: 'home', icon: ICONS.home, label: 'Home' },
        { id: 'search', icon: ICONS.search, label: 'Search' },
        { id: 'import', icon: ICONS.download, label: 'Import' },
        { id: 'profile', icon: ICONS.user, label: 'Profile' }
    ];

    return `
        <nav class="tab-bar">
            ${tabs.map(tab => `
                <button class="tab-item ${appState.activeTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">
                    <span class="tab-icon">${tab.icon}</span>
                    <span class="tab-label">${tab.label}</span>
                </button>
            `).join('')}
        </nav>
    `;
}

function renderTabContent() {
    switch (appState.activeTab) {
        case 'home':
            return renderHomeTab();
        case 'search':
            return renderSearchTab();
        case 'import':
            return renderImportTab();
        case 'profile':
            return renderProfileTab();
        default:
            return renderHomeTab();
    }
}

function renderHomeTab() {
    const credits = appState.credits;
    const statusBanner = appState.statusMessage ? `
        <div class="status-banner">${escapeHtml(appState.statusMessage)}</div>
    ` : '';

    // Compact credit display - only show if credits available
    const creditBadge = credits ? `
        <div class="credit-badge-compact">
            <span class="credit-count">${credits.balance === Infinity ? '∞' : credits.balance}</span>
            <span class="credit-label-small">credits</span>
            <span class="tier-badge">${credits.tier}</span>
        </div>
    ` : '';

    return `
        <div class="home-view view">
            ${statusBanner}
            
            <div class="home-header-compact">
                ${creditBadge}
            </div>
            
            <div class="toggle-card">
                <div class="toggle-info">
                    <div class="toggle-icon-wrapper">${ICONS.save}</div>
                    <div class="toggle-text">
                        <div class="toggle-title">Auto Save</div>
                        <div class="toggle-hint">Auto-saves every message</div>
                    </div>
                </div>
                <input type="checkbox" id="auto-save-toggle" class="toggle-switch" ${appState.autoSaveEnabled ? 'checked' : ''}>
            </div>
            
            <div class="action-list">
                <button class="action-btn" data-tab="search">
                    <div class="action-icon">${ICONS.search}</div>
                    <div class="action-content">
                        <div class="action-title">Query Context</div>
                        <div class="action-desc">Search your saved conversations</div>
                    </div>
                    <div class="action-arrow">${ICONS.chevronRight}</div>
                </button>
                
                <button class="action-btn" data-tab="import">
                    <div class="action-icon">${ICONS.chatgpt}</div>
                    <div class="action-content">
                        <div class="action-title">Import ChatGPT Memory</div>
                        <div class="action-desc">Bring your existing memories</div>
                    </div>
                    <div class="action-arrow">${ICONS.chevronRight}</div>
                </button>
            </div>
        </div>
    `;
}

function renderSearchTab() {
    const resultsHtml = appState.queryResults ? `
        <div class="search-results">
            <div class="results-label">Memory Found</div>
            ${appState.queryResults.has_context ? `
                <button id="copy-context-btn" class="copy-context-btn">
                    ${ICONS.copy}
                    <span>Copy</span>
                </button>
                <div class="results-content">${escapeHtml(appState.queryResults.context)}</div>
                ${appState.queryResults.results?.length ? `
                    <div class="results-meta">
                        ${appState.queryResults.results.length} relevant memories retrieved
                    </div>
                ` : ''}
            ` : `
                <div class="results-empty">
                    No memories found. Try a different query or save more conversations.
                </div>
            `}
        </div>
    ` : '';

    return `
        <div class="search-view view">
            <div class="search-header">
                <h2 class="search-title">Context Search</h2>
                <p class="search-subtitle">Find information from your saved conversations</p>
            </div>
            
            <div class="search-form${appState.queryResults ? ' has-results' : ''}">
                <textarea 
                    id="query-input" 
                    class="search-input" 
                    placeholder="What do you want to remember?"
                    ${appState.queryInProgress ? 'disabled' : ''}
                ></textarea>
                <button id="submit-query-btn" class="search-btn" ${appState.queryInProgress ? 'disabled' : ''}>
                    ${appState.queryInProgress ? 'Searching...' : 'Recall Context'}
                </button>
            </div>
            
            ${resultsHtml}
        </div>
    `;
}

function renderImportTab() {
    const statusBanner = appState.statusMessage ? `
        <div class="success-banner">
            ${ICONS.checkCircle}
            <span>${escapeHtml(appState.statusMessage)}</span>
        </div>
    ` : '';

    return `
        <div class="import-view view">
            <div class="import-header">
                <h2 class="import-title">Import Memory</h2>
                <p class="import-subtitle">Bring your existing AI conversations</p>
            </div>
            
            ${statusBanner}
            
            <div class="import-list">
                <button id="import-chatgpt-btn" class="import-item" ${appState.isProcessing ? 'disabled' : ''}>
                    <div class="import-item-icon chatgpt-icon">${ICONS.chatgpt}</div>
                    <div class="import-item-content">
                        <div class="import-item-title">ChatGPT Memory</div>
                        <div class="import-item-desc">Import from ChatGPT settings</div>
                    </div>
                    <div class="import-item-action">
                        ${appState.isProcessing ? '<span class="loading-dots">...</span>' : ICONS.chevronRight}
                    </div>
                </button>
                
                <div class="import-item disabled">
                    <div class="import-item-icon claude-icon">${ICONS.claude}</div>
                    <div class="import-item-content">
                        <div class="import-item-title">Claude Memory</div>
                        <div class="import-item-desc">Coming soon</div>
                    </div>
                    <div class="import-item-badge">Soon</div>
                </div>
            </div>
            
            <div class="import-instructions">
                <h4 class="instructions-title">How it works</h4>
                <div class="instructions-list">
                    <div class="instruction-item">
                        <span class="instruction-num">1</span>
                        <span>Click to open ChatGPT settings page(that's it!)</span>
                    </div>
                    <div class="instruction-item">
                        <span class="instruction-num">2</span>
                        <span>Auto-navigates to Personalization -> Memory</span>
                    </div>
                    <div class="instruction-item">
                        <span class="instruction-num">3</span>
                        <span>Vektori automatically captures your memories</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderProfileTab() {
    const user = appState.user || {};
    const userName = user.name || (user.email ? user.email.split('@')[0] : 'User');
    const userInitials = getUserInitials(userName);
    const credits = appState.credits;

    return `
        <div class="profile-view view">
            <div class="profile-header">
                <div class="profile-avatar-large">${userInitials}</div>
                <div class="profile-info">
                    <div class="profile-name">${escapeHtml(userName)}</div>
                    <div class="profile-email">${escapeHtml(user.email || '')}</div>
                </div>
            </div>
            
            ${credits ? `
                <div class="credit-card">
                    <div class="credit-header">
                        <div>
                            <div class="credit-label">Credits</div>
                            <div class="credit-value">${credits.balance === Infinity ? '8' : credits.balance}</div>
                        </div>
                        <div class="credit-tier">
                            <div class="tier-label">Tier</div>
                            <div class="tier-value">${credits.tier}</div>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <div class="profile-links">
                <a href="https://vektori.cloud" target="_blank" rel="noopener noreferrer" class="profile-link-item">
                    <div class="profile-link-icon">${ICONS.globe}</div>
                    <span>Visit vektori.cloud</span>
                    <div class="profile-link-arrow">${ICONS.externalLink}</div>
                </a>
                <a href="mailto:vektori.cloud@gmail.com" class="profile-link-item">
                    <div class="profile-link-icon">${ICONS.mail}</div>
                    <span>Contact Us</span>
                    <div class="profile-link-arrow">${ICONS.externalLink}</div>
                </a>
            </div>
            
            <div class="profile-legal">
                <a href="https://x.com/vektorimemory" target="_blank" rel="noopener noreferrer" class="legal-link">@vektorimemory</a>
                <span class="legal-divider">�</span>
                <a href="https://vektori.cloud/terms" target="_blank" rel="noopener noreferrer" class="legal-link">Terms</a>
                <span class="legal-divider">�</span>
                <a href="https://vektori.cloud/privacy" target="_blank" rel="noopener noreferrer" class="legal-link">Privacy</a>
            </div>
            
            <div class="profile-actions">
                <button id="signout-btn" class="signout-button" ${appState.isProcessing ? 'disabled' : ''}>
                    ${appState.isProcessing ? 'Signing out...' : 'Sign Out'}
                </button>
            </div>
            
            <div class="profile-footer">
                <span class="version-text">Vektori v0.0.1</span>
            </div>
        </div>
    `;
}

function renderInviteCodeView() {
    const user = appState.user || {};
    const userName = user.name || (user.email ? user.email.split('@')[0] : 'User');
    const userEmail = user.email || '';

    const themeIcon = appState.theme === 'dark' ? ICONS.sun : ICONS.moon;
    const themeTitle = appState.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

    const errorBanner = appState.inviteCodeError ? `
        <div class="invite-error-banner">
            ${ICONS.alertCircle}
            <span>${escapeHtml(appState.inviteCodeError)}</span>
        </div>
    ` : '';

    const successBanner = appState.statusMessage ? `
        <div class="invite-success-banner">
            ${ICONS.checkCircle}
            <span>${escapeHtml(appState.statusMessage)}</span>
        </div>
    ` : '';

    // Show different content if already on waitlist
    const waitlistContent = appState.waitlistJoined ? `
        <div class="waitlist-confirmed">
            ${ICONS.checkCircle}
            <span>You're on the waitlist</span>
        </div>
    ` : `
        <button id="join-waitlist-btn" class="invite-waitlist-btn" ${appState.isProcessing ? 'disabled' : ''}>
            Join Waitlist
        </button>
    `;

    return `
        <div class="invite-view">
            <button class="theme-toggle-float" id="theme-toggle-btn" title="${themeTitle}">
                ${themeIcon}
            </button>
            
            <div class="invite-content">
                <div class="invite-ticket-icon">\ud83c\udfab</div>
                
                <h1 class="invite-title">Welcome, ${escapeHtml(userName)}!</h1>
                <p class="invite-subtitle">${appState.waitlistJoined ? "You're on the waitlist" : "Enter your invite code to get started"}</p>
                
                ${errorBanner}
                ${successBanner}
                
                <input 
                    type="text" 
                    id="invite-code-input" 
                    class="invite-input"
                    placeholder="XXXX - XXXX"
                    maxlength="20"
                    ${appState.isProcessing ? 'disabled' : ''}
                >
                
                <button id="redeem-invite-btn" class="invite-redeem-btn" ${appState.isProcessing ? 'disabled' : ''}>
                    ${appState.isProcessing ? 'Redeeming...' : 'Redeem Invite Code'}
                </button>
                
                <div class="invite-divider">
                    <span>\u2014 or \u2014</span>
                </div>
                
                ${waitlistContent}
                
                <p class="invite-note">
                    We'll notify you at <strong>${escapeHtml(userEmail)}</strong> when you get access
                </p>
            </div>
            
            <button id="signout-btn" class="invite-signout-btn">
                Sign out
            </button>
        </div>
    `;
}

function renderErrorView() {
    return `
        <div class="view-error">
            <div class="error-icon">${ICONS.alertCircle}</div>
            <h2 class="error-title">Something went wrong</h2>
            <p class="error-message">${escapeHtml(appState.errorMessage || 'An unexpected error occurred.')}</p>
            <div class="error-actions">
                <button id="retry-btn" class="retry-btn">Try Again</button>
                <button id="signout-btn" class="profile-btn danger">
                    ${ICONS.logout}
                    <span>Sign Out</span>
                </button>
            </div>
        </div>
    `;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getUserInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function attachSignedOutHandlers() {
    const signinBtn = document.getElementById('signin-btn');
    if (signinBtn) {
        signinBtn.addEventListener('click', handleGoogleSignIn);
    }

    // Theme toggle
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
}

function attachSignedInHandlers() {
    // Tab navigation
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            setState({ activeTab: tabId, queryResults: null });
        });
    });

    // Profile button in header
    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            setState({ activeTab: 'profile' });
        });
    }

    // Theme toggle
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Action buttons that navigate to tabs
    document.querySelectorAll('.action-btn[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            setState({ activeTab: tabId });
        });
    });

    // Auto-save toggle
    const autoSaveToggle = document.getElementById('auto-save-toggle');
    if (autoSaveToggle) {
        autoSaveToggle.addEventListener('change', (e) => {
            handleAutoSaveToggle(e.target.checked);
        });
    }

    // Sign out
    const signoutBtn = document.getElementById('signout-btn');
    if (signoutBtn) {
        signoutBtn.addEventListener('click', handleSignOut);
    }

    // Search tab handlers
    const submitQueryBtn = document.getElementById('submit-query-btn');
    const queryInput = document.getElementById('query-input');
    if (submitQueryBtn && queryInput) {
        submitQueryBtn.addEventListener('click', () => {
            handleQueryMemory(queryInput.value);
        });
        queryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleQueryMemory(queryInput.value);
            }
        });
    }

    // Copy context button
    const copyContextBtn = document.getElementById('copy-context-btn');
    if (copyContextBtn && appState.queryResults && appState.queryResults.context) {
        copyContextBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(appState.queryResults.context).then(() => {
                const originalText = copyContextBtn.innerHTML;
                copyContextBtn.innerHTML = `${ICONS.checkCircle}<span>Copied!</span>`;
                setTimeout(() => {
                    copyContextBtn.innerHTML = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy:', err);
                alert('Failed to copy context');
            });
        });
    }

    // Import tab handlers
    const importChatGPTBtn = document.getElementById('import-chatgpt-btn');
    if (importChatGPTBtn) {
        importChatGPTBtn.addEventListener('click', handleImportChatGPTMemory);
    }
}

function attachInviteCodeHandlers() {
    const redeemBtn = document.getElementById('redeem-invite-btn');
    const joinWaitlistBtn = document.getElementById('join-waitlist-btn');
    const signoutBtn = document.getElementById('signout-btn');
    const inviteCodeInput = document.getElementById('invite-code-input');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    if (redeemBtn && inviteCodeInput) {
        redeemBtn.addEventListener('click', () => {
            handleRedeemInviteCode(inviteCodeInput.value);
        });
        inviteCodeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleRedeemInviteCode(inviteCodeInput.value);
            }
        });
    }

    if (joinWaitlistBtn) {
        joinWaitlistBtn.addEventListener('click', handleJoinWaitlist);
    }

    if (signoutBtn) {
        signoutBtn.addEventListener('click', handleSignOut);
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
}

function attachErrorHandlers() {
    const retryBtn = document.getElementById('retry-btn');
    const signoutBtn = document.getElementById('signout-btn');

    if (retryBtn) {
        retryBtn.addEventListener('click', async () => {
            setState({ view: 'loading', errorMessage: '' });
            await checkAuthStatus();
        });
    }

    if (signoutBtn) {
        signoutBtn.addEventListener('click', handleSignOut);
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async function () {
    // Load saved theme first (before any rendering)
    loadTheme();

    setState({ view: 'loading', statusMessage: 'Checking your session...' });
    await checkAuthStatus();
    await loadAutoSaveSetting();
});

// ============================================================================
// AUTH & DATA LOADING
// ============================================================================

async function checkAuthStatus() {
    try {
        if (!window.apiClient) {
            console.error('[Popup] API client not initialized');
            setState({ view: 'signedOut', statusMessage: 'Extension error - please reload' });
            return;
        }

        const authStatus = await window.apiClient.checkAuthStatus();

        if (authStatus.isAuthenticated) {
            setState({ user: authStatus.user, statusMessage: 'Loading...' });
            const credits = await loadUserCredits();

            if (credits && credits.tier === 'waitlist') {
                setState({ view: 'enterInviteCode', statusMessage: '' });
            } else {
                setState({ view: 'signedIn', activeTab: 'home', statusMessage: '' });
            }
        } else if (authStatus.canRefresh) {
            setState({ statusMessage: 'Refreshing session...' });
            try {
                await window.apiClient.getValidToken();
                const newStatus = await window.apiClient.checkAuthStatus();

                if (newStatus.isAuthenticated) {
                    setState({ user: newStatus.user, statusMessage: 'Loading...' });
                    const credits = await loadUserCredits();

                    if (credits && credits.tier === 'waitlist') {
                        setState({ view: 'enterInviteCode', statusMessage: '' });
                    } else {
                        setState({ view: 'signedIn', activeTab: 'home', statusMessage: '' });
                    }
                } else {
                    setState({ view: 'signedOut' });
                }
            } catch (error) {
                console.error('[Popup] Token refresh failed:', error);
                setState({ view: 'signedOut' });
            }
        } else {
            setState({ view: 'signedOut' });
        }
    } catch (error) {
        console.error('[Popup] Error checking auth status:', error);
        setState({ view: 'error', errorMessage: 'Failed to check authentication. Please try again.' });
    }
}

async function loadAutoSaveSetting() {
    try {
        const result = await chrome.storage.local.get(['autoSaveEnabled']);
        const isEnabled = result.autoSaveEnabled !== false;
        setState({ autoSaveEnabled: isEnabled });
    } catch (error) {
        console.error('[Popup] Error loading auto-save setting:', error);
    }
}

async function loadUserCredits() {
    try {
        if (!window.apiClient || !appState.user) return null;

        const creditsData = await window.apiClient.makeAuthenticatedRequest(
            `${window.apiClient.API_BASE_URL}/api/credits`,
            { method: 'GET' }
        );

        const credits = {
            tier: creditsData.tier,
            balance: creditsData.credits,
            totalUsed: creditsData.totalUsed,
            costs: creditsData.costs
        };

        setState({ credits });
        return credits;
    } catch (error) {
        console.error('[Popup] Error loading credits:', error);
        return null;
    }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

async function handleGoogleSignIn() {
    try {
        setState({ isProcessing: true, statusMessage: 'Signing in...' });

        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'startGoogleSignIn' }, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(result);
            });
        });

        if (!response || !response.success) {
            throw new Error(response?.error || 'Authentication failed. Please try again.');
        }

        const user = response.user || (await window.apiClient.checkAuthStatus()).user;
        setState({ user, isProcessing: false, statusMessage: 'Loading' });

        const credits = await loadUserCredits();

        if (credits && credits.tier === 'waitlist') {
            setState({ view: 'enterInviteCode', statusMessage: '' });
        } else {
            setState({ view: 'signedIn', activeTab: 'home', statusMessage: '' });
        }
    } catch (error) {
        console.error('[Popup] Error during sign-in:', error);
        setState({ isProcessing: false, errorMessage: error.message || 'Sign-in failed. Please try again.' });
    }
}

async function handleSignOut() {
    try {
        setState({ isProcessing: true, statusMessage: 'Signing out...' });
        await window.apiClient.clearAuth();
        setState({ view: 'signedOut', user: null, isProcessing: false, statusMessage: '' });
    } catch (error) {
        console.error('[Popup] Error during sign-out:', error);
        await window.apiClient.clearAuth();
        setState({ view: 'signedOut', user: null, isProcessing: false });
    }
}

async function handleAutoSaveToggle(isEnabled) {
    try {
        await chrome.storage.local.set({ autoSaveEnabled: isEnabled });
        setState({ autoSaveEnabled: isEnabled });
    } catch (error) {
        console.error('[Popup] Error saving auto-save setting:', error);
    }
}

async function handleImportChatGPTMemory() {
    try {
        setState({ statusMessage: 'Opening ChatGPT settings...' });

        chrome.runtime.sendMessage({ action: 'import_chatgpt_memory' }, (response) => {
            if (response && response.success) {
                setState({ statusMessage: 'Import process started!' });
            } else {
                setState({ statusMessage: 'Check ChatGPT tab for progress' });
            }
            setTimeout(() => setState({ statusMessage: '' }), 2000);
        });
    } catch (error) {
        console.error('[Popup] Error:', error);
        setState({ statusMessage: 'Failed to start import. Please try again.' });
    }
}

async function handleQueryMemory(query) {
    if (!query || query.trim().length < 3) {
        alert('Please enter at least 3 characters');
        return;
    }

    try {
        setState({ queryInProgress: true, queryResults: null });

        if (!appState.user || !appState.user.id) {
            throw new Error('User not authenticated. Please sign in again.');
        }

        const result = await window.apiClient.makeAuthenticatedRequest(
            `${window.apiClient.API_BASE_URL}/api/retrieve`,
            {
                method: 'POST',
                body: JSON.stringify({ user_id: appState.user.id, query: query.trim() })
            }
        );

        const hasContext = result.context && result.context.length > 0 &&
            result.context !== 'NO_RELEVANT_CONTEXT' &&
            !result.context.includes('No relevant context');

        if (result.metadata && result.metadata.creditsRemaining !== undefined) {
            setState({ credits: { ...appState.credits, balance: result.metadata.creditsRemaining } });
        }

        setState({
            queryInProgress: false,
            queryResults: { has_context: hasContext, context: hasContext ? result.context : '', results: result.results || [] }
        });
    } catch (error) {
        console.error('[Popup] Query error:', error);

        if (error.message && error.message.includes('Insufficient credits')) {
            setState({ queryInProgress: false, queryResults: { has_context: false, context: '' } });
            alert('You don\'t have enough credits for this query.');
            return;
        }

        if (error.message && error.message.includes('Account not activated')) {
            setState({ view: 'enterInviteCode', queryInProgress: false });
            return;
        }

        setState({ queryInProgress: false, queryResults: { has_context: false, context: '' } });
        alert('Failed to query memory: ' + error.message);
    }
}

async function handleRedeemInviteCode(code) {
    if (!code || code.trim().length < 4) {
        setState({ inviteCodeError: 'Please enter a valid invite code' });
        return;
    }

    try {
        setState({ isProcessing: true, inviteCodeError: '', statusMessage: '' });

        const result = await window.apiClient.makeAuthenticatedRequest(
            `${window.apiClient.API_BASE_URL}/api/redeem-invite`,
            { method: 'POST', body: JSON.stringify({ invite_code: code.trim().toUpperCase() }) }
        );

        if (result.success) {
            await loadUserCredits();
            setState({ view: 'signedIn', activeTab: 'home', isProcessing: false, statusMessage: '', inviteCodeError: '' });
        } else {
            // Parse clean error message from API response
            const errorMsg = parseErrorMessage(result.error || 'Invalid invite code');
            setState({ isProcessing: false, inviteCodeError: errorMsg });
        }
    } catch (error) {
        console.error('[Popup] Invite code error:', error);
        // Parse clean error message from exception
        const errorMsg = parseErrorMessage(error.message || 'Failed to redeem invite code');
        setState({ isProcessing: false, inviteCodeError: errorMsg });
    }
}

// Helper to extract clean error message from API responses
function parseErrorMessage(rawError) {
    if (!rawError) return 'An error occurred';

    // Try to parse JSON error format like: 'API Error 400: {"error":"Invalid invite code"}'
    const jsonMatch = rawError.match(/\{[^}]+\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.error) return parsed.error;
            if (parsed.message) return parsed.message;
        } catch (e) {
            // Not valid JSON, continue
        }
    }

    // Remove 'API Error XXX: ' prefix if present
    const cleanedMsg = rawError.replace(/^API Error \d+:\s*/i, '');

    return cleanedMsg;
}

async function handleJoinWaitlist() {
    try {
        setState({ isProcessing: true, inviteCodeError: '', statusMessage: '' });

        const result = await window.apiClient.makeAuthenticatedRequest(
            `${window.apiClient.API_BASE_URL}/api/join-waitlist`,
            { method: 'POST' }
        );

        if (result.success) {
            setState({
                isProcessing: false,
                statusMessage: "You're in! We'll reach out soon with your access.",
                waitlistJoined: true
            });
        } else {
            const errorMsg = parseErrorMessage(result.error || 'Could not join waitlist');
            setState({ isProcessing: false, inviteCodeError: errorMsg });
        }
    } catch (error) {
        console.error('[Popup] Waitlist error:', error);
        const errorMsg = parseErrorMessage(error.message || 'Failed to join waitlist. Please try again.');
        setState({ isProcessing: false, inviteCodeError: errorMsg });
    }
}

// ============================================================================
// TESTING EXPORTS
// ============================================================================

if (typeof window !== 'undefined') {
    window.popupGlobals = {
        get appState() { return appState; },
        setState,
        render,
        handleGoogleSignIn,
        handleSignOut,
        handleAutoSaveToggle,
        handleQueryMemory,
        handleRedeemInviteCode,
        handleJoinWaitlist,
        loadUserCredits,
        checkAuthStatus,
        escapeHtml,
        getUserInitials
    };
}
