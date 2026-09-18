/**
 * Toolbar popup: quick add / remove for the current tab, with presets and a
 * suggestion derived from the hostname. Depends on common.js.
 */
(async () => {
    const S = SiteMarker;
    S.localizeDocument();

    const views = {
        unsupported: document.getElementById('view-unsupported'),
        marked: document.getElementById('view-marked'),
        form: document.getElementById('view-form')
    };
    const targetInput = document.getElementById('target');
    const wildcardWrap = document.getElementById('wildcard-wrap');
    const wildcardInput = document.getElementById('wildcard');
    const labelInput = document.getElementById('label');
    const colorInput = document.getElementById('color');
    const presetsEl = document.getElementById('presets');
    const suggestedEl = document.getElementById('suggested');
    const statusEl = document.getElementById('status');

    let tab = null;
    let url = null;
    let current = null;
    let labelFromPreset = true;

    document.getElementById('manage').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
        window.close();
    });

    function show(name) {
        for (const [key, el] of Object.entries(views)) {
            el.hidden = key !== name;
        }
    }

    function setStatus(message, type = '') {
        statusEl.textContent = message;
        statusEl.className = 'status ' + type;
    }

    function applyPreset(preset) {
        colorInput.value = preset.color;
        if (labelFromPreset || labelInput.value.trim() === '') {
            labelInput.value = S.presetLabel(preset);
            labelFromPreset = true;
        }
    }

    function renderPresets() {
        presetsEl.textContent = '';
        for (const preset of S.PRESETS) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'preset';
            button.style.background = preset.color + '22';
            button.style.borderColor = preset.color;
            const dot = document.createElement('span');
            dot.className = 'dot';
            dot.style.background = preset.color;
            button.appendChild(dot);
            button.appendChild(document.createTextNode(S.presetLabel(preset)));
            button.addEventListener('click', () => {
                labelFromPreset = labelFromPreset || labelInput.value.trim() === '';
                applyPreset(preset);
            });
            presetsEl.appendChild(button);
        }
    }

    async function reinjectBadge() {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['common.js', 'badge.js']
            });
        } catch (error) {
            // No permission yet or page not scriptable; the badge appears on next load.
        }
    }

    function renderMarked(marker) {
        current = marker;
        document.getElementById('marked-site').textContent = S.targetToString(marker);
        const chip = document.getElementById('marked-chip');
        chip.textContent = marker.label;
        chip.style.background = marker.color;
        chip.style.color = S.contrastColor(marker.color);
        show('marked');
    }

    function renderForm() {
        current = null;
        const hostname = url.hostname;
        const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.startsWith('[');
        targetInput.value = hostname + (url.port ? ':' + url.port : '');
        wildcardWrap.hidden = isIp || !hostname.includes('.');
        wildcardInput.checked = false;
        labelInput.value = '';
        labelFromPreset = true;
        colorInput.value = S.DEFAULT_COLOR;
        renderPresets();

        const suggestion = S.suggestPreset(hostname);
        if (suggestion) {
            applyPreset(suggestion);
            suggestedEl.textContent = S.t('popupSuggested', [S.presetLabel(suggestion)]);
            suggestedEl.hidden = false;
        } else {
            suggestedEl.hidden = true;
        }

        setStatus('');
        show('form');
        labelInput.focus();
        labelInput.select();
    }

    labelInput.addEventListener('input', () => {
        labelFromPreset = false;
    });

    document.getElementById('mark-form').addEventListener('submit', async (event) => {
        event.preventDefault();

        let raw = targetInput.value.trim();
        if (wildcardInput.checked && !wildcardWrap.hidden && !raw.startsWith('*.')) {
            raw = '*.' + raw;
        }
        const target = S.parseTarget(raw);
        if (!target) {
            targetInput.classList.add('invalid');
            setStatus(S.t('invalidTarget', [raw]), 'error');
            return;
        }
        targetInput.classList.remove('invalid');

        const label = labelInput.value.trim();
        if (!label) {
            labelInput.classList.add('invalid');
            setStatus(S.t('missingLabel', [S.targetToString(target)]), 'error');
            return;
        }
        labelInput.classList.remove('invalid');

        // First await: permissions.request() must run inside the user gesture.
        let granted = false;
        try {
            granted = await chrome.permissions.request({ origins: [S.originPattern(target)] });
        } catch (error) {
            console.error('[Site Marker] Permission request failed:', error);
        }

        let marker;
        try {
            marker = await S.upsertMarker(S.createMarker(Object.assign({ label, color: colorInput.value }, target)));
        } catch (error) {
            setStatus(S.t('saveError', [error.message]), 'error');
            return;
        }

        if (granted) {
            await reinjectBadge();
            renderMarked(marker);
        } else {
            renderMarked(marker);
            setStatus(S.t('popupPermissionDenied'), 'error');
        }
    });

    document.getElementById('remove').addEventListener('click', async () => {
        if (!current) {
            return;
        }
        try {
            await S.deleteMarker(current.id);
        } catch (error) {
            return;
        }
        await reinjectBadge();
        renderForm();
    });

    /* ---------------------------------------------------------- bootstrap */

    try {
        [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        url = new URL(tab.url || '');
    } catch (error) {
        url = null;
    }

    if (!tab || !url || !/^https?:$/.test(url.protocol)) {
        show('unsupported');
        return;
    }

    await S.migrate().catch(() => {});
    const markers = await S.getMarkers();
    const marker = S.pickMarker(markers, url);

    if (marker) {
        renderMarked(marker);
    } else {
        renderForm();
    }
})();
