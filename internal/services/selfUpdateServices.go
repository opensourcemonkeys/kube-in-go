package services_k8sclient

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// progressInterval throttles the progress callback. A 190 MB download would
// otherwise emit tens of thousands of Wails events.
const progressInterval = 150 * time.Millisecond

// How the app gets back up after RunInstaller returns. RestartRelaunch means we
// re-exec ourselves (the installer has already finished replacing the files);
// RestartExternal means something else — the NSIS installer, or the macOS swap
// helper — will start the new version, so we only have to quit.
const (
	RestartRelaunch = "relaunch"
	RestartExternal = "external"
)

// progressWriter counts bytes as they are copied and reports them, at most once
// per progressInterval (plus a final call from DownloadFile).
type progressWriter struct {
	received   int64
	total      int64
	onProgress func(received, total int64)
	lastEmit   time.Time
}

func (w *progressWriter) Write(p []byte) (int, error) {
	n := len(p)
	w.received += int64(n)
	if w.onProgress != nil && time.Since(w.lastEmit) >= progressInterval {
		w.lastEmit = time.Now()
		w.onProgress(w.received, w.total)
	}
	return n, nil
}

// DownloadFile streams url into dest, reporting progress as it goes. total is
// -1 when the server sends no Content-Length. The context cancels the transfer
// mid-flight, which is how the UI's Cancel button works.
func DownloadFile(ctx context.Context, url, dest string, onProgress func(received, total int64)) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}

	// No client timeout: a release package is ~190 MB and the context already
	// bounds the transfer.
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed: %s returned %s", url, resp.Status)
	}

	total := resp.ContentLength
	if total <= 0 {
		total = -1
	}

	out, err := os.Create(dest)
	if err != nil {
		return err
	}

	counter := &progressWriter{total: total, onProgress: onProgress}
	_, copyErr := io.Copy(io.MultiWriter(out, counter), resp.Body)
	closeErr := out.Close()

	if copyErr != nil {
		os.Remove(dest)
		return copyErr
	}
	if closeErr != nil {
		os.Remove(dest)
		return closeErr
	}

	if onProgress != nil {
		onProgress(counter.received, total)
	}
	return nil
}

// FetchExpectedSha256 reads the "<assetUrl>.sha256" sidecar published next to
// every release artifact by CI. Its content is the standard sha256sum output,
// "<hex>  <filename>", so only the first field matters.
func FetchExpectedSha256(ctx context.Context, assetURL string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, assetURL+".sha256", nil)
	if err != nil {
		return "", err
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("checksum not published: %s returned %s", assetURL+".sha256", resp.Status)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return "", err
	}

	fields := strings.Fields(string(body))
	if len(fields) == 0 {
		return "", fmt.Errorf("checksum file for %s is empty", assetURL)
	}
	sum := strings.ToLower(fields[0])
	if len(sum) != 64 {
		return "", fmt.Errorf("checksum file for %s is malformed", assetURL)
	}
	return sum, nil
}

// VerifySha256 hashes path and compares it with want. A mismatch is fatal to
// the update: on Linux the file is about to be handed to dpkg/rpm as root.
func VerifySha256(path, want string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return err
	}

	got := hex.EncodeToString(h.Sum(nil))
	if !strings.EqualFold(got, want) {
		return fmt.Errorf("checksum mismatch: expected %s, got %s", want, got)
	}
	return nil
}
