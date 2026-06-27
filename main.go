package main

import (
	"context"
	"embed"
	"fmt"
	"os"

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
