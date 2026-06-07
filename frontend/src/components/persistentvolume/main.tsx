import { useEffect, useMemo, useRef, useState } from 'react';


import { VscClearAll, VscTrash, VscClose } from 'react-icons/vsc';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { ColumnFilterElementTemplateOptions } from 'primereact/column';
import { GetPersistentVolumes } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

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

export default function PersistentVolumeListComponent() {
    const [items, setItems] = useState<models.PersistentVolumeInfo[]>([]);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel } = useTabContext();

    const statusOptions = useMemo(() =>
        [...new Set(items.map(i => i.status).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [items]
    );
    const storageClassOptions = useMemo(() =>
        [...new Set(items.map(i => i.storage_class_name).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [items]
    );

    const load = async () => {
        try {
            const data = await GetPersistentVolumes();
            setItems((data ?? []).map((d: any) => models.PersistentVolumeInfo.createFrom(d)));
        } catch {
            setItems([]);
        }
    };

    useEffect(() => {
        load();
        const id = window.setInterval(load, 5000);
        return () => window.clearInterval(id);
    }, []);

    const handleRowDoubleClick = (pv: models.PersistentVolumeInfo) => {
        openYamlPanel({
            resourceKind: 'persistentvolume',
            name: pv.name,
            namespace: '',
            referencePanel: 'persistentvolumes',
        });
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Persistent Volumes</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button
                        icon={<VscClearAll size={16} />}
                        text
                        severity="secondary"
                        onClick={() => setFilters(defaultFilters)}
                        tooltip="Clear filters"
                        tooltipOptions={{ position: 'left' }}
                    />
                </div>
            </div>

            <DataTable
                value={items}
                dataKey="name"
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.PersistentVolumeInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No persistent volumes found"
            >
                <Column
                    field="name"
                    header="Name"
                    sortable
                    filter
                    filterField="name"
                    filterPlaceholder="Search name"
                    showFilterMenu={false}
                    style={{ minWidth: '16rem' }}
                />
                <Column
                    field="status"
                    header="Status"
                    sortable
                    filter
                    filterField="status"
                    showFilterMenu={false}
                    style={{ minWidth: '8rem' }}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={statusOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                    body={(row: models.PersistentVolumeInfo) => (
                        <Tag value={row.status} severity={getStatusSeverity(row.status)} />
                    )}
                />
                <Column field="capacity" header="Capacity" sortable style={{ minWidth: '8rem' }} />
                <Column
                    header="Access Modes"
                    style={{ minWidth: '10rem' }}
                    body={(row: models.PersistentVolumeInfo) =>
                        (row.access_modes ?? []).join(', ') || '-'
                    }
                />
                <Column field="reclaim_policy" header="Reclaim Policy" sortable style={{ minWidth: '10rem' }} />
                <Column
                    field="storage_class_name"
                    header="Storage Class"
                    sortable
                    filter
                    filterField="storage_class_name"
                    showFilterMenu={false}
                    style={{ minWidth: '12rem' }}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={storageClassOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                />
                <Column field="volume_mode" header="Volume Mode" sortable style={{ minWidth: '9rem' }} />
                <Column field="claim_ref" header="Claim" style={{ minWidth: '16rem' }} />
            </DataTable>
        </div>
    );
}
