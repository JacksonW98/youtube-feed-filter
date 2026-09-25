// chrome.* stubs for background.js (service worker: promise-style storage,
// callback-style tabs.query).

globalThis.console = globalThis.console || { log() {} };

const store = {};
const broadcasts = [];
let messageListener = null;

globalThis.__store = store;
globalThis.__broadcasts = broadcasts;
globalThis.__listener = () => messageListener;
globalThis.__seed = (data) => {
  for (const key of Object.keys(store)) delete store[key];
  Object.assign(store, data);
};

globalThis.chrome = {
  storage: {
    local: {
      // Chrome supports both the promise and callback forms; background.js
      // uses each in different places.
      get(keys, cb) {
        const out = {};
        for (const key of keys) if (key in store) out[key] = store[key];
        if (cb) { cb(out); return undefined; }
        return Promise.resolve(out);
      },
      set(obj, cb) {
        Object.assign(store, obj);
        if (cb) { cb(); return undefined; }
        return Promise.resolve();
      },
      remove(key) {
        delete store[key];
        return Promise.resolve();
      }
    }
  },
  tabs: {
    query(_q, cb) { cb([{ id: 1 }]); },
    sendMessage(_tabId, message) {
      broadcasts.push(message);
      return Promise.resolve();
    }
  },
  runtime: {
    onMessage: { addListener(fn) { messageListener = fn; } }
  }
};

let passed = 0;
let failed = 0;

globalThis.check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; print("PASS  " + label); }
  else { failed++; print("FAIL  " + label + "  got=" + a + " want=" + e); }
};

globalThis.settle = () => { for (let i = 0; i < 50; i++) drainMicrotasks(); };

globalThis.summary = () => {
  print("---- " + passed + " passed, " + failed + " failed");
  if (failed > 0) throw new Error(failed + " assertion(s) failed");
};
