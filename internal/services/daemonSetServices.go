package services_k8sclient

import (
	"context"
	"fmt"
	"kube-ins/internal/models"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

func GetDaemonSets(namespace string, client *kubernetes.Clientset) ([]models.DaemonSetInfo, error) {
	list, err := client.AppsV1().DaemonSets(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	infos := make([]models.DaemonSetInfo, 0, len(list.Items))
	for _, d := range list.Items {
		infos = append(infos, daemonSetToInfo(d))
	}
	return infos, nil
}

func DeleteDaemonSet(namespace, name string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return fmt.Errorf("namespace and name are required")
	}
	return client.AppsV1().DaemonSets(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{})
}

func GetDaemonSetYaml(namespace, name string, client *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", fmt.Errorf("namespace and name are required")
	}
	d, err := client.AppsV1().DaemonSets(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	yamlBytes, err := yaml.Marshal(d)
	if err != nil {
		return "", err
	}
	return string(yamlBytes), nil
}

func UpdateDaemonSetYaml(namespace, name, yamlContent string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return fmt.Errorf("namespace and name are required")
	}

	var ds appsv1.DaemonSet
	if err := yaml.Unmarshal([]byte(yamlContent), &ds); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}

	ds.Namespace = namespace
	ds.Name = name

	_, err := client.AppsV1().DaemonSets(namespace).Update(context.TODO(), &ds, metav1.UpdateOptions{})
	return err
}

func daemonSetToInfo(d appsv1.DaemonSet) models.DaemonSetInfo {
	return models.DaemonSetInfo{
		Name:                   d.Name,
		Namespace:              d.Namespace,
		DesiredNumberScheduled: d.Status.DesiredNumberScheduled,
		CurrentNumberScheduled: d.Status.CurrentNumberScheduled,
		NumberReady:            d.Status.NumberReady,
		NumberAvailable:        d.Status.NumberAvailable,
		CreatedAt:              d.CreationTimestamp.Time,
	}
}
