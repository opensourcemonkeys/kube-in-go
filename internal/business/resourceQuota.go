package business

import (
	"fmt"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetResourceQuotaYaml(name, namespace string) (string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return "", err
	}
	return services.GetResourceQuotaYaml(name, namespace, client)
}

func UpdateResourceQuotaYaml(name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		fmt.Println("UpdateResourceQuotaYaml k8s client error:", err)
		return err
	}
	return services.UpdateResourceQuotaYaml(name, namespace, yamlContent, client)
}
