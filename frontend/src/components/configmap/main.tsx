import { useEffect, useRef, useState } from 'react';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { GetConfigMaps, DeleteConfigMap } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const defaultFilters: DataTableFilterMeta = {
    name:       { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace:  { value: null, matchMode: FilterMatchMode.CONTAINS },
    data_count: { value: null, matchMode: FilterMatchMode.EQUALS },
};

type ConfigMapRow = models.ConfigMapInfo & { _uid: string };

export default function ConfigMapListComponent() {
    const [configMaps, setConfigMaps] = useState<ConfigMapRow[]>([]);
    const [selectedConfigMaps, setSelectedConfigMaps] = useState<ConfigMapRow[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel, openConfigMapEditor } = useTabContext();

    const loadConfigMaps = async () => {
        try {
            const items = await GetConfigMaps();
            setConfigMaps(items.map((item: any) => {
                const cm = models.ConfigMapInfo.createFrom(item) as ConfigMapRow;
                cm._uid = `${cm.namespace}/${cm.name}`;
                return cm;
            }));
        } catch (error) {
            console.error('Failed to load configmaps:', error);
            setConfigMaps([]);
        }
    };

    useEffect(() => {
        loadConfigMaps();
        const intervalId = window.setInterval(loadConfigMaps, 2000);
        return () => window.clearInterval(intervalId);
    }, []);

    const openDeleteDialog = () => {
        if (selectedConfigMaps.length > 0) setDeleteDialogVisible(true);
    };

    const handleDeleteSelected = async () => {
        if (selectedConfigMaps.length === 0) { setDeleteDialogVisible(false); return; }

        setDeleting(true);
        const toDelete = [...selectedConfigMaps];

        for (const cm of toDelete) {
            try {
                await DeleteConfigMap(cm.name, cm.namespace);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Deleted successfully',
                    detail: `${cm.namespace}/${cm.name} deleted`,
                    life: 2500,
                });
            } catch {
                toast.current?.show({
                    severity: 'error',
                    summary: 'Delete failed',
                    detail: `${cm.namespace}/${cm.name} could not be deleted`,
                    life: 3500,
                });
            }
        }

        setSelectedConfigMaps([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await loadConfigMaps();
    };

    const handleRowDoubleClick = (cm: models.ConfigMapInfo) => {
        openYamlPanel({
            resourceKind: 'configmap',
            name: cm.name,
            namespace: cm.namespace,
            referencePanel: 'configmaps',
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
                <h3 style={{ margin: 0 }}>ConfigMap List</h3>
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
                        disabled={selectedConfigMaps.length === 0 || deleting}
                    />
                </div>
            </div>

            <DataTable
                value={configMaps}
                dataKey="_uid"
                selectionMode="multiple"
                selection={selectedConfigMaps}
                onSelectionChange={(e) => setSelectedConfigMaps(Array.isArray(e.value) ? e.value : [])}
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.ConfigMapInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No configmaps found"
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
                    body={(rowData: models.ConfigMapInfo) => (
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
                    body={(rowData: models.ConfigMapInfo) => (
                        <Button
                            icon="pi pi-sliders-h"
                            text
                            size="small"
                            severity="secondary"
                            style={{ padding: '0.2rem', fontSize: '0.7rem' }}
                            onClick={() => openConfigMapEditor({
                                name: rowData.name,
                                namespace: rowData.namespace,
                                referencePanel: 'configmaps',
                            })}
                        />
                    )}
                />
            </DataTable>

            <Dialog
                header="Delete ConfigMap Confirmation"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteDialogVisible(false); }}
            >
                <p className="m-0 mb-3">Do you want to delete the selected configmaps?</p>
                <ul className="m-0 pl-3">
                    {selectedConfigMaps.map((cm) => (
                        <li key={`${cm.namespace}-${cm.name}`}>{cm.namespace}/{cm.name}</li>
                    ))}
                </ul>
            </Dialog>
        </div>
    );
}
