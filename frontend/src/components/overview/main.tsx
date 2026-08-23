import { useCallback, useEffect, useState } from 'react';
import type { DockviewPanelApi } from 'dockview';
import { Message } from 'primereact/message';
import { VscCircleLarge, VscCopy, VscSync, VscServer, VscTypeHierarchySub, VscDashboard } from 'react-icons/vsc';

import {
    GetMetricsSnapshot, GetNodes, GetClusterCounts,
} from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import { usePanelActive } from '../../lib/usePanelActive';
import { fmtCpu, fmtMem, pct, getUsageColor, CssBar } from '../../lib/usage';
import { errText } from '../../lib/errText';
import ErrorBanner from '../shared/ErrorBanner';
import { useT } from '../../i18n/useT';

// A count tile does not need 5s granularity, and this tick is three cluster
// round trips wide.
const POLL_MS = 15000;

// Clickable count tiles — each opens the matching resource view. `view`/`title`/`icon`
// mirror the entries in menu/menuItems.tsx so tiles and the sidebar stay in sync.
type TileDef = { key: keyof Counts; view: string; title: string; icon: JSX.Element };
const TILES: TileDef[] = [
    { key: 'pods',        view: 'pods',        title: 'Pods',        icon: <VscCircleLarge /> },
    { key: 'deployments', view: 'deployments', title: 'Deployments', icon: <VscCopy /> },
    { key: 'services',    view: 'services',    title: 'Services',    icon: <VscSync /> },
    { key: 'nodes',       view: 'nodes',       title: 'Nodes',       icon: <VscServer /> },
    { key: 'namespaces',  view: 'namespaces',  title: 'Namespaces',  icon: <VscTypeHierarchySub /> },
];

type Counts = models.ClusterCounts;

export default function OverviewDashboard({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const t = useT();
    const { openTab } = useTabContext();
    const active = usePanelActive(api);

    const [snap, setSnap] = useState<models.MetricsSnapshot | null>(null);
    const [nodes, setNodes] = useState<models.NodeInfo[] | null>(null);
    const [counts, setCounts] = useState<Counts | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Promise.all rejects on the first failing call, so one unreachable endpoint
    // reports the whole tick as failed — which is the honest outcome here: the
    // dashboard's numbers would be a mix of fresh and stale otherwise. Last good
    // values stay on screen and the banner says so.
    //
    // The tile numbers come from GetClusterCounts, not from six listings this
    // used to fetch in full and then call `.length` on. GetNodes stays because
    // the node cards below render the objects themselves.
    const tick = useCallback(async () => {
        setRefreshing(true);
        try {
            const [s, n, cnt] = await Promise.all([
                GetMetricsSnapshot(clusterName),
                GetNodes(clusterName),
                GetClusterCounts(clusterName),
            ]);
            setSnap(s);
            setNodes(n);
            setCounts(cnt);
            setError(null);
        } catch (e) {
            console.error('Failed to load the overview:', e);
            setError(errText(e));
        } finally {
            setRefreshing(false);
        }
    }, [clusterName]);

    useEffect(() => {
        if (!active) return; // pause polling for a backgrounded tab or a hidden window
        tick();
        const id = window.setInterval(tick, POLL_MS);
        return () => window.clearInterval(id);
    }, [active, tick]);

    const openView = (t: TileDef) =>
        openTab({ view: t.view, clusterName, icon: t.icon });

    const c = snap?.cluster;
    const cpuPct = c ? pct(c.cpuMillis, c.cpuCapMillis) : 0;
    const memPct = c ? pct(c.memMi, c.memCapMi) : 0;

    return (
        <div className="mon-root">
            <div className="mon-header">
                <VscDashboard /> <span>{t('panels:overview.label')}</span><span className="mon-cluster">• {clusterName}</span>
            </div>

            <ErrorBanner
                message={error}
                onRetry={tick}
                busy={refreshing}
                stale={counts !== null}
                context={`Overview (${clusterName})`}
            />

            {/* Resource count tiles */}
            <div className="ov-tiles">
                {TILES.map((t) => (
                    <button key={t.key} className="ov-tile" onClick={() => openView(t)} title={`Open ${t.title}`}>
                        <span className="ov-tile__icon">{t.icon}</span>
                        <span className="ov-tile__num">{counts ? counts[t.key] : '—'}</span>
                        <span className="ov-tile__label">{t.title}</span>
                    </button>
                ))}
            </div>

            {/* Cluster CPU / Memory */}
            <div className="mon-section-title">{t('panels:overview.clusterCapacity')}</div>
            {snap && !snap.metricsAvailable ? (
                <Message severity="warn" text={t('panels:overview.noMetricsServer')} />
            ) : (
                <div className="mon-grid">
                    <div className="mon-card">
                        <div className="mon-card__head"><span>{t('panels:overview.clusterCpu')}</span><b>{c ? `${fmtCpu(c.cpuMillis)} / ${fmtCpu(c.cpuCapMillis)}` : '—'}</b></div>
                        <div className="mon-card__pct" style={{ color: getUsageColor(cpuPct) }}>{cpuPct.toFixed(0)}%</div>
                        <CssBar p={cpuPct} />
                    </div>
                    <div className="mon-card">
                        <div className="mon-card__head"><span>{t('panels:overview.clusterMemory')}</span><b>{c ? `${fmtMem(c.memMi)} / ${fmtMem(c.memCapMi)}` : '—'}</b></div>
                        <div className="mon-card__pct" style={{ color: getUsageColor(memPct) }}>{memPct.toFixed(0)}%</div>
                        <CssBar p={memPct} />
                    </div>
                </div>
            )}

            {/* Nodes */}
            <div className="mon-section-title">Nodes</div>
            <div className="mon-nodes">
                {(nodes ?? []).map((n) => {
                    const cp = pct(n.cpu_usage_millis, n.cpu_capacity_millis);
                    const mp = pct(n.mem_usage_mi, n.mem_capacity_mi);
                    const ready = n.status === 'Ready';
                    return (
                        <div key={n.name} className="mon-node" style={{ cursor: 'default' }}>
                            <div className="ov-node__head">
                                <span className="mon-node__name" title={n.name}>{n.name}</span>
                                <span className={`ov-badge ${ready ? 'ov-badge--ok' : 'ov-badge--err'}`}>{n.status}</span>
                                {n.unschedulable && <span className="ov-badge ov-badge--warn">{t('panels:overview.cordoned')}</span>}
                            </div>
                            <div className="ov-node__meta">{n.kubelet_version}</div>
                            {n.metrics_available ? (
                                <>
                                    <div className="mon-node__row"><span>CPU</span><CssBar p={cp} /><span>{cp.toFixed(0)}%</span></div>
                                    <div className="mon-node__row"><span>MEM</span><CssBar p={mp} /><span>{mp.toFixed(0)}%</span></div>
                                </>
                            ) : (
                                <div className="ov-node__meta">{t('panels:overview.metricsUnavailable')}</div>
                            )}
                        </div>
                    );
                })}
                {nodes && nodes.length === 0 && <div className="mon-empty">{t('panels:overview.noNodes')}</div>}
            </div>
        </div>
    );
}
