package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetDeployments() []models.DeploymentInfo {
	client, err := repository.NewK8sClient()
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetDeployments("", client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func DeleteDeployment(name, namespace string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.DeleteDeployment(namespace, name, client)
}

func GetDeploymentYaml(name, namespace string) (string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return "", err
	}
	return services.GetDeploymentYaml(namespace, name, client)
}

func UpdateDeploymentYaml(name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.UpdateDeploymentYaml(namespace, name, yamlContent, client)
}
