import { useEffect, useRef, useState } from 'react';
import React from 'react';
import { Chart } from 'primereact/chart';
import { VscServer, VscPass, VscCircleSlash, VscOutput, VscNote, VscClose, VscInfo, VscLocation, VscTag, VscDesktopDownload, VscChip, VscDatabase } from 'react-icons/vsc';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { GetNodes, CordonNode, UncordonNode, DrainNode } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

type Severity = 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'contrast' | undefined;

const getStatusSeverity = (status: string): Severity => {
    switch (status) {
        case 'Ready':    return 'success';
        case 'NotReady': return 'danger';
        default:         return 'warning';
    }
};

const getUsageColor = (pct: number): string => {
    if (pct < 60) return '#5fc98a'; // var(--green)
    if (pct < 80) return '#e2a85a'; // var(--amber)
    return '#e07d6e';               // var(--red)
};

const barOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
        x: { stacked: true, display: false, min: 0, max: 100 },
        y: { stacked: true, display: false },
    },
    events: [] as any[],
};

function UsageChart({ label, used, total, unit }: {
    label: string; used: number; total: number; unit: string;
}) {
    const chartRef = useRef<any>(null);
    const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
    const color = getUsageColor(pct);

    const [chartData] = useState(() => ({
        labels: [''],
        datasets: [
            { data: [pct],       backgroundColor: [getUsageColor(pct)], borderRadius: 3, borderSkipped: false as const },
            { data: [100 - pct], backgroundColor: ['#252e3f'],          borderRadius: 0, borderSkipped: false as const },
        ],
    }));

    useEffect(() => {
        const chart = chartRef.current?.getChart?.();
        if (!chart) return;
        chart.data.datasets[0].data = [pct];
        chart.data.datasets[0].backgroundColor = [color];
        chart.data.datasets[1].data = [100 - pct];
        chart.update('none');
    }, [used, total]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{
                fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.05em', color: 'var(--ink2)',
                width: '2.8rem', textAlign: 'right', flexShrink: 0,
            }}>{label}</span>
            <div style={{ flex: 1, height: '18px', minWidth: 0 }}>
                <Chart ref={chartRef} type="bar" data={chartData} options={barOptions} style={{ height: '18px' }} />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color, width: '2.8rem', textAlign: 'right', flexShrink: 0 }}>
                {pct.toFixed(0)}%
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--ink2)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {used.toLocaleString()} / {total.toLocaleString()} {unit}
            </span>
        </div>
    );
}

