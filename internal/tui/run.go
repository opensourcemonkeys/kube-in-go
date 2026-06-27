// Package tui implements the terminal UI for kube-ins. It is a Wails-free
// front end that drives the same internal/business functions the desktop app
// uses, so it can ship both as a standalone CLI binary (cmd/tui) and inside the
// GUI's "CLI mode" (the GUI re-execs itself with --tui in a pty).
package tui

import (
	"context"

	"kube-ins/internal/business"
)

// Run starts the TUI event loop and blocks until the user quits. The context is
// accepted for symmetry with the rest of the codebase and future cancellation;
// tview owns the lifecycle once Run is called.
func Run(ctx context.Context, version string) error {
	applyTheme()

	a := newApp(version)
	a.cluster = business.GetActiveCluster()

	// Land on the cluster screen; if a cluster is already active the user can
	// jump straight into the resource menu with Enter.
	a.showClusters()

	return a.app.Run()
}
