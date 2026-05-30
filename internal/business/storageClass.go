package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetStorageClasses() []models.StorageClassInfo {
	client, err := repository.NewK8sClient()
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetStorageClasses(client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func GetStorageClassYaml(name string) (string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return "", err
	}
	return services.GetStorageClassYaml(name, client)
}
