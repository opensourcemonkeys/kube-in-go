import type { DockviewPanelApi } from 'dockview';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { VscTerminal, VscListFlat } from 'react-icons/vsc';
import { GetPods, DeletePod } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

const getStatusSeverity = (status: string) => {
    switch (status) {
        case 'Running':     return 'success';
        case 'Pending':     return 'warning';
        case 'Terminating': return 'danger';
        default:            return 'info';
    }
};

const getOwnerSeverity = (kind: string) => {
    switch (kind) {
        case 'Deployment':  return 'info';
        case 'ReplicaSet':  return 'info';
        case 'StatefulSet': return 'warning';
        case 'DaemonSet':   return 'success';
        case 'Job':         return 'secondary';
        case 'CronJob':     return 'secondary';
        default:            return 'contrast'; // bare pod
    }
};

// Per-container status dot color: green=ready, orange=running-but-not-ready,
// grey=completed/terminated cleanly, red=waiting/error.
const containerDotColor = (c: models.ContainerStatusInfo) => {
    if (c.ready) return 'var(--green, #5fc98a)';
    if (c.state === 'Terminated' && c.reason === 'Completed') return '#9ca3af';
    if (c.state === 'Running') return 'var(--amber, #e2a85a)';
    return 'var(--red, #e07d6e)';
};

// Live usage formatting, mirroring the Monitoring dashboard.
// usage < 0 means metrics-server is unavailable.
const fmtCpu = (m: number) => (m < 0 ? '—' : m >= 1000 ? `${(m / 1000).toFixed(2)} cores` : `${m} m`);
const fmtMem = (mi: number) => (mi < 0 ? '—' : mi >= 1024 ? `${(mi / 1024).toFixed(1)} GiB` : `${mi} MiB`);

const defaultFilters: DataTableFilterMeta = {
    name:       { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace:  { value: null, matchMode: FilterMatchMode.IN },
    status:     { value: null, matchMode: FilterMatchMode.IN },
    owner_kind: { value: null, matchMode: FilterMatchMode.IN },
    pod_ip:    { value: null, matchMode: FilterMatchMode.IN },
};

export default function DataTableComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel, openLogPanel, openExecPanel } = useTabContext();
    const referencePanel = `pods:${clusterName}`;

    return (
        <ResourceListView<models.PodInfo>
            title="Pod List"
            clusterName={clusterName}
            api={api}
            fetcher={GetPods}
            createFrom={models.PodInfo.createFrom}
            deleter={DeletePod}
            deleteLabel="pod"
            pollInterval={2000}
            defaultFilters={defaultFilters}
            emptyMessage="No pods found"
            onRowDoubleClick={(pod) => openYamlPanel({ clusterName, resourceKind: 'pod', name: pod.name, namespace: pod.namespace, referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '13rem', maxWidth: '13rem' }}
                        body={(row: models.PodInfo) => <span title={row.name} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>} />
                    <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '8rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="status" header="Status" sortable filter filterField="status" showFilterMenu={false} style={{ minWidth: '7.5rem' }}
                        body={(row: models.PodInfo) => <Tag value={row.status} severity={getStatusSeverity(row.status)} />}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('status')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="owner_kind" header="Owner" sortable filter filterField="owner_kind" showFilterMenu={false} style={{ minWidth: '7.5rem' }}
                        body={(row: models.PodInfo) => <Tag value={row.owner_kind || 'Pod'} severity={getOwnerSeverity(row.owner_kind)} />}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('owner_kind')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="cpu_millis" header="CPU" sortable style={{ minWidth: '5.5rem' }}
                        body={(row: models.PodInfo) => fmtCpu(row.cpu_millis)} />
                    <Column field="mem_mi" header="Memory" sortable style={{ minWidth: '5.5rem' }}
                        body={(row: models.PodInfo) => fmtMem(row.mem_mi)} />
                    <Column field="pod_ip" header="Pod IP" sortable filter filterField="pod_ip" showFilterMenu={false} style={{ minWidth: '8rem' }}
                        body={(row: models.PodInfo) => <span style={{  fontSize: '0.8rem' }}>{row.pod_ip || '—'}</span>} 
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('pod_ip')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )}
                        />
                    <Column header="Containers" style={{ minWidth: '7rem' }}
                        body={(row: models.PodInfo) => {
                            const cs = row.container_statuses || [];
                            if (cs.length === 0) return <span style={{ opacity: 0.5 }}>—</span>;
                            return (
                                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    {cs.map((c) => (
                                        <span key={(c.init ? 'init:' : '') + c.name}
                                            title={`${c.init ? '[init] ' : ''}${c.name}: ${c.state || 'Unknown'}${c.reason ? ` (${c.reason})` : ''}${c.restart_count > 0 ? ` — ${c.restart_count} restart` : ''}`}
                                            style={{ width: 10, height: 10, display: 'inline-block', borderRadius: c.init ? 2 : '50%', background: containerDotColor(c) }} />
                                    ))}
                                </div>
                            );
                        }} />
                    <Column field="restarts" header="Restarts" sortable style={{ minWidth: '5.5rem' }}
                        body={(row: models.PodInfo) => (
                            <span style={{ color: row.restarts > 0 ? 'var(--amber, #e2a85a)' : 'inherit', fontWeight: row.restarts > 0 ? 600 : 400 }}>{row.restarts}</span>
                        )} />
                    <Column header="" style={{ width: '5rem', textAlign: 'center' }}
                        body={(row: models.PodInfo) => (
                            <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'center' }}>
                                <Button text size="small" severity="secondary" style={{ padding: '0.2rem' }}
                                    onClick={() => openLogPanel({ clusterName, resourceKind: 'pod', name: row.name, namespace: row.namespace, referencePanel })}>
                                    <VscListFlat size={16} />
                                </Button>
                                <Button text size="small" severity="secondary" style={{ padding: '0.2rem' }}
                                    onClick={() => openExecPanel({ clusterName, name: row.name, namespace: row.namespace, container: (row.containers && row.containers.length > 0) ? row.containers[0] : '', referencePanel })}>
                                    <VscTerminal size={16} />
                                </Button>
                            </div>
                        )} />
                </>
            )}
        />
    );
}
