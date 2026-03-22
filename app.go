package main

import (
	"context"
	"fmt"
	"kube-ins/internal/models"
	"kube-ins/internal/services"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name
func (a *App) Greet() []models.PodInfo {

	var podInfo1 models.PodInfo
	podInfo1.Name = "Name 1"
	client, err := services.NewK8sClient()
	if err != nil {
		fmt.Println(err)
	}
	podItem, err := client.GetPods("")
	if err != nil {
		fmt.Println(err)
	}
	return podItem
}
