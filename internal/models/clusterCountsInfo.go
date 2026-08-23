package models

// ClusterCounts is the Overview dashboard's tile row: how many of each kind the
// cluster has, and nothing else.
//
// It exists so the dashboard does not have to pull six full resource listings
// every tick just to call `.length` on each of them — a pod list on a busy
// cluster is megabytes of JSON crossing the RPC boundary to produce one integer.
type ClusterCounts struct {
	Pods        int `json:"pods"`
	Deployments int `json:"deployments"`
	Services    int `json:"services"`
	Nodes       int `json:"nodes"`
	Namespaces  int `json:"namespaces"`
}
