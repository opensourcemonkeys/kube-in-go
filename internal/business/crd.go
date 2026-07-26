package business

import (
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

// GetCRDs returns all CustomResourceDefinitions in the cluster, grouped-ready
// (sorted by group then name) for the CRD list view.
func GetCRDs(clusterName string) ([]models.CRDInfo, error) {
	_, config, err := repository.NewK8sClientAndConfigForCluster(clusterName)
	if err != nil {
		return nil, err
	}
	return services.GetCRDs(config)
}

// GetCustomResources returns all instances of a custom resource identified by
// its (group, plural resource) — the row-expansion content of a CRD row.
func GetCustomResources(clusterName, group, resource string) ([]models.CustomResourceInfo, error) {
	_, config, err := repository.NewK8sClientAndConfigForCluster(clusterName)
	if err != nil {
		return nil, err
	}
	return services.GetCustomResources(config, group, resource)
}

// GetCRDInstanceCounts returns the live instance count per CRD, keyed by CRD
// name (-1 where the count could not be taken). Feeds the CRD explorer's
// sidebar badges and its "only CRDs with instances" filter.
func GetCRDInstanceCounts(clusterName string) (map[string]int, error) {
	_, config, err := repository.NewK8sClientAndConfigForCluster(clusterName)
	if err != nil {
		return nil, err
	}
	crds, err := services.GetCRDs(config)
	if err != nil {
		return nil, err
	}
	return services.GetCRDInstanceCounts(config, crds)
}
