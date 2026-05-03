import { useEffect, useRef, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { GetDeployments, DeleteDeployment } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const getReplicasSeverity = (ready: number, total: number): 'success' | 'warning' | 'danger' => {
    if (total === 0) return 'warning';
    if (ready === total) return 'success';
    if (ready === 0) return 'danger';
    return 'warning';
};

export default function DeploymentListComponent() {
    const [deployments, setDeployments] = useState<models.DeploymentInfo[]>([]);
    const [selectedDeployments, setSelectedDeployments] = useState<models.DeploymentInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel } = useTabContext();

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
            <Button label="Cancel" icon="pi pi-times" text onClick={() => setDeleteDialogVisible(false)} disabled={deleting} />
            <Button label="Delete" icon="pi pi-trash" severity="danger" onClick={handleDeleteSelected} loading={deleting} />
        </div>
    );

    const tableHeader = (
        <div className="flex justify-content-between align-items-center gap-2" style={{ overflow: 'hidden' }}>
            <h3 className="m-0" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>Deployment List</h3>
            <Button
                label="Delete Selected"
                icon="pi pi-trash"
                severity="danger"
                onClick={openDeleteDialog}
                disabled={selectedDeployments.length === 0 || deleting}
                style={{ flexShrink: 0 }}
            />
        </div>
    );

    return (
        <div className="card">
            <Toast ref={toast} position="top-right" />

            <DataTable
                value={deployments}
                dataKey="name"
                header={tableHeader}
                selectionMode="multiple"
                selection={selectedDeployments}
                onSelectionChange={(e) => setSelectedDeployments(Array.isArray(e.value) ? e.value : [])}
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.DeploymentInfo)}
                stripedRows
                showGridlines
                resizableColumns
                scrollHeight="90vh"
                emptyMessage="No deployments found"
                style={{ minWidth: '50rem' }}
            >
                <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
                <Column field="name" header="Name" sortable />
                <Column field="namespace" header="Namespace" sortable />
                <Column
                    header="Replicas"
                    sortable
                    sortField="ready_replicas"
                    body={(rowData: models.DeploymentInfo) => (
                        <Tag
                            value={`${rowData.ready_replicas} / ${rowData.replicas}`}
                            severity={getReplicasSeverity(rowData.ready_replicas, rowData.replicas)}
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
