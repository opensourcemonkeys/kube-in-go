import { useEffect, useRef, useState } from 'react';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { GetSecrets, DeleteSecret } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const defaultFilters: DataTableFilterMeta = {
    name:       { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace:  { value: null, matchMode: FilterMatchMode.CONTAINS },
    type:       { value: null, matchMode: FilterMatchMode.CONTAINS },
    data_count: { value: null, matchMode: FilterMatchMode.EQUALS },
};

export default function SecretListComponent() {
    const [secrets, setSecrets] = useState<models.SecretInfo[]>([]);
    const [selectedSecrets, setSelectedSecrets] = useState<models.SecretInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel, openSecretEditor } = useTabContext();

    const loadSecrets = async () => {
        try {
            const items = await GetSecrets();
            setSecrets(items.map((item: any) => models.SecretInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load secrets:', error);
            setSecrets([]);
        }
    };

    useEffect(() => {
        loadSecrets();
        const intervalId = window.setInterval(loadSecrets, 2000);
        return () => window.clearInterval(intervalId);
    }, []);

    const openDeleteDialog = () => {
        if (selectedSecrets.length > 0) setDeleteDialogVisible(true);
    };

    const handleDeleteSelected = async () => {
        if (selectedSecrets.length === 0) { setDeleteDialogVisible(false); return; }

        setDeleting(true);
        const toDelete = [...selectedSecrets];

        for (const s of toDelete) {
            try {
                await DeleteSecret(s.name, s.namespace);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Deleted successfully',
                    detail: `${s.namespace}/${s.name} deleted`,
                    life: 2500,
                });
            } catch {
                toast.current?.show({
                    severity: 'error',
                    summary: 'Delete failed',
                    detail: `${s.namespace}/${s.name} could not be deleted`,
                    life: 3500,
                });
            }
        }

        setSelectedSecrets([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await loadSecrets();
    };

    const handleRowDoubleClick = (s: models.SecretInfo) => {
        openYamlPanel({
            resourceKind: 'secret',
            name: s.name,
            namespace: s.namespace,
            referencePanel: 'secrets',
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
                <h3 style={{ margin: 0 }}>Secret List</h3>
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
                        onClick={openDeleteDialog}
                        disabled={selectedSecrets.length === 0 || deleting}
                    />
                </div>
            </div>

            <DataTable
                value={secrets}
                dataKey="name"
                selectionMode="multiple"
                selection={selectedSecrets}
                onSelectionChange={(e) => setSelectedSecrets(Array.isArray(e.value) ? e.value : [])}
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.SecretInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No secrets found"
            >
                <Column key="sel" selectionMode="multiple" headerStyle={{ width: '3rem' }} style={{ minWidth: '3rem', maxWidth: '3rem' }} />
                <Column
                    key="name"
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
                    key="namespace"
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
                    key="type"
                    field="type"
                    header="Type"
                    sortable
                    filter
                    filterField="type"
                    filterPlaceholder="Search type"
                    showFilterMenu={false}
                    style={{ minWidth: '12rem', fontSize: '0.8rem', fontFamily: 'monospace' }}
                />
                <Column
                    key="data_count"
                    field="data_count"
                    header="Data Keys"
                    sortable
                    filter
                    filterField="data_count"
                    filterPlaceholder="Count"
                    showFilterMenu={false}
                    dataType="numeric"
                    style={{ minWidth: '8rem' }}
                    body={(rowData: models.SecretInfo) => (
                        <Tag
                            value={rowData.data_count}
                            severity={rowData.data_count > 0 ? 'info' : 'secondary'}
                        />
                    )}
                />
                <Column
                    key="actions"
                    header=""
                    style={{ width: '4rem', textAlign: 'center' }}
                    body={(rowData: models.SecretInfo) => (
                        <Button
                            icon="pi pi-sliders-h"
                            text
                            size="small"
                            severity="secondary"
                            style={{ padding: '0.2rem', fontSize: '0.7rem' }}
                            onClick={() => openSecretEditor({
                                name: rowData.name,
                                namespace: rowData.namespace,
                                referencePanel: 'secrets',
                            })}
                        />
                    )}
                />
            </DataTable>

            <Dialog
                header="Delete Secret Confirmation"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteDialogVisible(false); }}
            >
                <p className="m-0 mb-3">Do you want to delete the selected secrets?</p>
                <ul className="m-0 pl-3">
                    {selectedSecrets.map((s) => (
                        <li key={`${s.namespace}-${s.name}`}>{s.namespace}/{s.name}</li>
                    ))}
                </ul>
            </Dialog>
        </div>
    );
}
