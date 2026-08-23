package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

// GetClusterCounts returns the Overview dashboard's tile numbers for one
// cluster. See models.ClusterCounts for why this is not six list calls.
func GetClusterCounts(clusterName string) (models.ClusterCounts, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return models.ClusterCounts{}, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	counts, err := services.GetClusterCounts(client)
	if err != nil {
		return models.ClusterCounts{}, fmt.Errorf("count resources in cluster %q: %w", clusterName, err)
	}
	return counts, nil
}
