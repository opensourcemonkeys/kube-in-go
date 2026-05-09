package business

import services "kube-ins/internal/services"

func ApplyYaml(yamlContent string) (string, error) {
	return services.ApplyYaml(yamlContent)
}
