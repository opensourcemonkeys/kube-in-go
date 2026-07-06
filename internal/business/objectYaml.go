package business

import (
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

// GetObjectYaml returns the YAML of any object identified by (group, resource,
// namespace, name) — used by the Security Role Map detail modal.
func GetObjectYaml(clusterName, group, resource, namespace, name string) (string, error) {
	_, config, err := repository.NewK8sClientAndConfigForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetObjectYaml(config, group, resource, namespace, name)
}

// GetObjectDescribe returns the full `kubectl describe` text for any object
// identified by (resource, namespace, name) — backs the TUI describe panel.
func GetObjectDescribe(clusterName, resource, namespace, name string) (string, error) {
	_, config, err := repository.NewK8sClientAndConfigForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetObjectDescribe(config, resource, namespace, name)
}

// UpdateObjectYaml applies edited YAML to the identified object.
func UpdateObjectYaml(clusterName, group, resource, namespace, name, yamlContent string) error {
	_, config, err := repository.NewK8sClientAndConfigForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateObjectYaml(config, group, resource, namespace, name, yamlContent)
}

// DeleteObject deletes any object identified by (group, resource, namespace,
// name) — used to delete CRDs and custom resource instances from the CRD view.
func DeleteObject(clusterName, group, resource, namespace, name string) error {
	_, config, err := repository.NewK8sClientAndConfigForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.DeleteObject(config, group, resource, namespace, name)
}
