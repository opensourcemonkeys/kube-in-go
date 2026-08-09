package controller_app

import (
	"context"
	"path/filepath"

	"kube-ins/internal/logging"

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

// OpenLogFolder reveals the log directory. Wails has no reveal-in-file-manager
// API, so this goes through the browser opener, which the WebKit/GTK stack
// turns into xdg-open (and the equivalent elsewhere).
func (t *wailsTransport) OpenLogFolder() error {
	dir, err := logging.Dir()
	if err != nil {
		return err
	}
	runtime.BrowserOpenURL(t.ctx, "file://"+filepath.ToSlash(dir))
	return nil
}

func (t *wailsTransport) Kind() string { return "wails" }

// Startup is the Wails OnStartup hook: it installs the Wails transport and then
// runs the shell-agnostic initialisation.
func (a *App) Startup(ctx context.Context) {
	a.tr = &wailsTransport{ctx: ctx}
	a.start(ctx)
}
