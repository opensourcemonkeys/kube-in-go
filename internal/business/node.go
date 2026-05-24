package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetNodeYaml(name string) (string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return "", err
	}
	return services.GetNodeYaml(name, client)
}

func UpdateNodeYaml(name string, yamlContent string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.UpdateNodeYaml(name, yamlContent, client)
}

func CordonNode(name string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.CordonNode(name, client)
}

func UncordonNode(name string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.UncordonNode(name, client)
}

func DrainNode(name string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.DrainNode(name, client)
}

func GetNodes() []models.NodeInfo {
	k8sClient, err := repository.NewK8sClient()
	if err != nil {
		fmt.Println("GetNodes k8s client error:", err)
		return []models.NodeInfo{}
	}
	metricsClient, _ := repository.NewMetricsClient()
	result, err := services.GetNodes(k8sClient, metricsClient)
	if err != nil {
		fmt.Println("GetNodes error:", err)
		return []models.NodeInfo{}
	}
	return result
}
