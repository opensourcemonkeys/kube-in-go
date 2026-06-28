package tui

import (
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// Palette mirrors the GUI dark theme (theme-monolith.css :root) so the TUI and
// the desktop app feel like the same product.
var (
	colBg      = tcell.NewHexColor(0x10141a) // --app
	colPanel   = tcell.NewHexColor(0x161b22) // --panel
	colInk     = tcell.NewHexColor(0xdfe2eb) // --ink (foreground)
	colMuted   = tcell.NewHexColor(0x8b95a7) // secondary text
	colTeal    = tcell.NewHexColor(0x2dd4bf) // --teal accent
	colTealDim = tcell.NewHexColor(0x14302e) // selection background
	colBorder       = tcell.NewHexColor(0x2a323d)
	colBorderActive = tcell.NewHexColor(0x6b7689) // focused pane border (lighter)
	colDanger  = tcell.NewHexColor(0xf87171)
	colWarn    = tcell.NewHexColor(0xfbbf24)
	colOk      = tcell.NewHexColor(0x34d399)
)

// applyTheme wires the palette into tview's global styles. Called once at startup.
func applyTheme() {
	tview.Styles = tview.Theme{
		PrimitiveBackgroundColor:    colBg,
		ContrastBackgroundColor:     colPanel,
		MoreContrastBackgroundColor: colTealDim,
		BorderColor:                 colBorder,
		TitleColor:                  colTeal,
		GraphicsColor:               colBorder,
		PrimaryTextColor:            colInk,
		SecondaryTextColor:          colMuted,
		TertiaryTextColor:           colTeal,
		InverseTextColor:            colBg,
		ContrastSecondaryTextColor:  colTeal,
	}
}

// statusColor maps a resource status string to an accent color for table cells.
func statusColor(status string) tcell.Color {
	switch status {
	case "Running", "Active", "Bound", "Ready", "Available", "Healthy", "Normal":
		return colOk
	case "Pending", "Terminating", "ContainerCreating", "Progressing", "Released":
		return colWarn
	case "Failed", "CrashLoopBackOff", "Error", "Unknown", "Lost", "NotReady", "Warning":
		return colDanger
	default:
		return colInk
	}
}
