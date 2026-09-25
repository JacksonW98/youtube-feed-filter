// Every popup control must take effect immediately, in both directions.
settle();

window.location.pathname = "/";

const card = __makeCard([]);
__setCards([card]);
__setVideoLink(card, "/watch?v=vid1");

const send = (message) => { __listener()(message, {}, () => {}); settle(); };
const hidden = () => card.style.display === "none";
const resetCounts = () => { countsCache = { vid1: { count: 9, updatedAt: Date.now() } }; };

resetCounts();
THRESHOLD = 5;
DECAY_DAYS = 0;
PAUSE_BLOCKING = false;
PAUSE_TRACKING = true; // hold counts steady across passes
ALLOWLISTED_VIDEOS = [];
ALLOWLISTED_CHANNELS = [];

processVideos();
settle();
check("baseline: hidden at threshold 5", hidden(), true);

send({ action: "thresholdChanged", threshold: 20 });
check("raising the threshold reveals the card", hidden(), false);
send({ action: "thresholdChanged", threshold: 5 });
check("lowering the threshold hides it again", hidden(), true);

send({ action: "pauseStatesChanged", states: { pauseTracking: true, pauseBlocking: true } });
check("pausing blocking reveals the card", hidden(), false);
send({ action: "pauseStatesChanged", states: { pauseTracking: true, pauseBlocking: false } });
check("resuming blocking hides it again", hidden(), true);

send({ action: "allowlistUpdated", videos: [{ id: "vid1", name: "V" }], channels: [] });
check("allowlisting reveals the card", hidden(), false);
send({ action: "allowlistUpdated", videos: [], channels: [] });
check("removing from the allowlist hides it again", hidden(), true);

send({ action: "thresholdChanged", threshold: 5 });
send({ action: "thresholdChanged", threshold: 5 });
check("re-applying the same threshold is stable", hidden(), true);

// Decay is intentionally lossy: it rewrites stored counts, so turning it off
// cannot restore what already decayed. Only the refresh is asserted here.
resetCounts();
countsCache.vid1.updatedAt = Date.now() - 30 * DAY_MS;
send({ action: "decayDaysChanged", decayDays: 6 });
check("decay dropping the count below the threshold reveals the card", hidden(), false);

// Cards hidden by this extension must survive grid compaction, or nothing
// could ever bring them back without a page reload.
const row = __El("ytd-rich-grid-row");
const grid = __El("ytd-rich-grid-renderer");
grid.appendChild(row);
row.closest = () => grid;

const a = __El("ytd-rich-item-renderer");
const b = __El("ytd-rich-item-renderer");
__setVideoLink(a, "/watch?v=a");
__setVideoLink(b, "/watch?v=b");
row.appendChild(a);
row.appendChild(b);
__setRows([row]);

a.style.display = "none";
a.dataset.ytExtHidden = "true";
compactHomeGrid();
check("compaction keeps a hidden card in the DOM", a.parent === row, true);
check("a row with a survivor stays visible", row.style.display, "");

b.style.display = "none";
b.dataset.ytExtHidden = "true";
compactHomeGrid();
check("a fully hidden row collapses", row.style.display, "none");
check("a collapsed row keeps its cards", [a.parent === row, b.parent === row], [true, true]);

delete b.dataset.ytExtHidden;
b.style.display = "";
compactHomeGrid();
check("the row reopens when a card returns", row.style.display, "");
check("the reopened row clears its marker", row.dataset.ytExtHidden, undefined);

// The fast path runs before the full pass. It must honour the channel
// allowlist too, or an allowlisted channel's videos visibly flicker: hidden
// by the fast path, restored moments later by processVideos.
const chanCard = __makeCard([__makeLink("/@SafeChannel", "Safe Channel")]);
__setCards([chanCard]);
__setVideoLink(chanCard, "/watch?v=vid2");
__setRows([]);

countsCache = { vid2: { count: 9, updatedAt: Date.now() } };
THRESHOLD = 5;
PAUSE_BLOCKING = false;
ALLOWLISTED_VIDEOS = [];
ALLOWLISTED_CHANNELS = [{ id: "SafeChannel", name: "Safe Channel" }];

fastBlockAlreadyBlocked();
settle();
check("the fast path respects the channel allowlist", chanCard.style.display, "");

ALLOWLISTED_CHANNELS = [];
delete chanCard.dataset.ytExtFastChecked;
fastBlockAlreadyBlocked();
settle();
check("the fast path still hides unprotected videos", chanCard.style.display, "none");

summary();
