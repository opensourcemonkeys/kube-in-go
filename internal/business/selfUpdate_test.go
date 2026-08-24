package business

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCheckForUpdateResolvesAsset(t *testing.T) {
	const manifest = `{"version":"99.0.0",
	 "downloadUrl":"https://example.test/downloads/",
	 "assets":{
	   "linux-deb":"https://example.test/dist/app-99.0.0-linux-amd64.deb",
	   "linux-rpm":"https://example.test/dist/app-99.0.0-linux-x86_64.rpm",
	   "windows-amd64":"https://example.test/dist/app-99.0.0-windows-amd64.exe",
	   "darwin-arm64":"https://example.test/dist/app-99.0.0-macos-arm64.dmg"}}`

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(manifest))
	}))
	defer srv.Close()

	t.Setenv("KUBE_INS_UPDATE_MANIFEST", srv.URL)

	info := CheckForUpdate()
	if !info.Available {
		t.Fatalf("expected 99.0.0 to be newer than %s", info.CurrentVersion)
	}
	if info.LatestVersion != "99.0.0" {
		t.Fatalf("LatestVersion = %q", info.LatestVersion)
	}
	if info.DownloadURL != "https://example.test/downloads/" {
		t.Fatalf("DownloadURL = %q", info.DownloadURL)
	}
	if info.AssetURL == "" || info.AssetKind == "" {
		t.Fatalf("no asset resolved: %+v", info)
	}
	t.Logf("AssetKind=%q AssetURL=%q Installable=%v reason=%q",
		info.AssetKind, info.AssetURL, info.Installable, info.NotInstallableReason)
}

func TestCheckForUpdateWithoutAssets(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"version":"99.0.0","downloadUrl":"https://example.test/downloads/"}`))
	}))
	defer srv.Close()

	t.Setenv("KUBE_INS_UPDATE_MANIFEST", srv.URL)

	info := CheckForUpdate()
	if !info.Available {
		t.Fatal("an older manifest without assets must still report the update")
	}
	if info.Installable {
		t.Fatal("Installable must be false when the manifest has no assets")
	}
	t.Logf("legacy manifest handled: reason=%q", info.NotInstallableReason)
}

func TestCheckForUpdateOffline(t *testing.T) {
	t.Setenv("KUBE_INS_UPDATE_MANIFEST", "http://127.0.0.1:1/version.json")
	info := CheckForUpdate()
	if info.Available || info.Installable {
		t.Fatalf("unreachable manifest must yield no update: %+v", info)
	}
	if info.DownloadURL == "" {
		t.Fatal("the downloads page fallback was dropped")
	}
}

// A beta user who switches to the stable channel finds a manifest older than
// the build they are running. Nothing must be offered, nothing downgraded, and
// the state must be distinguishable from "no update" so the UI can explain it.
func TestCheckForUpdateAheadOfChannel(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"version":"0.0.1","downloadUrl":"https://example.test/downloads/","assets":{}}`))
	}))
	defer srv.Close()

	t.Setenv("KUBE_INS_UPDATE_MANIFEST", srv.URL)

	info := CheckForUpdate()
	if info.Available {
		t.Fatal("a manifest older than the running build must not offer an update")
	}
	if !info.AheadOfChannel {
		t.Fatalf("AheadOfChannel must be true when running %s against a 0.0.1 manifest", info.CurrentVersion)
	}
	if info.Channel == "" {
		t.Fatal("Channel must be reported even when no update is available")
	}
}

// The empty-version shape the Makefile emits for a channel with no release yet
// must read as "nothing here", not as an update and not as being ahead.
func TestCheckForUpdateEmptyChannelManifest(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"version":"","downloadUrl":"https://example.test/downloads/","assets":{}}`))
	}))
	defer srv.Close()

	t.Setenv("KUBE_INS_UPDATE_MANIFEST", srv.URL)

	info := CheckForUpdate()
	if info.Available {
		t.Fatal("an empty channel manifest must not offer an update")
	}
	if info.AheadOfChannel {
		t.Fatal("an empty channel manifest is not a version to be ahead of")
	}
}
