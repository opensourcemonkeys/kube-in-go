package models

type IngressClassInfo struct {
	Name        string `json:"name"`
	Controller  string `json:"controller"`
	IsDefault   bool   `json:"is_default"`
	CreatedAt   string `json:"created_at"`
}