function NodeCard({ node, onEditYaml, onAction, onToast }: {
    node: models.NodeInfo;
    onEditYaml: (name: string) => void;
    onAction: () => void;
    onToast: (severity: 'success' | 'error', summary: string, detail: string) => void;
}) {
    const [drainDialogVisible, setDrainDialogVisible] = useState(false);
    const [cordonLoading, setCordonLoading] = useState(false);
    const [drainLoading, setDrainLoading] = useState(false);

    const handleCordon = async () => {
        setCordonLoading(true);
        try {
            await CordonNode(node.name);
            onToast('success', 'Cordoned', `${node.name} marked as unschedulable`);
            onAction();
        } catch (e: any) {
            onToast('error', 'Cordon failed', String(e));
        } finally { setCordonLoading(false); }
    };

    const handleUncordon = async () => {
        setCordonLoading(true);
        try {
            await UncordonNode(node.name);
            onToast('success', 'Uncordoned', `${node.name} is schedulable again`);
            onAction();
        } catch (e: any) {
            onToast('error', 'Uncordon failed', String(e));
        } finally { setCordonLoading(false); }
    };

    const handleDrain = async () => {
        setDrainDialogVisible(false);
        setDrainLoading(true);
        try {
            await DrainNode(node.name);
            onToast('success', 'Drain complete', `Pods on ${node.name} have been evicted`);
            onAction();
        } catch (e: any) {
            onToast('error', 'Drain failed', String(e));
        } finally { setDrainLoading(false); }
    };

    const drainFooter = (
        <div className="flex justify-content-end gap-2">
            <Button label="Cancel" icon={<VscClose fontSize="small" />} text onClick={() => setDrainDialogVisible(false)} disabled={drainLoading} />
            <Button label="Drain" icon={<VscOutput fontSize="small" />} severity="danger" onClick={handleDrain} loading={drainLoading} />
        </div>
    );

    return (
        <div style={{
            background: 'var(--panel2)',
            border: `1px solid ${node.unschedulable ? 'var(--amber)' : 'var(--line)'}`,
            borderRadius: 6,
            padding: '1rem 1.25rem',
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                    <VscServer style={{ fontSize: '1.1rem', color: 'var(--teal)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
                    <Tag value={node.status} severity={getStatusSeverity(node.status)} style={{ fontSize: '0.7rem', flexShrink: 0 }} />
                    {node.unschedulable && (
                        <Tag value="Unschedulable" severity="warning" style={{ fontSize: '0.7rem', flexShrink: 0 }} />
                    )}
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    {node.unschedulable ? (
                        <Button label="Uncordon" icon={<VscPass fontSize="small" />} size="small" severity="success" text loading={cordonLoading} onClick={handleUncordon} tooltip="Make node schedulable" tooltipOptions={{ position: 'top' }} />
                    ) : (
                        <Button label="Cordon" icon={<VscCircleSlash fontSize="small" />} size="small" severity="warning" text loading={cordonLoading} onClick={handleCordon} tooltip="Mark node as unschedulable" tooltipOptions={{ position: 'top' }} />
                    )}
                    <Button label="Drain" icon={<VscOutput fontSize="small" />} size="small" severity="danger" text loading={drainLoading} onClick={() => setDrainDialogVisible(true)} tooltip="Evict pods and cordon node" tooltipOptions={{ position: 'top' }} />
                    <Button icon={<VscNote fontSize="small" />} text size="small" severity="secondary" onClick={() => onEditYaml(node.name)} tooltip="Edit YAML" tooltipOptions={{ position: 'top' }} />
                </div>
            </div>

            {/* Meta + Charts */}
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0, minWidth: '200px' }}>
                    <MetaItem icon={<VscLocation style={{ fontSize: '0.75rem' }} />}           label="IP"      value={node.internal_ip      || '—'} />
                    <MetaItem icon={<VscTag style={{ fontSize: '0.75rem' }} />}           label="Version" value={node.kubelet_version   || '—'} />
                    <MetaItem icon={<VscDesktopDownload style={{ fontSize: '0.75rem' }} />}  label="OS"      value={node.os_image          || '—'} />
                    <MetaItem icon={<VscChip style={{ fontSize: '0.75rem' }} />}          label="CPU Cap" value={node.cpu_capacity      || '—'} />
                    <MetaItem icon={<VscDatabase style={{ fontSize: '0.75rem' }} />}         label="MEM Cap" value={node.memory_capacity   || '—'} />
                </div>

                <div style={{ width: '1px', alignSelf: 'stretch', background: 'var(--line)', flexShrink: 0 }} />

                {node.metrics_available ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: '200px' }}>
                        <UsageChart label="CPU" used={node.cpu_usage_millis} total={node.cpu_capacity_millis} unit="m" />
                        <UsageChart label="MEM" used={node.mem_usage_mi}     total={node.mem_capacity_mi}     unit="MiB" />
                    </div>
                ) : (
                    <div style={{ flex: 1, color: 'var(--ink2)', fontSize: '0.8rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <VscInfo style={{ fontSize: '0.9rem' }} />
                        Metrics Server not available — CPU/RAM usage unavailable
                    </div>
                )}
            </div>

            <Dialog
                header={`Drain: ${node.name}`}
                visible={drainDialogVisible}
                style={{ width: '32rem' }}
                modal
                footer={drainFooter}
                onHide={() => { if (!drainLoading) setDrainDialogVisible(false); }}
            >
                <p className="m-0 mb-3">
                    This will first <strong>cordon</strong> the node (mark it unschedulable),
                    then evict all pods except DaemonSet and mirror pods.
                </p>
                <p className="m-0" style={{ fontSize: '0.85rem', color: 'var(--ink2)' }}>
                    Node: <strong>{node.name}</strong>
                </p>
            </Dialog>
        </div>
    );
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--ink2)' }}>{icon}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--ink2)' }}>{label}:</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--ink)' }}>{value}</span>
        </div>
    );
}

export default function NodeListComponent() {
    const [nodes, setNodes] = useState<models.NodeInfo[]>([]);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel } = useTabContext();

    const loadNodes = async () => {
        try {
            const items = await GetNodes();
            setNodes(items.map((item: any) => models.NodeInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load nodes:', error);
            setNodes([]);
        }
    };

    useEffect(() => {
        loadNodes();
        const id = window.setInterval(loadNodes, 3000);
        return () => window.clearInterval(id);
    }, []);

    const handleEditYaml = (name: string) => {
        openYamlPanel({ resourceKind: 'node', name, namespace: '', referencePanel: 'nodes' });
    };

    const showToast = (severity: 'success' | 'error', summary: string, detail: string) => {
        toast.current?.show({ severity, summary, detail, life: 3000 });
    };

    const readyCount = nodes.filter(n => n.status === 'Ready').length;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)' }}>Node List</h3>
                <Tag value={`${readyCount} / ${nodes.length} Ready`} severity={readyCount === nodes.length && nodes.length > 0 ? 'success' : 'warning'} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {nodes.length === 0 ? (
                    <div style={{ color: 'var(--ink2)', padding: '2rem', textAlign: 'center' }}>
                        No nodes found or cluster is not connected.
                    </div>
                ) : (
                    nodes.map(node => (
                        <NodeCard key={node.name} node={node} onEditYaml={handleEditYaml} onAction={loadNodes} onToast={showToast} />
                    ))
                )}
            </div>
        </div>
    );
}
