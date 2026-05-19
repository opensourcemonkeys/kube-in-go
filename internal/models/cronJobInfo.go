package models

import "time"

type CronJobInfo struct {
	Name             string     `json:"name"`
	Namespace        string     `json:"namespace"`
	Schedule         string     `json:"schedule"`
	Suspend          bool       `json:"suspend"`
	ActiveCount      int        `json:"active_count"`
	LastScheduleTime *time.Time `json:"last_schedule_time"`
	CreatedAt        time.Time  `json:"created_at"`
}
