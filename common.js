/**
 * Shared helpers used by the service worker (importScripts), the options and
 * popup pages (<script>) and the content script (injected before badge.js).
 *
 * Declared with `var` so that injecting it twice into the same page (e.g. a
 * registered content script plus a manual re-injection from the popup) does
 * not throw a redeclaration error.
 *
 * Storage schema v2 (chrome.storage.sync):
 *   schemaVersion: 2
 *   settings:      { showInTitle, showOnIcon }
 *   marker_<id>:   { id, host, port, path, label, color, position, size, frame, order }
 *
 * v1 stored { "<hostname>": "<label>" } and is migrated by migrate().
 */
var SiteMarker = (function () {
    'use strict';

    const SCRIPT_ID = 'site-marker-badge';
    const HOST_ELEMENT_ID = 'site-marker-host';
    const MARKER_PREFIX = 'marker_';
    const SETTINGS_KEY = 'settings';
    const SCHEMA_KEY = 'schemaVersion';
    const SCHEMA_VERSION = 2;
    const MESSAGE_ACTIVE = 'site-marker:active';

    const HOST_RE = /^[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?(\.[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?)*$/;
    const COLOR_RE = /^#[0-9a-f]{6}$/i;
    const MAX_LABEL_LENGTH = 40;

    const POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const SIZES = ['small', 'medium', 'large'];
    const DEFAULT_COLOR = '#dc2626';

    const PRESETS = [
        { id: 'local', color: '#16a34a' },
        { id: 'dev', color: '#2563eb' },
        { id: 'test', color: '#7c3aed' },
        { id: 'staging', color: '#f59e0b' },
        { id: 'pre', color: '#ea580c' },
        { id: 'prod', color: '#dc2626' }
    ];

    const SETTINGS_DEFAULTS = { showInTitle: true, showOnIcon: true };

    const SUGGESTIONS = [
        [/^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/, 'local'],
        [/\.(local|localhost|test|internal|lan|home)$/, 'local'],
        [/(^|[.-])(dev|devel|develop|development)([.-]|$)/, 'dev'],
        [/(^|[.-])(test|testing|qa|uat|sandbox)([.-]|$)/, 'test'],
        [/(^|[.-])(staging|stage|stg)([.-]|$)/, 'staging'],
        [/(^|[.-])(pre|preprod|preproduction|prepro)([.-]|$)/, 'pre']
    ];

    /* ------------------------------------------------------------------ i18n */

    function t(key, substitutions) {
        try {
            return chrome.i18n.getMessage(key, substitutions) || key;
        } catch (error) {
            return key;
        }
    }

    /** Fills every element with data-i18n* attributes from the locale messages. */
    function localizeDocument(root = document) {
        try {
            document.documentElement.lang = chrome.i18n.getUILanguage();
        } catch (error) {
            // ignore
        }
        root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
        root.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
        root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
        root.querySelectorAll('[data-i18n-aria-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel)); });
    }

    /* --------------------------------------------------------------- targets */

    /**
     * Parses what the user typed into { host, port, path }.
     * Accepts "dev.example.com", "*.example.com", "localhost:3000",
     * "https://Staging.Example.com:8443/admin/", "example.com/wp-admin".
     * Returns null when no valid target can be derived.
     */
    function parseTarget(input) {
        let value = String(input || '').trim().toLowerCase();
        if (!value) {
            return null;
        }

        value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');

        let wildcard = false;
        if (value.startsWith('*.')) {
            wildcard = true;
            value = value.slice(2);
        }

        let url;
        try {
            url = new URL('http://' + value);
        } catch (error) {
            return null;
        }

        const host = url.hostname.replace(/\.$/, '');
        if (!HOST_RE.test(host)) {
            return null;
        }
        if (wildcard && !host.includes('.')) {
            return null;
        }

        let path = url.pathname.replace(/\/+$/, '');
        if (path === '/') {
            path = '';
        }

        return {
            host: (wildcard ? '*.' : '') + host,
            port: url.port,
            path: path
        };
    }

    function targetToString(marker) {
        return marker.host + (marker.port ? ':' + marker.port : '') + (marker.path || '');
    }

    function isWildcardHost(host) {
        return typeof host === 'string' && host.startsWith('*.');
    }

    /**
     * Origin pattern used for host permissions: "*://host/*". Ports are
     * deliberately left out: Chrome rejects a port together with the "*"
     * scheme, and a host permission without port covers every port anyway.
     */
    function originPattern(marker) {
        return '*://' + marker.host + '/*';
    }

    /**
     * Match patterns used for content script registration. They narrow the
     * injection to the port and path prefix of the marker. A port requires an
     * explicit scheme, hence two patterns in that case.
     */
    function matchPatterns(marker) {
        const hostPart = marker.host + (marker.port ? ':' + marker.port : '');
        const pathPart = marker.path ? marker.path + '*' : '/*';
        if (marker.port) {
            return ['http://' + hostPart + pathPart, 'https://' + hostPart + pathPart];
        }
        return ['*://' + hostPart + pathPart];
    }

    /**
     * Returns a specificity score when the marker applies to the location
     * ({ hostname, port, protocol, pathname }), or -1 when it does not.
     */
    function matchScore(marker, loc) {
        const hostname = String(loc.hostname || '').toLowerCase();
        let score = 0;

        if (isWildcardHost(marker.host)) {
            const base = marker.host.slice(2);
            if (hostname !== base && !hostname.endsWith('.' + base)) {
                return -1;
            }
        } else if (hostname !== marker.host) {
            return -1;
        } else {
            score += 100;
        }

        if (marker.port) {
            const effectivePort = loc.port || (loc.protocol === 'https:' ? '443' : '80');
            if (effectivePort !== marker.port) {
                return -1;
            }
            score += 10;
        }

        if (marker.path) {
            const pathname = String(loc.pathname || '/');
            if (!pathname.startsWith(marker.path)) {
                return -1;
            }
            score += marker.path.length;
        }

        return score;
    }

    /** Most specific marker for the location, or null. */
    function pickMarker(markers, loc) {
        let best = null;
        let bestScore = -1;
        for (const marker of markers) {
            const score = matchScore(marker, loc);
            if (score > bestScore) {
                best = marker;
                bestScore = score;
            }
        }
        return best;
    }

    /* --------------------------------------------------------------- markers */

    function newId() {
        try {
            return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        } catch (error) {
            return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        }
    }

    function normalizeColor(color) {
        return typeof color === 'string' && COLOR_RE.test(color) ? color.toLowerCase() : DEFAULT_COLOR;
    }

    /**
     * Returns a clean marker object or null when the raw value is unusable.
     * Unknown or invalid fields fall back to defaults so one bad entry never
     * breaks the others.
     */
    function normalizeMarker(raw, id) {
        if (!raw || typeof raw !== 'object') {
            return null;
        }

        const target = parseTarget(targetToString({
            host: typeof raw.host === 'string' ? raw.host : '',
            port: typeof raw.port === 'string' || typeof raw.port === 'number' ? String(raw.port) : '',
            path: typeof raw.path === 'string' ? raw.path : ''
        }));
        if (!target) {
            return null;
        }

        const label = typeof raw.label === 'string' ? raw.label.trim().slice(0, MAX_LABEL_LENGTH) : '';
        if (!label) {
            return null;
        }

        return {
            id: typeof id === 'string' && id ? id : (typeof raw.id === 'string' && raw.id ? raw.id : newId()),
            host: target.host,
            port: target.port,
            path: target.path,
            label: label,
            color: normalizeColor(raw.color),
            position: POSITIONS.includes(raw.position) ? raw.position : POSITIONS[0],
            size: SIZES.includes(raw.size) ? raw.size : 'medium',
            frame: raw.frame === true,
            order: Number.isFinite(raw.order) ? raw.order : 0
        };
    }

    function createMarker(fields) {
        return normalizeMarker(Object.assign({ id: newId() }, fields));
    }

    function storageGet(keys) {
        return chrome.storage.sync.get(keys);
    }

    async function getMarkers() {
        const items = await storageGet(null);
        const markers = [];

        for (const [key, value] of Object.entries(items)) {
            if (!key.startsWith(MARKER_PREFIX)) {
                continue;
            }
            const marker = normalizeMarker(value, key.slice(MARKER_PREFIX.length));
            if (marker) {
                markers.push(marker);
            }
        }

        markers.sort((a, b) => a.order - b.order);
        return markers;
    }

    async function upsertMarker(marker) {
        const clean = normalizeMarker(marker, marker.id);
        if (!clean) {
            throw new Error('Invalid marker');
        }
        await chrome.storage.sync.set({ [MARKER_PREFIX + clean.id]: clean });
        return clean;
    }

    async function deleteMarker(id) {
        await chrome.storage.sync.remove(MARKER_PREFIX + id);
    }

    /** Replaces the whole marker list, preserving the given order. */
    async function replaceMarkers(markers) {
        const items = await storageGet(null);
        const payload = {};
        const keep = new Set();

        markers.forEach((marker, index) => {
            const clean = normalizeMarker(Object.assign({}, marker, { order: index }), marker.id);
            if (clean) {
                keep.add(MARKER_PREFIX + clean.id);
                payload[MARKER_PREFIX + clean.id] = clean;
            }
        });

        const stale = Object.keys(items).filter(key => key.startsWith(MARKER_PREFIX) && !keep.has(key));
        if (stale.length > 0) {
            await chrome.storage.sync.remove(stale);
        }
        if (Object.keys(payload).length > 0) {
            await chrome.storage.sync.set(payload);
        }
    }

    async function getSettings() {
        const items = await storageGet(SETTINGS_KEY);
        const stored = items[SETTINGS_KEY];
        return Object.assign({}, SETTINGS_DEFAULTS, stored && typeof stored === 'object' ? stored : {});
    }

    async function saveSettings(settings) {
        const clean = {};
        for (const key of Object.keys(SETTINGS_DEFAULTS)) {
            clean[key] = settings[key] !== undefined ? settings[key] === true : SETTINGS_DEFAULTS[key];
        }
        await chrome.storage.sync.set({ [SETTINGS_KEY]: clean });
        return clean;
    }

    /**
     * Converts v1 data ({ hostname: label }) into v2 markers. Idempotent.
     * Invalid legacy keys are dropped instead of breaking the whole list.
     */
    async function migrate() {
        const items = await storageGet(null);
        if (items[SCHEMA_KEY] >= SCHEMA_VERSION) {
            return 0;
        }

        const legacyKeys = Object.keys(items).filter(key =>
            !key.startsWith(MARKER_PREFIX) && key !== SETTINGS_KEY && key !== SCHEMA_KEY
        );
        const payload = { [SCHEMA_KEY]: SCHEMA_VERSION };
        let order = Object.keys(items).filter(key => key.startsWith(MARKER_PREFIX)).length;
        let migrated = 0;

        for (const key of legacyKeys) {
            const target = parseTarget(key);
            const label = items[key];
            if (target && typeof label === 'string' && label.trim() !== '') {
                const marker = createMarker(Object.assign({ label: label, order: order++ }, target));
                if (marker) {
                    payload[MARKER_PREFIX + marker.id] = marker;
                    migrated++;
                }
            }
        }

        await chrome.storage.sync.set(payload);
        if (legacyKeys.length > 0) {
            await chrome.storage.sync.remove(legacyKeys);
        }
        return migrated;
    }

    /* ------------------------------------------------------- permissions/sync */

    async function hasOriginPermission(origin) {
        try {
            return await chrome.permissions.contains({ origins: [origin] });
        } catch (error) {
            console.warn('[Site Marker] Cannot check permission for', origin, error);
            return false;
        }
    }

    /**
     * (Re)registers the badge content script for every marker whose origin
     * the user has granted access to.
     */
    async function syncContentScripts() {
        const markers = await getMarkers();
        const grantedByOrigin = new Map();
        const matches = new Set();

        for (const marker of markers) {
            const origin = originPattern(marker);
            if (!grantedByOrigin.has(origin)) {
                grantedByOrigin.set(origin, await hasOriginPermission(origin));
            }
            if (grantedByOrigin.get(origin)) {
                matchPatterns(marker).forEach(pattern => matches.add(pattern));
            }
        }

        const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });

        if (matches.size === 0) {
            if (existing.length > 0) {
                await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
            }
            return [];
        }

        const script = {
            id: SCRIPT_ID,
            matches: Array.from(matches),
            js: ['common.js', 'badge.js'],
            runAt: 'document_idle',
            persistAcrossSessions: true
        };

        if (existing.length > 0) {
            await chrome.scripting.updateContentScripts([script]);
        } else {
            await chrome.scripting.registerContentScripts([script]);
        }
        return script.matches;
    }

    /* ------------------------------------------------------------ presets/UI */

    function suggestPreset(hostname) {
        const host = String(hostname || '').toLowerCase();
        for (const [pattern, presetId] of SUGGESTIONS) {
            if (pattern.test(host)) {
                return PRESETS.find(preset => preset.id === presetId) || null;
            }
        }
        return null;
    }

    function presetLabel(preset) {
        return t('preset_' + preset.id);
    }

    /** Black or white, whichever reads better on the given background. */
    function contrastColor(hex) {
        const color = normalizeColor(hex).slice(1);
        const r = parseInt(color.slice(0, 2), 16) / 255;
        const g = parseInt(color.slice(2, 4), 16) / 255;
        const b = parseInt(color.slice(4, 6), 16) / 255;
        const lin = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
        const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        return luminance > 0.4 ? '#000000' : '#ffffff';
    }

    /* ---------------------------------------------------------- import/export */

    function exportData(markers, settings) {
        return {
            siteMarker: SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            settings: settings,
            markers: markers.map(marker => ({
                host: marker.host,
                port: marker.port,
                path: marker.path,
                label: marker.label,
                color: marker.color,
                position: marker.position,
                size: marker.size,
                frame: marker.frame
            }))
        };
    }

    /** Validates an imported document. Returns { markers, settings } or throws. */
    function parseImport(text) {
        let data;
        try {
            data = JSON.parse(text);
        } catch (error) {
            throw new Error('invalid_json');
        }
        if (!data || typeof data !== 'object' || !Array.isArray(data.markers)) {
            throw new Error('invalid_format');
        }

        const markers = [];
        for (const raw of data.markers) {
            const marker = createMarker(raw || {});
            if (marker) {
                markers.push(marker);
            }
        }

        let settings = null;
        if (data.settings && typeof data.settings === 'object') {
            settings = {};
            for (const key of Object.keys(SETTINGS_DEFAULTS)) {
                if (typeof data.settings[key] === 'boolean') {
                    settings[key] = data.settings[key];
                }
            }
        }

        return { markers, settings };
    }

    return {
        SCRIPT_ID, HOST_ELEMENT_ID, MESSAGE_ACTIVE, SCHEMA_VERSION,
        POSITIONS, SIZES, PRESETS, DEFAULT_COLOR, MAX_LABEL_LENGTH, SETTINGS_DEFAULTS,
        t, localizeDocument,
        parseTarget, targetToString, isWildcardHost, originPattern, matchPatterns, matchScore, pickMarker,
        newId, normalizeMarker, createMarker, getMarkers, upsertMarker, deleteMarker, replaceMarkers,
        getSettings, saveSettings, migrate,
        hasOriginPermission, syncContentScripts,
        suggestPreset, presetLabel, contrastColor,
        exportData, parseImport
    };
})();
