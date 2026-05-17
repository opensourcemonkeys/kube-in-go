package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetReplicaSets() []models.ReplicaSetInfo {
	client, err := repository.NewK8sClient()
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetReplicaSets("", client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func DeleteReplicaSet(name, namespace string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.DeleteReplicaSet(namespace, name, client)
}

func GetReplicaSetYaml(name, namespace string) (string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return "", err
	}
	return services.GetReplicaSetYaml(namespace, name, client)
}

func UpdateReplicaSetYaml(name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.UpdateReplicaSetYaml(namespace, name, yamlContent, client)
}
