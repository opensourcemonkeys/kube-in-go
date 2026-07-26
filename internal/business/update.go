package business

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"kube-ins/internal/models"
	services "kube-ins/internal/services"

	"golang.org/x/mod/semver"
)

const (
	versionManifestURL = "https://kubeinspector.com/version.json"
	downloadPageURL    = "https://kubeinspector.com/downloads/"
)

// manifestURL is the published manifest, overridable so the update flow can be
// pointed at a local server during development.
func manifestURL() string {
	if u := os.Getenv("KUBE_INS_UPDATE_MANIFEST"); u != "" {
		return u
	}
	return versionManifestURL
}

// CheckForUpdate fetches the published version manifest and reports whether a
// newer release than the running build is available. It is best-effort: any
// network or parse error yields Available=false so the UI is never blocked.
func CheckForUpdate() models.UpdateInfo {
	info := models.UpdateInfo{
		CurrentVersion: appVersion,
		DownloadURL:    downloadPageURL,
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
