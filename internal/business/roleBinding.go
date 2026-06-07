package business

import (
	"fmt"

	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetRoleBindings(clusterName string) []models.RoleBindingInfo {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetRoleBindings("", client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func GetRoleBindingYaml(clusterName string, name, namespace string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetRoleBindingYaml(namespace, name, client)
}

func UpdateRoleBindingYaml(clusterName string, name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateRoleBindingYaml(namespace, name, yamlContent, client)
}

func UpdateRoleBinding(clusterName string, name, namespace string, labels, annotations map[string]string, subjects []models.SubjectInfo) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateRoleBinding(namespace, name, labels, annotations, subjects, client)
}
