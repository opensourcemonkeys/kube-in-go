package tui

import (
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// editYaml opens an editable YAML buffer for an object. Ctrl+O saves via the
// resource's updateYAML function; Ctrl+X (or Esc) exits, prompting first if the
// buffer has unsaved changes. Caller must ensure def.updateYAML != nil.
func (a *App) editYaml(def *resourceDef, row rowData, view string) {
	content, err := def.getYAML(a.cluster, row.name, row.namespace)
	if err != nil {
		a.flash("Error", err.Error(), colDanger)
		return
	}

	area := tview.NewTextArea().SetText(content, false)
	area.SetWrap(false)
	area.SetBackgroundColor(colBg)
	area.SetTextStyle(tcell.StyleDefault.Background(colBg).Foreground(colInk))
	area.SetBorder(true).SetBorderColor(colTeal).
		SetTitle(" edit " + def.title + ": " + row.name + " (^O save · ^X exit) ")

	// exit leaves the editor, confirming first when there are unsaved edits.
	exit := func() {
		if area.GetText() != content {
			a.confirm("Discard unsaved changes?", func() { a.backToResource() })
			return
		}
		a.backToResource()
	}

	area.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		switch ev.Key() {
		case tcell.KeyCtrlO:
			if err := def.updateYAML(a.cluster, row.name, row.namespace, area.GetText()); err != nil {
				a.flash("Save failed", err.Error(), colDanger)
				return nil
			}
			a.backToResource()
			a.flash("Saved", def.title+" "+row.name+" updated", colOk)
			return nil
		case tcell.KeyCtrlX, tcell.KeyEsc:
			exit()
			return nil
		}
		return ev
	})

	a.setStatus(def.title+" ▸ edit", hintEdit)
	a.pages.AddPage("detail", area, true, true)
	a.app.SetFocus(area)
}
