package main

import (
	"context"
	"embed"
	"fmt"
	"io"
	"io/fs"
	"log"
	"os"
	"os/signal"
	"syscall"

	"kube-ins/internal/business"
	app_controller "kube-ins/internal/controller"
	"kube-ins/internal/tui"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
)

//go:embed all:frontend/dist
var assets embed.FS

// serve runs the shell-agnostic RPC server and blocks. The frontend is the same
// embedded bundle Wails uses, so the app behaves identically in a browser tab
// apart from the native-only bits (window chrome, save dialog).
func serve(shellChannel bool) error {
	dist, err := fs.Sub(assets, "frontend/dist")
	if err != nil {
		return err
	}

	srv, err := app_controller.NewServer(dist)
	if err != nil {
		return err
	}
	srv.Bootstrap(context.Background())

	fmt.Println("kube-ins serving at", srv.URL())

	// The shell's main process needs the token to open /shell, and it cannot
	// read the copy injected into index.html. stdout is a private pipe to our
	// parent, which is why the token goes here rather than argv (world-readable
	// via /proc) or a temp file (cleanup and TOCTOU).
	//
	// Do not redirect this stream to a log file.
	if shellChannel {
		fmt.Println("kube-ins shell token", srv.Token())
	}

	// Orphan guard: our parent closes stdin when it dies, including on SIGKILL
	// where no signal reaches us. Without this a 262MB process holding live
	// Kubernetes watches would survive the shell. Skipped when stdin is a
	// terminal so `kube-ins --serve` from a shell prompt is unaffected.
	stop := make(chan struct{}, 1)
	if fi, err := os.Stdin.Stat(); err == nil && fi.Mode()&os.ModeCharDevice == 0 {
		go func() {
			_, _ = io.Copy(io.Discard, os.Stdin)
			stop <- struct{}{}
		}()
	}

	// Block until interrupted so the k8s streams stay alive.
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	select {
	case <-sig:
	case <-stop:
	}
	return srv.Close()
}

func main() {
	// CLI mode: when launched with --tui (used both by `kube-ins --tui` and by
	// the GUI's "CLI mode", which re-execs this binary in a pty), run the
	// terminal UI instead of bootstrapping Wails/webview.
	for _, arg := range os.Args[1:] {
		if arg == "--tui" || arg == "tui" {
			if err := tui.Run(context.Background(), business.GetAppInfo().AppVersion); err != nil {
				fmt.Fprintln(os.Stderr, "kube-ins:", err)
				os.Exit(1)
			}
			return
		}
	}

	// Restore the standard logger. Trivy's pkg/log has an init() that calls
	// slog.SetDefault with a handler which only buffers records into a slice
	// until Trivy initialises its own logger — and since Go 1.21 slog.SetDefault
	// also reroutes the standard log package through that handler. Importing the
	// scanner therefore silently swallowed every log.Print in the binary; the
	// output reappears in test binaries, which never link Trivy, so it looked
	// like the logging worked. Stderr, never stdout: stdout is the Electron
	// sidecar protocol (see serve() below).
	//
	// Deliberately after the --tui branch: the terminal UI owns the screen, and
	// anything written to stderr corrupts it.
	// The flags go back too: slog.SetDefault zeroes them so its handler can own
	// the timestamp, which left every line bare once the output was restored.
	log.SetOutput(os.Stderr)
	log.SetFlags(log.LstdFlags)

	// Serve mode: expose the controller over loopback HTTP/WebSocket and print
	// the URL instead of opening a window. This is how the Electron shell runs
	// the backend (as a sidecar), and it also lets the whole app be exercised
	// in a plain Chromium tab. --shell-channel additionally prints the token so
	// a native shell's main process can attach to /shell for save dialogs.
	var serveMode, shellChannel bool
	for _, arg := range os.Args[1:] {
		switch arg {
		case "--serve":
			serveMode = true
		case "--shell-channel":
			shellChannel = true
		}
	}
	if serveMode {
		if err := serve(shellChannel); err != nil {
			fmt.Fprintln(os.Stderr, "kube-ins:", err)
			os.Exit(1)
		}
		return
	}

	// Create an instance of the app structure
	app := app_controller.NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:     "Kube Inspector",
		Width:     1024,
		Height:    768,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 6, G: 14, B: 32, A: 1},
		OnStartup:        app.Startup,
		Linux: &linux.Options{
			WebviewGpuPolicy: linux.WebviewGpuPolicyAlways,
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
