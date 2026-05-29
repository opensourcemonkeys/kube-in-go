package models



type CronJobInfo struct {
	Name             string     `json:"name"`
	Namespace        string     `json:"namespace"`
	Schedule         string     `json:"schedule"`
	Suspend          bool       `json:"suspend"`
	ActiveCount      int        `json:"active_count"`
	LastScheduleTime string `json:"last_schedule_time"`
	CreatedAt string  `json:"created_at"`
}
