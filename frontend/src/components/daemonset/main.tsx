import { useEffect, useRef, useState } from 'react';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { GetDaemonSets, DeleteDaemonSet } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const getReadySeverity = (ready: number, desired: number): 'success' | 'warning' | 'danger' => {
    if (desired === 0) return 'warning';
    if (ready === desired) return 'success';
    if (ready === 0) return 'danger';
    return 'warning';
};

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.CONTAINS },
};

export default function DaemonSetListComponent() {
    const [items, setItems] = useState<models.DaemonSetInfo[]>([]);
    const [selected, setSelected] = useState<models.DaemonSetInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel, openLogPanel } = useTabContext();

    const load = async () => {
        try {
            const data = await GetDaemonSets();
            setItems(data.map((item: any) => models.DaemonSetInfo.createFrom(item)));
        } catch {
            setItems([]);
        }
    };

    useEffect(() => {
        load();
        const id = window.setInterval(load, 2000);
        return () => window.clearInterval(id);
    }, []);

    const handleDeleteSelected = async () => {
        if (selected.length === 0) { setDeleteDialogVisible(false); return; }
        setDeleting(true);
        for (const d of [...selected]) {
            try {
                await DeleteDaemonSet(d.name, d.namespace);
                toast.current?.show({ severity: 'success', summary: 'Deleted', detail: `${d.namespace}/${d.name}`, life: 2500 });
            } catch {
                toast.current?.show({ severity: 'error', summary: 'Delete failed', detail: `${d.namespace}/${d.name}`, life: 3500 });
            }
        }
        setSelected([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await load();
    };

    const handleRowDoubleClick = (d: models.DaemonSetInfo) => {
        openYamlPanel({ resourceKind: 'daemonset', name: d.name, namespace: d.namespace, referencePanel: 'daemonsets' });
    };

    const deleteDialogFooter = (
        <div className="flex justify-content-end gap-2">
            <Button label="Cancel" icon="pi pi-times" text onClick={() => setDeleteDialogVisible(false)} disabled={deleting} />
            <Button label="Delete" icon="pi pi-trash" severity="danger" onClick={handleDeleteSelected} loading={deleting} />
        </div>
    );

    const tableHeader = (
        <div className="flex justify-content-between align-items-center gap-2" style={{ overflow: 'hidden' }}>
            <h3 className="m-0" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>DaemonSet List</h3>
            <div className="flex gap-2" style={{ flexShrink: 0 }}>
                <Button icon="pi pi-filter-slash" text severity="secondary" onClick={() => setFilters(defaultFilters)} tooltip="Clear filters" tooltipOptions={{ position: 'left' }} />
                <Button label="Delete Selected" icon="pi pi-trash" severity="danger" onClick={() => { if (selected.length > 0) setDeleteDialogVisible(true); }} disabled={selected.length === 0 || deleting} />
            </div>
        </div>
    );

    return (
        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <DataTable
                value={items}
                dataKey="name"
                header={tableHeader}
                selectionMode="multiple"
                selection={selected}
                onSelectionChange={(e) => setSelected(Array.isArray(e.value) ? e.value : [])}
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.DaemonSetInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No daemonsets found"
            >
                <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} style={{ minWidth: '3rem', maxWidth: '3rem' }} />
                <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                <Column field="namespace" header="Namespace" sortable filter filterField="namespace" filterPlaceholder="Search namespace" showFilterMenu={false} style={{ minWidth: '10rem' }} />
                <Column
                    header="Desired / Ready"
                    sortable
                    sortField="desired_number_scheduled"
                    style={{ minWidth: '11rem' }}
                    body={(row: models.DaemonSetInfo) => (
                        <Tag
                            value={`${row.number_ready} / ${row.desired_number_scheduled}`}
                            severity={getReadySeverity(row.number_ready, row.desired_number_scheduled)}
                        />
                    )}
                />
                <Column
                    header="Current / Available"
                    sortable
                    sortField="current_number_scheduled"
                    style={{ minWidth: '12rem' }}
                    body={(row: models.DaemonSetInfo) => (
                        <Tag
                            value={`${row.current_number_scheduled} current / ${row.number_available} available`}
                            severity={row.number_available === row.desired_number_scheduled ? 'success' : 'warning'}
                        />
                    )}
                />
                <Column
                    header=""
                    style={{ width: '4rem', textAlign: 'center' }}
                    body={(row: models.DaemonSetInfo) => (
                        <Button
                            icon="pi pi-file-word"
                            text
                            size="small"
                            severity="secondary"
                            tooltip="View Logs"
                            tooltipOptions={{ position: 'left' }}
                            onClick={() => openLogPanel({ resourceKind: 'daemonset', name: row.name, namespace: row.namespace, referencePanel: 'daemonsets' })}
                        />
                    )}
                />
            </DataTable>

            <Dialog
                header="Delete DaemonSet Confirmation"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteDialogVisible(false); }}
            >
                <p className="m-0 mb-3">Do you want to delete the selected daemonset records?</p>
                <ul className="m-0 pl-3">
                    {selected.map((d) => <li key={`${d.namespace}-${d.name}`}>{d.namespace}/{d.name}</li>)}
                </ul>
            </Dialog>
        </div>
    );
}
