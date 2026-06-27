package tui

import (
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// showText displays read-only text full-screen (used for kubeconfig content).
// onBack runs when the user presses q/Esc.
func (a *App) showText(title, content string, onBack func()) {
	tv := tview.NewTextView().SetText(content).SetWrap(false)
	tv.SetBackgroundColor(colBg)
	tv.SetTextColor(colInk)
	tv.SetBorder(true).SetBorderColor(colBorder).SetTitle(title)
	tv.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		if ev.Key() == tcell.KeyEsc || (ev.Key() == tcell.KeyRune && ev.Rune() == 'q') {
			a.pages.RemovePage("detail")
			onBack()
			return nil
		}
		return ev
	})
	a.push("detail", tv)
}

// showYaml fetches and displays an object's YAML read-only, with 'e' to edit.
func (a *App) showYaml(def *resourceDef, row rowData, view string) {
	content, err := def.getYAML(a.cluster, row.name, row.namespace)
	if err != nil {
		a.flash("Error", err.Error(), colDanger)
		return
	}

	tv := tview.NewTextView().SetText(content).SetWrap(false)
	tv.SetBackgroundColor(colBg)
	tv.SetTextColor(colInk)
	tv.SetBorder(true).SetBorderColor(colBorder).
		SetTitle(" " + def.title + ": " + row.name + " ")

	tv.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		switch {
		case ev.Key() == tcell.KeyEsc, ev.Key() == tcell.KeyRune && ev.Rune() == 'q':
			a.backToResource()
			return nil
		case ev.Key() == tcell.KeyRune && ev.Rune() == 'e':
			if def.updateYAML == nil {
				a.flash("Not editable", def.title+" cannot be edited from the TUI", colWarn)
				return nil
			}
			a.editYaml(def, row, view)
			return nil
		case ev.Key() == tcell.KeyRune && ev.Rune() == 'g':
			tv.ScrollToBeginning()
			return nil
		case ev.Key() == tcell.KeyRune && ev.Rune() == 'G':
			tv.ScrollToEnd()
			return nil
		}
		return ev
	})

	a.setStatus(def.title+" ▸ yaml", hintYaml)
	a.pages.AddPage("detail", tv, true, true)
	a.app.SetFocus(tv)
}

// backToResource dismisses a detail overlay and restores the list screen.
func (a *App) backToResource() {
	a.pages.RemovePage("detail")
	if a.resourceBody != nil {
		a.app.SetFocus(a.resourceBody)
	}
}
