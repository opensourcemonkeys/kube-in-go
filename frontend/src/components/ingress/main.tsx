import { useEffect, useRef, useState } from 'react';
import FilterListOff from '@mui/icons-material/FilterListOff';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import Close from '@mui/icons-material/Close';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { GetIngresses, DeleteIngress } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.CONTAINS },
    class_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
};

const formatHosts = (rules: models.IngressRuleInfo[]): string => {
    if (!rules || rules.length === 0) return '*';
    return rules.map(r => r.host || '*').join(', ');
};

const formatPaths = (rules: models.IngressRuleInfo[]): string => {
    if (!rules || rules.length === 0) return '-';
    const paths: string[] = [];
    for (const r of rules) {
        if (r.paths && r.paths.length > 0) {
            for (const p of r.paths) {
                paths.push(r.host ? `${r.host}${p}` : p);
            }
        }
    }
    return paths.length > 0 ? paths.join(', ') : '-';
};

export default function IngressListComponent() {
    const [ingresses, setIngresses] = useState<models.IngressInfo[]>([]);
    const [selectedIngresses, setSelectedIngresses] = useState<models.IngressInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel } = useTabContext();

    const loadIngresses = async () => {
        try {
            const items = await GetIngresses();
            setIngresses(items.map((item: any) => models.IngressInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load ingresses:', error);
            setIngresses([]);
        }
    };

    useEffect(() => {
        loadIngresses();
        const intervalId = window.setInterval(loadIngresses, 2000);
        return () => window.clearInterval(intervalId);
    }, []);

    const openDeleteDialog = () => {
        if (selectedIngresses.length > 0) setDeleteDialogVisible(true);
    };

    const handleDeleteSelected = async () => {
        if (selectedIngresses.length === 0) { setDeleteDialogVisible(false); return; }

        setDeleting(true);
        const toDelete = [...selectedIngresses];

        for (const ing of toDelete) {
            try {
                await DeleteIngress(ing.name, ing.namespace);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Deleted successfully',
                    detail: `${ing.namespace}/${ing.name} deleted`,
                    life: 2500,
                });
            } catch {
                toast.current?.show({
                    severity: 'error',
                    summary: 'Delete failed',
                    detail: `${ing.namespace}/${ing.name} could not be deleted`,
                    life: 3500,
                });
            }
        }

        setSelectedIngresses([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await loadIngresses();
    };

    const handleRowDoubleClick = (ing: models.IngressInfo) => {
        openYamlPanel({
            resourceKind: 'ingress',
            name: ing.name,
            namespace: ing.namespace,
            referencePanel: 'ingresses',
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
                <h3 style={{ margin: 0 }}>Ingress List</h3>
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
                        disabled={selectedIngresses.length === 0 || deleting}
                    />
                </div>
            </div>

            <DataTable
                value={ingresses}
                dataKey="name"
                selectionMode="multiple"
                selection={selectedIngresses}
                onSelectionChange={(e) => setSelectedIngresses(Array.isArray(e.value) ? e.value : [])}
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.IngressInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No ingresses found"
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
                    field="class_name"
                    header="Class"
                    sortable
                    filter
                    filterField="class_name"
                    filterPlaceholder="Search class"
                    showFilterMenu={false}
                    style={{ minWidth: '9rem' }}
                    body={(row: models.IngressInfo) => row.class_name || '-'}
                />
                <Column
                    header="Hosts"
                    style={{ minWidth: '16rem' }}
                    body={(row: models.IngressInfo) => formatHosts(row.rules)}
                />
                <Column
                    header="Paths"
                    style={{ minWidth: '18rem' }}
                    body={(row: models.IngressInfo) => formatPaths(row.rules)}
                />
                <Column
                    field="address"
                    header="Address"
                    sortable
                    style={{ minWidth: '12rem' }}
                    body={(row: models.IngressInfo) => row.address || '-'}
                />
                <Column
                    field="tls"
                    header="TLS"
                    sortable
                    style={{ minWidth: '6rem' }}
                    body={(row: models.IngressInfo) => (
                        <Tag
                            value={row.tls ? 'Yes' : 'No'}
                            severity={row.tls ? 'success' : 'secondary'}
                        />
                    )}
                />
            </DataTable>

            <Dialog
                header="Delete Ingress Confirmation"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteDialogVisible(false); }}
            >
                <p className="m-0 mb-3">Do you want to delete the selected ingress records?</p>
                <ul className="m-0 pl-3">
                    {selectedIngresses.map((ing) => (
                        <li key={`${ing.namespace}-${ing.name}`}>{ing.namespace}/{ing.name}</li>
                    ))}
                </ul>
            </Dialog>
        </div>
    );
}
