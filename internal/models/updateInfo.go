package models

// UpdateInfo is the result of checking the published version manifest against
// the running app's version.
type UpdateInfo struct {
	Available      bool   `json:"available"`
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	DownloadURL    string `json:"downloadUrl"`
}
