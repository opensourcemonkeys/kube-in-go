package tui

import (
	"strings"

	"kube-ins/internal/business"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// loadApplyYaml mounts an empty YAML buffer in the right pane. Ctrl+O applies
// it to the active cluster via `kubectl apply` (business.ApplyYaml — the TUI
// cluster screen already pinned the active kubeconfig); Ctrl+X/Esc exits,
// prompting first when the buffer is non-empty. The buffer survives a
// successful apply so it can be tweaked and re-applied.
func (a *App) loadApplyYaml() {
	a.closeDescribe()
	a.stopAutoRefresh()

	const title = " Apply YAML (^O apply · ^X exit) "

	area := tview.NewTextArea()
	area.SetWrap(false)
	area.SetBackgroundColor(colBg)
	area.SetTextStyle(tcell.StyleDefault.Background(colBg).Foreground(colInk))
	area.SetBorder(true).SetBorderColor(colTeal).SetTitle(title)

	// applying guards against re-triggering while a kubectl run is in flight
	// (ApplyYaml shells out and can block on an unreachable cluster).
	var applying bool

	area.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		switch ev.Key() {
		case tcell.KeyCtrlO:
			if applying {
				return nil
			}
			text := area.GetText()
			if strings.TrimSpace(text) == "" {
				a.flash("Nothing to apply", "The YAML buffer is empty", colWarn)
				return nil
			}
			applying = true
			area.SetTitle(" Apply YAML (applying…) ")
			go func() {
				out, err := business.ApplyYaml(text)
				a.app.QueueUpdateDraw(func() {
					applying = false
					area.SetTitle(title)
					if err != nil {
						a.flash("Apply failed", err.Error(), colDanger)
						return
					}
					a.flash("Applied", strings.TrimSpace(out), colOk)
				})
			}()
			return nil
		case tcell.KeyCtrlX, tcell.KeyEsc:
			if strings.TrimSpace(area.GetText()) != "" {
				a.confirm("Discard buffer?", func() { a.app.SetFocus(a.tree) })
				return nil
			}
			a.app.SetFocus(a.tree)
			return nil
		}
		return ev
	})

	a.content.Clear()
	a.content.AddItem(area, 0, 1, true)
	a.resourceBody = area

	a.setStatus("Apply YAML", hintApply)
	a.app.SetFocus(area)
}
