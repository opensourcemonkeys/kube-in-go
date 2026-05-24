import { useEffect, useRef, useState } from 'react';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { FilterMatchMode } from 'primereact/api';
import { GetNamespaces, DeleteNamespace } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

type Severity = 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'contrast' | undefined;

const getStatusSeverity = (status: string): Severity => {
    switch (status) {
        case 'Active':      return 'success';
        case 'Terminating': return 'danger';
        default:            return 'warning';
    }
};

const defaultFilters: DataTableFilterMeta = {
    name:   { value: null, matchMode: FilterMatchMode.CONTAINS },
    status: { value: null, matchMode: FilterMatchMode.CONTAINS },
};

export default function NamespaceListComponent() {
    const [namespaces, setNamespaces] = useState<models.NamespaceInfo[]>([]);
    const [selectedNamespaces, setSelectedNamespaces] = useState<models.NamespaceInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel } = useTabContext();

    const loadNamespaces = async () => {
        try {
            const items = await GetNamespaces();
            setNamespaces(items.map((item: any) => models.NamespaceInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load namespaces:', error);
            setNamespaces([]);
        }
    };

    useEffect(() => {
        loadNamespaces();
        const id = window.setInterval(loadNamespaces, 10000);
        return () => window.clearInterval(id);
    }, []);

    const openDeleteDialog = () => {
        if (selectedNamespaces.length > 0) setDeleteDialogVisible(true);
    };

    const handleDeleteSelected = async () => {
        if (selectedNamespaces.length === 0) { setDeleteDialogVisible(false); return; }

        setDeleting(true);
        const toDelete = [...selectedNamespaces];

        for (const ns of toDelete) {
            try {
                await DeleteNamespace(ns.name);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Deleted successfully',
                    detail: `${ns.name} deleted`,
                    life: 2500,
                });
            } catch {
                toast.current?.show({
                    severity: 'error',
                    summary: 'Delete failed',
                    detail: `${ns.name} could not be deleted`,
                    life: 3500,
                });
            }
        }

        setSelectedNamespaces([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await loadNamespaces();
    };

    const handleRowDoubleClick = (ns: models.NamespaceInfo) => {
        openYamlPanel({
            resourceKind: 'namespace',
            name: ns.name,
            namespace: '',
            referencePanel: 'namespaces',
        });
    };

    const deleteDialogFooter = (
        <div className="flex justify-content-end gap-2">
            <Button label="Cancel" icon="pi pi-times" text onClick={() => setDeleteDialogVisible(false)} disabled={deleting} />
            <Button label="Delete" icon="pi pi-trash" severity="danger" onClick={handleDeleteSelected} loading={deleting} />
        </div>
    );

    const tableHeader = (
        <div className="flex justify-content-between align-items-center gap-2" style={{ overflow: 'hidden' }}>
            <h3 className="m-0" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>Namespace List</h3>
            <div className="flex gap-2" style={{ flexShrink: 0 }}>
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
                    onClick={openDeleteDialog}
                    disabled={selectedNamespaces.length === 0 || deleting}
                />
            </div>
        </div>
    );

    return (
        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <DataTable
                value={namespaces}
                dataKey="name"
                header={tableHeader}
                selectionMode="multiple"
                selection={selectedNamespaces}
                onSelectionChange={(e) => setSelectedNamespaces(Array.isArray(e.value) ? e.value : [])}
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.NamespaceInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No namespaces found"
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
                    field="status"
                    header="Status"
                    sortable
                    filter
                    filterField="status"
                    filterPlaceholder="Search status"
                    showFilterMenu={false}
                    style={{ minWidth: '9rem' }}
                    body={(rowData: models.NamespaceInfo) => (
                        <Tag value={rowData.status} severity={getStatusSeverity(rowData.status)} />
                    )}
                />
            </DataTable>

            <Dialog
                header="Delete Namespace Confirmation"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteDialogVisible(false); }}
            >
                <p className="m-0 mb-3">Do you want to delete the selected namespaces?</p>
                <ul className="m-0 pl-3">
                    {selectedNamespaces.map((ns) => (
                        <li key={ns.name}>{ns.name}</li>
                    ))}
                </ul>
            </Dialog>
        </div>
    );
}
