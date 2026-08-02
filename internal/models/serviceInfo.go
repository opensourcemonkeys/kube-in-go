package models

type ServicePortInfo struct {
	Port       int32  `json:"port"`
	TargetPort string `json:"target_port"`
	Protocol   string `json:"protocol"`
	NodePort   int32  `json:"node_port"`
}

type ServiceInfo struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Type        string            `json:"type"`
	Status      string            `json:"status"`
	ClusterIP   string            `json:"cluster_ip"`
	ExternalIPs []string          `json:"external_ips"`
	Ports       []ServicePortInfo `json:"ports"`
	CreatedAt   string            `json:"created_at"`
}
