package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetDaemonSets(clusterName string) []models.DaemonSetInfo {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetDaemonSets("", client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func DeleteDaemonSet(clusterName string, name, namespace string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.DeleteDaemonSet(namespace, name, client)
}

func GetDaemonSetYaml(clusterName string, name, namespace string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetDaemonSetYaml(namespace, name, client)
}

func UpdateDaemonSetYaml(clusterName string, name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateDaemonSetYaml(namespace, name, yamlContent, client)
}
