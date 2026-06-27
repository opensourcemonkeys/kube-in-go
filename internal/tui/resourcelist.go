package tui

import (
	"fmt"
	"strings"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// openResource builds and shows the generic table screen for a registered view.
func (a *App) openResource(view string) {
	def := a.registry[view]
	if def == nil {
		a.flash("Error", "unknown view: "+view, colDanger)
		return
	}

	table := tview.NewTable().
		SetBorders(false).
		SetSelectable(true, false).
		SetFixed(1, 0)
	table.SetBackgroundColor(colBg)
	table.SetBorder(true).SetBorderColor(colBorder).SetTitle(" " + def.title + " ")

	filter := tview.NewInputField().SetLabel(" / ")
	filter.SetLabelColor(colTeal)
	filter.SetFieldBackgroundColor(colBg)
	filter.SetFieldTextColor(colInk)

	body := tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(table, 0, 1, true)

	var allRows []rowData
	var shown []rowData
	statusCol := statusColumnIndex(def.headers)

	render := func(query string) {
		table.Clear()
		for c, h := range def.headers {
			table.SetCell(0, c, headerCell(h))
		}
		shown = shown[:0]
		q := strings.ToLower(query)
		for _, r := range allRows {
			if q != "" && !strings.Contains(strings.ToLower(r.name+" "+r.namespace), q) {
				continue
			}
			shown = append(shown, r)
			row := len(shown)
			for c, val := range r.cells {
				color := colInk
				if c == statusCol {
					color = statusColor(strings.SplitN(val, ",", 2)[0])
				}
				table.SetCell(row, c, tview.NewTableCell(" "+val+" ").SetTextColor(color).SetExpansion(1))
			}
		}
		if len(shown) == 0 {
			table.SetCell(1, 0, tview.NewTableCell(" (no items) ").SetTextColor(colMuted).SetSelectable(false))
		} else {
			table.Select(1, 0)
		}
		table.SetTitle(fmt.Sprintf(" %s (%d) ", def.title, len(shown)))
	}

	reload := func() {
		rows, err := def.list(a.cluster)
		if err != nil {
			a.flash("Error", err.Error(), colDanger)
		}
		allRows = rows
		render(filter.GetText())
	}
	reload()

	selected := func() (rowData, bool) {
		r, _ := table.GetSelection()
		idx := r - 1
		if idx < 0 || idx >= len(shown) {
			return rowData{}, false
		}
		return shown[idx], true
	}

	openFilter := func() {
		body.AddItem(filter, 1, 0, false)
		a.app.SetFocus(filter)
	}
	closeFilter := func() {
		body.RemoveItem(filter)
		a.app.SetFocus(table)
	}
	filter.SetChangedFunc(func(text string) { render(text) })
	filter.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		switch ev.Key() {
		case tcell.KeyEnter, tcell.KeyEsc:
			if ev.Key() == tcell.KeyEsc {
				filter.SetText("")
				render("")
			}
			closeFilter()
			return nil
		}
		return ev
	})

	back := func() { a.showMenu() }

	hints := hintList
	if def.isPods {
		hints = hintListPod
	}

	table.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		switch ev.Key() {
		case tcell.KeyEnter:
			if r, ok := selected(); ok && def.getYAML != nil {
				a.showYaml(def, r, view)
			}
			return nil
		case tcell.KeyEsc:
			back()
			return nil
		case tcell.KeyRune:
			switch ev.Rune() {
			case 'q':
				back()
				return nil
			case 'c':
				a.showClusters()
				return nil
			case '/':
				openFilter()
				return nil
			case 'r':
				reload()
				return nil
			case 'y':
				if r, ok := selected(); ok && def.getYAML != nil {
					a.showYaml(def, r, view)
				}
				return nil
			case 'e':
				if r, ok := selected(); ok {
					if def.updateYAML == nil {
						a.flash("Not editable", def.title+" cannot be edited from the TUI", colWarn)
						return nil
					}
					a.editYaml(def, r, view)
				}
				return nil
			case 'd':
				if r, ok := selected(); ok {
					if def.del == nil {
						a.flash("Not deletable", def.title+" cannot be deleted from the TUI", colWarn)
						return nil
					}
					target := r.name
					if def.namespaced {
						target = r.namespace + "/" + r.name
					}
					a.confirm(fmt.Sprintf("Delete %s %q?", def.title, target), func() {
						if err := def.del(a.cluster, r.name, r.namespace); err != nil {
							a.flash("Error", err.Error(), colDanger)
							return
						}
						reload()
					})
				}
				return nil
			case 'l':
				if def.isPods {
					if r, ok := selected(); ok {
						a.showLogs(r, view)
					}
				}
				return nil
			case 's':
				if def.isPods {
					if r, ok := selected(); ok {
						a.execPod(r, view)
					}
				}
				return nil
			case 'g':
				if len(shown) > 0 {
					table.Select(1, 0)
				}
				return nil
			case 'G':
				if len(shown) > 0 {
					table.Select(len(shown), 0)
				}
				return nil
			}
			// extra per-resource actions (e.g. cordon/drain on nodes)
			for _, act := range def.actions {
				if ev.Rune() == act.key {
					if r, ok := selected(); ok {
						run := func() {
							if err := act.run(a.cluster, r.name, r.namespace); err != nil {
								a.flash("Error", err.Error(), colDanger)
								return
							}
							a.flash(act.label, fmt.Sprintf("%s: %s", act.label, r.name), colOk)
							reload()
						}
						if act.confirm {
							a.confirm(fmt.Sprintf("%s %q?", act.label, r.name), run)
						} else {
							run()
						}
					}
					return nil
				}
			}
		}
		return ev
	})

	if len(def.actions) > 0 {
		var extra []string
		for _, act := range def.actions {
			extra = append(extra, fmt.Sprintf("[teal]%c[-] %s", act.key, act.label))
		}
		hints = strings.Join(extra, "  ") + "  " + hints
	}

	a.setStatus(def.title, hints)
	a.resourceBody = body
	a.push("resource", body)
}

// statusColumnIndex finds the STATUS column so it can be colorized; -1 if none.
func statusColumnIndex(headers []string) int {
	for i, h := range headers {
		if h == "STATUS" {
			return i
		}
	}
	return -1
}
