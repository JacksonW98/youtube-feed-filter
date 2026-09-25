// A failed read of the stored counts must never be mistaken for "no counts".
// If it were, the next save would overwrite the user's history with almost
// nothing.
settle();

window.location.pathname = "/";

const card = __makeCard([]);
__setCards([card]);
__setVideoLink(card, "/watch?v=vid1");

THRESHOLD = 5;
PAUSE_TRACKING = false;

const stored = { vid1: { count: 9, updatedAt: Date.now() } };

function respondWith(counts, failed) {
  chrome.runtime.sendMessage = (message, cb) => {
    __sent.push(message);
    chrome.runtime.lastError = failed ? { message: "Could not establish connection." } : null;
    cb(failed ? undefined : { counts });
    chrome.runtime.lastError = null;
  };
}

const savedCounts = () => __sent.filter((m) => m.action === "updateCounts");

// --- the service worker is unreachable ---
countsCache = null;
__sent.length = 0;
respondWith(stored, true);

processVideos();
settle();

check("a failed read leaves the cache empty", countsCache, null);
check("a failed read hides nothing", card.style.display, "");
check("a failed read saves nothing", savedCounts().length, 0);

// --- the next pass retries and succeeds ---
__sent.length = 0;
respondWith(stored, false);

processVideos();
settle();

check("the retry populates the cache", Object.keys(countsCache), ["vid1"]);
check("the retry hides the over-threshold card", card.style.display, "none");
check("the retry preserves the stored count", countsCache.vid1.count >= 9, true);

// --- a genuinely empty store is not treated as a failure ---
countsCache = null;
card.style.display = "";
delete card.dataset.ytExtHidden;
resetProcessedCards();
__sent.length = 0;
respondWith({}, false);

processVideos();
settle();

check("an empty store is cached rather than retried", countsCache !== null, true);
check("an empty store hides nothing", card.style.display, "");
check("an empty store still records the view", savedCounts().length > 0, true);

summary();
