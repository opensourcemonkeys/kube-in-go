package models

type StorageClassInfo struct {
	Name              string `json:"name"`
	Provisioner       string `json:"provisioner"`
	ReclaimPolicy     string `json:"reclaim_policy"`
	VolumeBindingMode string `json:"volume_binding_mode"`
	IsDefault         bool   `json:"is_default"`
	CreatedAt         string `json:"created_at"`
}
