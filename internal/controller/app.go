package controller_app

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"kube-ins/internal/ipc"
	"kube-ins/internal/models"
)

// App struct
type App struct {
	ctx context.Context
	hub *ipc.InstanceHub
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// Startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.hub = ipc.NewInstanceHub(ctx, func(panel models.SerializedPanel) {
		runtime.EventsEmit(a.ctx, "tab:received", panel)
	})
}
