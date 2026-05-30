package models

type IngressRuleInfo struct {
	Host  string   `json:"host"`
	Paths []string `json:"paths"`
}

type IngressInfo struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	ClassName string            `json:"class_name"`
	Rules     []IngressRuleInfo `json:"rules"`
	TLS       bool              `json:"tls"`
	Address   string            `json:"address"`
	CreatedAt string            `json:"created_at"`
}
