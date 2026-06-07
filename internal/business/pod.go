package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

// GetPods exposes pod data to the Wails app context.
func GetPods(clusterName string) []models.PodInfo {

	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		fmt.Println(err)
	}
	podItem, err := services.GetPods("", client)
	if err != nil {
		fmt.Println(err)
	}
	return podItem
}

func DeletePod(clusterName string, name string, namespace string) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}

	return services.DeletePod(namespace, name, client)
}

func GetPodYaml(clusterName string, name string, namespace string) (string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return "", err
	}

	return services.GetPodYaml(namespace, name, client)
}
