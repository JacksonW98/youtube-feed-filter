// Channel detection and the V / C allow buttons.
settle();

function buttonLabels(card) {
  const c = card.querySelector(".yt-extension-allow-buttons");
  return c ? c.children.map((b) => b.textContent) : [];
}

const avatar = __makeLink("/@RainChannel", "");
const named = __makeLink("/@RainChannel", "Rain Channel");

check("prefers the link carrying the channel name over the avatar link",
  extractChannelInfo(__makeCard([avatar, named])),
  { channelId: "RainChannel", channelName: "Rain Channel" });

check("avatar link alone falls back to the handle",
  extractChannelInfo(__makeCard([avatar])),
  { channelId: "RainChannel", channelName: "RainChannel" });

check("/channel/UC... URLs are supported",
  extractChannelInfo(__makeCard([__makeLink("/channel/UCabc123", "Some Chan")])),
  { channelId: "UCabc123", channelName: "Some Chan" });

check("no channel link yields null", extractChannelInfo(__makeCard([])), null);
check("a /watch link is not a channel link",
  extractChannelInfo(__makeCard([__makeLink("/watch?v=xyz", "vid")])), null);

// YouTube hydrates the channel row after the thumbnail, so "C" has to be able
// to arrive on a later pass than "V".
const card = __makeCard([]);

ensureAllowButtons(card, "vid1", "A Video", null);
check("first pass adds V only", buttonLabels(card), ["V"]);

card._links = [named];
const late = extractChannelInfo(card);
ensureAllowButtons(card, "vid1", "A Video", late);
check("C is back-filled once the channel row renders", buttonLabels(card), ["V", "C"]);

ensureAllowButtons(card, "vid1", "A Video", late);
ensureAllowButtons(card, "vid1", "A Video", late);
check("repeat passes do not duplicate C", buttonLabels(card), ["V", "C"]);

__sent.length = 0;
const cBtn = card.querySelector(".yt-extension-allow-channel");
cBtn.handlers.click({ preventDefault() {}, stopPropagation() {} });
check("C sends the channel allowlist message", __sent[0], {
  action: "addAllowlistChannel",
  channelId: "RainChannel",
  channelName: "Rain Channel"
});
check("C disables itself after use", cBtn.disabled, true);

// YouTube recycles card elements while scrolling; stale buttons would
// allowlist whichever video the card previously showed.
__sent.length = 0;
ensureAllowButtons(card, "vid2", "Second Video", null);
check("a recycled card rebuilds its buttons", buttonLabels(card), ["V"]);
check("the container tracks the new video id",
  card.querySelector(".yt-extension-allow-buttons").dataset.ytExtVideoId, "vid2");

card.querySelector(".yt-extension-allow-video")
  .handlers.click({ preventDefault() {}, stopPropagation() {} });
check("V uses the new video id", __sent[0], {
  action: "addAllowlistVideo",
  videoId: "vid2",
  videoName: "Second Video"
});

check("only one button container exists per card",
  card.querySelectorAll(".yt-extension-allow-buttons").length, 1);

summary();
