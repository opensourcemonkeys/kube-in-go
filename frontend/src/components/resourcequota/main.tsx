import { useEffect, useRef, useState } from 'react';
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
    if (pct < 60) return '#22c55e';
    if (pct < 80) return '#f59e0b';
    return '#ef4444';
};

function ResourceChip({ entry }: { entry: models.ResourceQuotaEntry }) {
    const pct = entry.hard_num > 0 ? Math.min((entry.used_num / entry.hard_num) * 100, 100) : 0;
    const color = getUsageColor(pct);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            padding: '0.35rem 0.6rem',
            background: 'var(--surface-ground)',
            border: '1px solid var(--surface-border)',
            borderRadius: 4,
            minWidth: '9rem',
        }}>
            {/* Resource name */}
            <span style={{
                fontSize: '0.65rem',
                fontWeight: 600,
                color: 'var(--text-color-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '11rem',
            }} title={entry.resource}>{entry.resource}</span>

            {/* Mini bar */}
            <div style={{ height: '5px', background: 'var(--surface-border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color }} />
            </div>

            {/* used / hard */}
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color, whiteSpace: 'nowrap' }}>
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
        <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '0.6rem 0.75rem',
            borderBottom: '1px solid var(--surface-border)',
        }}>
            {/* Left: quota name + edit */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                minWidth: '10rem',
                maxWidth: '10rem',
                flexShrink: 0,
                paddingTop: '0.25rem',
            }}>
                <i className="pi pi-chart-bar" style={{ fontSize: '0.7rem', color: 'var(--text-color-secondary)', flexShrink: 0 }} />
                <span style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }} title={rq.name}>{rq.name}</span>
                <Button
                    icon="pi pi-file-edit"
                    text
                    size="small"
                    severity="secondary"
                    style={{ padding: '0.15rem', flexShrink: 0 }}
                    tooltip="Edit YAML"
                    tooltipOptions={{ position: 'top' }}
                    onClick={() => onEdit(rq.name, namespace)}
                />
            </div>

            {/* Right: resource chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', flex: 1 }}>
                {rq.entries.map(entry => (
                    <ResourceChip key={entry.resource} entry={entry} />
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
            background: 'var(--surface-card)',
            border: '1px solid var(--surface-border)',
            borderRadius: 0,
            overflow: 'hidden',
        }}>
            {/* Namespace header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 0.75rem',
                background: 'var(--surface-section)',
                borderBottom: '1px solid var(--surface-border)',
            }}>
                <i className="pi pi-sitemap" style={{ fontSize: '0.9rem', color: 'var(--primary-color)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', flex: 1 }}>{ns.name}</span>
                <Tag value={ns.status} severity={getStatusSeverity(ns.status)} style={{ fontSize: '0.65rem' }} />
            </div>

            {/* Quota rows */}
            {ns.resource_quotas.map(rq => (
                <QuotaRow
                    key={rq.name}
                    rq={rq}
                    namespace={ns.name}
                    onEdit={onEdit}
                />
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
        openYamlPanel({
            resourceKind: 'resourcequota',
            name: quotaName,
            namespace,
            referencePanel: 'resourcequotas',
        });
    };

    const filtered = nsFilter.trim()
        ? namespaces.filter(ns => ns.name.toLowerCase().includes(nsFilter.toLowerCase()))
        : namespaces;

    const totalQuotas = filtered.reduce((sum, ns) => sum + ns.resource_quotas.length, 0);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Resource Quotas</h3>
                <Tag value={`${totalQuotas} quota · ${filtered.length} namespace`} severity="info" />
                <InputText
                    value={nsFilter}
                    onChange={e => setNsFilter(e.target.value)}
                    placeholder="Filter namespace"
                    style={{ marginLeft: 'auto', width: '14rem', height: '2rem', fontSize: '0.82rem' }}
                />
                {nsFilter && (
                    <Button
                        icon="pi pi-times"
                        text
                        severity="secondary"
                        size="small"
                        onClick={() => setNsFilter('')}
                        tooltip="Clear filter"
                    />
                )}
            </div>

            {/* Groups */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filtered.length === 0 ? (
                    <div style={{ color: 'var(--text-color-secondary)', padding: '2rem', textAlign: 'center' }}>
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
