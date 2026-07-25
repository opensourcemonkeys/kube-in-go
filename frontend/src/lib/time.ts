// Shared kubectl-style relative/absolute time formatting for resource list
// tables (Age, Last Restart, ...). Thresholds mirror the Go-side humanAge
// (internal/services/crdServices.go) so GUI, CRD list, and TUI all agree.

export function humanAge(iso?: string): string {
    if (!iso) return '—';
    const created = new Date(iso).getTime();
    if (Number.isNaN(created)) return '—';

    const seconds = Math.max(0, Math.floor((Date.now() - created) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
}

export function absTime(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
}
