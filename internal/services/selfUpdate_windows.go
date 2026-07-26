package services_k8sclient

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"runtime"
)

// PlatformAssetKey returns the manifest "assets" key for this machine. Only an
// amd64 installer is published.
func PlatformAssetKey() (key string, kind string) {
	if runtime.GOARCH != "amd64" {
		return "", ""
	}
	return "windows-amd64", "nsis"
}

// CheckInstallable reports why the in-app updater cannot apply a release here,
// or nil when it can.
func CheckInstallable() error {
	if key, _ := PlatformAssetKey(); key == "" {
		return fmt.Errorf("no installer is published for windows/%s", runtime.GOARCH)
	}
	return nil
}

// RunInstaller starts the NSIS installer silently and returns immediately,
// without waiting. That is deliberate: the installer closes the running app
// before it can replace the files, so waiting here would deadlock. The caller
// quits right after, and NSIS relaunches the new version itself
// (nsis.runAfterFinish in electron/electron-builder.yml).
func RunInstaller(ctx context.Context, pkgPath, kind string) (string, error) {
	if kind != "nsis" {
		return "", fmt.Errorf("unsupported package kind %q", kind)
	}

	cmd := exec.Command(pkgPath, "/S")
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("could not start the installer: %w", err)
	}
	// Detach: the installer has to outlive this process.
	if cmd.Process != nil {
		_ = cmd.Process.Release()
	} else {
		return "", errors.New("the installer did not start")
	}

	return RestartExternal, nil
}
