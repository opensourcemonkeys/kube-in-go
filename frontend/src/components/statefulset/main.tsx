import type { DockviewPanelApi } from 'dockview';
import { VscListFlat } from 'react-icons/vsc';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetStatefulSets, DeleteStatefulSet } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';
import WorkloadActions from '../shared/WorkloadActions';

const getReplicasSeverity = (ready: number, total: number): 'success' | 'warning' | 'danger' => {
    if (total === 0) return 'warning';
    if (ready === total) return 'success';
    if (ready === 0) return 'danger';
    return 'warning';
};

const getStatusSeverity = (status: string): 'success' | 'warning' | 'danger' | 'secondary' => {
    switch (status) {
        case 'Available':   return 'success';
        case 'Progressing': return 'warning';
        case 'Degraded':    return 'danger';
        default:            return 'secondary';
    }
};

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
    status:    { value: null, matchMode: FilterMatchMode.IN },
};

export default function StatefulSetListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel, openLogPanel } = useTabContext();
    const referencePanel = `statefulsets:${clusterName}`;

    return (
        <ResourceListView<models.StatefulSetInfo>
            title="StatefulSet List"
            clusterName={clusterName}
            api={api}
            fetcher={GetStatefulSets}
            createFrom={models.StatefulSetInfo.createFrom}
            deleter={DeleteStatefulSet}
            deleteLabel="statefulset"
            pollInterval={2000}
            describeResource="statefulsets"
            defaultFilters={defaultFilters}
            emptyMessage="No statefulsets found"
            onRowDoubleClick={(s) => openYamlPanel({ clusterName, resourceKind: 'statefulset', name: s.name, namespace: s.namespace, referencePanel })}
            columns={({ buildInOptions, reload, toastRef }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="status" header="Status" sortable filter filterField="status" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        body={(row: models.StatefulSetInfo) => <Tag value={row.status} severity={getStatusSeverity(row.status)} />}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('status')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column header="Replicas" sortable sortField="replicas" style={{ minWidth: '9rem' }}
                        body={(row: models.StatefulSetInfo) => <Tag value={`${row.ready_replicas} / ${row.replicas}`} severity={getReplicasSeverity(row.ready_replicas, row.replicas)} />} />
                    <Column header="Updated" sortable sortField="updated_replicas" style={{ minWidth: '8rem' }}
                        body={(row: models.StatefulSetInfo) => <Tag value={`${row.current_replicas} current / ${row.updated_replicas} updated`} severity={row.current_replicas === row.updated_replicas ? 'success' : 'warning'} />} />
                    <Column header="" style={{ width: '7.5rem', textAlign: 'center' }}
                        body={(row: models.StatefulSetInfo) => (
                            <>
                                <Button icon={<VscListFlat size={16} />} text size="small" severity="secondary" style={{ padding: '0.2rem', fontSize: '0.7rem' }}
                                    onClick={() => openLogPanel({ clusterName, resourceKind: 'statefulset', name: row.name, namespace: row.namespace, referencePanel })} />
                                <WorkloadActions
                                    clusterName={clusterName} name={row.name} namespace={row.namespace}
                                    reload={reload} toastRef={toastRef}
                                    scale={{ kind: 'statefulset', replicas: row.replicas }}
                                    restart={{ kind: 'statefulset' }} />
                            </>
                        )} />
                </>
            )}
        />
    );
}
