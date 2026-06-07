import { useEffect, useMemo, useRef, useState } from 'react';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { ColumnFilterElementTemplateOptions } from 'primereact/column';
import { GetPods, DeletePod } from '../../../wailsjs/go/controller_app/App';




import { VscTerminal, VscListFlat, VscClearAll, VscTrash, VscClose } from 'react-icons/vsc';
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
    namespace: { value: null, matchMode: FilterMatchMode.IN },
    status:    { value: null, matchMode: FilterMatchMode.IN },
};

export default function DataTableComponent({ clusterName }: { clusterName: string }) {
    const [pods, setPods] = useState<models.PodInfo[]>([]);
    const [selectedPods, setSelectedPods] = useState<models.PodInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel, openLogPanel, openExecPanel } = useTabContext();

    const namespaceOptions = useMemo(() =>
        [...new Set(pods.map(p => p.namespace).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [pods]
    );
    const statusOptions = useMemo(() =>
        [...new Set(pods.map(p => p.status).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [pods]
    );

    const loadPods = async () => {
        try {
            const items = await GetPods(clusterName);
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
                await DeletePod(clusterName, pod.name, pod.namespace);
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
        openYamlPanel({ clusterName,
            resourceKind: 'pod',
            name: pod.name,
            namespace: pod.namespace,
            referencePanel: `pods:${clusterName}`,
        });
    };

    const deleteDialogFooter = (
        <div className="flex justify-content-end gap-2">
            <Button label="Cancel" icon={<VscClose size={16} />} text onClick={() => setDeleteDialogVisible(false)} disabled={deleting} />
            <Button label="Delete" icon={<VscTrash size={16} />} severity="danger" onClick={handleDeleteSelected} loading={deleting} />
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Pod List</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button
                        icon={<VscClearAll size={16} />}
                        text
                        severity="secondary"
                        onClick={() => setFilters(defaultFilters)}
                        tooltip="Clear filters"
                        tooltipOptions={{ position: 'left' }}
                    />
                    <Button
                        label="Delete Selected"
                        icon={<VscTrash size={16} />}
                        severity="danger"
                        onClick={openDeleteDialog}
                        disabled={selectedPods.length === 0 || deleting}
                    />
                </div>
            </div>

            <DataTable
                value={pods}
                dataKey="name"
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
                    showFilterMenu={false}
                    style={{ minWidth: '10rem' }}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={namespaceOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                />
                <Column
                    field="status"
                    header="Status"
                    sortable
                    filter
                    filterField="status"
                    showFilterMenu={false}
                    style={{ minWidth: '9rem' }}
                    body={(rowData: models.PodInfo) => (
                        <Tag value={rowData.status} severity={getStatusSeverity(rowData.status)} />
                    )}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={statusOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                />
                <Column
                    header=""
                    style={{ width: '6rem', textAlign: 'center' }}
                    body={(rowData: models.PodInfo) => (
                        <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'center' }}>
                            <Button
                                text
                                size="small"
                                severity="secondary"
                                style={{ padding: '0.2rem' }}
                                onClick={() => openLogPanel({ clusterName,
            resourceKind: 'pod',
                                    name: rowData.name,
                                    namespace: rowData.namespace,
                                    referencePanel: `pods:${clusterName}`,
                                })}
                            >
                                <VscListFlat size={16} />
                            </Button>
                            <Button
                                text
                                size="small"
                                severity="secondary"
                                style={{ padding: '0.2rem' }}
                                onClick={() => openExecPanel({ clusterName,
            name: rowData.name,
                                    namespace: rowData.namespace,
                                    container: (rowData.containers && rowData.containers.length > 0) ? rowData.containers[0] : '',
                                    referencePanel: `pods:${clusterName}`,
                                })}
                            >
                                <VscTerminal size={16} />
                            </Button>
                        </div>
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
