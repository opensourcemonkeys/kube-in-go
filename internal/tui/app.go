package tui

import (
	"fmt"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// App is the TUI shell. It owns the tview application, a page stack, the active
// cluster, and the top status bar. Screens are plain tview primitives pushed
// onto the page stack; only one primary screen is visible at a time (no
// split-screen / dockview equivalent — by design).
type App struct {
	app   *tview.Application
	pages *tview.Pages

	cluster string // active cluster name (set on the cluster screen)

	crumb *tview.TextView // left breadcrumb
	hint  *tview.TextView // right-aligned key hints

	registry map[string]*resourceDef
	groups   []menuGroup

	// resourceBody is the currently open resource list primitive, kept so detail
	// overlays (YAML/logs) can restore focus to it when dismissed.
	resourceBody tview.Primitive

	version string
}

func newApp(version string) *App {
	a := &App{
		app:     tview.NewApplication(),
		pages:   tview.NewPages(),
		version: version,
	}
	a.groups, a.registry = buildRegistry()

	a.crumb = tview.NewTextView().
		SetDynamicColors(true).
		SetTextColor(colInk)
	a.hint = tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignRight).
		SetTextColor(colMuted)

	bar := tview.NewFlex().
		AddItem(a.crumb, 0, 1, false).
		AddItem(a.hint, 0, 1, false)
	bar.SetBackgroundColor(colPanel)

	root := tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(bar, 1, 0, false).
		AddItem(a.pages, 0, 1, true)

	a.app.SetRoot(root, true).EnableMouse(true)

	// Global keys that work everywhere — but never while typing in an input.
	a.app.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		switch a.app.GetFocus().(type) {
		case *tview.InputField, *tview.TextArea:
			return ev // editing: let the widget handle every key
		}
		if ev.Key() == tcell.KeyRune && ev.Rune() == '?' {
			if !a.pages.HasPage("help") {
				a.showHelp()
			}
			return nil
		}
		return ev
	})

	return a
}

// setStatus updates the top bar: left breadcrumb and right key hints.
func (a *App) setStatus(crumb, hints string) {
	cluster := a.cluster
	if cluster == "" {
		cluster = "no cluster"
	}
	a.crumb.SetText(fmt.Sprintf(" [::b]kube-ins[-:-:-] [%s]%s[-]  [white]▸[-]  %s",
		hexOf(colMuted), cluster, crumb))
	a.hint.SetText(hints + " ")
}

// push shows a screen by name, creating/replacing its page, and remembers it as
// the resumable primary screen for that name.
func (a *App) push(name string, p tview.Primitive) {
	if a.pages.HasPage(name) {
		a.pages.RemovePage(name)
	}
	a.pages.AddPage(name, p, true, true)
	a.app.SetFocus(p)
}

// modal overlays a centered page on top of the current screen.
func (a *App) modal(name string, p tview.Primitive, width, height int) {
	wrap := tview.NewFlex().
		AddItem(nil, 0, 1, false).
		AddItem(tview.NewFlex().SetDirection(tview.FlexRow).
			AddItem(nil, 0, 1, false).
			AddItem(p, height, 0, true).
			AddItem(nil, 0, 1, false), width, 0, true).
		AddItem(nil, 0, 1, false)
	a.pages.AddPage(name, wrap, true, true)
	a.app.SetFocus(p)
}

// closeModal removes an overlay page and restores focus to the page beneath.
func (a *App) closeModal(name string) {
	a.pages.RemovePage(name)
}

// flash shows a transient one-line message as a small modal that auto-dismisses
// on any key. Used for errors and confirmations of mutating actions.
func (a *App) flash(title, msg string, color tcell.Color) {
	m := tview.NewModal().
		SetText(msg).
		AddButtons([]string{"OK"}).
		SetDoneFunc(func(int, string) { a.closeModal("flash") })
	m.SetBackgroundColor(colPanel)
	m.SetTextColor(colInk)
	m.SetBorderColor(color)
	m.SetTitle(" " + title + " ")
	a.pages.AddPage("flash", m, true, true)
	a.app.SetFocus(m)
}

// confirm shows a yes/no modal and runs onYes when confirmed.
func (a *App) confirm(msg string, onYes func()) {
	m := tview.NewModal().
		SetText(msg).
		AddButtons([]string{"Cancel", "Confirm"}).
		SetDoneFunc(func(_ int, label string) {
			a.closeModal("confirm")
			if label == "Confirm" {
				onYes()
			}
		})
	m.SetBackgroundColor(colPanel)
	m.SetTextColor(colInk)
	m.SetBorderColor(colDanger)
	m.SetTitle(" Confirm ")
	a.pages.AddPage("confirm", m, true, true)
	a.app.SetFocus(m)
}

func hexOf(c tcell.Color) string {
	r, g, b := c.RGB()
	return fmt.Sprintf("#%02x%02x%02x", r, g, b)
}
