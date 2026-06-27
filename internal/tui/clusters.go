package tui

import (
	"fmt"
	"os"
	"strings"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"

	"kube-ins/internal/business"
)

// showClusters is the landing screen: a table of configured clusters with
// add/delete/select/view actions backed by the business cluster functions.
func (a *App) showClusters() {
	table := tview.NewTable().
		SetBorders(false).
		SetSelectable(true, false).
		SetFixed(1, 0)
	table.SetBackgroundColor(colBg)
	table.SetBorder(true).SetBorderColor(colBorder).SetTitle(" Clusters ")

	var names []string

	reload := func() {
		table.Clear()
		for c, h := range []string{"NAME", "ACTIVE"} {
			table.SetCell(0, c, headerCell(h))
		}
		var err error
		names, err = business.ListClusters()
		if err != nil {
			a.flash("Error", err.Error(), colDanger)
		}
		for i, n := range names {
			active := ""
			color := colInk
			if n == a.cluster {
				active = "●"
				color = colTeal
			}
			table.SetCell(i+1, 0, tview.NewTableCell(" "+n+" ").SetTextColor(color).SetExpansion(1))
			table.SetCell(i+1, 1, tview.NewTableCell(" "+active+" ").SetTextColor(colTeal).SetAlign(tview.AlignCenter))
		}
		if len(names) == 0 {
			table.SetCell(1, 0, tview.NewTableCell(" (no clusters — press 'a' to add one) ").SetTextColor(colMuted).SetSelectable(false))
		} else {
			table.Select(1, 0)
		}
	}
	reload()

	selected := func() string {
		r, _ := table.GetSelection()
		idx := r - 1
		if idx < 0 || idx >= len(names) {
			return ""
		}
		return names[idx]
	}

	table.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		switch ev.Key() {
		case tcell.KeyEnter:
			n := selected()
			if n == "" {
				return nil
			}
			if err := business.SetActiveCluster(n); err != nil {
				a.flash("Error", err.Error(), colDanger)
				return nil
			}
			a.cluster = n
			a.showMenu()
			return nil
		case tcell.KeyEsc:
			a.app.Stop()
			return nil
		case tcell.KeyRune:
			switch ev.Rune() {
			case 'q':
				a.app.Stop()
			case 'a':
				a.showAddCluster(reload)
			case 'd':
				n := selected()
				if n == "" {
					return nil
				}
				a.confirm(fmt.Sprintf("Delete cluster config %q?", n), func() {
					if err := business.DeleteCluster(n); err != nil {
						a.flash("Error", err.Error(), colDanger)
						return
					}
					if n == a.cluster {
						_ = business.SetActiveCluster("")
						a.cluster = ""
					}
					reload()
				})
			case 'v':
				n := selected()
				if n == "" {
					return nil
				}
				content, err := business.GetClusterContent(n)
				if err != nil {
					a.flash("Error", err.Error(), colDanger)
					return nil
				}
				a.showText(" "+n+".yaml ", content, func() { a.showClusters() })
			case 'g':
				table.Select(1, 0)
			case 'G':
				table.Select(len(names), 0)
			}
		}
		return ev
	})

	a.setStatus("clusters", hintClusters)
	a.push("clusters", table)
}

// showAddCluster prompts for a cluster name and a kubeconfig file path, reads
// the file and persists it via business.SaveCluster.
func (a *App) showAddCluster(onDone func()) {
	form := tview.NewForm()
	form.SetBackgroundColor(colPanel)
	form.SetFieldBackgroundColor(colBg)
	form.SetFieldTextColor(colInk)
	form.SetLabelColor(colTeal)
	form.SetButtonBackgroundColor(colTealDim)
	form.SetButtonTextColor(colInk)
	form.SetBorder(true).SetBorderColor(colTeal).SetTitle(" Add Cluster ")

	form.AddInputField("Name", "", 40, nil, nil)
	form.AddInputField("Kubeconfig path", "", 40, nil, nil)

	finish := func() {
		name := strings.TrimSpace(form.GetFormItem(0).(*tview.InputField).GetText())
		path := strings.TrimSpace(form.GetFormItem(1).(*tview.InputField).GetText())
		if name == "" || path == "" {
			a.flash("Error", "Name and kubeconfig path are required", colDanger)
			return
		}
		data, err := os.ReadFile(expandHome(path))
		if err != nil {
			a.flash("Error", err.Error(), colDanger)
			return
		}
		if err := business.SaveCluster(name, string(data)); err != nil {
			a.flash("Error", err.Error(), colDanger)
			return
		}
		a.closeModal("addcluster")
		onDone()
	}

	form.AddButton("Save", finish)
	form.AddButton("Cancel", func() { a.closeModal("addcluster") })
	form.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		if ev.Key() == tcell.KeyEsc {
			a.closeModal("addcluster")
			return nil
		}
		return ev
	})

	a.modal("addcluster", form, 56, 11)
}

func expandHome(p string) string {
	if strings.HasPrefix(p, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			return home + p[1:]
		}
	}
	return p
}

func headerCell(text string) *tview.TableCell {
	return tview.NewTableCell(" " + text + " ").
		SetTextColor(colTeal).
		SetAttributes(tcell.AttrBold).
		SetSelectable(false).
		SetExpansion(1)
}
