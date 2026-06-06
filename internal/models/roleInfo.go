package models

type PolicyRuleInfo struct {
	APIGroups     []string `json:"api_groups"`
	Resources     []string `json:"resources"`
	Verbs         []string `json:"verbs"`
	ResourceNames []string `json:"resource_names"`
}

type RoleInfo struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Rules       []PolicyRuleInfo  `json:"rules"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"created_at"`
}
