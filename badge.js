/**
 * Content script. Injected only on the hostnames configured in the options
 * page. Reads the label for the current hostname and paints the badge.
 */
(async () => {
    const BADGE_ID = 'siteMarker';

    if (document.getElementById(BADGE_ID)) {
        return;
    }

    const hostname = location.hostname;
    const result = await chrome.storage.sync.get(hostname);
    const label = result[hostname];

    if (typeof label !== 'string' || label === '') {
        return;
    }

    const badge = document.createElement('div');
    badge.id = BADGE_ID;
    badge.textContent = label;
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-label', 'Site marker: ' + label);

    Object.assign(badge.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        boxSizing: 'border-box',
        minWidth: '10%',
        height: '1.3rem',
        padding: '0 0.75rem',
        margin: '0',
        zIndex: '2147483647',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e00000',
        color: '#ffffff',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '0.9rem',
        lineHeight: '1',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        pointerEvents: 'none',
        userSelect: 'none',
        borderBottomRightRadius: '4px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)'
    });

    (document.body || document.documentElement).prepend(badge);
})();
