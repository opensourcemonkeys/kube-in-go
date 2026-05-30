import { useEffect, useRef, useState } from 'react';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { GetPersistentVolumeClaims, DeletePersistentVolumeClaim } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

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
    namespace:          { value: null, matchMode: FilterMatchMode.CONTAINS },
    status:             { value: null, matchMode: FilterMatchMode.CONTAINS },
    storage_class_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
};

export default function PersistentVolumeClaimListComponent() {
    const [items, setItems] = useState<models.PersistentVolumeClaimInfo[]>([]);
    const [selected, setSelected] = useState<models.PersistentVolumeClaimInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel } = useTabContext();

    const load = async () => {
        try {
            const data = await GetPersistentVolumeClaims();
            setItems((data ?? []).map((d: any) => models.PersistentVolumeClaimInfo.createFrom(d)));
        } catch {
            setItems([]);
        }
    };

    useEffect(() => {
        load();
        const id = window.setInterval(load, 5000);
        return () => window.clearInterval(id);
    }, []);

    const handleDeleteSelected = async () => {
        if (selected.length === 0) { setDeleteDialogVisible(false); return; }
        setDeleting(true);
        for (const pvc of selected) {
            try {
                await DeletePersistentVolumeClaim(pvc.name, pvc.namespace);
                toast.current?.show({ severity: 'success', summary: 'Deleted', detail: `${pvc.namespace}/${pvc.name}`, life: 2500 });
            } catch {
                toast.current?.show({ severity: 'error', summary: 'Delete failed', detail: `${pvc.namespace}/${pvc.name}`, life: 3500 });
            }
        }
        setSelected([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await load();
    };

    const handleRowDoubleClick = (pvc: models.PersistentVolumeClaimInfo) => {
        openYamlPanel({
            resourceKind: 'persistentvolumeclaim',
            name: pvc.name,
            namespace: pvc.namespace,
            referencePanel: 'persistentvolumeclaims',
        });
    };

    const deleteDialogFooter = (
        <div className="flex justify-content-end gap-2">
            <Button label="Cancel" icon="pi pi-times" text onClick={() => setDeleteDialogVisible(false)} disabled={deleting} />
            <Button label="Delete" icon="pi pi-trash" severity="danger" onClick={handleDeleteSelected} loading={deleting} />
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Volume Claims</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button
                        icon="pi pi-filter-slash"
                        text
                        severity="secondary"
                        onClick={() => setFilters(defaultFilters)}
                        tooltip="Clear filters"
                        tooltipOptions={{ position: 'left' }}
                    />
                    <Button
                        label="Delete Selected"
                        icon="pi pi-trash"
                        severity="danger"
                        onClick={() => { if (selected.length > 0) setDeleteDialogVisible(true); }}
                        disabled={selected.length === 0 || deleting}
                    />
                </div>
            </div>

            <DataTable
                value={items}
                dataKey="name"
                selectionMode="multiple"
                selection={selected}
                onSelectionChange={(e) => setSelected(Array.isArray(e.value) ? e.value : [])}
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.PersistentVolumeClaimInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No volume claims found"
            >
                <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} style={{ minWidth: '3rem', maxWidth: '3rem' }} />
                <Column
                    field="name"
                    header="Name"
                    sortable
                    filter
                    filterField="name"
                    filterPlaceholder="Search name"
                    showFilterMenu={false}
                    style={{ minWidth: '14rem' }}
                />
                <Column
                    field="namespace"
                    header="Namespace"
                    sortable
                    filter
                    filterField="namespace"
                    filterPlaceholder="Search namespace"
                    showFilterMenu={false}
                    style={{ minWidth: '10rem' }}
                />
                <Column
                    field="status"
                    header="Status"
                    sortable
                    filter
                    filterField="status"
                    filterPlaceholder="Search status"
                    showFilterMenu={false}
                    style={{ minWidth: '8rem' }}
                    body={(row: models.PersistentVolumeClaimInfo) => (
                        <Tag value={row.status} severity={getStatusSeverity(row.status)} />
                    )}
                />
                <Column field="request" header="Request" sortable style={{ minWidth: '8rem' }} />
                <Column field="limit" header="Limit" sortable style={{ minWidth: '8rem' }} />
                <Column
                    header="Access Modes"
                    style={{ minWidth: '10rem' }}
                    body={(row: models.PersistentVolumeClaimInfo) =>
                        (row.access_modes ?? []).join(', ') || '-'
                    }
                />
                <Column
                    field="storage_class_name"
                    header="Storage Class"
                    sortable
                    filter
                    filterField="storage_class_name"
                    filterPlaceholder="Search class"
                    showFilterMenu={false}
                    style={{ minWidth: '12rem' }}
                />
                <Column field="volume_name" header="Volume" style={{ minWidth: '14rem' }} />
            </DataTable>

            <Dialog
                header="Delete Volume Claim Confirmation"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteDialogVisible(false); }}
            >
                <p className="m-0 mb-3">Do you want to delete the selected volume claims?</p>
                <ul className="m-0 pl-3">
                    {selected.map((pvc) => (
                        <li key={`${pvc.namespace}-${pvc.name}`}>{pvc.namespace}/{pvc.name}</li>
                    ))}
                </ul>
            </Dialog>
        </div>
    );
}
