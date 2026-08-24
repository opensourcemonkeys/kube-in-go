package controller_app

import (
	"context"

	bussiness "kube-ins/internal/business"
	"kube-ins/internal/ipc"
	"kube-ins/internal/models"
	"kube-ins/internal/safego"
)

// App struct
type App struct {
	ctx context.Context
	hub *ipc.InstanceHub
	tr  Transport
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// start performs the shell-agnostic startup: it stores the context and brings
// up the instance hub. Each shell calls this after installing its Transport
// (see Startup in transport_wails.go and Bootstrap in transport.go).
//
// Unexported on purpose: Wails binds every exported method of App into the
// generated TypeScript, and this is not part of the frontend API.
func (a *App) start(ctx context.Context) {
	a.ctx = ctx
	a.hub = ipc.NewInstanceHub(ctx, func(panel models.SerializedPanel) {
		a.emit("tab:received", panel)
	})

	// Windows' NSIS installer always leaves the ~190 MB download behind, and a
	// macOS swap helper that died early does too. Off the startup path entirely:
	// nothing waits on it, and safego rather than a bare `go func()` because
	// neither shell recovers a panic on our behalf.
	safego.Go("business.updateTempSweep", bussiness.SweepStaleUpdateTemps)
}
