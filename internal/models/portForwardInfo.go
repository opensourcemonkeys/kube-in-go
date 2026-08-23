package models

// PortForwardInfo is one live tunnel in the process-wide port-forward registry.
//
// Unlike log and exec sessions, a forward is not owned by the panel that started
// it: the user starts `localhost:8080 -> svc/api:80`, closes the tab and goes on
// working in their browser. Killing the tunnel on panel dispose would be
// indistinguishable from a fault, so the registry outlives every panel and only
// the user (or process exit) stops a forward.
type PortForwardInfo struct {
	ID          string `json:"id"`
	ClusterName string `json:"cluster_name"`
	Namespace   string `json:"namespace"`

	// ResourceKind is what the user selected: pod | deployment | statefulset |
	// replicaset | service. Only Pod can actually be forwarded to, so anything
	// else is resolved to a pod at start time and again on every reconnect.
	ResourceKind string `json:"resource_kind"`
	ResourceName string `json:"resource_name"`

	// PodName is the pod currently carrying the tunnel. It changes across a
	// reconnect, which is the whole point of reconnecting for workload targets.
	PodName string `json:"pod_name"`

	// LocalPort is the port actually bound — never 0 once Status is "ready",
	// even when the user asked for an automatic port. It stays fixed across
	// reconnects so an open browser tab or curl keeps working.
	LocalPort int `json:"local_port"`

	// RemotePort is what the user picked. For a Service target that is the
	// service port; TargetPort is what it resolved to on the pod.
	RemotePort int `json:"remote_port"`
	TargetPort int `json:"target_port"`

	// Address is always 127.0.0.1. It is a field so the UI can show it rather
	// than hardcode it — a forwarded port is unauthenticated access to a
	// cluster workload, and the user should see where it is exposed.
	Address string `json:"address"`

	// Status is one of: starting | ready | reconnecting | error | closed.
	Status string `json:"status"`
	Error  string `json:"error"`

	StartedAt string `json:"started_at"` // RFC3339

	// Attempts counts reconnects performed so far.
	Attempts int `json:"attempts"`

	// Hint is "http", "https" or "" — whether this tunnel is worth an "Open in
	// browser" button. Derived from the port number alone, so it is a
	// convenience and never the only way to reach a forward: "Copy address" is
	// always offered.
	Hint string `json:"hint"`

	// Reconnect records the lifecycle rule that was applied: true for workload
	// and service targets (re-resolve a pod and reconnect), false for a pod the
	// user pinned by name (a deleted pod is gone; silently moving to a
	// different one would be the wrong answer).
	Reconnect bool `json:"reconnect"`
}

// PortOption is one entry in the port-forward dialog's remote-port picker.
// Offering the target's real ports is what removes the "which port is this
// service on again?" step that sends people back to kubectl.
type PortOption struct {
	Name          string `json:"name"`     // container/service port name ("http", "metrics")
	Port          int    `json:"port"`     // the port the user picks
	Protocol      string `json:"protocol"` // TCP | UDP — UDP cannot be forwarded
	ContainerName string `json:"container_name"`

	// Hint is "http", "https" or "". It decides whether the forward gets an
	// "Open in browser" action; pointing a browser at a Postgres port helps
	// nobody.
	Hint string `json:"hint"`
}
