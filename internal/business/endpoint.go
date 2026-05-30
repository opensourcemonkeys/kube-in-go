package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetEndpoints() []models.EndpointInfo {
	client, err := repository.NewK8sClient()
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetEndpoints("", client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func GetEndpointYaml(name, namespace string) (string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return "", err
	}
	return services.GetEndpointYaml(namespace, name, client)
}
