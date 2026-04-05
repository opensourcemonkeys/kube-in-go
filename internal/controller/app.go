package controller_app

import (
	"context"
	bussiness "kube-ins/internal/business"
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

// Startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) GetPods() []models.PodInfo {
	return bussiness.GetPods()
}
