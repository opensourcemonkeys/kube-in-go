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
}
