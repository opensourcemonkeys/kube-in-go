package tui

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"kube-ins/internal/business"
	"kube-ins/internal/models"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

const (
	// monitoringRefresh matches the GUI dashboard's poll cadence (POLL_MS).
	monitoringRefresh = 4 * time.Second
	monitoringTopPods = 15
	monitoringBarW    = 28
	nodeBarW          = 14
)

// loadMonitoring mounts the live metrics dashboard in the right pane: cluster
// CPU/RAM gauges, per-node usage bars, and the top pods by CPU, re-polled from
// metrics-server every few seconds (metrics-server is point-in-time only, so
// there are no trends here — the GUI builds those client-side).
func (a *App) loadMonitoring() {
	a.closeDescribe()
	a.stopAutoRefresh()

	tv := tview.NewTextView().
		SetDynamicColors(true).
		SetWrap(false)
	tv.SetBackgroundColor(colBg)
	tv.SetTextColor(colInk)
	tv.SetBorder(true).SetBorderColor(colBorder).SetTitle(" Monitoring ")
	focusBorder(tv.Box)
	tv.SetText(fmt.Sprintf("\n  [%s]loading…[-]", hexOf(colMuted)))

	kick := make(chan struct{}, 1)
	tv.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		switch {
		case ev.Key() == tcell.KeyLeft, ev.Key() == tcell.KeyEsc,
			ev.Key() == tcell.KeyRune && ev.Rune() == 'q':
			a.app.SetFocus(a.tree)
			return nil
		case ev.Key() == tcell.KeyRune && ev.Rune() == 'c':
			a.showClusters()
			return nil
		case ev.Key() == tcell.KeyRune && ev.Rune() == 'r':
			select {
			case kick <- struct{}{}:
			default:
			}
			return nil
		}
		// Everything else falls through for native TextView scrolling
		// (arrows, PgUp/PgDn, g/G).
		return ev
	})

	a.content.Clear()
	a.content.AddItem(tv, 0, 1, true)
	a.resourceBody = tv

	// Poll loop. Reusing a.refreshStop means stopAutoRefresh — already called on
	// every view swap and when leaving the workspace — tears it down for free.
	stop := make(chan struct{})
	a.refreshStop = stop
	go func() {
		ticker := time.NewTicker(monitoringRefresh)
		defer ticker.Stop()
		for {
			start := time.Now()
			snap, err := business.GetMetricsSnapshot(a.cluster)
			elapsed := time.Since(start)
			select {
			case <-stop: // view was swapped while the fetch was in flight
				return
			default:
			}
			text := renderMonitoring(snap, err)
			a.app.QueueUpdateDraw(func() {
				a.updateRate(elapsed, err == nil)
				// Preserve the scroll position across refreshes.
				row, col := tv.GetScrollOffset()
				tv.SetText(text)
				tv.ScrollTo(row, col)
			})
			select {
			case <-stop:
				return
			case <-kick:
			case <-ticker.C:
			}
		}
	}()

	a.setStatus("Monitoring", hintMonitor)
	a.app.SetFocus(tv)
}

// renderMonitoring builds the dashboard as a dynamic-colors string. Errors and
// a missing metrics-server render inline — never as a flash, since the loop
// re-polls every tick and a modal per failure would loop.
func renderMonitoring(snap models.MetricsSnapshot, err error) string {
	if err != nil {
		return fmt.Sprintf("\n  [%s]%s[-]\n", hexOf(colDanger), tview.Escape(err.Error()))
	}
	if !snap.MetricsAvailable {
		return fmt.Sprintf("\n  [%s]metrics-server is not available in this cluster[-]\n", hexOf(colWarn))
	}

	var b strings.Builder
	b.WriteString("\n")
	b.WriteString(section("CLUSTER"))
	b.WriteString(gaugeLine("CPU", snap.Cluster.CpuMillis, snap.Cluster.CpuCapMillis, fmtCPU))
	b.WriteString(gaugeLine("RAM", snap.Cluster.MemMi, snap.Cluster.MemCapMi, fmtMem))
	b.WriteString(fmt.Sprintf("  [%s]%-8s[-] %d nodes · %d pods\n\n", hexOf(colMuted), "", len(snap.Nodes), len(snap.Pods)))

	b.WriteString(section("NODES"))
	for _, n := range snap.Nodes {
		b.WriteString(fmt.Sprintf("  %-24s [%s]CPU[-] %s  [%s]RAM[-] %s\n",
			truncate(n.Name, 24),
			hexOf(colMuted), hbar(n.CpuMillis, n.CpuCapMillis, nodeBarW),
			hexOf(colMuted), hbar(n.MemMi, n.MemCapMi, nodeBarW)))
	}
	b.WriteString("\n")

	b.WriteString(section(fmt.Sprintf("TOP %d PODS BY CPU", monitoringTopPods)))
	pods := make([]models.ResourceUsage, len(snap.Pods))
	copy(pods, snap.Pods)
	sort.Slice(pods, func(i, j int) bool { return pods[i].CpuMillis > pods[j].CpuMillis })
	if len(pods) > monitoringTopPods {
		pods = pods[:monitoringTopPods]
	}
	b.WriteString(fmt.Sprintf("  [%s]%-44s %-14s %-14s %s[-]\n", hexOf(colMuted), "NAMESPACE/NAME", "CPU", "RAM", "NODE"))
	for _, p := range pods {
		b.WriteString(fmt.Sprintf("  %-44s %-14s %-14s %s\n",
			truncate(p.Namespace+"/"+p.Name, 44),
			usageVsLimit(p.CpuMillis, p.CpuLimitMillis, fmtCPU),
			usageVsLimit(p.MemMi, p.MemLimitMi, fmtMem),
			dash(p.Node)))
	}
	return b.String()
}

// gaugeLine is a labelled full-width gauge with the raw used/capacity values,
// e.g. "  CPU  ████████░░░░  34%  1200m/3600m".
func gaugeLine(label string, used, cap int64, format func(int64) string) string {
	return fmt.Sprintf("  [%s]%-4s[-] %s  [%s]%s/%s[-]\n",
		hexOf(colTeal), label, hbar(used, cap, monitoringBarW),
		hexOf(colMuted), format(used), format(cap))
}

// hbar renders a horizontal usage gauge with a trailing percentage, colored by
// the same thresholds as the describe pane's bars; blank when there is no
// denominator.
func hbar(used, denom int64, width int) string {
	p, has := pct(used, denom)
	if !has {
		return strings.Repeat(" ", width) + "   - "
	}
	filled := int((p/100)*float64(width) + 0.5)
	if filled > width {
		filled = width
	}
	return fmt.Sprintf("[%s]%s[-][%s]%s[-] %s",
		hexOf(barColor(p)), strings.Repeat("█", filled),
		hexOf(colBorder), strings.Repeat("░", width-filled),
		pctLabel(p, true))
}

// usageVsLimit shows raw usage, with a usage-vs-limit percentage only when a
// limit is set (a zero limit makes the percentage undefined).
func usageVsLimit(used, limit int64, format func(int64) string) string {
	if p, has := pct(used, limit); has {
		return fmt.Sprintf("%s (%.0f%%)", format(used), p)
	}
	return format(used)
}
