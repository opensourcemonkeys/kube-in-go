package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetPersistentVolumeClaims(clusterName string) ([]models.PersistentVolumeClaimInfo, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	items, err := services.GetPersistentVolumeClaims("", client)
	if err != nil {
		return nil, fmt.Errorf("list persistentvolumeclaims in cluster %q: %w", clusterName, err)
	}
	return items, nil
}

func DeletePersistentVolumeClaim(clusterName string, name string, namespace string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.DeletePersistentVolumeClaim(name, namespace, client)
}

func GetPersistentVolumeClaimYaml(clusterName string, name string, namespace string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetPersistentVolumeClaimYaml(name, namespace, client)
}
