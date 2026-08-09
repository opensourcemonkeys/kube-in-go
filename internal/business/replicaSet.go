package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetReplicaSets(clusterName string) ([]models.ReplicaSetInfo, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	items, err := services.GetReplicaSets("", client)
	if err != nil {
		return nil, fmt.Errorf("list replicasets in cluster %q: %w", clusterName, err)
	}
	return items, nil
}

func DeleteReplicaSet(clusterName string, name, namespace string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.DeleteReplicaSet(namespace, name, client)
}

func GetReplicaSetYaml(clusterName string, name, namespace string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetReplicaSetYaml(namespace, name, client)
}

func UpdateReplicaSetYaml(clusterName string, name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateReplicaSetYaml(namespace, name, yamlContent, client)
}
