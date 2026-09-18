/**
 * Content script. Injected (after common.js) on the sites the user configured
 * and granted access to. Picks the most specific marker for the current URL
 * and renders the badge, the optional frame, the tab title prefix and the
 * toolbar icon badge.
 *
 * Re-injecting it (e.g. from the popup after a change) re-renders cleanly.
 */
(async () => {
    const S = window.SiteMarker;
    if (!S) {
        return;
    }

    const state = window.__siteMarkerState || (window.__siteMarkerState = {
        host: null,
        titleObserver: null,
        prefix: ''
    });

    // Clean up whatever a previous run left behind.
    if (state.host) {
        state.host.remove();
        state.host = null;
    }
    if (state.titleObserver) {
        state.titleObserver.disconnect();
        state.titleObserver = null;
    }
    if (state.prefix && document.title.startsWith(state.prefix)) {
        document.title = document.title.slice(state.prefix.length);
    }
    state.prefix = '';

    let markers;
    let settings;
    try {
        [markers, settings] = await Promise.all([S.getMarkers(), S.getSettings()]);
    } catch (error) {
        return;
    }

    const marker = S.pickMarker(markers, window.location);

    if (!marker) {
        notifyIcon(null);
        return;
    }

    render(marker);
    if (settings.showInTitle) {
        prefixTitle(marker);
    }
    notifyIcon(settings.showOnIcon ? marker : null);

    /* ------------------------------------------------------------------ */

    function render(marker) {
        const sizes = {
            small: { font: 11, height: 18, padding: 8 },
            medium: { font: 13, height: 22, padding: 12 },
            large: { font: 16, height: 30, padding: 16 }
        };
        const size = sizes[marker.size] || sizes.medium;
        const textColor = S.contrastColor(marker.color);
        const [vertical, horizontal] = marker.position.split('-');

        const host = document.createElement('div');
        host.id = S.HOST_ELEMENT_ID;
        host.setAttribute('data-site-marker', marker.label);
        host.style.cssText = [
            'all: initial',
            'position: fixed',
            'inset: 0',
            'z-index: 2147483647',
            'pointer-events: none',
            'display: block',
            'visibility: visible',
            'opacity: 1'
        ].map(rule => rule + ' !important').join('; ');

        const shadow = host.attachShadow({ mode: 'closed' });

        const style = document.createElement('style');
        style.textContent = `
            :host { all: initial; }
            .badge {
                position: fixed;
                ${vertical}: 0;
                ${horizontal}: 0;
                box-sizing: border-box;
                min-width: 10vw;
                height: ${size.height}px;
                padding: 0 ${size.padding}px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: ${marker.color};
                color: ${textColor};
                font: 700 ${size.font}px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                white-space: nowrap;
                pointer-events: none;
                user-select: none;
                border-${vertical === 'top' ? 'bottom' : 'top'}-${horizontal === 'left' ? 'right' : 'left'}-radius: 4px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
            }
            .frame {
                position: fixed;
                inset: 0;
                box-sizing: border-box;
                border: ${size.height >= 30 ? 6 : 4}px solid ${marker.color};
                pointer-events: none;
            }
        `;
        shadow.appendChild(style);

        if (marker.frame) {
            const frame = document.createElement('div');
            frame.className = 'frame';
            shadow.appendChild(frame);
        }

        const badge = document.createElement('div');
        badge.className = 'badge';
        badge.setAttribute('role', 'status');
        badge.textContent = marker.label;
        shadow.appendChild(badge);

        (document.body || document.documentElement).prepend(host);
        state.host = host;
    }

    function prefixTitle(marker) {
        const prefix = '[' + marker.label + '] ';
        state.prefix = prefix;

        const apply = () => {
            if (state.prefix === prefix && !document.title.startsWith(prefix)) {
                document.title = prefix + document.title;
            }
        };

        apply();

        const target = document.querySelector('title') || document.head || document.documentElement;
        state.titleObserver = new MutationObserver(apply);
        state.titleObserver.observe(target, { childList: true, subtree: true, characterData: true });
    }

    function notifyIcon(marker) {
        try {
            chrome.runtime.sendMessage({
                type: S.MESSAGE_ACTIVE,
                label: marker ? marker.label : null,
                color: marker ? marker.color : null
            }).catch(() => {});
        } catch (error) {
            // Extension context gone (e.g. reloaded); nothing to do.
        }
    }
})();
