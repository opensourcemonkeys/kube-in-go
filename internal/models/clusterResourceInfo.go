package models

type ResourceNode struct {
	ID        string            `json:"id"`
	Kind      string            `json:"kind"`
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Labels    map[string]string `json:"labels"`
	Selector  map[string]string `json:"selector,omitempty"`
	Status    string            `json:"status,omitempty"`
}

type ResourceEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Kind   string `json:"kind"` // "owner", "selector", "ingress"
}

type ClusterGraph struct {
	Nodes []ResourceNode `json:"nodes"`
	Edges []ResourceEdge `json:"edges"`
}
