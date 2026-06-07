package business

import (
	"fmt"

	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetRoles(clusterName string) []models.RoleInfo {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetRoles("", client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func GetRoleYaml(clusterName string, name, namespace string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetRoleYaml(namespace, name, client)
}

func UpdateRoleYaml(clusterName string, name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateRoleYaml(namespace, name, yamlContent, client)
}

func UpdateRole(clusterName string, name, namespace string, labels, annotations map[string]string, rules []models.PolicyRuleInfo) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateRole(namespace, name, labels, annotations, rules, client)
}
