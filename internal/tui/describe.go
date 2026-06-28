package tui

import (
	"fmt"
	"strings"
	"time"

	"kube-ins/internal/business"
	"kube-ins/internal/models"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

const (
	describePaneWidth = 64
	barHeight         = 8
	barWidth          = 3
)

// metricsKindFor reports whether a view's objects have live CPU/RAM metrics in
// the snapshot and returns the snapshot Kind used to match them. Workload kinds
// that the snapshot rolls up (ReplicaSet→Deployment, CronJob→Job) are omitted —
// they still get the describe section, just no usage bars.
func metricsKindFor(view string) (string, bool) {
	switch view {
	case "nodes":
		return "node", true
	case "pods":
		return "pod", true
	case "deployments":
		return "Deployment", true
	case "statefulsets":
		return "StatefulSet", true
	case "daemonsets":
		return "DaemonSet", true
	case "jobs":
		return "Job", true
	}
	return "", false
}

// showDescribe opens (or retargets) the describe side-panel for a row. The pane is
// mounted to the right of the list; focus stays on the list so the user can keep
// arrowing through rows (which retargets the panel via the selection-changed hook
// in buildResource). Press → to focus the pane and scroll it; ←/Esc/q returns.
func (a *App) showDescribe(def *resourceDef, row rowData, view string) {
	a.setDescribeTarget(def, row, view)

	if a.describeOpen {
		a.kickDescribe()
		return
	}

	a.describeText = tview.NewTextView().
		SetDynamicColors(true).
		SetWrap(false)
	a.describeText.SetBackgroundColor(colBg)
	a.describeText.SetTextColor(colInk)
	a.describeText.SetBorder(true).SetBorderColor(colBorder).
		SetTitle(" describe: " + row.name + " ")
	focusBorder(a.describeText.Box)

	// ←/Esc/q hand focus back to the list; everything else falls through to the
	// TextView so the pane scrolls (arrows/jk/g/G/PgUp/PgDn) when focused.
	a.describeText.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		switch {
		case ev.Key() == tcell.KeyLeft, ev.Key() == tcell.KeyEsc,
			ev.Key() == tcell.KeyRune && ev.Rune() == 'q':
			if a.resourceBody != nil {
				a.app.SetFocus(a.resourceBody)
			}
			return nil
		}
		return ev
	})

	// Synchronous first paint (overview only, no network) so the pane isn't blank
	// while the goroutine fetches metrics/describe.
	a.describeKey = ""
	a.describeText.SetText(buildDescribeText(def, row, view, models.MetricsSnapshot{}, "loading…", false))

	a.content.AddItem(a.describeText, describePaneWidth, 0, false)
	a.describeOpen = true

	stop := make(chan struct{})
	kick := make(chan struct{}, 1)
	a.describeStop = stop
	a.describeKick = kick
	go a.describeLoop(stop, kick)
	a.kickDescribe()
}

// closeDescribe tears down the describe pane and its refresh goroutine. Idempotent.
func (a *App) closeDescribe() {
	if !a.describeOpen {
		return
	}
	if a.describeStop != nil {
		close(a.describeStop)
		a.describeStop = nil
	}
	a.describeKick = nil
	if a.describeText != nil {
		a.content.RemoveItem(a.describeText)
		a.describeText = nil
	}
	a.describeOpen = false
}

func (a *App) setDescribeTarget(def *resourceDef, row rowData, view string) {
	a.describeMu.Lock()
	a.describeDef, a.describeRow, a.describeViewName = def, row, view
	a.describeMu.Unlock()
}

func (a *App) describeTarget() (*resourceDef, rowData, string) {
	a.describeMu.Lock()
	defer a.describeMu.Unlock()
	return a.describeDef, a.describeRow, a.describeViewName
}

// kickDescribe requests an immediate (non-blocking) refresh of the describe pane.
func (a *App) kickDescribe() {
	if a.describeKick == nil {
		return
	}
	select {
	case a.describeKick <- struct{}{}:
	default:
	}
}

