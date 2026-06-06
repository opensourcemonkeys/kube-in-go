package business

import (
	"fmt"

	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetServiceAccounts() []models.ServiceAccountInfo {
	client, err := repository.NewK8sClient()
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetServiceAccounts("", client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func GetServiceAccountYaml(name, namespace string) (string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return "", err
	}
	return services.GetServiceAccountYaml(namespace, name, client)
}

func UpdateServiceAccountYaml(name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.UpdateServiceAccountYaml(namespace, name, yamlContent, client)
}

func UpdateServiceAccount(name, namespace string, labels, annotations map[string]string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.UpdateServiceAccount(namespace, name, labels, annotations, client)
}
