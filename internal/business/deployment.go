package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetDeployments(clusterName string) []models.DeploymentInfo {
	client, err := repository.NewK8sClientForCluster(clusterName)
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

func DeleteDeployment(clusterName string, name, namespace string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.DeleteDeployment(namespace, name, client)
}

func GetDeploymentYaml(clusterName string, name, namespace string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetDeploymentYaml(namespace, name, client)
}

func UpdateDeploymentYaml(clusterName string, name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateDeploymentYaml(namespace, name, yamlContent, client)
}
