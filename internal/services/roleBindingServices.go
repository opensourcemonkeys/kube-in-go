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

func GetRoleBindings(namespace string, client *kubernetes.Clientset) ([]models.RoleBindingInfo, error) {
	list, err := client.RbacV1().RoleBindings(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	infos := make([]models.RoleBindingInfo, 0, len(list.Items))
	for _, rb := range list.Items {
		infos = append(infos, roleBindingToInfo(rb))
	}
	return infos, nil
}

func GetRoleBindingYaml(namespace, name string, client *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", errNamespaceRoleBindingRequired
	}
	rb, err := client.RbacV1().RoleBindings(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(rb)
}

func UpdateRoleBindingYaml(namespace, name, yamlContent string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceRoleBindingRequired
	}
	var rb rbacv1.RoleBinding
	if err := yaml.Unmarshal([]byte(yamlContent), &rb); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}
	rb.Namespace = namespace
	rb.Name = name
	_, err := client.RbacV1().RoleBindings(namespace).Update(context.Background(), &rb, metav1.UpdateOptions{})
	return err
}

func DeleteRoleBinding(namespace, name string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceRoleBindingRequired
	}
	return client.RbacV1().RoleBindings(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
}

func UpdateRoleBinding(namespace, name string, labels, annotations map[string]string, subjects []models.SubjectInfo, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceRoleBindingRequired
	}
	rb, err := client.RbacV1().RoleBindings(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	rb.Labels = labels
	rb.Annotations = annotations
	rb.Subjects = subjectsToK8s(subjects)
	_, err = client.RbacV1().RoleBindings(namespace).Update(context.Background(), rb, metav1.UpdateOptions{})
	return err
}

func roleBindingToInfo(rb rbacv1.RoleBinding) models.RoleBindingInfo {
	subjects := make([]models.SubjectInfo, 0, len(rb.Subjects))
	for _, s := range rb.Subjects {
		subjects = append(subjects, models.SubjectInfo{
			Kind:      s.Kind,
			Name:      s.Name,
			Namespace: s.Namespace,
		})
	}
	return models.RoleBindingInfo{
		Name:        rb.Name,
		Namespace:   rb.Namespace,
		RoleRefKind: rb.RoleRef.Kind,
		RoleRefName: rb.RoleRef.Name,
		Subjects:    subjects,
		Labels:      rb.Labels,
		Annotations: rb.Annotations,
		CreatedAt:   rb.CreationTimestamp.Time.Format(time.RFC3339),
	}
}

func subjectsToK8s(subjects []models.SubjectInfo) []rbacv1.Subject {
	k8sSubjects := make([]rbacv1.Subject, 0, len(subjects))
	for _, s := range subjects {
		k8sSubjects = append(k8sSubjects, rbacv1.Subject{
			Kind:      s.Kind,
			Name:      s.Name,
			Namespace: s.Namespace,
		})
	}
	return k8sSubjects
}
