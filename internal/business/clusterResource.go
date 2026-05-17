package business

import (
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetClusterGraph() (*models.ClusterGraph, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return nil, err
	}
	return services.GetClusterGraph(client)
}
