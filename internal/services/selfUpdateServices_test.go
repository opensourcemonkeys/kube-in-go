package services_k8sclient

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
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
	t.Logf("cancel rejected as expected: %v", err)
}

// The keys published in the update manifest (see the Makefile's docs-downloads
// target). PlatformAssetKey must only ever return one of these, or "" — a key
// that is not in the manifest resolves to no asset and silently disables the
// in-app updater for that platform.
var manifestAssetKeys = map[string]string{
	"linux-deb":     "deb",
	"linux-rpm":     "rpm",
	"windows-amd64": "exe",
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
