#!/bin/sh
# Runs on BOTH removal and upgrade, with two incompatible argument conventions:
#
#   deb  (postrm)  -> $1 is a WORD:  "remove"/"purge" on removal,
#                     "upgrade"/"failed-upgrade"/"abort-*"/"disappear" mid-upgrade
#   rpm  (%postun) -> $1 is a COUNT: 0 on the final erase, >=1 during an upgrade
#
# Bailing out on the upgrade paths is not defensive tidiness, it is the whole
# point of this script. The Linux in-app updater installs with `dpkg -i` /
# `rpm -Uvh` (internal/services/selfUpdate_linux.go), so this runs while the NEW
# version is already on disk. Removing chrome-sandbox there would delete the
# setuid helper that was just installed — and Electron refuses to start without
# it. An unguarded version of this script would brick the app on the first
# self-update.
#
# No `set -e`: a maintainer script that exits non-zero on removal leaves the
# package half-removed and the user with a dpkg error to untangle by hand.

case "${1:-}" in
    upgrade|failed-upgrade|abort-install|abort-upgrade|disappear)
        exit 0 ;;
    ''|*[!0-9]*)
        ;;                      # not a number -> a deb removal word, fall through
    0)
        ;;                      # rpm: last version being erased, fall through
    *)
        exit 0 ;;               # rpm: versions remain -> upgrade
esac

# Belt and braces. dpkg/rpm own chrome-sandbox and remove it themselves; this
# only matters if an earlier removal was interrupted and left the setuid binary
# behind, which is exactly the file you do not want orphaned.
SANDBOX=/opt/kube-inspector/chrome-sandbox
if [ -e "$SANDBOX" ]; then
    chmod 0755 "$SANDBOX" 2>/dev/null || true
    rm -f "$SANDBOX" 2>/dev/null || true
fi
rmdir /opt/kube-inspector 2>/dev/null || true

# Both are absent on minimal and non-desktop systems, and neither is worth
# failing a package removal over.
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q /usr/share/applications 2>/dev/null || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor 2>/dev/null || true
fi

exit 0
