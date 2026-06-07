import { useEffect, useMemo, useRef, useState } from 'react';


import { VscClearAll, VscTrash, VscClose, VscListFlat } from 'react-icons/vsc';

import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { ColumnFilterElementTemplateOptions } from 'primereact/column';
import { GetDeployments, DeleteDeployment } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const getReplicasSeverity = (ready: number, total: number): 'success' | 'warning' | 'danger' => {
    if (total === 0) return 'warning';
    if (ready === total) return 'success';
    if (ready === 0) return 'danger';
    return 'warning';
};

const getStatusSeverity = (status: string): 'success' | 'warning' | 'danger' | 'secondary' => {
    switch (status) {
        case 'Available':   return 'success';
        case 'Progressing': return 'warning';
        case 'Degraded':    return 'danger';
        default:            return 'secondary';
    }
};

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
    status:    { value: null, matchMode: FilterMatchMode.IN },
    replicas:  { value: null, matchMode: FilterMatchMode.EQUALS },
};

export default function DeploymentListComponent() {
    const [deployments, setDeployments] = useState<models.DeploymentInfo[]>([]);
    const [selectedDeployments, setSelectedDeployments] = useState<models.DeploymentInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel, openLogPanel } = useTabContext();

    const namespaceOptions = useMemo(() =>
        [...new Set(deployments.map(d => d.namespace).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [deployments]
    );
    const statusOptions = useMemo(() =>
        [...new Set(deployments.map(d => d.status).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [deployments]
    );

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
            <Button label="Cancel" icon={<VscClose size={16} />} text onClick={() => setDeleteDialogVisible(false)} disabled={deleting} />
            <Button label="Delete" icon={<VscTrash size={16} />} severity="danger" onClick={handleDeleteSelected} loading={deleting} />
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Deployment List</h3>
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
                    style={{ minWidth: '10rem' }}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={statusOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                    body={(row: models.DeploymentInfo) => (
                        <Tag value={row.status} severity={getStatusSeverity(row.status)} />
                    )}
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
                            icon={<VscListFlat size={16} />}
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
