package business

import (
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func ApplyYaml(yamlContent string) (string, error) {
	kubeconfigPath := repository.GetActiveKubeconfigPath()
	return services.ApplyYaml(yamlContent, kubeconfigPath)
}
