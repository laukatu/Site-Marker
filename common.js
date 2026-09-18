/**
 * Shared helpers used by the service worker (via importScripts) and the
 * options page (via <script>).
 *
 * Storage schema (chrome.storage.sync), kept compatible with v1.x:
 *   { "<hostname>": "<label>", ... }
 */

const SITE_MARKER_SCRIPT_ID = 'site-marker-badge';

const HOSTNAME_PATTERN = /^[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?(\.[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?)*$/;

/**
 * Turns whatever the user typed ("https://Dev.Example.com:8080/path", "dev.example.com.")
 * into a bare, lowercase hostname. Returns null when no valid hostname can be derived.
 */
function normalizeHostname(input) {
    let value = String(input || '').trim().toLowerCase();
    if (!value) {
        return null;
    }

    if (value.includes('://') || value.includes('/') || value.includes(':')) {
        try {
            const url = new URL(value.includes('://') ? value : 'http://' + value);
            value = url.hostname;
        } catch (error) {
            return null;
        }
    }

    value = value.replace(/\.$/, '');

    return HOSTNAME_PATTERN.test(value) ? value : null;
}

/**
 * Match pattern that covers the hostname on http and https, on any port.
 * See https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
 */
function hostnameToMatchPattern(hostname) {
    return '*://' + hostname + '/*';
}

/** Reads every configured marker as { hostname: label }. */
async function getMarkers() {
    const items = await chrome.storage.sync.get(null);
    const markers = {};

    for (const [hostname, label] of Object.entries(items)) {
        if (typeof label === 'string' && label !== '') {
            markers[hostname] = label;
        }
    }

    return markers;
}

/** Match patterns of the configured hostnames the user has actually granted access to. */
async function getGrantedMatchPatterns() {
    const markers = await getMarkers();
    const granted = [];

    for (const hostname of Object.keys(markers)) {
        const pattern = hostnameToMatchPattern(hostname);
        if (await chrome.permissions.contains({ origins: [pattern] })) {
            granted.push(pattern);
        }
    }

    return granted;
}

/**
 * (Re)registers the badge content script so it only runs on the configured
 * hostnames for which the user has granted host permission.
 */
async function syncContentScripts() {
    const matches = await getGrantedMatchPatterns();
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SITE_MARKER_SCRIPT_ID] });

    if (matches.length === 0) {
        if (existing.length > 0) {
            await chrome.scripting.unregisterContentScripts({ ids: [SITE_MARKER_SCRIPT_ID] });
        }
        return;
    }

    const script = {
        id: SITE_MARKER_SCRIPT_ID,
        matches: matches,
        js: ['badge.js'],
        runAt: 'document_idle',
        persistAcrossSessions: true
    };

    if (existing.length > 0) {
        await chrome.scripting.updateContentScripts([script]);
    } else {
        await chrome.scripting.registerContentScripts([script]);
    }
}
