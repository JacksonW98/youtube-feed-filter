# YouTube Recommendation Frequency Blocker

A Chrome extension that hides videos from the YouTube **home feed** once they
have been recommended more times than a threshold you choose.

Everything stays on your machine. The extension makes no network requests and
contains no analytics.

## Installing locally

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Choose **Load unpacked** and select this folder.
3. Open YouTube's home page.

## How it works

Each time a video appears on your home feed it is counted. Once its count
passes your threshold, the card is hidden.

| Control | What it does |
| --- | --- |
| **Hide threshold** | Appearances a video gets before it is hidden (1-20). |
| **Decay after** | Optionally drop one from every count after N days, so videos that stopped appearing come back. `Disabled` means counts never decay. |
| **Pause tracking** | Stop counting appearances. Already-hidden videos stay hidden. |
| **Pause blocking** | Stop hiding, but keep counting. |
| **Clear video counts** | Wipe all recorded counts. |
| **View allowlist** | Manage videos and channels that are never hidden. |
| **Export / Import data** | Save or restore everything as a JSON file. |

Every thumbnail carries two small buttons in its top-right corner:

- **V** - never hide this video.
- **C** - never hide anything from this channel.

The badge in the top-left of a thumbnail shows how many times you have already
seen that video.

### Scope

Tracking and hiding are deliberately limited to the home feed
(`youtube.com/`). Search results, the watch page sidebar, subscriptions, and
channel pages are left untouched. The content script still loads on every
YouTube page because YouTube is a single-page app: a script injected only at
`/` would never run for someone who lands on a watch page and then navigates
home.

## Development

```sh
sh tests/run.sh        # run the unit tests
sh tools/lint.sh       # static checks: syntax, manifest, message plumbing
python3 tools/make_icons.py   # regenerate icons/
```

### Tests

`tests/` runs `content.js` and `background.js` against a stub DOM and stub
`chrome.*` APIs under JavaScriptCore, which ships with macOS. There is no npm
dependency and nothing to install.

| Suite | Covers |
| --- | --- |
| `content.test.js` | Channel detection, the V/C buttons, recycled cards. |
| `navigation.test.js` | Home-feed-only scope and teardown on navigation. |
| `refresh.test.js` | Every popup control taking effect in both directions. |
| `invalidation.test.js` | Clean shutdown when the extension is reloaded. |
| `counts.test.js` | A failed count read never overwriting stored history. |
| `background.test.js` | Allowlist storage, broadcasts, backup normalisation. |

The stub DOM models only what the extension touches. It is not a browser, so
it cannot confirm that a CSS selector matches real YouTube markup - it checks
the logic built around those selectors.

### Layout

```
manifest.json            extension manifest
content.js               counting, hiding, and the on-thumbnail buttons
background.js            service worker: storage, settings, broadcasts
popup.html / popup.js    the toolbar popup
allowlist-manager.*      the allowlist window
icons/                   generated PNGs
tests/                   unit tests and their runner
tools/                   icon generator and packaging script
```
