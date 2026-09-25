#!/bin/sh
# Static checks that do not need a browser.
#
#   sh tools/lint.sh
#
# Exits non-zero if anything fails, so it pairs with tests/run.sh.

set -u

cd "$(dirname "$0")/.." || exit 1

JSC="${JSC:-/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc}"
status=0

fail() { echo "  FAIL  $1"; status=1; }
ok()   { echo "  ok    $1"; }

echo "syntax"
if [ -x "$JSC" ]; then
  for f in content.js background.js popup.js allowlist-manager.js; do
    if "$JSC" -e "new Function(readFile('$f'))" >/dev/null 2>&1; then ok "$f"; else fail "$f does not parse"; fi
  done
else
  echo "  skipped (no JavaScriptCore at $JSC)"
fi

echo "manifest"
python3 - <<'PY' || status=1
import json, os, sys

bad = []
try:
    m = json.load(open("manifest.json"))
except Exception as exc:
    print("  FAIL  manifest.json is not valid JSON: %s" % exc)
    sys.exit(1)
print("  ok    valid JSON (%s v%s)" % (m["name"], m["version"]))

for key in ("browser_specific_settings", "applications"):
    if key in m:
        bad.append("Firefox-only key present: %s" % key)

refs = [m["background"]["service_worker"], m["action"]["default_popup"]]
for cs in m.get("content_scripts", []):
    refs += cs.get("js", []) + cs.get("css", [])
refs += [v for v in m.get("icons", {}).values() if isinstance(v, str)]
refs += [v for v in m.get("action", {}).get("default_icon", {}).values() if isinstance(v, str)]

for path in refs:
    if not os.path.exists(path):
        bad.append("referenced file is missing: %s" % path)

for size in ("16", "48", "128"):
    if size not in m.get("icons", {}):
        bad.append("no %spx icon declared" % size)

if m["name"].lower().startswith("youtube"):
    print("  warn  name starts with a third-party trademark; store policy")
    print("        prefers 'X for YouTube' over 'YouTube X'")

for problem in bad:
    print("  FAIL  %s" % problem)
sys.exit(1 if bad else 0)
PY

echo "message plumbing"
grep -o 'message.action === "[a-zA-Z]*"' background.js | sed 's/.*=== "//;s/"//' | sort -u > /tmp/_handled
grep -ho 'action: "[a-zA-Z]*"' popup.js allowlist-manager.js content.js | sed 's/action: "//;s/"//' | sort -u > /tmp/_sent
dead=$(comm -23 /tmp/_handled /tmp/_sent)
broken=$(comm -13 /tmp/_handled /tmp/_sent)
[ -z "$broken" ] && ok "every action sent has a handler" || fail "sent but not handled: $(echo $broken)"
[ -z "$dead" ] && ok "no unused handlers" || fail "handled but never sent: $(echo $dead)"
rm -f /tmp/_handled /tmp/_sent

echo "privacy claims"
if grep -q -e "fetch(" -e "XMLHttpRequest" -e "WebSocket" -e "sendBeacon" content.js background.js popup.js allowlist-manager.js 2>/dev/null; then
  fail "found a network call; the privacy policy says there are none"
else
  ok "no network calls"
fi
if grep -rho "https*://[a-zA-Z0-9./-]*" content.js background.js popup.js allowlist-manager.js | grep -v "^https://$" | grep -q .; then
  fail "found a hard-coded external URL"
else
  ok "no external URLs"
fi

echo "debug output"
if grep -n "console\." content.js background.js popup.js allowlist-manager.js | grep -v "console.log(...args)" | grep -q .; then
  fail "stray console output outside the DEBUG helper"
  grep -n "console\." content.js background.js popup.js allowlist-manager.js | grep -v "console.log(...args)" | sed 's/^/        /'
else
  ok "no stray console output"
fi

echo ""
[ "$status" -eq 0 ] && echo "All checks passed." || echo "Some checks failed."
exit "$status"
