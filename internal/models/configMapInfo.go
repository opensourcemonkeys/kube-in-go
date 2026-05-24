package models

import "time"

type ConfigMapInfo struct {
	Name      string    `json:"name"`
	Namespace string    `json:"namespace"`
	DataCount int       `json:"data_count"`
	CreatedAt time.Time `json:"created_at"`
}
