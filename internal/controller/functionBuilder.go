package controller_app

import (
	bussiness "kube-ins/internal/business"
	"kube-ins/internal/models"
)

func (a *App) GetPods() []models.PodInfo {
	return bussiness.GetPods()
}

func (a *App) DeletePod(name string, namespace string) error {
	return bussiness.DeletePod(name, namespace)
}
