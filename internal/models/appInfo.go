package models

type DependencyInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type AppInfo struct {
	AppVersion string `json:"app_version"`
	GoVersion  string `json:"go_version"`
	// Commit and BuildDate come from the VCS stamp the Go toolchain embeds
	// (vcs.revision / vcs.time). They are empty under `go run` and whenever the
	// build used -buildvcs=false, so treat them as best-effort.
	Commit       string           `json:"commit"`
	BuildDate    string           `json:"build_date"`
	Dependencies []DependencyInfo `json:"dependencies"`
}