// describeLoop fetches metrics + describe text off the UI thread and renders the
// pane, refreshing on the list cadence (or immediately on a kick) until stopped.
func (a *App) describeLoop(stop, kick chan struct{}) {
	ticker := time.NewTicker(a.refreshRate)
	defer ticker.Stop()
	for {
		def, row, view := a.describeTarget()
		if def != nil {
			_, eligible := metricsKindFor(view)
			var snap models.MetricsSnapshot
			if eligible {
				snap, _ = business.GetMetricsSnapshot(a.cluster)
			}
			describeText, err := business.GetObjectDescribe(a.cluster, view, row.namespace, row.name)
			if err != nil {
				describeText = err.Error()
			}
			text := buildDescribeText(def, row, view, snap, describeText, eligible)
			key := row.namespace + "/" + row.name

			select {
			case <-stop:
				return
			default:
			}
			a.app.QueueUpdateDraw(func() {
				if a.describeText == nil {
					return
				}
				rowOff, colOff := a.describeText.GetScrollOffset()
				a.describeText.SetText(text)
				a.describeText.SetTitle(" describe: " + row.name + " ")
				// Keep the scroll position across same-target refreshes; reset to
				// the top only when the selection moved to a different object.
				if a.describeKey != key {
					a.describeKey = key
					a.describeText.ScrollToBeginning()
				} else {
					a.describeText.ScrollTo(rowOff, colOff)
				}
			})
		}

		select {
		case <-stop:
			return
		case <-kick:
		case <-ticker.C:
		}
	}
}

// buildDescribeText renders the pane as a dynamic-colors string: the metrics
// ("monitor") block when eligible, the pod per-container usage, then the full
// `kubectl describe` output (escaped, since it can contain '[').
func buildDescribeText(def *resourceDef, row rowData, view string, snap models.MetricsSnapshot, describeText string, eligible bool) string {
	var b strings.Builder

	if eligible {
		kind, _ := metricsKindFor(view)
		if u, ok := matchUsage(kind, row, snap); ok {
			b.WriteString(renderMetrics(kind, u))
			b.WriteString("\n")
		} else {
			b.WriteString(fmt.Sprintf("  [%s]metrics unavailable[-]\n\n", hexOf(colMuted)))
		}
	}

	// Per-container usage for pods (monitor data from the snapshot).
	if view == "pods" {
		if u, ok := matchUsage("pod", row, snap); ok && len(u.Containers) > 0 {
			b.WriteString(section("CONTAINERS"))
			for _, c := range u.Containers {
				b.WriteString(kv(c.Name, fmt.Sprintf("%s · %s", fmtCPU(c.CpuMillis), fmtMem(c.MemMi))))
			}
			b.WriteString("\n")
		}
	}

	b.WriteString(section("DESCRIBE"))
	b.WriteString(tview.Escape(describeText))
	return b.String()
}

// matchUsage finds the ResourceUsage row for an object in the snapshot.
func matchUsage(kind string, row rowData, snap models.MetricsSnapshot) (models.ResourceUsage, bool) {
	switch kind {
	case "node":
		for _, n := range snap.Nodes {
			if n.Name == row.name {
				return n, true
			}
		}
	case "pod":
		for _, p := range snap.Pods {
			if p.Name == row.name && p.Namespace == row.namespace {
				return p, true
			}
		}
	default:
		for _, w := range snap.Workloads {
			if w.Kind == kind && w.Name == row.name && w.Namespace == row.namespace {
				return w, true
			}
		}
	}
	return models.ResourceUsage{}, false
}

