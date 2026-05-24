package models

import "time"

type SecretInfo struct {
	Name      string    `json:"name"`
	Namespace string    `json:"namespace"`
	Type      string    `json:"type"`
	DataCount int       `json:"data_count"`
	CreatedAt time.Time `json:"created_at"`
}
