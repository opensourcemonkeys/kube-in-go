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

func GetNamespaces(clusterName string) []models.NamespaceInfo {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		fmt.Println("GetNamespaces k8s client error:", err)
		return []models.NamespaceInfo{}
	}
	result, err := services.GetNamespaces(client)
	if err != nil {
		fmt.Println("GetNamespaces error:", err)
		return []models.NamespaceInfo{}
	}
	return result
}
