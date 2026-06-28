package tui

import (
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// showWorkspace renders the split resource screen: the resource-type menu as a
// TreeView on the left (mirroring the GUI's collapsible sidebar groups) and the
// generic resource list on the right. Pods are opened by default; the left and
// right arrows move focus between the two panes.
func (a *App) showWorkspace() {
	root := tview.NewTreeNode("").SetSelectable(false)
	tree := tview.NewTreeView().SetRoot(root).SetCurrentNode(root)
	tree.SetBackgroundColor(colBg)
	tree.SetBorder(true).SetBorderColor(colBorder).SetTitle(" Resources ")
	tree.SetGraphicsColor(colBorder)
	focusBorder(tree.Box)
	a.tree = tree

	var podsLeaf *tview.TreeNode
	for _, g := range a.groups {
		group := tview.NewTreeNode(g.label).
			SetColor(colTeal).
			SetSelectable(true).
			SetExpanded(true)
		for _, it := range g.items {
			view := it.view
			leaf := tview.NewTreeNode("  " + it.label).
				SetColor(colInk).
				SetReference(view)
			group.AddChild(leaf)
			if view == "pods" {
				podsLeaf = leaf
			}
		}
		root.AddChild(group)
	}
	if podsLeaf != nil {
		tree.SetCurrentNode(podsLeaf)
	}

	// openCurrent loads the resource under the selected leaf into the right pane
	// (and focuses it); on a group node it toggles expand/collapse.
	openCurrent := func(node *tview.TreeNode) {
		ref := node.GetReference()
		if ref == nil {
			node.SetExpanded(!node.IsExpanded())
			return
		}
		a.loadResource(ref.(string))
	}
	tree.SetSelectedFunc(openCurrent)

	tree.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		switch ev.Key() {
		case tcell.KeyRight:
			// Right arrow: dive into the highlighted resource (right pane).
			if n := tree.GetCurrentNode(); n != nil && n.GetReference() != nil {
				a.loadResource(n.GetReference().(string))
				return nil
			}
		case tcell.KeyEsc:
			a.showClusters()
			return nil
		case tcell.KeyRune:
			switch ev.Rune() {
			case 'q', 'c':
				a.showClusters()
				return nil
			}
		}
		return ev
	})

	a.content = tview.NewFlex()

	split := tview.NewFlex().
		AddItem(tree, 30, 0, true).
		AddItem(a.content, 0, 1, false)

	a.push("workspace", split)
	// Open Pods by default; loadResource sets the status bar and moves focus to
	// the right-hand list.
	a.loadResource("pods")
}

// loadResource builds the generic list for a view and mounts it in the right
// pane, replacing whatever was there, then focuses it.
func (a *App) loadResource(view string) {
	def := a.registry[view]
	if def == nil {
		a.flash("Error", "unknown view: "+view, colDanger)
		return
	}

	// Tear down the describe pane and stop the previous list's auto-refresh before
	// building (and starting) the next one's, so only the visible list polls.
	a.closeDescribe()
	a.stopAutoRefresh()

	body, table, hints := a.buildResource(view)
	a.content.Clear()
	a.content.AddItem(body, 0, 1, true)
	a.resourceBody = body

	a.setStatus(def.title, hints)
	a.app.SetFocus(table)
}
