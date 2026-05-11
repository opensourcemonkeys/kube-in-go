import { useEffect, useRef, useState } from 'react';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { GetPods, DeletePod } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

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
    namespace: { value: null, matchMode: FilterMatchMode.CONTAINS },
    status:    { value: null, matchMode: FilterMatchMode.CONTAINS },
};

export default function DataTableComponent() {
    const [pods, setPods] = useState<models.PodInfo[]>([]);
    const [selectedPods, setSelectedPods] = useState<models.PodInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel, openLogPanel } = useTabContext();

    const loadPods = async () => {
        try {
            const items = await GetPods();
            setPods(items.map((item: any) => models.PodInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load pods:', error);
            setPods([]);
        }
    };

    useEffect(() => {
        loadPods();
        const intervalId = window.setInterval(loadPods, 2000);
        return () => window.clearInterval(intervalId);
    }, []);

    const openDeleteDialog = () => {
        if (selectedPods.length > 0) setDeleteDialogVisible(true);
    };

    const handleDeleteSelected = async () => {
        if (selectedPods.length === 0) { setDeleteDialogVisible(false); return; }

        setDeleting(true);
        const toDelete = [...selectedPods];

        for (const pod of toDelete) {
            try {
                await DeletePod(pod.name, pod.namespace);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Deleted successfully',
                    detail: `${pod.namespace}/${pod.name} deleted`,
                    life: 2500,
                });
            } catch {
                toast.current?.show({
                    severity: 'error',
                    summary: 'Delete failed',
                    detail: `${pod.namespace}/${pod.name} could not be deleted`,
                    life: 3500,
                });
            }
        }

        setSelectedPods([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await loadPods();
    };

    const handleRowDoubleClick = (pod: models.PodInfo) => {
        openYamlPanel({
            resourceKind: 'pod',
            name: pod.name,
            namespace: pod.namespace,
            referencePanel: 'pods',
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
            <h3 className="m-0" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>Pod List</h3>
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
                    disabled={selectedPods.length === 0 || deleting}
                />
            </div>
        </div>
    );

    return (
        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <DataTable
                value={pods}
                dataKey="name"
                header={tableHeader}
                selectionMode="multiple"
                selection={selectedPods}
                onSelectionChange={(e) => setSelectedPods(Array.isArray(e.value) ? e.value : [])}
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.PodInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No pods found"
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
                    style={{ minWidth: '9rem' }}
                    body={(rowData: models.PodInfo) => (
                        <Tag value={rowData.status} severity={getStatusSeverity(rowData.status)} />
                    )}
                />
                <Column
                    header=""
                    style={{ width: '4rem', textAlign: 'center' }}
                    body={(rowData: models.PodInfo) => (
                        <Button
                            icon="pi pi-file-word"
                            text
                            size="small"
                            severity="secondary"
                            tooltip="View Logs"
                            tooltipOptions={{ position: 'left' }}
                            onClick={() => openLogPanel({
                                resourceKind: 'pod',
                                name: rowData.name,
                                namespace: rowData.namespace,
                                referencePanel: 'pods',
                            })}
                        />
                    )}
                />
            </DataTable>

            <Dialog
                header="Delete Pod Confirmation"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteDialogVisible(false); }}
            >
                <p className="m-0 mb-3">Do you want to delete the selected pod records?</p>
                <ul className="m-0 pl-3">
                    {selectedPods.map((pod) => (
                        <li key={`${pod.namespace}-${pod.name}`}>{pod.namespace}/{pod.name}</li>
                    ))}
                </ul>
            </Dialog>
        </div>
    );
}
