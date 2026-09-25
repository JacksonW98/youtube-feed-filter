// Allowlist storage, broadcasts, and backup normalisation.
settle();

const KEPT_VIDEO = [{ id: "vid1", name: "Kept Video" }];

function reset() {
  __seed({
    allowlistedVideos: [{ id: "vid1", name: "Kept Video" }],
    allowlistedChannels: [{ id: "UCa", name: "Chan A" }, { id: "UCb", name: "Chan B" }]
  });
  __broadcasts.length = 0;
  allowlistedVideos = null;
  allowlistedChannels = null;
}

// Clearing one list from a cold cache must not blank the other: the broadcast
// tells open tabs what the allowlists are now.
reset();
clearAllowlist("channel");
settle();
check("channels are cleared in storage", __store.allowlistedChannels, []);
check("videos are left alone in storage", __store.allowlistedVideos, KEPT_VIDEO);

let last = __broadcasts[__broadcasts.length - 1];
check("the broadcast is an allowlist update", last.action, "allowlistUpdated");
check("the broadcast reports no channels", last.channels, []);
check("the broadcast still reports the videos", last.videos, KEPT_VIDEO);

reset();
const before = __broadcasts.length;
clearAllowlist("bogus");
settle();
check("an unknown list type broadcasts nothing", __broadcasts.length - before, 0);
check("an unknown list type changes nothing", __store.allowlistedVideos, KEPT_VIDEO);

reset();
clearAllowlist("video");
settle();
check("videos are cleared in storage", __store.allowlistedVideos, []);
check("channels survive clearing videos", __store.allowlistedChannels.length, 2);

// Adding to one list must likewise preserve the other in the broadcast.
__seed({ allowlistedVideos: [], allowlistedChannels: [{ id: "UCa", name: "Chan A" }] });
__broadcasts.length = 0;
allowlistedVideos = null;
allowlistedChannels = null;
addAllowlistVideo("vid9", "New Video");
settle();
last = __broadcasts[__broadcasts.length - 1];
check("adding a video keeps channels in the broadcast", last.channels, [{ id: "UCa", name: "Chan A" }]);
check("the video is stored", __store.allowlistedVideos, [{ id: "vid9", name: "New Video" }]);

// Message routing.
reset();
const fn = __listener();
let responded = null;
const isAsync = fn({ action: "clearAllowlist", type: "channel" }, {}, (r) => { responded = r; });
settle();
check("the handler keeps the channel open for an async reply", isAsync, true);
check("the handler replies", responded, { success: true });

// Backup normalisation.
check("the threshold is clamped to its slider range",
  [normalizeThreshold(0), normalizeThreshold(99), normalizeThreshold("7"), normalizeThreshold("x")],
  [1, 20, 7, 5]);
check("decay days are clamped to their slider range",
  [normalizeDecayDays(-5), normalizeDecayDays(99), normalizeDecayDays("3"), normalizeDecayDays(null)],
  [0, 30, 3, 0]);

const imported = parseImportPayload({
  data: {
    videoCounts: { good: { count: 3, updatedAt: 1000 }, zero: { count: 0 }, junk: "nope" },
    threshold: 999,
    allowlistedVideos: ["bare-string-id"],
    pauseAll: true
  }
});
check("importing drops non-positive and malformed counts",
  Object.keys(imported.videoCounts), ["good"]);
check("importing clamps the threshold", imported.threshold, 20);
// Legacy backups stored bare id strings. They are upgraded to objects and get
// a generic label, since no name was ever recorded for them.
check("importing upgrades bare string allowlist entries",
  imported.allowlistedVideos, [{ id: "bare-string-id", name: "Video" }]);
check("importing expands legacy pauseAll into both toggles",
  [imported.pauseTracking, imported.pauseBlocking], [true, true]);

// The popup now asks the service worker to build backups, so the payload has
// to be normalised here rather than dumped raw from storage.
__seed({
  videoCounts: { legacy: 4, good: { count: 2, updatedAt: 500 }, junk: { count: -1 } },
  threshold: 999,
  decayDays: -3,
  pauseTracking: 1,
  allowlistedChannels: ["UCbare"]
});

let exported = null;
__listener()({ action: "exportData" }, {}, (r) => { exported = r; });
settle();

check("the export declares its schema version", exported.backup.schemaVersion, 2);
check("the export drops malformed counts",
  Object.keys(exported.backup.data.videoCounts).sort(), ["good", "legacy"]);
check("the export upgrades legacy numeric counts",
  exported.backup.data.videoCounts.legacy.count, 4);
check("the export clamps an out-of-range threshold", exported.backup.data.threshold, 20);
check("the export clamps negative decay days", exported.backup.data.decayDays, 0);
check("the export coerces pause flags to booleans", exported.backup.data.pauseTracking, true);
check("the export upgrades bare allowlist ids",
  exported.backup.data.allowlistedChannels, [{ id: "UCbare", name: "Channel" }]);

summary();
