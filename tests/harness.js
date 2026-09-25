// Minimal DOM + chrome.* stubs so content.js can be loaded and exercised
// outside a browser. Run with JavaScriptCore (see tests/run.sh).
//
// This is deliberately not a full DOM. It models only what content.js touches:
// element trees, class/id/tag matching, dataset, inline style, and the handful
// of chrome APIs the extension uses.

globalThis.console = globalThis.console || { log() {} };

// Timers fire immediately so debounced work (scheduleProcessVideos,
// scheduleCountsSave) completes within a test.
globalThis.setTimeout = (fn) => {
  fn();
  return 0;
};
globalThis.clearTimeout = () => {};

globalThis.Event = class {
  constructor(type) {
    this.type = type;
  }
};

if (typeof URL === "undefined") {
  globalThis.URL = class {
    constructor(href, base) {
      let full = href;
      if (!/^https?:\/\//.test(href)) {
        full = (base || "") + (href.startsWith("/") ? href : "/" + href);
      }
      const m = full.match(/^https?:\/\/[^/]+(\/[^?#]*)?/);
      this.pathname = (m && m[1]) || "/";
      this.searchParams = {
        get: (key) => {
          const query = full.split("?")[1] || "";
          for (const pair of query.split("&")) {
            const [k, v] = pair.split("=");
            if (k === key) return v;
          }
          return null;
        }
      };
    }
  };
}

function descendants(node, out = []) {
  for (const child of node.children) {
    out.push(child);
    descendants(child, out);
  }
  return out;
}

function matchesSimple(el, sel) {
  sel = sel.trim();
  if (sel.startsWith(".")) return el.className === sel.slice(1);
  if (sel.startsWith("#")) return el.id === sel.slice(1);
  return el.tag === sel;
}

function El(tag) {
  return {
    tag,
    id: "",
    className: "",
    textContent: "",
    title: "",
    disabled: false,
    href: "",
    dataset: {},
    style: { cssText: "", position: "", background: "", opacity: "", display: "" },
    children: [],
    parent: null,
    get parentElement() {
      return this.parent;
    },
    handlers: {},
    appendChild(child) {
      // Real appendChild moves the node rather than copying it.
      if (child.parent) {
        child.parent.children = child.parent.children.filter((x) => x !== child);
      }
      child.parent = this;
      this.children.push(child);
      return child;
    },
    remove() {
      if (this.parent) {
        this.parent.children = this.parent.children.filter((x) => x !== this);
      }
      this.parent = null;
    },
    addEventListener(type, fn) {
      this.handlers[type] = fn;
    },
    getAttribute() {
      return null;
    },
    querySelector(sel) {
      return descendants(this).find((e) => sel.split(",").some((s) => matchesSimple(e, s))) || null;
    },
    querySelectorAll(sel) {
      return descendants(this).filter((e) => sel.split(",").some((s) => matchesSimple(e, s)));
    }
  };
}

let cards = [];
let rows = [];
let itemsPerRow = 4;
let messageListener = null;
const sentMessages = [];

globalThis.__El = El;
globalThis.__sent = sentMessages;
globalThis.__setCards = (list) => { cards = list; };
globalThis.__setRows = (list) => { rows = list; };
globalThis.__setItemsPerRow = (n) => { itemsPerRow = n; };
globalThis.__listener = () => messageListener;

globalThis.getComputedStyle = () => ({
  position: "static",
  getPropertyValue: (prop) =>
    prop === "--ytd-rich-grid-items-per-row" ? String(itemsPerRow) : ""
});

globalThis.document = {
  createElement: El,
  body: El("body"),
  querySelectorAll(sel) {
    if (sel.includes("data-yt-ext-hidden")) {
      return cards
        .concat(rows)
        .filter((n) => n.dataset.ytExtHidden === "true");
    }
    if (sel.includes("yt-extension-")) {
      const classes = sel.split(",").map((s) => s.trim().replace(".", ""));
      const hits = [];
      for (const card of cards) {
        for (const node of descendants(card)) {
          if (classes.includes(node.className)) hits.push(node);
        }
      }
      return hits;
    }
    if (sel.includes("ytd-rich-grid-row")) return rows.filter((r) => r.parent !== null);
    if (sel.includes("ytd-rich-item-renderer")) return cards;
    return [];
  }
};

globalThis.window = {
  location: { origin: "https://www.youtube.com", pathname: "/watch" },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {}
};

globalThis.MutationObserver = class {
  constructor(fn) { this.fn = fn; }
  observe() {}
  disconnect() {}
};

globalThis.chrome = {
  runtime: {
    id: "test-extension-id",
    lastError: null,
    sendMessage(message, cb) {
      sentMessages.push(message);
      if (cb) cb({});
    },
    onMessage: {
      addListener(fn) { messageListener = fn; }
    }
  },
  storage: {
    local: {
      get(_keys, cb) { cb({}); }
    }
  }
};

// A card with a #thumbnail host, optional channel links, and a /watch link.
globalThis.__makeCard = (links) => {
  const card = El("ytd-rich-item-renderer");
  const thumb = El("div");
  thumb.id = "thumbnail";
  card.appendChild(thumb);
  card._links = links || [];

  const realQSA = card.querySelectorAll.bind(card);
  card.querySelectorAll = (sel) => {
    if (sel.includes("/@") || sel.includes("channel")) return card._links;
    return realQSA(sel);
  };

  return card;
};

globalThis.__setVideoLink = (card, href) => {
  const link = El("a");
  link.href = "https://www.youtube.com" + href;
  card._videoLink = link;

  const realQS = card.querySelector.bind(card);
  card.querySelector = (sel) => {
    if (sel.includes("/watch") || sel.includes("/shorts/")) return card._videoLink;
    return realQS(sel);
  };

  card.closest = () => null;
  return link;
};

globalThis.__makeLink = (href, text) => {
  const a = El("a");
  a.href = href;
  a.textContent = text;
  return a;
};

// --- assertions -----------------------------------------------------------

let passed = 0;
let failed = 0;

globalThis.check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    print("PASS  " + label);
  } else {
    failed++;
    print("FAIL  " + label + "  got=" + a + " want=" + e);
  }
};

globalThis.settle = () => {
  for (let i = 0; i < 40; i++) drainMicrotasks();
};

globalThis.summary = () => {
  print("---- " + passed + " passed, " + failed + " failed");
  if (failed > 0) throw new Error(failed + " assertion(s) failed");
};
