package models

import "time"

type StatefulSetInfo struct {
	Name            string    `json:"name"`
	Namespace       string    `json:"namespace"`
	Replicas        int32     `json:"replicas"`
	ReadyReplicas   int32     `json:"ready_replicas"`
	CurrentReplicas int32     `json:"current_replicas"`
	UpdatedReplicas int32     `json:"updated_replicas"`
	CreatedAt       time.Time `json:"created_at"`
}
