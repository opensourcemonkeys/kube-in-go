package services_k8sclient

import (
	"context"
	"fmt"
	"time"

	"kube-ins/internal/models"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

func GetServiceAccounts(namespace string, client *kubernetes.Clientset) ([]models.ServiceAccountInfo, error) {
	list, err := client.CoreV1().ServiceAccounts(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	infos := make([]models.ServiceAccountInfo, 0, len(list.Items))
	for _, sa := range list.Items {
		infos = append(infos, serviceAccountToInfo(sa))
	}
	return infos, nil
}

func GetServiceAccountYaml(namespace, name string, client *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", errNamespaceServiceAccountRequired
	}
	sa, err := client.CoreV1().ServiceAccounts(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(sa)
}

func UpdateServiceAccountYaml(namespace, name, yamlContent string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceServiceAccountRequired
	}
	var sa corev1.ServiceAccount
	if err := yaml.Unmarshal([]byte(yamlContent), &sa); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}
	sa.Namespace = namespace
	sa.Name = name
	_, err := client.CoreV1().ServiceAccounts(namespace).Update(context.Background(), &sa, metav1.UpdateOptions{})
	return err
}

func DeleteServiceAccount(namespace, name string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceServiceAccountRequired
	}
	return client.CoreV1().ServiceAccounts(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
}

func UpdateServiceAccount(namespace, name string, labels, annotations map[string]string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceServiceAccountRequired
	}
	sa, err := client.CoreV1().ServiceAccounts(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	sa.Labels = labels
	sa.Annotations = annotations
	_, err = client.CoreV1().ServiceAccounts(namespace).Update(context.Background(), sa, metav1.UpdateOptions{})
	return err
}

func serviceAccountToInfo(sa corev1.ServiceAccount) models.ServiceAccountInfo {
	return models.ServiceAccountInfo{
		Name:        sa.Name,
		Namespace:   sa.Namespace,
		Secrets:     len(sa.Secrets),
		Labels:      sa.Labels,
		Annotations: sa.Annotations,
		CreatedAt:   sa.CreationTimestamp.Time.Format(time.RFC3339),
	}
}
