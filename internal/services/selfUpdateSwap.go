package services_k8sclient

import (
	"fmt"
	"strings"
)

// This file is deliberately not _darwin.go even though only the darwin
// installer uses it. Rendering the swap script is pure string work, and the
// script itself only ever executes on a machine where the app has already quit
// — a syntax error in it is invisible until an update silently does nothing.
// Keeping it platform-neutral means `sh -n` can check it on every CI run.

// swapHelperScript renders the detached swap script.
//
// Kept as a pure function so a test can render it and run `sh -n` over it: this
// script only ever executes on a machine where the app has already quit, so a
// syntax error in it is invisible until an update silently does nothing.
//
// It moves rather than copies. The original used `ditto`, which *merges*: files
// deleted between two releases stayed in the installed app forever. Both mv
// operands are siblings in the same directory, so the first is a rename(2) —
// atomic, no copy, no time proportional to a ~500 MB bundle — and the only
// window with no app at the target is between the two moves. If the second move
// fails the first is undone.
func swapHelperScript(logPath string, ownPID, parentPID int, staged, target, tmpDir string) string {
	return fmt.Sprintf(`#!/bin/sh
# Detached bundle swap. This runs after the app has already quit, so it cannot
# report anything back in-process — this log file is its only channel, and the
# app reads it on the next launch.
exec >>%[1]s 2>&1
echo "--- $(date -u '+%%Y-%%m-%%dT%%H:%%M:%%SZ') apply-update: %[4]s -> %[5]s"

# macOS maps the running executable and its frameworks out of the bundle, so a
# swap while anything is still alive crashes the app mid-copy. Wait for both the
# sidecar and the shell's main process: the parent holds the bundle open, and
# the sidecar is killed early in the shell's own shutdown.
#
# A pid of 1 or less means the process was already reparented away; waiting on
# it would either be a no-op or block on init forever.
wait_pid() {
  [ "$1" -gt 1 ] 2>/dev/null || return 0
  i=0
  while kill -0 "$1" 2>/dev/null && [ $i -lt 600 ]; do
    sleep 0.1
    i=$((i+1))
  done
  if kill -0 "$1" 2>/dev/null; then
    echo "warning: pid $1 is still running after 60s; continuing anyway"
  fi
}

wait_pid %[2]d
wait_pid %[3]d
sleep 2

OLD=%[5]s.old
rm -rf "$OLD"

if [ -d %[5]s ]; then
  if ! mv %[5]s "$OLD"; then
    echo "error: could not move the installed app aside; nothing was changed"
    exit 1
  fi
fi

if ! mv %[4]s %[5]s; then
  echo "error: could not move the new version into place; restoring the old one"
  if [ -d "$OLD" ]; then
    mv "$OLD" %[5]s || echo "error: the restore failed too - reinstall from https://kubeinspector.com/downloads/"
  fi
  exit 1
fi

rm -rf "$OLD"

# The download came from the network, so Gatekeeper flagged the whole tree.
/usr/bin/xattr -dr com.apple.quarantine %[5]s || echo "warning: could not clear the quarantine attribute"

if ! /usr/bin/open %[5]s; then
  echo "error: the new version is installed but could not be launched"
  exit 1
fi

echo "apply-update: ok"
rm -rf %[6]s
`,
		shellQuote(logPath),
		ownPID,
		parentPID,
		shellQuote(staged),
		shellQuote(target),
		shellQuote(tmpDir))
}

// shellQuote wraps s in single quotes for /bin/sh. Paths here contain a space
// ("Kube Inspector.app") and are otherwise app-controlled.
func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}
