package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetStatefulSets(clusterName string) ([]models.StatefulSetInfo, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	items, err := services.GetStatefulSets("", client)
	if err != nil {
		return nil, fmt.Errorf("list statefulsets in cluster %q: %w", clusterName, err)
	}
	return items, nil
}

func DeleteStatefulSet(clusterName string, name, namespace string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.DeleteStatefulSet(namespace, name, client)
}

func GetStatefulSetYaml(clusterName string, name, namespace string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetStatefulSetYaml(namespace, name, client)
}

func UpdateStatefulSetYaml(clusterName string, name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateStatefulSetYaml(namespace, name, yamlContent, client)
}
