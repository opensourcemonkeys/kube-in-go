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
