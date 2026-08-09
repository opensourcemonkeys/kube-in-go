package business

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"kube-ins/internal/logging"
	"kube-ins/internal/models"
	services "kube-ins/internal/services"
)

// RunSelfUpdate downloads this platform's installer, verifies it against the
// checksum published alongside it, and applies it. onProgress is called
// throughout with Phase "download" and then "install"; the returned restart
// mode tells the caller how to bring the new version up (see
// services.RestartRelaunch / RestartExternal).
//
// The temporary download is kept on success — on Windows and macOS the
// installer is still reading it after this returns.
func RunSelfUpdate(ctx context.Context, info models.UpdateInfo, onProgress func(models.UpdateProgress)) (string, error) {
	if !info.Installable || info.AssetURL == "" {
		err := errors.New("this release cannot be installed automatically here")
		logging.With("business.selfUpdate").Error("self-update refused", "stage", "precheck", "err", err)
		return "", err
	}

	dir, err := os.MkdirTemp("", "kube-ins-update-")
	if err != nil {
		logging.With("business.selfUpdate").Error("self-update failed", "stage", "tempdir", "err", err)
		return "", err
	}

	pkgPath := filepath.Join(dir, filepath.Base(info.AssetURL))

	// The checksum comes first: no point downloading ~190 MB we would refuse to
	// install anyway.
	expected, err := services.FetchExpectedSha256(ctx, info.AssetURL)
	if err != nil {
		os.RemoveAll(dir)
		logging.With("business.selfUpdate").Error("self-update failed", "stage", "checksum", "url", info.AssetURL, "err", err)
		return "", err
	}

	onProgress(models.UpdateProgress{Phase: "download", Received: 0, Total: -1})
	err = services.DownloadFile(ctx, info.AssetURL, pkgPath, func(received, total int64) {
		p := models.UpdateProgress{Phase: "download", Received: received, Total: total}
		if total > 0 {
			p.Percent = float64(received) / float64(total) * 100
		}
		onProgress(p)
	})
	if err != nil {
		os.RemoveAll(dir)
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		logging.With("business.selfUpdate").Error("self-update failed", "stage", "download", "url", info.AssetURL, "err", err)
		return "", err
	}

	if err := services.VerifySha256(pkgPath, expected); err != nil {
		os.RemoveAll(dir)
		logging.With("business.selfUpdate").Error("self-update failed", "stage", "verify", "err", err)
		return "", fmt.Errorf("the downloaded package failed verification and was discarded: %w", err)
	}

	onProgress(models.UpdateProgress{Phase: "install", Received: 0, Total: -1})
	// Past this point cancellation is dropped: killing dpkg/rpm mid-transaction
	// would leave the package database — and the app — in a broken state. The UI
	// hides its Cancel button here for the same reason.
	restart, err := services.RunInstaller(context.WithoutCancel(ctx), pkgPath, info.AssetKind)
	if err != nil {
		os.RemoveAll(dir)
		logging.With("business.selfUpdate").Error("self-update failed", "stage", "install", "kind", info.AssetKind, "err", err)
		return "", err
	}

	return restart, nil
}
