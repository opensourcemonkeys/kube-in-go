package business

import (
	"kube-ins/internal/logging"
	models "kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetResourceQuotas(clusterName string) ([]models.NamespacedResourceQuota, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, err
	}
	return services.GetResourceQuotas(client)
}

func GetResourceQuotaYaml(clusterName string, name, namespace string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}
	return services.GetResourceQuotaYaml(name, namespace, client)
}

func UpdateResourceQuotaYaml(clusterName string, name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		logging.With("business.resourceQuota").Error("update resource quota yaml failed",
			"cluster", clusterName, "namespace", namespace, "name", name, "err", err)
		return err
	}
	return services.UpdateResourceQuotaYaml(name, namespace, yamlContent, client)
}
