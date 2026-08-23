import { useEffect, useRef, useState } from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { VscGlobe, VscCopy, VscDebugRestart, VscClose, VscLock, VscArrowSwap } from 'react-icons/vsc';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
import { StopPortForward, StartPortForward } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import {
    usePortForwardStore,
    isWebForward,
    forwardUrl,
    forwardAddress,
    type PortForward,
} from '../../stores/portForwardStore';
import { usePanelActive } from '../../lib/usePanelActive';
import { writeClipboard } from '../../lib/clipboard';
import { errText } from '../../lib/errText';

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast';

const statusSeverity = (status: string): TagSeverity => {
    switch (status) {
        case 'ready': return 'success';
        case 'starting': return 'info';
        case 'reconnecting': return 'warning';
        case 'error': return 'danger';
        default: return 'secondary';
    }
};

const age = (iso: string): string => {
    if (!iso) return '-';
    const ms = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(ms) || ms < 0) return '-';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h${m % 60}m`;
    return `${Math.floor(h / 24)}d${h % 24}h`;
};

/**
 * The Port Forwards panel is a *view* onto the backend registry, not its owner.
 *
 * Every other list panel is pinned to one cluster and lists what that cluster
 * has. This one lists what this process is doing, across clusters — which is
 * why it is a singleton with empty params and lives outside the
 * `${view}:${clusterName}` scheme, next to Diagnostics. Closing it stops
 * nothing.
 */
export default function PortForwardsPanel({ api }: IDockviewPanelProps<Record<string, never>>) {
    const active = usePanelActive(api);
    const forwards = usePortForwardStore((s) => s.forwards);
    const startSync = usePortForwardStore((s) => s.startSync);
    const refresh = usePortForwardStore((s) => s.refresh);
    const toastRef = useRef<Toast>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    // Only used to re-render the Age column; the rows themselves are pushed by
    // the store.
    const [, setTick] = useState(0);

    useEffect(() => startSync(), [startSync]);

    useEffect(() => {
        if (!active) return;
        void refresh();
        const id = window.setInterval(() => setTick((t) => t + 1), 1000);
        return () => window.clearInterval(id);
    }, [active, refresh]);

    const notify = (severity: 'success' | 'error', summary: string, detail: string) =>
        toastRef.current?.show({ severity, summary, detail, life: severity === 'error' ? 6000 : 3000 });

    const stop = async (f: PortForward) => {
        setBusyId(f.id);
        try {
            await StopPortForward(f.id);
            await refresh();
        } catch (e) {
            notify('error', 'Could not stop', errText(e));
        } finally {
            setBusyId(null);
        }
    };

    // Restart is stop + start rather than a backend verb: a new tunnel resolves
    // the target again and gets a new id, which is exactly what the user wants
    // after a pod was replaced. The local port is requested explicitly so the
    // address they already have keeps working.
    const restart = async (f: PortForward) => {
        setBusyId(f.id);
        try {
            await StopPortForward(f.id);
            const info = await StartPortForward(
                f.cluster_name,
                f.resource_kind,
                f.resource_name,
                f.namespace,
                f.local_port,
                f.remote_port,
            );
            await refresh();
            notify('success', 'Restarted', `${f.address}:${models.PortForwardInfo.createFrom(info).local_port}`);
        } catch (e) {
            notify('error', 'Could not restart', errText(e));
            await refresh();
        } finally {
            setBusyId(null);
        }
    };

    const copy = async (f: PortForward) => {
        const ok = await writeClipboard(forwardAddress(f));
        notify(ok ? 'success' : 'error', ok ? 'Copied' : 'Copy failed', forwardAddress(f));
    };

    if (!active) return <div style={{ height: '100%' }} />;

    const empty = (
        <div className="flex flex-column align-items-center gap-2" style={{ padding: '2rem 1rem', color: 'var(--ink3)' }}>
            <VscArrowSwap size={22} />
            <span style={{ fontSize: '0.85rem' }}>No active port forwards.</span>
            <span style={{ fontSize: '0.78rem' }}>
                Start one from the ⇄ button on a Pod, Service, Deployment, StatefulSet or ReplicaSet row.
            </span>
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toastRef} />

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.6rem 1rem',
                    borderBottom: '1px solid var(--surface-border)',
                    flexShrink: 0,
                }}
            >
                <h3 style={{ margin: 0 }}>Port Forwards</h3>
                <span
                    className="flex align-items-center gap-1"
                    style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--ink3)' }}
                >
                    <VscLock size={12} />
                    Bound to 127.0.0.1 only. Tunnels stay open until you stop them or quit the app.
                </span>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
                <DataTable
                    value={forwards}
                    dataKey="id"
                    scrollable
                    scrollHeight="flex"
                    size="small"
                    emptyMessage={empty}
                >
                    <Column
                        field="status"
                        header="Status"
                        style={{ minWidth: '9rem' }}
                        body={(f: PortForward) => (
                            <span className="flex align-items-center gap-2">
                                <Tag value={f.status} severity={statusSeverity(f.status)} />
                                {f.status === 'reconnecting' && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--ink3)' }}>#{f.attempts}</span>
                                )}
                            </span>
                        )}
                    />
                    <Column
                        header="Address"
                        style={{ minWidth: '15rem' }}
                        body={(f: PortForward) => (
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                {f.address}:{f.local_port} → {f.remote_port}
                                {f.target_port !== 0 && f.target_port !== f.remote_port && (
                                    <span style={{ color: 'var(--ink3)' }}> (pod {f.target_port})</span>
                                )}
                            </span>
                        )}
                    />
                    <Column
                        header="Target"
                        style={{ minWidth: '14rem' }}
                        body={(f: PortForward) => (
                            <span>
                                <span style={{ color: 'var(--ink3)' }}>{f.resource_kind}/</span>
                                {f.resource_name}
                            </span>
                        )}
                    />
                    <Column field="namespace" header="Namespace" style={{ minWidth: '9rem' }} />
                    <Column
                        header="Pod"
                        style={{ minWidth: '12rem' }}
                        body={(f: PortForward) => f.pod_name || '-'}
                    />
                    <Column field="cluster_name" header="Cluster" style={{ minWidth: '9rem' }} />
                    <Column header="Age" style={{ minWidth: '5rem' }} body={(f: PortForward) => age(f.started_at)} />
                    <Column
                        header=""
                        headerStyle={{ width: '9rem' }}
                        style={{ minWidth: '9rem', maxWidth: '9rem' }}
                        body={(f: PortForward) => (
                            <div className="flex gap-1">
                                {isWebForward(f) && (
                                    <Button
                                        icon={<VscGlobe size={15} />}
                                        text
                                        size="small"
                                        severity="secondary"
                                        style={{ padding: '0.2rem' }}
                                        tooltip="Open in browser"
                                        tooltipOptions={{ position: 'top' }}
                                        aria-label="Open in browser"
                                        onClick={() => BrowserOpenURL(forwardUrl(f))}
                                    />
                                )}
                                <Button
                                    icon={<VscCopy size={15} />}
                                    text
                                    size="small"
                                    severity="secondary"
                                    style={{ padding: '0.2rem' }}
                                    tooltip="Copy address"
                                    tooltipOptions={{ position: 'top' }}
                                    aria-label="Copy address"
                                    onClick={() => void copy(f)}
                                />
                                <Button
                                    icon={<VscDebugRestart size={15} />}
                                    text
                                    size="small"
                                    severity="secondary"
                                    style={{ padding: '0.2rem' }}
                                    tooltip="Restart"
                                    tooltipOptions={{ position: 'top' }}
                                    aria-label="Restart"
                                    loading={busyId === f.id}
                                    onClick={() => void restart(f)}
                                />
                                <Button
                                    icon={<VscClose size={15} />}
                                    text
                                    size="small"
                                    severity="danger"
                                    style={{ padding: '0.2rem' }}
                                    tooltip={f.status === 'error' ? 'Dismiss' : 'Stop'}
                                    tooltipOptions={{ position: 'top' }}
                                    aria-label={f.status === 'error' ? 'Dismiss' : 'Stop'}
                                    loading={busyId === f.id}
                                    onClick={() => void stop(f)}
                                />
                            </div>
                        )}
                    />
                </DataTable>
            </div>

            {forwards.some((f) => f.status === 'error') && (
                <div
                    style={{
                        flexShrink: 0,
                        padding: '0.5rem 1rem',
                        borderTop: '1px solid var(--surface-border)',
                        fontSize: '0.78rem',
                        color: 'var(--red)',
                        wordBreak: 'break-word',
                    }}
                >
                    {forwards.filter((f) => f.status === 'error').map((f) => (
                        <div key={f.id}>
                            {f.resource_kind}/{f.resource_name}: {f.error}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
