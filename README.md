# Site Marker

Chrome extension that paints an always-visible badge (for example **DEV**, **STAGING**, **PROD**) on the sites you configure, so you never confuse a development or staging environment with production.

## Features

- **Badge on the page** with your label and color, in any corner, in three sizes, optionally with a colored frame around the whole viewport.
- **Badge in the tab strip**: the label is prefixed to the tab title (`[DEV] My page`) and shown on the toolbar icon, so marked tabs stand out among many open tabs.
- **Precise targets**: hostname, optional port and path prefix, and `*.` subdomain wildcards. `localhost:3000` and `localhost:8080` can carry different labels; `example.com/wp-admin` can be marked on its own.
- **Quick add from the toolbar**: click the icon, the hostname is prefilled and a label and color are suggested from the hostname (`localhost`, `*.local`, `dev.*`, `staging.*`, `pre.*`…). Presets: LOCAL, DEV, TEST, STAGING, PRE, PROD.
- **Import and export** the marker list as JSON to share the same environments with your team.
- **Least privilege**: no site access at install time. Access is requested per host when you save and revoked when you remove the marker.
- Available in English, Spanish, Catalan, French, German, Portuguese and Italian.

## How it works

1. Click the toolbar icon on the site you want to flag, adjust the label and color, and press **Mark this site**. Chrome asks you to allow Site Marker on that host only.
2. For finer control open the options page (from the popup or from `chrome://extensions` → Site Marker → *Extension options*): port, path, subdomains, position, size, frame, tab title and toolbar icon settings, import/export.

Targets accept the forms `dev.example.com`, `*.example.com`, `localhost:3000`, `example.com/wp-admin` and any combination. Hosts without a port match every port. When several markers match a URL, the most specific one wins (exact host over wildcard, then port, then longest path).

Markers are stored with `chrome.storage.sync`, so they follow your Chrome profile across devices. On a new device open the options page and press **Save** once to grant the site permissions there.

## Privacy and permissions

| Permission | Why |
| --- | --- |
| `storage` | Saves your markers and settings in Chrome sync storage. |
| `scripting` | Registers the badge content script only for the hosts you configured and, from the popup, shows the badge on the current tab right away. |
| `activeTab` | Lets the popup read the URL of the current tab to prefill the form. Granted only while you interact with the popup. |
| `optional_host_permissions` (`*://*/*`, i.e. http and https) | Lets you grant access to specific hosts at runtime. Nothing is granted at install time; permissions for removed hosts are revoked automatically. |

The extension makes no network requests, loads no remote code and collects no data. See [PRIVACY.md](PRIVACY.md).

## Development

There is no build step. Load the folder as an unpacked extension:

1. Go to `chrome://extensions` and enable *Developer mode*.
2. Click *Load unpacked* and select this folder.

Files:

- `manifest.json` – Manifest V3 declaration.
- `background.js` – service worker; migrates v1 data, keeps the registered content script in sync with the saved markers and granted permissions, paints the toolbar icon badge.
- `common.js` – shared core: data model, target parsing, matching, storage, migration, import/export.
- `badge.js` – content script that renders the badge, the frame and the tab title prefix inside a closed shadow DOM.
- `popup.html`, `popup.js` – toolbar popup for quick add/remove with suggestions.
- `options.html`, `options.css`, `options.js` – options page.
- `ui.css` – shared styles. `_locales/` – translations.

Storage schema (v2): `schemaVersion`, `settings` and one `marker_<id>` key per marker with `host`, `port`, `path`, `label`, `color`, `position`, `size`, `frame`, `order`. Version 1 data (`{ hostname: label }`) is migrated automatically.

### Packaging for the Chrome Web Store

```bash
./scripts/package.sh
```

This creates `dist/site-marker-<version>.zip` containing only the files the extension needs. Upload that zip in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

### Chrome Web Store checklist

When filling in the store listing:

- **Single purpose:** "Displays a visual badge on user-selected websites to tell environments (dev, staging, production) apart."
- **Permission justifications:**
  - `storage`: stores the user's marker list and settings.
  - `scripting`: registers the badge content script only on the hosts the user configured, and shows the badge on the current tab after marking it from the popup.
  - `activeTab`: reads the current tab's URL when the user opens the popup, to prefill the form.
  - Host permissions (optional, `*://*/*`): requested at runtime, per host, when the user saves a marker; needed to inject the badge on those sites.
- **Remote code:** No, all code is bundled in the package.
- **Data usage:** no user data is collected or transmitted. Link to `PRIVACY.md` (e.g. the GitHub page) as the privacy policy.
- Upload `dist/site-marker-<version>.zip` and bump `version` in `manifest.json` for every new upload.

## License

MIT © Laukatu Desarrollo Web S.L. See [LICENSE](LICENSE).
