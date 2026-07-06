package tui

import (
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

const helpText = `[teal::b]kube-ins TUI — keyboard shortcuts[-:-:-]

[teal]Navigation[-]
  ↑/↓ or j/k    move selection
  g / G         jump to top / bottom
  Enter         open / select
  q or Esc      back one screen (quit on cluster screen)
  c             jump to cluster selector
  ?             toggle this help

[teal]Clusters screen[-]
  a             add cluster (paste / load kubeconfig path)
  d             delete selected cluster
  v             view kubeconfig
  Enter         set active & open resource menu

[teal]Resource list[-]
  /             filter rows
  r             refresh
  Enter         describe (CRDs: open instances)
  →             focus describe panel (scroll)
  y             view YAML
  e             edit YAML
  d             delete (with confirmation)
  l             logs        (pods)
  s             shell/exec  (pods)

[teal]Describe panel[-]
  →             focus panel to scroll
  ↑/↓ or j/k    scroll (g/G top/bottom)
  ← / Esc / q   back to list
  ↑/↓ in list   retargets panel (live updates)
  (nodes/pods/workloads show live CPU/RAM on top)

[teal]YAML viewer[-]
  /             search in document
  n / N         next / previous match
  g / G         jump to top / bottom
  e             edit

[teal]YAML editor / Apply YAML[-]
  Ctrl+O        save changes / apply buffer
  Ctrl+X        exit (asks if unsaved)

[teal]Monitoring[-]
  r             refresh now (auto-refreshes every 4s)
  g / G         jump to top / bottom

[grey]Press any key to close[-]`

func (a *App) showHelp() {
	tv := tview.NewTextView().
		SetDynamicColors(true).
		SetText(helpText)
	tv.SetBackgroundColor(colPanel)
	tv.SetBorder(true).SetBorderColor(colTeal).SetTitle(" Help ")
	tv.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		a.closeModal("help")
		return nil
	})
	a.modal("help", tv, 60, 50)
}
