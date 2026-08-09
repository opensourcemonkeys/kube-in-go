import type { DockviewPanelApi } from 'dockview';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetPersistentVolumes, DeleteObject } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

// Cluster-scoped and without a typed delete of its own: addressed
// generically by (group, resource, name) like the CRD view does.
const deleteEntry = (clusterName: string, name: string) =>
    DeleteObject(clusterName, '', 'persistentvolumes', '', name);
import { ARRAY_IN } from '../../lib/tableFilters';

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
    reclaim_policy:     { value: null, matchMode: FilterMatchMode.IN },
    volume_mode:        { value: null, matchMode: FilterMatchMode.IN },
    // access_modes satırda bir dizi; yerleşik IN diziyle eşleşmez.
    access_modes:       { value: null, matchMode: ARRAY_IN },
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
            deleter={deleteEntry}
            deleteLabel="persistent volume"
            describeResource="persistentvolumes"
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
                    <Column header="Access Modes" filter filterField="access_modes" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        body={(row: models.PersistentVolumeInfo) => (row.access_modes ?? []).join(', ') || '-'}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('access_modes')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="reclaim_policy" header="Reclaim Policy" sortable filter filterField="reclaim_policy" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('reclaim_policy')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="storage_class_name" header="Storage Class" sortable filter filterField="storage_class_name" showFilterMenu={false} style={{ minWidth: '12rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('storage_class_name')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="volume_mode" header="Volume Mode" sortable filter filterField="volume_mode" showFilterMenu={false} style={{ minWidth: '9rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('volume_mode')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="claim_ref" header="Claim" style={{ minWidth: '16rem' }} />
                </>
            )}
        />
    );
}
