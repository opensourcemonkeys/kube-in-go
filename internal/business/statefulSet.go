package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetStatefulSets() []models.StatefulSetInfo {
	client, err := repository.NewK8sClient()
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetStatefulSets("", client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func DeleteStatefulSet(name, namespace string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.DeleteStatefulSet(namespace, name, client)
}

func GetStatefulSetYaml(name, namespace string) (string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return "", err
	}
	return services.GetStatefulSetYaml(namespace, name, client)
}

func UpdateStatefulSetYaml(name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.UpdateStatefulSetYaml(namespace, name, yamlContent, client)
}
