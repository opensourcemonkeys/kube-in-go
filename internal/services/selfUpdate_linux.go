package services_k8sclient

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// installRoot is where the deb/rpm puts the app tree (see build/nfpm.yaml). A
// build running from anywhere else is a dev tree or a hand-extracted copy, and
// handing a package to dpkg/rpm would not update it.
const installRoot = "/opt/kube-inspector"

// PlatformAssetKey returns the key to look up in the manifest's "assets" map
// for this machine, plus the installer kind it maps to. Debian and RPM systems
// take different packages, so the key depends on which package manager exists.
func PlatformAssetKey() (key string, kind string) {
	if _, err := exec.LookPath("dpkg"); err == nil {
		return "linux-deb", "deb"
	}
	if _, err := exec.LookPath("rpm"); err == nil {
		return "linux-rpm", "rpm"
	}
	return "", ""
}

// CheckInstallable reports why the in-app updater cannot apply a release here,
// or nil when it can. The app lives under a root-owned /opt tree managed by
// dpkg/rpm, so updating means asking the package manager to do it as root —
// which needs pkexec.
func CheckInstallable() error {
	if key, _ := PlatformAssetKey(); key == "" {
		return errors.New("no supported package manager (dpkg or rpm) was found")
	}
	if _, err := exec.LookPath("pkexec"); err != nil {
		return errors.New("pkexec (polkit) is not installed, so the update cannot be applied with administrator rights")
	}

	exe, err := os.Executable()
	if err != nil {
		return errors.New("could not determine the running executable's location")
	}
	if !strings.HasPrefix(exe, installRoot+"/") {
		return fmt.Errorf("this build is not running from %s, so it was not installed from a package", installRoot)
	}
	return nil
}

// RunInstaller hands the downloaded package to the system package manager under
// pkexec and waits for it to finish. Running it synchronously matters: the
// caller quits the app right after this returns, and a root dpkg/rpm started as
// our child would otherwise still be mid-transaction. Waiting also lets the
// postinstall script restore chrome-sandbox's setuid bit before we relaunch —
// Electron refuses to start without it.
func RunInstaller(ctx context.Context, pkgPath, kind string) (string, error) {
	var args []string
	switch kind {
	case "deb":
		args = []string{"pkexec", "dpkg", "-i", pkgPath}
	case "rpm":
		// --replacepkgs lets a reinstall of the same version succeed instead of
		// erroring out, which keeps a retry after a failed run working.
		args = []string{"pkexec", "rpm", "-Uvh", "--replacepkgs", pkgPath}
	default:
		return "", fmt.Errorf("unsupported package kind %q", kind)
	}

	cmd := exec.CommandContext(ctx, args[0], args[1:]...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		// pkexec exits 126 when the user dismisses the authentication dialog
		// and 127 when authorisation is denied outright.
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			switch exitErr.ExitCode() {
			case 126:
				return "", errors.New("installation was cancelled at the password prompt")
			case 127:
				return "", errors.New("not authorised to install the update")
			}
		}
		return "", fmt.Errorf("%s failed: %v\n%s", kind, err, strings.TrimSpace(string(out)))
	}

	return RestartRelaunch, nil
}

// KeepPackageAfterInstall reports whether the installer is still reading the
// downloaded package after RunInstaller returns.
//
// False here, and only here: the Linux path runs dpkg/rpm through
// CombinedOutput and therefore waits for it, so by the time RunInstaller
// returns the ~190 MB package is safe to delete. Windows and macOS both detach
// their installer and are still reading it.
func KeepPackageAfterInstall() bool { return false }
