package models

// UpdateInfo is the result of checking the published version manifest against
// the running app's version.
type UpdateInfo struct {
	Available      bool   `json:"available"`
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	DownloadURL    string `json:"downloadUrl"`

	// AssetURL is the direct download for this platform's installer, resolved
	// from the manifest's "assets" map. Empty when the manifest has no asset
	// for the running OS/arch.
	AssetURL string `json:"assetUrl"`
	// AssetKind tells the installer how to apply the download: deb, rpm, nsis
	// or dmg.
	AssetKind string `json:"assetKind"`
	// Installable reports whether the in-app updater can actually download and
	// apply this release here. When false the UI falls back to opening
	// DownloadURL in the browser.
	Installable bool `json:"installable"`
	// NotInstallableReason explains a false Installable, for the UI to show.
	NotInstallableReason string `json:"notInstallableReason"`
}

// UpdateProgress is streamed to the frontend while a self-update runs. Phase is
// "download" or "install"; Total is -1 when the server sent no Content-Length,
// which the UI renders as an indeterminate bar.
type UpdateProgress struct {
	Phase    string  `json:"phase"`
	Received int64   `json:"received"`
	Total    int64   `json:"total"`
	Percent  float64 `json:"percent"`
}
