package models

// TrivyVulnerability is a single vulnerability finding surfaced to the frontend.
type TrivyVulnerability struct {
	VulnerabilityID  string `json:"vulnerabilityID"`
	PkgName          string `json:"pkgName"`
	InstalledVersion string `json:"installedVersion"`
	FixedVersion     string `json:"fixedVersion"`
	Severity         string `json:"severity"` // CRITICAL/HIGH/MEDIUM/LOW/UNKNOWN
	Title            string `json:"title"`
	PrimaryURL       string `json:"primaryURL"`
}

// TrivyTarget groups findings for one scan target (an OS layer, a language
// dependency set, etc.) within a single scanned artifact.
type TrivyTarget struct {
	Target          string               `json:"target"`
	Class           string               `json:"class"`
	Type            string               `json:"type"`
	Vulnerabilities []TrivyVulnerability `json:"vulnerabilities"`
}

// TrivyScanResult is the full result of scanning one artifact (an image or,
// for cluster scans, one of the cluster's images).
type TrivyScanResult struct {
	Kind        string         `json:"kind"`        // "image" | "cluster"
	ArtifactRef string         `json:"artifactRef"` // image name or cluster name
	Targets     []TrivyTarget  `json:"targets"`
	Summary     map[string]int `json:"summary"` // severity -> count
	ScannedAt   string         `json:"scannedAt"`
	Error       string         `json:"error"`
}
