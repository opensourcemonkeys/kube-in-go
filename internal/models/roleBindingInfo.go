package models

type SubjectInfo struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

type RoleBindingInfo struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	RoleRefKind string            `json:"role_ref_kind"`
	RoleRefName string            `json:"role_ref_name"`
	Subjects    []SubjectInfo     `json:"subjects"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"created_at"`
}
