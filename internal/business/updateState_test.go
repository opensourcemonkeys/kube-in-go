package business

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// An update that was handed to a detached installer and did not take must be
// reported exactly once — a warning that reappears on every 6-hourly re-check
// would be worse than none.
func TestFailedUpdateReportedOnce(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("kubeInsDir uses os.UserHomeDir, which reads the registry on Windows")
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("KUBE_INS_LOG_DIR", t.TempDir())

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"version":"0.0.1","downloadUrl":"https://example.test/","assets":{}}`))
	}))
	defer srv.Close()
	t.Setenv("KUBE_INS_UPDATE_MANIFEST", srv.URL)

	writeUpdateState(updateState{
		From:    appVersion,
		To:      "99.0.0",
		Asset:   "https://example.test/dist/app-99.0.0.deb",
		Channel: ChannelBeta,
	})

	statePath := filepath.Join(home, ".kube-ins", updateStateFile)
	if _, err := os.Stat(statePath); err != nil {
		t.Fatalf("writeUpdateState left no file: %v", err)
	}

	info := CheckForUpdate()
	if info.FailedUpdateVersion != "99.0.0" {
		t.Fatalf("FailedUpdateVersion = %q, want 99.0.0", info.FailedUpdateVersion)
	}
	if _, err := os.Stat(statePath); !os.IsNotExist(err) {
		t.Fatalf("the state file survived the check that consumed it: %v", err)
	}

	// Second check: silence.
	if again := CheckForUpdate(); again.FailedUpdateVersion != "" {
		t.Fatalf("the failure was reported twice: %q", again.FailedUpdateVersion)
	}
}

// The same record after a *successful* update: the running version is no longer
// older than the attempted one, so nothing is reported and the file is still
// cleaned up.
func TestSuccessfulUpdateReportsNothing(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("kubeInsDir uses os.UserHomeDir, which reads the registry on Windows")
	}
	home := t.TempDir()
	t.Setenv("HOME", home)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"version":"0.0.1","downloadUrl":"https://example.test/","assets":{}}`))
	}))
	defer srv.Close()
	t.Setenv("KUBE_INS_UPDATE_MANIFEST", srv.URL)

	writeUpdateState(updateState{From: "0.0.1", To: "0.0.2", Channel: ChannelBeta})

	info := CheckForUpdate()
	if info.FailedUpdateVersion != "" {
		t.Fatalf("an update older than the running build was reported as failed: %q", info.FailedUpdateVersion)
	}
	if _, err := os.Stat(filepath.Join(home, ".kube-ins", updateStateFile)); !os.IsNotExist(err) {
		t.Fatalf("the state file was not consumed: %v", err)
	}
}

func TestClearUpdateState(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("kubeInsDir uses os.UserHomeDir, which reads the registry on Windows")
	}
	home := t.TempDir()
	t.Setenv("HOME", home)

	writeUpdateState(updateState{From: "1.0.0", To: "2.0.0"})
	clearUpdateState()
	if _, ok := consumeUpdateState(); ok {
		t.Fatal("clearUpdateState left the record behind — an installer error would fire a spurious warning next launch")
	}
	// Clearing twice, and clearing nothing, must both be quiet.
	clearUpdateState()
}

func TestConsumeUpdateStateRejectsGarbage(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("kubeInsDir uses os.UserHomeDir, which reads the registry on Windows")
	}
	home := t.TempDir()
	t.Setenv("HOME", home)

	dir, err := kubeInsDir()
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, updateStateFile)

	for _, body := range []string{"not json", `{}`, `{"to":""}`} {
		if err := os.WriteFile(path, []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
		if _, ok := consumeUpdateState(); ok {
			t.Fatalf("consumeUpdateState accepted %q", body)
		}
		if _, err := os.Stat(path); !os.IsNotExist(err) {
			t.Fatalf("a rejected record must still be removed, or it is retried forever (%q)", body)
		}
	}

	// A well-formed record round-trips.
	want := updateState{From: "1.0.0", To: "2.0.0", Asset: "u", Channel: ChannelBeta}
	data, _ := json.Marshal(want)
	if err := os.WriteFile(path, data, 0600); err != nil {
		t.Fatal(err)
	}
	got, ok := consumeUpdateState()
	if !ok || got.To != "2.0.0" || got.From != "1.0.0" {
		t.Fatalf("round trip lost data: %+v (ok=%v)", got, ok)
	}
}
