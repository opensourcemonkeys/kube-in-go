package tui

import (
	"fmt"
	"sync"
	"time"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// defaultRefreshRate is how often the visible resource list re-polls the
// cluster, and the threshold above which the response-rate readout turns yellow.
const defaultRefreshRate = 3 * time.Second

// App is the TUI shell. It owns the tview application, a page stack, the active
// cluster, and the top status bar. Most screens are plain tview primitives
// pushed onto the page stack and shown one at a time; the exception is the
// "workspace" screen, which is split — a resource menu (left) beside the
// generic resource list (right), navigated between with the left/right arrows.
type App struct {
	app   *tview.Application
	pages *tview.Pages

	cluster string // active cluster name (set on the cluster screen)

	crumb *tview.TextView // left breadcrumb
	rate  *tview.TextView // center response-rate readout (last list fetch time)
	hint  *tview.TextView // right-aligned key hints

	// refreshStop signals the visible resource list's background auto-refresh
	// goroutine to exit; refreshRate is its polling interval.
	refreshStop chan struct{}
	refreshRate time.Duration

	registry map[string]*resourceDef
	groups   []menuGroup

	// tree is the left-hand resource menu and content is the right-hand list
	// container on the split workspace screen; kept so loadResource can swap the
	// list body and the arrow keys can move focus between the two panes.
	tree    *tview.TreeView
	content *tview.Flex

	// resourceBody is the currently open resource list primitive, kept so detail
	// overlays (YAML/logs) can restore focus to it when dismissed.
	resourceBody tview.Primitive

	// Describe side-panel state. When open, a describe pane sits to the right of the
	// list (3-column workspace) and a background goroutine refreshes it on the same
	// cadence as the list. The target (def/row/view) is updated as the list
	// selection moves; describeMu guards it against the refresh goroutine.
	describeOpen     bool
	describeText     *tview.TextView
	describeStop     chan struct{}
	describeKick     chan struct{} // buffered: forces an immediate refresh
	describeMu       sync.Mutex
	describeDef      *resourceDef
	describeRow      rowData
	describeViewName string
	// describeKey is the last-rendered target identity (namespace/name); used to
	// keep the scroll offset across live refreshes and reset it only on retarget.
	describeKey string

	version string
}

func newApp(version string) *App {
	a := &App{
		app:         tview.NewApplication(),
		pages:       tview.NewPages(),
		version:     version,
		refreshRate: defaultRefreshRate,
	}
	a.groups, a.registry = buildRegistry()

	a.crumb = tview.NewTextView().
		SetDynamicColors(true).
		SetTextColor(colInk)
	a.rate = tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignCenter)
	a.hint = tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignRight).
		SetTextColor(colMuted)

	bar := tview.NewFlex().
		AddItem(a.crumb, 0, 1, false).
		AddItem(a.rate, 14, 0, false).
		AddItem(a.hint, 0, 1, false)
	bar.SetBackgroundColor(colPanel)

	root := tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(bar, 1, 0, false).
		AddItem(a.pages, 0, 1, true)

	// Mouse is intentionally left disabled (tview's default): the TUI is fully
	// keyboard-driven, and a mouse-tracking terminal would swallow drag-to-select,
	// blocking text copy in the GUI's CLI Mode xterm overlay.
	a.app.SetRoot(root, true)

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

// updateRate refreshes the top-bar response-rate readout — the wall-clock time
// the last resource list fetch took. It turns yellow once a fetch is slower than
// the auto-refresh interval (so the list can't keep up) and red on error.
func (a *App) updateRate(d time.Duration, ok bool) {
	if a.rate == nil {
		return
	}
	color := colMuted
	if d > a.refreshRate {
		color = colWarn
	}
	if !ok {
		color = colDanger
	}
	a.rate.SetText(fmt.Sprintf("[%s]⟳ %.2fs[-]", hexOf(color), d.Seconds()))
}

// stopAutoRefresh signals the current resource list's background refresh
// goroutine (if any) to exit and clears the rate readout. Called before swapping
// the list to another view and when leaving the workspace, so only the visible
// list polls.
func (a *App) stopAutoRefresh() {
	if a.refreshStop != nil {
		close(a.refreshStop)
		a.refreshStop = nil
	}
	if a.rate != nil {
		a.rate.SetText("")
	}
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

// focusBorder lightens a pane's border while it holds focus so the user can see
// which frame (menu vs list) the arrow keys are currently acting on.
func focusBorder(box *tview.Box) {
	box.SetFocusFunc(func() { box.SetBorderColor(colBorderActive) })
	box.SetBlurFunc(func() { box.SetBorderColor(colBorder) })
}

func hexOf(c tcell.Color) string {
	r, g, b := c.RGB()
	return fmt.Sprintf("#%02x%02x%02x", r, g, b)
}
