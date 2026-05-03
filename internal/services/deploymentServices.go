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
		return fmt.Errorf("namespace and deployment name are required")
	}
	return client.AppsV1().Deployments(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{})
}

func GetDeploymentYaml(namespace, name string, client *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", fmt.Errorf("namespace and deployment name are required")
	}
	d, err := client.AppsV1().Deployments(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	yamlBytes, err := yaml.Marshal(d)
	if err != nil {
		return "", err
	}
	return string(yamlBytes), nil
}

func UpdateDeploymentYaml(namespace, name, yamlContent string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return fmt.Errorf("namespace and deployment name are required")
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
	return models.DeploymentInfo{
		Name:              d.Name,
		Namespace:         d.Namespace,
		Replicas:          replicas,
		ReadyReplicas:     d.Status.ReadyReplicas,
		AvailableReplicas: d.Status.AvailableReplicas,
		UpdatedReplicas:   d.Status.UpdatedReplicas,
		CreatedAt:         d.CreationTimestamp.Time,
	}
}
