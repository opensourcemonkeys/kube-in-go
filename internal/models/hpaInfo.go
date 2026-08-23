package models

// HPAInfo is the subset of a HorizontalPodAutoscaler the scale dialog needs to
// warn that a manual replica change will be reverted.
type HPAInfo struct {
	Name        string `json:"name"`
	MinReplicas int32  `json:"min_replicas"`
	MaxReplicas int32  `json:"max_replicas"`
}
