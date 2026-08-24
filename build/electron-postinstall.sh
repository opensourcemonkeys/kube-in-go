#!/bin/sh
# Electron's sandbox helper must be setuid root, otherwise the app aborts at
# startup with "The SUID sandbox helper binary was found, but is not configured
# correctly". electron-builder does this in its own deb postinst; we package the
# app tree with nfpm, so we do it here.
#
# It cannot be done in the contents list: nfpm refuses to override a path already
# supplied by the `tree` entry (content collision), and a non-root build user
# could not set the root ownership anyway. postinstall runs as root.
set -e

SANDBOX=/opt/kube-inspector/chrome-sandbox

if [ -f "$SANDBOX" ]; then
    chown root:root "$SANDBOX"
    chmod 4755 "$SANDBOX"
fi

# Refresh the desktop caches so the launcher entry and the icon appear without a
# re-login. Both tools may be absent on a minimal or non-GTK system, and neither
# should turn a successful install into a failed one — hence the guards and the
# `|| true`, which also keep them out of `set -e`'s reach.
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q /usr/share/applications || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi
