package services_k8sclient

import (
	"context"
	"fmt"
	"time"

	"kube-ins/internal/models"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

func GetRoles(namespace string, client *kubernetes.Clientset) ([]models.RoleInfo, error) {
	list, err := client.RbacV1().Roles(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	infos := make([]models.RoleInfo, 0, len(list.Items))
	for _, r := range list.Items {
		infos = append(infos, roleToInfo(r))
	}
	return infos, nil
}

func GetRoleYaml(namespace, name string, client *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", errNamespaceRoleRequired
	}
	r, err := client.RbacV1().Roles(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(r)
}

func UpdateRoleYaml(namespace, name, yamlContent string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceRoleRequired
	}
	var r rbacv1.Role
	if err := yaml.Unmarshal([]byte(yamlContent), &r); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}
	r.Namespace = namespace
	r.Name = name
	_, err := client.RbacV1().Roles(namespace).Update(context.Background(), &r, metav1.UpdateOptions{})
	return err
}

func DeleteRole(namespace, name string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceRoleRequired
	}
	return client.RbacV1().Roles(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
}

func UpdateRole(namespace, name string, labels, annotations map[string]string, rules []models.PolicyRuleInfo, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceRoleRequired
	}
	r, err := client.RbacV1().Roles(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	r.Labels = labels
	r.Annotations = annotations
	r.Rules = policyRulesToK8s(rules)
	_, err = client.RbacV1().Roles(namespace).Update(context.Background(), r, metav1.UpdateOptions{})
	return err
}

func roleToInfo(r rbacv1.Role) models.RoleInfo {
	rules := make([]models.PolicyRuleInfo, 0, len(r.Rules))
	for _, pr := range r.Rules {
		rules = append(rules, models.PolicyRuleInfo{
			APIGroups:     pr.APIGroups,
			Resources:     pr.Resources,
			Verbs:         pr.Verbs,
			ResourceNames: pr.ResourceNames,
		})
	}
	return models.RoleInfo{
		Name:        r.Name,
		Namespace:   r.Namespace,
		Rules:       rules,
		Labels:      r.Labels,
		Annotations: r.Annotations,
		CreatedAt:   r.CreationTimestamp.Time.Format(time.RFC3339),
	}
}

func policyRulesToK8s(rules []models.PolicyRuleInfo) []rbacv1.PolicyRule {
	k8sRules := make([]rbacv1.PolicyRule, 0, len(rules))
	for _, r := range rules {
		k8sRules = append(k8sRules, rbacv1.PolicyRule{
			APIGroups:     r.APIGroups,
			Resources:     r.Resources,
			Verbs:         r.Verbs,
			ResourceNames: r.ResourceNames,
		})
	}
	return k8sRules
}
