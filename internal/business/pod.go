package business

import (
	"fmt"
	"kube-ins/internal/models"
	k8s "kube-ins/internal/services/k8sclient"
)

// GetPods exposes pod data to the Wails app context.
func GetPods() []models.PodInfo {

	var podInfo1 models.PodInfo
	podInfo1.Name = "Name 1"
	client, err := k8s.NewK8sClient()
	if err != nil {
		fmt.Println(err)
	}
	podItem, err := client.GetPods("")
	if err != nil {
		fmt.Println(err)
	}
	return podItem
}
