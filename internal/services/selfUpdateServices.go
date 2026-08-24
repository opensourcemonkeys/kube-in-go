package services_k8sclient

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
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

// Resume policy. A release package is ~190 MB and a beta tester on a flaky
// connection should not have to start over, so a failed transfer keeps its
// partial file and the next attempt asks for the rest with a Range header.
const (
	downloadAttempts = 3

	// Fixed, not exponential: the user is watching a progress bar, and a 30s
	// pause reads worse than a clean failure.
	retryBackoff = 2 * time.Second

	// A half-open TCP connection produces no error at all — the read blocks
	// forever, the bar freezes, and the retry loop never runs. This watchdog is
	// what turns that into an error the retry can act on, and it is the exact
	// scenario resume exists for.
	stallTimeout = 60 * time.Second
)

// errStalled marks an attempt aborted by the watchdog rather than by the user.
var errStalled = errors.New("the download stalled: no data received for " + stallTimeout.String())

// progressWriter counts bytes as they are copied and reports them, at most once
// per progressInterval (plus a final call from DownloadFile). On a resumed
// transfer received starts at the bytes already on disk, so the bar continues
// rather than jumping back to zero.
type progressWriter struct {
	received   int64
	total      int64
	onProgress func(received, total int64)
	lastEmit   time.Time
	// keepAlive is called on every chunk to push the stall watchdog out.
	keepAlive func()
}

func (w *progressWriter) Write(p []byte) (int, error) {
	n := len(p)
	w.received += int64(n)
	if w.keepAlive != nil {
		w.keepAlive()
	}
	if w.onProgress != nil && time.Since(w.lastEmit) >= progressInterval {
		w.lastEmit = time.Now()
		w.onProgress(w.received, w.total)
	}
	return n, nil
}

// DownloadFile streams url into dest, reporting progress as it goes. total is
// -1 when the server sends no Content-Length. The context cancels the transfer
// mid-flight, which is how the UI's Cancel button works.
//
// The transfer goes to dest+".part" and is renamed into place only once it has
// completed. That is what makes resume possible, and it is also why a cancelled
// or failed download never leaves a half-file at dest for someone to mistake
// for a package.
//
// Resuming is only admissible here because the caller verifies the assembled
// file against a checksum fetched *before* the download (see
// business.RunSelfUpdate). The one real hazard of resumption — the server
// serving a different body on the retry, e.g. after a re-pushed tag — is
// therefore caught, and caught before the file is handed to dpkg as root.
func DownloadFile(ctx context.Context, url, dest string, onProgress func(received, total int64)) error {
	part := dest + ".part"

	var lastErr error
	for attempt := 1; attempt <= downloadAttempts; attempt++ {
		if attempt > 1 {
			select {
			case <-ctx.Done():
				os.Remove(part)
				return ctx.Err()
			case <-time.After(retryBackoff):
			}
		}

		done, err := downloadAttempt(ctx, url, part, onProgress)
		if err == nil {
			// Rename last: until this line dest does not exist at all.
			if err := os.Rename(part, dest); err != nil {
				os.Remove(part)
				return err
			}
			if onProgress != nil && done > 0 {
				onProgress(done, done)
			}
			return nil
		}

		// A user-cancelled download keeps nothing: they asked for it to stop, not
		// to be paused.
		if ctx.Err() != nil {
			os.Remove(part)
			return ctx.Err()
		}
		lastErr = err
	}

	os.Remove(part)
	return fmt.Errorf("download failed after %d attempts: %w", downloadAttempts, lastErr)
}

// downloadAttempt performs one transfer into part, resuming from whatever is
// already there. It returns the total size of the completed file. On error the
// partial file is deliberately left in place for the next attempt.
func downloadAttempt(ctx context.Context, url, part string, onProgress func(received, total int64)) (int64, error) {
	var existing int64
	if fi, err := os.Stat(part); err == nil && !fi.IsDir() {
		existing = fi.Size()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}
	if existing > 0 {
		req.Header.Set("Range", "bytes="+strconv.FormatInt(existing, 10)+"-")
	}

	// No client timeout: a release package is ~190 MB and no fixed deadline fits
	// both a fast link and a slow one. The context bounds the transfer, and the
	// stall watchdog below covers the half-open connection a timeout would.
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	total := int64(-1)
	switch resp.StatusCode {
	case http.StatusOK:
		// The server ignored our Range header and is sending the whole body
		// again. Start over rather than appending, which would corrupt the file.
		existing = 0
		if resp.ContentLength > 0 {
			total = resp.ContentLength
		}
	case http.StatusPartialContent:
		// Content-Length on a 206 is the *remaining* bytes; the full size is the
		// third field of Content-Range.
		total = parseContentRangeTotal(resp.Header.Get("Content-Range"))
		if total <= 0 && resp.ContentLength > 0 {
			total = existing + resp.ContentLength
		}
	case http.StatusRequestedRangeNotSatisfiable:
		// We already hold at least the whole body. Stop and let the caller's
		// checksum adjudicate whether what we hold is right.
		return existing, nil
	default:
		return 0, fmt.Errorf("download failed: %s returned %s", url, resp.Status)
	}

	flags := os.O_CREATE | os.O_WRONLY
	if existing == 0 {
		flags |= os.O_TRUNC
	}
	out, err := os.OpenFile(part, flags, 0600)
	if err != nil {
		return 0, err
	}
	if existing > 0 {
		if _, err := out.Seek(existing, io.SeekStart); err != nil {
			out.Close()
			return 0, err
		}
	}

	attemptCtx, cancelAttempt := context.WithCancel(ctx)
	defer cancelAttempt()
	var stalled atomic.Bool
	watchdog := time.AfterFunc(stallTimeout, func() {
		stalled.Store(true)
		cancelAttempt()
	})
	defer watchdog.Stop()

	counter := &progressWriter{
		received:   existing,
		total:      total,
		onProgress: onProgress,
		keepAlive:  func() { watchdog.Reset(stallTimeout) },
	}

	body := &ctxReader{ctx: attemptCtx, r: resp.Body}
	_, copyErr := io.Copy(io.MultiWriter(out, counter), body)
	closeErr := out.Close()

	if copyErr != nil {
		// Disambiguate the two things that cancel attemptCtx. Only the watchdog
		// is retriable; a user cancel is reported as such by the caller.
		if stalled.Load() && ctx.Err() == nil {
			return 0, errStalled
		}
		return 0, copyErr
	}
	if closeErr != nil {
		return 0, closeErr
	}
	return counter.received, nil
}

// ctxReader aborts a read when the attempt context is cancelled. The response
// body is already tied to the *request* context, but not to the per-attempt one
// the stall watchdog cancels, so without this a half-open connection would
// still block forever.
type ctxReader struct {
	ctx context.Context
	r   io.Reader
}

func (c *ctxReader) Read(p []byte) (int, error) {
	if err := c.ctx.Err(); err != nil {
		return 0, err
	}
	return c.r.Read(p)
}

// parseContentRangeTotal pulls Z out of "bytes X-Y/Z", returning -1 for the
// unknown-size form ("bytes X-Y/*") and for anything malformed.
func parseContentRangeTotal(header string) int64 {
	i := strings.LastIndex(header, "/")
	if i < 0 {
		return -1
	}
	n, err := strconv.ParseInt(strings.TrimSpace(header[i+1:]), 10, 64)
	if err != nil || n <= 0 {
		return -1
	}
	return n
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
