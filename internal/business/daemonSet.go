package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetDaemonSets() []models.DaemonSetInfo {
	client, err := repository.NewK8sClient()
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

func DeleteDaemonSet(name, namespace string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.DeleteDaemonSet(namespace, name, client)
}

func GetDaemonSetYaml(name, namespace string) (string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return "", err
	}
	return services.GetDaemonSetYaml(namespace, name, client)
}

func UpdateDaemonSetYaml(name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.UpdateDaemonSetYaml(namespace, name, yamlContent, client)
}
