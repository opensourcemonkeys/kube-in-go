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

func GetDeployments(namespace string, client *kubernetes.Clientset) ([]models.DeploymentInfo, error) {
	deployments, err := client.AppsV1().Deployments(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	infos := make([]models.DeploymentInfo, 0, len(deployments.Items))
	for _, d := range deployments.Items {
		infos = append(infos, deploymentToInfo(d))
	}
	return infos, nil
}

func DeleteDeployment(namespace, name string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceDeploymentRequired
	}
	return client.AppsV1().Deployments(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{})
}

func GetDeploymentYaml(namespace, name string, client *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", errNamespaceDeploymentRequired
	}
	d, err := client.AppsV1().Deployments(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(d)
}

func UpdateDeploymentYaml(namespace, name, yamlContent string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceDeploymentRequired
	}

	var deployment appsv1.Deployment
	if err := yaml.Unmarshal([]byte(yamlContent), &deployment); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}

	deployment.Namespace = namespace
	deployment.Name = name

	_, err := client.AppsV1().Deployments(namespace).Update(context.TODO(), &deployment, metav1.UpdateOptions{})
	return err
}

func deploymentToInfo(d appsv1.Deployment) models.DeploymentInfo {
	var replicas int32
	if d.Spec.Replicas != nil {
		replicas = *d.Spec.Replicas
	}
	status := "Available"
	switch {
	case replicas == 0:
		status = "Scaled Down"
	case d.Status.ReadyReplicas == replicas && d.Status.UpdatedReplicas == replicas:
		status = "Available"
	case d.Status.UpdatedReplicas < replicas:
		status = "Progressing"
	case d.Status.ReadyReplicas < replicas:
		status = "Degraded"
	}
	return models.DeploymentInfo{
		Name:              d.Name,
		Namespace:         d.Namespace,
		Replicas:          replicas,
		ReadyReplicas:     d.Status.ReadyReplicas,
		AvailableReplicas: d.Status.AvailableReplicas,
		UpdatedReplicas:   d.Status.UpdatedReplicas,
		Status:            status,
		CreatedAt:         d.CreationTimestamp.Time.Format(time.RFC3339),
	}
}
