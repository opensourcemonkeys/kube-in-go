package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func DeleteNamespace(clusterName string, name string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.DeleteNamespace(name, client)
}

func GetNamespaceYaml(clusterName string, name string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetNamespaceYaml(name, client)
}

func GetNamespaces(clusterName string) ([]models.NamespaceInfo, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	result, err := services.GetNamespaces(client)
	if err != nil {
		return nil, fmt.Errorf("list namespaces in cluster %q: %w", clusterName, err)
	}
	return result, nil
}
