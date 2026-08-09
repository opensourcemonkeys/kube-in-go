package business

import (
	"fmt"

	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetRoleBindings(clusterName string) ([]models.RoleBindingInfo, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	items, err := services.GetRoleBindings("", client)
	if err != nil {
		return nil, fmt.Errorf("list rolebindings in cluster %q: %w", clusterName, err)
	}
	return items, nil
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

func DeleteRoleBinding(clusterName string, name, namespace string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.DeleteRoleBinding(namespace, name, client)
}

func UpdateRoleBinding(clusterName string, name, namespace string, labels, annotations map[string]string, subjects []models.SubjectInfo) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateRoleBinding(namespace, name, labels, annotations, subjects, client)
}
