package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

// GetPods exposes pod data to the Wails app context.
func GetPods() []models.PodInfo {

	client, err := repository.NewK8sClient()
	if err != nil {
		fmt.Println(err)
	}
	podItem, err := services.GetPods("", client)
	if err != nil {
		fmt.Println(err)
	}
	return podItem
}
