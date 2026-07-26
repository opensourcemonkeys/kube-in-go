package services_k8sclient

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
)

// PlatformAssetKey returns the manifest "assets" key for this machine. Only an
// arm64 dmg is published — a universal build would have to embed two ~262 MB Go
// binaries (see electron/electron-builder.yml).
func PlatformAssetKey() (key string, kind string) {
	if runtime.GOARCH != "arm64" {
		return "", ""
	}
	return "darwin-arm64", "dmg"
}

// CheckInstallable reports why the in-app updater cannot apply a release here,
// or nil when it can.
func CheckInstallable() error {
	if key, _ := PlatformAssetKey(); key == "" {
		return fmt.Errorf("no installer is published for darwin/%s", runtime.GOARCH)
	}

	bundle, err := runningAppBundle()
	if err != nil {
		return err
	}
	// Replacing the bundle means writing inside its parent directory, so that
	// is the permission that matters — an app in a read-only or admin-owned
	// location cannot update itself without escalation.
	if err := syscall.Access(filepath.Dir(bundle), 0o2 /* W_OK */); err != nil {
		return fmt.Errorf("no permission to replace %s", bundle)
	}
	return nil
}

// runningAppBundle walks up from the executable to the enclosing .app bundle.
// The Go binary ships at <bundle>/Contents/Resources/kube-inspector.
func runningAppBundle() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", errors.New("could not determine the running executable's location")
	}
	for dir := filepath.Dir(exe); dir != "/" && dir != "."; dir = filepath.Dir(dir) {
		if strings.HasSuffix(dir, ".app") {
			return dir, nil
		}
	}
	return "", errors.New("this build is not running from an application bundle")
}

// RunInstaller mounts the dmg, stages the new bundle next to it, and hands the
// swap to a detached helper script.
//
// The swap cannot happen here: macOS maps the running executable and its
// frameworks out of the bundle we would be overwriting, which crashes the app
// mid-copy. So the helper waits for the app to exit first, then replaces the
// bundle and reopens it — which is also why this returns RestartExternal.
func RunInstaller(ctx context.Context, pkgPath, kind string) (string, error) {
	if kind != "dmg" {
		return "", fmt.Errorf("unsupported package kind %q", kind)
	}

	target, err := runningAppBundle()
	if err != nil {
		return "", err
	}

	work := filepath.Join(filepath.Dir(pkgPath), "stage")
	mount := filepath.Join(work, "mnt")
	if err := os.MkdirAll(mount, 0o755); err != nil {
		return "", err
	}

	// An explicit mountpoint avoids having to parse hdiutil's plist output to
	// find where the volume landed.
	if out, err := exec.CommandContext(ctx, "hdiutil", "attach", pkgPath,
		"-nobrowse", "-readonly", "-quiet", "-mountpoint", mount).CombinedOutput(); err != nil {
		return "", fmt.Errorf("could not open the disk image: %v\n%s", err, strings.TrimSpace(string(out)))
	}
	detached := false
	detach := func() {
		if !detached {
			detached = true
			_ = exec.Command("hdiutil", "detach", mount, "-quiet", "-force").Run()
		}
	}
	defer detach()

	apps, err := filepath.Glob(filepath.Join(mount, "*.app"))
	if err != nil || len(apps) == 0 {
		return "", errors.New("the disk image contains no application bundle")
	}

	staged := filepath.Join(work, filepath.Base(apps[0]))
	_ = os.RemoveAll(staged)
	if out, err := exec.CommandContext(ctx, "ditto", apps[0], staged).CombinedOutput(); err != nil {
		return "", fmt.Errorf("could not stage the new version: %v\n%s", err, strings.TrimSpace(string(out)))
	}
	detach()

	// The download came from the network, so Gatekeeper flags the whole tree.
	_ = exec.Command("xattr", "-dr", "com.apple.quarantine", staged).Run()

	if err := startSwapHelper(work, staged, target); err != nil {
		return "", err
	}
	return RestartExternal, nil
}

// startSwapHelper writes and detaches the script that replaces the bundle once
// the app is gone. It waits on our parent — the Electron main process, the one
// actually holding the bundle open — rather than on this sidecar, which Electron
// kills early in its own shutdown.
func startSwapHelper(work, staged, target string) error {
	script := filepath.Join(work, "apply-update.sh")
	body := fmt.Sprintf(`#!/bin/sh
# Wait (max ~60s) for the running app to exit before touching its bundle.
i=0
while kill -0 %d 2>/dev/null && [ $i -lt 600 ]; do
  sleep 0.1
  i=$((i+1))
done
sleep 1
/usr/bin/ditto %s %s || exit 1
/usr/bin/xattr -dr com.apple.quarantine %s
/usr/bin/open %s
rm -rf %s
`,
		os.Getppid(),
		shellQuote(staged), shellQuote(target),
		shellQuote(target),
		shellQuote(target),
		shellQuote(filepath.Dir(work)))

	if err := os.WriteFile(script, []byte(body), 0o755); err != nil {
		return err
	}

	cmd := exec.Command("/bin/sh", script)
	// New session, so the helper survives this process and the whole app tree
	// being torn down.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("could not start the update helper: %w", err)
	}
	_ = cmd.Process.Release()
	return nil
}

// shellQuote wraps s in single quotes for /bin/sh. Paths here contain a space
// ("Kube Inspector.app") and are otherwise app-controlled.
func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}
