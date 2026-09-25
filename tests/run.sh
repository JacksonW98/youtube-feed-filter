#!/bin/sh
# Runs the extension's unit tests under JavaScriptCore, which ships with macOS.
#
#   sh tests/run.sh
#
# Each test file is executed in a fresh interpreter with a stub DOM and stub
# chrome.* APIs, so module state does not leak between files.

set -u

JSC="${JSC:-/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc}"

if [ ! -x "$JSC" ]; then
  echo "JavaScriptCore not found at: $JSC" >&2
  echo "Set JSC=/path/to/jsc and re-run." >&2
  exit 127
fi

cd "$(dirname "$0")" || exit 1

failures=0

run() {
  harness="$1"
  source_file="$2"
  test_file="$3"

  echo ""
  echo "== $test_file"

  if output=$("$JSC" "$harness" "$source_file" "$test_file" 2>&1); then
    echo "$output" | grep -E '^(FAIL|----)' || true
  else
    echo "$output" | grep -E '^(FAIL|----|Exception)' || echo "$output"
    failures=$((failures + 1))
  fi
}

run harness.js    ../content.js    content.test.js
run harness.js    ../content.js    navigation.test.js
run harness.js    ../content.js    refresh.test.js
run harness.js    ../content.js    invalidation.test.js
run harness.js    ../content.js    counts.test.js
run bg-harness.js ../background.js background.test.js

echo ""
if [ "$failures" -eq 0 ]; then
  echo "All suites passed."
else
  echo "$failures suite(s) failed."
fi

exit "$failures"
