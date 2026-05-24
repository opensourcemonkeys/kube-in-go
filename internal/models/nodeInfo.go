package models

import "time"

type NodeInfo struct {
	Name              string    `json:"name"`
	Status            string    `json:"status"`
	InternalIP        string    `json:"internal_ip"`
	KubeletVersion    string    `json:"kubelet_version"`
	OSImage           string    `json:"os_image"`
	CpuCapacity       string    `json:"cpu_capacity"`
	MemoryCapacity    string    `json:"memory_capacity"`
	CreatedAt         time.Time `json:"created_at"`
	CpuUsageMillis    int64     `json:"cpu_usage_millis"`
	CpuCapacityMillis int64     `json:"cpu_capacity_millis"`
	MemUsageMi        int64     `json:"mem_usage_mi"`
	MemCapacityMi     int64     `json:"mem_capacity_mi"`
	MetricsAvailable  bool      `json:"metrics_available"`
	Unschedulable     bool      `json:"unschedulable"`
}
