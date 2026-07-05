import type { DockviewPanelApi } from 'dockview';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetPersistentVolumes } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast';

const getStatusSeverity = (status: string): TagSeverity => {
    switch (status) {
        case 'Bound':     return 'success';
        case 'Available': return 'info';
        case 'Released':  return 'warning';
        case 'Failed':    return 'danger';
        default:          return 'secondary';
    }
};

const defaultFilters: DataTableFilterMeta = {
    name:               { value: null, matchMode: FilterMatchMode.CONTAINS },
    status:             { value: null, matchMode: FilterMatchMode.IN },
    storage_class_name: { value: null, matchMode: FilterMatchMode.IN },
};

export default function PersistentVolumeListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel } = useTabContext();
    const referencePanel = `persistentvolumes:${clusterName}`;

    return (
        <ResourceListView<models.PersistentVolumeInfo>
            title="Persistent Volumes"
            clusterName={clusterName}
            api={api}
            fetcher={GetPersistentVolumes}
            createFrom={models.PersistentVolumeInfo.createFrom}
            pollInterval={5000}
            defaultFilters={defaultFilters}
            emptyMessage="No persistent volumes found"
            onRowDoubleClick={(pv) => openYamlPanel({ clusterName, resourceKind: 'persistentvolume', name: pv.name, namespace: '', referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '16rem' }} />
                    <Column field="status" header="Status" sortable filter filterField="status" showFilterMenu={false} style={{ minWidth: '8rem' }}
                        body={(row: models.PersistentVolumeInfo) => <Tag value={row.status} severity={getStatusSeverity(row.status)} />}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('status')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="capacity" header="Capacity" sortable style={{ minWidth: '8rem' }} />
                    <Column header="Access Modes" style={{ minWidth: '10rem' }} body={(row: models.PersistentVolumeInfo) => (row.access_modes ?? []).join(', ') || '-'} />
                    <Column field="reclaim_policy" header="Reclaim Policy" sortable style={{ minWidth: '10rem' }} />
                    <Column field="storage_class_name" header="Storage Class" sortable filter filterField="storage_class_name" showFilterMenu={false} style={{ minWidth: '12rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('storage_class_name')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="volume_mode" header="Volume Mode" sortable style={{ minWidth: '9rem' }} />
                    <Column field="claim_ref" header="Claim" style={{ minWidth: '16rem' }} />
                </>
            )}
        />
    );
}
