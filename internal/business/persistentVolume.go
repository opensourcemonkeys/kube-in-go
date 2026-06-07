package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetPersistentVolumes(clusterName string) []models.PersistentVolumeInfo {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetPersistentVolumes(client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func GetPersistentVolumeYaml(clusterName string, name string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetPersistentVolumeYaml(name, client)
}
