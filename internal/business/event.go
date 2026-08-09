package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetEvents(clusterName string) ([]models.EventInfo, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	items, err := services.GetEvents("", client)
	if err != nil {
		return nil, fmt.Errorf("list events in cluster %q: %w", clusterName, err)
	}
	return items, nil
}
