package models

type PersistentVolumeClaimInfo struct {
	Name             string   `json:"name"`
	Namespace        string   `json:"namespace"`
	Status           string   `json:"status"`
	VolumeName       string   `json:"volume_name"`
	StorageClassName string   `json:"storage_class_name"`
	AccessModes      []string `json:"access_modes"`
	Request          string   `json:"request"`
	Limit            string   `json:"limit"`
	CreatedAt        string   `json:"created_at"`
}
