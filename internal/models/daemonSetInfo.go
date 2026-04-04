package models

import "time"

type DaemonSetInfo struct {
	Name                   string    `json:"name"`
	Namespace              string    `json:"namespace"`
	DesiredNumberScheduled int32     `json:"desired_number_scheduled"`
	CurrentNumberScheduled int32     `json:"current_number_scheduled"`
	NumberReady            int32     `json:"number_ready"`
	NumberAvailable        int32     `json:"number_available"`
	CreatedAt              time.Time `json:"created_at"`
}
