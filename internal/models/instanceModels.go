package models

// InstanceInfo describes a running kube-ins instance visible on the hub.
type InstanceInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// SerializedPanel carries all state needed to recreate a Dockview panel
// in a different instance.
type SerializedPanel struct {
	ComponentType string         `json:"componentType"`
	Title         string         `json:"title"`
	Params        map[string]any `json:"params"`
}
