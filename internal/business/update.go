package business

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"kube-ins/internal/logging"
	"kube-ins/internal/models"
	services "kube-ins/internal/services"

	"golang.org/x/mod/semver"
)

const (
	// Two manifests, one per channel. The Makefile's docs-downloads target
	// generates both: version.json carries the highest tag with no prerelease
	// suffix, version-beta.json the newest release of any kind. Without this
	// split a v1.1.0-alpha tag would offer itself to every stable user, since
	// isNewer() compares versions and knows nothing about channels.
	stableManifestURL = "https://kubeinspector.com/version.json"
	betaManifestURL   = "https://kubeinspector.com/version-beta.json"
	downloadPageURL   = "https://kubeinspector.com/downloads/"

	// ChannelStable receives only releases with no prerelease suffix;
	// ChannelBeta receives every release, prerelease or not.
	ChannelStable = "stable"
	ChannelBeta   = "beta"

	channelFile = ".channel"
)

// manifestURL is the published manifest for the selected channel, overridable
// so the update flow can be pointed at a local server during development. The
// override wins over the channel: it exists to test the mechanism, not a feed.
func manifestURL() string {
	if u := os.Getenv("KUBE_INS_UPDATE_MANIFEST"); u != "" {
		return u
	}
	if UpdateChannel() == ChannelBeta {
		return betaManifestURL
	}
	return stableManifestURL
}

// UpdateChannel reports the persisted update channel. Every error path — no
// home directory, no file, unrecognised content — falls back to the default
// rather than surfacing, exactly as cluster.go's .active does: a missing file
// is the normal first-run state, not a fault.
func UpdateChannel() string {
	dir, err := kubeInsDir()
	if err != nil {
		return defaultChannel()
	}
	data, err := os.ReadFile(filepath.Join(dir, channelFile))
	if err != nil {
		return defaultChannel()
	}
	switch strings.TrimSpace(string(data)) {
	case ChannelStable:
		return ChannelStable
	case ChannelBeta:
		return ChannelBeta
	}
	return defaultChannel()
}

// defaultChannel is beta below 1.0 and stable from 1.0 on. Below 1.0 every
// release this project has ever published is a prerelease, so defaulting to
// stable would pin every user to a channel with nothing on it and silently
// disable the update check.
func defaultChannel() string {
	v := "v" + strings.TrimPrefix(appVersion, "v")
	if !semver.IsValid(v) || semver.Major(v) == "v0" {
		return ChannelBeta
	}
	return ChannelStable
}

// SetUpdateChannel persists the channel selection. The 0600 file inside a 0700
// ~/.kube-ins comes from kubeInsDir(), matching .active and the hub token.
func SetUpdateChannel(channel string) error {
	if channel != ChannelStable && channel != ChannelBeta {
		return fmt.Errorf("unknown update channel %q", channel)
	}
	dir, err := kubeInsDir()
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dir, channelFile), []byte(channel), 0600); err != nil {
		return err
	}
	logging.With("business.update").Info("update channel changed", "channel", channel)
	return nil
}

// CheckForUpdate fetches the published version manifest and reports whether a
// newer release than the running build is available. It is best-effort: any
// network or parse error yields Available=false so the UI is never blocked.
func CheckForUpdate() models.UpdateInfo {
	info := models.UpdateInfo{
		CurrentVersion: appVersion,
		DownloadURL:    downloadPageURL,
		// Resolved before the HTTP call so the UI can still render which channel
		// it is on when the check fails or the machine is offline.
		Channel: UpdateChannel(),
	}

	// Read-and-clear, before the HTTP call, so it works offline and needs no new
	// startup hook. Not a package init(): this has to log, and logging.With()
	// before logging.Init() writes into the discard handler and the record is
	// lost forever. Not App.start() either: the frontend is not attached yet, so
	// an emitted event would go nowhere.
	if st, ok := consumeUpdateState(); ok && isNewer(st.To, appVersion) {
		logging.With("business.update").Warn("the previous update did not take effect",
			"attempted", st.To, "running", appVersion, "from", st.From, "asset", st.Asset)
		info.FailedUpdateVersion = st.To
		info.FailedUpdateLog = consumeHelperLog()
	}

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Get(manifestURL())
	if err != nil {
		return info
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return info
	}

	var manifest struct {
		Version     string            `json:"version"`
		DownloadURL string            `json:"downloadUrl"`
		Assets      map[string]string `json:"assets"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&manifest); err != nil {
		return info
	}

	info.LatestVersion = manifest.Version
	if manifest.DownloadURL != "" {
		info.DownloadURL = manifest.DownloadURL
	}
	info.Available = isNewer(manifest.Version, appVersion)
	// The running build can legitimately be ahead of its channel: a beta user who
	// switches to stable keeps the beta they already have, because downgrading
	// means handing dpkg an older package as root with no migration story for
	// anything the newer version wrote. Report it rather than rendering a bare
	// "no update" and leaving them wondering.
	info.AheadOfChannel = manifest.Version != "" && isNewer(appVersion, manifest.Version)
	resolveAsset(&info, manifest.Assets)
	return info
}

// resolveAsset picks this platform's installer out of the manifest and decides
// whether the in-app updater can apply it. A false Installable is not an error:
// the UI falls back to opening the downloads page, which is what the pill did
// before the updater existed.
func resolveAsset(info *models.UpdateInfo, assets map[string]string) {
	key, kind := services.PlatformAssetKey()
	if key == "" || assets[key] == "" {
		info.NotInstallableReason = "No installer is published for this platform."
		return
	}
	info.AssetURL = assets[key]
	info.AssetKind = kind

	if err := services.CheckInstallable(); err != nil {
		info.NotInstallableReason = err.Error()
		return
	}
	info.Installable = true
}

// isNewer reports whether latest is a strictly greater semantic version than
// current. Both are normalized with a leading "v"; invalid versions compare as
// not-newer (so dev builds and malformed manifests never trigger the prompt).
func isNewer(latest, current string) bool {
	l := "v" + strings.TrimPrefix(latest, "v")
	c := "v" + strings.TrimPrefix(current, "v")
	if !semver.IsValid(l) || !semver.IsValid(c) {
		return false
	}
	return semver.Compare(l, c) > 0
}
