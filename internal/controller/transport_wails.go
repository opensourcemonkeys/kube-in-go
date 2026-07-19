package controller_app

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// wailsTransport bridges the controller to the Wails runtime. This file is the
// only place in internal/controller that imports Wails.
type wailsTransport struct {
	ctx context.Context
}

func (t *wailsTransport) Emit(event string, data ...any) {
	runtime.EventsEmit(t.ctx, event, data...)
}

func (t *wailsTransport) SaveFile(opts SaveFileOptions) (string, error) {
	return runtime.SaveFileDialog(t.ctx, runtime.SaveDialogOptions{
		Title:           opts.Title,
		DefaultFilename: opts.DefaultName,
		Filters:         []runtime.FileFilter{{DisplayName: opts.FilterName, Pattern: opts.Pattern}},
	})
}

// Startup is the Wails OnStartup hook: it installs the Wails transport and then
// runs the shell-agnostic initialisation.
func (a *App) Startup(ctx context.Context) {
	a.tr = &wailsTransport{ctx: ctx}
	a.start(ctx)
}
