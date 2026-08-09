package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetDaemonSets(clusterName string) ([]models.DaemonSetInfo, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	items, err := services.GetDaemonSets("", client)
	if err != nil {
		return nil, fmt.Errorf("list daemonsets in cluster %q: %w", clusterName, err)
	}
	return items, nil
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
