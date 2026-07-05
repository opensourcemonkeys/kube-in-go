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

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
    status:    { value: null, matchMode: FilterMatchMode.IN },
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
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="status" header="Status" sortable filter filterField="status" showFilterMenu={false} style={{ minWidth: '9rem' }}
                        body={(row: models.PodInfo) => <Tag value={row.status} severity={getStatusSeverity(row.status)} />}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('status')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column header="" style={{ width: '6rem', textAlign: 'center' }}
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
