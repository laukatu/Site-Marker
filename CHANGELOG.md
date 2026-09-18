# Changelog

## 2.0.0 – 2026-09-18

Migration to Manifest V3 so the extension can be published again in the Chrome Web Store.

### Changed
- Manifest V3: background page replaced by a service worker; `chrome.tabs.executeScript` replaced by dynamically registered content scripts (`chrome.scripting`).
- Least-privilege permissions: the blanket `http://*/*`, `https://*/*` and `tabs` permissions are gone. Site access is now requested per configured hostname when you press **Save** and revoked for hostnames you remove.
- Options page rewritten: proper form, validation, add/remove rows, dark mode, hostname normalisation (you can paste a full URL) and a warning for sites that still need permission.
- Badge: pointer events pass through it, white text on red with a subtle shadow, highest z-index.
- Clicking the toolbar icon opens the options page.
- 48 px icon was actually 64 px; fixed.

### Fixed
- The badge was injected into the *active* tab instead of the tab that finished loading, so pages loading in background tabs could get the wrong badge or none at all.
- Duplicate element ids and duplicated `<br>` in the options page.

### Notes for existing users
- Saved markers are kept (same storage format). Open the options page and press **Save** once to grant the per-site permissions.

## 1.0

Initial release (Manifest V2).
