# Site Marker – Privacy Policy

_Last updated: 2026-09-18_

Site Marker is a browser extension that displays a visual badge on websites chosen by the user.

## Data the extension handles

- **The markers you configure** (hostname, optional port and path, label, color and display options) and the extension settings. They are stored using Chrome's `chrome.storage.sync` API, which keeps them in your browser profile and, if you are signed in to Chrome with sync enabled, in your Google account so they are available on your other devices. They are never sent to the developer or to any third party.
- **The URL of the current tab**, read only while you have the toolbar popup open, to prefill the form with the hostname. It is not stored unless you save a marker for it.
- **JSON files you export or import** stay on your device; export creates a file you download, import reads a file you choose.

## Data the extension does not handle

- It does not collect browsing history, page content, form data, credentials or any personal information.
- It does not make network requests of any kind.
- It does not use analytics, tracking or advertising services.
- It does not load or execute remote code.

## Permissions

- `storage`: to save your markers and settings.
- `scripting`: to run the badge script on the sites you configured and to show the badge immediately after marking a site from the popup.
- `activeTab`: to read the current tab's URL while the popup is open.
- Optional host permissions: the extension asks for access to each configured host when you save, and only to those hosts. Access to hosts you remove is revoked automatically.

## Contact

Laukatu Desarrollo Web S.L. – https://laukatu.com/
