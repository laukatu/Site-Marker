/**
 * Options page. Depends on common.js (loaded first).
 */

const rowsContainer = document.getElementById('rows');
const rowTemplate = document.getElementById('row-template');
const form = document.getElementById('markers-form');
const statusEl = document.getElementById('status');

let statusTimer = null;

function setStatus(message, type = '', timeout = 3000) {
    clearTimeout(statusTimer);
    statusEl.textContent = message;
    statusEl.className = type;

    if (timeout > 0 && message) {
        statusTimer = setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = '';
        }, timeout);
    }
}

function addRow(hostname = '', label = '', focus = false) {
    const fragment = rowTemplate.content.cloneNode(true);
    const row = fragment.querySelector('.row');
    const hostnameInput = row.querySelector('.hostname');
    const labelInput = row.querySelector('.label');

    hostnameInput.value = hostname;
    labelInput.value = label;

    row.querySelector('.del').addEventListener('click', () => {
        row.remove();
        renderEmptyState();
    });

    rowsContainer.appendChild(fragment);
    renderEmptyState();

    if (focus) {
        hostnameInput.focus();
    }

    return row;
}

function renderEmptyState() {
    const existing = rowsContainer.querySelector('.empty');
    const hasRows = rowsContainer.querySelector('.row') !== null;

    if (!hasRows && !existing) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = 'No markers yet. Add one below.';
        rowsContainer.appendChild(empty);
    } else if (hasRows && existing) {
        existing.remove();
    }
}

/**
 * Reads the form synchronously (so that the later permission request still
 * happens inside the user gesture). Returns { markers, errors }.
 */
function readRows() {
    const markers = {};
    const errors = [];

    for (const row of rowsContainer.querySelectorAll('.row')) {
        const hostnameInput = row.querySelector('.hostname');
        const labelInput = row.querySelector('.label');
        const rawHostname = hostnameInput.value.trim();
        const label = labelInput.value.trim();

        hostnameInput.classList.remove('invalid');
        labelInput.classList.remove('invalid');

        // Completely empty rows are ignored.
        if (rawHostname === '' && label === '') {
            continue;
        }

        const hostname = normalizeHostname(rawHostname);

        if (hostname === null) {
            hostnameInput.classList.add('invalid');
            errors.push('"' + rawHostname + '" is not a valid hostname.');
            continue;
        }

        if (label === '') {
            labelInput.classList.add('invalid');
            errors.push('Missing label for ' + hostname + '.');
            continue;
        }

        hostnameInput.value = hostname;
        labelInput.value = label;
        markers[hostname] = label;
    }

    return { markers, errors };
}

async function refreshPermissionBadges() {
    for (const row of rowsContainer.querySelectorAll('.row')) {
        const hostname = normalizeHostname(row.querySelector('.hostname').value);
        const badge = row.querySelector('.permission');

        if (hostname === null) {
            badge.hidden = true;
            continue;
        }

        const allowed = await chrome.permissions.contains({
            origins: [hostnameToMatchPattern(hostname)]
        });
        badge.hidden = allowed;
    }
}

async function saveMarkers(event) {
    event.preventDefault();

    const { markers, errors } = readRows();

    if (errors.length > 0) {
        setStatus(errors[0], 'error', 6000);
        return;
    }

    const hostnames = Object.keys(markers);
    const origins = hostnames.map(hostnameToMatchPattern);

    // Must be the first async call: permissions.request() needs the user gesture.
    let granted = true;
    if (origins.length > 0) {
        try {
            granted = await chrome.permissions.request({ origins });
        } catch (error) {
            console.error('[Site Marker] Permission request failed:', error);
            granted = false;
        }
    }

    // Persist markers without wiping unrelated keys unnecessarily.
    const current = await chrome.storage.sync.get(null);
    const stale = Object.keys(current).filter(key => !(key in markers));

    if (stale.length > 0) {
        await chrome.storage.sync.remove(stale);
    }
    if (hostnames.length > 0) {
        await chrome.storage.sync.set(markers);
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

    // The service worker also syncs on storage/permission changes; doing it
    // here too gives immediate feedback if something goes wrong.
    try {
        await syncContentScripts();
    } catch (error) {
        console.error('[Site Marker] Could not register content script:', error);
        setStatus('Markers saved, but the badge could not be registered: ' + error.message, 'error', 8000);
        await refreshPermissionBadges();
        return;
    }

    await refreshPermissionBadges();

    if (granted) {
        setStatus('Markers saved.', 'ok');
    } else {
        setStatus('Markers saved, but access to the sites was not granted. Press Save again to allow it.', 'error', 8000);
    }
}

async function restoreMarkers() {
    const markers = await getMarkers();

    for (const [hostname, label] of Object.entries(markers)) {
        addRow(hostname, label);
    }

    renderEmptyState();
    await refreshPermissionBadges();
}

document.getElementById('add').addEventListener('click', () => addRow('', '', true));
form.addEventListener('submit', saveMarkers);
document.addEventListener('DOMContentLoaded', restoreMarkers);
