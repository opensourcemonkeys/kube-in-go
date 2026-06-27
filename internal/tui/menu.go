package tui

import (
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// showMenu renders the resource-type navigation as a TreeView, mirroring the
// GUI's collapsible sidebar groups. Selecting a leaf opens that resource list.
func (a *App) showMenu() {
	root := tview.NewTreeNode("").SetSelectable(false)
	tree := tview.NewTreeView().SetRoot(root).SetCurrentNode(root)
	tree.SetBackgroundColor(colBg)
	tree.SetBorder(true).SetBorderColor(colBorder).SetTitle(" Resources ")
	tree.SetGraphicsColor(colBorder)

	var firstLeaf *tview.TreeNode
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
			if firstLeaf == nil {
				firstLeaf = leaf
			}
		}
		root.AddChild(group)
	}
	if firstLeaf != nil {
		tree.SetCurrentNode(firstLeaf)
	}

	tree.SetSelectedFunc(func(node *tview.TreeNode) {
		ref := node.GetReference()
		if ref == nil {
			// group node: toggle expand/collapse
			node.SetExpanded(!node.IsExpanded())
			return
		}
		a.openResource(ref.(string))
	})

	tree.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		switch ev.Key() {
		case tcell.KeyEsc:
			a.showClusters()
			return nil
		case tcell.KeyRune:
			switch ev.Rune() {
			case 'q':
				a.showClusters()
				return nil
			case 'c':
				a.showClusters()
				return nil
			}
		}
		return ev
	})

	a.setStatus("menu", hintMenu)
	a.push("menu", tree)
}
