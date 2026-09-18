/**
 * Service worker (Manifest V3).
 *
 * Keeps the dynamically registered badge content script in sync with the
 * saved markers and the host permissions the user granted, migrates v1 data
 * on update and paints the toolbar icon badge for marked tabs.
 */

importScripts('common.js');

let syncQueue = Promise.resolve();

function scheduleSync() {
    syncQueue = syncQueue
        .then(() => SiteMarker.syncContentScripts())
        .catch(error => console.error('[Site Marker] Could not sync content scripts:', error));
    return syncQueue;
}

chrome.runtime.onInstalled.addListener(() => {
    syncQueue = syncQueue
        .then(() => SiteMarker.migrate())
        .catch(error => console.error('[Site Marker] Migration failed:', error));
    scheduleSync();
});

chrome.runtime.onStartup.addListener(scheduleSync);

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
        scheduleSync();
    }
});

chrome.permissions.onAdded.addListener(scheduleSync);
chrome.permissions.onRemoved.addListener(scheduleSync);

chrome.runtime.onMessage.addListener((message, sender) => {
    if (!message || message.type !== SiteMarker.MESSAGE_ACTIVE || !sender.tab || sender.tab.id === undefined) {
        return;
    }

    const tabId = sender.tab.id;

    if (!message.label) {
        chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
        return;
    }

    const text = String(message.label).trim().slice(0, 4).toUpperCase();
    const color = typeof message.color === 'string' ? message.color : SiteMarker.DEFAULT_COLOR;

    chrome.action.setBadgeText({ tabId, text }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(() => {});
    if (chrome.action.setBadgeTextColor) {
        chrome.action.setBadgeTextColor({ tabId, color: SiteMarker.contrastColor(color) }).catch(() => {});
    }
});
