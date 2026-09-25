// The extension must track and hide only on the home feed, and must clean up
// after itself when the user navigates away.
settle();

const goTo = (path) => { window.location.pathname = path; };

goTo("/");
check("root is the home feed", isHomePage(), true);
goTo("/watch");
check("a watch page is not home", isHomePage(), false);
goTo("/results");
check("search results are not home", isHomePage(), false);
goTo("/feed/subscriptions");
check("the subscriptions feed is not home", isHomePage(), false);
goTo("/@SomeChannel");
check("a channel page is not home", isHomePage(), false);

// A card well over the threshold: any pass would both count and hide it.
const card = __makeCard([]);
card.dataset = {};
__setCards([card]);
__setVideoLink(card, "/watch?v=vid1");

THRESHOLD = 5;
countsCache = { vid1: { count: 9, updatedAt: Date.now() } };

goTo("/watch");
processVideos();
settle();
check("off home: nothing is counted", countsCache.vid1.count, 9);
check("off home: nothing is hidden", card.style.display, "");
check("off home: no buttons are injected",
  card.querySelectorAll(".yt-extension-allow-buttons").length, 0);

fastBlockAlreadyBlocked();
settle();
check("off home: the fast path hides nothing", card.style.display, "");

goTo("/");
processVideos();
settle();
check("on home: the view is counted", countsCache.vid1.count, 10);
check("on home: the card is hidden", card.style.display, "none");
check("on home: the card is marked as ours", card.dataset.ytExtHidden, "true");

goTo("/watch");
runPass();
check("leaving home restores the card", card.style.display, "");
check("leaving home clears the marker", card.dataset.ytExtHidden, undefined);
check("leaving home removes injected UI",
  card.querySelectorAll(".yt-extension-allow-buttons").length, 0);
check("leaving home marks the page inactive", wasActive, false);

// Teardown must happen once, not on every mutation off the home feed.
card.style.display = "none";
runPass();
check("a second off-home pass changes nothing", card.style.display, "none");

card.style.display = "";
goTo("/");
runPass();
settle();
check("returning home reactivates", wasActive, true);
check("returning home hides the card again", card.style.display, "none");

summary();
