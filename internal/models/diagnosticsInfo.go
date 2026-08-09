package models

// DiagnosticsReport is the environment half of the Diagnostics panel: facts
// about this build and this machine that a bug report needs and that a user
// should not have to dig up by hand.
//
// It deliberately carries no cluster names and no absolute paths that identify
// the user — ActiveCluster is a hash, and every string that reaches an export
// goes through redaction first.
type DiagnosticsReport struct {
	AppVersion string `json:"appVersion"`
	Commit     string `json:"commit"`
	BuildDate  string `json:"buildDate"`
	GoVersion  string `json:"goVersion"`
	GOOS       string `json:"goos"`
	GOARCH     string `json:"goarch"`
	OSRelease  string `json:"osRelease"`

	// Shell is "electron", "wails", "browser" or "cli". Only the controller
	// knows which Transport is installed, so business leaves this empty.
	Shell string `json:"shell"`

	// Pid identifies this backend's records in the shared log file, which
	// carries every process on the machine.
	Pid int `json:"pid"`

	LogDir   string        `json:"logDir"`
	LogLevel string        `json:"logLevel"`
	LogFiles []LogFileInfo `json:"logFiles"`

	ClusterCount int `json:"clusterCount"`
	// ActiveCluster is the first 8 hex characters of the SHA-256 of the active
	// cluster's name — enough to correlate two reports, never the name itself.
	ActiveCluster string `json:"activeCluster"`

	// Hub is filled in by the controller: business must not import internal/ipc.
	Hub HubDiagnostics `json:"hub"`

	Dependencies []DependencyInfo `json:"dependencies"`
	GeneratedAt  string           `json:"generatedAt"`
}

type LogFileInfo struct {
	Name       string `json:"name"`
	SizeBytes  int64  `json:"sizeBytes"`
	ModifiedAt string `json:"modifiedAt"`
}

// HubDiagnostics describes this process's place in the multi-instance hub.
type HubDiagnostics struct {
	Role          string `json:"role"` // "server", "client" or "disabled"
	InstanceID    string `json:"instanceId"`
	InstanceName  string `json:"instanceName"`
	InstanceCount int    `json:"instanceCount"`
}

// HealthCheck is one row of the Diagnostics panel's preflight.
type HealthCheck struct {
	Name   string `json:"name"`  // stable id, e.g. "log-dir-writable", "cluster:prod"
	Label  string `json:"label"` // human-facing
	Status string `json:"status"`
	Detail string `json:"detail"`
	// DurationMs rather than a time.Duration: the latter binds to the frontend
	// as a bare nanosecond count that no caller reads correctly.
	DurationMs int64 `json:"durationMs"`
}

// Health check statuses. "warn" means informative, not broken — a missing
// metrics-server or an offline update check are normal states.
const (
	HealthOK   = "ok"
	HealthWarn = "warn"
	HealthFail = "fail"
	HealthSkip = "skip"
)

// LogEntry is one line of the log rendered for the Logs tab.
type LogEntry struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Logger    string `json:"logger"`
	Message   string `json:"message"`
	Role      string `json:"role"`
	Pid       int    `json:"pid"`
	// Fields is the remaining structured data pre-rendered as "k=v k=v", so the
	// frontend does not have to guess at types it cannot know.
	Fields string `json:"fields"`
}
