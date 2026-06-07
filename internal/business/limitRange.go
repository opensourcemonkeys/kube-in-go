package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetLimitRanges(clusterName string) []models.LimitRangeInfo {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetLimitRanges("", client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
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
