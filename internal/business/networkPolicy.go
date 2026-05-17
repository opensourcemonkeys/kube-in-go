package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetNetworkPolicies() []models.NetworkPolicyInfo {
	client, err := repository.NewK8sClient()
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetNetworkPolicies("", client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func DeleteNetworkPolicy(name, namespace string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.DeleteNetworkPolicy(namespace, name, client)
}

func GetNetworkPolicyYaml(name, namespace string) (string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return "", err
	}
	return services.GetNetworkPolicyYaml(namespace, name, client)
}

func UpdateNetworkPolicyYaml(name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.UpdateNetworkPolicyYaml(namespace, name, yamlContent, client)
}

func ParseNetworkPolicyYaml(yamlContent string) (*models.NetworkPolicyDetail, error) {
	return services.ParseNetworkPolicyYaml(yamlContent)
}

func GetNetworkPolicyDetail(name, namespace string) (*models.NetworkPolicyDetail, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return nil, err
	}
	return services.GetNetworkPolicyDetail(namespace, name, client)
}
