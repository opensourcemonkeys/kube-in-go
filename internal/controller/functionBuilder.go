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

func (a *App) GetPodYaml(name string, namespace string) (string, error) {
	return bussiness.GetPodYaml(name, namespace)
}

func (a *App) GetDeployments() []models.DeploymentInfo {
	return bussiness.GetDeployments()
}

func (a *App) DeleteDeployment(name string, namespace string) error {
	return bussiness.DeleteDeployment(name, namespace)
}

func (a *App) GetDeploymentYaml(name string, namespace string) (string, error) {
	return bussiness.GetDeploymentYaml(name, namespace)
}

func (a *App) UpdateDeploymentYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateDeploymentYaml(name, namespace, yamlContent)
}
