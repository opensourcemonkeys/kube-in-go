package models



type PodStatus string

const (
	PodStatusRunning     PodStatus = "Running"
	PodStatusPending     PodStatus = "Pending"
	PodStatusTerminating PodStatus = "Terminating"
)

type PodInfo struct {
	Name       string    `json:"name"`
	Namespace  string    `json:"namespace"`
	Status     PodStatus `json:"status"`
	Containers []string  `json:"containers"`
	CreatedAt  string    `json:"created_at"`

	PodIP     string `json:"pod_ip"`
	OwnerKind string `json:"owner_kind"` // "Deployment"/"StatefulSet"/"DaemonSet"/"Job"/... ("" = bare pod)

	// Live usage from metrics-server; -1 means metrics unavailable (distinct from a real 0).
	CpuMillis int64 `json:"cpu_millis"`
	MemMi     int64 `json:"mem_mi"`
}
