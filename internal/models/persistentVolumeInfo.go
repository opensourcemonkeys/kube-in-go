package models

type PersistentVolumeInfo struct {
	Name             string   `json:"name"`
	Status           string   `json:"status"`
	Capacity         string   `json:"capacity"`
	AccessModes      []string `json:"access_modes"`
	ReclaimPolicy    string   `json:"reclaim_policy"`
	StorageClassName string   `json:"storage_class_name"`
	VolumeMode       string   `json:"volume_mode"`
	ClaimRef         string   `json:"claim_ref"`
	CreatedAt        string   `json:"created_at"`
}
