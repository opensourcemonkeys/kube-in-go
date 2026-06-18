import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart } from 'primereact/chart';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { FilterMatchMode } from 'primereact/api';
import { VscPulse, VscClose, VscChevronRight, VscDeviceCamera } from 'react-icons/vsc';
import { toPng } from 'html-to-image';

import { GetMetricsSnapshot, SaveSnapshot } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useMetricsStore, ClusterPoint, EntityPoint } from '../../stores/metricsStore';

const POLL_MS = 4000;

// Selectable chart time windows (minutes) — clip the rolling buffer for display.
const WINDOWS = [
    { label: '5 min', value: 5 },
    { label: '10 min', value: 10 },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '2 hours', value: 120 },
];

const defaultFilters = (): DataTableFilterMeta => ({
    namespace: { value: null, matchMode: FilterMatchMode.CONTAINS },
    name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    node: { value: null, matchMode: FilterMatchMode.CONTAINS },
    kind: { value: null, matchMode: FilterMatchMode.CONTAINS },
});

// ── formatting ──────────────────────────────────────────────────────
const fmtCpu = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} cores` : `${m} m`);
const fmtMem = (mi: number) => (mi >= 1024 ? `${(mi / 1024).toFixed(1)} GiB` : `${mi} MiB`);
const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const pct = (used: number, cap: number) => (cap > 0 ? Math.min((used / cap) * 100, 100) : 0);
const getUsageColor = (p: number) => (p < 60 ? '#5fc98a' : p < 80 ? '#e2a85a' : '#e07d6e');

// ── chart options ───────────────────────────────────────────────────
const barOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { stacked: true, display: false, min: 0, max: 100 }, y: { stacked: true, display: false } },
    events: [] as any[],
};

// Time-based x-axis fixed to [xMin, xMax] so charts always span the selected
// window (data points are positioned by their real timestamp).
const lineOptions = (suggestedMax?: number, xMin?: number, xMax?: number) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    parsing: false as const,
    // Easy hover: snap to the nearest x anywhere over the chart (no need to land
    // exactly on a point), showing every dataset's value at that time.
    interaction: { mode: 'index' as const, intersect: false, axis: 'x' as const },
    plugins: {
        legend: { display: true, labels: { color: '#98a1b3', boxWidth: 10, boxHeight: 10, font: { size: 10 } } },
        tooltip: { enabled: true, mode: 'index' as const, intersect: false, callbacks: { title: (items: any[]) => (items.length ? fmtTime(items[0].parsed.x) : '') } },
    },
    scales: {
        x: {
            type: 'linear' as const,
            min: xMin,
            max: xMax,
            ticks: { color: '#5c6779', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6, callback: (v: any) => fmtTime(Number(v)) },
            grid: { display: false },
        },
        y: {
            beginAtZero: true,
            ...(suggestedMax ? { suggestedMax } : {}),
            ticks: { color: '#5c6779', font: { size: 10 }, maxTicksLimit: 4 },
            grid: { color: 'rgba(26,33,46,.6)' },
        },
    },
    elements: { point: { radius: 0, hoverRadius: 4, hitRadius: 10 }, line: { tension: 0.3, borderWidth: 1.5 } },
});

// ── small reusable bits ─────────────────────────────────────────────
function UsageBarChart({ p }: { p: number }) {
    const color = getUsageColor(p);
    const data = {
        labels: [''],
        datasets: [
            { data: [p], backgroundColor: [color], borderRadius: 3, borderSkipped: false as const },
            { data: [100 - p], backgroundColor: ['#252e3f'], borderRadius: 0, borderSkipped: false as const },
        ],
    };
    return <div style={{ flex: 1, height: 14, minWidth: 60 }}><Chart type="bar" data={data} options={barOptions} style={{ height: 14 }} /></div>;
}

function CssBar({ p }: { p: number }) {
    return <div className="mon-bar"><div className="mon-bar__fill" style={{ width: `${p}%`, background: getUsageColor(p) }} /></div>;
}

// A compact row list (container breakdown / member pods) with CPU+Mem bars.
type BdRow = { id: string; label: string; sub?: string; cpu: number; mem: number; onClick?: () => void };
function BreakdownList({ rows, cpuMax, memMax, empty }: { rows: BdRow[]; cpuMax: number; memMax: number; empty: string }) {
    if (rows.length === 0) return <div className="mon-empty">{empty}</div>;
    return (
        <div className="mon-bd">
            {rows.map((r) => (
                <div key={r.id} className={`mon-bd__row${r.onClick ? ' mon-bd__row--click' : ''}`} onClick={r.onClick}>
                    <div className="mon-bd__label" title={r.label}>
                        {r.label}{r.sub && <span className="mon-bd__sub">{r.sub}</span>}
                    </div>
                    <div className="mon-bd__metric"><span>{fmtCpu(r.cpu)}</span><CssBar p={pct(r.cpu, cpuMax)} /></div>
                    <div className="mon-bd__metric"><span>{fmtMem(r.mem)}</span><CssBar p={pct(r.mem, memMax)} /></div>
                    {r.onClick && <VscChevronRight className="mon-bd__chev" />}
                </div>
            ))}
        </div>
    );
}

// ── selection ───────────────────────────────────────────────────────
type Selected = { cat: 'node' | 'pod' | 'workload'; kind: string; name: string; namespace: string; id: string; label: string };

const findUsage = (snap: models.MetricsSnapshot, sel: Selected): models.ResourceUsage | undefined => {
    if (sel.cat === 'node') return snap.nodes?.find((n) => n.name === sel.name);
    if (sel.cat === 'pod') return snap.pods?.find((x) => x.namespace === sel.namespace && x.name === sel.name);
    return snap.workloads?.find((w) => w.kind === sel.kind && w.namespace === sel.namespace && w.name === sel.name);
};

const podSel = (r: models.ResourceUsage): Selected => ({
    cat: 'pod', kind: 'pod', name: r.name, namespace: r.namespace, id: `pod/${r.namespace}/${r.name}`, label: `${r.namespace}/${r.name}`,
});

export default function MonitoringDashboard({ clusterName }: { clusterName: string }) {
    const storeKey = `metrics:${clusterName}`;
    const [snap, setSnap] = useState<models.MetricsSnapshot | null>(null);
    const [mode, setMode] = useState<'pods' | 'workloads'>('pods');
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const [selected, setSelected] = useState<Selected | null>(null);
    const [windowMin, setWindowMin] = useState(15);
    const [snapping, setSnapping] = useState(false);

    const record = useMetricsStore((s) => s.record);
    const buf = useMetricsStore((s) => s.tabs[storeKey]);

    const selRef = useRef<Selected | null>(null);
    selRef.current = selected;
    const rootRef = useRef<HTMLDivElement>(null);

    // Keep only points within the selected time window.
    const clip = <T extends { t: number }>(pts: T[]): T[] => {
        const since = Date.now() - windowMin * 60_000;
        return pts.filter((p) => p.t >= since);
    };

    // Capture the whole dashboard panel as a PNG and download it. html-to-image
    // often captures live <canvas> (chart.js) blank, so we temporarily swap each
    // canvas for a static <img> of its contents, capture, then restore.
    const takeSnapshot = async () => {
        const root = rootRef.current;
        if (!root || snapping) return;
        setSnapping(true);
        const swaps: { canvas: HTMLCanvasElement; img: HTMLImageElement }[] = [];
        try {
            root.querySelectorAll('canvas').forEach((canvas) => {
                const img = document.createElement('img');
                img.src = canvas.toDataURL('image/png');
                const cs = getComputedStyle(canvas);
                img.style.width = cs.width;
                img.style.height = cs.height;
                img.style.display = 'inline-block';
                canvas.style.display = 'none';
                canvas.parentElement?.insertBefore(img, canvas);
                swaps.push({ canvas, img });
            });
            const dataUrl = await toPng(root, { backgroundColor: '#080b11', pixelRatio: 2, cacheBust: true });
            const name = `monitoring-${clusterName}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
            await SaveSnapshot(name, dataUrl);
        } catch (e) {
            console.error('snapshot failed:', e);
        } finally {
            swaps.forEach(({ canvas, img }) => { img.remove(); canvas.style.display = ''; });
            setSnapping(false);
        }
    };

    useEffect(() => {
        let alive = true;
        const tick = async () => {
            try {
                const s = await GetMetricsSnapshot(clusterName);
                if (!alive) return;
                setSnap(s);
                const cp: ClusterPoint = {
                    t: s.timestamp || Date.now(),
                    cpu: s.cluster?.cpuMillis ?? 0, mem: s.cluster?.memMi ?? 0,
                    cpuCap: s.cluster?.cpuCapMillis ?? 0, memCap: s.cluster?.memCapMi ?? 0,
                };
                let eid: string | null = null;
                let ep: EntityPoint | null = null;
                const sel = selRef.current;
                if (sel) {
                    const u = findUsage(s, sel);
                    if (u) { eid = sel.id; ep = { t: cp.t, cpu: u.cpuMillis, mem: u.memMi }; }
                }
                record(storeKey, cp, eid, ep);
            } catch { /* offline — keep last snapshot */ }
        };
        tick();
        const id = window.setInterval(tick, POLL_MS);
        return () => { alive = false; window.clearInterval(id); };
    }, [clusterName, storeKey, record]);

    const select = (s: Selected) => setSelected((cur) => (cur?.id === s.id ? null : s));

    // consumers table rows — all of them; sorting & filtering handled by DataTable
    const rows = useMemo(() => {
        const src = (mode === 'pods' ? snap?.pods : snap?.workloads) ?? [];
        return src.map((r) => ({
            ...r,
            _id: mode === 'pods' ? `pod/${r.namespace}/${r.name}` : `wl/${r.kind}/${r.namespace}/${r.name}`,
        }));
    }, [snap, mode]);

    if (!snap) return <div className="mon-root"><div className="mon-empty">Loading metrics…</div></div>;
    if (!snap.metricsAvailable) {
        return (
            <div className="mon-root">
                <div className="mon-header"><VscPulse /> <span>Resource Monitoring</span><span className="mon-cluster">• {clusterName}</span></div>
                <Message severity="warn" text="metrics-server is not available on this cluster — resource usage cannot be shown. Install metrics-server to enable monitoring." />
            </div>
        );
    }

    const c = snap.cluster;
    const cpuCap = c.cpuCapMillis || 1;
    const memCap = c.memCapMi || 1;
    const cpuClusterPct = pct(c.cpuMillis, c.cpuCapMillis);
    const memClusterPct = pct(c.memMi, c.memCapMi);
    const clusterPts = clip(buf?.cluster ?? []);

    // TEMP (layout test): pretend there are 100 nodes. Remove this block and use
    // (snap.nodes ?? []) in the Nodes map to restore real data.
    const realNodes = snap.nodes ?? [];
    const testNodes = realNodes.length
        ? Array.from({ length: 100 }, (_, i) => {
              const base = realNodes[i % realNodes.length];
              return { ...base, name: `${base.name}-test${i + 1}` } as typeof base;
          })
        : [];

    const xMax = Date.now();
    const xMin = xMax - windowMin * 60_000;
    const clusterTrend = {
        datasets: [
            { label: 'CPU %', data: clusterPts.map((p) => ({ x: p.t, y: +pct(p.cpu, p.cpuCap).toFixed(1) })), borderColor: '#3fc8b4', backgroundColor: 'rgba(63,200,180,.15)', fill: true },
            { label: 'Mem %', data: clusterPts.map((p) => ({ x: p.t, y: +pct(p.mem, p.memCap).toFixed(1) })), borderColor: '#6ea8e6', backgroundColor: 'rgba(110,168,230,.12)', fill: true },
        ],
    };

    return (
        <div className="mon-root" ref={rootRef}>
            <div className="mon-header">
                <VscPulse /> <span>Resource Monitoring</span><span className="mon-cluster">• {clusterName}</span>
                <div className="mon-header__actions">
                    <Dropdown value={windowMin} options={WINDOWS} onChange={(e) => setWindowMin(e.value)} aria-label="Time window" />
                    <Button label="Take snapshot" icon={<VscDeviceCamera />} outlined onClick={takeSnapshot} loading={snapping} />
                </div>
            </div>

            <div className="mon-layout">
                <div className="mon-main">
                    {/* Cluster summary */}
                    <div className="mon-grid">
                        <div className="mon-card">
                            <div className="mon-card__head"><span>Cluster CPU</span><b>{fmtCpu(c.cpuMillis)} / {fmtCpu(c.cpuCapMillis)}</b></div>
                            <div className="mon-card__pct" style={{ color: getUsageColor(cpuClusterPct) }}>{cpuClusterPct.toFixed(0)}%</div>
                            <div className="mon-trend"><Chart type="line" data={clusterTrend} options={lineOptions(100, xMin, xMax)} style={{ height: 130 }} /></div>
                        </div>
                        <div className="mon-card">
                            <div className="mon-card__head"><span>Cluster Memory</span><b>{fmtMem(c.memMi)} / {fmtMem(c.memCapMi)}</b></div>
                            <div className="mon-card__pct" style={{ color: getUsageColor(memClusterPct) }}>{memClusterPct.toFixed(0)}%</div>
                            <div className="mon-trend"><Chart type="line" data={clusterTrend} options={lineOptions(100, xMin, xMax)} style={{ height: 130 }} /></div>
                        </div>
                    </div>

                    {/* Nodes */}
                    <div className="mon-section-title">Nodes</div>
                    <div className="mon-nodes">
                        {testNodes.map((n) => {
                            const cp = pct(n.cpuMillis, n.cpuCapMillis);
                            const mp = pct(n.memMi, n.memCapMi);
                            const isSel = selected?.id === `node/${n.name}`;
                            return (
                                <div key={n.name} className={`mon-node${isSel ? ' mon-node--sel' : ''}`}
                                    onClick={() => select({ cat: 'node', kind: 'node', name: n.name, namespace: '', id: `node/${n.name}`, label: n.name })}>
                                    <div className="mon-node__name">{n.name}</div>
                                    <div className="mon-node__row"><span>CPU</span><UsageBarChart p={cp} /><span>{cp.toFixed(0)}%</span></div>
                                    <div className="mon-node__row"><span>MEM</span><UsageBarChart p={mp} /><span>{mp.toFixed(0)}%</span></div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Top consumers */}
                    <div className="mon-consumers-head">
                        <div
                            className={`mon-switch mon-switch--${mode}`}
                            role="switch"
                            aria-checked={mode === 'workloads'}
                            tabIndex={0}
                            onClick={() => setMode((m) => (m === 'pods' ? 'workloads' : 'pods'))}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMode((m) => (m === 'pods' ? 'workloads' : 'pods')); } }}
                            title="Switch Pods / Workloads"
                        >
                            <span className="mon-switch__thumb" />
                            <button type="button" className={`mon-switch__opt${mode === 'pods' ? ' is-active' : ''}`} onClick={(e) => { e.stopPropagation(); setMode('pods'); }}>Pods</button>
                            <button type="button" className={`mon-switch__opt${mode === 'workloads' ? ' is-active' : ''}`} onClick={(e) => { e.stopPropagation(); setMode('workloads'); }}>Workloads</button>
                        </div>
                    </div>
                    <DataTable value={rows} size="small" dataKey="_id" scrollable scrollHeight="340px"
                        removableSort sortField="cpuMillis" sortOrder={-1}
                        filterDisplay="menu" filters={filters} onFilter={(e) => setFilters(e.filters)}
                        rowClassName={(r: any) => (selected?.id === r._id ? 'mon-row--sel' : '')}
                        onRowClick={(e) => {
                            const r = e.data as models.ResourceUsage;
                            if (mode === 'pods') select(podSel(r));
                            else select({ cat: 'workload', kind: r.kind, name: r.name, namespace: r.namespace, id: `wl/${r.kind}/${r.namespace}/${r.name}`, label: `${r.kind} · ${r.namespace}/${r.name}` });
                        }}
                        emptyMessage="No data.">
                        {mode === 'workloads' && <Column field="kind" header="Kind" sortable filter filterPlaceholder="Kind" style={{ width: 120 }} />}
                        <Column field="namespace" header="Namespace" sortable filter filterPlaceholder="Namespace" style={{ width: 150 }} />
                        <Column field="name" header="Name" sortable filter filterPlaceholder="Name" />
                        {mode === 'pods' && <Column field="node" header="Node" sortable filter filterPlaceholder="Node" style={{ width: 140 }} />}
                        {mode === 'workloads' && <Column field="pods" header="Pods" sortable dataType="numeric" style={{ width: 70 }} />}
                        <Column field="cpuMillis" header="CPU" sortable dataType="numeric" style={{ width: 200 }} body={(r: models.ResourceUsage) => (
                            <div className="mon-cell"><span className="mon-cell__val">{fmtCpu(r.cpuMillis)}</span><CssBar p={pct(r.cpuMillis, cpuCap)} /></div>
                        )} />
                        <Column field="memMi" header="Memory" sortable dataType="numeric" style={{ width: 200 }} body={(r: models.ResourceUsage) => (
                            <div className="mon-cell"><span className="mon-cell__val">{fmtMem(r.memMi)}</span><CssBar p={pct(r.memMi, memCap)} /></div>
                        )} />
                    </DataTable>
                </div>

                {selected && (
                    <DetailDrawer snap={snap} selected={selected} series={clip(buf?.series[selected.id] ?? [])}
                        cpuCap={cpuCap} memCap={memCap} windowMin={windowMin} onSelect={select} onClose={() => setSelected(null)} />
                )}
            </div>
        </div>
    );
}

