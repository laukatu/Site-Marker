/**
 * Service worker (Manifest V3).
 *
 * Its only job is to keep the dynamically registered badge content script in
 * sync with the configured markers and the host permissions the user granted.
 * Registered content scripts persist across browser sessions, so the worker
 * does not need to stay alive while browsing.
 */

importScripts('common.js');

let syncQueue = Promise.resolve();

function scheduleSync() {
    syncQueue = syncQueue
        .then(syncContentScripts)
        .catch(error => console.error('[Site Marker] Could not sync content scripts:', error));
    return syncQueue;
}

chrome.runtime.onInstalled.addListener(scheduleSync);
chrome.runtime.onStartup.addListener(scheduleSync);

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
        scheduleSync();
    }
});

chrome.permissions.onAdded.addListener(scheduleSync);
chrome.permissions.onRemoved.addListener(scheduleSync);

chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});
