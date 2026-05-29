package models



type NetworkPolicyInfo struct {
	Name             string    `json:"name"`
	Namespace        string    `json:"namespace"`
	PodSelector      string    `json:"pod_selector"`
	PolicyTypes      []string  `json:"policy_types"`
	IngressRuleCount int       `json:"ingress_rule_count"`
	EgressRuleCount  int       `json:"egress_rule_count"`
	CreatedAt string `json:"created_at"`
}

type NetworkPolicyPeer struct {
	NamespaceSelector string   `json:"namespace_selector"`
	PodSelector       string   `json:"pod_selector"`
	IPBlock           string   `json:"ip_block"`
	IPBlockExcept     []string `json:"ip_block_except"`
}

type NetworkPolicyRuleInfo struct {
	Ports []string            `json:"ports"`
	Peers []NetworkPolicyPeer `json:"peers"`
}

type NetworkPolicyDetail struct {
	Name         string                  `json:"name"`
	Namespace    string                  `json:"namespace"`
	PodSelector  string                  `json:"pod_selector"`
	PolicyTypes  []string                `json:"policy_types"`
	IngressRules []NetworkPolicyRuleInfo `json:"ingress_rules"`
	EgressRules  []NetworkPolicyRuleInfo `json:"egress_rules"`
}
