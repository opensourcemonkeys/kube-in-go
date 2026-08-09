package business

import (
	"fmt"

	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetServiceAccounts(clusterName string) ([]models.ServiceAccountInfo, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	items, err := services.GetServiceAccounts("", client)
	if err != nil {
		return nil, fmt.Errorf("list serviceaccounts in cluster %q: %w", clusterName, err)
	}
	return items, nil
}

func GetServiceAccountYaml(clusterName string, name, namespace string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetServiceAccountYaml(namespace, name, client)
}

func UpdateServiceAccountYaml(clusterName string, name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateServiceAccountYaml(namespace, name, yamlContent, client)
}

func DeleteServiceAccount(clusterName string, name, namespace string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.DeleteServiceAccount(namespace, name, client)
}

func UpdateServiceAccount(clusterName string, name, namespace string, labels, annotations map[string]string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateServiceAccount(namespace, name, labels, annotations, client)
}
