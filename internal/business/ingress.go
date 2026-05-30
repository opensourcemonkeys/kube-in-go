package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetIngresses() []models.IngressInfo {
	client, err := repository.NewK8sClient()
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetIngresses("", client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func DeleteIngress(name, namespace string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.DeleteIngress(namespace, name, client)
}

func GetIngressYaml(name, namespace string) (string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return "", err
	}
	return services.GetIngressYaml(namespace, name, client)
}

func UpdateIngressYaml(name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.UpdateIngressYaml(namespace, name, yamlContent, client)
}
