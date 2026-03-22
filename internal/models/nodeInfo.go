package models

import "time"

type NodeInfo struct {
	Name           string    `json:"name"`
	Status         string    `json:"status"`
	InternalIP     string    `json:"internal_ip"`
	KubeletVersion string    `json:"kubelet_version"`
	OSImage        string    `json:"os_image"`        // Örn: Ubuntu 22.04
	CpuCapacity    string    `json:"cpu_capacity"`    // Örn: 4
	MemoryCapacity string    `json:"memory_capacity"` // Örn: 16Gi
	CreatedAt      time.Time `json:"created_at"`
}
