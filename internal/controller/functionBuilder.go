package controller_app

import (
	bussiness "kube-ins/internal/business"
	"kube-ins/internal/models"

	"github.com/wailsapp/wails/v2/pkg/runtime"
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

func (a *App) CreateTerminalSession(id string) error {
	return bussiness.CreateTerminalSession(id, func(data string) {
		runtime.EventsEmit(a.ctx, "terminal:output:"+id, data)
	})
}

func (a *App) WriteToTerminalSession(id string, data string) error {
	return bussiness.WriteToTerminalSession(id, data)
}

func (a *App) ResizeTerminalSession(id string, cols int, rows int) error {
	return bussiness.ResizeTerminalSession(id, cols, rows)
}

func (a *App) CloseTerminalSession(id string) error {
	return bussiness.CloseTerminalSession(id)
}

func (a *App) ApplyYaml(yamlContent string) (string, error) {
	return bussiness.ApplyYaml(yamlContent)
}

func (a *App) ListClusters() ([]string, error) {
	return bussiness.ListClusters()
}

func (a *App) SaveCluster(name string, content string) error {
	return bussiness.SaveCluster(name, content)
}

func (a *App) GetClusterContent(name string) (string, error) {
	return bussiness.GetClusterContent(name)
}

func (a *App) DeleteCluster(name string) error {
	return bussiness.DeleteCluster(name)
}

func (a *App) SetActiveCluster(name string) error {
	return bussiness.SetActiveCluster(name)
}

func (a *App) GetActiveCluster() string {
	return bussiness.GetActiveCluster()
}

func (a *App) CheckClusterConnection() error {
	return bussiness.CheckClusterConnection()
}

func (a *App) GetPodContainers(name string, namespace string) ([]string, error) {
	return bussiness.GetPodContainers(name, namespace)
}

func (a *App) GetDeploymentPods(name string, namespace string) ([]string, error) {
	return bussiness.GetDeploymentPods(name, namespace)
}

func (a *App) StartLogStream(sessionId string, podName string, namespace string, container string) error {
	return bussiness.StartLogStream(sessionId, podName, namespace, container, func(data string) {
		runtime.EventsEmit(a.ctx, "log:output:"+sessionId, data)
	})
}

func (a *App) StopLogStream(sessionId string) {
	bussiness.StopLogStream(sessionId)
}
