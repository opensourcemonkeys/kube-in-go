package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetLimitRanges(clusterName string) ([]models.LimitRangeInfo, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	items, err := services.GetLimitRanges("", client)
	if err != nil {
		return nil, fmt.Errorf("list limitranges in cluster %q: %w", clusterName, err)
	}
	return items, nil
}

func DeleteLimitRange(clusterName string, name, namespace string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.DeleteLimitRange(namespace, name, client)
}

func GetLimitRangeYaml(clusterName string, name, namespace string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetLimitRangeYaml(namespace, name, client)
}

func UpdateLimitRangeYaml(clusterName string, name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateLimitRangeYaml(namespace, name, yamlContent, client)
}
