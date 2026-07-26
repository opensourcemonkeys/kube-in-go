package business

import (
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

// GetResourceTable lists any (group, resource) the way `kubectl get` prints it
// — the apiserver renders the rows, so a CRD's own additionalPrinterColumns
// come back for free. Backs the CRD explorer's instance table.
func GetResourceTable(clusterName, group, resource, namespace string) (models.ResourceTable, error) {
	_, config, err := repository.NewK8sClientAndConfigForCluster(clusterName)
	if err != nil {
		return models.ResourceTable{}, err
	}
	return services.GetResourceTable(config, group, resource, namespace)
}

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
