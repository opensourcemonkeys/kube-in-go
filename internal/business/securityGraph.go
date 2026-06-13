package business

import (
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetSecurityGraph(clusterName string) (*models.SecurityGraph, error) {
	client, config, err := repository.NewK8sClientAndConfigForCluster(clusterName)
	if err != nil {
		return nil, err
	}
	return services.GetSecurityGraph(client, config)
}
