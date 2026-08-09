package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetStorageClasses(clusterName string) ([]models.StorageClassInfo, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	items, err := services.GetStorageClasses(client)
	if err != nil {
		return nil, fmt.Errorf("list storageclasses in cluster %q: %w", clusterName, err)
	}
	return items, nil
}

func UpdateStorageClassYaml(clusterName string, name, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateStorageClassYaml(name, yamlContent, client)
}

func GetStorageClassYaml(clusterName string, name string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetStorageClassYaml(name, client)
}
