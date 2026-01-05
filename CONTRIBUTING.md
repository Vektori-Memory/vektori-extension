# Contributing to Vektori Memory

Thanks for your interest in contributing! Here's how to get started.

## Quick Start

1. Fork and clone the repository
2. Run `npm install`
3. Load the extension unpacked in Chrome (`chrome://extensions/`)
4. Make your changes
5. Run `npm test` to ensure tests pass
6. Submit a pull request

## What We're Looking For

- **Parser improvements** — Better handling of edge cases in AI platform DOMs
- **New platform support** — Parsers for additional AI chat platforms
- **UI/UX improvements** — Better user experience in popup and side panel
- **Bug fixes** — Especially cross-browser compatibility issues
- **Documentation** — Clearer explanations, more examples

## Pull Request Guidelines

1. Create a feature branch from `main`
2. Keep changes focused — one feature/fix per PR
3. Update tests if you change functionality
4. Include screenshots for UI changes
5. Write a clear PR description

## Code Style

- Use 4-space indentation
- Use meaningful variable names
- Comment complex logic
- Keep functions small and focused

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Questions?

Open an issue or email vektori.cloud@gmail.com
