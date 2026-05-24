package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetSecrets() []models.SecretInfo {
	client, err := repository.NewK8sClient()
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

func DeleteSecret(name, namespace string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.DeleteSecret(namespace, name, client)
}

func GetSecretYaml(name, namespace string) (string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return "", err
	}
	return services.GetSecretYaml(namespace, name, client)
}

func UpdateSecretYaml(name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.UpdateSecretYaml(namespace, name, yamlContent, client)
}

func GetSecretData(name, namespace string) (map[string]string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return nil, err
	}
	return services.GetSecretData(namespace, name, client)
}

func UpdateSecretData(name, namespace string, data map[string]string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.UpdateSecretData(namespace, name, data, client)
}
