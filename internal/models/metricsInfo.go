package models

// ContainerUsage is a single container's live usage within a pod.
type ContainerUsage struct {
	Name      string `json:"name"`
	CpuMillis int64  `json:"cpuMillis"`
	MemMi     int64  `json:"memMi"`
}

// ResourceUsage is a single row of resource consumption for the monitoring
// dashboard. Capacity fields are only meaningful for "cluster" and "node";
// Owner*/Containers are only populated for "pod" rows (for drill-down).
type ResourceUsage struct {
	Kind         string `json:"kind"` // "cluster" | "node" | "pod" | "workload"
	Name         string `json:"name"`
	Namespace    string `json:"namespace"` // empty for cluster/node
	Node         string `json:"node"`      // node a pod runs on
	CpuMillis    int64  `json:"cpuMillis"` // usage
	MemMi        int64  `json:"memMi"`     // usage
	CpuCapMillis int64  `json:"cpuCapMillis"`
	MemCapMi     int64  `json:"memCapMi"`
	// Limit sums (pod/workload): aggregated container resources.limits. Zero when
	// no limits are set, in which case a usage-vs-limit percentage is undefined.
	CpuLimitMillis int64 `json:"cpuLimitMillis"`
	MemLimitMi     int64 `json:"memLimitMi"`
	Pods           int   `json:"pods"` // workloads: number of contributing pods

	// Pod-only (for drill-down); omitted elsewhere.
	OwnerKind  string           `json:"ownerKind,omitempty"` // resolved top-level owner (e.g. "Deployment")
	OwnerName  string           `json:"ownerName,omitempty"`
	Containers []ContainerUsage `json:"containers,omitempty"`
}

// MetricsSnapshot is one point-in-time reading of cluster resource usage,
// polled live from metrics-server. The frontend builds rolling time-series
// from successive snapshots.
type MetricsSnapshot struct {
	Timestamp        int64           `json:"timestamp"` // unix millis
	MetricsAvailable bool            `json:"metricsAvailable"`
	Cluster          ResourceUsage   `json:"cluster"`
	Nodes            []ResourceUsage `json:"nodes"`
	Pods             []ResourceUsage `json:"pods"`
	Workloads        []ResourceUsage `json:"workloads"`
}
