package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetConfigMaps() []models.ConfigMapInfo {
	client, err := repository.NewK8sClient()
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetConfigMaps("", client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func DeleteConfigMap(name, namespace string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.DeleteConfigMap(namespace, name, client)
}

func GetConfigMapYaml(name, namespace string) (string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return "", err
	}
	return services.GetConfigMapYaml(namespace, name, client)
}

func UpdateConfigMapYaml(name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.UpdateConfigMapYaml(namespace, name, yamlContent, client)
}

func GetConfigMapData(name, namespace string) (map[string]string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return nil, err
	}
	return services.GetConfigMapData(namespace, name, client)
}

func UpdateConfigMapData(name, namespace string, data map[string]string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.UpdateConfigMapData(namespace, name, data, client)
}
