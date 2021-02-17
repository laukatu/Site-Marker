chrome.tabs.onUpdated.addListener( function (tabId, changeInfo, tab) {
    if (changeInfo.status == 'complete') {
        chrome.tabs.query({active: true, currentWindow: true}, tabs => {
            if (tabs[0].url && tabs[0].url.indexOf('chrome://') === -1) {
                let hostname = new URL(tabs[0].url).hostname;

                chrome.storage.sync.get(hostname, function(result) {
                    if (Object.keys(result).length !== 0) {
                        chrome.tabs.executeScript(tabs[0].id, {
                            code: 'var label = ' + JSON.stringify(result[hostname])
                        }, function() {
                            chrome.tabs.executeScript(tabs[0].id, {file: 'badge.js'});
                        });
                    }
                });
            }
        });
    }
})