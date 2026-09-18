# Site Marker

Chrome extension that paints a small, always-visible badge (for example **DEV**, **STAGING**, **PRE**) on the websites you configure, so you never confuse a development or staging environment with production.

## How it works

1. Open the extension options (click the toolbar icon, or go to `chrome://extensions` → Site Marker → *Details* → *Extension options*).
2. Add one row per environment: the **hostname** (e.g. `dev.example.com`, `localhost`, `192.168.1.10`) and the **label** to display.
3. Press **Save**. Chrome asks you to allow Site Marker on those sites only. Accept, and the badge appears on the next page load.

Hostnames match on any port and on both `http` and `https`. Markers are stored with `chrome.storage.sync`, so they follow your Chrome profile across devices. On a new device you need to open the options page and press **Save** once to grant the site permissions there.

## Privacy and permissions

Site Marker follows the least-privilege model of Manifest V3:

| Permission | Why |
| --- | --- |
| `storage` | Saves the hostname → label list in your Chrome sync storage. |
| `scripting` | Registers the badge content script only for the hostnames you configured. |
| `optional_host_permissions` (`*://*/*`, i.e. http and https) | Lets you grant access to specific sites at runtime. Nothing is granted at install time; permissions for removed hostnames are revoked automatically. |

The extension makes no network requests, loads no remote code, and collects no data. See [PRIVACY.md](PRIVACY.md).

## Development

There is no build step. Load the folder as an unpacked extension:

1. Go to `chrome://extensions` and enable *Developer mode*.
2. Click *Load unpacked* and select this folder.

Files:

- `manifest.json` – Manifest V3 declaration.
- `background.js` – service worker; keeps the registered content script in sync with the saved markers and granted permissions.
- `common.js` – helpers shared by the service worker and the options page.
- `badge.js` – content script that renders the badge.
- `options.html`, `options.css`, `options.js` – options page.

### Packaging for the Chrome Web Store

```bash
./scripts/package.sh
```

This creates `dist/site-marker-<version>.zip` containing only the files the extension needs. Upload that zip in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

### Chrome Web Store checklist

When filling in the store listing:

- **Single purpose:** "Displays a visual badge on user-selected websites to tell environments (dev, staging, production) apart."
- **Permission justifications:**
  - `storage`: stores the user's hostname/label list.
  - `scripting`: registers the badge content script only on the hostnames the user configured.
  - Host permissions (optional, `*://*/*`): requested at runtime, per site, when the user saves a marker; needed to inject the badge on those sites.
- **Remote code:** No, all code is bundled in the package.
- **Data usage:** no user data is collected or transmitted. Link to `PRIVACY.md` (e.g. the GitHub page) as the privacy policy.
- Upload `dist/site-marker-<version>.zip` and bump `version` in `manifest.json` for every new upload.

## License

MIT © Laukatu Desarrollo Web S.L. See [LICENSE](LICENSE).
