package business

import (
	"fmt"
	"kube-ins/internal/logging"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetNodeYaml(clusterName string, name string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetNodeYaml(name, client)
}

func UpdateNodeYaml(clusterName string, name string, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateNodeYaml(name, yamlContent, client)
}

func CordonNode(clusterName string, name string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.CordonNode(name, client)
}

func UncordonNode(clusterName string, name string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UncordonNode(name, client)
}

func DrainNode(clusterName string, name string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.DrainNode(name, client)
}

func GetNodes(clusterName string) ([]models.NodeInfo, error) {
	k8sClient, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	// metrics-server is optional: a nil client makes the service report usage as
	// unavailable rather than failing the whole listing.
	metricsClient, err := repository.NewMetricsClientForCluster(clusterName)
	if err != nil {
		logging.With("business.node").Debug("metrics-server unavailable",
			"cluster", clusterName, "err", err)
	}
	result, err := services.GetNodes(k8sClient, metricsClient)
	if err != nil {
		return nil, fmt.Errorf("list nodes in cluster %q: %w", clusterName, err)
	}
	return result, nil
}
