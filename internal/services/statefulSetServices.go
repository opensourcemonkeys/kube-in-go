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

func GetStatefulSets(namespace string, client *kubernetes.Clientset) ([]models.StatefulSetInfo, error) {
	list, err := client.AppsV1().StatefulSets(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	infos := make([]models.StatefulSetInfo, 0, len(list.Items))
	for _, s := range list.Items {
		infos = append(infos, statefulSetToInfo(s))
	}
	return infos, nil
}

func DeleteStatefulSet(namespace, name string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}
	return client.AppsV1().StatefulSets(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
}

func GetStatefulSetYaml(namespace, name string, client *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", errNamespaceNameRequired
	}
	s, err := client.AppsV1().StatefulSets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(s)
}

func UpdateStatefulSetYaml(namespace, name, yamlContent string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}

	var ss appsv1.StatefulSet
	if err := yaml.Unmarshal([]byte(yamlContent), &ss); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}

	ss.Namespace = namespace
	ss.Name = name

	_, err := client.AppsV1().StatefulSets(namespace).Update(context.Background(), &ss, metav1.UpdateOptions{})
	return err
}

func statefulSetToInfo(s appsv1.StatefulSet) models.StatefulSetInfo {
	var replicas int32
	if s.Spec.Replicas != nil {
		replicas = *s.Spec.Replicas
	}
	status := "Available"
	switch {
	case replicas == 0:
		status = "Scaled Down"
	case s.Status.ReadyReplicas == replicas && s.Status.UpdatedReplicas == replicas:
		status = "Available"
	case s.Status.UpdatedReplicas < replicas:
		status = "Progressing"
	case s.Status.ReadyReplicas < replicas:
		status = "Degraded"
	}
	return models.StatefulSetInfo{
		Name:            s.Name,
		Namespace:       s.Namespace,
		Replicas:        replicas,
		ReadyReplicas:   s.Status.ReadyReplicas,
		CurrentReplicas: s.Status.CurrentReplicas,
		UpdatedReplicas: s.Status.UpdatedReplicas,
		Status:          status,
		CreatedAt:       s.CreationTimestamp.Time.Format(time.RFC3339),
	}
}
