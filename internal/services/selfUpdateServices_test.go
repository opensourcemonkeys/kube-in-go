package services_k8sclient

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestSelfUpdateDownloadAndVerify(t *testing.T) {
	payload := make([]byte, 3<<20) // 3 MB, enough for several progress ticks
	rand.Read(payload)
	sum := sha256.Sum256(payload)
	want := hex.EncodeToString(sum[:])

	mux := http.NewServeMux()
	mux.HandleFunc("/app.rpm", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "3145728")
		w.Write(payload)
	})
	mux.HandleFunc("/app.rpm.sha256", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(want + "  app.rpm\n"))
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	ctx := context.Background()
	dir := t.TempDir()
	dest := filepath.Join(dir, "app.rpm")

	got, err := FetchExpectedSha256(ctx, srv.URL+"/app.rpm")
	if err != nil {
		t.Fatalf("FetchExpectedSha256: %v", err)
	}
	if got != want {
		t.Fatalf("checksum sidecar parsed as %q, want %q", got, want)
	}

	var calls int
	var lastReceived, lastTotal int64
	if err := DownloadFile(ctx, srv.URL+"/app.rpm", dest, func(received, total int64) {
		calls++
		lastReceived, lastTotal = received, total
	}); err != nil {
		t.Fatalf("DownloadFile: %v", err)
	}
	if calls == 0 {
		t.Fatal("no progress callbacks")
	}
	if lastTotal != int64(len(payload)) || lastReceived != int64(len(payload)) {
		t.Fatalf("final progress %d/%d, want %d/%d", lastReceived, lastTotal, len(payload), len(payload))
	}
	t.Logf("progress callbacks: %d, final %d/%d", calls, lastReceived, lastTotal)

	if err := VerifySha256(dest, want); err != nil {
		t.Fatalf("VerifySha256 on a good file: %v", err)
	}
	if err := VerifySha256(dest, "00"+want[2:]); err == nil {
		t.Fatal("VerifySha256 accepted a mismatching checksum")
	} else {
		t.Logf("mismatch correctly rejected: %v", err)
	}
}

func TestSelfUpdateDownloadCancel(t *testing.T) {
	// Trickle the body so the transfer is still in flight when cancel lands.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "104857600")
		buf := make([]byte, 1<<16)
		for i := 0; i < 1600; i++ {
			if _, err := w.Write(buf); err != nil {
				return
			}
			w.(http.Flusher).Flush()
			time.Sleep(5 * time.Millisecond)
		}
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	dest := filepath.Join(t.TempDir(), "big.bin")

	time.AfterFunc(200*time.Millisecond, cancel)
	err := DownloadFile(ctx, srv.URL, dest, nil)
	if err == nil {
		t.Fatal("cancelled download returned no error")
	}
	if _, statErr := os.Stat(dest); !os.IsNotExist(statErr) {
		t.Fatal("partial download was left on disk after cancel")
	}
	// The resume path keeps a .part file across a *failed* attempt, but a cancel
	// is the user asking for it to stop, not to be paused.
	if _, statErr := os.Stat(dest + ".part"); !os.IsNotExist(statErr) {
		t.Fatal("a cancelled download left a .part file behind")
	}
	t.Logf("cancel rejected as expected: %v", err)
}

// The keys published in the update manifest (see the Makefile's docs-downloads
// target). PlatformAssetKey must only ever return one of these, or "" — a key
// that is not in the manifest resolves to no asset and silently disables the
// in-app updater for that platform.
var manifestAssetKeys = map[string]string{
	"linux-deb": "deb",
	"linux-rpm": "rpm",
	// "nsis", not "exe": selfUpdate_windows.go returns the kind the installer
	// dispatch switches on, and models.UpdateInfo.AssetKind documents it as
	// "deb, rpm, nsis or dmg". This fixture said "exe" and would have failed
	// this test on a Windows runner.
	"windows-amd64": "nsis",
	"darwin-arm64":  "dmg",
}

func TestPlatformAssetResolution(t *testing.T) {
	key, kind := PlatformAssetKey()

	// "" is a legitimate answer, not a failure: on Linux it means neither dpkg
	// nor rpm is present (a minimal container, or a source install), and the UI
	// correctly falls back to opening the downloads page.
	if key == "" {
		if kind != "" {
			t.Errorf("PlatformAssetKey() returned an empty key with kind %q; both must be empty together", kind)
		}
		if err := CheckInstallable(); err == nil {
			t.Error("CheckInstallable() returned nil despite there being no installable asset for this platform")
		}
		t.Skip("no packaged installer applies to this machine")
	}

	wantKind, ok := manifestAssetKeys[key]
	if !ok {
		t.Fatalf("PlatformAssetKey() = %q, which is not published in the manifest; want one of %v",
			key, sortedKeys(manifestAssetKeys))
	}
	if kind != wantKind {
		t.Errorf("PlatformAssetKey() = (%q, %q), want kind %q for that key", key, kind, wantKind)
	}
}

