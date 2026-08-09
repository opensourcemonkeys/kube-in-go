package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetCronJobs(clusterName string) ([]models.CronJobInfo, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	items, err := services.GetCronJobs("", client)
	if err != nil {
		return nil, fmt.Errorf("list cronjobs in cluster %q: %w", clusterName, err)
	}
	return items, nil
}

func DeleteCronJob(clusterName string, name, namespace string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.DeleteCronJob(namespace, name, client)
}

func GetCronJobYaml(clusterName string, name, namespace string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetCronJobYaml(namespace, name, client)
}

func UpdateCronJobYaml(clusterName string, name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.UpdateCronJobYaml(namespace, name, yamlContent, client)
}
