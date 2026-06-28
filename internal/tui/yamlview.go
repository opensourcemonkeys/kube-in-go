package tui

import (
	"fmt"
	"strings"

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

// showYaml fetches and displays an object's YAML read-only, with 'e' to edit and
// '/' to search within the document ('n'/'N' jump between matches).
func (a *App) showYaml(def *resourceDef, row rowData, view string) {
	content, err := def.getYAML(a.cluster, row.name, row.namespace)
	if err != nil {
		a.flash("Error", err.Error(), colDanger)
		return
	}

	baseTitle := " " + def.title + ": " + row.name + " "

	// Regions + dynamic colors let us wrap matches in highlightable region tags.
	tv := tview.NewTextView().SetWrap(false)
	tv.SetDynamicColors(true).SetRegions(true)
	tv.SetBackgroundColor(colBg)
	tv.SetTextColor(colInk)
	tv.SetBorder(true).SetBorderColor(colBorder).SetTitle(baseTitle)

	search := tview.NewInputField().SetLabel(" / ")
	search.SetLabelColor(colTeal)
	search.SetFieldBackgroundColor(colBg)
	search.SetFieldTextColor(colInk)

	body := tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(tv, 0, 1, true)

	var matchCount, current int

	// apply re-renders the document with the query's matches wrapped as regions,
	// then highlights and scrolls to the current match.
	apply := func(query string) {
		text, n := highlightMatches(content, query)
		matchCount = n
		tv.SetText(text)
		if n == 0 {
			current = 0
			tv.Highlight()
			if strings.TrimSpace(query) == "" {
				tv.SetTitle(baseTitle)
			} else {
				tv.SetTitle(baseTitle + "[no match] ")
			}
			return
		}
		if current >= n {
			current = 0
		}
		tv.Highlight(fmt.Sprintf("m%d", current)).ScrollToHighlight()
		tv.SetTitle(fmt.Sprintf("%s[%d/%d] ", baseTitle, current+1, n))
	}
	apply("")

	cycle := func(delta int) {
		if matchCount == 0 {
			return
		}
		current = (current + delta + matchCount) % matchCount
		tv.Highlight(fmt.Sprintf("m%d", current)).ScrollToHighlight()
		tv.SetTitle(fmt.Sprintf("%s[%d/%d] ", baseTitle, current+1, matchCount))
	}

	openSearch := func() {
		body.AddItem(search, 1, 0, false)
		a.app.SetFocus(search)
	}
	closeSearch := func() {
		body.RemoveItem(search)
		a.app.SetFocus(tv)
	}

	search.SetChangedFunc(func(text string) { current = 0; apply(text) })
	search.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		switch ev.Key() {
		case tcell.KeyEnter:
			closeSearch()
			return nil
		case tcell.KeyEsc:
			search.SetText("")
			apply("")
			closeSearch()
			return nil
		}
		return ev
	})

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
		case ev.Key() == tcell.KeyRune && ev.Rune() == '/':
			openSearch()
			return nil
		case ev.Key() == tcell.KeyRune && ev.Rune() == 'n':
			cycle(1)
			return nil
		case ev.Key() == tcell.KeyRune && ev.Rune() == 'N':
			cycle(-1)
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
	a.pages.AddPage("detail", body, true, true)
	a.app.SetFocus(tv)
}

// highlightMatches escapes content for a dynamic-colors TextView and wraps each
// case-insensitive occurrence of query in a numbered region tag ("m0", "m1", …)
// so the viewer can highlight and scroll between them. It returns the marked-up
// text and the number of matches. An empty query yields the plain (escaped) text.
func highlightMatches(content, query string) (string, int) {
	if strings.TrimSpace(query) == "" {
		return tview.Escape(content), 0
	}
	lc := strings.ToLower(content)
	lq := strings.ToLower(query)
	var b strings.Builder
	count, i := 0, 0
	for {
		idx := strings.Index(lc[i:], lq)
		if idx < 0 {
			b.WriteString(tview.Escape(content[i:]))
			break
		}
		start := i + idx
		end := start + len(query)
		b.WriteString(tview.Escape(content[i:start]))
		b.WriteString(fmt.Sprintf(`["m%d"]`, count))
		b.WriteString(tview.Escape(content[start:end]))
		b.WriteString(`[""]`)
		count++
		i = end
	}
	return b.String(), count
}

// backToResource dismisses a detail overlay and restores the list screen.
func (a *App) backToResource() {
	a.pages.RemovePage("detail")
	if a.resourceBody != nil {
		a.app.SetFocus(a.resourceBody)
	}
}
