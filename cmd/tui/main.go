// Command kube-ins-tui is the standalone terminal UI for kube-ins. It links no
// Wails/webview code — it drives the same internal/business functions the
// desktop app uses, so it ships as its own lightweight, webkit-free binary.
package main

import (
	"context"
	"fmt"
	"os"

	"kube-ins/internal/business"
	"kube-ins/internal/tui"
)

func main() {
	if err := tui.Run(context.Background(), business.GetAppInfo().AppVersion); err != nil {
		fmt.Fprintln(os.Stderr, "kube-ins-tui:", err)
		os.Exit(1)
	}
}
