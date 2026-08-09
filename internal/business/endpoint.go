package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetEndpoints(clusterName string) ([]models.EndpointInfo, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	items, err := services.GetEndpoints("", client)
	if err != nil {
		return nil, fmt.Errorf("list endpoints in cluster %q: %w", clusterName, err)
	}
	return items, nil
}

func GetEndpointYaml(clusterName string, name, namespace string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetEndpointYaml(namespace, name, client)
}
