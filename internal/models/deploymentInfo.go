package models

import "time"

type DeploymentInfo struct {
	Name              string    `json:"name"`
	Namespace         string    `json:"namespace"`
	Replicas          int32     `json:"replicas"`
	ReadyReplicas     int32     `json:"ready_replicas"`
	AvailableReplicas int32     `json:"available_replicas"`
	UpdatedReplicas   int32     `json:"updated_replicas"`
	CreatedAt         time.Time `json:"created_at"`
}
