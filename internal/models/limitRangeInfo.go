package models

type LimitRangeItemInfo struct {
	Type           string            `json:"type"`
	Max            map[string]string `json:"max"`
	Min            map[string]string `json:"min"`
	Default        map[string]string `json:"default"`
	DefaultRequest map[string]string `json:"default_request"`
}

type LimitRangeInfo struct {
	Name      string               `json:"name"`
	Namespace string               `json:"namespace"`
	Limits    []LimitRangeItemInfo `json:"limits"`
	CreatedAt string               `json:"created_at"`
}
