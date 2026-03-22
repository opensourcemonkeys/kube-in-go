package main

import (
	"context"
	"kube-ins/internal/models"
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
	var podInfoList []models.PodInfo
	var podInfo1, podInfo2 models.PodInfo
	podInfoName1 := "Name 1"
	podInfo1.Name = podInfoName1
	podInfoName2 := "Name 2"
	podInfo2.Name = podInfoName2

	podInfoList = append(podInfoList, podInfo1, podInfo2)
	return podInfoList
}
