package business

import (
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

// GetMetricsSnapshot returns a live, point-in-time resource-usage snapshot for
// the monitoring dashboard (nodes, pods, workloads + cluster totals).
func GetMetricsSnapshot(clusterName string) (models.MetricsSnapshot, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return models.MetricsSnapshot{}, err
	}
	mc, _ := repository.NewMetricsClientForCluster(clusterName) // nil mc → MetricsAvailable=false
	return services.GetMetricsSnapshot(client, mc)
}
