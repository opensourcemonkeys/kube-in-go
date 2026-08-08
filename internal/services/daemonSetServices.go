package services_k8sclient

import (
	"context"
	"fmt"
	"kube-ins/internal/models"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

func GetDaemonSets(namespace string, client *kubernetes.Clientset) ([]models.DaemonSetInfo, error) {
	list, err := client.AppsV1().DaemonSets(namespace).List(context.Background(), metav1.ListOptions{})
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
		return errNamespaceNameRequired
	}
	return client.AppsV1().DaemonSets(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
}

func GetDaemonSetYaml(namespace, name string, client *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", errNamespaceNameRequired
	}
	d, err := client.AppsV1().DaemonSets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(d)
}

func UpdateDaemonSetYaml(namespace, name, yamlContent string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}

	var ds appsv1.DaemonSet
	if err := yaml.Unmarshal([]byte(yamlContent), &ds); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}

	ds.Namespace = namespace
	ds.Name = name

	_, err := client.AppsV1().DaemonSets(namespace).Update(context.Background(), &ds, metav1.UpdateOptions{})
	return err
}

func daemonSetToInfo(d appsv1.DaemonSet) models.DaemonSetInfo {
	status := "Available"
	switch {
	case d.Status.DesiredNumberScheduled == 0:
		status = "Not Scheduled"
	case d.Status.NumberReady == d.Status.DesiredNumberScheduled:
		status = "Available"
	case d.Status.NumberReady < d.Status.DesiredNumberScheduled:
		status = "Degraded"
	}
	return models.DaemonSetInfo{
		Name:                   d.Name,
		Namespace:              d.Namespace,
		DesiredNumberScheduled: d.Status.DesiredNumberScheduled,
		CurrentNumberScheduled: d.Status.CurrentNumberScheduled,
		NumberReady:            d.Status.NumberReady,
		NumberAvailable:        d.Status.NumberAvailable,
		Status:                 status,
		CreatedAt:              d.CreationTimestamp.Time.Format(time.RFC3339),
	}
}
