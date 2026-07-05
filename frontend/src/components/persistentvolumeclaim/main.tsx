import type { DockviewPanelApi } from 'dockview';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetPersistentVolumeClaims, DeletePersistentVolumeClaim } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast';

const getStatusSeverity = (status: string): TagSeverity => {
    switch (status) {
        case 'Bound':   return 'success';
        case 'Pending': return 'warning';
        case 'Lost':    return 'danger';
        default:        return 'secondary';
    }
};

const defaultFilters: DataTableFilterMeta = {
    name:               { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace:          { value: null, matchMode: FilterMatchMode.IN },
    status:             { value: null, matchMode: FilterMatchMode.IN },
    storage_class_name: { value: null, matchMode: FilterMatchMode.IN },
};

export default function PersistentVolumeClaimListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel } = useTabContext();
    const referencePanel = `persistentvolumeclaims:${clusterName}`;

    return (
        <ResourceListView<models.PersistentVolumeClaimInfo>
            title="Volume Claims"
            clusterName={clusterName}
            api={api}
            fetcher={GetPersistentVolumeClaims}
            createFrom={models.PersistentVolumeClaimInfo.createFrom}
            deleter={DeletePersistentVolumeClaim}
            deleteLabel="volume claim"
            pollInterval={5000}
            defaultFilters={defaultFilters}
            emptyMessage="No volume claims found"
            onRowDoubleClick={(pvc) => openYamlPanel({ clusterName, resourceKind: 'persistentvolumeclaim', name: pvc.name, namespace: pvc.namespace, referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="status" header="Status" sortable filter filterField="status" showFilterMenu={false} style={{ minWidth: '8rem' }}
                        body={(row: models.PersistentVolumeClaimInfo) => <Tag value={row.status} severity={getStatusSeverity(row.status)} />}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('status')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="request" header="Request" sortable style={{ minWidth: '8rem' }} />
                    <Column field="limit" header="Limit" sortable style={{ minWidth: '8rem' }} />
                    <Column header="Access Modes" style={{ minWidth: '10rem' }} body={(row: models.PersistentVolumeClaimInfo) => (row.access_modes ?? []).join(', ') || '-'} />
                    <Column field="storage_class_name" header="Storage Class" sortable filter filterField="storage_class_name" showFilterMenu={false} style={{ minWidth: '12rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('storage_class_name')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="volume_name" header="Volume" style={{ minWidth: '14rem' }} />
                </>
            )}
        />
    );
}
