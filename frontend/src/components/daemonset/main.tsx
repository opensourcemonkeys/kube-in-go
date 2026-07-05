import type { DockviewPanelApi } from 'dockview';
import { VscListFlat } from 'react-icons/vsc';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetDaemonSets, DeleteDaemonSet } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

const getReadySeverity = (ready: number, desired: number): 'success' | 'warning' | 'danger' => {
    if (desired === 0) return 'warning';
    if (ready === desired) return 'success';
    if (ready === 0) return 'danger';
    return 'warning';
};

const getStatusSeverity = (status: string): 'success' | 'warning' | 'danger' | 'secondary' => {
    switch (status) {
        case 'Available':     return 'success';
        case 'Degraded':      return 'danger';
        case 'Not Scheduled': return 'secondary';
        default:              return 'secondary';
    }
};

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
    status:    { value: null, matchMode: FilterMatchMode.IN },
};

export default function DaemonSetListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel, openLogPanel } = useTabContext();
    const referencePanel = `daemonsets:${clusterName}`;

    return (
        <ResourceListView<models.DaemonSetInfo>
            title="DaemonSet List"
            clusterName={clusterName}
            api={api}
            fetcher={GetDaemonSets}
            createFrom={models.DaemonSetInfo.createFrom}
            deleter={DeleteDaemonSet}
            deleteLabel="daemonset"
            pollInterval={2000}
            defaultFilters={defaultFilters}
            emptyMessage="No daemonsets found"
            onRowDoubleClick={(d) => openYamlPanel({ clusterName, resourceKind: 'daemonset', name: d.name, namespace: d.namespace, referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="status" header="Status" sortable filter filterField="status" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        body={(row: models.DaemonSetInfo) => <Tag value={row.status} severity={getStatusSeverity(row.status)} />}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('status')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column header="Desired / Ready" sortable sortField="desired_number_scheduled" style={{ minWidth: '11rem' }}
                        body={(row: models.DaemonSetInfo) => <Tag value={`${row.number_ready} / ${row.desired_number_scheduled}`} severity={getReadySeverity(row.number_ready, row.desired_number_scheduled)} />} />
                    <Column header="Current / Available" sortable sortField="current_number_scheduled" style={{ minWidth: '12rem' }}
                        body={(row: models.DaemonSetInfo) => <Tag value={`${row.current_number_scheduled} current / ${row.number_available} available`} severity={row.number_available === row.desired_number_scheduled ? 'success' : 'warning'} />} />
                    <Column header="" style={{ width: '4rem', textAlign: 'center' }}
                        body={(row: models.DaemonSetInfo) => (
                            <Button icon={<VscListFlat size={16} />} text size="small" severity="secondary" style={{ padding: '0.2rem', fontSize: '0.7rem' }}
                                onClick={() => openLogPanel({ clusterName, resourceKind: 'daemonset', name: row.name, namespace: row.namespace, referencePanel })} />
                        )} />
                </>
            )}
        />
    );
}
