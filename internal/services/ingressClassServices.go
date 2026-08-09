package services_k8sclient

import (
	"context"
	"fmt"
	"kube-ins/internal/models"
	"time"

	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

func GetIngressClasses(client *kubernetes.Clientset) ([]models.IngressClassInfo, error) {
	list, err := client.NetworkingV1().IngressClasses().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	infos := make([]models.IngressClassInfo, 0, len(list.Items))
	for _, ic := range list.Items {
		infos = append(infos, ingressClassToInfo(ic))
	}
	return infos, nil
}

func GetIngressClassYaml(name string, client *kubernetes.Clientset) (string, error) {
	if name == "" {
		return "", errNamespaceNameRequired
	}
	ic, err := client.NetworkingV1().IngressClasses().Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(ic)
}

func UpdateIngressClassYaml(name, yamlContent string, client *kubernetes.Clientset) error {
	if name == "" {
		return errNamespaceNameRequired
	}
	var ic networkingv1.IngressClass
	if err := yaml.Unmarshal([]byte(yamlContent), &ic); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}
	ic.Name = name
	_, err := client.NetworkingV1().IngressClasses().Update(context.Background(), &ic, metav1.UpdateOptions{})
	return err
}

func ingressClassToInfo(ic networkingv1.IngressClass) models.IngressClassInfo {
	isDefault := ic.Annotations["ingressclass.kubernetes.io/is-default-class"] == "true"

	return models.IngressClassInfo{
		Name:       ic.Name,
		Controller: ic.Spec.Controller,
		IsDefault:  isDefault,
		CreatedAt:  ic.CreationTimestamp.Time.Format(time.RFC3339),
	}
}
