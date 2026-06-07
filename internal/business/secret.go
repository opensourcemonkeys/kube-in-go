package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetSecrets(clusterName string) []models.SecretInfo {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetSecrets("", client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func DeleteSecret(clusterName string, name, namespace string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.DeleteSecret(namespace, name, client)
}

func GetSecretYaml(clusterName string, name, namespace string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetSecretYaml(namespace, name, client)
}

func UpdateSecretYaml(clusterName string, name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateSecretYaml(namespace, name, yamlContent, client)
}

func GetSecretData(clusterName string, name, namespace string) (map[string]string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, err
	}
	return services.GetSecretData(namespace, name, client)
}

func UpdateSecretData(clusterName string, name, namespace string, data map[string]string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateSecretData(namespace, name, data, client)
}