// renderMetrics builds the CPU/RAM gauge block. Nodes use capacity as the
// denominator; pods/workloads use the summed limit (when set) — otherwise only
// the raw usage value is shown (no bar, no percentage).
func renderMetrics(kind string, u models.ResourceUsage) string {
	cpuDenom, memDenom := u.CpuLimitMillis, u.MemLimitMi
	if kind == "node" {
		cpuDenom, memDenom = u.CpuCapMillis, u.MemCapMi
	}

	cpuPct, cpuHas := pct(u.CpuMillis, cpuDenom)
	memPct, memHas := pct(u.MemMi, memDenom)

	// No denominator on either metric (e.g. a workload with no limits set):
	// skip the bar gauges and show a compact usage line instead.
	if !cpuHas && !memHas {
		return fmt.Sprintf("  [%s]CPU[-] %s    [%s]RAM[-] %s\n",
			hexOf(colTeal), fmtCPU(u.CpuMillis), hexOf(colTeal), fmtMem(u.MemMi))
	}

	cpuBar := barColumn(cpuPct, cpuHas)
	memBar := barColumn(memPct, memHas)

	var b strings.Builder
	b.WriteString(fmt.Sprintf("  [%s]CPU[-]            [%s]RAM[-]\n", hexOf(colTeal), hexOf(colTeal)))
	for i := 0; i < barHeight; i++ {
		b.WriteString("    " + cpuBar[i] + "            " + memBar[i] + "\n")
	}
	b.WriteString("  " + pctLabel(cpuPct, cpuHas) + "           " + pctLabel(memPct, memHas) + "\n")
	b.WriteString(fmt.Sprintf("  [%s]%s[-]      [%s]%s[-]\n",
		hexOf(colMuted), usageLabel(fmtCPU(u.CpuMillis), fmtCPU(cpuDenom), cpuHas),
		hexOf(colMuted), usageLabel(fmtMem(u.MemMi), fmtMem(memDenom), memHas)))
	return b.String()
}

// barColumn returns barHeight strings (top→bottom), each a colored block row, or
// blank spacers when there is no denominator to compute a fill against.
func barColumn(p float64, has bool) []string {
	out := make([]string, barHeight)
	if !has {
		blank := strings.Repeat(" ", barWidth)
		for i := range out {
			out[i] = blank
		}
		return out
	}
	filled := int((p/100)*float64(barHeight) + 0.5)
	if filled > barHeight {
		filled = barHeight
	}
	col := barColor(p)
	block := strings.Repeat("█", barWidth)
	empty := strings.Repeat("░", barWidth)
	for i := 0; i < barHeight; i++ {
		fromBottom := barHeight - i
		if fromBottom <= filled {
			out[i] = fmt.Sprintf("[%s]%s[-]", hexOf(col), block)
		} else {
			out[i] = fmt.Sprintf("[%s]%s[-]", hexOf(colBorder), empty)
		}
	}
	return out
}

func barColor(p float64) tcell.Color {
	switch {
	case p >= 90:
		return colDanger
	case p >= 70:
		return colWarn
	default:
		return colTeal
	}
}

func pct(used, denom int64) (float64, bool) {
	if denom <= 0 {
		return 0, false
	}
	return float64(used) / float64(denom) * 100, true
}

func pctLabel(p float64, has bool) string {
	if !has {
		return "  -  "
	}
	return fmt.Sprintf("[%s]%4.0f%%[-]", hexOf(barColor(p)), p)
}

func usageLabel(used, denom string, has bool) string {
	if !has {
		return used
	}
	return used + "/" + denom
}

func fmtCPU(m int64) string { return fmt.Sprintf("%dm", m) }
func fmtMem(mi int64) string {
	if mi >= 1024 {
		return fmt.Sprintf("%.1fGi", float64(mi)/1024)
	}
	return fmt.Sprintf("%dMi", mi)
}

func section(title string) string {
	return fmt.Sprintf("[%s::b]%s[-:-:-]\n", hexOf(colTeal), title)
}

func kv(key, val string) string {
	return fmt.Sprintf("  [%s]%-16s[-] %s\n", hexOf(colMuted), truncate(key, 16), val)
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	if n <= 1 {
		return string(r[:n])
	}
	return string(r[:n-1]) + "…"
}
