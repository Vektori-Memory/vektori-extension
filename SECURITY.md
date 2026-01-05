# Security Policy

## Reporting Vulnerabilities

**Do not open public issues for security vulnerabilities.**

Email security concerns to: **vektori.cloud@gmail.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We'll respond within 48 hours and keep you updated on the fix.

## Security Model

This is a **frontend client** for Vektori's hosted service.

**What this extension does:**
- Reads AI conversation DOMs on supported platforms
- Sends conversations to Vektori's API (authenticated)
- Stores authentication tokens in `chrome.storage.local`

**What protects you:**
- Google OAuth authentication required
- All API requests require valid JWT tokens
- Server-side rate limiting prevents abuse
- CORS restrictions on the backend
- No sensitive data stored in extension code

## Scope

**In scope:**
- XSS vulnerabilities in extension UI
- Token leakage or improper storage
- DOM parser vulnerabilities
- Authentication bypass

**Out of scope:**
- Backend API vulnerabilities (separate system)
- Third-party AI platform vulnerabilities
- Social engineering attacks

## Supported Versions

Only the latest version receives security updates.