// ── detail drawer ───────────────────────────────────────────────────
function DetailDrawer({ snap, selected, series, cpuCap, memCap, windowMin, onSelect, onClose }: {
    snap: models.MetricsSnapshot;
    selected: Selected;
    series: EntityPoint[];
    cpuCap: number;
    memCap: number;
    windowMin: number;
    onSelect: (s: Selected) => void;
    onClose: () => void;
}) {
    const cur = findUsage(snap, selected);
    const curCpu = cur?.cpuMillis ?? 0;
    const curMem = cur?.memMi ?? 0;

    const xMax = Date.now();
    const xMin = xMax - windowMin * 60_000;
    const cpuTrend = { datasets: [{ label: 'CPU (m)', data: series.map((p) => ({ x: p.t, y: p.cpu })), borderColor: '#3fc8b4', backgroundColor: 'rgba(63,200,180,.15)', fill: true }] };
    const memTrend = { datasets: [{ label: 'Mem (MiB)', data: series.map((p) => ({ x: p.t, y: p.mem })), borderColor: '#6ea8e6', backgroundColor: 'rgba(110,168,230,.12)', fill: true }] };

    let breakdown: JSX.Element | null = null;
    if (selected.cat === 'pod') {
        const conts = cur?.containers ?? [];
        const cMax = Math.max(1, ...conts.map((x) => x.cpuMillis));
        const mMax = Math.max(1, ...conts.map((x) => x.memMi));
        breakdown = (
            <>
                <div className="mon-drawer__sub">Containers ({conts.length})</div>
                <BreakdownList empty="No container metrics." cpuMax={cMax} memMax={mMax}
                    rows={conts.map((x) => ({ id: x.name, label: x.name, cpu: x.cpuMillis, mem: x.memMi }))} />
            </>
        );
    } else {
        const members = selected.cat === 'workload'
            ? (snap.pods ?? []).filter((p) => p.ownerKind === selected.kind && p.ownerName === selected.name && p.namespace === selected.namespace)
            : (snap.pods ?? []).filter((p) => p.node === selected.name);
        const cMax = Math.max(1, ...members.map((x) => x.cpuMillis));
        const mMax = Math.max(1, ...members.map((x) => x.memMi));
        const sorted = [...members].sort((a, b) => b.cpuMillis - a.cpuMillis);
        breakdown = (
            <>
                <div className="mon-drawer__sub">Pods ({members.length})</div>
                <BreakdownList empty="No pods." cpuMax={cMax} memMax={mMax}
                    rows={sorted.map((p) => ({
                        id: `${p.namespace}/${p.name}`,
                        label: p.name,
                        sub: selected.cat === 'node' ? p.namespace : undefined,
                        cpu: p.cpuMillis, mem: p.memMi,
                        onClick: () => onSelect(podSel(p)),
                    }))} />
            </>
        );
    }

    return (
        <aside className="mon-drawer">
            <div className="mon-drawer__head">
                <div className="mon-drawer__title">
                    <span className="mon-drawer__kind">{selected.cat === 'pod' ? 'Pod' : selected.cat === 'node' ? 'Node' : selected.kind}</span>
                    <b title={selected.label}>{selected.label}</b>
                </div>
                <button className="mon-drawer__close" onClick={onClose} title="Close"><VscClose /></button>
            </div>

            <div className="mon-drawer__stats">
                <div><span>CPU</span><b>{fmtCpu(curCpu)}</b><i>{pct(curCpu, cpuCap).toFixed(1)}% of cluster</i></div>
                <div><span>Memory</span><b>{fmtMem(curMem)}</b><i>{pct(curMem, memCap).toFixed(1)}% of cluster</i></div>
            </div>

            <div className="mon-drawer__sub">Trend</div>
            {series.length < 2 ? (
                <div className="mon-empty">Collecting data… (updates every {POLL_MS / 1000}s)</div>
            ) : (
                <>
                    <div className="mon-trend mon-trend--lg"><Chart type="line" data={cpuTrend} options={lineOptions(undefined, xMin, xMax)} style={{ height: 130 }} /></div>
                    <div className="mon-trend mon-trend--lg"><Chart type="line" data={memTrend} options={lineOptions(undefined, xMin, xMax)} style={{ height: 130 }} /></div>
                </>
            )}

            {breakdown}
        </aside>
    );
}
