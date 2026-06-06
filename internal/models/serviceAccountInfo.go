package models

type ServiceAccountInfo struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Secrets     int               `json:"secrets"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"created_at"`
}
