# Changelog

## 2.0.0 – 2026-09-18

Migration to Manifest V3 so the extension can be published again in the Chrome Web Store.

### Added
- Markers by port and path prefix (`localhost:3000`, `example.com/wp-admin`) and `*.` subdomain wildcards. The most specific marker wins.
- Color per marker with LOCAL / DEV / TEST / STAGING / PRE / PROD presets; text color adapts to the background.
- Badge position (four corners), size (small, medium, large) and an optional colored frame around the viewport.
- The label is prefixed to the tab title (`[DEV] My page`, kept up to date for single-page apps) and shown on the toolbar icon. Both can be turned off in the settings.
- Toolbar popup: mark or unmark the current site in one click, with a label and color suggested from the hostname (`localhost`, `*.local`, `dev.*`, `staging.*`, `pre.*`, `qa.*`…). The badge appears immediately, without reloading.
- Import and export of the marker list as JSON to share with your team.
- Translations: English, Spanish, Catalan, French, German, Portuguese, Italian.

### Changed
- Manifest V3: background page replaced by a service worker; `chrome.tabs.executeScript` replaced by dynamically registered content scripts (`chrome.scripting`).
- Least-privilege permissions: the blanket `http://*/*`, `https://*/*` and `tabs` permissions are gone. Site access is now requested per configured host when you press **Save** (or mark a site from the popup) and revoked for hosts you remove. `activeTab` is used by the popup to read the current URL.
- Storage schema v2: one `marker_<id>` entry per marker plus `settings`. Version 1 data (`{ hostname: label }`) is migrated automatically; malformed legacy entries are dropped instead of breaking the list.
- Options page rewritten: one card per marker with validation, presets, position, size and frame; global settings; import/export; dark mode; a warning for hosts that still need permission.
- Badge rendered inside a closed shadow DOM so page CSS cannot restyle it; pointer events pass through it.
- 48 px icon was actually 64 px; fixed.

### Fixed
- The badge was injected into the *active* tab instead of the tab that finished loading, so pages loading in background tabs could get the wrong badge or none at all.
- Duplicate element ids and duplicated `<br>` in the options page.

### Notes for existing users
- Saved markers are migrated automatically. Open the options page and press **Save** once to grant the per-site permissions.

## 1.0

Initial release (Manifest V2).