func sortedKeys(m map[string]string) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// A 190 MB download on a flaky link must not start over. The first request dies
// mid-body; the second has to ask for the rest with a Range header and produce
// a file that still matches the published checksum.
func TestSelfUpdateDownloadResumes(t *testing.T) {
	payload := make([]byte, 1<<20)
	if _, err := rand.Read(payload); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(payload)
	want := hex.EncodeToString(sum[:])

	var requests atomic.Int32
	var sawRange atomic.Value
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := requests.Add(1)
		if n == 1 {
			// Half the body, then kill the connection without a trailer so the
			// client sees a read error rather than a clean EOF.
			w.Header().Set("Content-Length", strconv.Itoa(len(payload)))
			w.WriteHeader(http.StatusOK)
			w.Write(payload[:len(payload)/2])
			w.(http.Flusher).Flush()
			panic(http.ErrAbortHandler)
		}
		rng := r.Header.Get("Range")
		sawRange.Store(rng)
		if !strings.HasPrefix(rng, "bytes=") {
			t.Errorf("resume request carried no Range header (got %q)", rng)
			http.Error(w, "expected a Range request", http.StatusBadRequest)
			return
		}
		from, err := strconv.Atoi(strings.TrimSuffix(strings.TrimPrefix(rng, "bytes="), "-"))
		if err != nil || from <= 0 || from >= len(payload) {
			t.Errorf("nonsensical Range header %q", rng)
			http.Error(w, "bad range", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", from, len(payload)-1, len(payload)))
		w.Header().Set("Content-Length", strconv.Itoa(len(payload)-from))
		w.WriteHeader(http.StatusPartialContent)
		w.Write(payload[from:])
	}))
	defer srv.Close()

	dest := filepath.Join(t.TempDir(), "pkg.bin")
	if err := DownloadFile(context.Background(), srv.URL, dest, nil); err != nil {
		t.Fatalf("DownloadFile: %v", err)
	}
	if got := requests.Load(); got != 2 {
		t.Fatalf("expected exactly 2 requests (one truncated, one resumed), got %d", got)
	}
	if err := VerifySha256(dest, want); err != nil {
		t.Fatalf("the resumed file does not match the published checksum: %v", err)
	}
	if _, err := os.Stat(dest + ".part"); !os.IsNotExist(err) {
		t.Fatal("a completed download left its .part file behind")
	}
	t.Logf("resumed with %v", sawRange.Load())
}

// A server (or a proxy) may ignore Range and send the whole body again.
// Appending it to what we already have would corrupt the file, so the attempt
// has to restart from zero.
func TestSelfUpdateDownloadRangeIgnored(t *testing.T) {
	payload := make([]byte, 512<<10)
	if _, err := rand.Read(payload); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(payload)
	want := hex.EncodeToString(sum[:])

	var requests atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if requests.Add(1) == 1 {
			w.Header().Set("Content-Length", strconv.Itoa(len(payload)))
			w.WriteHeader(http.StatusOK)
			w.Write(payload[:len(payload)/3])
			w.(http.Flusher).Flush()
			panic(http.ErrAbortHandler)
		}
		// Range present, deliberately ignored: a plain 200 with the full body.
		w.Header().Set("Content-Length", strconv.Itoa(len(payload)))
		w.WriteHeader(http.StatusOK)
		w.Write(payload)
	}))
	defer srv.Close()

	dest := filepath.Join(t.TempDir(), "pkg.bin")
	if err := DownloadFile(context.Background(), srv.URL, dest, nil); err != nil {
		t.Fatalf("DownloadFile: %v", err)
	}
	fi, err := os.Stat(dest)
	if err != nil {
		t.Fatal(err)
	}
	if fi.Size() != int64(len(payload)) {
		t.Fatalf("file is %d bytes, want %d — the ignored Range response was appended instead of replacing", fi.Size(), len(payload))
	}
	if err := VerifySha256(dest, want); err != nil {
		t.Fatalf("checksum mismatch after an ignored Range: %v", err)
	}
}

// A server that keeps failing must not retry forever, must leave nothing
// behind, and must say how many attempts it made.
func TestSelfUpdateDownloadGivesUp(t *testing.T) {
	var requests atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		http.Error(w, "nope", http.StatusInternalServerError)
	}))
	defer srv.Close()

	dest := filepath.Join(t.TempDir(), "pkg.bin")
	err := DownloadFile(context.Background(), srv.URL, dest, nil)
	if err == nil {
		t.Fatal("a permanently failing download returned no error")
	}
	if got := requests.Load(); got != downloadAttempts {
		t.Fatalf("made %d requests, want %d", got, downloadAttempts)
	}
	for _, p := range []string{dest, dest + ".part"} {
		if _, statErr := os.Stat(p); !os.IsNotExist(statErr) {
			t.Errorf("%s survived a failed download", p)
		}
	}
	t.Logf("gave up as expected: %v", err)
}

// 416 means the server thinks we already hold at least the whole body. Stop and
// let the checksum adjudicate rather than retrying into the same wall.
func TestSelfUpdateDownloadRangeNotSatisfiable(t *testing.T) {
	payload := []byte("the whole body, already on disk")
	sum := sha256.Sum256(payload)
	want := hex.EncodeToString(sum[:])

	var requests atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if requests.Add(1) == 1 {
			w.Header().Set("Content-Length", strconv.Itoa(len(payload)+10))
			w.WriteHeader(http.StatusOK)
			w.Write(payload)
			w.(http.Flusher).Flush()
			panic(http.ErrAbortHandler)
		}
		w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
	}))
	defer srv.Close()

	dest := filepath.Join(t.TempDir(), "pkg.bin")
	if err := DownloadFile(context.Background(), srv.URL, dest, nil); err != nil {
		t.Fatalf("DownloadFile: %v", err)
	}
	if got := requests.Load(); got != 2 {
		t.Fatalf("made %d requests, want 2 — a 416 must not be retried", got)
	}
	if err := VerifySha256(dest, want); err != nil {
		t.Fatalf("checksum: %v", err)
	}
}

func TestParseContentRangeTotal(t *testing.T) {
	cases := map[string]int64{
		"bytes 100-199/200": 200,
		"bytes 0-0/1":       1,
		"bytes 100-199/*":   -1,
		"":                  -1,
		"garbage":           -1,
		"bytes 0-1/0":       -1,
	}
	for header, want := range cases {
		if got := parseContentRangeTotal(header); got != want {
			t.Errorf("parseContentRangeTotal(%q) = %d, want %d", header, got, want)
		}
	}
}
