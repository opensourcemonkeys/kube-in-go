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

	"kube-ins/internal/logging"
)

// updateHelperLogName is where the detached swap helper writes. It runs after
// the app has quit, so a file is its only channel back; business.CheckForUpdate
// reads and removes it on the next launch. Must match business.updateHelperLog.
//
// Declared here rather than beside the script renderer because it is genuinely
// darwin-only: on any other platform it would be an unused constant.
const updateHelperLogName = "update-helper.log"

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

	// filepath.Dir(pkgPath), not filepath.Dir(work): the helper's last act is an
	// rm -rf of this path. Deriving it from work would follow work if it ever
	// moved — and work living beside the target would make that rm -rf
	// /Applications.
	if err := startSwapHelper(work, staged, target, filepath.Dir(pkgPath)); err != nil {
		return "", err
	}
	return RestartExternal, nil
}

// startSwapHelper writes and detaches the script that replaces the bundle once
// the app is gone.
//
// Both PIDs are captured here, at spawn time, while both processes are
// certainly alive. Reading the parent later is the bug this replaces: once the
// shell has quit, os.Getppid() resolves to 1 and the wait either no-ops or
// blocks on init.
func startSwapHelper(work, staged, target, tmpDir string) error {
	logPath := filepath.Join(os.TempDir(), updateHelperLogName)
	if dir, err := logging.Dir(); err == nil {
		logPath = filepath.Join(dir, updateHelperLogName)
	}
	// Append, not truncate: a second attempt after a failure must not erase the
	// evidence of the first. business.consumeHelperLog removes the file once it
	// has been reported, so it cannot grow without bound.

	script := filepath.Join(work, "apply-update.sh")
	body := swapHelperScript(logPath, os.Getpid(), os.Getppid(), staged, target, tmpDir)
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
	logging.With("services.selfUpdate").Info("update helper detached",
		"pid", cmd.Process.Pid, "log", logPath, "target", target)
	return nil
}

// KeepPackageAfterInstall reports whether the installer is still reading the
// downloaded package after RunInstaller returns. True on macOS: the swap helper
// runs detached from the staging directory inside the temp dir and removes the
// whole thing itself as its last act.
func KeepPackageAfterInstall() bool { return true }
