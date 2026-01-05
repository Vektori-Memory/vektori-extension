# Vektori Memory

**Cross-LLM Memory Bridge** — Save and search your AI conversations across ChatGPT, Claude, Gemini, Perplexity, DeepSeek, and Grok.

## Features

- **Auto-save conversations** from 6 major AI platforms
- **Semantic search** across all your saved conversations
- **Context injection** — bring relevant memories into new chats
- **Privacy-first** — authentication required, your data stays yours

## Installation

### Chrome Web Store (Recommended)
[Install from Chrome Web Store](https://chromewebstore.google.com/detail/vektori-memory/mmojfknfmidpndjbkakhbmcoghgfkgkg)

### Manual Installation (Development)
1. Clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select this folder
5. Sign in with Google to start saving conversations


## Project Structure

```
├── manifest.json      # Extension configuration
├── background.js      # Service worker (API communication)
├── popup.*            # Extension popup UI
├── sidepanel/         # Side panel for context injection
├── content/           # Content scripts (one per AI platform)
├── parsers/           # DOM parsers (extract conversations)
├── shared/            # Shared utilities (API client, config)
├── styles/            # CSS stylesheets
└── assets/            # Icons and logos
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](SECURITY.md) for our security policy.

## License

MIT License — see [LICENSE](LICENSE)

## Links

- Website: [vektori.cloud](https://vektori.cloud)
- Issues: [GitHub Issues](https://github.com/Vektori-Memory/vektori-memory-extension/issues)
- Email: vektori.cloud@gmail.com
