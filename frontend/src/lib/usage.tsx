import { Chart } from 'primereact/chart';

// Shared resource-usage formatting + tiny bar widgets, used by the Monitoring
// dashboard (components/monitoring/main.tsx) and the Overview dashboard
// (components/overview/main.tsx). Kept here so both render usage identically.

// ── formatting ──────────────────────────────────────────────────────
export const fmtCpu = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} cores` : `${m} m`);
export const fmtMem = (mi: number) => (mi >= 1024 ? `${(mi / 1024).toFixed(1)} GiB` : `${mi} MiB`);
export const pct = (used: number, cap: number) => (cap > 0 ? Math.min((used / cap) * 100, 100) : 0);
export const getUsageColor = (p: number) => (p < 60 ? '#5fc98a' : p < 80 ? '#e2a85a' : '#e07d6e');

// ── chart options ───────────────────────────────────────────────────
export const barOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { stacked: true, display: false, min: 0, max: 100 }, y: { stacked: true, display: false } },
    events: [] as any[],
};

// ── small reusable bits ─────────────────────────────────────────────
export function UsageBarChart({ p }: { p: number }) {
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

export function CssBar({ p }: { p: number }) {
    return <div className="mon-bar"><div className="mon-bar__fill" style={{ width: `${p}%`, background: getUsageColor(p) }} /></div>;
}
