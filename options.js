/**
 * Options page. Depends on common.js (loaded first).
 */
(() => {
    const S = SiteMarker;
    S.localizeDocument();

    const listEl = document.getElementById('markers');
    const template = document.getElementById('card-template');
    const form = document.getElementById('markers-form');
    const statusEl = document.getElementById('status');
    const showInTitleEl = document.getElementById('showInTitle');
    const showOnIconEl = document.getElementById('showOnIcon');
    const importFileEl = document.getElementById('import-file');

    let statusTimer = null;

    function setStatus(message, type = '', timeout = 3000) {
        clearTimeout(statusTimer);
        statusEl.textContent = message;
        statusEl.className = 'status ' + type;
        if (timeout > 0 && message) {
            statusTimer = setTimeout(() => {
                statusEl.textContent = '';
                statusEl.className = 'status';
            }, timeout);
        }
    }

    function fillSelect(select, values, prefix) {
        for (const value of values) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = S.t(prefix + value.replace(/-/g, '_'));
            select.appendChild(option);
        }
    }

    function renderPresets(container, colorInput, labelInput) {
        for (const preset of S.PRESETS) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'preset';
            button.title = S.presetLabel(preset);
            button.style.background = preset.color + '22';
            button.style.borderColor = preset.color;
            const dot = document.createElement('span');
            dot.className = 'dot';
            dot.style.background = preset.color;
            button.appendChild(dot);
            button.appendChild(document.createTextNode(S.presetLabel(preset)));
            button.addEventListener('click', () => {
                colorInput.value = preset.color;
                if (labelInput.value.trim() === '') {
                    labelInput.value = S.presetLabel(preset);
                }
            });
            container.appendChild(button);
        }
    }

    function renderEmptyState() {
        const existing = listEl.querySelector('.empty');
        const hasCards = listEl.querySelector('.card') !== null;
        if (!hasCards && !existing) {
            const empty = document.createElement('p');
            empty.className = 'empty';
            empty.textContent = S.t('noMarkers');
            listEl.appendChild(empty);
        } else if (hasCards && existing) {
            existing.remove();
        }
    }

    function addCard(marker = null, focus = false) {
        const fragment = template.content.cloneNode(true);
        const card = fragment.querySelector('.card');
        S.localizeDocument(card);

        const targetInput = card.querySelector('.target');
        const labelInput = card.querySelector('.label');
        const colorInput = card.querySelector('.color');
        const positionSelect = card.querySelector('.position');
        const sizeSelect = card.querySelector('.size');
        const frameInput = card.querySelector('.frame');

        fillSelect(positionSelect, S.POSITIONS, 'pos_');
        fillSelect(sizeSelect, S.SIZES, 'size_');
        renderPresets(card.querySelector('.presets'), colorInput, labelInput);

        card.dataset.id = marker ? marker.id : S.newId();
        targetInput.value = marker ? S.targetToString(marker) : '';
        labelInput.value = marker ? marker.label : '';
        colorInput.value = marker ? marker.color : S.DEFAULT_COLOR;
        positionSelect.value = marker ? marker.position : S.POSITIONS[0];
        sizeSelect.value = marker ? marker.size : 'medium';
        frameInput.checked = marker ? marker.frame : false;

        card.querySelector('.del').addEventListener('click', () => {
            card.remove();
            renderEmptyState();
        });

        listEl.appendChild(fragment);
        renderEmptyState();

        if (focus) {
            targetInput.focus();
        }
        return card;
    }

    function updateCard(card, marker) {
        card.querySelector('.label').value = marker.label;
        card.querySelector('.color').value = marker.color;
        card.querySelector('.position').value = marker.position;
        card.querySelector('.size').value = marker.size;
        card.querySelector('.frame').checked = marker.frame;
    }

    /** Reads the cards synchronously. Returns { markers, errors }. */
    function readCards() {
        const markers = [];
        const errors = [];
        const seen = new Set();

        for (const card of listEl.querySelectorAll('.card')) {
            const targetInput = card.querySelector('.target');
            const labelInput = card.querySelector('.label');
            const rawTarget = targetInput.value.trim();
            const label = labelInput.value.trim();

            targetInput.classList.remove('invalid');
            labelInput.classList.remove('invalid');

            if (rawTarget === '' && label === '') {
                continue;
            }

            const target = S.parseTarget(rawTarget);
            if (!target) {
                targetInput.classList.add('invalid');
                errors.push(S.t('invalidTarget', [rawTarget]));
                continue;
            }

            const targetString = S.targetToString(target);
            targetInput.value = targetString;

            if (label === '') {
                labelInput.classList.add('invalid');
                errors.push(S.t('missingLabel', [targetString]));
                continue;
            }

            if (seen.has(targetString)) {
                targetInput.classList.add('invalid');
                errors.push(S.t('duplicateTarget', [targetString]));
                continue;
            }
            seen.add(targetString);

            markers.push(Object.assign({
                id: card.dataset.id,
                label: label,
                color: card.querySelector('.color').value,
                position: card.querySelector('.position').value,
                size: card.querySelector('.size').value,
                frame: card.querySelector('.frame').checked
            }, target));
        }

        return { markers, errors };
    }

    async function refreshPermissionBadges() {
        for (const card of listEl.querySelectorAll('.card')) {
            const target = S.parseTarget(card.querySelector('.target').value);
            const badge = card.querySelector('.permission');
            badge.hidden = !target || await S.hasOriginPermission(S.originPattern(target));
        }
    }

    async function save(event) {
        event.preventDefault();

        const { markers, errors } = readCards();
        if (errors.length > 0) {
            setStatus(errors[0], 'error', 6000);
            return;
        }

        const origins = Array.from(new Set(markers.map(S.originPattern)));

        // First await: permissions.request() must run inside the user gesture.
        let granted = true;
        if (origins.length > 0) {
            try {
                granted = await chrome.permissions.request({ origins });
            } catch (error) {
                console.error('[Site Marker] Permission request failed:', error);
                granted = false;
            }
        }

        try {
            await S.replaceMarkers(markers);
            await S.saveSettings({
                showInTitle: showInTitleEl.checked,
                showOnIcon: showOnIconEl.checked
            });
        } catch (error) {
            setStatus(S.t('saveError', [error.message]), 'error', 8000);
            return;
        }

        // Drop host permissions that are no longer needed (least privilege).
        try {
            const all = await chrome.permissions.getAll();
            const unused = (all.origins || []).filter(origin => !origins.includes(origin));
            if (unused.length > 0) {
                await chrome.permissions.remove({ origins: unused });
            }
        } catch (error) {
            console.warn('[Site Marker] Could not revoke unused permissions:', error);
        }

        try {
            await S.syncContentScripts();
        } catch (error) {
            console.error('[Site Marker] Could not register content script:', error);
            setStatus(S.t('registerError', [error.message]), 'error', 8000);
            await refreshPermissionBadges();
            return;
        }

        await refreshPermissionBadges();
        setStatus(granted ? S.t('saved') : S.t('savedNoPermission'), granted ? 'ok' : 'error', granted ? 3000 : 8000);
    }

    async function exportMarkers() {
        const [markers, settings] = await Promise.all([S.getMarkers(), S.getSettings()]);
        const data = S.exportData(markers, settings);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'site-marker-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function importMarkers(file) {
        let parsed;
        try {
            parsed = S.parseImport(await file.text());
        } catch (error) {
            setStatus(S.t('importError'), 'error', 6000);
            return;
        }

        const cardsByTarget = new Map();
        for (const card of listEl.querySelectorAll('.card')) {
            const target = S.parseTarget(card.querySelector('.target').value);
            if (target) {
                cardsByTarget.set(S.targetToString(target), card);
            }
        }

        for (const marker of parsed.markers) {
            const key = S.targetToString(marker);
            const existing = cardsByTarget.get(key);
            if (existing) {
                updateCard(existing, marker);
            } else {
                cardsByTarget.set(key, addCard(marker));
            }
        }

        if (parsed.settings) {
            if (parsed.settings.showInTitle !== undefined) showInTitleEl.checked = parsed.settings.showInTitle;
            if (parsed.settings.showOnIcon !== undefined) showOnIconEl.checked = parsed.settings.showOnIcon;
        }

        await refreshPermissionBadges();
        setStatus(S.t('imported', [String(parsed.markers.length)]), 'ok', 8000);
    }

    async function restore() {
        await S.migrate().catch(error => console.error('[Site Marker] Migration failed:', error));
        const [markers, settings] = await Promise.all([S.getMarkers(), S.getSettings()]);

        for (const marker of markers) {
            addCard(marker);
        }
        renderEmptyState();

        showInTitleEl.checked = settings.showInTitle;
        showOnIconEl.checked = settings.showOnIcon;

        await refreshPermissionBadges();
    }

    document.getElementById('add').addEventListener('click', () => addCard(null, true));
    document.getElementById('export').addEventListener('click', exportMarkers);
    document.getElementById('import').addEventListener('click', () => importFileEl.click());
    importFileEl.addEventListener('change', async () => {
        if (importFileEl.files && importFileEl.files[0]) {
            await importMarkers(importFileEl.files[0]);
            importFileEl.value = '';
        }
    });
    form.addEventListener('submit', save);
    document.addEventListener('DOMContentLoaded', restore);
})();
