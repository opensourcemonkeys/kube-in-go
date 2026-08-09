package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetIngressClasses(clusterName string) ([]models.IngressClassInfo, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	items, err := services.GetIngressClasses(client)
	if err != nil {
		return nil, fmt.Errorf("list ingressclasses in cluster %q: %w", clusterName, err)
	}
	return items, nil
}

func UpdateIngressClassYaml(clusterName string, name, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateIngressClassYaml(name, yamlContent, client)
}

func GetIngressClassYaml(clusterName string, name string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetIngressClassYaml(name, client)
}
