package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetPersistentVolumeClaims() []models.PersistentVolumeClaimInfo {
	client, err := repository.NewK8sClient()
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetPersistentVolumeClaims("", client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func DeletePersistentVolumeClaim(name string, namespace string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.DeletePersistentVolumeClaim(name, namespace, client)
}

func GetPersistentVolumeClaimYaml(name string, namespace string) (string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return "", err
	}
	return services.GetPersistentVolumeClaimYaml(name, namespace, client)
}
