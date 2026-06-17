package business

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"kube-ins/internal/models"

	"golang.org/x/mod/semver"
)

const (
	versionManifestURL = "https://kubeinspector.com/version.json"
	downloadPageURL    = "https://kubeinspector.com/downloads/"
)

// CheckForUpdate fetches the published version manifest and reports whether a
// newer release than the running build is available. It is best-effort: any
// network or parse error yields Available=false so the UI is never blocked.
func CheckForUpdate() models.UpdateInfo {
	info := models.UpdateInfo{
		CurrentVersion: appVersion,
		DownloadURL:    downloadPageURL,
	}

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Get(versionManifestURL)
	if err != nil {
		return info
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return info
	}

	var manifest struct {
		Version     string `json:"version"`
		DownloadURL string `json:"downloadUrl"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&manifest); err != nil {
		return info
	}

	info.LatestVersion = manifest.Version
	if manifest.DownloadURL != "" {
		info.DownloadURL = manifest.DownloadURL
	}
	info.Available = isNewer(manifest.Version, appVersion)
	return info
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
