package services_k8sclient

import (
	"time"
	"context"
	"fmt"
	"kube-ins/internal/models"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

func GetReplicaSets(namespace string, client *kubernetes.Clientset) ([]models.ReplicaSetInfo, error) {
	list, err := client.AppsV1().ReplicaSets(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	infos := make([]models.ReplicaSetInfo, 0, len(list.Items))
	for _, r := range list.Items {
		infos = append(infos, replicaSetToInfo(r))
	}
	return infos, nil
}

func DeleteReplicaSet(namespace, name string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}
	return client.AppsV1().ReplicaSets(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{})
}

func GetReplicaSetYaml(namespace, name string, client *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", errNamespaceNameRequired
	}
	r, err := client.AppsV1().ReplicaSets(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(r)
}

func UpdateReplicaSetYaml(namespace, name, yamlContent string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}

	var rs appsv1.ReplicaSet
	if err := yaml.Unmarshal([]byte(yamlContent), &rs); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}

	rs.Namespace = namespace
	rs.Name = name

	_, err := client.AppsV1().ReplicaSets(namespace).Update(context.TODO(), &rs, metav1.UpdateOptions{})
	return err
}

func replicaSetToInfo(r appsv1.ReplicaSet) models.ReplicaSetInfo {
	var replicas int32
	if r.Spec.Replicas != nil {
		replicas = *r.Spec.Replicas
	}
	return models.ReplicaSetInfo{
		Name:              r.Name,
		Namespace:         r.Namespace,
		Replicas:          replicas,
		ReadyReplicas:     r.Status.ReadyReplicas,
		AvailableReplicas: r.Status.AvailableReplicas,
		CreatedAt:         r.CreationTimestamp.Time.Format(time.RFC3339),
	}
}
