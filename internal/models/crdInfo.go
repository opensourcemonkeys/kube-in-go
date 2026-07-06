package models

// CRDInfo describes a CustomResourceDefinition for the CRD list view. The list
// is grouped by Group (the API group, e.g. "cert-manager.io").
type CRDInfo struct {
	Name    string `json:"name"`    // e.g. certificates.cert-manager.io
	Group   string `json:"group"`   // e.g. cert-manager.io (grouping field)
	Kind    string `json:"kind"`    // e.g. Certificate
	Plural  string `json:"plural"`  // e.g. certificates (used as the resource for listing CRs)
	Scope   string `json:"scope"`   // Namespaced | Cluster
	Version string `json:"version"` // served/storage version, e.g. v1
	Age     string `json:"age"`     // human-readable age, e.g. 5d
}

// CustomResourceInfo describes a single custom resource instance of a CRD.
type CustomResourceInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Age       string `json:"age"`
}
