package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetNetworkPolicies(clusterName string) ([]models.NetworkPolicyInfo, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	items, err := services.GetNetworkPolicies("", client)
	if err != nil {
		return nil, fmt.Errorf("list networkpolicies in cluster %q: %w", clusterName, err)
	}
	return items, nil
}

func DeleteNetworkPolicy(clusterName string, name, namespace string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.DeleteNetworkPolicy(namespace, name, client)
}

func GetNetworkPolicyYaml(clusterName string, name, namespace string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetNetworkPolicyYaml(namespace, name, client)
}

func UpdateNetworkPolicyYaml(clusterName string, name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateNetworkPolicyYaml(namespace, name, yamlContent, client)
}

func ParseNetworkPolicyYaml(yamlContent string) (*models.NetworkPolicyDetail, error) {
	return services.ParseNetworkPolicyYaml(yamlContent)
}

func GetNetworkPolicyDetail(clusterName string, name, namespace string) (*models.NetworkPolicyDetail, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, err
	}
	return services.GetNetworkPolicyDetail(namespace, name, client)
}
