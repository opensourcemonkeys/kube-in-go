import { useEffect, useRef, useState } from 'react';
import FilterListOff from '@mui/icons-material/FilterListOff';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import Close from '@mui/icons-material/Close';
import ListOutlined from '@mui/icons-material/ListOutlined';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { GetDeployments, DeleteDeployment } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const getReplicasSeverity = (ready: number, total: number): 'success' | 'warning' | 'danger' => {
    if (total === 0) return 'warning';
    if (ready === total) return 'success';
    if (ready === 0) return 'danger';
    return 'warning';
};

const defaultFilters: DataTableFilterMeta = {
    name:           { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    replicas:       { value: null, matchMode: FilterMatchMode.EQUALS },
};

export default function DeploymentListComponent() {
    const [deployments, setDeployments] = useState<models.DeploymentInfo[]>([]);
    const [selectedDeployments, setSelectedDeployments] = useState<models.DeploymentInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel, openLogPanel } = useTabContext();

    const loadDeployments = async () => {
        try {
            const items = await GetDeployments();
            setDeployments(items.map((item: any) => models.DeploymentInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load deployments:', error);
            setDeployments([]);
        }
    };

    useEffect(() => {
        loadDeployments();
        const intervalId = window.setInterval(loadDeployments, 2000);
        return () => window.clearInterval(intervalId);
    }, []);

    const openDeleteDialog = () => {
        if (selectedDeployments.length > 0) setDeleteDialogVisible(true);
    };

    const handleDeleteSelected = async () => {
        if (selectedDeployments.length === 0) { setDeleteDialogVisible(false); return; }

        setDeleting(true);
        const toDelete = [...selectedDeployments];

        for (const dep of toDelete) {
            try {
                await DeleteDeployment(dep.name, dep.namespace);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Deleted successfully',
                    detail: `${dep.namespace}/${dep.name} deleted`,
                    life: 2500,
                });
            } catch {
                toast.current?.show({
                    severity: 'error',
                    summary: 'Delete failed',
                    detail: `${dep.namespace}/${dep.name} could not be deleted`,
                    life: 3500,
                });
            }
        }

        setSelectedDeployments([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await loadDeployments();
    };

    const handleRowDoubleClick = (dep: models.DeploymentInfo) => {
        openYamlPanel({
            resourceKind: 'deployment',
            name: dep.name,
            namespace: dep.namespace,
            referencePanel: 'deployments',
        });
    };

    const deleteDialogFooter = (
        <div className="flex justify-content-end gap-2">
            <Button label="Cancel" icon={<Close fontSize="small" />} text onClick={() => setDeleteDialogVisible(false)} disabled={deleting} />
            <Button label="Delete" icon={<DeleteOutlineOutlined fontSize="small" />} severity="danger" onClick={handleDeleteSelected} loading={deleting} />
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Deployment List</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button
                        icon={<FilterListOff fontSize="small" />}
                        text
                        severity="secondary"
                        onClick={() => setFilters(defaultFilters)}
                        tooltip="Clear filters"
                        tooltipOptions={{ position: 'left' }}
                    />
                    <Button
                        label="Delete Selected"
                        icon={<DeleteOutlineOutlined fontSize="small" />}
                        severity="danger"
                        onClick={openDeleteDialog}
                        disabled={selectedDeployments.length === 0 || deleting}
                    />
                </div>
            </div>

            <DataTable
                value={deployments}
                dataKey="name"
                selectionMode="multiple"
                selection={selectedDeployments}
                onSelectionChange={(e) => setSelectedDeployments(Array.isArray(e.value) ? e.value : [])}
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.DeploymentInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No deployments found"
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
                    header="Replicas"
                    sortable
                    sortField="replicas"
                    filter
                    filterField="replicas"
                    filterPlaceholder="Total replicas"
                    showFilterMenu={false}
                    dataType="numeric"
                    style={{ minWidth: '9rem' }}
                    body={(rowData: models.DeploymentInfo) => (
                        <Tag
                            value={`${rowData.ready_replicas} / ${rowData.replicas}`}
                            severity={getReplicasSeverity(rowData.ready_replicas, rowData.replicas)}
                        />
                    )}
                />
                <Column
                    header=""
                    style={{ width: '4rem', textAlign: 'center' }}
                    body={(rowData: models.DeploymentInfo) => (
                        <Button
                            icon={<ListOutlined fontSize="small" />}
                            text
                            size="small"
                            severity="secondary"
                            style={{ padding: '0.2rem', fontSize: '0.7rem' }}
                            onClick={() => openLogPanel({
                                resourceKind: 'deployment',
                                name: rowData.name,
                                namespace: rowData.namespace,
                                referencePanel: 'deployments',
                            })}
                        />
                    )}
                />
            </DataTable>

            <Dialog
                header="Delete Deployment Confirmation"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteDialogVisible(false); }}
            >
                <p className="m-0 mb-3">Do you want to delete the selected deployment records?</p>
                <ul className="m-0 pl-3">
                    {selectedDeployments.map((dep) => (
                        <li key={`${dep.namespace}-${dep.name}`}>{dep.namespace}/{dep.name}</li>
                    ))}
                </ul>
            </Dialog>
        </div>
    );
}
