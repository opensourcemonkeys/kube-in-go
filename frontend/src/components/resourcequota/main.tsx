import { useEffect, useRef, useState } from 'react';
import { Chart } from 'primereact/chart';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { GetNamespaces } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

type Severity = 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'contrast' | undefined;

const getStatusSeverity = (status: string): Severity => {
    switch (status) {
        case 'Active':      return 'success';
        case 'Terminating': return 'danger';
        default:            return 'warning';
    }
};

const getUsageColor = (pct: number) => {
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

function ResourceBar({ entry }: { entry: models.ResourceQuotaEntry }) {
    const chartRef = useRef<any>(null);
    const pct = entry.hard_num > 0 ? Math.min((entry.used_num / entry.hard_num) * 100, 100) : 0;
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
    }, [entry.used_num, entry.hard_num]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{
                fontSize: '0.68rem', fontWeight: 600, color: 'var(--ink2)',
                width: '9rem', textAlign: 'right', flexShrink: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={entry.resource}>{entry.resource}</span>
            <div style={{ flex: 1, height: '18px', minWidth: 0 }}>
                <Chart ref={chartRef} type="bar" data={chartData} options={barOptions} style={{ height: '18px' }} />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color, width: '2.8rem', textAlign: 'right', flexShrink: 0 }}>
                {pct.toFixed(0)}%
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--ink2)', whiteSpace: 'nowrap', flexShrink: 0, minWidth: '8rem' }}>
                {entry.used} / {entry.hard}
            </span>
        </div>
    );
}

function QuotaRow({ rq, namespace, onEdit }: {
    rq: models.ResourceQuotaInfo;
    namespace: string;
    onEdit: (quotaName: string, ns: string) => void;
}) {
    return (
        <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
                <i className="pi pi-chart-bar" style={{ fontSize: '0.7rem', color: 'var(--ink2)' }} />
                <span style={{
                    fontSize: '0.78rem', fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    color: 'var(--ink)',
                }} title={rq.name}>{rq.name}</span>
                <Button
                    icon="pi pi-file-edit"
                    text size="small" severity="secondary"
                    style={{ padding: '0.15rem', flexShrink: 0 }}
                    tooltip="Edit YAML" tooltipOptions={{ position: 'top' }}
                    onClick={() => onEdit(rq.name, namespace)}
                />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {rq.entries.map(entry => (
                    <ResourceBar key={entry.resource} entry={entry} />
                ))}
            </div>
        </div>
    );
}

function NamespaceGroup({ ns, onEdit }: {
    ns: models.NamespaceInfo;
    onEdit: (quotaName: string, namespace: string) => void;
}) {
    return (
        <div style={{
            background: 'var(--panel2)',
            border: '1px solid var(--line)',
            borderRadius: 6,
            overflow: 'hidden',
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.55rem 0.75rem',
                background: 'var(--panel)',
                borderBottom: '1px solid var(--line)',
            }}>
                <i className="pi pi-sitemap" style={{ fontSize: '0.9rem', color: 'var(--teal)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', flex: 1, color: 'var(--ink)' }}>{ns.name}</span>
                <Tag value={ns.status} severity={getStatusSeverity(ns.status)} style={{ fontSize: '0.65rem' }} />
            </div>

            {ns.resource_quotas.map(rq => (
                <QuotaRow key={rq.name} rq={rq} namespace={ns.name} onEdit={onEdit} />
            ))}
        </div>
    );
}

export default function ResourceQuotaListComponent() {
    const [namespaces, setNamespaces] = useState<models.NamespaceInfo[]>([]);
    const [nsFilter, setNsFilter] = useState('');
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel } = useTabContext();

    const loadData = async () => {
        try {
            const items = await GetNamespaces();
            const all = items.map((item: any) => models.NamespaceInfo.createFrom(item));
            setNamespaces(all.filter((ns: models.NamespaceInfo) => ns.resource_quotas?.length > 0));
        } catch (error) {
            console.error('Failed to load resource quotas:', error);
            setNamespaces([]);
        }
    };

    useEffect(() => {
        loadData();
        const id = window.setInterval(loadData, 10000);
        return () => window.clearInterval(id);
    }, []);

    const handleEdit = (quotaName: string, namespace: string) => {
        openYamlPanel({ resourceKind: 'resourcequota', name: quotaName, namespace, referencePanel: 'resourcequotas' });
    };

    const filtered = nsFilter.trim()
        ? namespaces.filter(ns => ns.name.toLowerCase().includes(nsFilter.toLowerCase()))
        : namespaces;

    const totalQuotas = filtered.reduce((sum, ns) => sum + ns.resource_quotas.length, 0);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)' }}>Resource Quotas</h3>
                <Tag value={`${totalQuotas} quota · ${filtered.length} namespace`} severity="info" />
                <InputText
                    value={nsFilter}
                    onChange={e => setNsFilter(e.target.value)}
                    placeholder="Filter namespace"
                    style={{ marginLeft: 'auto', width: '14rem' }}
                />
                {nsFilter && (
                    <Button icon="pi pi-times" text severity="secondary" size="small" onClick={() => setNsFilter('')} tooltip="Clear filter" />
                )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filtered.length === 0 ? (
                    <div style={{ color: 'var(--ink2)', padding: '2rem', textAlign: 'center' }}>
                        {nsFilter ? 'No matching namespaces.' : 'No Resource Quotas defined in any namespace.'}
                    </div>
                ) : (
                    filtered.map(ns => (
                        <NamespaceGroup key={ns.name} ns={ns} onEdit={handleEdit} />
                    ))
                )}
            </div>
        </div>
    );
}
