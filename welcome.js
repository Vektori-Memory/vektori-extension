// Load user info from storage and display greeting
(async function() {
    try {
        const data = await chrome.storage.local.get(['user']);
        if (data.user) {
            const name = data.user.name || data.user.email || 'there';
            document.getElementById('userName').textContent = name;
            document.getElementById('userGreeting').style.display = 'inline-block';
        }
    } catch (e) {
        // Not in extension context, just show generic welcome
        console.log('Not in extension context');
    }
})();
