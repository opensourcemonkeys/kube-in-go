package models

type ReplicaSetInfo struct {
	Name              string `json:"name"`
	Namespace         string `json:"namespace"`
	Replicas          int32  `json:"replicas"`
	ReadyReplicas     int32  `json:"ready_replicas"`
	AvailableReplicas int32  `json:"available_replicas"`
	Status            string `json:"status"`
	CreatedAt         string `json:"created_at"`
}
