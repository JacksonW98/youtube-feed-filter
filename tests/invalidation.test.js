// Reloading or updating the extension orphans this script in open tabs. It
// must shut down cleanly instead of throwing on every subsequent chrome.* call.
settle();

window.location.pathname = "/";

const card = __makeCard([]);
__setCards([card]);
__setVideoLink(card, "/watch?v=vid1");

THRESHOLD = 5;
PAUSE_TRACKING = true;
countsCache = { vid1: { count: 9, updatedAt: Date.now() } };

processVideos();
settle();
check("setup: the card is hidden", card.style.display, "none");
check("setup: the context is considered alive", isExtensionAlive(), true);

// Chrome drops runtime.id the moment the context dies.
chrome.runtime.id = undefined;
check("a missing runtime.id is detected", isExtensionAlive(), false);

let threw = false;
try {
  sendMessageSafely({ action: "getCounts" }, () => {});
} catch (e) {
  threw = true;
}
check("sending after invalidation does not throw", threw, false);
check("invalidation is latched", extensionInvalidated, true);
check("the hidden card is handed back to YouTube", card.style.display, "");
check("the hidden marker is cleared", card.dataset.ytExtHidden, undefined);
check("injected UI is removed",
  card.querySelectorAll(".yt-extension-allow-buttons").length, 0);

// The callback must still run, so awaiting callers cannot hang forever.
let calledWith = "not called";
sendMessageSafely({ action: "getCounts" }, (r) => { calledWith = r; });
check("the callback still fires, with null", calledWith, null);

// Further passes must stay inert rather than re-hiding with no way back.
processVideos();
settle();
check("processing after invalidation hides nothing", card.style.display, "");

// A context that dies mid-call throws synchronously; that must be caught too.
extensionInvalidated = false;
chrome.runtime.id = "test-extension-id";
chrome.runtime.sendMessage = () => { throw new Error("Extension context invalidated."); };

let threwLate = false;
let lateResult = "not called";
try {
  sendMessageSafely({ action: "getCounts" }, (r) => { lateResult = r; });
} catch (e) {
  threwLate = true;
}
check("a throwing sendMessage is contained", threwLate, false);
check("the callback fires after a mid-call failure", lateResult, null);
check("a mid-call failure latches invalidation", extensionInvalidated, true);

summary();
