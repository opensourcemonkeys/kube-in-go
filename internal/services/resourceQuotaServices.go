package services_k8sclient

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

func GetResourceQuotaYaml(name, namespace string, k8sClient *kubernetes.Clientset) (string, error) {
	rq, err := k8sClient.CoreV1().ResourceQuotas(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(rq)
}

func UpdateResourceQuotaYaml(name, namespace, yamlContent string, k8sClient *kubernetes.Clientset) error {
	var rq corev1.ResourceQuota
	if err := yaml.Unmarshal([]byte(yamlContent), &rq); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}
	rq.Name = name
	rq.Namespace = namespace
	_, err := k8sClient.CoreV1().ResourceQuotas(namespace).Update(context.TODO(), &rq, metav1.UpdateOptions{})
	return err
}
