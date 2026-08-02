package models

type JobInfo struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	Completions int32  `json:"completions"`
	Succeeded   int32  `json:"succeeded"`
	Failed      int32  `json:"failed"`
	Active      int32  `json:"active"`
	Status      string `json:"status"`
	CreatedAt   string `json:"created_at"`
}
