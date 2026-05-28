package models

type DependencyInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type AppInfo struct {
	AppVersion   string           `json:"app_version"`
	GoVersion    string           `json:"go_version"`
	Dependencies []DependencyInfo `json:"dependencies"`
}
