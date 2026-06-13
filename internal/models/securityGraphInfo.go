package models

// SecurityNode is a node in the RBAC "Security Role Map" graph. Kind is one of
// "ServiceAccount", "RoleBinding", "Role", "ClusterRole", "Resource".
type SecurityNode struct {
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	// Verbs is the comma-separated permission set for Resource nodes (shown
	// inside the node instead of on the grant arrow).
	Verbs string `json:"verbs,omitempty"`
	// Group and Resource identify the backing Kubernetes object so the UI can
	// view/edit its YAML. Set on real-object nodes (ServiceAccount, Role,
	// RoleBinding, ClusterRole and the actual Object instances); empty on
	// Resource-type nodes and the "+N more" placeholder.
	Group    string `json:"group,omitempty"`
	Resource string `json:"resource,omitempty"`
}

// SecurityEdge connects two SecurityNodes. Kind is one of "subject" (SA→RoleBinding),
// "roleref" (RoleBinding→Role/ClusterRole) or "grants" (Role/ClusterRole→Resource).
// Label carries the allowed verbs (comma separated) on "grants" edges.
type SecurityEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Kind   string `json:"kind"`
	Label  string `json:"label,omitempty"`
}

type SecurityGraph struct {
	Nodes []SecurityNode `json:"nodes"`
	Edges []SecurityEdge `json:"edges"`
}
