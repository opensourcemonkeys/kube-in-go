package models



type ConfigMapInfo struct {
	Name      string    `json:"name"`
	Namespace string    `json:"namespace"`
	DataCount int       `json:"data_count"`
	CreatedAt string `json:"created_at"`
}
