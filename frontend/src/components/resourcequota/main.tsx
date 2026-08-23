import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chart } from 'primereact/chart';



import { VscGraph, VscNote, VscInfo, VscTypeHierarchySub, VscClose } from 'react-icons/vsc';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { ProgressSpinner } from 'primereact/progressspinner';
import { GetResourceQuotas } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import { errText } from '../../lib/errText';
import ErrorBanner from '../shared/ErrorBanner';
import { useT } from '../../i18n/useT';

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

function QuotaRow({ rq, onEdit, onDescribe }: {
    rq: models.NamespacedResourceQuota;
    onEdit: (quotaName: string, ns: string) => void;
    onDescribe: (quotaName: string, ns: string) => void;
}) {
    const t = useT();
    return (
        <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
                <VscGraph size={14} color="var(--ink2)" />
                <span style={{
                    fontSize: '0.78rem', fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    color: 'var(--ink)',
                }} title={rq.name}>{rq.name}</span>
                <Button
                    icon={<VscInfo size={16} />}
                    text size="small" severity="secondary"
                    style={{ padding: '0.15rem', flexShrink: 0 }}
                    tooltip={t('action.describe')} tooltipOptions={{ position: 'top' }}
                    onClick={() => onDescribe(rq.name, rq.namespace)}
                />
                <Button
                    icon={<VscNote size={16} />}
                    text size="small" severity="secondary"
                    style={{ padding: '0.15rem', flexShrink: 0 }}
                    tooltip={t('panels:editYaml')} tooltipOptions={{ position: 'top' }}
                    onClick={() => onEdit(rq.name, rq.namespace)}
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

function NamespaceGroup({ namespace, quotas, onEdit, onDescribe }: {
    namespace: string;
    quotas: models.NamespacedResourceQuota[];
    onEdit: (quotaName: string, namespace: string) => void;
    onDescribe: (quotaName: string, namespace: string) => void;
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
                <VscTypeHierarchySub size={14} color="var(--teal)" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', flex: 1, color: 'var(--ink)' }}>{namespace}</span>
                <Tag value={`${quotas.length} quota`} severity="info" style={{ fontSize: '0.65rem' }} />
            </div>

            {quotas.map(rq => (
                <QuotaRow key={rq.name} rq={rq} onEdit={onEdit} onDescribe={onDescribe} />
            ))}
        </div>
    );
}

export default function ResourceQuotaListComponent({ clusterName }: { clusterName: string }) {
    const t = useT();
    const [quotas, setQuotas] = useState<models.NamespacedResourceQuota[]>([]);
    const [nsFilter, setNsFilter] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const { openYamlPanel, openDescribePanel } = useTabContext();

    // One quota list for the whole cluster (S9b). This used to rebuild the same
    // data out of GetNamespaces, which fanned out a quota list per namespace.
    const loadData = useCallback(async () => {
        setRefreshing(true);
        try {
            const items = await GetResourceQuotas(clusterName);
            setQuotas(items.map((item: any) => models.NamespacedResourceQuota.createFrom(item)));
            setError(null);
        } catch (e) {
            // Last good quotas stay on screen; the banner marks them stale.
            console.error('Failed to load resource quotas:', e);
            setError(errText(e));
        } finally {
            setLoaded(true);
            setRefreshing(false);
        }
    }, [clusterName]);

    useEffect(() => {
        loadData();
        const id = window.setInterval(loadData, 10000);
        return () => window.clearInterval(id);
    }, [loadData]);

    const referencePanel = `resourcequotas:${clusterName}`;

    const handleEdit = (quotaName: string, namespace: string) => {
        openYamlPanel({ clusterName, resourceKind: 'resourcequota', name: quotaName, namespace, referencePanel });
    };

    const handleDescribe = (quotaName: string, namespace: string) => {
        openDescribePanel({ clusterName, resource: 'resourcequotas', name: quotaName, namespace, referencePanel });
    };

    // The flat list arrives sorted by nothing in particular; group it back into
    // namespaces for display, keeping namespaces and quotas alphabetical.
    const groups = useMemo(() => {
        const needle = nsFilter.trim().toLowerCase();
        const byNamespace = new Map<string, models.NamespacedResourceQuota[]>();
        for (const rq of quotas) {
            if (needle && !rq.namespace.toLowerCase().includes(needle)) continue;
            const bucket = byNamespace.get(rq.namespace);
            if (bucket) bucket.push(rq);
            else byNamespace.set(rq.namespace, [rq]);
        }
        return [...byNamespace.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([namespace, items]) => ({
                namespace,
                items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
            }));
    }, [quotas, nsFilter]);

    const totalQuotas = groups.reduce((sum, g) => sum + g.items.length, 0);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)' }}>{t('resources:resourcequota.title')}</h3>
                <Tag value={`${totalQuotas} quota · ${groups.length} namespace`} severity="info" />
                <InputText
                    value={nsFilter}
                    onChange={e => setNsFilter(e.target.value)}
                    placeholder={t('resources:resourcequota.filterNamespace')}
                    style={{ marginLeft: 'auto', width: '14rem' }}
                />
                {nsFilter && (
                    <Button icon={<VscClose size={16} />} text severity="secondary" size="small" onClick={() => setNsFilter('')} tooltip={t('resources:resourcequota.clearFilter')} />
                )}
            </div>

            <ErrorBanner
                message={error}
                onRetry={loadData}
                busy={refreshing}
                stale={quotas.length > 0}
                context={`Resource Quotas (${clusterName})`}
            />

            {!loaded ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ProgressSpinner style={{ width: 40, height: 40 }} strokeWidth="4" />
                </div>
            ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {groups.length === 0 ? (
                    error ? null : (
                    <div style={{ color: 'var(--ink2)', padding: '2rem', textAlign: 'center' }}>
                        {t(nsFilter ? 'resources:resourcequota.noMatch' : 'resources:resourcequota.empty')}
                    </div>
                    )
                ) : (
                    groups.map(g => (
                        <NamespaceGroup
                            key={g.namespace}
                            namespace={g.namespace}
                            quotas={g.items}
                            onEdit={handleEdit}
                            onDescribe={handleDescribe}
                        />
                    ))
                )}
            </div>
            )}
        </div>
    );
}
