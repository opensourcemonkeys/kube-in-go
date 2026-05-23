package services_k8sclient

import (
	"context"
	"fmt"
	"kube-ins/internal/models"
	"strings"

	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

const allPodsSelector = "<all pods>"
const allNamespacesSelector = "<all namespaces>"

func DeleteNetworkPolicy(namespace, name string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}
	return client.NetworkingV1().NetworkPolicies(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{})
}

func ParseNetworkPolicyYaml(yamlContent string) (*models.NetworkPolicyDetail, error) {
	var policy networkingv1.NetworkPolicy
	if err := yaml.Unmarshal([]byte(yamlContent), &policy); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	detail := &models.NetworkPolicyDetail{
		Name:        policy.Name,
		Namespace:   policy.Namespace,
		PodSelector: labelsMapToString(policy.Spec.PodSelector.MatchLabels),
		PolicyTypes: policyTypesToStrings(policy.Spec.PolicyTypes),
	}
	for _, rule := range policy.Spec.Ingress {
		detail.IngressRules = append(detail.IngressRules, ingressRuleToInfo(rule))
	}
	for _, rule := range policy.Spec.Egress {
		detail.EgressRules = append(detail.EgressRules, egressRuleToInfo(rule))
	}
	return detail, nil
}

func GetNetworkPolicies(namespace string, client *kubernetes.Clientset) ([]models.NetworkPolicyInfo, error) {
	policies, err := client.NetworkingV1().NetworkPolicies(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	infos := make([]models.NetworkPolicyInfo, 0, len(policies.Items))
	for _, p := range policies.Items {
		infos = append(infos, networkPolicyToInfo(p))
	}
	return infos, nil
}

func GetNetworkPolicyYaml(namespace, name string, client *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", errNamespaceNameRequired
	}
	p, err := client.NetworkingV1().NetworkPolicies(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	b, err := yaml.Marshal(p)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func UpdateNetworkPolicyYaml(namespace, name, yamlContent string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}
	var policy networkingv1.NetworkPolicy
	if err := yaml.Unmarshal([]byte(yamlContent), &policy); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}
	policy.Namespace = namespace
	policy.Name = name
	_, err := client.NetworkingV1().NetworkPolicies(namespace).Update(context.TODO(), &policy, metav1.UpdateOptions{})
	return err
}

func GetNetworkPolicyDetail(namespace, name string, client *kubernetes.Clientset) (*models.NetworkPolicyDetail, error) {
	if namespace == "" || name == "" {
		return nil, errNamespaceNameRequired
	}
	p, err := client.NetworkingV1().NetworkPolicies(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	detail := &models.NetworkPolicyDetail{
		Name:        p.Name,
		Namespace:   p.Namespace,
		PodSelector: labelsMapToString(p.Spec.PodSelector.MatchLabels),
		PolicyTypes: policyTypesToStrings(p.Spec.PolicyTypes),
	}

	for _, rule := range p.Spec.Ingress {
		detail.IngressRules = append(detail.IngressRules, ingressRuleToInfo(rule))
	}
	for _, rule := range p.Spec.Egress {
		detail.EgressRules = append(detail.EgressRules, egressRuleToInfo(rule))
	}
	return detail, nil
}

func networkPolicyToInfo(p networkingv1.NetworkPolicy) models.NetworkPolicyInfo {
	return models.NetworkPolicyInfo{
		Name:             p.Name,
		Namespace:        p.Namespace,
		PodSelector:      labelsMapToString(p.Spec.PodSelector.MatchLabels),
		PolicyTypes:      policyTypesToStrings(p.Spec.PolicyTypes),
		IngressRuleCount: len(p.Spec.Ingress),
		EgressRuleCount:  len(p.Spec.Egress),
		CreatedAt:        p.CreationTimestamp.Time,
	}
}

func labelsMapToString(labels map[string]string) string {
	if len(labels) == 0 {
		return allPodsSelector
	}
	parts := make([]string, 0, len(labels))
	for k, v := range labels {
		parts = append(parts, k+"="+v)
	}
	return strings.Join(parts, ", ")
}

func policyTypesToStrings(types []networkingv1.PolicyType) []string {
	result := make([]string, len(types))
	for i, t := range types {
		result[i] = string(t)
	}
	return result
}

func ingressRuleToInfo(rule networkingv1.NetworkPolicyIngressRule) models.NetworkPolicyRuleInfo {
	info := models.NetworkPolicyRuleInfo{
		Ports: npPortsToStrings(rule.Ports),
	}
	for _, from := range rule.From {
		peer := models.NetworkPolicyPeer{}
		if from.NamespaceSelector != nil {
			peer.NamespaceSelector = labelsMapToString(from.NamespaceSelector.MatchLabels)
		}
		if from.PodSelector != nil {
			peer.PodSelector = labelsMapToString(from.PodSelector.MatchLabels)
		}
		if from.IPBlock != nil {
			peer.IPBlock = from.IPBlock.CIDR
			peer.IPBlockExcept = from.IPBlock.Except
		}
		info.Peers = append(info.Peers, peer)
	}
	if len(rule.From) == 0 {
		info.Peers = []models.NetworkPolicyPeer{{NamespaceSelector: allNamespacesSelector, PodSelector: allPodsSelector}}
	}
	return info
}

func egressRuleToInfo(rule networkingv1.NetworkPolicyEgressRule) models.NetworkPolicyRuleInfo {
	info := models.NetworkPolicyRuleInfo{
		Ports: npPortsToStrings(rule.Ports),
	}
	for _, to := range rule.To {
		peer := models.NetworkPolicyPeer{}
		if to.NamespaceSelector != nil {
			peer.NamespaceSelector = labelsMapToString(to.NamespaceSelector.MatchLabels)
		}
		if to.PodSelector != nil {
			peer.PodSelector = labelsMapToString(to.PodSelector.MatchLabels)
		}
		if to.IPBlock != nil {
			peer.IPBlock = to.IPBlock.CIDR
			peer.IPBlockExcept = to.IPBlock.Except
		}
		info.Peers = append(info.Peers, peer)
	}
	if len(rule.To) == 0 {
		info.Peers = []models.NetworkPolicyPeer{{NamespaceSelector: allNamespacesSelector, PodSelector: allPodsSelector}}
	}
	return info
}

func npPortsToStrings(ports []networkingv1.NetworkPolicyPort) []string {
	result := make([]string, 0, len(ports))
	for _, p := range ports {
		proto := "TCP"
		if p.Protocol != nil {
			proto = string(*p.Protocol)
		}
		port := "*"
		if p.Port != nil {
			port = p.Port.String()
		}
		result = append(result, proto+"/"+port)
	}
	if len(result) == 0 {
		return []string{"all ports"}
	}
	return result
}
