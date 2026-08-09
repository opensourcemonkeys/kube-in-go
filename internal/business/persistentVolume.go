package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetPersistentVolumes(clusterName string) ([]models.PersistentVolumeInfo, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	items, err := services.GetPersistentVolumes(client)
	if err != nil {
		return nil, fmt.Errorf("list persistentvolumes in cluster %q: %w", clusterName, err)
	}
	return items, nil
}

func UpdatePersistentVolumeYaml(clusterName string, name, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdatePersistentVolumeYaml(name, yamlContent, client)
}

func GetPersistentVolumeYaml(clusterName string, name string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetPersistentVolumeYaml(name, client)
}
