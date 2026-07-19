package controller_app

import (
	"context"
	"errors"
)

// SaveFileOptions describes a native "save as" prompt. It mirrors the subset of
// Wails' SaveDialogOptions the app actually uses (a title, a suggested name and
// a single file-type filter).
type SaveFileOptions struct {
	Title       string
	DefaultName string
	FilterName  string // e.g. "PNG Image (*.png)"
	Pattern     string // e.g. "*.png"
}

// Transport is the shell-specific half of the controller: pushing events to the
// frontend and showing native dialogs. Everything else in this package is plain
// Go and works under any shell.
//
// Wails supplies wailsTransport; the HTTP/WebSocket server used by the
// Chromium-based shells supplies its own implementation.
type Transport interface {
	Emit(event string, data ...any)
	SaveFile(opts SaveFileOptions) (string, error)
}

// Bootstrap wires an App to a shell and starts it. Shells outside this package
// (cmd/energy, cmd/serve) use this instead of NewApp+Startup.
//
// Note this is deliberately a package-level function, not a method: Wails binds
// every exported method of App into the generated TypeScript, and a method
// taking a Transport interface would break binding generation.
func Bootstrap(ctx context.Context, tr Transport) *App {
	a := NewApp()
	a.tr = tr
	a.start(ctx)
	return a
}

// emit pushes an event to the frontend. It is a no-op when no transport is
// installed (e.g. during tests) so background goroutines never panic.
func (a *App) emit(event string, data ...any) {
	if a.tr == nil {
		return
	}
	a.tr.Emit(event, data...)
}

// saveFile prompts for a destination path. It returns "" when the user cancels.
func (a *App) saveFile(opts SaveFileOptions) (string, error) {
	if a.tr == nil {
		return "", errors.New("no transport installed")
	}
	return a.tr.SaveFile(opts)
}
